const sgMail =
  require(
    "@sendgrid/mail"
  );


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

if (
  process.env.SENDGRID_API_KEY
) {

  sgMail.setApiKey(
    process.env.SENDGRID_API_KEY
  );

} else {

  console.warn(
    "SENDGRID_API_KEY no está configurada."
  );
}


/* =========================================================
   ENVIAR CORREO
   ========================================================= */

exports.enviarCorreo =
  async (
    to,
    subject,
    html
  ) => {

    /* =====================================================
       VALIDACIÓN INTERNA
       ===================================================== */

    if (
      typeof to !==
        "string" ||
      !to.trim()
    ) {

      throw new Error(
        "EMAIL_DESTINATARIO_INVALIDO"
      );
    }


    if (
      typeof subject !==
        "string" ||
      !subject.trim()
    ) {

      throw new Error(
        "EMAIL_ASUNTO_INVALIDO"
      );
    }


    if (
      typeof html !==
        "string" ||
      !html
    ) {

      throw new Error(
        "EMAIL_CONTENIDO_INVALIDO"
      );
    }


    if (
      !process.env.SENDGRID_API_KEY ||
      !process.env.SENDGRID_SENDER
    ) {

      console.error(
        "Configuración de SendGrid incompleta."
      );


      throw new Error(
        "EMAIL_CONFIG_ERROR"
      );
    }


    const msg = {

      to:
        to.trim(),

      from: {

        email:
          process.env
            .SENDGRID_SENDER,

        name:
          "Sistema de Monitoreo Bioinfeccioso",
      },

      subject:
        subject.trim(),

      html,
    };


    try {

      await sgMail.send(
        msg
      );


      return {
        success: true,
      };


    } catch (
      error
    ) {

      console.error(
        "Error enviando correo:",
        error
          ?.response
          ?.body ||
        error.message
      );


      throw new Error(
        "EMAIL_SEND_FAILED"
      );
    }
  };