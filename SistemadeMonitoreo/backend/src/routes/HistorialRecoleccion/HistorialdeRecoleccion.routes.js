// backend/src/routes/HistorialRecoleccion/HistorialdeRecoleccion.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/HistorialRecoleccion/HistorialdeRecoleccion.controller");

// Historial de Recolección (protegido, solo lectura)
router.get("/", authMiddleware, controller.obtenerHistorial);

module.exports = router;
