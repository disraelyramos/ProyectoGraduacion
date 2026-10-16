const pool = require(
  "../../../config/db"
);

const {
  enviarPlantillaWhatsApp,
  MetaWhatsAppError,
} = require(
  "./MetaWhatsApp.service"
);

const {
  registrarAceptacionMeta,
  registrarFalloMeta,
} = require(
  "./ResultadoEnvios.service"
);

const {
  enviarRespaldoEmail,
} = require(
  "./RespaldoEmail.service"
);


// ======================================================
// CONFIGURACIÓN
// ======================================================

const CANAL_WHATSAPP =
  "WHATSAPP";

const ESTADO_PENDIENTE =
  "PENDIENTE";

const MAX_INTENTOS_WHATSAPP =
  3;

const LIMITE_MAXIMO_CONSULTA =
  100;


// ======================================================
// VALIDAR ENTERO POSITIVO
// ======================================================

function validarEnteroPositivo(
  valor,
  nombre
) {

  const numero =
    Number(valor);


  if (
    !Number.isSafeInteger(
      numero
    ) ||
    numero <= 0
  ) {

    throw new Error(
      `${nombre} inválido.`
    );
  }


  return numero;
}


// ======================================================
// VALIDAR LÍMITE
// ======================================================

function validarLimite(
  valor
) {

  const limite =
    validarEnteroPositivo(
      valor,
      "Límite"
    );


  return Math.min(
    limite,
    LIMITE_MAXIMO_CONSULTA
  );
}


// ======================================================
// OBTENER IDIOMA
// ======================================================

function obtenerIdiomaWhatsApp() {

  const idioma =
    String(
      process.env
        .WHATSAPP_LANGUAGE ||
      "es"
    ).trim();


  if (!idioma) {

    throw new Error(
      "WHATSAPP_LANGUAGE no está configurado correctamente."
    );
  }


  return idioma;
}


// ======================================================
// LEER CONTENIDO ESTRUCTURADO
// ======================================================

function leerContenidoEstructurado(
  contenidoEnviado
) {

  const contenido =
    String(
      contenidoEnviado ??
      ""
    ).trim();


  if (!contenido) {

    throw new Error(
      "El envío no contiene información para procesar."
    );
  }


  let datos;


  try {

    datos =
      JSON.parse(
        contenido
      );

  } catch (
    error
  ) {

    throw new Error(
      "El contenido del envío no tiene el formato estructurado esperado."
    );
  }


  if (
    !datos ||
    typeof datos !==
      "object" ||
    Array.isArray(
      datos
    )
  ) {

    throw new Error(
      "El contenido estructurado del envío no es válido."
    );
  }


  if (
    Number(
      datos.version
    ) !== 1
  ) {

    throw new Error(
      "La versión del contenido del envío no es compatible."
    );
  }


  if (
    !Array.isArray(
      datos.parametros
    ) ||
    datos.parametros.length ===
      0
  ) {

    throw new Error(
      "El envío no contiene parámetros para la plantilla de WhatsApp."
    );
  }


  const parametros =
    datos.parametros.map(
      (
        parametro,
        index
      ) => {

        const texto =
          String(
            parametro ??
            ""
          ).trim();


        if (!texto) {

          throw new Error(
            `El parámetro ${
              index + 1
            } de WhatsApp está vacío.`
          );
        }


        return texto;
      }
    );


  return {
    version:
      1,

    mensaje:
      String(
        datos.mensaje ??
        ""
      ).trim(),

    parametros,
  };
}


// ======================================================
// NORMALIZAR PLANTILLA
// ======================================================

function normalizarPlantilla(
  value
) {

  const plantilla =
    String(
      value ??
      ""
    ).trim();


  if (!plantilla) {

    throw new Error(
      "El envío no contiene una plantilla de Meta."
    );
  }


  if (
    !/^[a-z0-9_]+$/.test(
      plantilla
    )
  ) {

    throw new Error(
      "La plantilla de Meta del envío no es válida."
    );
  }


  return plantilla;
}


// ======================================================
// OBTENER CÓDIGO DE ERROR
// ======================================================

function obtenerCodigoError(
  error
) {

  const valor =
    error?.codigo ??
    error?.code ??
    (
      error?.status
        ? `HTTP_${error.status}`
        : null
    ) ??
    "META_WHATSAPP_ERROR";


  return String(
    valor
  )
    .trim()
    .slice(
      0,
      100
    ) ||
    "META_WHATSAPP_ERROR";
}


// ======================================================
// OBTENER DETALLE
// ======================================================

function obtenerDetalleError(
  error
) {

  const mensaje =
    String(
      error?.message ??
      "No fue posible enviar el mensaje mediante WhatsApp."
    ).trim();


  return mensaje ||
    "No fue posible enviar el mensaje mediante WhatsApp.";
}


// ======================================================
// OBTENER BANDERA TÉCNICA DE META
// ======================================================
//
// ResultadoEnvios.service ya garantiza los 3 intentos.
//
// Esta bandera se conserva únicamente para trazabilidad.
// ======================================================

function obtenerErrorReintentable(
  error
) {

  if (
    typeof error?.reintentable ===
    "boolean"
  ) {

    return error.reintentable;
  }


  /*
   * Si hubo un error de red o resultado desconocido,
   * lo registramos técnicamente como reintentable.
   */
  if (
    error?.resultadoDesconocido ===
    true
  ) {

    return true;
  }


  return true;
}


// ======================================================
// OBTENER ENVÍOS PENDIENTES
// ======================================================

async function obtenerEnviosPendientes({
  limite = 20,
} = {}) {

  const limiteValidado =
    validarLimite(
      limite
    );


  const { rows } =
    await pool.query(
      `
        SELECT
          ae.id,
          ae.alerta_id,
          ae.secuencia_notificacion,
          ae.canal,
          ae.intento,

          ae.usuario_destinatario_id,
          ae.destinatario,

          ae.estado,

          ae.plantilla_meta,
          ae.contenido_enviado,

          ae.fecha_programada_intento,
          ae.fecha_intento,

          a.tipo AS tipo_alerta,
          a.motivo AS motivo_alerta

        FROM alertas_envios ae

        JOIN alertas a
          ON a.id =
             ae.alerta_id

        WHERE ae.canal = $1

          AND ae.estado = $2

          AND ae.fecha_programada_intento
            <= CURRENT_TIMESTAMP

          AND ae.plantilla_meta
            IS NOT NULL

          AND TRIM(
            ae.plantilla_meta
          ) <> ''

          AND ae.contenido_enviado
            IS NOT NULL

          AND TRIM(
            ae.contenido_enviado
          ) <> ''

        ORDER BY
          ae.fecha_programada_intento ASC,
          ae.id ASC

        LIMIT $3
      `,
      [
        CANAL_WHATSAPP,
        ESTADO_PENDIENTE,
        limiteValidado,
      ]
    );


  return rows;
}


// ======================================================
// OBTENER ENVÍO ACTUAL
// ======================================================

async function obtenerEnvioActual(
  client,
  envioId
) {

  const id =
    validarEnteroPositivo(
      envioId,
      "Envío"
    );


  const { rows } =
    await client.query(
      `
        SELECT
          ae.id,
          ae.alerta_id,
          ae.secuencia_notificacion,
          ae.canal,
          ae.intento,

          ae.usuario_destinatario_id,
          ae.destinatario,

          ae.estado,

          ae.plantilla_meta,
          ae.contenido_enviado,

          ae.fecha_programada_intento,
          ae.fecha_intento,

          a.tipo AS tipo_alerta,
          a.motivo AS motivo_alerta

        FROM alertas_envios ae

        JOIN alertas a
          ON a.id =
             ae.alerta_id

        WHERE ae.id = $1

          AND ae.canal = $2

          AND ae.estado = $3

          AND ae.fecha_programada_intento
            <= CURRENT_TIMESTAMP

        LIMIT 1
      `,
      [
        id,
        CANAL_WHATSAPP,
        ESTADO_PENDIENTE,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// BLOQUEAR ENVÍO
// ======================================================

async function intentarBloquearEnvio(
  client,
  envioId
) {

  const id =
    validarEnteroPositivo(
      envioId,
      "Envío"
    );


  const { rows } =
    await client.query(
      `
        SELECT
          pg_try_advisory_lock(
            $1::bigint
          ) AS adquirido
      `,
      [
        id,
      ]
    );


  return rows[0]
    ?.adquirido ===
    true;
}


// ======================================================
// LIBERAR BLOQUEO
// ======================================================

async function liberarBloqueoEnvio(
  client,
  envioId
) {

  const id =
    validarEnteroPositivo(
      envioId,
      "Envío"
    );


  await client.query(
    `
      SELECT
        pg_advisory_unlock(
          $1::bigint
        )
    `,
    [
      id,
    ]
  );
}


// ======================================================
// ENVIAR A META
// ======================================================

async function enviarAMeta(
  envio
) {

  const plantilla =
    normalizarPlantilla(
      envio
        .plantilla_meta
    );


  const contenido =
    leerContenidoEstructurado(
      envio
        .contenido_enviado
    );


  const idioma =
    obtenerIdiomaWhatsApp();


  return enviarPlantillaWhatsApp({
    destinatario:
      envio.destinatario,

    plantilla,

    nombrePlantilla:
      plantilla,

    idioma,

    codigoIdioma:
      idioma,

    parametros:
      contenido.parametros,

    parametrosBody:
      contenido.parametros,
  });
}


// ======================================================
// EJECUTAR RESPALDO EMAIL DE FORMA SEGURA
// ======================================================
//
// Solo se llama cuando ResultadoEnvios.service indica
// que los 3 intentos de WhatsApp se agotaron.
// ======================================================

async function ejecutarRespaldoEmailSeguro(
  envioWhatsAppId
) {

  try {

    return await enviarRespaldoEmail({
      envioWhatsAppId,
    });

  } catch (
    error
  ) {

    console.error(
      "Error ejecutando respaldo por correo:",
      error.message
    );


    return {
      accion:
        "ERROR_RESPALDO_EMAIL",

      error:
        error.message,
    };
  }
}


// ======================================================
// PROCESAR FALLO DE WHATSAPP
// ======================================================
//
// Centralizamos aquí:
//
// 1. registrar fallo;
// 2. crear siguiente intento;
// 3. después del tercero:
//    enviar correo de respaldo.
// ======================================================

async function procesarFalloWhatsApp({
  envio,
  codigoError,
  detalleError,
  errorReintentable,
  esErrorMeta = false,
}) {

  const resultadoFallo =
    await registrarFalloMeta({
      envioId:
        envio.id,

      codigoError,

      detalleError,

      errorReintentable,
    });


  const requiereRespaldo =
    resultadoFallo
      ?.requiereEvaluarRespaldoEmail ===
    true;


  let respaldoEmail =
    null;


  // ====================================================
  // SOLO DESPUÉS DEL TERCER FALLO
  // ====================================================

  if (
    requiereRespaldo
  ) {

    respaldoEmail =
      await ejecutarRespaldoEmailSeguro(
        envio.id
      );
  }


  return {
    envioId:
      envio.id,

    alertaId:
      envio.alerta_id,

    secuenciaNotificacion:
      envio
        .secuencia_notificacion,

    intento:
      envio.intento,

    accion:
      "WHATSAPP_FALLO",

    esErrorMeta,

    resultado:
      resultadoFallo,

    requiereEvaluarRespaldoEmail:
      requiereRespaldo,

    respaldoEmail,
  };
}


// ======================================================
// PROCESAR UN ENVÍO PENDIENTE
// ======================================================
//
// REGLA:
//
// WhatsApp intento 1
//        ↓ falla
// WhatsApp intento 2
//        ↓ falla
// WhatsApp intento 3
//        ↓ falla
// EMAIL DE RESPALDO
//
// Si WhatsApp funciona:
//
// NO EMAIL.
// ======================================================

async function procesarEnvioPendiente(
  envioOriginal
) {

  const envioId =
    validarEnteroPositivo(
      envioOriginal?.id,
      "Envío"
    );


  const client =
    await pool.connect();


  let bloqueoAdquirido =
    false;

  let destruirConexion =
    false;


  try {

    // ==================================================
    // 1. BLOQUEAR
    // ==================================================

    bloqueoAdquirido =
      await intentarBloquearEnvio(
        client,
        envioId
      );


    if (
      !bloqueoAdquirido
    ) {

      return {
        envioId,

        accion:
          "ENVIO_EN_PROCESO_POR_OTRO_WORKER",
      };
    }


    // ==================================================
    // 2. RECONSULTAR
    // ==================================================

    const envio =
      await obtenerEnvioActual(
        client,
        envioId
      );


    if (!envio) {

      return {
        envioId,

        accion:
          "ENVIO_YA_NO_ESTA_PENDIENTE",
      };
    }


    // ==================================================
    // 3. VALIDAR INTENTO
    // ==================================================

    const intento =
      validarEnteroPositivo(
        envio.intento,
        "Intento"
      );


    if (
      intento >
      MAX_INTENTOS_WHATSAPP
    ) {

      throw new Error(
        "El envío supera el máximo de intentos de WhatsApp."
      );
    }


    // ==================================================
    // 4. VALIDAR DATOS
    // ==================================================

    normalizarPlantilla(
      envio
        .plantilla_meta
    );


    leerContenidoEstructurado(
      envio
        .contenido_enviado
    );


    // ==================================================
    // 5. ENVIAR A META
    // ==================================================

    let respuestaMeta;


    try {

      respuestaMeta =
        await enviarAMeta(
          envio
        );

    } catch (
      error
    ) {

      return procesarFalloWhatsApp({
        envio,

        codigoError:
          obtenerCodigoError(
            error
          ),

        detalleError:
          obtenerDetalleError(
            error
          ),

        errorReintentable:
          obtenerErrorReintentable(
            error
          ),

        esErrorMeta:
          error instanceof
          MetaWhatsAppError,
      });
    }


    // ==================================================
    // 6. VALIDAR MESSAGE ID
    // ==================================================

    const proveedorMensajeId =
      String(
        respuestaMeta
          ?.proveedorMensajeId ??
        ""
      ).trim();


    if (
      !proveedorMensajeId
    ) {

      return procesarFalloWhatsApp({
        envio,

        codigoError:
          "META_SIN_MESSAGE_ID",

        detalleError:
          "Meta respondió sin devolver un identificador de mensaje.",

        errorReintentable:
          true,

        esErrorMeta:
          false,
      });
    }


    // ==================================================
    // 7. META ACEPTÓ
    // ==================================================

    const resultadoAceptacion =
      await registrarAceptacionMeta({
        envioId:
          envio.id,

        proveedorMensajeId,
      });


    return {
      envioId:
        envio.id,

      alertaId:
        envio.alerta_id,

      secuenciaNotificacion:
        envio
          .secuencia_notificacion,

      intento:
        envio.intento,

      accion:
        "WHATSAPP_ACEPTADO",

      proveedorMensajeId,

      estadoMeta:
        respuestaMeta
          ?.estadoMeta ??
        null,

      resultado:
        resultadoAceptacion,

      requiereEvaluarRespaldoEmail:
        false,

      respaldoEmail:
        null,
    };


  } finally {

    // ==================================================
    // LIBERAR BLOQUEO
    // ==================================================

    if (
      bloqueoAdquirido
    ) {

      try {

        await liberarBloqueoEnvio(
          client,
          envioId
        );

      } catch (
        error
      ) {

        destruirConexion =
          true;


        console.error(
          "No fue posible liberar el bloqueo del envío WhatsApp:",
          envioId,
          error.message
        );
      }
    }


    client.release(
      destruirConexion
    );
  }
}


// ======================================================
// PROCESAR COLA
// ======================================================

async function procesarEnviosPendientes({
  limite = 20,
} = {}) {

  const pendientes =
    await obtenerEnviosPendientes({
      limite,
    });


  const resultados =
    [];


  for (
    const envio
    of pendientes
  ) {

    try {

      const resultado =
        await procesarEnvioPendiente(
          envio
        );


      resultados.push(
        resultado
      );

    } catch (
      error
    ) {

      console.error(
        `Error procesando envío WhatsApp ${envio.id}:`,
        error.message
      );


      resultados.push({
        envioId:
          envio.id,

        alertaId:
          envio.alerta_id,

        accion:
          "ERROR_PROCESANDO_ENVIO",

        error:
          error.message,
      });
    }
  }


  return {
    totalPendientes:
      pendientes.length,

    totalProcesados:
      resultados.length,

    resultados,
  };
}


// ======================================================
// CONSULTAR INTENTOS
// ======================================================

async function obtenerIntentosWhatsApp({
  alertaId,
  secuenciaNotificacion = 1,
}) {

  const alertaIdValidado =
    validarEnteroPositivo(
      alertaId,
      "Alerta"
    );


  const secuenciaValidada =
    validarEnteroPositivo(
      secuenciaNotificacion,
      "Secuencia de notificación"
    );


  const { rows } =
    await pool.query(
      `
        SELECT
          id,
          alerta_id,
          secuencia_notificacion,

          canal,
          intento,
          estado,

          plantilla_meta,

          proveedor_mensaje_id,

          codigo_error,
          detalle_error,
          error_reintentable,

          fecha_programada_intento,
          fecha_intento,
          fecha_actualizacion,
          fecha_entregado,
          fecha_leido

        FROM alertas_envios

        WHERE alerta_id = $1

          AND secuencia_notificacion = $2

          AND canal = $3

        ORDER BY
          intento ASC,
          id ASC
      `,
      [
        alertaIdValidado,
        secuenciaValidada,
        CANAL_WHATSAPP,
      ]
    );


  return {
    alertaId:
      alertaIdValidado,

    secuenciaNotificacion:
      secuenciaValidada,

    maxIntentos:
      MAX_INTENTOS_WHATSAPP,

    intentosRegistrados:
      rows.length,

    intentos:
      rows,
  };
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  obtenerEnviosPendientes,

  procesarEnvioPendiente,

  procesarEnviosPendientes,

  obtenerIntentosWhatsApp,
};