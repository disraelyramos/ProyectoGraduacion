const express = require("express");

const router = express.Router();

const verifyToken = require(
  "../middlewares/auth.middleware"
);

const administracionController = require(
  "../controllers/administracion.controller"
);


// ======================================================
// CATÁLOGOS DE ADMINISTRACIÓN
// ======================================================

router.get(
  "/catalogos",
  verifyToken,
  async (req, res, next) => {
    try {
      await administracionController.getCatalogos(
        req,
        res,
        next
      );
    } catch (error) {
      next(error);
    }
  }
);


// ======================================================
// CREAR USUARIO
// ======================================================

router.post(
  "/usuarios",
  verifyToken,
  async (req, res, next) => {
    try {
      await administracionController.crearUsuario(
        req,
        res,
        next
      );
    } catch (error) {
      next(error);
    }
  }
);

router.get(
  "/usuarios",
  verifyToken,
  async (req, res, next) => {
    try {
      await administracionController.getUsuarios(
        req,
        res,
        next
      );
    } catch (error) {
      next(error);
    }
  }
);


router.put(
  "/usuarios/:id",
  verifyToken,
  async (req, res, next) => {
    try {
      await administracionController.editarUsuario(
        req,
        res,
        next
      );
    } catch (error) {
      next(error);
    }
  }
);

router.patch(
  "/usuarios/:id/estado",
  verifyToken,
  async (req, res, next) => {
    try {

      await administracionController
        .cambiarEstadoUsuario(
          req,
          res,
          next
        );

    } catch (error) {

      next(error);
    }
  }
);

router.delete(
  "/usuarios/:id",
  verifyToken,
  async (req, res, next) => {
    try {

      await administracionController
        .eliminarUsuario(
          req,
          res,
          next
        );

    } catch (error) {

      next(error);
    }
  }
);
module.exports = router;