const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menu.controller');
const authMiddleware = require('../middlewares/auth.middleware'); 

// GET /api/menu/:role_id (protegido con JWT)
router.get('/:role_id', authMiddleware, menuController.getMenuByRole);

module.exports = router;
