const express =
  require(
    "express"
  );

const router =
  express.Router();

const recCtrl =
  require(
    "../controllers/recuperacion.controller"
  );


/* =========================================================
   RECUPERACIÓN
   ========================================================= */

router.post(
  "/solicitar",
  recCtrl.solicitarRecuperacion
);


router.post(
  "/restablecer",
  recCtrl.restablecerContrasena
);


module.exports =
  router;