const pool =
  require(
    "../../config/db"
  );

const crypto =
  require(
    "crypto"
  );

const bcrypt =
  require(
    "bcrypt"
  );

const {
  enviarCorreo,
} =
  require(
    "../email.service"
  );

const {
  validarSolicitudRecuperacion,
  validarRestablecimiento,
} =
  require(
    "./Recuperacion.validator"
  );


/* =========================================================
   CONFIGURACIÓN
   ========================================================= */

const RESET_TOKEN_MINUTES =
  Number(
    process.env.RECUPERACION_TOKEN_MINUTES
  );


if (
  !Number.isInteger(
    RESET_TOKEN_MINUTES
  ) ||
  RESET_TOKEN_MINUTES <= 0
) {

  throw new Error(
    "RECUPERACION_TOKEN_MINUTES no está configurado correctamente."
  );
}


/* =========================================================
   ERROR DE SERVICIO
   ========================================================= */

class RecuperacionServiceError
  extends Error {

  constructor(
    message,
    code,
    status = 500
  ) {

    super(
      message
    );

    this.name =
      "RecuperacionServiceError";

    this.code =
      code;

    this.status =
      status;

    this.isOperational =
      true;
  }
}


/* =========================================================
   ESCAPAR HTML
   ========================================================= */

function escaparHtml(
  value
) {

  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


/* =========================================================
   GENERAR TOKEN
   ========================================================= */

function generarToken() {

  return crypto
    .randomBytes(
      32
    )
    .toString(
      "hex"
    );
}


/* =========================================================
   HASH DEL TOKEN

   El token real únicamente se envía por correo.

   PostgreSQL guarda solamente SHA-256(token).
   ========================================================= */

function hashToken(
  token
) {

  return crypto
    .createHash(
      "sha256"
    )
    .update(
      token,
      "utf8"
    )
    .digest(
      "hex"
    );
}


/* =========================================================
   URL DEL FRONTEND
   ========================================================= */

function obtenerFrontendUrl() {

  const frontendUrl =
    process.env
      .FRONTEND_URL;


  if (
    typeof frontendUrl !==
      "string" ||
    !frontendUrl.trim()
  ) {

    throw new RecuperacionServiceError(
      "La configuración del sistema está incompleta.",
      "FRONTEND_URL_NO_CONFIGURADA",
      500
    );
  }


  const normalizada =
    frontendUrl
      .trim()
      .replace(
        /\/+$/,
        ""
      );


  try {

    const url =
      new URL(
        normalizada
      );


    if (
      url.protocol !==
        "http:" &&
      url.protocol !==
        "https:"
    ) {

      throw new Error(
        "PROTOCOLO_INVALIDO"
      );
    }


  } catch {

    throw new RecuperacionServiceError(
      "La configuración del sistema está incompleta.",
      "FRONTEND_URL_INVALIDA",
      500
    );
  }


  return normalizada;
}


/* =========================================================
   CONSTRUIR LINK
   ========================================================= */

function construirResetLink(
  token
) {

  const frontendUrl =
    obtenerFrontendUrl();


  return (
    `${frontendUrl}/reset-password/${token}`
  );
}


/* =========================================================
   SOLICITAR RECUPERACIÓN
   ========================================================= */

async function solicitarRecuperacion(
  body
) {

  /*
   * El backend valida nuevamente.
   *
   * Nunca se confía en:
   * - validaciones del frontend
   * - tipo de cuenta indicado por frontend
   * - existencia indicada por frontend
   */

  const {
    identificador,
  } =
    validarSolicitudRecuperacion(
      body
    );


  /* =======================================================
     DETERMINAR TIPO DE IDENTIFICADOR

     Esto lo decide el backend.
     ======================================================= */

  const esCorreo =
    identificador.includes(
      "@"
    );


  /* =======================================================
     BUSCAR CUENTA
     ======================================================= */

  let query;

  let values;


  if (
    esCorreo
  ) {

    query = `
      SELECT
        id_usuario,
        usuario,
        correo

      FROM usuarios

      WHERE LOWER(correo) =
            LOWER($1)

      LIMIT 1
    `;


    values = [
      identificador,
    ];


  } else {

    query = `
      SELECT
        id_usuario,
        usuario,
        correo

      FROM usuarios

      WHERE usuario = $1

      LIMIT 1
    `;


    values = [
      identificador,
    ];
  }


  let result;


  try {

    result =
      await pool.query(
        query,
        values
      );


  } catch (
    error
  ) {

    console.error(
      "Error consultando usuario para recuperación:",
      error
    );


    throw new RecuperacionServiceError(
      "No fue posible consultar la cuenta en este momento. Intente nuevamente.",
      "ERROR_CONSULTANDO_CUENTA",
      500
    );
  }


  /* =======================================================
     CUENTA NO ENCONTRADA

     El mensaje depende de lo que realmente se buscó.
     ======================================================= */

  if (
    result.rows.length ===
    0
  ) {

    if (
      esCorreo
    ) {

      throw new RecuperacionServiceError(
        "Correo no encontrado.",
        "CORREO_NO_ENCONTRADO",
        404
      );
    }


    throw new RecuperacionServiceError(
      "Usuario no encontrado.",
      "USUARIO_NO_ENCONTRADO",
      404
    );
  }


  const user =
    result.rows[0];


  /* =======================================================
     VALIDAR CORREO REGISTRADO

     Incluso si la búsqueda fue por usuario,
     el backend comprueba que realmente exista correo
     para poder enviar la recuperación.
     ======================================================= */

  if (
    typeof user.correo !==
      "string" ||
    !user.correo.trim()
  ) {

    console.error(
      `Usuario ${user.id_usuario} sin correo válido para recuperación.`
    );


    throw new RecuperacionServiceError(
      "La cuenta no tiene un correo registrado para recuperación. Contacte al administrador.",
      "USUARIO_SIN_CORREO",
      400
    );
  }


  /* =======================================================
     GENERAR TOKEN
     ======================================================= */

  const token =
    generarToken();


  const tokenHash =
    hashToken(
      token
    );


  const expira =
    new Date(
      Date.now() +
      (
        RESET_TOKEN_MINUTES *
        60 *
        1000
      )
    );


  const link =
    construirResetLink(
      token
    );


  /* =======================================================
     GUARDAR TOKEN

     Una nueva solicitud invalida tokens anteriores.
     ======================================================= */

  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    await client.query(
      `
        UPDATE reset_password_tokens

        SET usado = TRUE

        WHERE id_usuario = $1

          AND COALESCE(
            usado,
            FALSE
          ) = FALSE
      `,
      [
        user.id_usuario,
      ]
    );


    await client.query(
      `
        INSERT INTO reset_password_tokens
        (
          id_usuario,
          token,
          expira,
          usado
        )

        VALUES
        (
          $1,
          $2,
          $3,
          FALSE
        )
      `,
      [
        user.id_usuario,
        tokenHash,
        expira,
      ]
    );


    await client.query(
      "COMMIT"
    );


  } catch (
    error
  ) {

    try {

      await client.query(
        "ROLLBACK"
      );


    } catch (
      rollbackError
    ) {

      console.error(
        "Error ejecutando rollback de recuperación:",
        rollbackError
      );
    }


    console.error(
      "Error guardando token de recuperación:",
      error
    );


    throw new RecuperacionServiceError(
      "No fue posible generar la solicitud de recuperación. Intente nuevamente.",
      "TOKEN_NO_GUARDADO",
      500
    );


  } finally {

    client.release();
  }


  /* =======================================================
     PREPARAR CORREO
     ======================================================= */

  const usuarioSeguro =
    escaparHtml(
      user.usuario
    );


  const linkSeguro =
    escaparHtml(
      link
    );


  /* =======================================================
     ENVIAR CORREO

     IMPORTANTE:

     El sistema NO responde éxito antes de que
     enviarCorreo() termine correctamente.
     ======================================================= */

  try {

    await enviarCorreo(

      user.correo,

      "Recuperación de contraseña",

      `
        <h2>
          Sistema de Monitoreo Bioinfeccioso
        </h2>

        <p>
          Hola
          <strong>${usuarioSeguro}</strong>,
          se recibió una solicitud para restablecer
          la contraseña de la cuenta.
        </p>

        <p>
          Para continuar, utilice el siguiente enlace:
        </p>

        <p>
          <a href="${linkSeguro}">
            Restablecer contraseña
          </a>
        </p>

        <p>
          Este enlace expirará en
          ${RESET_TOKEN_MINUTES} minutos
          y solamente podrá utilizarse una vez.
        </p>

        <p>
          Si no solicitó este cambio,
          puede ignorar este correo.
        </p>
      `
    );


  } catch (
    error
  ) {

    console.error(
      "Error enviando correo de recuperación:",
      error
    );


    /* =====================================================
       EL CORREO FALLÓ

       El token recién generado queda inutilizable.
       ===================================================== */

    try {

      await pool.query(
        `
          UPDATE reset_password_tokens

          SET usado = TRUE

          WHERE token = $1
        `,
        [
          tokenHash,
        ]
      );


    } catch (
      invalidateError
    ) {

      console.error(
        "Error invalidando token tras fallo de correo:",
        invalidateError
      );
    }


    throw new RecuperacionServiceError(
      "El servicio de correo no está disponible en este momento. Intente nuevamente más tarde.",
      "SERVICIO_CORREO_NO_DISPONIBLE",
      503
    );
  }


  /* =======================================================
     ÉXITO REAL

     Llegar aquí significa:

     1. La cuenta existe.
     2. Tiene correo.
     3. Se creó el token.
     4. Se guardó su hash.
     5. SendGrid terminó correctamente.
     ======================================================= */

  return {
    message:
      "Se ha enviado un enlace de recuperación al correo registrado.",
  };
}


/* =========================================================
   RESTABLECER CONTRASEÑA
   ========================================================= */

async function restablecerContrasena(
  body
) {

  const {
    token,
    nuevaContrasena,
  } =
    validarRestablecimiento(
      body
    );


  /*
   * El token recibido nunca se compara directamente
   * contra PostgreSQL.
   */

  const tokenHash =
    hashToken(
      token
    );


  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    /* =====================================================
       OBTENER Y BLOQUEAR TOKEN
       ===================================================== */

    const result =
      await client.query(
        `
          SELECT
            t.id,
            t.id_usuario,
            t.expira,
            t.usado,

            u.usuario,
            u.password_hash

          FROM reset_password_tokens t

          INNER JOIN usuarios u
            ON u.id_usuario =
               t.id_usuario

          WHERE t.token = $1

          LIMIT 1

          FOR UPDATE
        `,
        [
          tokenHash,
        ]
      );


    if (
      result.rows.length ===
      0
    ) {

      throw new RecuperacionServiceError(
        "El enlace de recuperación no es válido.",
        "TOKEN_NO_ENCONTRADO",
        400
      );
    }


    const tokenData =
      result.rows[0];


    /* =====================================================
       TOKEN YA USADO
       ===================================================== */

    if (
      tokenData.usado ===
      true
    ) {

      throw new RecuperacionServiceError(
        "El enlace de recuperación ya fue utilizado.",
        "TOKEN_YA_USADO",
        400
      );
    }


    /* =====================================================
       TOKEN EXPIRADO
       ===================================================== */

    const fechaExpiracion =
      new Date(
        tokenData.expira
      );


    if (
      !Number.isFinite(
        fechaExpiracion.getTime()
      ) ||
      fechaExpiracion.getTime() <=
        Date.now()
    ) {

      throw new RecuperacionServiceError(
        "El enlace de recuperación ha expirado.",
        "TOKEN_EXPIRADO",
        400
      );
    }


    /* =====================================================
       VALIDAR HASH ACTUAL
       ===================================================== */

    if (
      typeof tokenData.password_hash !==
        "string" ||
      !tokenData.password_hash
    ) {

      throw new RecuperacionServiceError(
        "No fue posible validar la contraseña actual.",
        "PASSWORD_HASH_INVALIDO",
        500
      );
    }


    /* =====================================================
       NO PERMITIR CONTRASEÑA ACTUAL
       ===================================================== */

    const mismaContrasena =
      await bcrypt.compare(
        nuevaContrasena,
        tokenData.password_hash
      );


    if (
      mismaContrasena
    ) {

      throw new RecuperacionServiceError(
        "La nueva contraseña no puede ser igual a la contraseña actual.",
        "PASSWORD_REUTILIZADA_ACTUAL",
        400
      );
    }


    /* =====================================================
       HISTORIAL - ÚLTIMAS 5
       ===================================================== */

    const {
      rows:
        historialRows,
    } =
      await client.query(
        `
          SELECT
            password_hash

          FROM historial_passwords

          WHERE id_usuario = $1

          ORDER BY
            fecha_cambio DESC,
            id DESC

          LIMIT 5
        `,
        [
          tokenData.id_usuario,
        ]
      );


    for (
      const historial
      of historialRows
    ) {

      if (
        typeof historial.password_hash !==
          "string" ||
        !historial.password_hash
      ) {

        continue;
      }


      const coincide =
        await bcrypt.compare(
          nuevaContrasena,
          historial.password_hash
        );


      if (
        coincide
      ) {

        throw new RecuperacionServiceError(
          "La nueva contraseña no puede coincidir con las últimas 5 contraseñas anteriores.",
          "PASSWORD_REUTILIZADA_HISTORIAL",
          400
        );
      }
    }


    /* =====================================================
       CREAR NUEVO HASH
       ===================================================== */

    const salt =
      await bcrypt.genSalt(
        10
      );


    const nuevoHash =
      await bcrypt.hash(
        nuevaContrasena,
        salt
      );


    /* =====================================================
       GUARDAR CONTRASEÑA ANTERIOR
       ===================================================== */

    await client.query(
      `
        INSERT INTO historial_passwords
        (
          id_usuario,
          password_hash,
          fecha_cambio
        )

        VALUES
        (
          $1,
          $2,
          NOW()
        )
      `,
      [
        tokenData.id_usuario,
        tokenData.password_hash,
      ]
    );


    /* =====================================================
       ACTUALIZAR USUARIO
       ===================================================== */

    const updateUsuario =
      await client.query(
        `
          UPDATE usuarios

          SET
            password_hash = $1,
            fecha_ultimo_cambio = NOW(),
            debe_cambiar_password = FALSE

          WHERE id_usuario = $2
        `,
        [
          nuevoHash,
          tokenData.id_usuario,
        ]
      );


    if (
      updateUsuario.rowCount !==
      1
    ) {

      throw new RecuperacionServiceError(
        "No fue posible actualizar la contraseña.",
        "USUARIO_NO_ACTUALIZADO",
        500
      );
    }


    /* =====================================================
       INVALIDAR TODOS LOS TOKENS DE RECUPERACIÓN
       ===================================================== */

    await client.query(
      `
        UPDATE reset_password_tokens

        SET usado = TRUE

        WHERE id_usuario = $1

          AND COALESCE(
            usado,
            FALSE
          ) = FALSE
      `,
      [
        tokenData.id_usuario,
      ]
    );


    /* =====================================================
       COMMIT
       ===================================================== */

    await client.query(
      "COMMIT"
    );


    return {
      message:
        "Contraseña restablecida con éxito.",
    };


  } catch (
    error
  ) {

    try {

      await client.query(
        "ROLLBACK"
      );


    } catch (
      rollbackError
    ) {

      console.error(
        "Error ejecutando rollback de contraseña:",
        rollbackError
      );
    }


    throw error;


  } finally {

    client.release();
  }
}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

module.exports = {
  solicitarRecuperacion,
  restablecerContrasena,
};
