require("dotenv").config();


/* =========================================================
   OBTENER VARIABLE OBLIGATORIA
   ========================================================= */

function obtenerEnv(nombre) {
  const valor =
    String(
      process.env[nombre] ?? ""
    ).trim();

  if (!valor) {
    throw new Error(
      `[AUTH CONFIG] Falta ${nombre} en el archivo .env`
    );
  }

  return valor;
}


/* =========================================================
   ENTERO
   ========================================================= */

function obtenerEntero(
  nombre,
  {
    min = 0,
    max = Number.MAX_SAFE_INTEGER,
  } = {}
) {
  const texto =
    obtenerEnv(nombre);

  const valor =
    Number(texto);

  if (
    !Number.isSafeInteger(valor) ||
    valor < min ||
    valor > max
  ) {
    throw new Error(
      `[AUTH CONFIG] ${nombre} debe ser un entero entre ${min} y ${max}`
    );
  }

  return valor;
}



function obtenerBoolean(nombre) {
  const valor =
    obtenerEnv(nombre)
      .toLowerCase();

  if (
    valor !== "true" &&
    valor !== "false"
  ) {
    throw new Error(
      `[AUTH CONFIG] ${nombre} debe ser true o false`
    );
  }

  return valor === "true";
}


/* =========================================================
   CONFIGURACIÓN CENTRAL
   ========================================================= */

const authConfig =
  Object.freeze({

    jwtSecret:
      obtenerEnv(
        "JWT_SECRET"
      ),

    jwtExpiresIn:
      obtenerEnv(
        "JWT_EXPIRES_IN"
      ),


    loginMaxAttempts:
      obtenerEntero(
        "LOGIN_MAX_ATTEMPTS",
        {
          min: 1,
          max: 20,
        }
      ),

    loginBlockMinutes:
      obtenerEntero(
        "LOGIN_BLOCK_MINUTES",
        {
          min: 1,
          max: 1440,
        }
      ),


    sessionInactivityMin:
      obtenerEntero(
        "SESSION_INACTIVITY_MIN",
        {
          min: 1,
          max: 1440,
        }
      ),

    singleSessionPerUser:
      obtenerBoolean(
        "SINGLE_SESSION_PER_USER"
      ),


    passwordMaxAgeDays:
      obtenerEntero(
        "PASSWORD_MAX_AGE_DAYS",
        {
          min: 0,
          max: 3650,
        }
      ),

    passwordMaxAgeMinutes:
      obtenerEntero(
        "PASSWORD_MAX_AGE_MINUTES",
        {
          min: 0,
          max: 5256000,
        }
      ),

    passwordHistoryLimit:
      obtenerEntero(
        "PASSWORD_HISTORY_LIMIT",
        {
          min: 1,
          max: 50,
        }
      ),


    bcryptRounds:
      obtenerEntero(
        "BCRYPT_ROUNDS",
        {
          min: 4,
          max: 15,
        }
      ),

  });


module.exports =
  authConfig;