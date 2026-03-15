const express = require("express");
const router = express.Router();

const authenticateToken = require("../../middlewares/auth.middleware");
const {
  getGraficasRecoleccionCuatrimestral,
} = require("../../controllers/graficasderecoleccion/GraficasRecoleccion.controller");

// Gráficas de recolección por cuatrimestre
router.get(
  "/cuatrimestral",
  authenticateToken,
  getGraficasRecoleccionCuatrimestral
);

module.exports = router;