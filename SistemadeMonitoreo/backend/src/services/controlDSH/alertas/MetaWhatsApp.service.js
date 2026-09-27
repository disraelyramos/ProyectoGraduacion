// ======================================================
// META WHATSAPP CLOUD API
// ======================================================
//
// Responsabilidad:
//
// Enviar una plantilla de WhatsApp mediante Meta.
//
// NO realiza consultas a PostgreSQL.
// NO decide quién recibe las alertas.
// NO modifica el estado de alertas_envios.
//
// Esas responsabilidades pertenecen al módulo
// de alertas y al procesador de envíos.
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

    this.reintentable =
      reintentable;

    this.resultadoDesconocido =
      resultadoDesconocido;
  }

}


// ======================================================
// OBTENER CONFIGURACIÓN
// ======================================================

function obtenerConfiguracionMeta() {

  const token =
    process.env.WHATSAPP_ACCESS_TOKEN
      ?.trim();

  const phoneNumberId =
    process.env.WHATSAPP_PHONE_NUMBER_ID
      ?.trim();

  const version =
    process.env.WHATSAPP_API_VERSION
      ?.trim();


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
    !/^\d+$/.test(phoneNumberId) ||
    !/^v\d+\.\d+$/.test(version)
  ) {

    throw new MetaWhatsAppError(
      "La configuración técnica de WhatsApp contiene valores inválidos."
    );
  }


  return {

    token,

    url:
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,

  };

}


// ======================================================
// VALIDAR DESTINATARIO
// ======================================================

function validarDestinatario(valor) {

  const numero =
    String(valor ?? "")
      .trim()
      .replace(/^\+/, "");


  if (
    !/^[1-9]\d{7,14}$/.test(numero)
  ) {

    throw new MetaWhatsAppError(
      "El destinatario de WhatsApp no tiene un formato internacional válido."
    );
  }


  return numero;

}


// ======================================================
// VALIDAR PLANTILLA
// ======================================================

function validarPlantilla(
  plantilla,
  idioma,
  parametrosCuerpo
) {

  if (
    typeof plantilla !== "string" ||
    !/^[a-z0-9_]+$/.test(plantilla)
  ) {

    throw new MetaWhatsAppError(
      "Debe indicar una plantilla de WhatsApp válida."
    );
  }


  if (
    typeof idioma !== "string" ||
    !/^[a-z]{2,3}(?:_[A-Z]{2})?$/.test(
      idioma
    )
  ) {

    throw new MetaWhatsAppError(
      "Debe indicar el idioma de la plantilla."
    );
  }


  if (
    !Array.isArray(parametrosCuerpo)
  ) {

    throw new MetaWhatsAppError(
      "Los parámetros de la plantilla deben enviarse en una lista."
    );
  }


  return parametrosCuerpo.map(
    (valor) => {

      const texto =
        String(valor ?? "").trim();


      if (!texto) {

        throw new MetaWhatsAppError(
          "Los parámetros de la plantilla no pueden estar vacíos."
        );
      }


      return {

        type: "text",

        text: texto,

      };

    }
  );

}


// ======================================================
// ENVIAR PLANTILLA DE WHATSAPP
// ======================================================

async function enviarPlantillaWhatsApp({

  destinatario,

  plantilla,

  idioma,

  parametrosCuerpo = [],

}) {

  // ====================================================
  // 1. VALIDAR CONFIGURACIÓN
  // ====================================================

  const {
    token,
    url,
  } = obtenerConfiguracionMeta();


  // ====================================================
  // 2. VALIDAR DESTINATARIO Y PLANTILLA
  // ====================================================

  const numero =
    validarDestinatario(
      destinatario
    );


  const parametros =
    validarPlantilla(
      plantilla,
      idioma,
      parametrosCuerpo
    );


  // ====================================================
  // 3. CONSTRUIR MENSAJE
  // ====================================================

  const template = {

    name:
      plantilla,

    language: {

      code:
        idioma,

    },

  };


  /*
   * Solamente se agrega el componente body
   * cuando la plantilla utiliza variables.
   *
   * Ejemplo:
   *
   * Contenedor: {{1}}
   * Porcentaje: {{2}}
   *
   * Una plantilla sin variables no necesita
   * enviar components.
   */

  if (
    parametros.length > 0
  ) {

    template.components = [

      {

        type:
          "body",

        parameters:
          parametros,

      },

    ];

  }


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
  // 4. ENVIAR SOLICITUD
  // ====================================================
  //
  // Timeout de 15 segundos.
  //
  // IMPORTANTE:
  //
  // Si ocurre un timeout, no sabemos con certeza
  // si Meta alcanzó a recibir la solicitud.
  //
  // Por eso marcamos el resultado como desconocido
  // para que el futuro procesador NO reintente
  // automáticamente sin revisar ese caso.
  // ====================================================

  const controller =
    new AbortController();


  const timeout =
    setTimeout(
      () => controller.abort(),
      15000
    );


  let response;
  let data;


  try {

    response = await fetch(

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
      await response.json()
        .catch(() => ({}));


  } catch (error) {

    /*
     * No registramos el token ni los datos
     * completos de la petición.
     */

    throw new MetaWhatsAppError(

      controller.signal.aborted
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
  // 5. META RECHAZÓ LA SOLICITUD
  // ====================================================

  if (
    !response.ok
  ) {

    const codigoMeta =
      data?.error?.code ??
      null;


    const reintentable =
      response.status === 429 ||
      response.status >= 500;


    throw new MetaWhatsAppError(

      data?.error?.message ||
      "Meta rechazó el mensaje de WhatsApp.",

      {

        statusCode:
          response.status,

        codigoMeta,

        reintentable,

      }

    );

  }


  // ====================================================
  // 6. OBTENER IDENTIFICADOR DEL MENSAJE
  // ====================================================

  const mensajeId =
    data?.messages?.[0]?.id;


  if (
    !mensajeId
  ) {

    throw new MetaWhatsAppError(

      "Meta respondió, pero no devolvió el identificador del mensaje.",

      {

        statusCode:
          response.status,

        resultadoDesconocido:
          true,

      }

    );

  }


  // ====================================================
  // 7. RESPUESTA
  // ====================================================
  //
  // Meta aceptó la solicitud.
  //
  // Esto NO significa todavía:
  //
  // - Que el mensaje fue entregado.
  // - Que el destinatario lo leyó.
  //
  // Esos estados se comprobarán posteriormente
  // mediante los webhooks oficiales.
  // ====================================================

  return {

    aceptado:
      true,

    proveedorMensajeId:
      mensajeId,

    estadoMeta:
      data?.messages?.[0]
        ?.message_status ||
      null,

  };

}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  enviarPlantillaWhatsApp,

  MetaWhatsAppError,

};