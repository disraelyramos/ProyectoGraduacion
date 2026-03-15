// backend/routes/historialcosto/HistorialCosto.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/historialcosto/HistorialCosto.controller");

// Reporte de Costos (KPIs + Resumen + Rankings + Detalle)
router.get("/", authMiddleware, controller.obtenerReporte);

// Export (2) descargar
router.get("/export/pdf", authMiddleware, controller.exportarPdf);
router.get("/export/excel", authMiddleware, controller.exportarExcel);

module.exports = router;
