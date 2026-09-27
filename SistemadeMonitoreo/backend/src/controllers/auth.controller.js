const {
  login,
  logout,
  cambiarPasswordObligatorio,
  reconfirmarPassword,
} = require(
  "../services/Auth/Auth.service"
);


/* =========================================================
   OBTENER BEARER TOKEN
   ========================================================= */

function obtenerBearerToken(
  req
) {

  const authorization =
    req.headers?.authorization;


  if (
    typeof authorization !==
      "string" ||
    !authorization
  ) {

    return null;
  }


  const partes =
    authorization
      .trim()
      .split(/\s+/);


  if (
    partes.length !== 2 ||
    partes[0] !== "Bearer" ||
    !partes[1]
  ) {

    return null;
  }


  return partes[1];
}


/* =========================================================
   OBTENER ID DEL USUARIO AUTENTICADO

   IMPORTANTE:
   Este dato viene de authMiddleware después de validar
   el JWT.

   NO se obtiene desde req.body.
   ========================================================= */

function obtenerUsuarioIdAutenticado(
  req
) {

  const id =
    Number(
      req.user?.id_usuario
    );


  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {

    return null;
  }


  return id;
}


/* =========================================================
   RESPUESTA DE ERROR
   ========================================================= */

function responderError(
  res,
  error,
  contexto
) {

  const status =
    Number.isInteger(
      error?.statusCode
    )
      ? error.statusCode
      : 500;


  /*
   * Los errores internos se registran
   * únicamente en backend.
   */

  if (
    status >= 500
  ) {

    console.error(
      contexto,
      error
    );
  }


  /*
   * Si AuthError ya contiene una respuesta pública,
   * se respeta.
   */

  if (
    error?.publicData
  ) {

    return res
      .status(status)
      .json(
        error.publicData
      );
  }


  return res
    .status(status)
    .json({
      message:
        status >= 500
          ? "Error en el servidor."
          : (
              error?.message ||
              "No fue posible procesar la solicitud."
            ),
    });
}


/* =========================================================
   LOGIN

   Endpoint público.

   El frontend envía usuario y contraseña, pero el Service
   es quien valida realmente los datos y las credenciales.
   ========================================================= */

exports.login =
  async (
    req,
    res
  ) => {

    try {

      const resultado =
        await login({

          usuario:
            req.body?.usuario,

          contrasena:
            req.body?.contrasena,
        });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (
      error
    ) {

      return responderError(
        res,
        error,
        "Error en login:"
      );
    }
  };


/* =========================================================
   LOGOUT

   Ruta protegida por authMiddleware.

   El token se obtiene del header Authorization.
   ========================================================= */

exports.logout =
  async (
    req,
    res
  ) => {

    try {

      const token =
        obtenerBearerToken(
          req
        );


      if (!token) {

        return res
          .status(401)
          .json({
            message:
              "Sesión no válida.",
          });
      }


      const resultado =
        await logout({
          token,
        });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (
      error
    ) {

      return responderError(
        res,
        error,
        "Error en logout:"
      );
    }
  };


/* =========================================================
   CAMBIO OBLIGATORIO DE CONTRASEÑA

   Ruta protegida por authMiddleware.

   IMPORTANTE:
   La identidad se obtiene únicamente de:

   req.user.id_usuario

   El frontend NO decide qué usuario se modifica.
   ========================================================= */

exports.cambiarPasswordObligatorio =
  async (
    req,
    res
  ) => {

    try {

      const usuarioId =
        obtenerUsuarioIdAutenticado(
          req
        );


      if (!usuarioId) {

        return res
          .status(401)
          .json({
            message:
              "Sesión no válida. Inicie sesión nuevamente.",
          });
      }


      /*
       * Solo se envía al Service:
       *
       * - usuarioId obtenido del JWT validado
       * - nueva contraseña recibida
       *
       * NO usuario del frontend.
       */

      const resultado =
        await cambiarPasswordObligatorio({

          usuarioId,

          nueva:
            req.body?.nueva,
        });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (
      error
    ) {

      return responderError(
        res,
        error,
        "Error cambio obligatorio:"
      );
    }
  };


/* =========================================================
   RECONFIRMACIÓN POR VENCIMIENTO

   Ruta protegida por authMiddleware.

   La identidad se obtiene únicamente desde el JWT.

   El frontend únicamente proporciona:
   - contraseña actual
   - contraseña nueva
   ========================================================= */

exports.reconfirmarPassword =
  async (
    req,
    res
  ) => {

    try {

      const usuarioId =
        obtenerUsuarioIdAutenticado(
          req
        );


      if (!usuarioId) {

        return res
          .status(401)
          .json({
            message:
              "Sesión no válida. Inicie sesión nuevamente.",
          });
      }


      const resultado =
        await reconfirmarPassword({

          usuarioId,

          actual:
            req.body?.actual,

          nueva:
            req.body?.nueva,
        });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (
      error
    ) {

      return responderError(
        res,
        error,
        "Error reconfirmación:"
      );
    }
  };