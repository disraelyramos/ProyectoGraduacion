const pool = require("../config/db");
const xss = require("xss");

// 📌 Obtener todas las ubicaciones
exports.getUbicaciones = async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id_ubicacion, nombre FROM ubicaciones ORDER BY nombre ASC"
    );
    res.json(result.rows);
  } catch (err) {
    console.error("❌ Error obteniendo ubicaciones:", err.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};

// 📌 Crear nueva ubicación
exports.createUbicacion = async (req, res) => {
  try {
    const nombre = xss(req.body.nombre?.trim());

    if (!nombre) {
      return res
        .status(400)
        .json({ message: "El nombre de la ubicación es obligatorio" });
    }

    const result = await pool.query(
      "INSERT INTO ubicaciones (nombre) VALUES ($1) RETURNING id_ubicacion, nombre",
      [nombre]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error("❌ Error creando ubicación:", err.message);
    res.status(500).json({ message: "Error interno del servidor" });
  }
};
