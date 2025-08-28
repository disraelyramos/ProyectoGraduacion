const express = require("express");
const router = express.Router();
const tipoResiduoController = require("../controllers/tipoResiduo.controller");
const authMiddleware = require("../middlewares/auth.middleware");

// Solo lectura
router.get("/", authMiddleware, tipoResiduoController.getTiposResiduo);

module.exports = router;
