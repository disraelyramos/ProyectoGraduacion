// backend/src/controllers/historialcosto/HistorialCosto.controller.js
const pool = require("../../config/db");

const {
  crearSnapshot,
  obtenerSnapshotValido,
} = require("../../services/HistorialRecoleccion/ExportSnapshot.service");

const {
  registrarAuditoriaExportacion,
} = require("../../services/HistorialRecoleccion/AuditoriaExportaciones.service");

const { buildHistorialCostoPdfBuffer } = require("../../exports/pdf/historialCosto.pdf");
const { buildHistorialCostoExcelBuffer } = require("../../exports/excel/historialCosto.excel");

const MODULO = "HISTORIAL_COSTO";
const REPORTE = "reporte_costos";

// ===============================
// Helpers
// ===============================
const requireAuth = (req, res) =>
  req.user?.id_usuario ? true : (res.status(401).json({ message: "Usuario no autenticado" }), false);

const toInt = (v) => {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
};

const clamp = (n, min, max) => Math.min(Math.max(n, min), max);

const isValidISODate = (d) => {
  const s = String(d || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = new Date(`${s}T00:00:00`);
  return !Number.isNaN(dt.getTime());
};

const normGroupBy = (v) => {
  const s = String(v || "mes").trim().toLowerCase();
  if (s === "año") return "anio";
  return ["semana", "mes", "anio"].includes(s) ? s : "mes";
};

const normOrder = (v) => (String(v || "desc").trim().toLowerCase() === "asc" ? "ASC" : "DESC");

const getIp = (req) => (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "").trim();

const groupLabelExpr = (groupBy) =>
  groupBy === "semana"
    ? `to_char(date_trunc('week', r.fecha_recoleccion), '"Semana "IW" - "IYYY')`
    : groupBy === "anio"
      ? `to_char(date_trunc('year', r.fecha_recoleccion), 'YYYY')`
      : `to_char(date_trunc('month', r.fecha_recoleccion), 'YYYY-MM')`;

const buildWhere = ({ fechaInicio, fechaFin, distritoId, empresaId, contenedorId }) => {
  let where = `WHERE r.fecha_recoleccion::date BETWEEN $1::date AND $2::date`;
  const params = [fechaInicio, fechaFin];
  let i = 2;

  const addEq = (field, val) => {
    if (val === null || val === undefined) return;
    params.push(val);
    where += ` AND ${field} = $${++i}`;
  };

  addEq("r.distrito_id", distritoId);
  addEq("r.empresa_id", empresaId);
  addEq("r.contenedor_id", contenedorId);

  return { where, params };
};

const FROM_JOIN = `
  FROM historial_calculo_costos h
  JOIN recolecciones r ON r.id = h.recoleccion_id
  JOIN contenedores c ON c.id_contenedor = r.contenedor_id
  LEFT JOIN distritos d ON d.id = r.distrito_id
  LEFT JOIN empresas_recolectoras er ON er.id = r.empresa_id
`;

const mapKpis = (row) => ({
  total_q: Number(row?.total_q) || 0,
  total_lbs: Number(row?.total_lbs) || 0,
  q_por_lb: Number(row?.q_por_lb) || 0,
  recolecciones: Number(row?.recolecciones) || 0,
});

async function fetchFiltrosLabels(client, { distritoId, empresaId, contenedorId }) {
  const sql = `
    SELECT
      COALESCE(d.nombre,'')  AS distrito_nombre,
      COALESCE(er.nombre,'') AS empresa_nombre,
      COALESCE(c.codigo,'')  AS contenedor_codigo
    FROM distritos d
    JOIN empresas_recolectoras er ON er.id = $2
    JOIN contenedores c ON c.id_contenedor = $3
    WHERE d.id = $1
    LIMIT 1
  `;
  const row = (await client.query(sql, [distritoId, empresaId, contenedorId])).rows?.[0] || {};
  return {
    distritoNombre: row.distrito_nombre || "",
    empresaNombre: row.empresa_nombre || "",
    contenedorCodigo: row.contenedor_codigo || "",
  };
}

async function consultarReporteCosto(client, filtros, { paginado = true, limit = 10, offset = 0 } = {}) {
  const { fechaInicio, fechaFin, agruparPor, distritoId, empresaId, contenedorId, order } = filtros;
  const { where, params } = buildWhere({ fechaInicio, fechaFin, distritoId, empresaId, contenedorId });
  const grpLabel = groupLabelExpr(agruparPor);

  const kpiSql = `
    SELECT
      COALESCE(SUM(h.total_costo_q), 0)::numeric AS total_q,
      COALESCE(SUM(h.total_en_libras), 0)::numeric AS total_lbs,
      CASE WHEN COALESCE(SUM(h.total_en_libras), 0) > 0
        THEN ROUND(SUM(h.total_costo_q) / SUM(h.total_en_libras), 4)
        ELSE 0
      END AS q_por_lb,
      COUNT(*)::int AS recolecciones
    ${FROM_JOIN}
    ${where}
  `;
  const kpis = mapKpis((await client.query(kpiSql, params)).rows?.[0]);

  const resumenSql = `
    SELECT
      ${grpLabel} AS periodo,
      COALESCE(SUM(h.total_costo_q), 0)::numeric AS total_q,
      COALESCE(SUM(h.total_en_libras), 0)::numeric AS total_lbs,
      CASE WHEN COALESCE(SUM(h.total_en_libras), 0) > 0
        THEN ROUND(SUM(h.total_costo_q) / SUM(h.total_en_libras), 4)
        ELSE 0
      END AS q_por_lb,
      COUNT(*)::int AS recolecciones
    ${FROM_JOIN}
    ${where}
    GROUP BY ${grpLabel}
    ORDER BY ${grpLabel} ASC
  `;
  const resumen = (await client.query(resumenSql, params)).rows || [];

  const topContSql = `
    SELECT
      c.codigo AS contenedor_codigo,
      COALESCE(SUM(h.total_costo_q), 0)::numeric AS total_q
    ${FROM_JOIN}
    ${where}
    GROUP BY c.codigo
    ORDER BY total_q DESC
    LIMIT 5
  `;
  const topContenedores = (await client.query(topContSql, params)).rows || [];

  const detalleBaseSql = `
    SELECT
      to_char(r.fecha_recoleccion AT TIME ZONE 'America/Guatemala', 'DD/MM/YY HH24:MI') AS fecha,
      c.codigo AS codigo_contenedor,
      COALESCE(d.nombre, '') AS distrito,
      COALESCE(er.nombre, '') AS empresa_recolectora,
      h.total_en_libras,
      h.porcentaje_llenado,
      h.costo_por_libra_aplicado,
      h.total_costo_q
    ${FROM_JOIN}
    ${where}
    ORDER BY r.fecha_recoleccion ${order}, r.id ${order}
  `;

  const detalleRows = paginado
    ? (await client.query(
        `${detalleBaseSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
        [...params, limit, offset]
      )).rows || []
    : (await client.query(detalleBaseSql, params)).rows || [];

  const totalDetSql = `SELECT COUNT(*)::int AS total ${FROM_JOIN} ${where}`;
  const totalDetalle = (await client.query(totalDetSql, params)).rows?.[0]?.total || 0;

  return { kpis, resumen, topContenedores, detalle: { total: totalDetalle, rows: detalleRows } };
}

// ===============================
// GET /api/historial-costo
// ===============================
exports.obtenerReporte = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const fechaInicio = String(req.query?.fechaInicio || "").trim();
  const fechaFin = String(req.query?.fechaFin || "").trim();
  const agruparPor = normGroupBy(req.query?.agruparPor);

  const distritoId = toInt(req.query?.distritoId);
  const empresaId = toInt(req.query?.empresaId);
  const contenedorId = toInt(req.query?.contenedorId);

  const page = clamp(toInt(req.query?.page) || 1, 1, 1000000);
  const limit = clamp(toInt(req.query?.limit) || 10, 1, 100);
  const offset = (page - 1) * limit;
  const order = normOrder(req.query?.order);

  if (!fechaInicio || !fechaFin || !distritoId || !empresaId || !contenedorId)
    return res.status(400).json({ message: "Debe completar todos los filtros (fechas, distrito, empresa y contenedor).", type: "validation" });

  if (!isValidISODate(fechaInicio) || !isValidISODate(fechaFin))
    return res.status(400).json({ message: "Formato de fecha inválido. Use YYYY-MM-DD.", type: "validation" });

  if (new Date(`${fechaInicio}T00:00:00`) > new Date(`${fechaFin}T23:59:59`))
    return res.status(400).json({ message: "La fecha de inicio no puede ser mayor que la fecha final.", type: "validation" });

  const client = await pool.connect();
  try {
    const filtrosBase = { fechaInicio, fechaFin, agruparPor, distritoId, empresaId, contenedorId, order };
    const [labels, result] = await Promise.all([
      fetchFiltrosLabels(client, { distritoId, empresaId, contenedorId }),
      consultarReporteCosto(client, filtrosBase, { paginado: true, limit, offset }),
    ]);

    const filtrosSnapshot = {
      fechaInicio,
      fechaFin,
      agruparPor,
      distritoId,
      distritoNombre: labels.distritoNombre,
      empresaId,
      empresaNombre: labels.empresaNombre,
      contenedorId,
      contenedorCodigo: labels.contenedorCodigo,
      order: order === "ASC" ? "asc" : "desc",
    };

    const export_id = await crearSnapshot({ usuarioId: req.user.id_usuario, modulo: MODULO, filtros: filtrosSnapshot });

    return res.json({
      message: "Reporte de costos obtenido correctamente.",
      export_id,
      filtros: filtrosSnapshot,
      kpis: result.kpis,
      resumen: result.resumen,
      topContenedores: result.topContenedores,
      detalle: { total: result.detalle.total, page, limit, rows: result.detalle.rows },
    });
  } catch (err) {
    console.error("Error obtenerReporte (HistorialCosto):", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

// ===============================
// GET /api/historial-costo/export/pdf?exportId=...
// ===============================
exports.exportarPdf = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const exportId = String(req.query?.exportId || "").trim();
  if (!exportId) return res.status(400).json({ message: "exportId es requerido.", type: "validation" });

  let filtros = null;

  try {
    const snap = await obtenerSnapshotValido({ exportId, usuarioId: req.user.id_usuario, modulo: MODULO });
    if (!snap) return res.status(400).json({ message: "Exportación expirada o inválida. Presione 'Ver' nuevamente.", type: "validation" });

    filtros = snap.filtros_json || {};
    const order = normOrder(filtros?.order);

    const client = await pool.connect();
    const data = await (async () => {
      try {
        return await consultarReporteCosto(
          client,
          {
            fechaInicio: String(filtros.fechaInicio || ""),
            fechaFin: String(filtros.fechaFin || ""),
            agruparPor: normGroupBy(filtros.agruparPor),
            distritoId: toInt(filtros.distritoId),
            empresaId: toInt(filtros.empresaId),
            contenedorId: toInt(filtros.contenedorId),
            order,
          },
          { paginado: false }
        );
      } finally {
        client.release();
      }
    })();

    const pdfBuffer = await buildHistorialCostoPdfBuffer({
      filtros,
      generadoPor: req.user,
      kpis: data.kpis,
      resumen: data.resumen,
      topContenedores: data.topContenedores,
      detalle: data.detalle.rows,
    });

    await registrarAuditoriaExportacion({
      usuario_id: req.user.id_usuario,
      usuario: req.user.usuario,
      rol: req.user.rol,
      modulo: MODULO,
      reporte: REPORTE,
      formato: "PDF",
      export_id: exportId,
      filtros_json: filtros,
      total_registros: data.detalle.total,
      resumen_json: { filas_resumen: data.resumen.length, filas_detalle: data.detalle.rows.length, top_contenedores: data.topContenedores.length },
      estado: "GENERADO",
      error_mensaje: null,
      ip_origen: getIp(req),
      user_agent: req.headers["user-agent"] || null,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="reporte_costos.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("Error exportarPdf (HistorialCosto):", err);
    try {
      await registrarAuditoriaExportacion({
        usuario_id: req.user?.id_usuario || 0,
        usuario: req.user?.usuario || "N/A",
        rol: req.user?.rol || "N/A",
        modulo: MODULO,
        reporte: REPORTE,
        formato: "PDF",
        export_id: exportId || "N/A",
        filtros_json: filtros || { exportId },
        total_registros: 0,
        resumen_json: null,
        estado: "FALLIDO",
        error_mensaje: "Error al generar PDF",
        ip_origen: getIp(req),
        user_agent: req.headers["user-agent"] || null,
      });
    } catch (_) {}
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ===============================
// GET /api/historial-costo/export/excel?exportId=...
// ===============================
exports.exportarExcel = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const exportId = String(req.query?.exportId || "").trim();
  if (!exportId) return res.status(400).json({ message: "exportId es requerido.", type: "validation" });

  let filtros = null;

  try {
    const snap = await obtenerSnapshotValido({ exportId, usuarioId: req.user.id_usuario, modulo: MODULO });
    if (!snap) return res.status(400).json({ message: "Exportación expirada o inválida. Presione 'Ver' nuevamente.", type: "validation" });

    filtros = snap.filtros_json || {};
    const order = normOrder(filtros?.order);

    const client = await pool.connect();
    const data = await (async () => {
      try {
        return await consultarReporteCosto(
          client,
          {
            fechaInicio: String(filtros.fechaInicio || ""),
            fechaFin: String(filtros.fechaFin || ""),
            agruparPor: normGroupBy(filtros.agruparPor),
            distritoId: toInt(filtros.distritoId),
            empresaId: toInt(filtros.empresaId),
            contenedorId: toInt(filtros.contenedorId),
            order,
          },
          { paginado: false }
        );
      } finally {
        client.release();
      }
    })();

    const excelBuffer = await buildHistorialCostoExcelBuffer({
      filtros,
      generadoPor: req.user,
      kpis: data.kpis,
      resumen: data.resumen,
      topContenedores: data.topContenedores,
      detalle: data.detalle.rows,
      total: data.detalle.total,
    });

    await registrarAuditoriaExportacion({
      usuario_id: req.user.id_usuario,
      usuario: req.user.usuario,
      rol: req.user.rol,
      modulo: MODULO,
      reporte: REPORTE,
      formato: "EXCEL",
      export_id: exportId,
      filtros_json: filtros,
      total_registros: data.detalle.total,
      resumen_json: { filas_resumen: data.resumen.length, filas_detalle: data.detalle.rows.length, top_contenedores: data.topContenedores.length },
      estado: "GENERADO",
      error_mensaje: null,
      ip_origen: getIp(req),
      user_agent: req.headers["user-agent"] || null,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="reporte_costos.xlsx"`);
    return res.status(200).send(Buffer.from(excelBuffer));
  } catch (err) {
    console.error("Error exportarExcel (HistorialCosto):", err);
    try {
      await registrarAuditoriaExportacion({
        usuario_id: req.user?.id_usuario || 0,
        usuario: req.user?.usuario || "N/A",
        rol: req.user?.rol || "N/A",
        modulo: MODULO,
        reporte: REPORTE,
        formato: "EXCEL",
        export_id: exportId || "N/A",
        filtros_json: filtros || { exportId },
        total_registros: 0,
        resumen_json: null,
        estado: "FALLIDO",
        error_mensaje: "Error al generar Excel",
        ip_origen: getIp(req),
        user_agent: req.headers["user-agent"] || null,
      });
    } catch (_) {}
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};