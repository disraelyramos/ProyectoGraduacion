// middlewares/auth.middleware.js
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

// Acepta "40" o "40m" (pero recomendado: "40")
function parseMinutes(value, fallback = 30) {
  if (!value) return fallback;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const SESSION_INACTIVITY_MIN = parseMinutes(process.env.SESSION_INACTIVITY_MIN, 30);

module.exports = async (req, res, next) => {
  try {
    // 1) Header y token
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'Token requerido' });

    const [scheme, token] = authHeader.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return res.status(401).json({ message: 'Formato de Authorization inválido' });
    }

    // 2) Verificar JWT
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (errJwt) {
      if (errJwt?.name === 'TokenExpiredError') {
        return res.status(401).json({ message: 'Token expirado' });
      }
      return res.status(403).json({ message: 'Token no válido' });
    }

    // 3) Validar sesión en BD (token debe existir y estar activa)
    const { rows } = await pool.query(
      `SELECT id, id_usuario, fecha_expiracion, activo
         FROM sesiones
        WHERE token = $1
        LIMIT 1`,
      [token]
    );

    if (rows.length === 0 || rows[0].activo !== true) {
      return res.status(401).json({ message: 'Sesión expirada o inválida' });
    }

    const sesion = rows[0];
    const ahora = new Date();
    const exp = new Date(sesion.fecha_expiracion);

    // 4) Si la sesión expiró por inactividad → desactivar y rechazar
    if (ahora > exp) {
      await pool.query(`UPDATE sesiones SET activo = false WHERE id = $1`, [sesion.id]);
      return res.status(401).json({ message: 'Sesión expirada' });
    }

    // 5) Renovar ventana de inactividad usando reloj de la BD
    await pool.query(
      `UPDATE sesiones
          SET fecha_expiracion = NOW() + ($1 || ' minutes')::interval
        WHERE id = $2`,
      [SESSION_INACTIVITY_MIN, sesion.id]
    );

    // 6) Adjuntar identidad al request
    // id_usuario se toma de la sesión (fuente de verdad). Datos extra vienen del JWT.
    req.user = {
      id_usuario: sesion.id_usuario,
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
