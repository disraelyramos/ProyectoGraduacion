const express = require(
  "express"
);

const router = express.Router();

const authenticateToken = require(
  "../../middlewares/auth.middleware"
);

const alertasProgramadasController = require(
  "../../controllers/alertasProgramadas/AlertasProgramadas.controller"
);


// ======================================================
// CREAR ALERTA PROGRAMADA
// ======================================================
//
// POST /api/alertas-programadas
//
// Requiere sesión válida.
//
// El Controller recibe:
// - motivo
// - fecha
// - hora
//
// El Service valida los datos, verifica permisos
// y registra la alerta como PENDIENTE.
// ======================================================

router.post(
  "/",
  authenticateToken,
  alertasProgramadasController.crearAlertaProgramada
);


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = router;