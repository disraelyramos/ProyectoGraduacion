const express = require("express");

const router = express.Router();

const menuController = require(
  "../controllers/Modulo/menu.controller"
);

const authMiddleware = require(
  "../middlewares/auth.middleware"
);


// ======================================================
// MENÚ DEL USUARIO AUTENTICADO
// ======================================================

router.get(
  "/",
  authMiddleware,
  menuController.getMenu
);


module.exports = router;