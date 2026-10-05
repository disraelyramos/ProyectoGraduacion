const express = require(
  "express"
);

const router =
  express.Router();

const authMiddleware = require(
  "../middlewares/auth.middleware"
);

const permisosController = require(
  "../controllers/Modulo/permisos.controller"
);


// ======================================================
// CATÁLOGO DE ROLES, MÓDULOS Y SUBMÓDULOS
// ======================================================

router.get(
  "/catalogo",
  authMiddleware,
  permisosController.getCatalogo
);


// ======================================================
// PERMISOS ACTUALES DE UN ROL
// ======================================================

router.get(
  "/rol/:id",
  authMiddleware,
  permisosController.getPermisosRol
);


// ======================================================
// ACTUALIZAR PERMISOS DE UN ROL
// ======================================================

router.put(
  "/rol/:id",
  authMiddleware,
  permisosController.updatePermisosRol
);


module.exports =
  router;