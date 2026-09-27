// ======================================================
// CONFIGURACIÓN DE ALERTAS
// ======================================================

const pool = require(
  "../../config/db"
);


// ======================================================
// CONSTANTES
// ======================================================

const PRIMEROS_AVISOS_PERMITIDOS = [
  40,
  50,
  60,
];

const NIVELES_ALTOS_PERMITIDOS = [
  70,
  80,
  90,
];


// ======================================================
// ERROR CONTROLADO
// ======================================================

class ConfiguracionAlertasError extends Error {

  constructor(
    statusCode,
    message,
    codigo
  ) {

    super(message);

    this.statusCode = statusCode;

    this.codigo = codigo;
  }
}


// ======================================================
// VALIDAR PORCENTAJE
// ======================================================

function validarPorcentaje(
  valor,
  permitidos,
  nombre
) {

  if (
    valor === null ||
    valor === undefined ||
    typeof valor === "boolean" ||
    String(valor).trim() === ""
  ) {

    throw new ConfiguracionAlertasError(
      400,
      `Debe seleccionar ${nombre}.`,
      "UMBRAL_REQUERIDO"
    );
  }


  const numero = Number(valor);


  if (
    !Number.isInteger(numero) ||
    !permitidos.includes(numero)
  ) {

    throw new ConfiguracionAlertasError(
      400,
      `El porcentaje seleccionado para ${nombre} no está permitido.`,
      "UMBRAL_INVALIDO"
    );
  }


  return numero;
}


// ======================================================
// OBTENER CONFIGURACIÓN ACTUAL
// ======================================================

async function obtenerConfiguracion() {

  const { rows } = await pool.query(
    `
      SELECT
        id,
        primer_aviso_pct,
        segundo_aviso_pct,
        activa,
        actualizado_por,
        fecha_actualizacion

      FROM configuracion_alertas

      WHERE id = 1

      LIMIT 1
    `
  );


  if (!rows.length) {

    throw new ConfiguracionAlertasError(
      500,
      "No se encontró la configuración de alertas del sistema.",
      "CONFIGURACION_NO_DISPONIBLE"
    );
  }


  return {
    ...rows[0],

    primer_aviso_pct:
      Number(rows[0].primer_aviso_pct),

    segundo_aviso_pct:
      Number(rows[0].segundo_aviso_pct),
  };
}


// ======================================================
// VERIFICAR USUARIO AUTORIZADO
// ======================================================
//
// No confiamos únicamente en el rol enviado
// dentro del JWT.
//
// Se comprueba en PostgreSQL que el usuario
// continúe activo y tenga un rol autorizado.
// ======================================================

async function verificarUsuarioAutorizado(
  client,
  usuarioId
) {

  const { rows } = await client.query(
    `
      SELECT
        u.id_usuario

      FROM usuarios u

      JOIN roles r
        ON r.id = u.rol_id

      JOIN estados_usuario eu
        ON eu.id = u.estado_id

      WHERE u.id_usuario = $1

        AND LOWER(
          TRIM(eu.nombre)
        ) = 'activo'

        AND LOWER(
          TRIM(r.nombre)
        ) IN (
          'administrador',
          'inspector'
        )

      LIMIT 1
    `,
    [
      usuarioId,
    ]
  );


  if (!rows.length) {

    throw new ConfiguracionAlertasError(
      403,
      "No tiene permisos para modificar la configuración de alertas.",
      "ACCESO_DENEGADO"
    );
  }
}


// ======================================================
// ACTUALIZAR CONFIGURACIÓN
// ======================================================

async function actualizarConfiguracion({
  primerAvisoPct,
  segundoAvisoPct,
  usuarioId,
}) {

  // ====================================================
  // 1. VALIDAR USUARIO
  // ====================================================

  const idUsuario = Number(usuarioId);


  if (
    !Number.isSafeInteger(idUsuario) ||
    idUsuario <= 0
  ) {

    throw new ConfiguracionAlertasError(
      401,
      "Usuario no autenticado.",
      "USUARIO_NO_AUTENTICADO"
    );
  }


  // ====================================================
  // 2. VALIDAR PORCENTAJES
  // ====================================================

  const primerAviso = validarPorcentaje(
    primerAvisoPct,
    PRIMEROS_AVISOS_PERMITIDOS,
    "el primer aviso"
  );


  const segundoAviso = validarPorcentaje(
    segundoAvisoPct,
    NIVELES_ALTOS_PERMITIDOS,
    "el nivel alto"
  );


  if (
    primerAviso >= segundoAviso
  ) {

    throw new ConfiguracionAlertasError(
      400,
      "El primer aviso debe ser menor que el nivel alto.",
      "ORDEN_UMBRALES_INVALIDO"
    );
  }


  // ====================================================
  // 3. TRANSACCIÓN
  // ====================================================

  const client = await pool.connect();

  let transaccionActiva = false;


  try {

    await client.query("BEGIN");

    transaccionActiva = true;


    // ==================================================
    // 4. VERIFICAR PERMISOS ACTUALES
    // ==================================================

    await verificarUsuarioAutorizado(
      client,
      idUsuario
    );


    // ==================================================
    // 5. ACTUALIZAR CONFIGURACIÓN GLOBAL
    // ==================================================

    const { rows } = await client.query(
      `
        UPDATE configuracion_alertas

        SET
          primer_aviso_pct = $1,
          segundo_aviso_pct = $2,
          actualizado_por = $3,
          fecha_actualizacion =
            CURRENT_TIMESTAMP

        WHERE id = 1

        RETURNING
          id,
          primer_aviso_pct,
          segundo_aviso_pct,
          activa,
          actualizado_por,
          fecha_actualizacion
      `,
      [
        primerAviso,
        segundoAviso,
        idUsuario,
      ]
    );


    if (!rows.length) {

      throw new ConfiguracionAlertasError(
        500,
        "No fue posible encontrar la configuración que se desea actualizar.",
        "CONFIGURACION_NO_DISPONIBLE"
      );
    }


    // ==================================================
    // 6. CONFIRMAR
    // ==================================================

    await client.query("COMMIT");

    transaccionActiva = false;


    return {
      ...rows[0],

      primer_aviso_pct:
        Number(rows[0].primer_aviso_pct),

      segundo_aviso_pct:
        Number(rows[0].segundo_aviso_pct),
    };


  } catch (error) {

    if (transaccionActiva) {

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (rollbackError) {

        console.error(
          "Error haciendo rollback de configuración:",
          rollbackError.message
        );
      }
    }


    throw error;


  } finally {

    client.release();
  }
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerConfiguracion,
  actualizarConfiguracion,
  ConfiguracionAlertasError,
};