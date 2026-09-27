const pool = require(
  "../../config/db"
);


// ======================================================
// CONFIGURACIÓN DESDE .ENV
// ======================================================

function obtenerDias(nombre) {

  const dias = Number(
    process.env[nombre]
  );

  if (
    !Number.isSafeInteger(dias) ||
    dias < 1 ||
    dias > 3650
  ) {

    throw new Error(
      `[LIMPIEZA SESIONES] ${nombre} debe ser un entero entre 1 y 3650.`
    );

  }

  return dias;

}


const DIAS_LIMPIEZA = obtenerDias(
  "SESIONES_LIMPIEZA_CADA_DIAS"
);

const DIAS_RETENCION = obtenerDias(
  "SESIONES_RETENCION_DIAS"
);


// ======================================================
// INTERVALOS
// ======================================================
//
// Se comprueba una vez al día si corresponde
// ejecutar la limpieza.
//
// Esto permite configurar intervalos superiores
// a 24 días sin superar el límite de setInterval.
// ======================================================

const MS_DIA =
  24 * 60 * 60 * 1000;

const INTERVALO_LIMPIEZA_MS =
  DIAS_LIMPIEZA * MS_DIA;

const INTERVALO_VERIFICACION_MS =
  MS_DIA;


// ======================================================
// ESTADO INTERNO
// ======================================================

let timerLimpieza = null;

let ejecucionEnCurso = false;

let ultimaLimpieza = null;


// ======================================================
// EJECUTAR LIMPIEZA
// ======================================================

async function ejecutarLimpieza() {

  if (ejecucionEnCurso) {

    return null;

  }


  ejecucionEnCurso = true;

  let client = null;

  let transaccionActiva = false;


  try {

    client = await pool.connect();

    await client.query("BEGIN");

    transaccionActiva = true;


    // ==================================================
    // 1. DESACTIVAR SESIONES VENCIDAS
    // ==================================================

    const desactivadas =
      await client.query(
        `
          UPDATE sesiones

          SET activo = FALSE

          WHERE activo = TRUE

            AND fecha_expiracion <= NOW()
        `
      );


    // ==================================================
    // 2. ELIMINAR SESIONES ANTIGUAS
    // ==================================================
    //
    // Solo elimina sesiones:
    //
    // - inactivas;
    // - cuya fecha_expiracion tenga al menos
    //   los días de retención configurados.
    //
    // No elimina sesiones activas vigentes.
    // ==================================================

    const eliminadas =
      await client.query(
        `
          DELETE FROM sesiones

          WHERE activo = FALSE

            AND fecha_expiracion <=
              NOW() -
              (
                $1::integer *
                INTERVAL '1 day'
              )
        `,
        [
          DIAS_RETENCION,
        ]
      );


    // ==================================================
    // 3. CONFIRMAR TRANSACCIÓN
    // ==================================================

    await client.query("COMMIT");

    transaccionActiva = false;


    ultimaLimpieza = Date.now();


    const resultado = {

      desactivadas:
        desactivadas.rowCount || 0,

      eliminadas:
        eliminadas.rowCount || 0,

    };


    console.log(
      `Limpieza de sesiones: ${resultado.desactivadas} desactivadas, ${resultado.eliminadas} eliminadas.`
    );


    return resultado;


  } catch (error) {

    if (
      client &&
      transaccionActiva
    ) {

      try {

        await client.query("ROLLBACK");

      } catch (rollbackError) {

        console.error(
          "Error revirtiendo limpieza de sesiones:",
          rollbackError.message
        );

      }

    }


    throw error;


  } finally {

    if (client) {

      client.release();

    }


    ejecucionEnCurso = false;

  }

}


// ======================================================
// VERIFICAR SI CORRESPONDE LIMPIAR
// ======================================================

async function verificarLimpieza() {

  if (ejecucionEnCurso) {

    return;

  }


  const ahora = Date.now();


  if (
    ultimaLimpieza !== null &&
    ahora - ultimaLimpieza <
      INTERVALO_LIMPIEZA_MS
  ) {

    return;

  }


  await ejecutarLimpieza();

}


// ======================================================
// INICIAR LIMPIEZA AUTOMÁTICA
// ======================================================

async function iniciarLimpieza() {

  if (timerLimpieza) {

    return;

  }


  // Primera limpieza al iniciar el backend.

  await verificarLimpieza();


  // Después, comprobar una vez al día
  // si ya transcurrió el intervalo configurado.

  timerLimpieza = setInterval(
    () => {

      verificarLimpieza()
        .catch(
          (error) => {

            console.error(
              "Error en limpieza automática de sesiones:",
              error.message
            );

          }
        );

    },

    INTERVALO_VERIFICACION_MS
  );


  console.log(
    `Limpieza automática de sesiones configurada cada ${DIAS_LIMPIEZA} día(s), con retención de ${DIAS_RETENCION} día(s).`
  );

}


// ======================================================
// DETENER LIMPIEZA
// ======================================================

function detenerLimpieza() {

  if (!timerLimpieza) {

    return;

  }


  clearInterval(
    timerLimpieza
  );


  timerLimpieza = null;

}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  iniciarLimpieza,

  detenerLimpieza,

  ejecutarLimpieza,

};