const pool = require(
  "../../config/db"
);

const alertaEnviosService = require(
  "../controlDSH/alertas/AlertaEnvios.service"
);


// ======================================================
// CONFIGURACIÓN
// ======================================================

const intervaloConfigurado = Number(
  process.env
    .ALERTAS_PROGRAMADAS_MONITOR_INTERVAL_MS
);

const INTERVALO_MONITOR_MS =
  Number.isInteger(intervaloConfigurado) &&
  intervaloConfigurado >= 1000

    ? intervaloConfigurado

    : 5000;


// Evita procesar ilimitados registros
// dentro de un único ciclo.

const MAX_ALERTAS_POR_CICLO = 20;


// ======================================================
// ESTADO INTERNO
// ======================================================

let timerMonitor = null;

let ejecucionEnCurso = false;


// ======================================================
// PROCESAR SIGUIENTE RECORDATORIO VENCIDO
// ======================================================

async function procesarSiguienteRecordatorio() {

  const client = await pool.connect();

  let transaccionActiva = false;


  try {

    await client.query("BEGIN");

    transaccionActiva = true;


    // ==================================================
    // BUSCAR RECORDATORIO QUE DEBE EJECUTARSE
    // ==================================================
    //
    // FOR UPDATE SKIP LOCKED:
    //
    // Si otra ejecución ya está procesando
    // este registro, no lo tomamos nuevamente.
    // ==================================================

    const { rows } = await client.query(
      `
        SELECT
          id,
          motivo,
          mensaje,
          proxima_ejecucion

        FROM alertas

        WHERE tipo = 'PROGRAMADA'

          AND estado = 'PENDIENTE'

          AND proxima_ejecucion <=
              CURRENT_TIMESTAMP

        ORDER BY
          proxima_ejecucion ASC,
          id ASC

        LIMIT 1

        FOR UPDATE SKIP LOCKED
      `
    );


    // ==================================================
    // NO HAY RECORDATORIOS VENCIDOS
    // ==================================================

    if (!rows.length) {

      await client.query("COMMIT");

      transaccionActiva = false;

      return {
        accion: "SIN_PENDIENTES",
      };

    }


    const alerta = rows[0];


    // ==================================================
    // PREPARAR ENVÍO DE WHATSAPP
    // ==================================================
    //
    // Reutilizamos AlertaEnvios.service.js.
    //
    // Este método NO llama a Meta.
    // Solamente registra el envío pendiente.
    // ==================================================

    const resultadoEnvio =
      await alertaEnviosService
        .crearEnvioWhatsAppPendiente(

          client,

          {
            alertaId: alerta.id,

            mensaje: alerta.mensaje,

            secuenciaNotificacion: 1,

            intento: 1,
          }

        );


    // ==================================================
    // SIN DESTINATARIO
    // ==================================================
    //
    // No activamos un recordatorio que
    // todavía no tiene destinatario.
    //
    // Permanecerá PENDIENTE para que pueda
    // procesarse cuando se configure uno.
    // ==================================================

    if (
      resultadoEnvio.motivo ===
      "SIN_DESTINATARIO_WHATSAPP"
    ) {

      await client.query("ROLLBACK");

      transaccionActiva = false;

      return {
        accion: "SIN_DESTINATARIO",
      };

    }


    // ==================================================
    // VERIFICAR REGISTRO DE ENVÍO
    // ==================================================

    if (!resultadoEnvio.envio?.id) {

      throw new Error(
        "No fue posible preparar el envío del recordatorio."
      );

    }


    // ==================================================
    // ACTIVAR RECORDATORIO
    // ==================================================
    //
    // ACTIVA:
    // Llegó la fecha y hora del recordatorio.
    //
    // NO significa que WhatsApp fue entregado.
    // ==================================================

    const actualizacion =
      await client.query(
        `
          UPDATE alertas

          SET
            estado = 'ACTIVA',

            fecha_activacion =
              COALESCE(
                fecha_activacion,
                CURRENT_TIMESTAMP
              )

          WHERE id = $1

            AND tipo = 'PROGRAMADA'

            AND estado = 'PENDIENTE'

          RETURNING
            id,
            tipo,
            estado,
            fecha_activacion
        `,
        [
          alerta.id,
        ]
      );


    if (!actualizacion.rows.length) {

      throw new Error(
        "No fue posible activar el recordatorio."
      );

    }


    // ==================================================
    // CONFIRMAR AMBAS OPERACIONES
    // ==================================================

    await client.query("COMMIT");

    transaccionActiva = false;


    return {

      accion: "RECORDATORIO_ACTIVADO",

      alertaId:
        alerta.id,

      envioId:
        resultadoEnvio.envio.id,

    };


  } catch (error) {

    if (transaccionActiva) {

      try {

        await client.query("ROLLBACK");

      } catch (rollbackError) {

        console.error(
          "Error revirtiendo recordatorio:",
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
// EJECUTAR CICLO
// ======================================================

async function ejecutarCiclo() {

  // Evitar ejecuciones simultáneas.

  if (ejecucionEnCurso) {
    return;
  }


  ejecucionEnCurso = true;


  try {

    for (
      let i = 0;
      i < MAX_ALERTAS_POR_CICLO;
      i++
    ) {

      const resultado =
        await procesarSiguienteRecordatorio();


      // ================================================
      // NADA PENDIENTE
      // ================================================

      if (
        resultado.accion ===
        "SIN_PENDIENTES"
      ) {

        break;

      }


      // ================================================
      // FALTA DESTINATARIO
      // ================================================

      if (
        resultado.accion ===
        "SIN_DESTINATARIO"
      ) {

        break;

      }


      // ================================================
      // REGISTRO ACTIVADO
      // ================================================
      //
      // Solo imprimimos cuando realmente
      // se procesó un recordatorio.
      // ================================================

      if (
        resultado.accion ===
        "RECORDATORIO_ACTIVADO"
      ) {

        console.log(
          `Recordatorio programado activado: alerta ${resultado.alertaId} | envío pendiente ${resultado.envioId}`
        );

      }

    }


  } catch (error) {

    console.error(
      "Error ejecutando monitor de alertas programadas:",
      error.message
    );


  } finally {

    ejecucionEnCurso = false;

  }

}


// ======================================================
// INICIAR MONITOR
// ======================================================

async function iniciarMonitor() {

  if (timerMonitor) {
    return;
  }


  // Primera evaluación inmediata.

  await ejecutarCiclo();


  // Evaluaciones posteriores.

  timerMonitor = setInterval(
    () => {

      ejecutarCiclo().catch(
        (error) => {

          console.error(
            "Error inesperado en monitor de recordatorios:",
            error.message
          );

        }
      );

    },

    INTERVALO_MONITOR_MS
  );

}


// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitor() {

  if (!timerMonitor) {
    return;
  }


  clearInterval(timerMonitor);

  timerMonitor = null;

}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  iniciarMonitor,

  detenerMonitor,

  ejecutarCiclo,

};