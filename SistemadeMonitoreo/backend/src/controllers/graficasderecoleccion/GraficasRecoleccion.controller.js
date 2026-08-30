// backend/src/controllers/graficasderecoleccion/GraficasRecoleccion.controller.js

const {
  crearSnapshot,
  obtenerSnapshotValido,
} = require(
  "../../services/HistorialRecoleccion/ExportSnapshot.service"
);

const {
  registrarAuditoriaExportacion,
} = require(
  "../../services/HistorialRecoleccion/AuditoriaExportaciones.service"
);

const {
  buildValidatedFilters,
} = require(
  "../../validators/graficasderecoleccion/GraficasRecoleccion.validator"
);

const {
  obtenerGraficasRecoleccionCuatrimestral,
} = require(
  "../../services/graficasderecoleccion/GraficasRecoleccion.service"
);

const {
  buildGraficasRecoleccionCuatrimestralPdfBuffer,
} = require(
  "../../exports/pdf/graficasRecoleccionCuatrimestral.pdf"
);

const {
  buildGraficasRecoleccionCuatrimestralExcelBuffer,
} = require(
  "../../exports/excel/graficasRecoleccionCuatrimestral.excel"
);


/* =========================================================
   CONSTANTES
   ========================================================= */

const MODULO =
  "GRAFICAS_RECOLECCION";

const REPORTE =
  "reporte_recoleccion_cuatrimestral";


/* =========================================================
   AUTENTICACIÓN DEFENSIVA
   ========================================================= */

function requireAuth(
  req,
  res
) {
  if (
    req.user?.id_usuario
  ) {
    return true;
  }


  res
    .status(401)
    .json({
      success:
        false,

      message:
        "Usuario no autenticado.",
    });


  return false;
}


/* =========================================================
   IP DE ORIGEN
   ========================================================= */

function getIp(
  req
) {
  return (
    req.headers[
      "x-forwarded-for"
    ]
      ?.split(",")[0] ||
    req.ip ||
    ""
  ).trim();
}


/* =========================================================
   RESPONDER ERRORES CONTROLADOS
   ========================================================= */

function responderError(
  res,
  error,
  mensajeInterno =
    "Error interno del servidor."
) {
  const statusCode =
    (
      Number.isSafeInteger(
        error?.statusCode
      ) &&
      error.statusCode >= 400 &&
      error.statusCode <= 599
    )
      ? error.statusCode
      : 500;


  if (
    statusCode !== 500
  ) {
    return res
      .status(
        statusCode
      )
      .json({
        success:
          false,

        message:
          error?.message ||
          "No fue posible procesar la solicitud.",

        type:
          error?.type ||
          "validation",

        ...(
          error?.code
            ? {
                code:
                  error.code,
              }
            : {}
        ),

        ...(
          error?.field
            ? {
                field:
                  error.field,
              }
            : {}
        ),
      });
  }


  /*
    No exponemos errores internos al frontend.
  */

  return res
    .status(500)
    .json({
      success:
        false,

      message:
        mensajeInterno,
    });
}


/* =========================================================
   CONVERTIR VALIDACIÓN EN ERROR
   ========================================================= */

function crearErrorDesdeValidacion(
  validation
) {
  const error =
    new Error(
      validation
        ?.error
        ?.message ||
      "Los filtros de la exportación no son válidos."
    );


  error.statusCode =
    validation?.status ||
    400;


  error.type =
    validation
      ?.error
      ?.type ||
    "validation";


  if (
    validation
      ?.error
      ?.code
  ) {
    error.code =
      validation.error.code;
  }


  if (
    validation
      ?.error
      ?.field
  ) {
    error.field =
      validation.error.field;
  }


  return error;
}


/* =========================================================
   RESUMEN PARA AUDITORÍA
   ========================================================= */

function construirResumenAuditoria(
  resultado
) {
  const meses =
    Array.isArray(
      resultado?.data
    )
      ? resultado.data
      : [];


  const totalGeneralLibras =
    meses.reduce(
      (
        acumulado,
        mes
      ) => {

        const total =
          Number(
            mes
              ?.totales
              ?.general ||
            0
          );


        return (
          acumulado +
          (
            Number.isFinite(
              total
            )
              ? total
              : 0
          )
        );
      },
      0
    );


  return {
    anio:
      resultado
        ?.filtros
        ?.anio ||
      null,

    cuatrimestre:
      resultado
        ?.filtros
        ?.cuatrimestre ||
      null,

    meses:
      Array.isArray(
        resultado
          ?.filtros
          ?.meses
      )
        ? resultado.filtros.meses
        : [],

    meses_reportados:
      meses.length,

    total_general_libras:
      Number(
        totalGeneralLibras.toFixed(
          2
        )
      ),
  };
}


/* =========================================================
   AUDITORÍA FALLIDA
   ========================================================= */

async function registrarAuditoriaFallida({
  req,
  formato,
  exportId,
  filtros,
  error,
}) {
  /*
    Auditoría requiere un UUID válido.

    No generamos valores falsos como "N/A".
  */

  if (
    !exportId
  ) {
    return;
  }


  try {
    await registrarAuditoriaExportacion({
      usuario_id:
        req.user?.id_usuario ||
        0,

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
        getIp(
          req
        ),

      user_agent:
        req.headers[
          "user-agent"
        ] || null,
    });

  } catch (
    auditError
  ) {
    console.error(
      `Error registrando auditoría fallida (${formato}):`,
      auditError
    );
  }
}


/* =========================================================
   CONSULTAR GRÁFICAS CUATRIMESTRALES

   GET /api/graficas-recoleccion/cuatrimestral
   ========================================================= */

exports.getGraficasRecoleccionCuatrimestral =
  async function getGraficasRecoleccionCuatrimestral(
    req,
    res
  ) {

    /* =====================================================
       1. AUTENTICACIÓN
       ===================================================== */

    if (
      !requireAuth(
        req,
        res
      )
    ) {
      return;
    }


    /* =====================================================
       2. VALIDAR FILTROS

       req.query NO es fuente de verdad.
       ===================================================== */

    const validation =
      buildValidatedFilters({
        source:
          req.query,
      });


    if (
      !validation.ok
    ) {
      return res
        .status(
          validation.status
        )
        .json({
          success:
            false,

          ...validation.error,
        });
    }


    /*
      Desde este punto utilizamos exclusivamente los valores
      normalizados por backend.
    */

    const {
      anio,
      cuatrimestre,
    } =
      validation.filters;


    try {

      /* ===================================================
         3. CONSULTAR SERVICE

         PostgreSQL es la fuente de los datos.

         El Service construye:
         - meses
         - categorías
         - series
         - totales
         - promedios
         =================================================== */

      const resultado =
        await obtenerGraficasRecoleccionCuatrimestral({
          anio,
          cuatrimestre,
        });


      /* ===================================================
         4. NO EXISTEN DATOS

         IMPORTANTE:

         - no creamos snapshot
         - no habilitamos PDF
         - no habilitamos Excel
         - no enviamos gráficas vacías
         =================================================== */

      if (
        !resultado.hayDatos
      ) {
        return res
          .status(200)
          .json({
            success:
              true,

            message:
              "No se encontraron registros de recolección para el año y cuatrimestre seleccionados.",

            hay_datos:
              false,

            export_id:
              null,

            export_expires_at:
              null,

            export_expires_in_seconds:
              null,

            filtros: {
              anio:
                resultado
                  .filtros
                  .anio,

              cuatrimestre:
                resultado
                  .filtros
                  .cuatrimestre,

              meses:
                resultado
                  .filtros
                  .meses,
            },

            data:
              [],
          });
      }


      /* ===================================================
         5. SNAPSHOT

         Solo se crea cuando existen datos reales.

         Guardamos únicamente criterios normalizados.
         =================================================== */

      const filtrosSnapshot = {
        anio:
          resultado
            .filtros
            .anio,

        cuatrimestre:
          resultado
            .filtros
            .cuatrimestre,
      };


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
         6. RESPUESTA CON DATOS
         =================================================== */

      return res
        .status(200)
        .json({
          success:
            true,

          message:
            "Gráficas de recolección obtenidas correctamente.",

          hay_datos:
            true,

          export_id:
            snapshot.exportId,

          export_expires_at:
            snapshot.expiresAt,

          export_expires_in_seconds:
            snapshot.expiresInSeconds,

          filtros: {
            anio:
              resultado
                .filtros
                .anio,

            cuatrimestre:
              resultado
                .filtros
                .cuatrimestre,

            meses:
              resultado
                .filtros
                .meses,
          },

          data:
            resultado.data,
        });

    } catch (
      error
    ) {
      console.error(
        "Error getGraficasRecoleccionCuatrimestral:",
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

   Frontend envía solamente:

   exportId

   Backend:
   exportId
      ↓
   snapshot
      ↓
   usuario
      ↓
   módulo
      ↓
   filtros almacenados
      ↓
   Validator
      ↓
   PostgreSQL
      ↓
   Service
      ↓
   información reconstruida
   ========================================================= */

async function obtenerDatosExportacion({
  exportId,
  usuarioId,
}) {

  /* =======================================================
     1. RECUPERAR SNAPSHOT
     ======================================================= */

  const snapshot =
    await obtenerSnapshotValido({
      exportId,

      usuarioId,

      modulo:
        MODULO,
    });


  /* =======================================================
     2. SNAPSHOT INVÁLIDO
     ======================================================= */

  if (
    !snapshot
  ) {
    const error =
      new Error(
        "La exportación no está disponible. Presione 'Filtrar' nuevamente para habilitar PDF y Excel."
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
     3. RECUPERAR FILTROS DEL SNAPSHOT
     ======================================================= */

  const filtrosSnapshot =
    snapshot.filtros_json ||
    {};


  /* =======================================================
     4. VALIDAR NUEVAMENTE LOS FILTROS
     ======================================================= */

  const validation =
    buildValidatedFilters({
      source:
        filtrosSnapshot,
    });


  if (
    !validation.ok
  ) {
    throw crearErrorDesdeValidacion(
      validation
    );
  }


  /* =======================================================
     5. VOLVER A CONSULTAR POSTGRESQL

     No usamos datos guardados en React.
     No usamos series enviadas por el navegador.
     ======================================================= */

  const resultado =
    await obtenerGraficasRecoleccionCuatrimestral({
      anio:
        validation
          .filters
          .anio,

      cuatrimestre:
        validation
          .filters
          .cuatrimestre,
    });


  /* =======================================================
     6. LOS DATOS YA NO EXISTEN

     El snapshot puede seguir vigente, pero PostgreSQL sigue
     siendo la fuente de verdad.

     Si los datos desaparecieron después de crear el
     snapshot, no generamos un archivo vacío.
     ======================================================= */

  if (
    !resultado.hayDatos
  ) {
    const error =
      new Error(
        "Ya no existen registros para generar esta exportación. Presione 'Filtrar' nuevamente."
      );


    error.statusCode =
      409;

    error.type =
      "validation";

    error.code =
      "EXPORT_DATA_NOT_FOUND";


    throw error;
  }


  /* =======================================================
     7. FILTROS AUTORITATIVOS
     ======================================================= */

  const filtros = {
    anio:
      resultado
        .filtros
        .anio,

    cuatrimestre:
      resultado
        .filtros
        .cuatrimestre,

    meses:
      resultado
        .filtros
        .meses,
  };


  return {
    filtros,
    resultado,
  };
}


/* =========================================================
   EXPORTAR PDF

   GET
   /api/graficas-recoleccion/cuatrimestral/export/pdf
   ========================================================= */

exports.exportarPdf =
  async function exportarPdf(
    req,
    res
  ) {

    /* =====================================================
       1. AUTENTICACIÓN
       ===================================================== */

    if (
      !requireAuth(
        req,
        res
      )
    ) {
      return;
    }


    /* =====================================================
       2. EXPORT ID

       Es el único dato que recibe la exportación.
       ===================================================== */

    const exportId =
      String(
        req.query
          ?.exportId ||
        ""
      ).trim();


    if (
      !exportId
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

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
         3. RECONSTRUIR DATOS DESDE BACKEND
         =================================================== */

      const {
        filtros:
          filtrosExportacion,

        resultado,
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
        await buildGraficasRecoleccionCuatrimestralPdfBuffer({
          filtros,

          generadoPor:
            req.user,

          data:
            resultado.data,
        });


      /* ===================================================
         5. AUDITORÍA EXITOSA
         =================================================== */

      await registrarAuditoriaExportacion({
        usuario_id:
          req.user.id_usuario,

        usuario:
          req.user.usuario ||
          "N/A",

        rol:
          req.user.rol ||
          "N/A",

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
          resultado.data.length,

        resumen_json:
          construirResumenAuditoria(
            resultado
          ),

        estado:
          "GENERADO",

        error_mensaje:
          null,

        ip_origen:
          getIp(
            req
          ),

        user_agent:
          req.headers[
            "user-agent"
          ] || null,
      });


      /* ===================================================
         6. RESPONDER PDF
         =================================================== */

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );


      res.setHeader(
        "Content-Disposition",
        'inline; filename="recoleccion_cuatrimestral.pdf"'
      );


      return res
        .status(200)
        .send(
          pdfBuffer
        );

    } catch (
      error
    ) {
      console.error(
        "Error exportarPdf (GraficasRecoleccion):",
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
   EXPORTAR EXCEL

   GET
   /api/graficas-recoleccion/cuatrimestral/export/excel
   ========================================================= */

exports.exportarExcel =
  async function exportarExcel(
    req,
    res
  ) {

    /* =====================================================
       1. AUTENTICACIÓN
       ===================================================== */

    if (
      !requireAuth(
        req,
        res
      )
    ) {
      return;
    }


    /* =====================================================
       2. EXPORT ID
       ===================================================== */

    const exportId =
      String(
        req.query
          ?.exportId ||
        ""
      ).trim();


    if (
      !exportId
    ) {
      return res
        .status(400)
        .json({
          success:
            false,

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
         3. RECONSTRUIR DATOS DESDE BACKEND
         =================================================== */

      const {
        filtros:
          filtrosExportacion,

        resultado,
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
        await buildGraficasRecoleccionCuatrimestralExcelBuffer({
          filtros,

          generadoPor:
            req.user,

          data:
            resultado.data,
        });


      /* ===================================================
         5. AUDITORÍA EXITOSA
         =================================================== */

      await registrarAuditoriaExportacion({
        usuario_id:
          req.user.id_usuario,

        usuario:
          req.user.usuario ||
          "N/A",

        rol:
          req.user.rol ||
          "N/A",

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
          resultado.data.length,

        resumen_json:
          construirResumenAuditoria(
            resultado
          ),

        estado:
          "GENERADO",

        error_mensaje:
          null,

        ip_origen:
          getIp(
            req
          ),

        user_agent:
          req.headers[
            "user-agent"
          ] || null,
      });


      /* ===================================================
         6. RESPONDER EXCEL
         =================================================== */

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );


      res.setHeader(
        "Content-Disposition",
        'attachment; filename="recoleccion_cuatrimestral.xlsx"'
      );


      return res
        .status(200)
        .send(
          Buffer.from(
            excelBuffer
          )
        );

    } catch (
      error
    ) {
      console.error(
        "Error exportarExcel (GraficasRecoleccion):",
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