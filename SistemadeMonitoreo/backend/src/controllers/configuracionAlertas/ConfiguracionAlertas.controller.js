const configuracionAlertasService = require(
  "../../services/configuracionAlertas/ConfiguracionAlertas.service"
);


// ======================================================
// OBTENER CONFIGURACIÓN DE ALERTAS
// ======================================================

exports.obtenerConfiguracion = async (req, res) => {

  try {

    const configuracion =
      await configuracionAlertasService
        .obtenerConfiguracion();


    return res.status(200).json({
      success: true,
      configuracion,
    });

  } catch (error) {

    return responderError(
      res,
      error,
      "obteniendo configuración de alertas"
    );
  }
};


// ======================================================
// ACTUALIZAR CONFIGURACIÓN DE ALERTAS
// ======================================================

exports.actualizarConfiguracion = async (req, res) => {

  try {

    const {
      primer_aviso_pct,
      segundo_aviso_pct,
    } = req.body || {};


    const configuracion =
      await configuracionAlertasService
        .actualizarConfiguracion({

          primerAvisoPct:
            primer_aviso_pct,

          segundoAvisoPct:
            segundo_aviso_pct,

          usuarioId:
            req.user?.id_usuario,

        });


    return res.status(200).json({

      success: true,

      message:
        "Configuración de alertas actualizada correctamente.",

      configuracion,

    });

  } catch (error) {

    return responderError(
      res,
      error,
      "actualizando configuración de alertas"
    );
  }
};


// ======================================================
// MANEJO CENTRALIZADO DE ERRORES DEL CONTROLLER
// ======================================================

function responderError(
  res,
  error,
  operacion
) {

  if (
    error instanceof
    configuracionAlertasService
      .ConfiguracionAlertasError
  ) {

    return res
      .status(error.statusCode)
      .json({

        success: false,

        message:
          error.message,

        codigo:
          error.codigo,

      });
  }


  console.error(
    `Error ${operacion}:`,
    error
  );


  return res
    .status(500)
    .json({

      success: false,

      message:
        "Error interno del servidor.",

      codigo:
        "ERROR_INTERNO",

    });
}