const express = require("express");

const router = express.Router();

const authMiddleware = require(
  "../../middlewares/auth.middleware"
);

const controller = require(
  "../../controllers/dashboard/ResumenRecoleccion.controller"
);

router.use(authMiddleware);

router.get(
  "/",
  controller.obtenerResumen
);

module.exports = router;