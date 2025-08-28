const pool = require("../config/db");
const xss = require("xss");

//Crear nuevo contenedor
exports.createContenedor = async (req, res) => {
  try {
    if (!req.user || !req.user.id_usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado" });
    }

    let { ubicacion, tipoResiduo, estado } = req.body;

    ubicacion = xss(ubicacion);
    tipoResiduo = xss(tipoResiduo);
    estado = xss(estado);

    const ubicacionId = parseInt(ubicacion, 10);
    const tipoResiduoId = parseInt(tipoResiduo, 10);
    const estadoId = parseInt(estado, 10);

    if (
      !ubicacionId || isNaN(ubicacionId) ||
      !tipoResiduoId || isNaN(tipoResiduoId) ||
      !estadoId || isNaN(estadoId)
    ) {
      return res.status(400).json({
        success: false,
        message: "IDs de ubicación, tipo de residuo y estado deben ser números válidos"
      });
    }

    //  Obtener último código CNT-XXX
    const lastCodeRes = await pool.query(
      "SELECT codigo FROM contenedores ORDER BY id_contenedor DESC LIMIT 1"
    );

    let nextNumber = 1;
    if (lastCodeRes.rows.length > 0) {
      const lastCode = lastCodeRes.rows[0].codigo;
      const lastNumber = parseInt(lastCode.split("-")[1], 10);
      if (!isNaN(lastNumber)) {
        nextNumber = lastNumber + 1;
      }
    }

    const codigo = `CNT-${String(nextNumber).padStart(3, "0")}`;

    // 🔹 Insertar con valores iniciales
    const query = `
      INSERT INTO contenedores 
        (codigo, id_tipo_residuo, id_ubicacion, estado_id, 
         capacidad_max_litros, capacidad_max_lb, estado_actual_litros, estado_actual_lb)
      VALUES ($1, $2, $3, $4, 0, 0, 0, 0)
      RETURNING id_contenedor, codigo, id_tipo_residuo, id_ubicacion, fecha_registro, estado_id;
    `;

    const values = [codigo, tipoResiduoId, ubicacionId, estadoId];
    const result = await pool.query(query, values);

    return res.status(201).json({
      success: true,
      message: "Contenedor registrado correctamente",
      contenedor: result.rows[0],
    });
  } catch (err) {
    console.error(" Error creando contenedor:", err.message);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

// Listar contenedores
// Listar contenedores
exports.getContenedores = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id_contenedor,
        c.codigo,
        u.id_ubicacion,                  -- 👈 ID ubicación
        u.nombre AS ubicacion,
        tr.id AS id_tipo_residuo,        -- 👈 ID tipo de residuo
        tr.nombre AS tipo_residuo,
        TO_CHAR(c.fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
        e.id AS id_estado_contenedor,    -- 👈 ID estado
        e.nombre AS estado
      FROM contenedores c
      JOIN ubicaciones u ON c.id_ubicacion = u.id_ubicacion
      JOIN tipos_residuo tr ON c.id_tipo_residuo = tr.id
      JOIN estados_contenedor e ON c.estado_id = e.id
      ORDER BY c.id_contenedor DESC
    `);

    return res.json(result.rows);
  } catch (err) {
    console.error(" Error obteniendo contenedores:", err.message);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// Buscar contenedores (por código o tipo de residuo)
exports.buscarContenedores = async (req, res) => {
  try {
    let termino = req.query.termino || "";
    termino = xss(termino.trim());

    if (!termino) {
      return res.status(400).json({ success: false, message: "Debe proporcionar un término de búsqueda" });
    }

    const result = await pool.query(
      `
      SELECT 
        c.id_contenedor,
        c.codigo,
        u.id_ubicacion,                  -- 👈 ID ubicación
        u.nombre AS ubicacion,
        tr.id AS id_tipo_residuo,        -- 👈 ID tipo de residuo
        tr.nombre AS tipo_residuo,
        TO_CHAR(c.fecha_registro, 'YYYY-MM-DD') AS fecha_registro,
        e.id AS id_estado_contenedor,    -- 👈 ID estado
        e.nombre AS estado
      FROM contenedores c
      JOIN ubicaciones u ON c.id_ubicacion = u.id_ubicacion
      JOIN tipos_residuo tr ON c.id_tipo_residuo = tr.id
      JOIN estados_contenedor e ON c.estado_id = e.id
      WHERE CAST(c.codigo AS TEXT) ILIKE $1
         OR tr.nombre ILIKE $1
      ORDER BY c.id_contenedor DESC
      `,
      [`%${termino}%`]
    );

    return res.json(result.rows);
  } catch (err) {
    console.error(" Error en búsqueda:", err.message);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};


// 📌 Actualizar contenedor
exports.updateContenedor = async (req, res) => {
  try {
    // 🔐 Validar usuario autenticado
    if (!req.user || !req.user.id_usuario) {
      return res.status(401).json({ success: false, message: "Usuario no autenticado" });
    }

    const { id } = req.params; // ID del contenedor en la URL
    let { ubicacion, tipoResiduo, estado } = req.body;

    // 🛡️ Sanitizar
    ubicacion = xss(ubicacion);
    tipoResiduo = xss(tipoResiduo);
    estado = xss(estado);

    const ubicacionId = parseInt(ubicacion, 10);
    const tipoResiduoId = parseInt(tipoResiduo, 10);
    const estadoId = parseInt(estado, 10);
    const contenedorId = parseInt(id, 10);

    // Validar IDs
    if (
      !contenedorId || isNaN(contenedorId) ||
      !ubicacionId || isNaN(ubicacionId) ||
      !tipoResiduoId || isNaN(tipoResiduoId) ||
      !estadoId || isNaN(estadoId)
    ) {
      return res.status(400).json({
        success: false,
        message: "Datos inválidos. Verifique los IDs enviados"
      });
    }

    // 🔎 Verificar si existe el contenedor
    const checkRes = await pool.query(
      "SELECT id_contenedor FROM contenedores WHERE id_contenedor = $1",
      [contenedorId]
    );

    if (checkRes.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Contenedor no encontrado" });
    }

    // 🔹 Actualizar
    const query = `
      UPDATE contenedores
      SET id_tipo_residuo = $1,
          id_ubicacion = $2,
          estado_id = $3
      WHERE id_contenedor = $4
      RETURNING id_contenedor, codigo, id_tipo_residuo, id_ubicacion, fecha_registro, estado_id;
    `;

    const values = [tipoResiduoId, ubicacionId, estadoId, contenedorId];
    const result = await pool.query(query, values);

    return res.json({
      success: true,
      message: "Contenedor actualizado correctamente",
      contenedor: result.rows[0]
    });
  } catch (err) {
    console.error("❌ Error actualizando contenedor:", err.message);
    return res.status(500).json({ success: false, message: "Error interno del servidor" });
  }
};

