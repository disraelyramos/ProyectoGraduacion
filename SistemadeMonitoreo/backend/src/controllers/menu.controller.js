const db = require('../config/db');

exports.getMenuByRole = async (req, res) => {
  const { role_id } = req.params;

  if (!role_id) {
    return res.status(400).json({ message: "role_id es obligatorio" });
  }

  let client;
  try {
    client = await db.connect(); //  obtener conexión del pool

    const query = `
      SELECT 
        m.id        AS modulo_id,
        m.nombre    AS modulo_nombre,
        m.icono     AS modulo_icono,
        m.ruta      AS modulo_ruta,
        s.id        AS submodulo_id,
        s.nombre    AS submodulo_nombre,
        s.ruta      AS submodulo_ruta,
        s.icono     AS submodulo_icono
      FROM modulo m
      LEFT JOIN submodulo s 
             ON s.modulo_id = m.id
      INNER JOIN permisos p 
             ON p.modulo_id = m.id 
            AND (p.submodulo_id = s.id OR s.id IS NULL)
      WHERE p.rol_id = $1
        AND p.active = TRUE
      ORDER BY m.id, s.id;
    `;

    const result = await client.query(query, [role_id]);

    //  Armar JSON estructurado
    const menu = [];
    const map = new Map();

    for (const row of result.rows) {
      let modulo = map.get(row.modulo_id);
      if (!modulo) {
        modulo = {
          id: row.modulo_id,
          nombre: row.modulo_nombre,
          icono: row.modulo_icono,
          ruta: row.modulo_ruta,
          submodulos: [],
        };
        map.set(row.modulo_id, modulo);
        menu.push(modulo);
      }
      if (row.submodulo_id) {
        modulo.submodulos.push({
          id: row.submodulo_id,
          nombre: row.submodulo_nombre,
          icono: row.submodulo_icono,
          ruta: row.submodulo_ruta,
        });
      }
    }

    res.json(menu);

  } catch (err) {
    console.error("Error en getMenuByRole:", err);
    res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    if (client) client.release(); // 🔑 liberar conexión
  }
};
