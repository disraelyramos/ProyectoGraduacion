
"use strict";

const prediccionService = require(
  "../../services/MachineLearning/prediccion.service"
);

const alertaPredictivaService = require(
  "../../services/MachineLearning/alertaPredictiva.service"
);

const {
  construirResumenPredicciones,
} = require(
  "../../services/MachineLearning/resumenPredicciones.service"
);


// ======================================================
// OBTENER PREDICCIONES
// ======================================================

async function obtenerPredicciones(req, res) {
  try {

    // Ejecutar Machine Learning una sola vez.
    const predicciones =
      await prediccionService.ejecutarPrediccion();

    // El backend selecciona la predicción
    // prioritaria para la KPI del Dashboard.
    const resultado =
      construirResumenPredicciones(predicciones);

    return res.status(200).json({
      ok: true,
      data: resultado,
    });

  } catch (error) {

    console.error(
      "ERROR PREDICCION ML:",
      error.message
    );

    return res.status(500).json({
      ok: false,
      mensaje:
        "No fue posible obtener la predicción de llenado.",
    });
  }
}


// ======================================================
// EVALUAR ALERTAS PREDICTIVAS
// ======================================================

async function evaluarAlertasPredictivas(req, res) {
  try {

    const resultado =
      await alertaPredictivaService.evaluarPredicciones();

    return res.status(200).json({
      ok: true,
      data: resultado,
    });

  } catch (error) {

    console.error(
      "ERROR ALERTA PREDICTIVA:",
      error.message
    );

    return res.status(500).json({
      ok: false,
      mensaje:
        "No fue posible evaluar las alertas predictivas.",
    });
  }
}


// ======================================================
// EXPORTAR
// ======================================================

module.exports = {
  obtenerPredicciones,
  evaluarAlertasPredictivas,
};
