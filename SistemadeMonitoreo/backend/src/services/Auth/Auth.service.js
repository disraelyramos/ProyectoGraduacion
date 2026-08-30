const pool =
  require("../../config/db");

const bcrypt =
  require("bcrypt");

const xss =
  require("xss");

const authConfig =
  require("../../config/auth.config");

const {
  crearErrorHttp,
} = require("./AuthError");

const {
  crearSesion,
  cerrarSesionPorToken,
  limpiarSesionesExpiradas,
} = require("./Sesion.service");

const {
  passwordExpirada,
  validarPasswordNoRepetida,
  actualizarPassword,
} = require("./Password.service");


/* =========================================================
   NORMALIZAR USUARIO
   ========================================================= */

function normalizarUsuario(valor) {
  return typeof valor ===
    "string"
    ? xss(valor).trim()
    : "";
}


/* =========================================================
   NORMALIZAR PASSWORD

   No aplicamos xss sobre la contraseña porque modificaría
   el valor real introducido por el usuario.
   ========================================================= */

function normalizarPassword(valor) {
  return typeof valor ===
    "string"
    ? valor
    : "";
}


/* =========================================================
   CONSULTAR USUARIO
   ========================================================= */

async function buscarUsuario(
  usuario
) {
  const { rows } =
    await pool.query(
      `
        SELECT
          u.id_usuario,
          u.nombre,
          u.usuario,
          u.password_hash,
          u.estado_id,
          u.intentos_fallidos,
          u.bloqueado_hasta,
          u.ultimo_login,
          u.debe_cambiar_password,
          u.fecha_ultimo_cambio,

          (
            u.bloqueado_hasta IS NOT NULL
            AND u.bloqueado_hasta > NOW()
          ) AS esta_bloqueado,

          r.id AS rol_id,
          r.nombre AS rol

        FROM usuarios u

        JOIN roles r
          ON u.rol_id = r.id

        WHERE u.usuario = $1

        LIMIT 1
      `,
      [
        usuario,
      ]
    );


  return rows?.[0] || null;
}


/* =========================================================
   USUARIO PARA CAMBIO DE CONTRASEÑA
   ========================================================= */

async function buscarUsuarioPassword(
  usuario
) {
  const { rows } =
    await pool.query(
      `
        SELECT
          u.id_usuario,
          u.usuario,
          u.nombre,
          u.password_hash,
          u.estado_id,
          u.debe_cambiar_password,
          u.fecha_ultimo_cambio,

          r.id AS rol_id,
          r.nombre AS rol

        FROM usuarios u

        JOIN roles r
          ON u.rol_id = r.id

        WHERE u.usuario = $1

        LIMIT 1
      `,
      [
        usuario,
      ]
    );


  return rows?.[0] || null;
}


/* =========================================================
   REGISTRAR INTENTO FALLIDO
   ========================================================= */

async function registrarIntentoFallido(
  usuario
) {
  const intentos =
    Number(
      usuario.intentos_fallidos || 0
    ) + 1;


  if (
    intentos >=
    authConfig.loginMaxAttempts
  ) {
    const { rows } =
      await pool.query(
        `
          UPDATE usuarios

          SET
            bloqueado_hasta =
              NOW() + (
                $1::int *
                INTERVAL '1 minute'
              ),

            intentos_fallidos = 0

          WHERE id_usuario = $2

          RETURNING
            bloqueado_hasta
        `,
        [
          authConfig.loginBlockMinutes,
          usuario.id_usuario,
        ]
      );


    throw crearErrorHttp(
      403,
      `Usuario bloqueado por ${authConfig.loginBlockMinutes} minuto(s).`,
      {
        bloqueado_hasta:
          rows?.[0]?.bloqueado_hasta ||
          null,
      }
    );
  }


  await pool.query(
    `
      UPDATE usuarios

      SET intentos_fallidos = $1

      WHERE id_usuario = $2
    `,
    [
      intentos,
      usuario.id_usuario,
    ]
  );


  throw crearErrorHttp(
    401,
    "Credenciales inválidas."
  );
}


/* =========================================================
   LOGIN
   ========================================================= */

async function login({
  usuario,
  contrasena,
}) {
  const usuarioSeguro =
    normalizarUsuario(
      usuario
    );

  const passwordSeguro =
    normalizarPassword(
      contrasena
    );


  if (
    !usuarioSeguro ||
    !passwordSeguro
  ) {
    throw crearErrorHttp(
      400,
      "Usuario y contraseña requeridos."
    );
  }


  const user =
    await buscarUsuario(
      usuarioSeguro
    );


  if (!user) {
    throw crearErrorHttp(
      401,
      "Credenciales inválidas."
    );
  }


  if (user.esta_bloqueado) {
    throw crearErrorHttp(
      403,
      "Usuario bloqueado temporalmente.",
      {
        bloqueado_hasta:
          user.bloqueado_hasta,
      }
    );
  }


  if (user.estado_id !== 1) {
    throw crearErrorHttp(
      403,
      "Usuario inactivo o bloqueado."
    );
  }


  const passwordCorrecta =
    await bcrypt.compare(
      passwordSeguro,
      user.password_hash
    );


  if (!passwordCorrecta) {
    await registrarIntentoFallido(
      user
    );
  }


  /*
    Limpieza oportunista de sesiones vencidas.
  */

  await limpiarSesionesExpiradas();


  /* =======================================================
     CAMBIO OBLIGATORIO
     ======================================================= */

  if (
    user.debe_cambiar_password
  ) {
    const token =
      await crearSesion({
        usuario: user,
      });


    return {
      requiereCambio: true,
      tipo: "obligatoria",
      token,
    };
  }


  /* =======================================================
     CONTRASEÑA EXPIRADA
     ======================================================= */

  if (
    passwordExpirada(user)
  ) {
    const token =
      await crearSesion({
        usuario: user,
      });


    return {
      requiereCambio: true,
      tipo: "reconfirmacion",
      token,
    };
  }


  /* =======================================================
     LOGIN NORMAL
     ======================================================= */

  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    await client.query(
      `
        UPDATE usuarios

        SET
          intentos_fallidos = 0,
          bloqueado_hasta = NULL,
          ultimo_login = NOW()

        WHERE id_usuario = $1
      `,
      [
        user.id_usuario,
      ]
    );


    const token =
      await crearSesion({
        client,
        usuario: user,
      });


    await client.query(
      "COMMIT"
    );


    return {
      message:
        "Inicio de sesión exitoso",

      token,

      usuario: {
        id:
          user.id_usuario,

        nombre:
          user.nombre,

        usuario:
          user.usuario,

        rol_id:
          user.rol_id,

        rol:
          user.rol,

        ultimo_login:
          new Date()
            .toISOString(),
      },
    };


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;

  } finally {

    client.release();

  }
}


/* =========================================================
   LOGOUT
   ========================================================= */

async function logout({
  token,
}) {
  const cantidad =
    await cerrarSesionPorToken(
      token
    );


  return {
    message:
      cantidad > 0
        ? "Sesión cerrada correctamente."
        : "Sesión no encontrada o ya cerrada.",
  };
}


/* =========================================================
   CAMBIO OBLIGATORIO
   ========================================================= */

async function cambiarPasswordObligatorio({
  usuario,
  nueva,
}) {
  const usuarioSeguro =
    normalizarUsuario(
      usuario
    );

  const nuevaSegura =
    normalizarPassword(
      nueva
    );


  if (
    !usuarioSeguro ||
    !nuevaSegura
  ) {
    throw crearErrorHttp(
      400,
      "Usuario y nueva contraseña requeridos."
    );
  }


  const user =
    await buscarUsuarioPassword(
      usuarioSeguro
    );


  if (!user) {
    throw crearErrorHttp(
      404,
      "Usuario no encontrado."
    );
  }


  if (user.estado_id !== 1) {
    throw crearErrorHttp(
      403,
      "Usuario inactivo o bloqueado."
    );
  }


  await validarPasswordNoRepetida({
    usuarioId:
      user.id_usuario,

    passwordActualHash:
      user.password_hash,

    nuevaPassword:
      nuevaSegura,
  });


  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    await actualizarPassword({
      client,
      usuario: user,
      nuevaPassword:
        nuevaSegura,
    });


    const token =
      await crearSesion({
        client,
        usuario: user,
      });


    await client.query(
      "COMMIT"
    );


    return {
      message:
        "Contraseña actualizada correctamente.",

      token,
    };


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;

  } finally {

    client.release();

  }
}


/* =========================================================
   RECONFIRMACIÓN
   ========================================================= */

async function reconfirmarPassword({
  usuario,
  actual,
  nueva,
}) {
  const usuarioSeguro =
    normalizarUsuario(
      usuario
    );

  const actualSegura =
    normalizarPassword(
      actual
    );

  const nuevaSegura =
    normalizarPassword(
      nueva
    );


  if (
    !usuarioSeguro ||
    !actualSegura ||
    !nuevaSegura
  ) {
    throw crearErrorHttp(
      400,
      "Usuario, contraseña actual y nueva son requeridos."
    );
  }


  const user =
    await buscarUsuarioPassword(
      usuarioSeguro
    );


  if (!user) {
    throw crearErrorHttp(
      404,
      "Usuario no encontrado."
    );
  }


  if (user.estado_id !== 1) {
    throw crearErrorHttp(
      403,
      "Usuario inactivo o bloqueado."
    );
  }


  const correcta =
    await bcrypt.compare(
      actualSegura,
      user.password_hash
    );


  if (!correcta) {
    throw crearErrorHttp(
      401,
      "La contraseña actual es incorrecta."
    );
  }


  await validarPasswordNoRepetida({
    usuarioId:
      user.id_usuario,

    passwordActualHash:
      user.password_hash,

    nuevaPassword:
      nuevaSegura,
  });


  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    await actualizarPassword({
      client,
      usuario: user,
      nuevaPassword:
        nuevaSegura,
    });


    const token =
      await crearSesion({
        client,
        usuario: user,
      });


    await client.query(
      "COMMIT"
    );


    return {
      message:
        "Contraseña actualizada correctamente.",

      token,
    };


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;

  } finally {

    client.release();

  }
}


module.exports = {
  login,
  logout,

  cambiarPasswordObligatorio,
  reconfirmarPassword,
};