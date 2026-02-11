    // routes/controlDSH/DisEmpresa.routes.js
    const express = require("express");
    const router = express.Router();

    const authMiddleware = require("../../middlewares/auth.middleware");
    const controller = require("../../controllers/controlDSH/DisEmpresa.controller");

    // Catálogos para selects (protegidos)
    router.get("/distritos", authMiddleware, controller.getDistritos);
    router.get("/empresas", authMiddleware, controller.getEmpresasRecolectoras);

    module.exports = router;
