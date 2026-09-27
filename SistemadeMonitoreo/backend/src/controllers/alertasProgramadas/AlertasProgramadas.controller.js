const alertasProgramadasService = require(
  "../../services/alertasProgramadas/AlertasProgramadas.service"
);


// ======================================================
// CREAR ALERTA PROGRAMADA
// ======================================================

exports.crearAlertaProgramada = async (req, res) => {

  try {

    const {
      motivo,
      fecha,
      hora,
    } = req.body || {};


    // ==================================================
    // GUARDAR MEDIANTE EL SERVICE
    // ==================================================
    //
    // El Service se encarga de:
    //
    // - Validar motivo, fecha y hora.
    // - Comprobar que el horario sea futuro.
    // - Interpretar la hora de Guatemala.
    // - Verificar los permisos del usuario.
    // - Registrar la alerta en PostgreSQL.
    //
    // creado_por se obtiene de la sesión,
    // nunca del frontend.
    // ==================================================

    const alerta =
      await alertasProgramadasService
        .crearAlertaProgramada({

          motivo,

          fecha,

          hora,

          usuarioId:
            req.user?.id_usuario,

        });


    // ==================================================
    // RESPUESTA EXITOSA
    // ==================================================

    return res.status(201).json({

      success: true,

      message:
        "Alerta programada guardada correctamente.",

      alerta,

    });


  } catch (error) {

    return responderError(
      res,
      error
    );

  }

};


// ======================================================
// MANEJO CENTRALIZADO DE ERRORES
// ======================================================

function responderError(
  res,
  error
) {

  // ====================================================
  // ERRORES CONTROLADOS POR EL SERVICE
  // ====================================================

  if (
    error instanceof
    alertasProgramadasService
      .AlertaProgramadaError
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


  // ====================================================
  // ERRORES INESPERADOS
  // ====================================================

  console.error(
    "Error creando alerta programada:",
    error
  );


  return res
    .status(500)
    .json({

      success: false,

      message:
        "No fue posible guardar la alerta programada. Intente nuevamente.",

      codigo:
        "ERROR_INTERNO",

    });

}