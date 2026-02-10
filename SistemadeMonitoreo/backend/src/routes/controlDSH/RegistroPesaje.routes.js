// backend/routes/controlDSH/RegistroPesaje.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/controlDSH/RegistroPesaje.controller");

// Foto 1
router.post("/iniciar", authMiddleware, controller.iniciarProceso);

// Foto 2 (GLOBAL)
router.get("/costo-global", authMiddleware, controller.obtenerCostoGlobal);
router.post("/costo-global", authMiddleware, controller.guardarCostoGlobal);

// Foto 3
router.post("/calculo", authMiddleware, controller.guardarCalculo);

// ✅ Preview (% pendiente en tiempo real, no guarda)
router.post("/recoleccion/preview", authMiddleware, controller.previewPendiente);

// Foto 4
router.post("/recoleccion", authMiddleware, controller.guardarRecoleccion);

// Cancelar
router.post("/cancelar", authMiddleware, controller.cancelarProceso);

module.exports = router;
