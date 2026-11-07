
"use strict";

// ======================================================
// IMPORTACIONES
// ======================================================

const express = require("express");

const router = express.Router();

const authMiddleware = require(
  "../../middlewares/auth.middleware"
);

const controller = require(
  "../../controllers/controlDSH/RegistroPesaje.controller"
);

// ======================================================
// FOTO 1 - INICIAR PROCESO
// ======================================================

router.post(
  "/iniciar",
  authMiddleware,
  controller.iniciarProceso
);

router.get(
  "/proceso-activo",
  authMiddleware,
  controller.consultarProcesoActivo
);

// ======================================================
// FOTO 2 - COSTOS
// ======================================================

router.get(
  "/costo-global",
  authMiddleware,
  controller.obtenerCostoGlobal
);

router.post(
  "/costo-global",
  authMiddleware,
  controller.guardarCostoGlobal
);

router.post(
  "/costo-global/confirmar",
  authMiddleware,
  controller.confirmarCostoGlobal
);

// ======================================================
// FOTO 3 - PESAJE REAL DEL MÓDULO HX711
// ======================================================

// Inicia la medición física y realiza el cálculo.
router.post(
  "/calculo",
  authMiddleware,
  controller.guardarCalculo
);

// Consulta el estado de la solicitud de pesaje.
router.get(
  "/calculo/estado",
  authMiddleware,
  controller.consultarEstadoCalculo
);

// ======================================================
// FOTO 3 - CONSULTA HISTÓRICA DE PESO
// ======================================================
//
// Solo lectura:
// - No activa el HX711.
// - No crea solicitudes de pesaje.
// - No calcula costos.
// - No confirma recolecciones.
// - No modifica registros.
//
// Ejemplo:
// GET /ultimo-peso/1
// ======================================================

router.get(
  "/ultimo-peso/:contenedorId",
  authMiddleware,
  controller.consultarUltimoPesoHistorico
);

// ======================================================
// FOTO 4 - RECOLECCIÓN
// ======================================================

// Consultar datos de recolección.
router.get(
  "/recoleccion/datos",
  authMiddleware,
  controller.obtenerDatosRecoleccion
);

// Previsualizar porcentajes de recolección.
router.post(
  "/recoleccion/preview",
  authMiddleware,
  controller.previewPendiente
);

// Registrar recolección.
router.post(
  "/recoleccion",
  authMiddleware,
  controller.guardarRecoleccion
);

// ======================================================
// CANCELAR PROCESO
// ======================================================

router.post(
  "/cancelar",
  authMiddleware,
  controller.cancelarProceso
);

// ======================================================
// EXPORTAR RUTAS
// ======================================================

module.exports = router;
