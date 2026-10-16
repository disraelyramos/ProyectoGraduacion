const pool = require(
  "../../config/db"
);

const alertaEnviosService = require(
  "../controlDSH/alertas/AlertaEnvios.service"
);


// ======================================================
// CONFIGURACIÓN
// ======================================================

const intervaloConfigurado =
  Number(
    process.env
      .ALERTAS_PROGRAMADAS_MONITOR_INTERVAL_MS
  );


const INTERVALO_MONITOR_MS =
  Number.isInteger(
    intervaloConfigurado
  ) &&
  intervaloConfigurado >= 1000

    ? intervaloConfigurado

    : 5000;


const MAX_ALERTAS_POR_CICLO =
  20;


// ======================================================
// ESTADO INTERNO
// ======================================================

let timerMonitor =
  null;

let ejecucionEnCurso =
  false;


// ======================================================
// OBTENER PLANTILLA META
// ======================================================

function obtenerPlantillaProgramada() {

  const plantilla =
    String(
      process.env
        .WHATSAPP_TEMPLATE_PROGRAMADA ??
      ""
    ).trim();


  if (!plantilla) {

    throw new Error(
      "WHATSAPP_TEMPLATE_PROGRAMADA no está configurado."
    );
  }


  return plantilla;
}


// ======================================================
// FORMATEAR FECHA PARA WHATSAPP
// ======================================================
//
// Ejemplo:
//
// 15/10/2026 08:00
// ======================================================

function formatearFechaWhatsApp(
  fecha
) {

  const fechaObjeto =
    fecha instanceof Date
      ? fecha
      : new Date(
          fecha
        );


  if (
    Number.isNaN(
      fechaObjeto.getTime()
    )
  ) {

    throw new Error(
      "La fecha programada no es válida."
    );
  }


  const zonaHoraria =
    String(
      process.env
        .APP_TIME_ZONE ||
      "America/Guatemala"
    ).trim();


  const partes =
    new Intl.DateTimeFormat(
      "es-GT",
      {
        timeZone:
          zonaHoraria,

        day:
          "2-digit",

        month:
          "2-digit",

        year:
          "numeric",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false,
      }
    )
      .formatToParts(
        fechaObjeto
      );


  const obtener =
    (tipo) =>
      partes.find(
        (parte) =>
          parte.type ===
          tipo
      )?.value || "";


  const dia =
    obtener(
      "day"
    );

  const mes =
    obtener(
      "month"
    );

  const anio =
    obtener(
      "year"
    );

  const hora =
    obtener(
      "hour"
    );

  const minuto =
    obtener(
      "minute"
    );


  return (
    `${dia}/${mes}/${anio} ` +
    `${hora}:${minuto}`
  );
}


// ======================================================
// PROCESAR SIGUIENTE RECORDATORIO VENCIDO
// ======================================================

async function procesarSiguienteRecordatorio() {

  const client =
    await pool.connect();


  let transaccionActiva =
    false;


  try {

    await client.query(
      "BEGIN"
    );


    transaccionActiva =
      true;


    // ==================================================
    // BUSCAR RECORDATORIO VENCIDO
    // ==================================================

    const { rows } =
      await client.query(
        `
          SELECT
            id,
            tipo,
            motivo,
            mensaje,

            fecha_programada_original,
            proxima_ejecucion,

            cantidad_posposiciones,
            estado

          FROM alertas

          WHERE tipo = 'PROGRAMADA'

            AND estado = 'PENDIENTE'

            AND proxima_ejecucion
              <= CURRENT_TIMESTAMP

          ORDER BY
            proxima_ejecucion ASC,
            id ASC

          LIMIT 1

          FOR UPDATE SKIP LOCKED
        `
      );


    // ==================================================
    // SIN RECORDATORIOS
    // ==================================================

    if (
      !rows.length
    ) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "SIN_PENDIENTES",
      };
    }


    const alerta =
      rows[0];


    // ==================================================
    // VALIDAR MOTIVO
    // ==================================================

    const motivo =
      String(
        alerta.motivo ??
        ""
      ).trim();


    if (!motivo) {

      throw new Error(
        "El recordatorio programado no contiene motivo."
      );
    }


    // ==================================================
    // FORMATEAR FECHA
    // ==================================================

    const fechaTexto =
      formatearFechaWhatsApp(
        alerta
          .proxima_ejecucion
      );


    // ==================================================
    // CREAR ENVÍO WHATSAPP
    // ==================================================
    //
    // Plantilla:
    //
    // recordatorio_programado
    //
    // {{1}} = motivo
    // {{2}} = fecha y hora
    //
    // Aquí NO se llama directamente a Meta.
    //
    // Únicamente se crea:
    //
    // PENDIENTE
    // secuencia = 1
    // intento = 1
    // ==================================================

    const resultadoEnvio =
      await alertaEnviosService
        .crearEnvioWhatsAppPendiente(
          client,
          {
            alertaId:
              alerta.id,

            mensaje:
              alerta.mensaje ||
              `Recordatorio programado: ${motivo}`,

            plantillaMeta:
              obtenerPlantillaProgramada(),

            parametrosPlantilla: [
              motivo,
              fechaTexto,
            ],

            secuenciaNotificacion:
              1,

            intento:
              1,

            fechaProgramadaIntento:
              null,
          }
        );


    // ==================================================
    // SIN DESTINATARIO
    // ======================================================
    //
    // No activamos todavía la alerta.
    //
    // Queda PENDIENTE para intentar de nuevo
    // cuando exista Inspector con WhatsApp.
    // ==================================================

    if (
      resultadoEnvio.motivo ===
      "SIN_DESTINATARIO_WHATSAPP"
    ) {

      await client.query(
        "ROLLBACK"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "SIN_DESTINATARIO",
      };
    }


    // ==================================================
    // VALIDAR ENVÍO
    // ==================================================

    if (
      !resultadoEnvio
        .envio
        ?.id
    ) {

      throw new Error(
        "No fue posible crear el envío pendiente del recordatorio."
      );
    }


    // ==================================================
    // ACTIVAR ALERTA PROGRAMADA
    // ======================================================
    //
    // ACTIVA significa:
    //
    // llegó la fecha/hora y el envío ya quedó
    // preparado en alertas_envios.
    //
    // NO significa todavía entregado por Meta.
    // ==================================================

    const actualizacion =
      await client.query(
        `
          UPDATE alertas

          SET
            estado =
              'ACTIVA',

            fecha_activacion =
              COALESCE(
                fecha_activacion,
                CURRENT_TIMESTAMP
              )

          WHERE id = $1

            AND tipo =
              'PROGRAMADA'

            AND estado =
              'PENDIENTE'

          RETURNING
            id,
            tipo,
            motivo,
            mensaje,
            estado,

            fecha_programada_original,
            proxima_ejecucion,

            cantidad_posposiciones,
            fecha_activacion
        `,
        [
          alerta.id,
        ]
      );


    if (
      !actualizacion
        .rows
        .length
    ) {

      throw new Error(
        "No fue posible activar el recordatorio programado."
      );
    }


    // ==================================================
    // CONFIRMAR
    // ==================================================

    await client.query(
      "COMMIT"
    );


    transaccionActiva =
      false;


    return {
      accion:
        "RECORDATORIO_ACTIVADO",

      alerta:
        actualizacion
          .rows[0],

      envioId:
        resultadoEnvio
          .envio
          .id,

      plantilla:
        obtenerPlantillaProgramada(),

      parametros: [
        motivo,
        fechaTexto,
      ],
    };


  } catch (
    error
  ) {

    if (
      transaccionActiva
    ) {

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "Error revirtiendo recordatorio programado:",
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

  if (
    ejecucionEnCurso
  ) {

    return {
      accion:
        "CICLO_EN_PROCESO",
    };
  }


  ejecucionEnCurso =
    true;


  let procesados =
    0;


  try {

    for (
      let i = 0;
      i < MAX_ALERTAS_POR_CICLO;
      i++
    ) {

      const resultado =
        await procesarSiguienteRecordatorio();


      // ================================================
      // SIN PENDIENTES
      // ================================================

      if (
        resultado.accion ===
        "SIN_PENDIENTES"
      ) {

        break;
      }


      // ================================================
      // SIN DESTINATARIO
      // ================================================

      if (
        resultado.accion ===
        "SIN_DESTINATARIO"
      ) {

        console.warn(
          "Existe un recordatorio vencido, pero no hay Inspector activo con WhatsApp configurado."
        );


        break;
      }


      // ================================================
      // RECORDATORIO ACTIVADO
      // ================================================

      if (
        resultado.accion ===
        "RECORDATORIO_ACTIVADO"
      ) {

        procesados++;


        console.log(
          `Recordatorio programado activado: alerta ${resultado.alerta.id} | envío pendiente ${resultado.envioId}`
        );
      }
    }


    return {
      accion:
        "CICLO_COMPLETADO",

      procesados,
    };


  } catch (
    error
  ) {

    console.error(
      "Error ejecutando monitor de alertas programadas:",
      error.message
    );


    return {
      accion:
        "ERROR_MONITOR_ALERTAS_PROGRAMADAS",

      procesados,

      error:
        error.message,
    };


  } finally {

    ejecucionEnCurso =
      false;
  }
}


// ======================================================
// INICIAR MONITOR
// ======================================================

async function iniciarMonitor() {

  if (
    timerMonitor
  ) {

    return {
      iniciado:
        false,

      motivo:
        "MONITOR_YA_INICIADO",
    };
  }


  // ====================================================
  // PRIMERA EVALUACIÓN
  // ====================================================

  await ejecutarCiclo();


  // ====================================================
  // EVALUACIONES POSTERIORES
  // ====================================================

  timerMonitor =
    setInterval(
      () => {

        ejecutarCiclo()
          .catch(
            (
              error
            ) => {

              console.error(
                "Error inesperado en monitor de recordatorios programados:",
                error.message
              );
            }
          );

      },
      INTERVALO_MONITOR_MS
    );


  return {
    iniciado:
      true,

    intervaloMs:
      INTERVALO_MONITOR_MS,
  };
}


// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitor() {

  if (
    !timerMonitor
  ) {

    return {
      detenido:
        false,

      motivo:
        "MONITOR_NO_INICIADO",
    };
  }


  clearInterval(
    timerMonitor
  );


  timerMonitor =
    null;


  return {
    detenido:
      true,
  };
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  iniciarMonitor,

  detenerMonitor,

  ejecutarCiclo,
};