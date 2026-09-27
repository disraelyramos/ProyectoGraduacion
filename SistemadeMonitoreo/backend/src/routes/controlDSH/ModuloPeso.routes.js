const express =
  require("express");


const router =
  express.Router();


const moduloPesoAuth =
  require(
    "../../middlewares/moduloPesoAuth.middleware"
  );


const controller =
  require(
    "../../controllers/controlDSH/ModuloPeso.controller"
  );


// ======================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACION DEL MODULO
// ======================================================

router.use(
  moduloPesoAuth
);


// ======================================================
// BUSCAR SOLICITUD PENDIENTE
// ======================================================

router.get(
  "/pendiente",
  controller.obtenerPendiente
);


// ======================================================
// REPORTAR ESTADO
// ======================================================
//
// MIDIENDO
// ESTABILIZANDO
// MOVIMIENTO_DETECTADO
// ERROR
//
// ======================================================

router.post(
  "/:solicitudId/estado",
  controller.actualizarEstado
);


// ======================================================
// ENVIAR PESO FINAL
// ======================================================

router.post(
  "/:solicitudId/completar",
  controller.completarMedicion
);


module.exports =
  router;