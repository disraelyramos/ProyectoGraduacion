const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

//  Middleware global para sanitizar entradas contra XSS
const sanitize = require('./src/middlewares/sanitize');
app.use(sanitize);

//  Importar rutas
const authRoutes = require('./src/routes/auth.routes');
const menuRoutes = require('./src/routes/menu.routes');
const perfilRoutes = require('./src/routes/perfil.routes'); // ✅ añadida

//  Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/perfil', perfilRoutes); 

//  Ruta protegida de prueba
const authMiddleware = require('./src/middlewares/auth.middleware');
app.get('/api/protegida', authMiddleware, (req, res) => {
  res.json({ message: `Hola ${req.user.id_usuario}, tienes acceso ` });
});

//  Ruta raíz
app.get('/', (req, res) => {
  res.send('API funcionando ');
});

//  Inicializar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(` Servidor en puerto ${PORT}`));
