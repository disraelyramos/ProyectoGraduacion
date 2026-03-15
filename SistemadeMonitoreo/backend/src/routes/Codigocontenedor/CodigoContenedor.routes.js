// backend/src/routes/Codigocontenedor/CodigoContenedor.routes.js
const express = require("express");
const router = express.Router();

const authMiddleware = require("../../middlewares/auth.middleware");
const controller = require("../../controllers/Codigocontenedor/CodigoContenedor.controller");

// Listado para Select (con búsqueda opcional y paginado)
router.get("/", authMiddleware, controller.listar);

module.exports = router;
