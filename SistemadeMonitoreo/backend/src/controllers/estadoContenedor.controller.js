const pool = require("../config/db");
const xss = require("xss");

exports.getEstadosContenedor = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id AS id_estado_contenedor, nombre FROM estados_contenedor ORDER BY nombre ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error(" Error obteniendo estados:", err.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
