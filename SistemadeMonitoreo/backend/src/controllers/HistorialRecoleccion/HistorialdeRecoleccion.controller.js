const {
  consultarHistorial,
} = require(
  "../../services/HistorialRecoleccion/HistorialRecoleccion.service"
);

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
  buildHistorialRecoleccionPdfBuffer,
} = require(
  "../../exports/pdf/historialRecoleccion.pdf"
);

const {
  buildHistorialRecoleccionExcelBuffer,
} = require(
  "../../exports/excel/historialRecoleccion.excel"
);


/* =========================================================
   CONSTANTES DEL MÓDULO
   ========================================================= */

const MODULO =
  "HISTORIAL_RECOLECCION";

const REPORTE =
  "consulta_resultados";


/*
  El tamaño de página pertenece al backend.

  El frontend no puede modificarlo enviando limit.
*/

const PAGE_SIZE = 10;


/* =========================================================
   UUID
   ========================================================= */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


/* =========================================================
   USUARIO AUTENTICADO
   ========================================================= */

function obtenerUsuarioAutenticado(
  req
) {
  const idUsuario =
    Number(
      req.user?.id_usuario
    );


  if (
    !Number.isSafeInteger(
      idUsuario
    ) ||
    idUsuario <= 0
  ) {
    return null;
  }


  return {
    ...req.user,

    id_usuario:
      idUsuario,
  };
}


/* =========================================================
   PÁGINA

   La página viene de HTTP.

   Si no viene:
   página 1.

   Si viene manipulada:
   error 400.
   ========================================================= */

function normalizarPagina(
  valor
) {
  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ""
  ) {
    return 1;
  }


  const page =
    Number(valor);


  if (
    !Number.isSafeInteger(
      page
    ) ||
    page < 1
  ) {
    const error =
      new Error(
        "La página solicitada es inválida."
      );

    error.statusCode = 400;
    error.type = "validation";
    error.code =
      "INVALID_PAGE";

    throw error;
  }


  return page;
}


/* =========================================================
   PREPARAR EXPORTACIÓN

   IMPORTANTE:

   true:
   el usuario presionó "Ver"
   → se crea un nuevo snapshot.

   false:
   el usuario cambió de página
   → NO se crea ni renueva snapshot.

   El frontend solo comunica la intención.
   Backend sigue generando el exportId y su TTL.
   ========================================================= */

function normalizarPrepararExportacion(
  valor
) {
  return (
    String(valor ?? "")
      .trim()
      .toLowerCase() === "true"
  );
}


/* =========================================================
   FILTROS DE ENTRADA

   Controller únicamente transporta.

   HistorialRecoleccion.service.js valida:
   - buscarPor
   - valorBusqueda
   - fechas
   - orden
   ========================================================= */

function obtenerFiltrosEntrada(
  req
) {
  return {
    buscarPor:
      req.query?.buscarPor,

    valorBusqueda:
      req.query?.valorBusqueda,

    fechaInicio:
      req.query?.fechaInicio,

    fechaFin:
      req.query?.fechaFin,

    order:
      req.query?.order,
  };
}


/* =========================================================
   EXPORT ID
   ========================================================= */

function normalizarExportId(
  valor
) {
  const exportId =
    String(valor || "")
      .trim()
      .toLowerCase();


  if (
    !UUID_REGEX.test(
      exportId
    )
  ) {
    return null;
  }


  return exportId;
}


/* =========================================================
   IP
   ========================================================= */

function obtenerIp(req) {
  const ip =
    String(
      req.ip || ""
    ).trim();


  return ip || null;
}


/* =========================================================
   USER AGENT
   ========================================================= */

function obtenerUserAgent(
  req
) {
  const userAgent =
    String(
      req.get?.(
        "user-agent"
      ) ||
      req.headers
        ?.["user-agent"] ||
      ""
    ).trim();


  if (!userAgent) {
    return null;
  }


  return userAgent.slice(
    0,
    500
  );
}


/* =========================================================
   ERROR CONTROLADO

   Ya no limitamos únicamente a status 400.

   Ahora pueden llegar, por ejemplo:

   400 SEARCH_TYPE_MISMATCH
   410 EXPORT_SNAPSHOT_EXPIRADO
   ========================================================= */

function esErrorControlado(
  err
) {
  const statusCode =
    Number(
      err?.statusCode
    );


  return (
    err?.type ===
      "validation" &&
    Number.isInteger(
      statusCode
    ) &&
    statusCode >= 400 &&
    statusCode < 500
  );
}


/* =========================================================
   RESPUESTA DE ERROR

   Conservamos:
   - message
   - type
   - code

   El frontend puede decidir cómo presentar cada caso.
   ========================================================= */

function responderError(
  res,
  err,
  contexto
) {
  if (
    esErrorControlado(
      err
    )
  ) {
    const statusCode =
      Number(
        err.statusCode
      );


    return res
      .status(
        statusCode
      )
      .json({
        message:
          err.message,

        type:
          err.type,

        ...(err.code
          ? {
              code:
                err.code,
            }
          : {}),
      });
  }


  console.error(
    `Error ${contexto}:`,
    err
  );


  return res
    .status(500)
    .json({
      message:
        "Error interno del servidor",
    });
}


/* =========================================================
   AUDITORÍA DE EXPORTACIÓN
   ========================================================= */

async function registrarAuditoria({
  req,
  usuario,
  formato,
  exportId,
  filtros,
  total = 0,
  detalle = [],
  pesaje = [],
  estado,
  errorMensaje = null,
}) {
  await registrarAuditoriaExportacion({
    usuario_id:
      usuario.id_usuario,

    usuario:
      usuario.usuario ||
      "N/A",

    rol:
      usuario.rol ||
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
      total,

    resumen_json:
      estado === "GENERADO"
        ? {
            filas_detalle:
              detalle.length,

            filas_pesaje:
              pesaje.length,
          }
        : null,

    estado,

    error_mensaje:
      errorMensaje,

    ip_origen:
      obtenerIp(
        req
      ),

    user_agent:
      obtenerUserAgent(
        req
      ),
  });
}


/* =========================================================
   OBTENER DATOS DE EXPORTACIÓN

   exportId
      ↓
   snapshot del usuario
      ↓
   filtros guardados
      ↓
   Historial Service vuelve a validarlos
      ↓
   consulta completa sin paginación

   Si el snapshot venció,
   ExportSnapshot.service lanza:

   status 410
   code EXPORT_SNAPSHOT_EXPIRADO
   ========================================================= */

async function obtenerDatosExportacion({
  exportId,
  usuarioId,
}) {
  const snapshot =
    await obtenerSnapshotValido({
      exportId,

      usuarioId,

      modulo:
        MODULO,
    });


  if (!snapshot) {
    return null;
  }


  const resultado =
    await consultarHistorial(
      snapshot.filtros_json ||
        {},
      {
        paginado:
          false,
      }
    );


  return {
    total:
      resultado.total,

    detalle:
      resultado.detalle,

    pesaje:
      resultado.pesaje,

    filtros:
      resultado
        .filtrosAplicados,
  };
}


/* =========================================================
   HISTORIAL

   GET /api/historial-recoleccion

   El frontend enviará:

   prepararExportacion=true
   únicamente al presionar "Ver".

   En paginación:
   prepararExportacion=false
   ========================================================= */

exports.obtenerHistorial =
  async (req, res) => {

    const usuario =
      obtenerUsuarioAutenticado(
        req
      );


    if (!usuario) {
      return res
        .status(401)
        .json({
          message:
            "Usuario no autenticado.",
        });
    }


    try {

      /* ===================================================
         PÁGINA
         =================================================== */

      const page =
        normalizarPagina(
          req.query?.page
        );


      const offset =
        (
          page - 1
        ) * PAGE_SIZE;


      /* ===================================================
         ¿SE DEBE CREAR SNAPSHOT?
         =================================================== */

      const prepararExportacion =
        normalizarPrepararExportacion(
          req.query
            ?.prepararExportacion
        );


      /* ===================================================
         FILTROS
         =================================================== */

      const filtrosEntrada =
        obtenerFiltrosEntrada(
          req
        );


      /* ===================================================
         SERVICE
         =================================================== */

      const resultado =
        await consultarHistorial(
          filtrosEntrada,
          {
            paginado:
              true,

            limit:
              PAGE_SIZE,

            offset,
          }
        );


      const {
        total,
        detalle,
        pesaje,
        filtrosAplicados,
      } = resultado;


      /* ===================================================
         SIN RESULTADOS

         Si el usuario eligió el criterio incorrecto,
         el Service ya habrá lanzado SEARCH_TYPE_MISMATCH
         antes de llegar aquí.
         =================================================== */

      if (
        total === 0
      ) {
        return res.json({
          message:
            "No se encontraron registros con los criterios seleccionados.",

          total: 0,

          page,

          limit:
            PAGE_SIZE,

          order:
            filtrosAplicados.order,

          data: {
            detalle: [],
            pesaje: [],
          },
        });
      }


      /* ===================================================
         SNAPSHOT

         Solo se crea cuando prepararExportacion=true.

         PAGINAR NO RENUEVA EL TTL.
         =================================================== */

      let snapshotMeta =
        null;


      if (
        prepararExportacion
      ) {
        snapshotMeta =
          await crearSnapshot({
            usuarioId:
              usuario.id_usuario,

            modulo:
              MODULO,

            filtros:
              filtrosAplicados,
          });
      }


      /* ===================================================
         RESPUESTA
         =================================================== */

      return res.json({
        message:
          "Historial obtenido correctamente.",

        total,

        page,

        limit:
          PAGE_SIZE,

        order:
          filtrosAplicados.order,

        data: {
          detalle,
          pesaje,
        },


        /*
          Estas propiedades solo se incluyen
          cuando realmente se creó un snapshot.
        */

        ...(snapshotMeta
          ? {
              export_id:
                snapshotMeta
                  .exportId,

              export_expires_at:
                snapshotMeta
                  .expiresAt,

              export_expires_in_seconds:
                snapshotMeta
                  .expiresInSeconds,
            }
          : {}),
      });


    } catch (err) {

      return responderError(
        res,
        err,
        "obtenerHistorial"
      );

    }
  };


/* =========================================================
   EXPORTAR PDF

   GET
   /api/historial-recoleccion/export/pdf?exportId=...
   ========================================================= */

exports.exportarPdf =
  async (req, res) => {

    const usuario =
      obtenerUsuarioAutenticado(
        req
      );


    if (!usuario) {
      return res
        .status(401)
        .json({
          message:
            "Usuario no autenticado.",
        });
    }


    const exportId =
      normalizarExportId(
        req.query?.exportId
      );


    if (!exportId) {
      return res
        .status(400)
        .json({
          message:
            "exportId inválido.",

          type:
            "validation",

          code:
            "EXPORT_SNAPSHOT_INVALIDO",
        });
    }


    let filtros =
      null;


    try {

      /* ===================================================
         DATOS DESDE SNAPSHOT
         =================================================== */

      const datos =
        await obtenerDatosExportacion({
          exportId,

          usuarioId:
            usuario.id_usuario,
        });


      /* ===================================================
         SNAPSHOT NO ENCONTRADO

         Si estaba vencido no llega aquí:
         ExportSnapshot.service lanza 410.
         =================================================== */

      if (!datos) {
        return res
          .status(400)
          .json({
            message:
              "La exportación no existe o ya no está disponible. Presione 'Ver' nuevamente.",

            type:
              "validation",

            code:
              "EXPORT_SNAPSHOT_INVALIDO",
          });
      }


      filtros =
        datos.filtros;


      /* ===================================================
         GENERAR PDF
         =================================================== */

      const pdfBuffer =
        await buildHistorialRecoleccionPdfBuffer({
          filtros:
            datos.filtros,

          detalle:
            datos.detalle,

          pesaje:
            datos.pesaje,

          generadoPor:
            usuario,

          total:
            datos.total,
        });


      /* ===================================================
         AUDITORÍA EXITOSA
         =================================================== */

      await registrarAuditoria({
        req,
        usuario,

        formato:
          "PDF",

        exportId,

        filtros:
          datos.filtros,

        total:
          datos.total,

        detalle:
          datos.detalle,

        pesaje:
          datos.pesaje,

        estado:
          "GENERADO",
      });


      /* ===================================================
         RESPUESTA PDF
         =================================================== */

      res.setHeader(
        "Content-Type",
        "application/pdf"
      );


      res.setHeader(
        "Content-Disposition",
        'inline; filename="historial_recoleccion.pdf"'
      );


      return res
        .status(200)
        .send(
          pdfBuffer
        );


    } catch (err) {

      /* ===================================================
         AUDITORÍA FALLIDA
         =================================================== */

      try {

        await registrarAuditoria({
          req,
          usuario,

          formato:
            "PDF",

          exportId,

          filtros:
            filtros || {
              exportId,
            },

          estado:
            "FALLIDO",

          errorMensaje:
            err?.message ||
            "Error al generar PDF",
        });

      } catch (
        auditoriaError
      ) {

        console.error(
          "Error registrando auditoría PDF:",
          auditoriaError
        );

      }


      /* ===================================================
         RESPUESTA

         Aquí se conserva, por ejemplo:

         410
         EXPORT_SNAPSHOT_EXPIRADO
         =================================================== */

      return responderError(
        res,
        err,
        "exportarPdf"
      );
    }
  };


/* =========================================================
   EXPORTAR EXCEL

   GET
   /api/historial-recoleccion/export/excel?exportId=...
   ========================================================= */

exports.exportarExcel =
  async (req, res) => {

    const usuario =
      obtenerUsuarioAutenticado(
        req
      );


    if (!usuario) {
      return res
        .status(401)
        .json({
          message:
            "Usuario no autenticado.",
        });
    }


    const exportId =
      normalizarExportId(
        req.query?.exportId
      );


    if (!exportId) {
      return res
        .status(400)
        .json({
          message:
            "exportId inválido.",

          type:
            "validation",

          code:
            "EXPORT_SNAPSHOT_INVALIDO",
        });
    }


    let filtros =
      null;


    try {

      /* ===================================================
         DATOS DESDE SNAPSHOT
         =================================================== */

      const datos =
        await obtenerDatosExportacion({
          exportId,

          usuarioId:
            usuario.id_usuario,
        });


      if (!datos) {
        return res
          .status(400)
          .json({
            message:
              "La exportación no existe o ya no está disponible. Presione 'Ver' nuevamente.",

            type:
              "validation",

            code:
              "EXPORT_SNAPSHOT_INVALIDO",
          });
      }


      filtros =
        datos.filtros;


      /* ===================================================
         GENERAR EXCEL
         =================================================== */

      const excelBuffer =
        await buildHistorialRecoleccionExcelBuffer({
          filtros:
            datos.filtros,

          detalle:
            datos.detalle,

          pesaje:
            datos.pesaje,

          generadoPor:
            usuario,

          total:
            datos.total,
        });


      /* ===================================================
         AUDITORÍA EXITOSA
         =================================================== */

      await registrarAuditoria({
        req,
        usuario,

        formato:
          "EXCEL",

        exportId,

        filtros:
          datos.filtros,

        total:
          datos.total,

        detalle:
          datos.detalle,

        pesaje:
          datos.pesaje,

        estado:
          "GENERADO",
      });


      /* ===================================================
         RESPUESTA EXCEL
         =================================================== */

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );


      res.setHeader(
        "Content-Disposition",
        'attachment; filename="historial_recoleccion.xlsx"'
      );


      return res
        .status(200)
        .send(
          Buffer.from(
            excelBuffer
          )
        );


    } catch (err) {

      /* ===================================================
         AUDITORÍA FALLIDA
         =================================================== */

      try {

        await registrarAuditoria({
          req,
          usuario,

          formato:
            "EXCEL",

          exportId,

          filtros:
            filtros || {
              exportId,
            },

          estado:
            "FALLIDO",

          errorMensaje:
            err?.message ||
            "Error al generar Excel",
        });

      } catch (
        auditoriaError
      ) {

        console.error(
          "Error registrando auditoría Excel:",
          auditoriaError
        );

      }


      return responderError(
        res,
        err,
        "exportarExcel"
      );
    }
  };