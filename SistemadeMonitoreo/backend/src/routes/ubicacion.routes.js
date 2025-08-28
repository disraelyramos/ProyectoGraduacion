const express = require("express");
const router = express.Router();
const ubicacionController = require("../controllers/ubicacion.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Solo lectura
router.get("/", authMiddleware, ubicacionController.getUbicaciones);

module.exports = router;
