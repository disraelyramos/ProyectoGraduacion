const {
  verificarTokenJwt,
  validarYRenovarSesion,
  cerrarSesionPorToken,
} = require(
  "../services/Auth/Sesion.service"
);


/* =========================================================
   TOKEN BEARER

   El middleware únicamente extrae el token del request.

   La validación del JWT y la sesión pertenecen al Service.
   ========================================================= */

function obtenerBearerToken(req) {
  const authorization =
    String(
      req.headers?.authorization || ""
    ).trim();


  if (!authorization) {
    return null;
  }


  /*
    Acepta:

      Bearer TOKEN
      Bearer     TOKEN

    No distingue mayúsculas/minúsculas en "Bearer".
  */

  const match =
    authorization.match(
      /^Bearer\s+(.+)$/i
    );


  if (!match) {
    return null;
  }


  const token =
    String(
      match[1] || ""
    ).trim();


  return token || null;
}


/* =========================================================
   CERRAR SESIÓN DE FORMA SEGURA

   Se utiliza cuando el JWT llegó a su límite absoluto.

   Si la actualización en BD falla, no ocultamos
   el error original del JWT.
   ========================================================= */

async function cerrarSesionSegura(
  token
) {
  try {

    await cerrarSesionPorToken(
      token
    );

  } catch (error) {

    console.error(
      "No fue posible cerrar la sesión asociada al token:",
      error
    );

  }
}


/* =========================================================
   MIDDLEWARE DE AUTENTICACIÓN

   RESPONSABILIDAD:

   1. Obtener Bearer token.
   2. Verificar JWT mediante Sesion.service.
   3. Validar sesión en PostgreSQL.
   4. Renovar ventana de inactividad.
   5. Construir req.user.

   NO maneja:
   - SQL directamente.
   - SESSION_INACTIVITY_MIN.
   - JWT_SECRET.
   - JWT_EXPIRES_IN.
   - lógica de creación de sesiones.

   Esas responsabilidades pertenecen a:
   Sesion.service.js + auth.config.js + .env
   ========================================================= */

module.exports =
  async (req, res, next) => {

    /* =====================================================
       1. OBTENER TOKEN
       ===================================================== */

    const token =
      obtenerBearerToken(
        req
      );


    if (!token) {
      return res
        .status(401)
        .json({
          message:
            "Token de autenticación requerido.",
        });
    }


    /* =====================================================
       2. VERIFICAR JWT

       JWT_EXPIRES_IN representa el límite absoluto
       configurado desde .env.

       Ejemplo:
       JWT_EXPIRES_IN=12h
       ===================================================== */

    let decoded;


    try {

      decoded =
        verificarTokenJwt(
          token
        );


    } catch (error) {

      /* ---------------------------------------------------
         TOKEN VENCIDO POR LÍMITE ABSOLUTO
         --------------------------------------------------- */

      if (
        error?.name ===
        "TokenExpiredError"
      ) {

        await cerrarSesionSegura(
          token
        );


        return res
          .status(401)
          .json({
            message:
              "La sesión alcanzó su tiempo máximo. Inicie sesión nuevamente.",
          });
      }


      /* ---------------------------------------------------
         JWT MALFORMADO / FIRMA INVÁLIDA / ETC.
         --------------------------------------------------- */

      return res
        .status(401)
        .json({
          message:
            "Token de autenticación inválido.",
        });
    }


    /* =====================================================
       3. VALIDAR SESIÓN + RENOVAR INACTIVIDAD

       Sesion.service ejecuta una operación atómica:

         UPDATE sesiones
         SET fecha_expiracion = NOW() + ...
         WHERE token = ...
           AND activo = TRUE
           AND fecha_expiracion > NOW()

       Si devuelve null:
       - expiró por inactividad,
       - fue cerrada,
       - fue reemplazada por otra sesión,
       - o no existe.
       ===================================================== */

    let sesion;


    try {

      sesion =
        await validarYRenovarSesion(
          token
        );


    } catch (error) {

      console.error(
        "Error verificando la sesión en base de datos:",
        error
      );


      return res
        .status(500)
        .json({
          message:
            "Error al validar la sesión.",
        });
    }


    if (!sesion) {
      return res
        .status(401)
        .json({
          message:
            "Sesión expirada por inactividad o cerrada.",
        });
    }


    /* =====================================================
       4. VERIFICAR CONSISTENCIA JWT ↔ SESIÓN

       El id_usuario almacenado en PostgreSQL debe coincidir
       con el id_usuario firmado dentro del JWT.

       No confiamos únicamente en ninguno de los dos.
       ===================================================== */

    const usuarioJwt =
      Number(
        decoded?.id_usuario
      );


    const usuarioSesion =
      Number(
        sesion?.id_usuario
      );


    if (
      !Number.isSafeInteger(
        usuarioJwt
      ) ||
      usuarioJwt <= 0 ||
      !Number.isSafeInteger(
        usuarioSesion
      ) ||
      usuarioSesion <= 0 ||
      usuarioJwt !== usuarioSesion
    ) {

      await cerrarSesionSegura(
        token
      );


      return res
        .status(401)
        .json({
          message:
            "La sesión no es válida.",
        });
    }


    /* =====================================================
       5. IDENTIDAD DEL REQUEST

       Conservamos exactamente el contrato que utilizan
       actualmente los Controllers del sistema:

       req.user.id_usuario
       req.user.usuario
       req.user.nombre
       req.user.rol_id
       req.user.rol

       id_usuario se obtiene de la sesión de PostgreSQL.
       Los demás metadatos vienen del JWT firmado.
       ===================================================== */

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


    /* =====================================================
       6. CONTINUAR
       ===================================================== */

    return next();
  };