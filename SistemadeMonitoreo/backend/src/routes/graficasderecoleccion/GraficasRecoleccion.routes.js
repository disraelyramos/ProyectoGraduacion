// backend/src/routes/graficasderecoleccion/GraficasRecoleccion.routes.js

const express =
  require("express");


const router =
  express.Router();


const authenticateToken =
  require(
    "../../middlewares/auth.middleware"
  );


const {
  getGraficasRecoleccionCuatrimestral,
  exportarPdf,
  exportarExcel,
} = require(
  "../../controllers/graficasderecoleccion/GraficasRecoleccion.controller"
);


router.get(
  "/cuatrimestral",
  authenticateToken,
  getGraficasRecoleccionCuatrimestral
);


router.get(
  "/cuatrimestral/export/pdf",
  authenticateToken,
  exportarPdf
);



router.get(
  "/cuatrimestral/export/excel",
  authenticateToken,
  exportarExcel
);


module.exports =
  router;