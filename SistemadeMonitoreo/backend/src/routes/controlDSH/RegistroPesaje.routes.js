"use strict";
const express = require("express");
const router = express.Router();
const authMiddleware = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/controlDSH/RegistroPesaje.controller");

router.post("/iniciar", authMiddleware, controller.iniciarProceso);
router.get("/proceso-activo", authMiddleware, controller.consultarProcesoActivo);
router.get("/costo-global", authMiddleware, controller.obtenerCostoGlobal);
router.post("/costo-global", authMiddleware, controller.guardarCostoGlobal);
router.post("/costo-global/confirmar", authMiddleware, controller.confirmarCostoGlobal);
router.post("/calculo", authMiddleware, controller.guardarCalculo);
router.get("/calculo/estado", authMiddleware, controller.consultarEstadoCalculo);
router.get("/calculo/historico", authMiddleware, controller.obtenerUltimoCalculoHistorico);
router.get("/recoleccion/datos", authMiddleware, controller.obtenerDatosRecoleccion);
router.post("/recoleccion/preview", authMiddleware, controller.previewPendiente);
router.post("/recoleccion", authMiddleware, controller.guardarRecoleccion);
router.post("/cancelar", authMiddleware, controller.cancelarProceso);
module.exports = router;
