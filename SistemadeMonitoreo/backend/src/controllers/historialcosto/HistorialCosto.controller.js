// backend/src/controllers/historialcosto/HistorialCosto.controller.js

const {
  crearSnapshot,
  obtenerSnapshotValido,
} = require("../../services/HistorialRecoleccion/ExportSnapshot.service");

const {
  registrarAuditoriaExportacion,
} = require("../../services/HistorialRecoleccion/AuditoriaExportaciones.service");

const {
  obtenerReporteCosto,
  obtenerReporteCostoExportacion,
} = require("../../services/historialcosto/HistorialCosto.service");

const {
  buildValidatedFilters,
} = require("../../validators/historialcosto/HistorialCosto.validator");

const {
  buildHistorialCostoPdfBuffer,
} = require("../../exports/pdf/historialCosto.pdf");

const {
  buildHistorialCostoExcelBuffer,
} = require("../../exports/excel/historialCosto.excel");


/* =========================================================
   CONSTANTES
   ========================================================= */

const MODULO = "HISTORIAL_COSTO";
const REPORTE = "reporte_costos";


/* =========================================================
   AUTENTICACIÓN

   Se conserva temporalmente como protección adicional.
   Las rutas ya utilizan authMiddleware.
   ========================================================= */

function requireAuth(req, res) {
  if (req.user?.id_usuario) {
    return true;
  }

  res.status(401).json({
    message: "Usuario no autenticado.",
  });

  return false;
}


/* =========================================================
   IP DE ORIGEN
   ========================================================= */

function getIp(req) {
  return (
    req.headers["x-forwarded-for"]?.split(",")[0] ||
    req.ip ||
    ""
  ).trim();
}


/* =========================================================
   RESPONDER ERROR

   Conserva errores controlados provenientes del Validator
   y de los Services, incluyendo 400 y 410.
   ========================================================= */

function responderError(
  res,
  error,
  mensajeInterno = "Error interno del servidor."
) {
  const statusCode =
    Number.isSafeInteger(error?.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
      ? error.statusCode
      : 500;

  if (statusCode !== 500) {
    return res.status(statusCode).json({
      message:
        error?.message ||
        "No fue posible procesar la solicitud.",

      type:
        error?.type ||
        "validation",

      ...(error?.code
        ? {
            code: error.code,
          }
        : {}),

      ...(error?.field
        ? {
            field: error.field,
          }
        : {}),
    });
  }

  return res.status(500).json({
    message: mensajeInterno,
  });
}


/* =========================================================
   CONVERTIR RESULTADO DEL VALIDATOR EN ERROR
   ========================================================= */

function crearErrorDesdeValidacion(validation) {
  const error = new Error(
    validation?.error?.message ||
      "Los filtros de la solicitud son inválidos."
  );

  error.statusCode =
    validation?.status || 400;

  error.type =
    validation?.error?.type ||
    "validation";

  if (validation?.error?.code) {
    error.code =
      validation.error.code;
  }

  if (validation?.error?.field) {
    error.field =
      validation.error.field;
  }

  return error;
}


/* =========================================================
   AUDITORÍA FALLIDA

   No usamos "N/A" como export_id porque el Service de
   Auditoría exige un UUID válido.
   ========================================================= */

async function registrarAuditoriaFallida({
  req,
  formato,
  exportId,
  filtros,
  error,
}) {
  if (!exportId) {
    return;
  }

  try {
    await registrarAuditoriaExportacion({
      usuario_id:
        req.user?.id_usuario || 0,

      usuario:
        req.user?.usuario ||
        "N/A",

      rol:
        req.user?.rol ||
        "N/A",

      modulo:
        MODULO,

      reporte:
        REPORTE,

      formato,

      export_id:
        exportId,

      filtros_json:
        filtros || {
          exportId,
        },

      total_registros:
        0,

      resumen_json:
        null,

      estado:
        "FALLIDO",

      error_mensaje:
        error?.message ||
        `Error al generar ${formato}`,

      ip_origen:
        getIp(req),

      user_agent:
        req.headers["user-agent"] ||
        null,
    });
  } catch (auditError) {
    console.error(
      `Error registrando auditoría fallida (${formato}):`,
      auditError
    );
  }
}


/* =========================================================
   GET /api/historial-costo
   ========================================================= */

exports.obtenerReporte =
  async function obtenerReporte(
    req,
    res
  ) {
    /* =====================================================
       1. AUTENTICACIÓN
       ===================================================== */

    if (!requireAuth(req, res)) {
      return;
    }


    /* =====================================================
       2. VALIDAR FILTROS
       ===================================================== */

    const validation =
      buildValidatedFilters({
        source:
          req.query,

        requireSelections:
          true,

        includePagination:
          true,
      });


    if (!validation.ok) {
      return res
        .status(
          validation.status
        )
        .json(
          validation.error
        );
    }


    const {
      filters,
      pagination,
    } = validation;


    const {
      page,
      limit,
      offset,
    } = pagination;


    try {
      /* ===================================================
         3. CONSULTAR SERVICE
         =================================================== */

      const {
        labels,
        result,
      } =
        await obtenerReporteCosto({
          filtros:
            filters,

          limit,

          offset,
        });


      /* ===================================================
         4. SNAPSHOT DE FILTROS
         =================================================== */

      const filtrosSnapshot = {
        fechaInicio:
          filters.fechaInicio,

        fechaFin:
          filters.fechaFin,

        agruparPor:
          filters.agruparPor,

        distritoId:
          filters.distritoId,

        distritoNombre:
          labels.distritoNombre,

        empresaId:
          filters.empresaId,

        empresaNombre:
          labels.empresaNombre,

        contenedorId:
          filters.contenedorId,

        contenedorCodigo:
          labels.contenedorCodigo,

        order:
          filters.order === "ASC"
            ? "asc"
            : "desc",
      };


      /* ===================================================
         5. CREAR SNAPSHOT
         =================================================== */

      const snapshot =
        await crearSnapshot({
          usuarioId:
            req.user.id_usuario,

          modulo:
            MODULO,

          filtros:
            filtrosSnapshot,
        });


      /* ===================================================
         6. RESPUESTA
         =================================================== */

      return res.json({
        message:
          "Reporte de costos obtenido correctamente.",

        export_id:
          snapshot.exportId,

        export_expires_at:
          snapshot.expiresAt,

        export_expires_in_seconds:
          snapshot.expiresInSeconds,

        filtros:
          filtrosSnapshot,

        kpis:
          result.kpis,

        resumen:
          result.resumen,

        topContenedores:
          result.topContenedores,

        detalle: {
          total:
            result.detalle.total,

          page,

          limit,

          rows:
            result.detalle.rows,
        },
      });
    } catch (error) {
      console.error(
        "Error obtenerReporte (HistorialCosto):",
        error
      );

      return responderError(
        res,
        error
      );
    }
  };


/* =========================================================
   OBTENER DATOS PARA EXPORTACIÓN
   ========================================================= */

async function obtenerDatosExportacion({
  exportId,
  usuarioId,
}) {
  /* =======================================================
     1. OBTENER SNAPSHOT
     ======================================================= */

  const snapshot =
    await obtenerSnapshotValido({
      exportId,

      usuarioId,

      modulo:
        MODULO,
    });


  /* =======================================================
     2. SNAPSHOT NO EXISTENTE / NO PERTENECE
     ======================================================= */

  if (!snapshot) {
    const error =
      new Error(
        "Exportación inválida. Presione 'Ver' nuevamente para habilitar PDF y Excel."
      );

    error.statusCode =
      400;

    error.type =
      "validation";

    error.code =
      "EXPORT_SNAPSHOT_INVALIDO";

    throw error;
  }


  /* =======================================================
     3. RECUPERAR FILTROS
     ======================================================= */

  const filtros =
    snapshot.filtros_json ||
    {};


  /* =======================================================
     4. VOLVER A VALIDAR FILTROS
     ======================================================= */

  const validation =
    buildValidatedFilters({
      source:
        filtros,

      requireSelections:
        true,

      includePagination:
        false,
    });


  if (!validation.ok) {
    throw crearErrorDesdeValidacion(
      validation
    );
  }


  /* =======================================================
     5. CONSULTAR REPORTE SIN PAGINACIÓN
     ======================================================= */

  const data =
    await obtenerReporteCostoExportacion(
      validation.filters
    );


  return {
    filtros,
    data,
  };
}


/* =========================================================
   GET /api/historial-costo/export/pdf
   ========================================================= */

exports.exportarPdf =
  async function exportarPdf(
    req,
    res
  ) {
    /* =====================================================
       1. AUTENTICACIÓN
       ===================================================== */

    if (!requireAuth(req, res)) {
      return;
    }


    /* =====================================================
       2. EXPORT ID
       ===================================================== */

    const exportId =
      String(
        req.query?.exportId ||
        ""
      ).trim();


    if (!exportId) {
      return res
        .status(400)
        .json({
          message:
            "exportId es requerido.",

          type:
            "validation",

          code:
            "EXPORT_ID_REQUIRED",
        });
    }


    let filtros =
      null;


    try {
      /* ===================================================
         3. OBTENER DATOS
         =================================================== */

      const {
        filtros:
          filtrosExportacion,

        data,
      } =
        await obtenerDatosExportacion({
          exportId,

          usuarioId:
            req.user.id_usuario,
        });


      filtros =
        filtrosExportacion;


      /* ===================================================
         4. GENERAR PDF
         =================================================== */

      const pdfBuffer =
        await buildHistorialCostoPdfBuffer({
          filtros,

          generadoPor:
            req.user,

          kpis:
            data.kpis,

          resumen:
            data.resumen,

          topContenedores:
            data.topContenedores,

          detalle:
            data.detalle.rows,
        });


      /* ===================================================
         5. AUDITORÍA
         =================================================== */

      await registrarAuditoriaExportacion({
        usuario_id:
          req.user.id_usuario,

        usuario:
          req.user.usuario,

        rol:
          req.user.rol,

        modulo:
          MODULO,

        reporte:
          REPORTE,

        formato:
          "PDF",

        export_id:
          exportId,

        filtros_json:
          filtros,

        total_registros:
          data.detalle.total,

        resumen_json: {
          filas_resumen:
            data.resumen.length,

          filas_detalle:
            data.detalle.rows.length,

          top_contenedores:
            data.topContenedores.length,
        },

        estado:
          "GENERADO",

        error_mensaje:
          null,

        ip_origen:
          getIp(req),

        user_agent:
          req.headers["user-agent"] ||
          null,
      });


      /* ===================================================
         6. RESPUESTA PDF
         =================================================== */

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );


      res.setHeader(
        "Content-Disposition",
        'inline; filename="reporte_costos.pdf"'
      );


      return res
        .status(200)
        .send(
          pdfBuffer
        );
    } catch (error) {
      console.error(
        "Error exportarPdf (HistorialCosto):",
        error
      );


      await registrarAuditoriaFallida({
        req,

        formato:
          "PDF",

        exportId,

        filtros,

        error,
      });


      return responderError(
        res,
        error
      );
    }
  };


/* =========================================================
   GET /api/historial-costo/export/excel
   ========================================================= */

exports.exportarExcel =
  async function exportarExcel(
    req,
    res
  ) {
    /* =====================================================
       1. AUTENTICACIÓN
       ===================================================== */

    if (!requireAuth(req, res)) {
      return;
    }


    /* =====================================================
       2. EXPORT ID
       ===================================================== */

    const exportId =
      String(
        req.query?.exportId ||
        ""
      ).trim();


    if (!exportId) {
      return res
        .status(400)
        .json({
          message:
            "exportId es requerido.",

          type:
            "validation",

          code:
            "EXPORT_ID_REQUIRED",
        });
    }


    let filtros =
      null;


    try {
      /* ===================================================
         3. OBTENER DATOS
         =================================================== */

      const {
        filtros:
          filtrosExportacion,

        data,
      } =
        await obtenerDatosExportacion({
          exportId,

          usuarioId:
            req.user.id_usuario,
        });


      filtros =
        filtrosExportacion;


      /* ===================================================
         4. GENERAR EXCEL
         =================================================== */

      const excelBuffer =
        await buildHistorialCostoExcelBuffer({
          filtros,

          generadoPor:
            req.user,

          kpis:
            data.kpis,

          resumen:
            data.resumen,

          topContenedores:
            data.topContenedores,

          detalle:
            data.detalle.rows,

          total:
            data.detalle.total,
        });


      /* ===================================================
         5. AUDITORÍA
         =================================================== */

      await registrarAuditoriaExportacion({
        usuario_id:
          req.user.id_usuario,

        usuario:
          req.user.usuario,

        rol:
          req.user.rol,

        modulo:
          MODULO,

        reporte:
          REPORTE,

        formato:
          "EXCEL",

        export_id:
          exportId,

        filtros_json:
          filtros,

        total_registros:
          data.detalle.total,

        resumen_json: {
          filas_resumen:
            data.resumen.length,

          filas_detalle:
            data.detalle.rows.length,

          top_contenedores:
            data.topContenedores.length,
        },

        estado:
          "GENERADO",

        error_mensaje:
          null,

        ip_origen:
          getIp(req),

        user_agent:
          req.headers["user-agent"] ||
          null,
      });


      /* ===================================================
         6. RESPUESTA EXCEL
         =================================================== */

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );


      res.setHeader(
        "Content-Disposition",
        'attachment; filename="reporte_costos.xlsx"'
      );


      return res
        .status(200)
        .send(
          Buffer.from(
            excelBuffer
          )
        );
    } catch (error) {
      console.error(
        "Error exportarExcel (HistorialCosto):",
        error
      );


      await registrarAuditoriaFallida({
        req,

        formato:
          "EXCEL",

        exportId,

        filtros,

        error,
      });


      return responderError(
        res,
        error
      );
    }
  };