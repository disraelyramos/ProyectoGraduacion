const express =
  require("express");


const router =
  express.Router();


const moduloPesoAuth =
  require(
    "../../middlewares/moduloPesoAuth.middleware"
  );


const controller =
  require(
    "../../controllers/controlDSH/ModuloPeso.controller"
  );


// ======================================================
// TODAS LAS RUTAS REQUIEREN AUTENTICACION DEL MODULO
// ======================================================

router.use(
  moduloPesoAuth
);


// ======================================================
// BUSCAR SOLICITUD PENDIENTE
// ======================================================
//
// El ESP8266 consulta esta ruta para saber si existe
// una solicitud de pesaje activa.
//
// ======================================================

router.get(
  "/pendiente",
  controller.obtenerPendiente
);


// ======================================================
// REPORTAR ESTADO DEL MODULO
// ======================================================
//
// Estados utilizados:
//
// MIDIENDO
// ESTABILIZANDO
// MOVIMIENTO_DETECTADO
// ERROR
//
// ESPERANDO_RETIRO ya no forma parte del flujo normal.
//
// El ESP8266 determina el estado.
// El frontend solamente lo presenta.
//
// ======================================================

router.post(
  "/:solicitudId/estado",
  controller.actualizarEstado
);


// ======================================================
// COMPLETAR MEDICION
// ======================================================
//
// Cuando el peso queda estable:
//
// 1. El ESP8266 calcula el peso actual de residuos.
// 2. Calcula la diferencia respecto al peso anterior
//    registrado localmente para ese contenedor.
// 3. Envia solamente esa diferencia en peso_lb.
// 4. NO es necesario retirar el contenedor.
// 5. Si el backend confirma correctamente, el ESP8266
//    actualiza su referencia local de peso.
//
// BODY:
//
// {
//   "peso_lb": 2.650
// }
//
// ======================================================

router.post(
  "/:solicitudId/completar",
  controller.completarMedicion
);


module.exports =
  router;