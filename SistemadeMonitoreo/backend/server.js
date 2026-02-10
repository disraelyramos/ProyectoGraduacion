const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

//  Middleware global para sanitizar entradas contra XSS
const sanitize = require('./src/middlewares/sanitize');
app.use(sanitize);

// Importar rutas
const authRoutes = require('./src/routes/auth.routes');
const menuRoutes = require('./src/routes/menu.routes');
const perfilRoutes = require('./src/routes/perfil.routes');

const ubicacionRoutes = require('./src/routes/ubicacion.routes');
const tipoResiduoRoutes = require('./src/routes/tipoResiduo.routes');
const estadoContenedorRoutes = require('./src/routes/estadoContenedor.routes');
const contenedorRoutes = require('./src/routes/contenedor.routes'); // 
const recuperacionRoutes = require('./src/routes/recuperacion.routes');

//  Usar rutas
app.use('/api/auth', authRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/perfil', perfilRoutes);

app.use('/api/ubicaciones', ubicacionRoutes);
app.use('/api/tipos-residuo', tipoResiduoRoutes);
app.use('/api/estados-contenedor', estadoContenedorRoutes);
app.use('/api/contenedores', contenedorRoutes); // 
app.use("/api/recuperacion", recuperacionRoutes);

app.use(
  "/api/control-dsh/registro-pesaje",
  require("./src/routes/controlDSH/RegistroPesaje.routes")
);

app.use(
  "/api/control-dsh/catalogos",
  require("./src/routes/controlDSH/DisEmpresa.routes")
);



//  Ruta protegida de prueba
const authMiddleware = require('./src/middlewares/auth.middleware');
app.get('/api/protegida', authMiddleware, (req, res) => {
  res.json({ message: `Hola ${req.user.id_usuario}, tienes acceso` });
});

// Ruta raíz
app.get('/', (req, res) => {
  res.send('API funcionando ');
});

// Inicializar servidor
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(` Servidor en puerto ${PORT}`));
