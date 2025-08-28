const pool = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const xss = require('xss'); // sanitizar entradas contra XSS
require('dotenv').config();

exports.login = async (req, res) => {
  let { usuario, contrasena } = req.body;

  try {
    // Sanitizar inputs
    usuario = xss(usuario);

    //  Validar campos obligatorios
    if (!usuario || !contrasena) {
      return res.status(400).json({ message: 'Usuario y contraseña requeridos' });
    }

    // Buscar usuario con rol
    const query = `
      SELECT u.id_usuario, u.nombre, u.usuario, u.password_hash, u.estado_id,
             u.intentos_fallidos, u.bloqueado_hasta, u.ultimo_login,
             r.id AS rol_id, r.nombre AS rol
      FROM usuarios u
      JOIN roles r ON u.rol_id = r.id
      WHERE u.usuario = $1
    `;
    const result = await pool.query(query, [usuario]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    const user = result.rows[0];

    // Verificar si está bloqueado actualmente
    if (user.bloqueado_hasta && new Date(user.bloqueado_hasta) > new Date()) {
      const nuevoBloqueo = new Date(Date.now() + 1 * 60 * 1000);

      await pool.query(
        `UPDATE usuarios SET bloqueado_hasta = $1 WHERE id_usuario = $2`,
        [nuevoBloqueo, user.id_usuario]
      );

      return res.status(403).json({
        message: `Usuario bloqueado hasta ${nuevoBloqueo.toISOString()}`,
        bloqueado_hasta: nuevoBloqueo.toISOString()
      });
    }

    // Verificar estado activo
    if (user.estado_id !== 1) { // 1 = Activo
      return res.status(403).json({ message: 'Usuario inactivo o bloqueado' });
    }

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(contrasena, user.password_hash);

    if (!passwordValida) {
      let nuevosIntentos = user.intentos_fallidos + 1;

      if (nuevosIntentos >= 3) {
        const bloqueoHasta = new Date(Date.now() + 1 * 60 * 1000);

        await pool.query(
          `UPDATE usuarios
           SET bloqueado_hasta = $1,
               intentos_fallidos = 0
           WHERE id_usuario = $2`,
          [bloqueoHasta, user.id_usuario]
        );

        return res.status(403).json({
          message: 'Usuario bloqueado por 1 minuto',
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

    //Contraseña correcta → resetear intentos y bloqueo
    await pool.query(
      `UPDATE usuarios
       SET intentos_fallidos = 0,
           bloqueado_hasta = NULL,
           ultimo_login = NOW()
       WHERE id_usuario = $1`,
      [user.id_usuario]
    );

    // Generar JWT incluyendo usuario y rol
    const token = jwt.sign(
      {
        id_usuario: user.id_usuario,
        usuario: user.usuario,
        nombre: user.nombre,
        rol_id: user.rol_id,
        rol: user.rol
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    //  Registrar sesión en BD con expiración desde .env
    const expMin = parseInt(process.env.SESSION_INACTIVITY_MIN || "2");
    const fechaExp = new Date(Date.now() + expMin * 60 * 1000);

    await pool.query(
      `INSERT INTO sesiones (id_usuario, token, fecha_expiracion, activo) 
       VALUES ($1, $2, $3, TRUE)`,
      [user.id_usuario, token, fechaExp]
    );

    // Respuesta al frontend
    return res.json({
      message: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: user.id_usuario,
        nombre: user.nombre,
        usuario: user.usuario,
        rol_id: user.rol_id,
        rol: user.rol,
        ultimo_login: new Date()
      }
    });

  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).json({ message: 'Error en el servidor' });
  }
};
