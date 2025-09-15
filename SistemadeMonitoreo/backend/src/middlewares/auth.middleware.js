// middleware/auth.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

const SESSION_INACTIVITY_MIN = parseInt(process.env.SESSION_INACTIVITY_MIN || '30', 10);

module.exports = async (req, res, next) => {
  try {
    //Limpieza preventiva: borrar sesiones caducadas antes de validar
    await pool.query(`DELETE FROM sesiones WHERE fecha_expiracion < NOW()`);

    // 1) Header y token
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'Token requerido' });

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return res.status(401).json({ message: 'Formato de Authorization inválido' });
    }
    const token = parts[1];

    // 2) Verificar JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (errJwt) {
      if (errJwt.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expirado' });
      }
      return res.status(403).json({ message: 'Token no válido' });
    }

    // 3) Validar sesión en BD (token debe existir y estar activo)
    const { rows } = await pool.query(
      `SELECT id, id_usuario, fecha_expiracion, activo
         FROM sesiones
        WHERE token = $1
        LIMIT 1`,
      [token]
    );

    if (rows.length === 0 || !rows[0].activo) {
      return res.status(401).json({ message: 'Sesión expirada o inválida' });
    }

    const sesion = rows[0];
    const ahora = new Date();
    const exp = new Date(sesion.fecha_expiracion);

    // 4) Si la sesión expiró por inactividad → borrar de BD y rechazar
    if (ahora > exp) {
      await pool.query(`DELETE FROM sesiones WHERE id = $1`, [sesion.id]);
      return res.status(401).json({ message: 'Sesión expirada' });
    }

    // 5) Renovar ventana de inactividad usando reloj de la BD
    await pool.query(
      `UPDATE sesiones
          SET fecha_expiracion = NOW() + ($1 || ' minutes')::interval
        WHERE id = $2`,
      [SESSION_INACTIVITY_MIN, sesion.id]
    );

    // 6) Adjuntar identidad del token al request
    req.user = {
      id_usuario: decoded.id_usuario,
      usuario: decoded.usuario,
      nombre: decoded.nombre,
      rol_id: decoded.rol_id,
      rol: decoded.rol
    };

    return next();
  } catch (err) {
    console.error('Error en auth middleware:', err);
    return res.status(500).json({ message: 'Error de autenticación' });
  }
};
