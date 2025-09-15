const express = require("express");
const router = express.Router();
const recCtrl = require("../controllers/recuperacion.controller");

// Endpoint para solicitar recuperación de contraseña
router.post("/solicitar", recCtrl.solicitarRecuperacion);

// Endpoint para restablecer contraseña
router.post("/restablecer", recCtrl.restablecerContrasena);

module.exports = router;
