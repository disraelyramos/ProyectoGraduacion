// controllers/auth.controller.js
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const xss = require('xss');
require('dotenv').config();

// Políticas configurables por ENV
const MAX_ATTEMPTS = parseInt(process.env.LOGIN_MAX_ATTEMPTS || '3', 10);
const BLOCK_MINUTES = parseInt(process.env.LOGIN_BLOCK_MINUTES || '1', 10);
const SESSION_INACTIVITY_MIN = parseInt(process.env.SESSION_INACTIVITY_MIN || '30', 10);
const SINGLE_SESSION_PER_USER = (process.env.SINGLE_SESSION_PER_USER || 'false').toLowerCase() === 'true';

// NUEVO: límites de expiración
const PASSWORD_MAX_AGE_DAYS = parseInt(process.env.PASSWORD_MAX_AGE_DAYS || '30', 10);
const PASSWORD_MAX_AGE_MINUTES = parseInt(process.env.PASSWORD_MAX_AGE_MINUTES || '0', 10); // opcional

exports.login = async (req, res) => {
  let { usuario, contrasena } = req.body || {};

  try {
    // 1) Sanitizar y validar
    usuario = typeof usuario === 'string' ? xss(usuario).trim() : '';
    contrasena = typeof contrasena === 'string' ? contrasena : '';

    if (!usuario || !contrasena) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }

    // 2) Buscar usuario + rol + políticas de contraseña
    const qUser = `
      SELECT u.id_usuario, u.nombre, u.usuario, u.password_hash, u.estado_id,
             u.intentos_fallidos, u.bloqueado_hasta, u.ultimo_login,
             u.debe_cambiar_password, u.fecha_ultimo_cambio,
             r.id AS rol_id, r.nombre AS rol
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.usuario = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(qUser, [usuario]);
    if (rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const user = rows[0];

    // 3) Verificar bloqueo temporal
    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      return res.status(403).json({
        message: `Usuario bloqueado temporalmente`,
        bloqueado_hasta: new Date(user.bloqueado_hasta).toISOString()
      });
    }

    // 4) Verificar estado (1 = Activo)
    if (user.estado_id !== 1) {
      return res.status(403).json({ message: 'Usuario inactivo o bloqueado' });
    }

    // 5) Verificar contraseña
    const ok = await bcrypt.compare(contrasena, user.password_hash);
    if (!ok) {
      const nuevosIntentos = (user.intentos_fallidos || 0) + 1;

      if (nuevosIntentos >= MAX_ATTEMPTS) {
        const bloqueoHasta = new Date(Date.now() + BLOCK_MINUTES * 60 * 1000);
        await pool.query(
          `UPDATE usuarios
             SET bloqueado_hasta = $1,
                 intentos_fallidos = 0
           WHERE id_usuario = $2`,
          [bloqueoHasta, user.id_usuario]
        );
        return res.status(403).json({
          message: `Usuario bloqueado por ${BLOCK_MINUTES} minuto(s)`,
          bloqueado_hasta: bloqueoHasta.toISOString()
        });
      } else {
        await pool.query(
          `UPDATE usuarios SET intentos_fallidos = $1 WHERE id_usuario = $2`,
          [nuevosIntentos, user.id_usuario]
        );
        return res.status(401).json({ message: 'Credenciales inválidas' });
      }
    }

    // 6) Políticas de contraseña
    const payload = {
      id_usuario: user.id_usuario,
      usuario: user.usuario,
      nombre: user.nombre,
      rol_id: user.rol_id,
      rol: user.rol
    };

    // 6.1 Forzado por bandera (primer login / admin fuerza)
    if (user.debe_cambiar_password) {
      const tokenCambio = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
      await pool.query(
        `INSERT INTO sesiones (id_usuario, token, fecha_inicio, fecha_expiracion, activo)
         VALUES ($1, $2, NOW(), NOW() + ($3 || ' minutes')::interval, TRUE)`,
        [user.id_usuario, tokenCambio, SESSION_INACTIVITY_MIN]
      );
      // ahora distinguimos el tipo
      return res.status(200).json({ requiereCambio: true, tipo: 'obligatoria', token: tokenCambio });
    }

    // 6.2 Expiración por tiempo (por días o minutos opcional)
    const ref = user.fecha_ultimo_cambio || user.ultimo_login;
    if (ref) {
      const diffMs = Date.now() - new Date(ref).getTime();
      const diffMin = diffMs / (1000 * 60);
      const diffDias = diffMs / (1000 * 60 * 60 * 24);

      const expiroPorMin = PASSWORD_MAX_AGE_MINUTES > 0 && diffMin >= PASSWORD_MAX_AGE_MINUTES;
      const expiroPorDia = PASSWORD_MAX_AGE_DAYS > 0 && diffDias >= PASSWORD_MAX_AGE_DAYS;

      if (expiroPorMin || expiroPorDia) {
        const tokenCambio = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });
        await pool.query(
          `INSERT INTO sesiones (id_usuario, token, fecha_inicio, fecha_expiracion, activo)
           VALUES ($1, $2, NOW(), NOW() + ($3 || ' minutes')::interval, TRUE)`,
          [user.id_usuario, tokenCambio, SESSION_INACTIVITY_MIN]
        );
        //tipo reconfirmación
        return res.status(200).json({ requiereCambio: true, tipo: 'reconfirmacion', token: tokenCambio });
      }
    }

    // 7) Login exitoso → transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `UPDATE usuarios
            SET intentos_fallidos = 0,
                bloqueado_hasta = NULL,
                ultimo_login = NOW()
          WHERE id_usuario = $1`,
        [user.id_usuario]
      );

      if (SINGLE_SESSION_PER_USER) {
        await client.query(
          `DELETE FROM sesiones WHERE id_usuario = $1 AND activo = TRUE`,
          [user.id_usuario]
        );
      }

      const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '15m' });

      await client.query(
        `INSERT INTO sesiones (id_usuario, token, fecha_inicio, fecha_expiracion, activo)
         VALUES ($1, $2, NOW(), NOW() + ($3 || ' minutes')::interval, TRUE)`,
        [user.id_usuario, token, SESSION_INACTIVITY_MIN]
      );

      await client.query('COMMIT');

      return res.json({
        message: 'Inicio de sesión exitoso',
        token,
        usuario: {
          id: user.id_usuario,
          nombre: user.nombre,
          usuario: user.usuario,
          rol_id: user.rol_id,
          rol: user.rol,
          ultimo_login: new Date().toISOString()
        }
      });
    } catch (errTx) {
      await client.query('ROLLBACK');
      if (errTx.code === '23514') {
        return res.status(400).json({ message: 'La expiración de la sesión debe ser posterior al inicio.' });
      }
      console.error('Error en transacción de login:', errTx);
      return res.status(500).json({ message: 'Error al crear la sesión' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

//Logout: borrar registro de sesión
exports.logout = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) {
      return res.status(400).json({ message: 'Authorization requerido' });
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(400).json({ message: 'Formato inválido de Authorization' });
    }

    const token = parts[1];

    const { rowCount } = await pool.query(
      `DELETE FROM sesiones WHERE token = $1`,
      [token]
    );

    return res.json({
      message: rowCount > 0 ? 'Sesión cerrada correctamente' : 'Sesión no encontrada o ya eliminada'
    });
  } catch (error) {
    console.error('Error en logout:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Cambio obligatorio de contraseña (sin pedir contraseña actual)
exports.cambiarPasswordObligatorio = async (req, res) => {
  try {
    let { usuario, nueva } = req.body || {};
    usuario = typeof usuario === 'string' ? xss(usuario).trim() : '';
    nueva   = typeof nueva   === 'string' ? nueva : '';

    if (!usuario || !nueva) {
      return res.status(400).json({ message: 'Usuario y nueva contraseña requeridos' });
    }

    // 1) Traer datos del usuario
    const qUser = `
      SELECT u.id_usuario, u.usuario, u.nombre, u.password_hash, u.estado_id,
             u.debe_cambiar_password, u.fecha_ultimo_cambio,
             r.id AS rol_id, r.nombre AS rol
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.usuario = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(qUser, [usuario]);
    if (rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    const user = rows[0];
    if (user.estado_id !== 1) {
      return res.status(403).json({ message: 'Usuario inactivo o bloqueado' });
    }

    // 2) Validar que NO repita actual ni últimas 5
    const qHist = `
      SELECT password_hash
      FROM historial_passwords
      WHERE id_usuario = $1
      ORDER BY fecha_cambio DESC
      LIMIT 5;
    `;
    const { rows: histRows } = await pool.query(qHist, [user.id_usuario]);
    const hashesARevisar = [user.password_hash, ...histRows.map(r => r.password_hash)];

    for (const h of hashesARevisar) {
      const coincide = await bcrypt.compare(nueva, h);
      if (coincide) {
        return res.status(400).json({
          message: 'La nueva contraseña no puede coincidir con las últimas 5 contraseñas'
        });
      }
    }

    // 3) Actualizar contraseña en transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Guardar la contraseña anterior en historial
      await client.query(
        `INSERT INTO historial_passwords (id_usuario, password_hash, fecha_cambio)
         VALUES ($1, $2, NOW())`,
        [user.id_usuario, user.password_hash]
      );

      // Nuevo hash
      const nuevoHash = await bcrypt.hash(nueva, 10);

      // Actualizar usuario
      await client.query(
        `UPDATE usuarios
           SET password_hash = $1,
               fecha_ultimo_cambio = NOW(),
               debe_cambiar_password = FALSE,
               intentos_fallidos = 0,
               bloqueado_hasta = NULL
         WHERE id_usuario = $2`,
        [nuevoHash, user.id_usuario]
      );

      // Cerrar sesiones previas si aplica
      if (SINGLE_SESSION_PER_USER) {
        await client.query(
          `DELETE FROM sesiones WHERE id_usuario = $1 AND activo = TRUE`,
          [user.id_usuario]
        );
      }

      // Generar nuevo token para continuar al dashboard
      const token = jwt.sign(
        {
          id_usuario: user.id_usuario,
          usuario: user.usuario,
          nombre: user.nombre,
          rol_id: user.rol_id,
          rol: user.rol
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      await client.query(
        `INSERT INTO sesiones (id_usuario, token, fecha_inicio, fecha_expiracion, activo)
         VALUES ($1, $2, NOW(), NOW() + ($3 || ' minutes')::interval, TRUE)`,
        [user.id_usuario, token, SESSION_INACTIVITY_MIN]
      );

      await client.query('COMMIT');

      return res.json({ message: 'Contraseña actualizada correctamente', token });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error al cambiar contraseña:', e);
      return res.status(500).json({ message: 'Error al actualizar contraseña' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en cambiarPasswordObligatorio:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};

// Reconfirmación por expiración (con contraseña actual)
exports.reconfirmarPassword = async (req, res) => {
  try {
    let { usuario, actual, nueva } = req.body || {};
    usuario = typeof usuario === 'string' ? xss(usuario).trim() : '';
    actual  = typeof actual  === 'string' ? actual  : '';
    nueva   = typeof nueva   === 'string' ? nueva   : '';

    if (!usuario || !actual || !nueva) {
      return res.status(400).json({ message: 'Usuario, contraseña actual y nueva son requeridos' });
    }

    // 1) Traer datos del usuario
    const qUser = `
      SELECT u.id_usuario, u.usuario, u.nombre, u.password_hash, u.estado_id,
             u.debe_cambiar_password, u.fecha_ultimo_cambio,
             r.id AS rol_id, r.nombre AS rol
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.usuario = $1
      LIMIT 1;
    `;
    const { rows } = await pool.query(qUser, [usuario]);
    if (rows.length === 0) return res.status(404).json({ message: 'Usuario no encontrado' });

    const user = rows[0];
    if (user.estado_id !== 1) {
      return res.status(403).json({ message: 'Usuario inactivo o bloqueado' });
    }

    // 2) Validar contraseña actual
    const okActual = await bcrypt.compare(actual, user.password_hash);
    if (!okActual) {
      return res.status(401).json({ message: 'La contraseña actual es incorrecta' });
    }

    // 3) Validar que NO repita actual ni últimas 5
    const qHist = `
      SELECT password_hash
      FROM historial_passwords
      WHERE id_usuario = $1
      ORDER BY fecha_cambio DESC
      LIMIT 5;
    `;
    const { rows: histRows } = await pool.query(qHist, [user.id_usuario]);
    const hashesARevisar = [user.password_hash, ...histRows.map(r => r.password_hash)];

    for (const h of hashesARevisar) {
      const coincide = await bcrypt.compare(nueva, h);
      if (coincide) {
        return res.status(400).json({
          message: 'esa contraseña ya fue utilizada'
        });
      }
    }

    // 4) Actualizar contraseña en transacción
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Guardar hash anterior en historial
      await client.query(
        `INSERT INTO historial_passwords (id_usuario, password_hash, fecha_cambio)
         VALUES ($1, $2, NOW())`,
        [user.id_usuario, user.password_hash]
      );

      const nuevoHash = await bcrypt.hash(nueva, 10);

      await client.query(
        `UPDATE usuarios
           SET password_hash = $1,
               fecha_ultimo_cambio = NOW(),
               debe_cambiar_password = FALSE,
               intentos_fallidos = 0,
               bloqueado_hasta = NULL
         WHERE id_usuario = $2`,
        [nuevoHash, user.id_usuario]
      );

      // Cerrar sesiones previas si tu política lo requiere
      if (SINGLE_SESSION_PER_USER) {
        await client.query(
          `DELETE FROM sesiones WHERE id_usuario = $1 AND activo = TRUE`,
          [user.id_usuario]
        );
      }

      // Generar nuevo token de sesión
      const token = jwt.sign(
        {
          id_usuario: user.id_usuario,
          usuario: user.usuario,
          nombre: user.nombre,
          rol_id: user.rol_id,
          rol: user.rol
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
      );

      await client.query(
        `INSERT INTO sesiones (id_usuario, token, fecha_inicio, fecha_expiracion, activo)
         VALUES ($1, $2, NOW(), NOW() + ($3 || ' minutes')::interval, TRUE)`,
        [user.id_usuario, token, SESSION_INACTIVITY_MIN]
      );

      await client.query('COMMIT');

      return res.json({ message: 'Contraseña actualizada correctamente', token });
    } catch (e) {
      await client.query('ROLLBACK');
      console.error('Error en reconfirmarPassword:', e);
      return res.status(500).json({ message: 'Error al actualizar contraseña' });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error en reconfirmarPassword:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};
