const pool = require("../../config/db");
const crypto = require("crypto");
// backend/src/controllers/HistorialRecoleccion/HistorialdeRecoleccion.controller.js

const { consultarHistorial } = require("../../services/HistorialRecoleccion/HistorialRecoleccion.service");
const {
  crearSnapshot,
  obtenerSnapshotValido,
} = require("../../services/HistorialRecoleccion/ExportSnapshot.service");

const {
  registrarAuditoriaExportacion,
} = require("../../services/HistorialRecoleccion/AuditoriaExportaciones.service");

const {
  buildHistorialRecoleccionPdfBuffer,
} = require("../../exports/pdf/historialRecoleccion.pdf");

const {
  buildHistorialRecoleccionExcelBuffer,
} = require("../../exports/excel/historialRecoleccion.excel");

// ===============================
// Constantes del módulo
// ===============================
const MODULO = "HISTORIAL_RECOLECCION";
const REPORTE = "consulta_resultados";

// ===============================
// Helpers
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
  if (!d) return false;
  const s = String(d).trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const dt = new Date(s + "T00:00:00");
  return !Number.isNaN(dt.getTime());
}

function normSearchValue(v) {
  const s = String(v || "").trim();
  return s.length > 200 ? s.slice(0, 200) : s;
}

function getIp(req) {
  return (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "").trim();
}

// ===============================
// GET: Historial de recolección
// Route: GET /api/historial-recoleccion
// ===============================
exports.obtenerHistorial = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const buscarPor = String(req.query?.buscarPor || "").trim().toLowerCase();
  const valorBusqueda = normSearchValue(req.query?.valorBusqueda);
  const fechaInicio = String(req.query?.fechaInicio || "").trim();
  const fechaFin = String(req.query?.fechaFin || "").trim();

  const page = toInt(req.query?.page) || 1;
  const limit = toInt(req.query?.limit) || 10;
  const order = normOrder(req.query?.order);

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

  if (valorBusqueda.length < 2) {
    return res.status(400).json({
      message: "La búsqueda debe tener al menos 2 caracteres.",
      type: "validation",
    });
  }

  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safePage = Math.max(page, 1);
  const offset = (safePage - 1) * safeLimit;

  try {
    const filtros = { buscarPor, valorBusqueda, fechaInicio, fechaFin, order };

    const { total, detalle, pesaje } = await consultarHistorial(filtros, {
      paginado: true,
      limit: safeLimit,
      offset,
    });

    if (total === 0) {
      return res.json({
        message: "No hay datos para este rango de fechas.",
        total: 0,
        page: safePage,
        limit: safeLimit,
        data: { detalle: [], pesaje: [] },
      });
    }

    const export_id = await crearSnapshot({
      usuarioId: req.user.id_usuario,
      modulo: MODULO,
      filtros: {
        buscarPor,
        valorBusqueda,
        fechaInicio,
        fechaFin,
        order: order === "ASC" ? "asc" : "desc",
      },
    });

    return res.json({
      message: "Historial obtenido correctamente.",
      export_id,
      total,
      page: safePage,
      limit: safeLimit,
      order: order === "ASC" ? "asc" : "desc",
      data: { detalle, pesaje },
    });
  } catch (err) {
    console.error("Error obtenerHistorial:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ===============================
// Export PDF (inline)
// Route: GET /api/historial-recoleccion/export/pdf?exportId=...
// ===============================
exports.exportarPdf = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const exportId = String(req.query?.exportId || "").trim();
  if (!exportId) {
    return res.status(400).json({ message: "exportId es requerido.", type: "validation" });
  }

  let filtros = null;

  try {
    const snap = await obtenerSnapshotValido({
      exportId,
      usuarioId: req.user.id_usuario,
      modulo: MODULO,
    });

    if (!snap) {
      return res.status(400).json({
        message: "Exportación expirada o inválida. Presione 'Ver' nuevamente.",
        type: "validation",
      });
    }

    filtros = snap.filtros_json || {};
    const order = normOrder(filtros?.order);

    const { total, detalle, pesaje } = await consultarHistorial(
      {
        buscarPor: String(filtros.buscarPor || "").toLowerCase(),
        valorBusqueda: normSearchValue(filtros.valorBusqueda),
        fechaInicio: String(filtros.fechaInicio || ""),
        fechaFin: String(filtros.fechaFin || ""),
        order,
      },
      { paginado: false }
    );

    const pdfBuffer = await buildHistorialRecoleccionPdfBuffer({
      filtros,
      detalle,
      pesaje,
      generadoPor: req.user,
      total,
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
      total_registros: total,
      resumen_json: { filas_detalle: detalle.length, filas_pesaje: pesaje.length },
      estado: "GENERADO",
      error_mensaje: null,
      ip_origen: getIp(req),
      user_agent: req.headers["user-agent"] || null,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="historial_recoleccion.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    console.error("Error exportarPdf:", err);

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
// Export Excel (attachment)
// Route: GET /api/historial-recoleccion/export/excel?exportId=...
// ===============================
exports.exportarExcel = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const exportId = String(req.query?.exportId || "").trim();
  if (!exportId) {
    return res.status(400).json({ message: "exportId es requerido.", type: "validation" });
  }

  let filtros = null;

  try {
    const snap = await obtenerSnapshotValido({
      exportId,
      usuarioId: req.user.id_usuario,
      modulo: MODULO,
    });

    if (!snap) {
      return res.status(400).json({
        message: "Exportación expirada o inválida. Presione 'Ver' nuevamente.",
        type: "validation",
      });
    }

    filtros = snap.filtros_json || {};
    const order = normOrder(filtros?.order);

    const { total, detalle, pesaje } = await consultarHistorial(
      {
        buscarPor: String(filtros.buscarPor || "").toLowerCase(),
        valorBusqueda: normSearchValue(filtros.valorBusqueda),
        fechaInicio: String(filtros.fechaInicio || ""),
        fechaFin: String(filtros.fechaFin || ""),
        order,
      },
      { paginado: false }
    );

    const excelBuffer = await buildHistorialRecoleccionExcelBuffer({
      filtros,
      detalle,
      pesaje,
      generadoPor: req.user,
      total,
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
      total_registros: total,
      resumen_json: { filas_detalle: detalle.length, filas_pesaje: pesaje.length },
      estado: "GENERADO",
      error_mensaje: null,
      ip_origen: getIp(req),
      user_agent: req.headers["user-agent"] || null,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="historial_recoleccion.xlsx"`);

    return res.status(200).send(Buffer.from(excelBuffer));
  } catch (err) {
    console.error("Error exportarExcel:", err);

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
