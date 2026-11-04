// backend/src/routes/graficasderecoleccion/GraficasRecoleccion.routes.js

const express = require("express");

const router = express.Router();

// ======================================================
// AUTENTICACIÓN
// ======================================================

const authenticateToken = require(
  "../../middlewares/auth.middleware"
);

// ======================================================
// CONTROLADORES
// ======================================================

const {
  getGraficasRecoleccionCuatrimestral,
  getAniosDisponibles,
  exportarPdf,
  exportarExcel,
} = require(
  "../../controllers/graficasderecoleccion/GraficasRecoleccion.controller"
);

// ======================================================
// CONSULTAR AÑOS DISPONIBLES
//
// GET /api/graficas-recoleccion/anios-disponibles
//
// Consulta los años desde PostgreSQL.
// No permite años futuros.
// Requiere autenticación.
// ======================================================

router.get(
  "/anios-disponibles",
  authenticateToken,
  getAniosDisponibles
);

// ======================================================
// CONSULTAR GRÁFICAS CUATRIMESTRALES
//
// GET /api/graficas-recoleccion/cuatrimestral
// ======================================================

router.get(
  "/cuatrimestral",
  authenticateToken,
  getGraficasRecoleccionCuatrimestral
);

// ======================================================
// EXPORTAR PDF
//
// GET /api/graficas-recoleccion/cuatrimestral/export/pdf
// ======================================================

router.get(
  "/cuatrimestral/export/pdf",
  authenticateToken,
  exportarPdf
);

// ======================================================
// EXPORTAR EXCEL
//
// GET /api/graficas-recoleccion/cuatrimestral/export/excel
// ======================================================

router.get(
  "/cuatrimestral/export/excel",
  authenticateToken,
  exportarExcel
);

// ======================================================
// EXPORTAR ROUTER
// ======================================================

module.exports = router;