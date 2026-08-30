const bcrypt =
  require("bcrypt");

const pool =
  require("../../config/db");

const authConfig =
  require("../../config/auth.config");

const {
  crearErrorHttp,
} = require("./AuthError");


/* =========================================================
   VERIFICAR EXPIRACIÓN
   ========================================================= */

function passwordExpirada(usuario) {
  const referencia =
    usuario?.fecha_ultimo_cambio ||
    usuario?.ultimo_login;


  if (!referencia) {
    return false;
  }


  const fecha =
    new Date(referencia);

  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {
    return false;
  }


  const diffMs =
    Date.now() -
    fecha.getTime();


  const diffMin =
    diffMs /
    (1000 * 60);


  const diffDias =
    diffMs /
    (
      1000 *
      60 *
      60 *
      24
    );


  const expiroMin =
    authConfig.passwordMaxAgeMinutes > 0 &&
    diffMin >=
      authConfig.passwordMaxAgeMinutes;


  const expiroDias =
    authConfig.passwordMaxAgeDays > 0 &&
    diffDias >=
      authConfig.passwordMaxAgeDays;


  return (
    expiroMin ||
    expiroDias
  );
}


/* =========================================================
   VALIDAR CONTRASEÑA NO REPETIDA
   ========================================================= */

async function validarPasswordNoRepetida({
  usuarioId,
  passwordActualHash,
  nuevaPassword,
}) {
  const { rows } =
    await pool.query(
      `
        SELECT
          password_hash

        FROM historial_passwords

        WHERE id_usuario = $1

        ORDER BY fecha_cambio DESC

        LIMIT $2
      `,
      [
        usuarioId,
        authConfig.passwordHistoryLimit,
      ]
    );


  const hashes = [
    passwordActualHash,
    ...rows.map(
      (registro) =>
        registro.password_hash
    ),
  ];


  for (
    const hash
    of hashes
  ) {
    const coincide =
      await bcrypt.compare(
        nuevaPassword,
        hash
      );


    if (coincide) {
      throw crearErrorHttp(
        400,
        `La nueva contraseña no puede coincidir con las últimas ${authConfig.passwordHistoryLimit} contraseñas.`
      );
    }
  }
}


/* =========================================================
   ACTUALIZAR CONTRASEÑA

   Esta función debe ejecutarse dentro de una transacción.
   ========================================================= */

async function actualizarPassword({
  client,
  usuario,
  nuevaPassword,
}) {
  if (!client) {
    throw new Error(
      "Se requiere una transacción para actualizar la contraseña."
    );
  }


  await client.query(
    `
      INSERT INTO historial_passwords (
        id_usuario,
        password_hash,
        fecha_cambio
      )

      VALUES (
        $1,
        $2,
        NOW()
      )
    `,
    [
      usuario.id_usuario,
      usuario.password_hash,
    ]
  );


  const nuevoHash =
    await bcrypt.hash(
      nuevaPassword,
      authConfig.bcryptRounds
    );


  await client.query(
    `
      UPDATE usuarios

      SET
        password_hash = $1,
        fecha_ultimo_cambio = NOW(),
        debe_cambiar_password = FALSE,
        intentos_fallidos = 0,
        bloqueado_hasta = NULL

      WHERE id_usuario = $2
    `,
    [
      nuevoHash,
      usuario.id_usuario,
    ]
  );
}


module.exports = {
  passwordExpirada,

  validarPasswordNoRepetida,

  actualizarPassword,
};