const express = require(
  "express"
);

const router = express.Router();

const authenticateToken = require(
  "../../middlewares/auth.middleware"
);

const configuracionAlertasController = require(
  "../../controllers/configuracionAlertas/ConfiguracionAlertas.controller"
);


// ======================================================
// CONSULTAR CONFIGURACIÓN ACTUAL
// ======================================================
//
// Devuelve los porcentajes guardados en PostgreSQL.
// Requiere una sesión válida.
// ======================================================

router.get(
  "/",
  authenticateToken,
  configuracionAlertasController.obtenerConfiguracion
);


// ======================================================
// ACTUALIZAR CONFIGURACIÓN
// ======================================================
//
// El Service verifica:
//
// - Usuario activo y autorizado.
// - Porcentajes permitidos.
// - Primer umbral menor que segundo.
// - Identidad del usuario autenticado.
//
// No se recibe actualizado_por desde el frontend.
// ======================================================

router.put(
  "/",
  authenticateToken,
  configuracionAlertasController.actualizarConfiguracion
);


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = router;