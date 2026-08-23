// backend/routes/controlDSH/RegistroPesaje.routes.js

const express = require("express");

const router = express.Router();

const authMiddleware = require(
  "../../middlewares/auth.middleware"
);

const controller = require(
  "../../controllers/controlDSH/RegistroPesaje.controller"
);


// ======================================================
// FOTO 1
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
// FOTO 2
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
// FOTO 3
// ======================================================

router.post(
  "/calculo",
  authMiddleware,
  controller.guardarCalculo
);


// ======================================================
// FOTO 4
// ======================================================

// Datos iniciales de Foto 4
router.get(
  "/recoleccion/datos",
  authMiddleware,
  controller.obtenerDatosRecoleccion
);


// Preview de porcentajes
router.post(
  "/recoleccion/preview",
  authMiddleware,
  controller.previewPendiente
);


// Guardar recolección
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


module.exports = router;