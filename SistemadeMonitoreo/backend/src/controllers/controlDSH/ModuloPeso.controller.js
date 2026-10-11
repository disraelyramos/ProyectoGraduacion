const moduloPesoService = require(
  "../../services/controlDSH/mediciones/ModuloPesoComunicacion.service"
);


// ======================================================
// ERROR
// ======================================================

function responderError(
  res,
  error,
  contexto
) {

  if (
    Number.isInteger(
      error?.statusCode
    )
  ) {

    return res
      .status(
        error.statusCode
      )
      .json({

        message:
          error.message,

        codigo:
          error.codigo,
      });
  }


  console.error(
    `Error ${contexto}:`,
    error
  );


  return res
    .status(500)
    .json({
      message:
        "Error interno del servidor",
    });
}


// ======================================================
// OBTENER SOLICITUD PENDIENTE
// ======================================================
//
// El ESP8266 consulta esta ruta para saber si existe
// una solicitud activa de pesaje.
//
// ======================================================

exports.obtenerPendiente =
  async (
    req,
    res
  ) => {

    try {

      const resultado =
        await moduloPesoService
          .obtenerSolicitudPendiente({

            moduloCodigo:
              req.modulo
                .codigo,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderError(
        res,
        error,
        "obtenerPendiente"
      );
    }
  };


// ======================================================
// ACTUALIZAR ESTADO DEL MODULO
// ======================================================
//
// Estados esperados:
//
// MIDIENDO
// ESTABILIZANDO
// MOVIMIENTO_DETECTADO
// ERROR
//
// ESPERANDO_RETIRO ya no forma parte
// del flujo normal.
//
// ======================================================

exports.actualizarEstado =
  async (
    req,
    res
  ) => {

    try {

      const resultado =
        await moduloPesoService
          .actualizarEstado({

            moduloCodigo:
              req.modulo
                .codigo,

            solicitudId:
              req.params
                .solicitudId,

            estado:
              req.body
                ?.estado,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderError(
        res,
        error,
        "actualizarEstado"
      );
    }
  };


// ======================================================
// COMPLETAR MEDICION
// ======================================================
//
// peso_lb representa la DIFERENCIA de peso
// detectada por el ESP8266 respecto al peso
// anteriormente confirmado del mismo contenedor.
//
// Ejemplo:
//
// Peso anterior: 5.20 lb
// Peso actual:   7.85 lb
//
// peso_lb enviado:
// 2.65 lb
//
// ======================================================

exports.completarMedicion =
  async (
    req,
    res
  ) => {

    try {

      const pesoLb =
        Number(
          req.body
            ?.peso_lb
        );


      if (
        !Number.isFinite(
          pesoLb
        ) ||
        pesoLb < 0
      ) {

        return res
          .status(400)
          .json({
            message:
              "peso_lb debe ser un valor numérico válido mayor o igual a cero.",
            codigo:
              "PESO_INVALIDO",
          });
      }


      const resultado =
        await moduloPesoService
          .completarMedicion({

            moduloCodigo:
              req.modulo
                .codigo,

            solicitudId:
              req.params
                .solicitudId,

            pesoLb,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderError(
        res,
        error,
        "completarMedicion"
      );
    }
  };