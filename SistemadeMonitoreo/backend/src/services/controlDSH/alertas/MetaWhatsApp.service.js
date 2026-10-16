// ======================================================
// META WHATSAPP CLOUD API
// ======================================================


// ======================================================
// ERROR CONTROLADO
// ======================================================

class MetaWhatsAppError extends Error {

  constructor(
    message,
    {
      statusCode = null,
      codigoMeta = null,
      reintentable = false,
      resultadoDesconocido = false,
    } = {}
  ) {

    super(message);

    this.name =
      "MetaWhatsAppError";

    this.statusCode =
      statusCode;

    this.codigoMeta =
      codigoMeta;

    // Compatibilidad con ProcesadorEnvios.service.js
    this.codigo =
      codigoMeta;

    this.reintentable =
      reintentable;

    this.resultadoDesconocido =
      resultadoDesconocido;
  }
}


// ======================================================
// ENTERO POSITIVO
// ======================================================

function obtenerEnteroPositivo(
  valor,
  predeterminado
) {

  const numero =
    Number.parseInt(
      String(
        valor ?? ""
      ),
      10
    );


  if (
    !Number.isFinite(
      numero
    ) ||
    numero <= 0
  ) {

    return predeterminado;
  }


  return numero;
}


// ======================================================
// CONFIGURACIÓN META
// ======================================================

function obtenerConfiguracionMeta() {

  const token =
    process.env
      .WHATSAPP_ACCESS_TOKEN
      ?.trim();


  const phoneNumberId =
    process.env
      .WHATSAPP_PHONE_NUMBER_ID
      ?.trim();


  const version =
    process.env
      .WHATSAPP_API_VERSION
      ?.trim();


  const timeoutMs =
    obtenerEnteroPositivo(
      process.env
        .WHATSAPP_HTTP_TIMEOUT_MS,
      15000
    );


  if (
    !token ||
    !phoneNumberId ||
    !version
  ) {

    throw new MetaWhatsAppError(
      "La API de WhatsApp no está configurada completamente."
    );
  }


  if (
    !/^\d+$/.test(
      phoneNumberId
    )
  ) {

    throw new MetaWhatsAppError(
      "WHATSAPP_PHONE_NUMBER_ID no es válido."
    );
  }


  if (
    !/^v\d+\.\d+$/.test(
      version
    )
  ) {

    throw new MetaWhatsAppError(
      "WHATSAPP_API_VERSION no es válida."
    );
  }


  return {

    token,

    phoneNumberId,

    version,

    timeoutMs,

    url:
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
  };
}


// ======================================================
// VALIDAR DESTINATARIO
// ======================================================
//
// BD:
//
// +50237068088
//
// META:
//
// 50237068088
// ======================================================

function validarDestinatario(
  valor
) {

  const numero =
    String(
      valor ??
      ""
    )
      .trim()
      .replace(
        /^\+/,
        ""
      )
      .replace(
        /\s+/g,
        ""
      );


  if (
    !/^[1-9]\d{7,14}$/.test(
      numero
    )
  ) {

    throw new MetaWhatsAppError(
      "El destinatario de WhatsApp no tiene un formato internacional válido."
    );
  }


  return numero;
}


// ======================================================
// RESOLVER PARÁMETROS
// ======================================================
//
// Compatibilidad con:
//
// parametrosCuerpo
// parametrosBody
// parametros
//
// ProcesadorEnvios actualmente envía:
//
// parametros
// parametrosBody
//
// Por lo tanto este servicio admite ambos.
// ======================================================

function resolverParametros({
  parametrosCuerpo,
  parametrosBody,
  parametros,
}) {

  if (
    Array.isArray(
      parametrosCuerpo
    )
  ) {

    return parametrosCuerpo;
  }


  if (
    Array.isArray(
      parametrosBody
    )
  ) {

    return parametrosBody;
  }


  if (
    Array.isArray(
      parametros
    )
  ) {

    return parametros;
  }


  return [];
}


// ======================================================
// VALIDAR PLANTILLA
// ======================================================

function validarPlantilla(
  plantilla,
  idioma,
  parametrosCuerpo
) {

  const nombrePlantilla =
    String(
      plantilla ??
      ""
    ).trim();


  const codigoIdioma =
    String(
      idioma ??
      ""
    ).trim();


  if (
    !nombrePlantilla ||
    !/^[a-z0-9_]+$/.test(
      nombrePlantilla
    )
  ) {

    throw new MetaWhatsAppError(
      "Debe indicar una plantilla de WhatsApp válida."
    );
  }


  if (
    !codigoIdioma ||
    !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(
      codigoIdioma
    )
  ) {

    throw new MetaWhatsAppError(
      "Debe indicar un idioma válido para la plantilla."
    );
  }


  if (
    !Array.isArray(
      parametrosCuerpo
    )
  ) {

    throw new MetaWhatsAppError(
      "Los parámetros de la plantilla deben enviarse en una lista."
    );
  }


  const parametros =
    parametrosCuerpo.map(
      (
        valor,
        index
      ) => {

        const texto =
          String(
            valor ??
            ""
          ).trim();


        if (!texto) {

          throw new MetaWhatsAppError(
            `El parámetro ${
              index + 1
            } de la plantilla está vacío.`
          );
        }


        return {
          type:
            "text",

          text:
            texto,
        };
      }
    );


  return {

    nombrePlantilla,

    codigoIdioma,

    parametros,
  };
}


// ======================================================
// ENVIAR PLANTILLA WHATSAPP
// ======================================================

async function enviarPlantillaWhatsApp(
  {
    destinatario,

    plantilla,

    nombrePlantilla,

    idioma,

    codigoIdioma,

    parametrosCuerpo,

    parametrosBody,

    parametros,
  }
) {

  // ====================================================
  // 1. CONFIGURACIÓN
  // ====================================================

  const {
    token,
    url,
    timeoutMs,
  } =
    obtenerConfiguracionMeta();


  // ====================================================
  // 2. DESTINATARIO
  // ====================================================

  const numero =
    validarDestinatario(
      destinatario
    );


  // ====================================================
  // 3. RESOLVER ALIAS
  // ====================================================

  const plantillaFinal =
    String(
      plantilla ||
      nombrePlantilla ||
      ""
    ).trim();


  const idiomaFinal =
    String(
      idioma ||
      codigoIdioma ||
      ""
    ).trim();


  const parametrosFinales =
    resolverParametros({
      parametrosCuerpo,
      parametrosBody,
      parametros,
    });


  // ====================================================
  // 4. VALIDAR PLANTILLA
  // ====================================================

  const {
    nombrePlantilla:
      nombreValidado,

    codigoIdioma:
      idiomaValidado,

    parametros:
      parametrosValidados,
  } =
    validarPlantilla(
      plantillaFinal,
      idiomaFinal,
      parametrosFinales
    );


  // ====================================================
  // 5. CONSTRUIR TEMPLATE
  // ====================================================

  const template = {

    name:
      nombreValidado,

    language: {
      code:
        idiomaValidado,
    },
  };


  // ====================================================
  // VARIABLES DEL BODY
  // ====================================================

  if (
    parametrosValidados.length >
    0
  ) {

    template.components = [
      {
        type:
          "body",

        parameters:
          parametrosValidados,
      },
    ];
  }


  // ====================================================
  // 6. PAYLOAD
  // ====================================================

  const payload = {

    messaging_product:
      "whatsapp",

    recipient_type:
      "individual",

    to:
      numero,

    type:
      "template",

    template,
  };


  // ====================================================
  // 7. TIMEOUT
  // ====================================================

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => {

        controller.abort();

      },
      timeoutMs
    );


  let response;
  let data;


  // ====================================================
  // 8. ENVIAR A META
  // ====================================================

  try {

    response =
      await fetch(
        url,
        {
          method:
            "POST",

          headers: {

            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              payload
            ),

          signal:
            controller.signal,
        }
      );


    data =
      await response
        .json()
        .catch(
          () => ({})
        );


  } catch (
    error
  ) {

    throw new MetaWhatsAppError(

      controller
        .signal
        .aborted

        ? "La solicitud a Meta superó el tiempo de espera."

        : "No fue posible completar la conexión con Meta.",

      {
        resultadoDesconocido:
          true,
      }
    );


  } finally {

    clearTimeout(
      timeout
    );
  }


  // ====================================================
  // 9. META RECHAZÓ
  // ====================================================

  if (
    !response.ok
  ) {

    const errorMeta =
      data?.error ||
      {};


    const codigoMeta =
      errorMeta.code ??
      null;


    const detalleMeta =
      String(
        errorMeta
          ?.error_data
          ?.details ||
        ""
      ).trim();


    const mensajeBase =
      String(
        errorMeta.message ||
        "Meta rechazó el mensaje de WhatsApp."
      ).trim();


    const mensaje =
      detalleMeta

        ? `${mensajeBase} | ${detalleMeta}`

        : mensajeBase;


    const reintentable =
      response.status === 429 ||
      response.status >= 500;


    throw new MetaWhatsAppError(
      mensaje,
      {
        statusCode:
          response.status,

        codigoMeta,

        reintentable,

        resultadoDesconocido:
          false,
      }
    );
  }


  // ====================================================
  // 10. MESSAGE ID
  // ====================================================

  const mensaje =
    data
      ?.messages
      ?.[0];


  const mensajeId =
    String(
      mensaje?.id ||
      ""
    ).trim();


  if (
    !mensajeId
  ) {

    throw new MetaWhatsAppError(
      "Meta respondió correctamente, pero no devolvió el identificador del mensaje.",
      {
        statusCode:
          response.status,

        resultadoDesconocido:
          true,
      }
    );
  }


  // ====================================================
  // 11. RESPUESTA
  // ====================================================

  return {

    aceptado:
      true,

    proveedorMensajeId:
      mensajeId,

    estadoMeta:
      mensaje
        ?.message_status ??
      null,

    destinatario:
      numero,

    plantilla:
      nombreValidado,
  };
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  enviarPlantillaWhatsApp,

  MetaWhatsAppError,
};