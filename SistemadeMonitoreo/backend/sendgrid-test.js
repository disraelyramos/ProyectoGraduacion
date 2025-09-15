const sgMail = require("@sendgrid/mail");
require("dotenv").config();

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const msg = {
  to: "christiandisraely@gmail.com", // 📩 te lo envías a ti mismo
  from: process.env.SENDGRID_SENDER, // tu correo verificado
  subject: "Prueba de SendGrid desde Sistema Tesis",
  text: "Este es un correo de prueba.",
  html: "<strong>¡Todo funcionando con SendGrid! 🎉</strong>",
};

sgMail
  .send(msg)
  .then(() => {
    console.log("✅ Correo enviado correctamente");
  })
  .catch((error) => {
    console.error("❌ Error enviando correo:", error.response?.body || error.message);
  });
