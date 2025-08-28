const pool = require("../config/db");
const xss = require("xss");

exports.getTiposResiduo = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id AS id_tipo_residuo, nombre FROM tipos_residuo ORDER BY nombre ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error obteniendo tipos de residuo:", err.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

exports.createTipoResiduo = async (req, res) => {
  try {
    const nombre = xss(req.body.nombre?.trim());

    if (!nombre) {
      return res
        .status(400)
        .json({ message: "El nombre del tipo de residuo es obligatorio" });
    }

    const result = await pool.query(
      "INSERT INTO tipos_residuo (nombre) VALUES ($1) RETURNING id AS id_tipo_residuo, nombre",
      [nombre]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creando tipo de residuo:", err.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
