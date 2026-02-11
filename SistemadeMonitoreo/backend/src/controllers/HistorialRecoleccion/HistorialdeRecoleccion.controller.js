// backend/src/controllers/HistorialRecoleccion/HistorialdeRecoleccion.controller.js
const pool = require("../../config/db");
const xss = require("xss");

// ===============================
// Helpers (mismo estilo que tu controller)
// ===============================
function requireAuth(req, res) {
  if (!req.user || !req.user.id_usuario) {
    res.status(401).json({ message: "Usuario no autenticado" });
    return false;
  }
  return true;
}

function toInt(v) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function normOrder(v) {
  const s = String(v || "desc").toLowerCase();
  return s === "asc" ? "ASC" : "DESC";
}

function isValidISODate(d) {
  // Espera YYYY-MM-DD
  if (!d) return false;
  const s = String(d).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = new Date(s + "T00:00:00");
  return !Number.isNaN(dt.getTime());
}

// ===============================
// GET: Historial de recolección (solo lectura)

exports.obtenerHistorial = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const buscarPor = String(req.query?.buscarPor || "").trim().toLowerCase();
  const valorBusquedaRaw = req.query?.valorBusqueda ? String(req.query.valorBusqueda) : "";
  const valorBusqueda = xss(valorBusquedaRaw.trim());

  const fechaInicio = String(req.query?.fechaInicio || "").trim();
  const fechaFin = String(req.query?.fechaFin || "").trim();

  const page = toInt(req.query?.page) || 1;
  const limit = toInt(req.query?.limit) || 10;
  const order = normOrder(req.query?.order);

  //  Validaciones (según lo pulido)
  if (!buscarPor || !valorBusqueda || !fechaInicio || !fechaFin) {
    return res.status(400).json({
      message: "Debe completar todos los campos de búsqueda.",
      type: "validation",
    });
  }

  if (!["codigo", "tipo"].includes(buscarPor)) {
    return res.status(400).json({
      message: "Buscar por inválido. Use 'codigo' o 'tipo'.",
      type: "validation",
    });
  }

  if (!isValidISODate(fechaInicio) || !isValidISODate(fechaFin)) {
    return res.status(400).json({
      message: "Formato de fecha inválido. Use YYYY-MM-DD.",
      type: "validation",
    });
  }

  const dIni = new Date(fechaInicio + "T00:00:00");
  const dFin = new Date(fechaFin + "T23:59:59");

  if (dIni > dFin) {
    return res.status(400).json({
      message: "La fecha de inicio no puede ser mayor que la fecha final.",
      type: "validation",
    });
  }

  // Para no permitir búsquedas demasiado cortas (evita ruido)
  if (valorBusqueda.length < 2) {
    return res.status(400).json({
      message: "La búsqueda debe tener al menos 2 caracteres.",
      type: "validation",
    });
  }

  // Paginación segura
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  const offset = (safePage - 1) * safeLimit;

  const client = await pool.connect();
  try {
    // ===============================
    // 1) Construir filtro (parametrizado)
    // ===============================
   
    let whereExtra = "";
    const paramsBase = [fechaInicio, fechaFin];

    let where = `
      WHERE r.fecha_recoleccion::date BETWEEN $1::date AND $2::date
    `;

    if (buscarPor === "codigo") {
      paramsBase.push(valorBusqueda);
      whereExtra = ` AND c.codigo ILIKE '%' || $3 || '%' `;
    } else {
      // buscarPor === "tipo"
      paramsBase.push(valorBusqueda);
      whereExtra = ` AND tr.nombre ILIKE '%' || $3 || '%' `;
    }

    // ===============================
    // 2) Total (para paginación)
    // ===============================
    const countSql = `
      SELECT COUNT(*)::int AS total
        FROM recolecciones r
        JOIN contenedores c ON c.id_contenedor = r.contenedor_id
        LEFT JOIN tipos_residuo tr ON tr.id = c.id_tipo_residuo
      ${where}
      ${whereExtra}
    `;

    const countRes = await client.query(countSql, paramsBase);
    const total = countRes.rows?.[0]?.total || 0;

    if (total === 0) {
      return res.json({
        message: "No hay datos para este rango de fechas.",
        total: 0,
        page: safePage,
        limit: safeLimit,
        data: {
          detalle: [],
          pesaje: [],
        },
      });
    }

    // ===============================
    // 3) Datos detalle (Tabla 1) paginados
    // ===============================

    const dataSql = `
      SELECT
        r.id AS recoleccion_id,
        c.codigo AS codigo_contenedor,
        r.fecha_recoleccion,
        d.nombre AS distrito,
        tr.nombre AS tipo_residuo,
        r.numero_recibo,
        r.responsable,
        er.nombre AS empresa_recolectora,
        r.porcentaje_pendiente,
        r.cantidad_libras_pendientes,
        r.observaciones
      FROM recolecciones r
      JOIN contenedores c ON c.id_contenedor = r.contenedor_id
      LEFT JOIN tipos_residuo tr ON tr.id = c.id_tipo_residuo
      LEFT JOIN distritos d ON d.id = r.distrito_id
      LEFT JOIN empresas_recolectoras er ON er.id = r.empresa_id
      ${where}
      ${whereExtra}
      ORDER BY r.fecha_recoleccion ${order}, r.id ${order}
      LIMIT $4 OFFSET $5
    `;

    const dataParams = [...paramsBase, safeLimit, offset];
    const detRes = await client.query(dataSql, dataParams);
    const detalleRows = detRes.rows || [];

    // ids en orden (para sincronía con tabla 2)
    const ids = detalleRows.map((r) => Number(r.recoleccion_id)).filter(Boolean);

    // ===============================
    // 4) Datos pesaje (Tabla 2) por recoleccion_id IN (...)
    // ===============================
    let pesajeMap = new Map();
    if (ids.length > 0) {
      const pesajeSql = `
        SELECT
          h.recoleccion_id,
          h.total_en_libras,
          h.porcentaje_recolectado,
          h.porcentaje_llenado,
          h.costo_por_libra_aplicado,
          h.total_costo_q
        FROM historial_calculo_costos h
        WHERE h.recoleccion_id = ANY($1::int[])
      `;

      const pesajeRes = await client.query(pesajeSql, [ids]);
      for (const row of pesajeRes.rows || []) {
        pesajeMap.set(Number(row.recoleccion_id), row);
      }
    }

    // ===============================
    // 5) Armar salida sincronizada (mismo orden)
    // ===============================
    const detalle = detalleRows.map((r) => ({
      recoleccion_id: Number(r.recoleccion_id),
      codigo: r.codigo_contenedor,
      fecha: r.fecha_recoleccion,
      distrito: r.distrito,
      tipo_residuo: r.tipo_residuo,
      numero_recibo: r.numero_recibo,
      responsable: r.responsable,
      empresa_recolectora: r.empresa_recolectora,
      porcentaje_pendiente: r.porcentaje_pendiente,
      cantidad_libras_pendientes: r.cantidad_libras_pendientes,
      observaciones: r.observaciones,
    }));

    const pesaje = detalleRows.map((r) => {
      const k = Number(r.recoleccion_id);
      const p = pesajeMap.get(k);

      return {
        recoleccion_id: k,
        total_en_libras: p ? p.total_en_libras : null,
        porcentaje_recolectado: p ? p.porcentaje_recolectado : null,
        porcentaje_llenado: p ? p.porcentaje_llenado : null,
        costo_por_libra_aplicado: p ? p.costo_por_libra_aplicado : null,
        total_costo_q: p ? p.total_costo_q : null,
      };
    });

    return res.json({
      message: "Historial obtenido correctamente.",
      total,
      page: safePage,
      limit: safeLimit,
      order: order === "ASC" ? "asc" : "desc",
      data: {
        detalle,
        pesaje,
      },
    });
  } catch (err) {
    console.error("Error obtenerHistorial:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};
