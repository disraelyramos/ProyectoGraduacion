const {
  verificarTokenJwt,
  validarYRenovarSesion,
  validarSesionSinRenovar,
  cerrarSesionPorToken,
} = require(
  "../services/Auth/Sesion.service"
);


/* =========================================================
   OBTENER TOKEN BEARER
   ========================================================= */

function obtenerBearerToken(req) {

  const authorization = String(
    req.headers?.authorization || ""
  ).trim();


  const match = authorization.match(
    /^Bearer\s+(.+)$/i
  );


  if (!match) {
    return null;
  }


  return String(
    match[1] || ""
  ).trim() || null;
}


/* =========================================================
   CERRAR SESIÓN SEGURA
   ========================================================= */

async function cerrarSesionSegura(token) {

  try {

    await cerrarSesionPorToken(
      token
    );

  } catch (error) {

    console.error(
      "No fue posible cerrar la sesión:",
      error.message
    );

  }
}


/* =========================================================
   CREAR MIDDLEWARE DE AUTENTICACIÓN

   renovarSesion = true:
     Verifica y renueva la inactividad.

   renovarSesion = false:
     Verifica sin renovar la inactividad.

   Ambos mantienen:
     - Verificación JWT.
     - Validación contra PostgreSQL.
     - Consistencia del usuario.
     - req.user.
   ========================================================= */

function crearMiddleware({
  renovarSesion = true,
} = {}) {

  return async (req, res, next) => {

    // ==================================================
    // 1. OBTENER TOKEN
    // ==================================================

    const token =
      obtenerBearerToken(req);


    if (!token) {

      return res.status(401).json({

        message:
          "Token de autenticación requerido.",

      });

    }


    // ==================================================
    // 2. VERIFICAR JWT
    // ==================================================

    let decoded;


    try {

      decoded =
        verificarTokenJwt(token);

    } catch (error) {

      if (
        error?.name ===
        "TokenExpiredError"
      ) {

        await cerrarSesionSegura(
          token
        );


        return res.status(401).json({

          message:
            "La sesión alcanzó su tiempo máximo. Inicie sesión nuevamente.",

        });

      }


      return res.status(401).json({

        message:
          "Token de autenticación inválido.",

      });

    }


    // ==================================================
    // 3. VALIDAR SESIÓN
    // ==================================================

    let sesion;


    try {

      sesion = renovarSesion

        ? await validarYRenovarSesion(
            token
          )

        : await validarSesionSinRenovar(
            token
          );


    } catch (error) {

      console.error(
        "Error verificando sesión:",
        error.message
      );


      return res.status(500).json({

        message:
          "Error al validar la sesión.",

      });

    }


    if (!sesion) {

      return res.status(401).json({

        message:
          "Sesión expirada por inactividad o cerrada.",

      });

    }


    // ==================================================
    // 4. CONSISTENCIA JWT Y POSTGRESQL
    // ==================================================

    const usuarioJwt =
      Number(
        decoded?.id_usuario
      );


    const usuarioSesion =
      Number(
        sesion?.id_usuario
      );


    if (
      !Number.isSafeInteger(usuarioJwt) ||
      usuarioJwt <= 0 ||

      !Number.isSafeInteger(usuarioSesion) ||
      usuarioSesion <= 0 ||

      usuarioJwt !== usuarioSesion
    ) {

      await cerrarSesionSegura(
        token
      );


      return res.status(401).json({

        message:
          "La sesión no es válida.",

      });

    }


    // ==================================================
    // 5. IDENTIDAD DEL USUARIO
    // ==================================================

    req.user = {

      id_usuario:
        usuarioSesion,

      usuario:
        decoded.usuario,

      nombre:
        decoded.nombre,

      rol_id:
        decoded.rol_id,

      rol:
        decoded.rol,

    };


    return next();

  };

}


/* =========================================================
   EXPORTACIONES

   Uso normal:
     authenticateToken

   Uso sin renovación:
     authenticateToken.sinRenovar
   ========================================================= */

const authenticateToken =
  crearMiddleware({

    renovarSesion: true,

  });


authenticateToken.sinRenovar =
  crearMiddleware({

    renovarSesion: false,

  });


module.exports =
  authenticateToken;