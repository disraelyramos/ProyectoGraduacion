const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware.js');

router.post('/login', authController.login);
router.post('/logout', authMiddleware, authController.logout);

//Cambio obligatorio de contraseña
router.post(
  '/cambiar-password-obligatorio',
  authMiddleware,
  authController.cambiarPasswordObligatorio
);

router.post('/reconfirmar-password', authMiddleware, authController.reconfirmarPassword);


module.exports = router;
