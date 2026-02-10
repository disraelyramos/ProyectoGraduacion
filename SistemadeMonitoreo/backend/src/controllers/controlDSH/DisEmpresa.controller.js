// backend/controllers/controlDSH/DisEmpresa.controller.js
const pool = require("../../config/db");

function requireAuth(req, res) {
  if (!req.user || !req.user.id_usuario) {
    res.status(401).json({ message: "Usuario no autenticado" });
    return false;
  }
  return true;
}

// GET /api/control-dsh/catalogos/distritos
exports.getDistritos = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const { rows } = await pool.query(
      `SELECT id, nombre
         FROM distritos
        ORDER BY nombre ASC`
    );

    return res.json(rows);
  } catch (err) {
    console.error("Error getDistritos:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// GET /api/control-dsh/catalogos/empresas
exports.getEmpresasRecolectoras = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const { rows } = await pool.query(
      `SELECT id, nombre
         FROM empresas_recolectoras
        ORDER BY nombre ASC`
    );

    return res.json(rows);
  } catch (err) {
    console.error("Error getEmpresasRecolectoras:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
