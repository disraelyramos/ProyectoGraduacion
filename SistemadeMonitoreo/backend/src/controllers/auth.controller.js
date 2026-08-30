const {
  login,
  logout,
  cambiarPasswordObligatorio,
  reconfirmarPassword,
} = require(
  "../services/Auth/Auth.service"
);


/* =========================================================
   BEARER TOKEN
   ========================================================= */

function obtenerBearerToken(req) {
  const authorization =
    req.headers?.authorization;


  if (!authorization) {
    return null;
  }


  const partes =
    authorization.split(" ");


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


  if (status >= 500) {
    console.error(
      contexto,
      error
    );
  }


  return res
    .status(status)
    .json(
      error?.publicData ||
      {
        message:
          status >= 500
            ? "Error en el servidor."
            : error.message,
      }
    );
}


/* =========================================================
   LOGIN
   ========================================================= */

exports.login =
  async (req, res) => {

    try {

      const resultado =
        await login({
          usuario:
            req.body?.usuario,

          contrasena:
            req.body?.contrasena,
        });


      return res.json(
        resultado
      );


    } catch (error) {

      return responderError(
        res,
        error,
        "Error en login:"
      );

    }
  };


/* =========================================================
   LOGOUT
   ========================================================= */

exports.logout =
  async (req, res) => {

    try {

      const token =
        obtenerBearerToken(req);


      if (!token) {
        return res
          .status(400)
          .json({
            message:
              "Authorization Bearer requerido.",
          });
      }


      const resultado =
        await logout({
          token,
        });


      return res.json(
        resultado
      );


    } catch (error) {

      return responderError(
        res,
        error,
        "Error en logout:"
      );

    }
  };


/* =========================================================
   CAMBIO OBLIGATORIO
   ========================================================= */

exports.cambiarPasswordObligatorio =
  async (req, res) => {

    try {

      const resultado =
        await cambiarPasswordObligatorio({
          usuario:
            req.body?.usuario,

          nueva:
            req.body?.nueva,
        });


      return res.json(
        resultado
      );


    } catch (error) {

      return responderError(
        res,
        error,
        "Error cambio obligatorio:"
      );

    }
  };


/* =========================================================
   RECONFIRMACIÓN
   ========================================================= */

exports.reconfirmarPassword =
  async (req, res) => {

    try {

      const resultado =
        await reconfirmarPassword({
          usuario:
            req.body?.usuario,

          actual:
            req.body?.actual,

          nueva:
            req.body?.nueva,
        });


      return res.json(
        resultado
      );


    } catch (error) {

      return responderError(
        res,
        error,
        "Error reconfirmación:"
      );

    }
  };