const express = require(
  "express"
);

const router =
  express.Router();


const authenticateToken =
  require(
    "../../middlewares/auth.middleware"
  );


const prediccionController =
  require(
    "../../controllers/MachineLearning/prediccion.controller"
  );


// ======================================================
// CONSULTAR PREDICCIONES
// ======================================================
//
// GET /api/predicciones
//
// No modifica BD.
// ======================================================

router.get(
  "/",
  authenticateToken,
  prediccionController
    .obtenerPredicciones
);


// ======================================================
// EVALUAR ALERTAS PREDICTIVAS
// ======================================================
//
// POST /api/predicciones/evaluar-alertas
//
// Ejecuta ML y crea PREDICTIVA
// únicamente cuando corresponda.
// ======================================================

router.post(
  "/evaluar-alertas",
  authenticateToken,
  prediccionController
    .evaluarAlertasPredictivas
);


// ======================================================
// EXPORTAR
// ======================================================

module.exports =
  router;