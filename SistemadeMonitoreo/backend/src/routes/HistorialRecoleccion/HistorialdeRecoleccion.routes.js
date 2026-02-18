const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/HistorialRecoleccion/HistorialdeRecoleccion.controller");

router.get("/", authMiddleware, controller.obtenerHistorial);

// Export (un solo archivo que incluye ambas tablas)
router.get("/export/pdf", authMiddleware, controller.exportarPdf);
router.get("/export/excel", authMiddleware, controller.exportarExcel);

router.get("/export/pdf", authMiddleware, controller.exportarPdf);
router.get("/export/excel", authMiddleware, controller.exportarExcel);


module.exports = router;
