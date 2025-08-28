const express = require("express");
const router = express.Router();
const { 
  createContenedor, 
  getContenedores, 
  buscarContenedores,
  updateContenedor // ✅ importamos la nueva función
} = require("../controllers/contenedor.controller");
const authenticateToken = require("../middlewares/auth.middleware"); // middleware JWT

// 📌 Crear contenedor (protegido con JWT)
router.post("/", authenticateToken, createContenedor);

// 📌 Listar contenedores (también protegido con JWT)
router.get("/", authenticateToken, getContenedores);

// 📌 Buscar contenedores (por código o tipo de residuo)
router.get("/buscar", authenticateToken, buscarContenedores);

// 📌 Actualizar contenedor (protegido con JWT)
router.put("/:id", authenticateToken, updateContenedor);

module.exports = router;
