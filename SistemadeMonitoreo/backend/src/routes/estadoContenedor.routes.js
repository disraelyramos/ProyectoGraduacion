const express = require("express");
const router = express.Router();
const estadoController = require("../controllers/estadoContenedor.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Solo lectura
router.get("/", authMiddleware, estadoController.getEstadosContenedor);

module.exports = router;
