const jwt = require('jsonwebtoken');
const pool = require('../config/db');
require('dotenv').config();

module.exports = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader) return res.status(401).json({ message: 'Token requerido' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Token inválido' });

    //  Verificar JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //  Revisar si la sesión sigue activa en BD
    const result = await pool.query(
      'SELECT * FROM sesiones WHERE token = $1 AND activo = TRUE',
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Sesión expirada o inválida' });
    }

    //  Revisar expiración manualmente
    const sesion = result.rows[0];
    const ahora = new Date();
    if (ahora > sesion.fecha_expiracion) {
      //  Soft-clean → desactivar sesión y limpiar token
      await pool.query(
        'UPDATE sesiones SET activo = FALSE, token = NULL WHERE id = $1',
        [sesion.id]
      );
      return res.status(401).json({ message: 'Sesión expirada' });
    }

    //  Renovar expiración por inactividad
    const nuevaExp = new Date(Date.now() + 2 * 60 * 1000); // +2 minutos
    await pool.query(
      'UPDATE sesiones SET fecha_expiracion = $1 WHERE id = $2',
      [nuevaExp, sesion.id]
    );

    req.user = decoded; // datos del usuario
    next();

  } catch (err) {
    console.error('Error en auth middleware:', err);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expirado' });
    }
    return res.status(403).json({ message: 'Token no válido' });
  }
};
