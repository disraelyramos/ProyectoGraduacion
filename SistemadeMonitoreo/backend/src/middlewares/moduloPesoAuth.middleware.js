const crypto = require("crypto");


// ======================================================
// MODULOS PERMITIDOS
// ======================================================

const MODULOS = {

  PESO_PUNZOCORTANTE:
    "MODULO_PESO_PUNZOCORTANTE_TOKEN",

  PESO_BIOINFECCIOSO:
    "MODULO_PESO_BIOINFECCIOSO_TOKEN",
};


// ======================================================
// COMPARACION SEGURA
// ======================================================

function compararSeguro(
  recibido,
  esperado
) {

  const bufferRecibido =
    Buffer.from(
      String(recibido || "")
    );


  const bufferEsperado =
    Buffer.from(
      String(esperado || "")
    );


  if (
    bufferRecibido.length !==
    bufferEsperado.length
  ) {

    return false;
  }


  return crypto.timingSafeEqual(
    bufferRecibido,
    bufferEsperado
  );
}


// ======================================================
// AUTENTICACION DEL MODULO
// ======================================================

module.exports = (
  req,
  res,
  next
) => {

  const moduloCodigo =
    String(
      req.headers[
        "x-modulo-codigo"
      ] || ""
    )
      .trim()
      .toUpperCase();


  const tokenRecibido =
    String(
      req.headers[
        "x-modulo-token"
      ] || ""
    )
      .trim();


  // ====================================================
  // VALIDAR MODULO
  // ====================================================

  const variableToken =
    MODULOS[
      moduloCodigo
    ];


  if (!variableToken) {

    return res
      .status(401)
      .json({
        message:
          "Módulo no autorizado.",
      });
  }


  // ====================================================
  // TOKEN CONFIGURADO EN .ENV
  // ====================================================

  const tokenEsperado =
    String(
      process.env[
        variableToken
      ] || ""
    )
      .trim();


  if (!tokenEsperado) {

    console.error(
      `Falta configurar ${variableToken}`
    );


    return res
      .status(500)
      .json({
        message:
          "Módulo no configurado.",
      });
  }


  // ====================================================
  // VALIDAR TOKEN
  // ====================================================

  if (
    !tokenRecibido ||
    !compararSeguro(
      tokenRecibido,
      tokenEsperado
    )
  ) {

    return res
      .status(401)
      .json({
        message:
          "Credenciales del módulo no válidas.",
      });
  }


  // ====================================================
  // MODULO AUTENTICADO
  // ====================================================

  req.modulo = {

    codigo:
      moduloCodigo,
  };


  return next();
};