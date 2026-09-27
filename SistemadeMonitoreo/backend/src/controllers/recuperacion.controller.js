const RecuperacionService =
  require(
    "../services/Auth/Recuperacion.service"
  );


/* =========================================================
   MANEJO DE ERRORES
   ========================================================= */

function manejarError(
  error,
  res,
  contexto
) {

  const status =
    Number.isInteger(
      error?.status
    )
      ? error.status
      : 500;


  /*
   * Errores esperados:
   * validaciones, token vencido,
   * contraseña reutilizada, etc.
   */

  if (
    error?.isOperational ===
    true
  ) {

    return res
      .status(status)
      .json({
        message:
          error.message,
        codigo:
          error.code ||
          "RECUPERACION_ERROR",
      });
  }


  /*
   * Error inesperado.
   * No se envían detalles internos al frontend.
   */

  console.error(
    contexto,
    error
  );


  return res
    .status(500)
    .json({
      message:
        "Ocurrió un error al procesar la solicitud.",
      codigo:
        "ERROR_INTERNO",
    });
}


/* =========================================================
   SOLICITAR RECUPERACIÓN
   ========================================================= */

exports.solicitarRecuperacion =
  async (
    req,
    res
  ) => {

    try {

      const resultado =
        await RecuperacionService
          .solicitarRecuperacion(
            req.body
          );


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (
      error
    ) {

      return manejarError(
        error,
        res,
        "Error en solicitarRecuperacion:"
      );
    }
  };


/* =========================================================
   RESTABLECER CONTRASEÑA
   ========================================================= */

exports.restablecerContrasena =
  async (
    req,
    res
  ) => {

    try {

      const resultado =
        await RecuperacionService
          .restablecerContrasena(
            req.body
          );


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (
      error
    ) {

      return manejarError(
        error,
        res,
        "Error en restablecerContrasena:"
      );
    }
  };