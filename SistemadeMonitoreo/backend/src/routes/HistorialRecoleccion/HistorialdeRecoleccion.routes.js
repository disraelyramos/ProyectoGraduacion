const express = require("express");

const router = express.Router();

const authMiddleware = require(
  "../../middlewares/auth.middleware"
);

const controller = require(
  "../../controllers/HistorialRecoleccion/HistorialdeRecoleccion.controller"
);


router.use(authMiddleware);


// Consulta paginada del historial
router.get(
  "/",
  controller.obtenerHistorial
);


// PDF
router.get(
  "/export/pdf",
  controller.exportarPdf
);


// Excel
router.get(
  "/export/excel",
  controller.exportarExcel
);


module.exports = router;