// backend/src/controllers/historialcosto/HistorialCosto.controller.js
const pool = require("../../config/db");

const {
  crearSnapshot,
  obtenerSnapshotValido,
} = require("../../services/HistorialRecoleccion/ExportSnapshot.service");

const {
  registrarAuditoriaExportacion,
} = require("../../services/HistorialRecoleccion/AuditoriaExportaciones.service");

const {
  buildHistorialCostoPdfBuffer,
} = require("../../exports/pdf/historialCosto.pdf");

const {
  buildHistorialCostoExcelBuffer,
} = require("../../exports/excel/historialCosto.excel");

const MODULO = "HISTORIAL_COSTO";
const REPORTE = "reporte_costos";

const TIMEZONE = "America/Guatemala";
const MS_PER_DAY = 1000 * 60 * 60 * 24;

// ===============================
// Helpers generales
// ===============================
const requireAuth = (req, res) => {
  if (req.user?.id_usuario) return true;

  res.status(401).json({
    message: "Usuario no autenticado.",
  });
  return false;
};

const toInt = (value) => {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const normGroupBy = (value) => {
  const normalized = String(value || "mes").trim().toLowerCase();

  if (normalized === "año") return "anio";
  if (["semana", "mes", "anio"].includes(normalized)) return normalized;

  return "mes";
};

const normOrder = (value) =>
  String(value || "desc").trim().toLowerCase() === "asc" ? "ASC" : "DESC";

const getIp = (req) =>
  (req.headers["x-forwarded-for"]?.split(",")[0] || req.ip || "").trim();

const isValidISODate = (value) => {
  const text = String(value || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;

  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

const parseISODate = (value, endOfDay = false) => {
  if (!isValidISODate(value)) return null;

  const [year, month, day] = String(value).split("-").map(Number);

  return endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
};

const diffDaysInclusive = (startDate, endDate) =>
  Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;

const isMonday = (date) => date.getDay() === 1;
const isSunday = (date) => date.getDay() === 0;
const isFirstDayOfMonth = (date) => date.getDate() === 1;

const isLastDayOfMonth = (date) => {
  const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  return date.getDate() === lastDay;
};

const isFirstDayOfYear = (date) =>
  date.getMonth() === 0 && date.getDate() === 1;

const isLastDayOfYear = (date) =>
  date.getMonth() === 11 && date.getDate() === 31;

const groupLabelExpr = (groupBy) => {
  if (groupBy === "semana") {
    return `to_char(date_trunc('week', r.fecha_recoleccion), '"Semana "IW" - "IYYY')`;
  }

  if (groupBy === "anio") {
    return `to_char(date_trunc('year', r.fecha_recoleccion), 'YYYY')`;
  }

  return `to_char(date_trunc('month', r.fecha_recoleccion), 'YYYY-MM')`;
};

const mapKpis = (row) => ({
  total_q: Number(row?.total_q) || 0,
  total_lbs: Number(row?.total_lbs) || 0,
  q_por_lb: Number(row?.q_por_lb) || 0,
  recolecciones: Number(row?.recolecciones) || 0,
});

// ===============================
// Validación de filtros
// ===============================
const validateDateRangeByGroup = ({ fechaInicio, fechaFin, agruparPor }) => {
  if (!fechaInicio || !fechaFin) {
    return {
      ok: false,
      message: "Debe seleccionar la fecha de inicio y la fecha final.",
      field: "fechas",
    };
  }

  if (!isValidISODate(fechaInicio) || !isValidISODate(fechaFin)) {
    return {
      ok: false,
      message: "Formato de fecha inválido. Use YYYY-MM-DD.",
      field: "fechas",
    };
  }

  const startDate = parseISODate(fechaInicio, false);
  const endDate = parseISODate(fechaFin, true);

  if (!startDate || !endDate) {
    return {
      ok: false,
      message: "No fue posible procesar el rango de fechas ingresado.",
      field: "fechas",
    };
  }

  if (startDate > endDate) {
    return {
      ok: false,
      message: "La fecha de inicio no puede ser mayor que la fecha final.",
      field: "fechas",
    };
  }

  const startBase = parseISODate(fechaInicio, false);
  const endBase = parseISODate(fechaFin, false);
  const totalDays = diffDaysInclusive(startBase, endBase);

  if (agruparPor === "semana") {
    if (!isMonday(startBase) || !isSunday(endBase)) {
      return {
        ok: false,
        message:
          "Para agrupar por semana, la fecha de inicio debe ser lunes y la fecha final debe ser domingo.",
        field: "fechas",
      };
    }

    if (totalDays !== 7) {
      return {
        ok: false,
        message:
          "Para agrupar por semana, debe seleccionar exactamente una semana completa.",
        field: "fechas",
      };
    }
  }

  if (agruparPor === "mes") {
    if (!isFirstDayOfMonth(startBase) || !isLastDayOfMonth(endBase)) {
      return {
        ok: false,
        message:
          "Para agrupar por mes, la fecha de inicio debe ser el primer día del mes y la fecha final el último día del mes.",
        field: "fechas",
      };
    }

    const sameMonth =
      startBase.getFullYear() === endBase.getFullYear() &&
      startBase.getMonth() === endBase.getMonth();

    if (!sameMonth) {
      return {
        ok: false,
        message:
          "Para agrupar por mes, debe seleccionar fechas dentro del mismo mes.",
        field: "fechas",
      };
    }
  }

  if (agruparPor === "anio") {
    if (!isFirstDayOfYear(startBase) || !isLastDayOfYear(endBase)) {
      return {
        ok: false,
        message:
          "Para agrupar por año, la fecha de inicio debe ser 01-01 y la fecha final 12-31.",
        field: "fechas",
      };
    }

    if (startBase.getFullYear() !== endBase.getFullYear()) {
      return {
        ok: false,
        message:
          "Para agrupar por año, debe seleccionar fechas dentro del mismo año.",
        field: "fechas",
      };
    }
  }

  return {
    ok: true,
  };
};


const buildValidatedFilters = ({
  source,
  requireSelections = true,
  includePagination = true,
}) => {
  const fechaInicio = String(source?.fechaInicio || "").trim();
  const fechaFin = String(source?.fechaFin || "").trim();
  const agruparPor = normGroupBy(source?.agruparPor);

  const distritoId = toInt(source?.distritoId);
  const empresaId = toInt(source?.empresaId);
  const contenedorId = toInt(source?.contenedorId);

  const order = normOrder(source?.order);

  if (requireSelections) {
    if (!fechaInicio || !fechaFin || !distritoId || !empresaId || !contenedorId) {
      return {
        ok: false,
        status: 400,
        error: {
          message:
            "Debe completar todos los filtros: fecha inicio, fecha fin, distrito, empresa y contenedor.",
          type: "validation",
        },
      };
    }
  }

  const dateValidation = validateDateRangeByGroup({
    fechaInicio,
    fechaFin,
    agruparPor,
  });

  if (!dateValidation.ok) {
    return {
      ok: false,
      status: 400,
      error: {
        message: dateValidation.message,
        type: "validation",
        field: dateValidation.field,
        agruparPor,
      },
    };
  }

  const filters = {
    fechaInicio,
    fechaFin,
    agruparPor,
    distritoId,
    empresaId,
    contenedorId,
    order,
  };

  if (!includePagination) {
    return {
      ok: true,
      filters,
    };
  }

  const page = clamp(toInt(source?.page) || 1, 1, 1000000);
  const limit = clamp(toInt(source?.limit) || 10, 1, 100);
  const offset = (page - 1) * limit;

  return {
    ok: true,
    filters,
    pagination: {
      page,
      limit,
      offset,
    },
  };
};

// ===============================
// SQL helpers
// ===============================
const buildWhere = ({
  fechaInicio,
  fechaFin,
  distritoId,
  empresaId,
  contenedorId,
}) => {
  let where = `WHERE r.fecha_recoleccion::date BETWEEN $1::date AND $2::date`;
  const params = [fechaInicio, fechaFin];
  let position = 2;

  const addEq = (field, value) => {
    if (value === null || value === undefined) return;

    params.push(value);
    position += 1;
    where += ` AND ${field} = $${position}`;
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

async function fetchFiltrosLabels(
  client,
  { distritoId, empresaId, contenedorId }
) {
  const sql = `
    SELECT
      COALESCE(d.nombre, '') AS distrito_nombre,
      COALESCE(er.nombre, '') AS empresa_nombre,
      COALESCE(c.codigo, '') AS contenedor_codigo
    FROM distritos d
    CROSS JOIN empresas_recolectoras er
    CROSS JOIN contenedores c
    WHERE d.id = $1
      AND er.id = $2
      AND c.id_contenedor = $3
    LIMIT 1
  `;

  const row =
    (
      await client.query(sql, [distritoId, empresaId, contenedorId])
    ).rows?.[0] || {};

  return {
    distritoNombre: row.distrito_nombre || "",
    empresaNombre: row.empresa_nombre || "",
    contenedorCodigo: row.contenedor_codigo || "",
  };
}

async function consultarReporteCosto(
  client,
  filtros,
  { paginado = true, limit = 10, offset = 0 } = {}
) {
  const {
    fechaInicio,
    fechaFin,
    agruparPor,
    distritoId,
    empresaId,
    contenedorId,
    order,
  } = filtros;

  const { where, params } = buildWhere({
    fechaInicio,
    fechaFin,
    distritoId,
    empresaId,
    contenedorId,
  });

  const grpLabel = groupLabelExpr(agruparPor);

  const kpiSql = `
    SELECT
      COALESCE(SUM(h.total_costo_q), 0)::numeric AS total_q,
      COALESCE(SUM(h.total_en_libras), 0)::numeric AS total_lbs,
      CASE
        WHEN COALESCE(SUM(h.total_en_libras), 0) > 0
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
      CASE
        WHEN COALESCE(SUM(h.total_en_libras), 0) > 0
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

  const topContenedoresSql = `
    SELECT
      c.codigo AS contenedor_codigo,
      COALESCE(SUM(h.total_costo_q), 0)::numeric AS total_q
    ${FROM_JOIN}
    ${where}
    GROUP BY c.codigo
    ORDER BY total_q DESC
    LIMIT 5
  `;

  const topContenedores =
    (await client.query(topContenedoresSql, params)).rows || [];

  const detalleBaseSql = `
    SELECT
      to_char(
        r.fecha_recoleccion AT TIME ZONE '${TIMEZONE}',
        'DD/MM/YY HH24:MI'
      ) AS fecha,
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
    ? (
        await client.query(
          `${detalleBaseSql} LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        )
      ).rows || []
    : (await client.query(detalleBaseSql, params)).rows || [];

  const totalDetalleSql = `
    SELECT COUNT(*)::int AS total
    ${FROM_JOIN}
    ${where}
  `;

  const totalDetalle =
    Number((await client.query(totalDetalleSql, params)).rows?.[0]?.total) || 0;

  return {
    kpis,
    resumen,
    topContenedores,
    detalle: {
      total: totalDetalle,
      rows: detalleRows,
    },
  };
}

// ===============================
// GET /api/historial-costo
// ===============================
exports.obtenerReporte = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const validation = buildValidatedFilters({
    source: req.query,
    requireSelections: true,
    includePagination: true,
  });

  if (!validation.ok) {
    return res.status(validation.status).json(validation.error);
  }

  const { filters, pagination } = validation;
  const { page, limit, offset } = pagination;

  const client = await pool.connect();

  try {
    const [labels, result] = await Promise.all([
      fetchFiltrosLabels(client, {
        distritoId: filters.distritoId,
        empresaId: filters.empresaId,
        contenedorId: filters.contenedorId,
      }),
      consultarReporteCosto(client, filters, {
        paginado: true,
        limit,
        offset,
      }),
    ]);

    const filtrosSnapshot = {
      fechaInicio: filters.fechaInicio,
      fechaFin: filters.fechaFin,
      agruparPor: filters.agruparPor,
      distritoId: filters.distritoId,
      distritoNombre: labels.distritoNombre,
      empresaId: filters.empresaId,
      empresaNombre: labels.empresaNombre,
      contenedorId: filters.contenedorId,
      contenedorCodigo: labels.contenedorCodigo,
      order: filters.order === "ASC" ? "asc" : "desc",
    };

    const export_id = await crearSnapshot({
      usuarioId: req.user.id_usuario,
      modulo: MODULO,
      filtros: filtrosSnapshot,
    });

    return res.json({
      message: "Reporte de costos obtenido correctamente.",
      export_id,
      filtros: filtrosSnapshot,
      kpis: result.kpis,
      resumen: result.resumen,
      topContenedores: result.topContenedores,
      detalle: {
        total: result.detalle.total,
        page,
        limit,
        rows: result.detalle.rows,
      },
    });
  } catch (error) {
    console.error("Error obtenerReporte (HistorialCosto):", error);

    return res.status(500).json({
      message: "Error interno del servidor.",
    });
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

  if (!exportId) {
    return res.status(400).json({
      message: "exportId es requerido.",
      type: "validation",
    });
  }

  let filtros = null;

  try {
    const snapshot = await obtenerSnapshotValido({
      exportId,
      usuarioId: req.user.id_usuario,
      modulo: MODULO,
    });

    if (!snapshot) {
      return res.status(400).json({
        message: "Exportación expirada o inválida. Presione 'Ver' nuevamente.",
        type: "validation",
      });
    }

    filtros = snapshot.filtros_json || {};

    const validation = buildValidatedFilters({
      source: filtros,
      requireSelections: true,
      includePagination: false,
    });

    if (!validation.ok) {
      return res.status(validation.status).json(validation.error);
    }

    const client = await pool.connect();

    const data = await (async () => {
      try {
        return await consultarReporteCosto(client, validation.filters, {
          paginado: false,
        });
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
      resumen_json: {
        filas_resumen: data.resumen.length,
        filas_detalle: data.detalle.rows.length,
        top_contenedores: data.topContenedores.length,
      },
      estado: "GENERADO",
      error_mensaje: null,
      ip_origen: getIp(req),
      user_agent: req.headers["user-agent"] || null,
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      'inline; filename="reporte_costos.pdf"'
    );

    return res.status(200).send(pdfBuffer);
  } catch (error) {
    console.error("Error exportarPdf (HistorialCosto):", error);

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

    return res.status(500).json({
      message: "Error interno del servidor.",
    });
  }
};

// ===============================
// GET /api/historial-costo/export/excel?exportId=...
// ===============================
exports.exportarExcel = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const exportId = String(req.query?.exportId || "").trim();

  if (!exportId) {
    return res.status(400).json({
      message: "exportId es requerido.",
      type: "validation",
    });
  }

  let filtros = null;

  try {
    const snapshot = await obtenerSnapshotValido({
      exportId,
      usuarioId: req.user.id_usuario,
      modulo: MODULO,
    });

    if (!snapshot) {
      return res.status(400).json({
        message: "Exportación expirada o inválida. Presione 'Ver' nuevamente.",
        type: "validation",
      });
    }

    filtros = snapshot.filtros_json || {};

    const validation = buildValidatedFilters({
      source: filtros,
      requireSelections: true,
      includePagination: false,
    });

    if (!validation.ok) {
      return res.status(validation.status).json(validation.error);
    }

    const client = await pool.connect();

    const data = await (async () => {
      try {
        return await consultarReporteCosto(client, validation.filters, {
          paginado: false,
        });
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
      resumen_json: {
        filas_resumen: data.resumen.length,
        filas_detalle: data.detalle.rows.length,
        top_contenedores: data.topContenedores.length,
      },
      estado: "GENERADO",
      error_mensaje: null,
      ip_origen: getIp(req),
      user_agent: req.headers["user-agent"] || null,
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="reporte_costos.xlsx"'
    );

    return res.status(200).send(Buffer.from(excelBuffer));
  } catch (error) {
    console.error("Error exportarExcel (HistorialCosto):", error);

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

    return res.status(500).json({
      message: "Error interno del servidor.",
    });
  }
};