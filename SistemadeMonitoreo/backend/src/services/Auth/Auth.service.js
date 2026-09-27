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

   Se utiliza solamente donde realmente corresponde,
   por ejemplo durante el login.

   La identidad de un usuario autenticado NO se toma
   desde el frontend.
   ========================================================= */

function normalizarUsuario(
  valor
) {

  return typeof valor === "string"
    ? xss(valor).trim()
    : "";
}


/* =========================================================
   NORMALIZAR PASSWORD

   IMPORTANTE:
   No se aplica:
   - trim()
   - xss()

   La contraseña debe conservar exactamente el valor
   proporcionado.
   ========================================================= */

function normalizarPassword(
  valor
) {

  return typeof valor === "string"
    ? valor
    : "";
}


/* =========================================================
   NORMALIZAR ID DEL USUARIO AUTENTICADO

   Este valor debe proceder de authMiddleware / JWT.
   ========================================================= */

function normalizarUsuarioId(
  valor
) {

  const id =
    Number(
      valor
    );


  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {

    return null;
  }


  return id;
}


/* =========================================================
   CONSULTAR USUARIO PARA LOGIN
   ========================================================= */

async function buscarUsuario(
  usuario
) {

  const {
    rows,
  } =
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


  return (
    rows?.[0] ||
    null
  );
}


/* =========================================================
   CONSULTAR USUARIO AUTENTICADO PARA PASSWORD

   IMPORTANTE:
   La búsqueda se realiza exclusivamente mediante
   id_usuario obtenido del JWT validado.

   NO se utiliza usuario enviado desde React.
   ========================================================= */

async function buscarUsuarioPasswordPorId(
  usuarioId
) {

  const {
    rows,
  } =
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
          u.ultimo_login,

          r.id AS rol_id,
          r.nombre AS rol

        FROM usuarios u

        JOIN roles r
          ON u.rol_id = r.id

        WHERE u.id_usuario = $1

        LIMIT 1
      `,
      [
        usuarioId,
      ]
    );


  return (
    rows?.[0] ||
    null
  );
}


/* =========================================================
   REGISTRAR INTENTO FALLIDO
   ========================================================= */

async function registrarIntentoFallido(
  usuario
) {

  const intentos =
    Number(
      usuario.intentos_fallidos ||
      0
    ) + 1;


  if (
    intentos >=
    authConfig.loginMaxAttempts
  ) {

    const {
      rows,
    } =
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


  /* =======================================================
     USUARIO BLOQUEADO TEMPORALMENTE
     ======================================================= */

  if (
    user.esta_bloqueado
  ) {

    throw crearErrorHttp(
      403,

      "Usuario bloqueado temporalmente.",

      {
        bloqueado_hasta:
          user.bloqueado_hasta,
      }
    );
  }


  /* =======================================================
     ESTADO DEL USUARIO
     ======================================================= */

  if (
    user.estado_id !== 1
  ) {

    throw crearErrorHttp(
      403,
      "Usuario inactivo o bloqueado."
    );
  }


  /* =======================================================
     VALIDAR CONTRASEÑA
     ======================================================= */

  const passwordCorrecta =
    await bcrypt.compare(
      passwordSeguro,
      user.password_hash
    );


  if (
    !passwordCorrecta
  ) {

    await registrarIntentoFallido(
      user
    );
  }


  /* =======================================================
     LIMPIAR SESIONES EXPIRADAS
     ======================================================= */

  await limpiarSesionesExpiradas();


  /* =======================================================
     CAMBIO OBLIGATORIO

     Tiene prioridad sobre vencimiento por antigüedad.
     ======================================================= */

  if (
    user.debe_cambiar_password === true
  ) {

    const token =
      await crearSesion({
        usuario:
          user,
      });


    return {
      requiereCambio:
        true,

      tipo:
        "obligatoria",

      token,
    };
  }


  /* =======================================================
     CONTRASEÑA EXPIRADA
     ======================================================= */

  if (
    passwordExpirada(
      user
    )
  ) {

    const token =
      await crearSesion({
        usuario:
          user,
      });


    return {
      requiereCambio:
        true,

      tipo:
        "reconfirmacion",

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


    const resultadoUpdate =
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


    if (
      resultadoUpdate.rowCount !== 1
    ) {

      throw crearErrorHttp(
        500,
        "No fue posible actualizar la sesión del usuario."
      );
    }


    const token =
      await crearSesion({
        client,
        usuario:
          user,
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
        "Error ejecutando rollback en login:",
        rollbackError
      );
    }


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

  if (
    typeof token !== "string" ||
    !token
  ) {

    throw crearErrorHttp(
      400,
      "Token de sesión requerido."
    );
  }


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
   CAMBIO OBLIGATORIO DE CONTRASEÑA

   usuarioId:
   proviene de req.user.id_usuario después de authMiddleware.

   NO se recibe usuario desde frontend.
   ========================================================= */

async function cambiarPasswordObligatorio({
  usuarioId,
  nueva,
}) {

  const id =
    normalizarUsuarioId(
      usuarioId
    );


  const nuevaSegura =
    normalizarPassword(
      nueva
    );


  /* =======================================================
     VALIDAR IDENTIDAD AUTENTICADA
     ======================================================= */

  if (!id) {

    throw crearErrorHttp(
      401,
      "Sesión no válida."
    );
  }


  if (!nuevaSegura) {

    throw crearErrorHttp(
      400,
      "La nueva contraseña es requerida."
    );
  }


  /* =======================================================
     OBTENER USUARIO DESDE LA IDENTIDAD DEL JWT
     ======================================================= */

  const user =
    await buscarUsuarioPasswordPorId(
      id
    );


  if (!user) {

    throw crearErrorHttp(
      401,
      "Sesión no válida."
    );
  }


  if (
    user.estado_id !== 1
  ) {

    throw crearErrorHttp(
      403,
      "Usuario inactivo o bloqueado."
    );
  }


  /* =======================================================
     COMPROBAR QUE REALMENTE TIENE CAMBIO OBLIGATORIO

     El frontend NO puede decidir esto.
     ======================================================= */

  if (
    user.debe_cambiar_password !==
      true
  ) {

    throw crearErrorHttp(
      403,
      "El usuario no tiene un cambio obligatorio de contraseña pendiente."
    );
  }


  /* =======================================================
     VALIDAR POLÍTICA E HISTORIAL

     Password.service vuelve a validar la contraseña.
     ======================================================= */

  await validarPasswordNoRepetida({

    usuarioId:
      user.id_usuario,

    passwordActualHash:
      user.password_hash,

    nuevaPassword:
      nuevaSegura,
  });


  /* =======================================================
     ACTUALIZAR
     ======================================================= */

  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    await actualizarPassword({

      client,

      usuario:
        user,

      nuevaPassword:
        nuevaSegura,
    });


    const token =
      await crearSesion({

        client,

        usuario:
          user,
      });


    await client.query(
      "COMMIT"
    );


    return {
      message:
        "Contraseña actualizada correctamente.",

      token,
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
        "Error ejecutando rollback en cambio obligatorio:",
        rollbackError
      );
    }


    throw error;


  } finally {

    client.release();
  }
}


/* =========================================================
   RECONFIRMACIÓN POR VENCIMIENTO

   usuarioId:
   proviene de req.user.id_usuario después de authMiddleware.

   El frontend solo envía:
   - actual
   - nueva

   La identidad NO viene del frontend.
   ========================================================= */

async function reconfirmarPassword({
  usuarioId,
  actual,
  nueva,
}) {

  const id =
    normalizarUsuarioId(
      usuarioId
    );


  const actualSegura =
    normalizarPassword(
      actual
    );


  const nuevaSegura =
    normalizarPassword(
      nueva
    );


  /* =======================================================
     VALIDAR IDENTIDAD
     ======================================================= */

  if (!id) {

    throw crearErrorHttp(
      401,
      "Sesión no válida."
    );
  }


  if (
    !actualSegura ||
    !nuevaSegura
  ) {

    throw crearErrorHttp(
      400,
      "La contraseña actual y la nueva contraseña son requeridas."
    );
  }


  /* =======================================================
     BUSCAR USUARIO MEDIANTE ID DEL JWT
     ======================================================= */

  const user =
    await buscarUsuarioPasswordPorId(
      id
    );


  if (!user) {

    throw crearErrorHttp(
      401,
      "Sesión no válida."
    );
  }


  /* =======================================================
     ESTADO
     ======================================================= */

  if (
    user.estado_id !== 1
  ) {

    throw crearErrorHttp(
      403,
      "Usuario inactivo o bloqueado."
    );
  }


  /* =======================================================
     NO PERMITIR SALTAR CAMBIO OBLIGATORIO
     ======================================================= */

  if (
    user.debe_cambiar_password ===
      true
  ) {

    throw crearErrorHttp(
      403,
      "Debe completar el cambio obligatorio de contraseña."
    );
  }


  /* =======================================================
     VERIFICAR QUE REALMENTE ESTÁ VENCIDA

     El backend vuelve a calcular los 30 días.

     No confía en que el frontend lo haya enviado
     a esta pantalla correctamente.
     ======================================================= */

  if (
    !passwordExpirada(
      user
    )
  ) {

    throw crearErrorHttp(
      403,
      "La contraseña no requiere actualización por vencimiento."
    );
  }


  /* =======================================================
     VALIDAR CONTRASEÑA ACTUAL
     ======================================================= */

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


  /* =======================================================
     VALIDAR NUEVA CONTRASEÑA

     Incluye política + historial.
     ======================================================= */

  await validarPasswordNoRepetida({

    usuarioId:
      user.id_usuario,

    passwordActualHash:
      user.password_hash,

    nuevaPassword:
      nuevaSegura,
  });


  /* =======================================================
     ACTUALIZAR
     ======================================================= */

  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    await actualizarPassword({

      client,

      usuario:
        user,

      nuevaPassword:
        nuevaSegura,
    });


    const token =
      await crearSesion({

        client,

        usuario:
          user,
      });


    await client.query(
      "COMMIT"
    );


    return {
      message:
        "Contraseña actualizada correctamente.",

      token,
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
        "Error ejecutando rollback en reconfirmación:",
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
  login,
  logout,
  cambiarPasswordObligatorio,
  reconfirmarPassword,
};