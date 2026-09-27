


/* =========================================================
   CONSTANTES
   ========================================================= */

const IDENTIFICADOR_MAX_LENGTH =
  254;

const PASSWORD_MIN_LENGTH =
  8;

/*
 * bcrypt trabaja de forma segura hasta 72 bytes.
 * Se limita para evitar truncamientos ambiguos.
 */
const PASSWORD_MAX_BYTES =
  72;

const TOKEN_REGEX =
  /^[a-f0-9]{64}$/i;


/* =========================================================
   ERROR DE VALIDACIÓN
   ========================================================= */

class RecuperacionValidationError
  extends Error {

  constructor(
    message,
    code = "VALIDACION_ERROR",
    status = 400
  ) {

    super(
      message
    );

    this.name =
      "RecuperacionValidationError";

    this.code =
      code;

    this.status =
      status;

    this.isOperational =
      true;
  }
}


/* =========================================================
   VALIDAR OBJETO
   ========================================================= */

function validarObjetoBody(
  body
) {

  if (
    !body ||
    typeof body !== "object" ||
    Array.isArray(body)
  ) {

    throw new RecuperacionValidationError(
      "La solicitud enviada no es válida.",
      "BODY_INVALIDO"
    );
  }
}


/* =========================================================
   RECHAZAR CAMPOS NO PERMITIDOS
   ========================================================= */

function validarCamposPermitidos(
  body,
  permitidos
) {

  validarObjetoBody(
    body
  );


  const permitidosSet =
    new Set(
      permitidos
    );


  const extras =
    Object
      .keys(body)
      .filter(
        (key) =>
          !permitidosSet.has(
            key
          )
      );


  if (
    extras.length > 0
  ) {

    throw new RecuperacionValidationError(
      "La solicitud contiene datos no permitidos.",
      "CAMPOS_NO_PERMITIDOS"
    );
  }
}


/* =========================================================
   SOLICITAR RECUPERACIÓN
   ========================================================= */

function validarSolicitudRecuperacion(
  body
) {

  validarCamposPermitidos(
    body,
    [
      "identificador",
    ]
  );


  const {
    identificador,
  } =
    body;


  if (
    typeof identificador !==
    "string"
  ) {

    throw new RecuperacionValidationError(
      "Debe ingresar usuario o correo.",
      "IDENTIFICADOR_INVALIDO"
    );
  }


  const normalizado =
    identificador.trim();


  if (
    !normalizado
  ) {

    throw new RecuperacionValidationError(
      "Debe ingresar usuario o correo.",
      "IDENTIFICADOR_REQUERIDO"
    );
  }


  if (
    normalizado.length >
    IDENTIFICADOR_MAX_LENGTH
  ) {

    throw new RecuperacionValidationError(
      "El usuario o correo proporcionado no es válido.",
      "IDENTIFICADOR_DEMASIADO_LARGO"
    );
  }


  return {
    identificador:
      normalizado,
  };
}


/* =========================================================
   VALIDAR CONTRASEÑA
   ========================================================= */

function validarPassword(
  password
) {



  if (
    typeof password !==
    "string"
  ) {

    throw new RecuperacionValidationError(
      "La contraseña proporcionada no es válida.",
      "PASSWORD_INVALIDO"
    );
  }


  if (
    password.length <
    PASSWORD_MIN_LENGTH
  ) {

    throw new RecuperacionValidationError(
      "La contraseña debe contener al menos 8 caracteres.",
      "PASSWORD_LONGITUD_MINIMA"
    );
  }


  if (
    Buffer.byteLength(
      password,
      "utf8"
    ) >
    PASSWORD_MAX_BYTES
  ) {

    throw new RecuperacionValidationError(
      "La contraseña excede la longitud permitida.",
      "PASSWORD_DEMASIADO_LARGO"
    );
  }


  if (
    !/[A-Z]/.test(
      password
    )
  ) {

    throw new RecuperacionValidationError(
      "La contraseña debe contener al menos una letra mayúscula.",
      "PASSWORD_REQUIERE_MAYUSCULA"
    );
  }


  if (
    !/[a-z]/.test(
      password
    )
  ) {

    throw new RecuperacionValidationError(
      "La contraseña debe contener al menos una letra minúscula.",
      "PASSWORD_REQUIERE_MINUSCULA"
    );
  }


  if (
    !/\d/.test(
      password
    )
  ) {

    throw new RecuperacionValidationError(
      "La contraseña debe contener al menos un número.",
      "PASSWORD_REQUIERE_NUMERO"
    );
  }
}


/* =========================================================
   RESTABLECER CONTRASEÑA
   ========================================================= */

function validarRestablecimiento(
  body
) {

  validarCamposPermitidos(
    body,
    [
      "token",
      "nuevaContrasena",
      "confirmarContrasena",
    ]
  );


  const {
    token,
    nuevaContrasena,
    confirmarContrasena,
  } =
    body;


  /* TOKEN */

  if (
    typeof token !==
      "string" ||
    !TOKEN_REGEX.test(
      token
    )
  ) {

    throw new RecuperacionValidationError(
      "El enlace de recuperación no es válido.",
      "TOKEN_INVALIDO"
    );
  }


  /* CONTRASEÑAS */

  if (
    typeof nuevaContrasena !==
      "string" ||
    typeof confirmarContrasena !==
      "string"
  ) {

    throw new RecuperacionValidationError(
      "Los datos de contraseña no son válidos.",
      "PASSWORD_DATOS_INVALIDOS"
    );
  }


  if (
    nuevaContrasena !==
    confirmarContrasena
  ) {

    throw new RecuperacionValidationError(
      "Las contraseñas no coinciden.",
      "PASSWORD_NO_COINCIDE"
    );
  }


  validarPassword(
    nuevaContrasena
  );


  return {
    token,
    nuevaContrasena,
    confirmarContrasena,
  };
}


module.exports = {
  RecuperacionValidationError,
  validarSolicitudRecuperacion,
  validarRestablecimiento,
};