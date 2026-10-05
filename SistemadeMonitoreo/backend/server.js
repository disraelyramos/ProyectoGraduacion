const express = require("express");
const cors = require("cors");

require("dotenv").config();


// ======================================================
// SERVICIOS AUTOMÁTICOS
// ======================================================

const nivelMonitor = require(
  "./src/services/controlDSH/mediciones/NivelMonitor.service"
);

const alertasProgramadasMonitor = require(
  "./src/services/alertasProgramadas/AlertasProgramadasMonitor.service"
);

const sesionesLimpieza = require(
  "./src/services/Auth/SesionesLimpieza.service"
);

const resumenRecoleccionRoutes = require(
  "./src/routes/dashboard/ResumenRecoleccion.routes"
);






const origenesPermitidos = String(
  process.env.CORS_ALLOWED_ORIGINS || ""
)
  .split(",")
  .map(
    (origen) =>
      origen.trim().replace(/\/+$/, "")
  )
  .filter(Boolean);


if (origenesPermitidos.length === 0) {
  throw new Error(
    "Falta configurar CORS_ALLOWED_ORIGINS en el entorno del backend."
  );
}


// ======================================================
// CREAR APLICACIÓN
// ======================================================

const app = express();


// ======================================================
// CORS
// ======================================================

app.use(
  cors({
    origin: (origin, callback) => {

      // Permitir solicitudes sin Origin:
      // ESP8266 y herramientas de backend.

      if (!origin) {
        return callback(null, true);
      }

      const permitido =
        origenesPermitidos.includes(origin);

      return callback(null, permitido);
    },
  })
);


// ======================================================
// JSON
// ======================================================

app.use(express.json());


// ======================================================
// SANITIZACIÓN XSS
// ======================================================

const sanitize = require(
  "./src/middlewares/sanitize"
);

app.use(sanitize);


// ======================================================
// IMPORTAR RUTAS
// ======================================================

const authRoutes = require(
  "./src/routes/auth.routes"
);

const menuRoutes = require(
  "./src/routes/menu.routes"
);

const perfilRoutes = require(
  "./src/routes/perfil.routes"
);

const ubicacionRoutes = require(
  "./src/routes/ubicacion.routes"
);

const tipoResiduoRoutes = require(
  "./src/routes/tipoResiduo.routes"
);

const estadoContenedorRoutes = require(
  "./src/routes/estadoContenedor.routes"
);

const contenedorRoutes = require(
  "./src/routes/contenedor.routes"
);

const recuperacionRoutes = require(
  "./src/routes/recuperacion.routes"
);

const historialRecoleccionRoutes = require(
  "./src/routes/HistorialRecoleccion/HistorialdeRecoleccion.routes"
);

const historialCostoRoutes = require(
  "./src/routes/historialcosto/HistorialCosto.routes"
);

const codigoContenedorRoutes = require(
  "./src/routes/Codigocontenedor/CodigoContenedor.routes"
);

const graficasRecoleccionRoutes = require(
  "./src/routes/graficasderecoleccion/GraficasRecoleccion.routes"
);

const administracionRoutes = require(
  "./src/routes/administracion.routes"
);

const permisosRoutes = require(
  "./src/routes/permisos.routes"
);
// ======================================================
// RUTAS GENERALES
// ======================================================

app.use(
  "/api/auth",
  authRoutes
);

app.use(
  "/api/menu",
  menuRoutes
);

app.use(
  "/api/perfil",
  perfilRoutes
);

app.use(
  "/api/ubicaciones",
  ubicacionRoutes
);

app.use(
  "/api/tipos-residuo",
  tipoResiduoRoutes
);

app.use(
  "/api/estados-contenedor",
  estadoContenedorRoutes
);

app.use(
  "/api/contenedores",
  contenedorRoutes
);

app.use(
  "/api/recuperacion",
  recuperacionRoutes
);

app.use(
  "/api/dashboard/resumen-recoleccion",
  resumenRecoleccionRoutes
);


// ======================================================
// CONTROL DSH
// ======================================================

app.use(
  "/api/control-dsh/registro-pesaje",
  require(
    "./src/routes/controlDSH/RegistroPesaje.routes"
  )
);

app.use(
  "/api/control-dsh/modulo-peso",
  require(
    "./src/routes/controlDSH/ModuloPeso.routes"
  )
);

app.use(
  "/api/control-dsh/catalogos",
  require(
    "./src/routes/controlDSH/DisEmpresa.routes"
  )
);


// ======================================================
// CONFIGURACIÓN DE ALERTAS
// ======================================================

app.use(
  "/api/configuracion-alertas",
  require(
    "./src/routes/configuracionAlertas/ConfiguracionAlertas.routes"
  )
);


// ======================================================
// ALERTAS PROGRAMADAS
// ======================================================

app.use(
  "/api/alertas-programadas",
  require(
    "./src/routes/alertasProgramadas/AlertasProgramadas.routes"
  )
);


// ======================================================
// HISTORIALES Y GRÁFICAS
// ======================================================

app.use(
  "/api/historial-recoleccion",
  historialRecoleccionRoutes
);

app.use(
  "/api/historial-costo",
  historialCostoRoutes
);

app.use(
  "/api/codigo-contenedor",
  codigoContenedorRoutes
);

app.use(
  "/api/graficas-recoleccion",
  graficasRecoleccionRoutes
);

app.use(
  "/api/administracion",
  administracionRoutes
);

app.use(
  "/api/permisos",
  permisosRoutes
);

// ======================================================
// RUTA PROTEGIDA DE PRUEBA
// ======================================================

const authMiddleware = require(
  "./src/middlewares/auth.middleware"
);

app.get(
  "/api/protegida",
  authMiddleware,
  (req, res) => {

    res.json({
      message:
        `Hola ${req.user.id_usuario}, tienes acceso`,
    });

  }
);


// ======================================================
// RUTA RAÍZ
// ======================================================

app.get(
  "/",
  (req, res) => {

    res.send(
      "API funcionando"
    );

  }
);


// ======================================================
// INICIALIZAR SERVIDOR
// ======================================================

const PORT =
  process.env.PORT || 3001;


app.listen(
  PORT,
  async () => {

    console.log(
      `Servidor en puerto ${PORT}`
    );


    // ==================================================
    // 1. MONITOR DE NIVELES
    // ==================================================

    try {

      await nivelMonitor.iniciarMonitor();

      console.log(
        "Monitor de nivel iniciado correctamente."
      );

    } catch (error) {

      console.error(
        "No fue posible iniciar el monitor de nivel:",
        error.message
      );

    }


    // ==================================================
    // 2. MONITOR DE ALERTAS PROGRAMADAS
    // ==================================================

    try {

      await alertasProgramadasMonitor
        .iniciarMonitor();

      console.log(
        "Monitor de alertas programadas iniciado correctamente."
      );

    } catch (error) {

      console.error(
        "No fue posible iniciar el monitor de alertas programadas:",
        error.message
      );

    }



    try {

      await sesionesLimpieza
        .iniciarLimpieza();

      console.log(
        "Servicio de limpieza de sesiones iniciado correctamente."
      );

    } catch (error) {

      console.error(
        "No fue posible iniciar la limpieza de sesiones:",
        error.message
      );

    }

  }
);