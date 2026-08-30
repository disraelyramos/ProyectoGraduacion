const jwt =
  require("jsonwebtoken");

const pool =
  require("../../config/db");

const authConfig =
  require("../../config/auth.config");

const {
  crearErrorHttp,
} = require("./AuthError");


/* =========================================================
   EJECUTOR SQL

   Permite utilizar:
   - pool
   - client de una transacción
   ========================================================= */

function obtenerDb(client) {
  return client || pool;
}


/* =========================================================
   TOKEN
   ========================================================= */

function normalizarToken(valor) {
  const token =
    String(valor || "")
      .trim();

  if (!token) {
    throw crearErrorHttp(
      401,
      "Token de sesión requerido."
    );
  }

  return token;
}


/* =========================================================
   USUARIO ID
   ========================================================= */

function normalizarUsuarioId(valor) {
  const id =
    Number(valor);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    throw crearErrorHttp(
      400,
      "Usuario inválido."
    );
  }

  return id;
}


/* =========================================================
   PAYLOAD JWT
   ========================================================= */

function crearPayloadUsuario(usuario) {
  return {
    id_usuario:
      usuario.id_usuario,

    usuario:
      usuario.usuario,

    nombre:
      usuario.nombre,

    rol_id:
      usuario.rol_id,

    rol:
      usuario.rol,
  };
}


/* =========================================================
   CREAR JWT

   JWT_EXPIRES_IN viene exclusivamente de .env.
   ========================================================= */

function generarTokenSesion(
  usuario
) {
  const payload =
    crearPayloadUsuario(
      usuario
    );

  return jwt.sign(
    payload,
    authConfig.jwtSecret,
    {
      expiresIn:
        authConfig.jwtExpiresIn,
    }
  );
}


/* =========================================================
   VERIFICAR JWT
   ========================================================= */

function verificarTokenJwt(token) {
  const tokenSeguro =
    normalizarToken(token);

  return jwt.verify(
    tokenSeguro,
    authConfig.jwtSecret
  );
}


/* =========================================================
   LIMPIAR SESIONES VENCIDAS

   No borra registros.

   Solo actualiza:
   activo = FALSE
   ========================================================= */

async function limpiarSesionesExpiradas({
  client = null,
} = {}) {
  const db =
    obtenerDb(client);

  const resultado =
    await db.query(`
      UPDATE sesiones

      SET activo = FALSE

      WHERE activo = TRUE
        AND fecha_expiracion <= NOW()
    `);

  return resultado.rowCount || 0;
}


/* =========================================================
   DESACTIVAR SESIONES DEL USUARIO
   ========================================================= */

async function desactivarSesionesUsuario({
  client = null,
  usuarioId,
}) {
  const db =
    obtenerDb(client);

  const usuarioSeguro =
    normalizarUsuarioId(
      usuarioId
    );

  const resultado =
    await db.query(
      `
        UPDATE sesiones

        SET activo = FALSE

        WHERE id_usuario = $1
          AND activo = TRUE
      `,
      [
        usuarioSeguro,
      ]
    );

  return resultado.rowCount || 0;
}


/* =========================================================
   CREAR SESIÓN

   Todas las formas de generar una sesión pasan por aquí:

   - login
   - cambio obligatorio
   - reconfirmación
   ========================================================= */

async function crearSesion({
  client = null,
  usuario,
}) {
  if (
    !usuario ||
    typeof usuario !== "object"
  ) {
    throw crearErrorHttp(
      400,
      "Datos de usuario inválidos para crear la sesión."
    );
  }


  const db =
    obtenerDb(client);

  const usuarioId =
    normalizarUsuarioId(
      usuario.id_usuario
    );


  /*
    Una sola sesión vigente por usuario,
    si la política .env así lo establece.
  */

  if (
    authConfig.singleSessionPerUser
  ) {
    await desactivarSesionesUsuario({
      client,
      usuarioId,
    });
  }


  const token =
    generarTokenSesion(
      usuario
    );


  await db.query(
    `
      INSERT INTO sesiones (
        id_usuario,
        token,
        fecha_inicio,
        fecha_expiracion,
        activo
      )

      VALUES (
        $1,
        $2,
        NOW(),
        NOW() + (
          $3::int *
          INTERVAL '1 minute'
        ),
        TRUE
      )
    `,
    [
      usuarioId,
      token,
      authConfig.sessionInactivityMin,
    ]
  );


  return token;
}


/* =========================================================
   VALIDAR Y RENOVAR POR INACTIVIDAD

   Operación atómica:

   Si la sesión:
   - existe
   - está activa
   - no venció

   entonces renueva fecha_expiracion.

   Así no manejamos fechas con el reloj de Node.
   PostgreSQL es la fuente del tiempo.
   ========================================================= */

async function validarYRenovarSesion(
  token
) {
  const tokenSeguro =
    normalizarToken(token);


  const { rows } =
    await pool.query(
      `
        UPDATE sesiones

        SET fecha_expiracion =
          NOW() + (
            $2::int *
            INTERVAL '1 minute'
          )

        WHERE token = $1
          AND activo = TRUE
          AND fecha_expiracion > NOW()

        RETURNING
          id,
          id_usuario,
          fecha_expiracion,
          activo
      `,
      [
        tokenSeguro,
        authConfig.sessionInactivityMin,
      ]
    );


  if (rows.length > 0) {
    return rows[0];
  }


  /*
    Si estaba vencida pero todavía figuraba TRUE,
    corregimos su estado.
  */

  await pool.query(
    `
      UPDATE sesiones

      SET activo = FALSE

      WHERE token = $1
        AND activo = TRUE
        AND fecha_expiracion <= NOW()
    `,
    [
      tokenSeguro,
    ]
  );


  return null;
}


/* =========================================================
   CERRAR SESIÓN

   Ya no DELETE.

   Conservamos el registro histórico.
   ========================================================= */

async function cerrarSesionPorToken(
  token
) {
  const tokenSeguro =
    normalizarToken(token);


  const resultado =
    await pool.query(
      `
        UPDATE sesiones

        SET activo = FALSE

        WHERE token = $1
          AND activo = TRUE
      `,
      [
        tokenSeguro,
      ]
    );


  return resultado.rowCount || 0;
}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

module.exports = {
  crearSesion,

  generarTokenSesion,
  verificarTokenJwt,

  validarYRenovarSesion,

  cerrarSesionPorToken,

  limpiarSesionesExpiradas,
  desactivarSesionesUsuario,
};