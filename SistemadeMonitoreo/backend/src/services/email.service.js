const sgMail = require("@sendgrid/mail");

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.enviarCorreo = async (to, subject, html) => {
  try {
    const msg = {
      to,
      from: {
        email: process.env.SENDGRID_SENDER,
        name: "Sistema de Monitoreo Bioinfeccioso"
      },
      subject,
      html,
    };

    await sgMail.send(msg);
    return { success: true, message: "Correo enviado correctamente" };
  } catch (error) {
    console.error("❌ Error enviando correo:", error.response?.body || error.message);
    return { success: false, message: "No se pudo enviar el correo" };
  }
};
