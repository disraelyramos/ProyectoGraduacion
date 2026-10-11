
const express = require(
  "express"
);

const router =
  express.Router();

const controller = require(
  "../../controllers/controlDSH/ModuloNivel.controller"
);

const moduloPesoAuth = require(
  "../../middlewares/moduloPesoAuth.middleware"
);

// ======================================================
// RECIBIR NIVEL DESDE EL ESP8266
// ======================================================
//
// POST
// /api/control-dsh/modulo-nivel
//
// El ESP envía únicamente:
//
// {
//   "porcentaje": 42.5
// }
//
// El backend determina:
// - módulo autenticado;
// - contenedor;
// - almacenamiento;
// - alertas.
//
// ======================================================

router.post(
  "/",
  moduloPesoAuth,
  controller.registrarNivel
);


// ======================================================
// EXPORTAR
// ======================================================

module.exports =
  router;