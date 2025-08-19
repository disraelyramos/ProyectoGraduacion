// src/routes/perfil.routes.js
const express = require("express");
const router = express.Router();
const perfilController = require("../controllers/perfil.controller");

//  Middleware de autenticación (protege todas las rutas de este módulo)
const verifyToken = require("../middlewares/auth.middleware");

//  Obtener perfil del usuario autenticado
router.get("/", verifyToken, async (req, res, next) => {
  try {
    await perfilController.getPerfil(req, res);
  } catch (error) {
    next(error); // pasa el error al manejador global
  }
});

//  Actualizar perfil del usuario autenticado
router.put("/", verifyToken, async (req, res, next) => {
  try {
    await perfilController.updatePerfil(req, res);
  } catch (error) {
    next(error); // pasa el error al manejador global
  }
});

module.exports = router;
