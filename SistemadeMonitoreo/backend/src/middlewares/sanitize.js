const xss =
  require(
    "xss"
  );


/* =========================================================
   CAMPOS OPACOS / SENSIBLES

   No deben modificarse.

   Sus validaciones corresponden al backend específico
   que los utiliza.
   ========================================================= */

const CAMPOS_SENSIBLES =
  new Set([
    "password",
    "password_hash",

    "contrasena",
    "contraseña",

    "actual",
    "nueva",
    "confirmar",

    "nuevaContrasena",
    "confirmarContrasena",

    "token",
    "accessToken",
    "refreshToken",
  ]);


/* =========================================================
   CAMPO SENSIBLE
   ========================================================= */

function esCampoSensible(
  key
) {

  if (
    typeof key !==
    "string"
  ) {
    return false;
  }


  if (
    CAMPOS_SENSIBLES.has(
      key
    )
  ) {
    return true;
  }


  const normalizado =
    key.toLowerCase();


  return (
    normalizado.includes(
      "password"
    ) ||
    normalizado.includes(
      "contrasena"
    ) ||
    normalizado.includes(
      "contraseña"
    ) ||
    normalizado.includes(
      "token"
    ) ||
    normalizado.includes(
      "secret"
    )
  );
}


/* =========================================================
   SANITIZAR RECURSIVAMENTE
   ========================================================= */

function sanitizarValor(
  value,
  key = ""
) {

  if (
    value === null ||
    value === undefined
  ) {

    return value;
  }


  /* =======================================================
     CAMPOS SENSIBLES

     NO trim()
     NO xss()
     ======================================================= */

  if (
    esCampoSensible(
      key
    )
  ) {

    return value;
  }


  /* STRING */

  if (
    typeof value ===
    "string"
  ) {

    return xss(
      value.trim()
    );
  }


  /* ARRAY */

  if (
    Array.isArray(
      value
    )
  ) {

    return value.map(
      (item) =>
        sanitizarValor(
          item
        )
    );
  }


  /* OBJETO */

  if (
    typeof value ===
    "object"
  ) {

    const resultado =
      {};


    for (
      const [
        childKey,
        childValue,
      ]
      of Object.entries(
        value
      )
    ) {

      resultado[
        childKey
      ] =
        sanitizarValor(
          childValue,
          childKey
        );
    }


    return resultado;
  }


  return value;
}


/* =========================================================
   MIDDLEWARE
   ========================================================= */

module.exports =
  (
    req,
    res,
    next
  ) => {

    if (
      req.body &&
      typeof req.body ===
        "object"
    ) {

      req.body =
        sanitizarValor(
          req.body
        );
    }


    next();
  };