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
// OBTENER SOLICITUD
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
// ACTUALIZAR ESTADO
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
// COMPLETAR
// ======================================================

exports.completarMedicion =
  async (
    req,
    res
  ) => {

    try {

      const resultado =
        await moduloPesoService
          .completarMedicion({

            moduloCodigo:
              req.modulo
                .codigo,

            solicitudId:
              req.params
                .solicitudId,

            pesoLb:
              req.body
                ?.peso_lb,
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