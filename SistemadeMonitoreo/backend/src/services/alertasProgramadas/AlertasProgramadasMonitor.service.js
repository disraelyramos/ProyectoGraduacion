
"use strict";

const pool = require("../../config/db");

const alertaEnviosService = require(
  "../controlDSH/alertas/AlertaEnvios.service"
);

// ======================================================
// CONFIGURACIÓN
// ======================================================

const ZONA_HORARIA = "America/Guatemala";

const intervaloConfigurado = Number(
  process.env.ALERTAS_PROGRAMADAS_MONITOR_INTERVAL_MS
);

const INTERVALO_MONITOR_MS =
  Number.isSafeInteger(intervaloConfigurado) &&
  intervaloConfigurado >= 1000 &&
  intervaloConfigurado <= 3600000
    ? intervaloConfigurado
    : 5000;

const MAX_ALERTAS_POR_CICLO = 20;

// ======================================================
// ESTADO INTERNO
// ======================================================

let timerMonitor = null;
let ejecucionEnCurso = false;

// ======================================================
// OBTENER PLANTILLA META
// ======================================================

function obtenerPlantillaProgramada() {
  const plantilla = String(
    process.env.WHATSAPP_TEMPLATE_PROGRAMADA ?? ""
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

function formatearFechaWhatsApp(fecha) {
  const fechaObjeto =
    fecha instanceof Date
      ? fecha
      : new Date(fecha);

  if (Number.isNaN(fechaObjeto.getTime())) {
    throw new Error(
      "La fecha programada no es válida."
    );
  }

  const partes = new Intl.DateTimeFormat(
    "es-GT",
    {
      timeZone: ZONA_HORARIA,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      hourCycle: "h23",
    }
  ).formatToParts(fechaObjeto);

  const obtener = (tipo) =>
    partes.find(
      (parte) => parte.type === tipo
    )?.value || "";

  return (
    `${obtener("day")}/${obtener("month")}/` +
    `${obtener("year")} ` +
    `${obtener("hour")}:${obtener("minute")}`
  );
}

// ======================================================
// CERRAR ALERTAS PROGRAMADAS VENCIDAS
// ======================================================
//
// Se considera vencida cuando la fecha original
// de programación es ANTERIOR al día actual
// en America/Guatemala.
//
// Incluye estados:
// - PENDIENTE
// - ACTIVA
//
// Se conserva el historial.
// No se eliminan alertas ni envíos.
// No se afectan NIVEL_AVISO, NIVEL_ALTO,
// PREDICTIVA ni otros tipos.
//
// Se utiliza RESUELTA, estado que ya existe
// en el sistema.
//
// ======================================================

async function cerrarAlertasVencidas() {
  const { rows } = await pool.query(
    `
      WITH vencidas AS (
        SELECT id

        FROM alertas

        WHERE tipo = 'PROGRAMADA'

          AND estado IN (
            'PENDIENTE',
            'ACTIVA'
          )

          AND (
            fecha_programada_original
              AT TIME ZONE $1
          )::date
          <
          (
            clock_timestamp()
              AT TIME ZONE $1
          )::date

        ORDER BY id ASC

        LIMIT $2

        FOR UPDATE SKIP LOCKED
      )

      UPDATE alertas a

      SET
        estado = 'RESUELTA',
        fecha_resuelta = clock_timestamp(),
        fecha_cierre = clock_timestamp(),
        proxima_ejecucion = NULL

      FROM vencidas v

      WHERE a.id = v.id

      RETURNING a.id
    `,
    [
      ZONA_HORARIA,
      MAX_ALERTAS_POR_CICLO,
    ]
  );

  for (const alerta of rows) {
    console.log(
      `Alerta programada vencida y cerrada: ${alerta.id}`
    );
  }

  return rows.length;
}

// ======================================================
// PROCESAR SIGUIENTE RECORDATORIO PROGRAMADO
// ======================================================
//
// Reglas:
//
// 1. Debe estar PENDIENTE.
// 2. Ya debe haber llegado la hora.
// 3. La fecha ORIGINAL debe ser HOY
//    en Guatemala.
// 4. Se crea solamente la secuencia 1.
// 5. La creación y activación se realizan
//    en una sola transacción.
//
// Si la fecha fue ayer, no se activa.
//
// ======================================================

async function procesarSiguienteRecordatorio() {
  const client = await pool.connect();

  let transaccionActiva = false;

  try {
    await client.query("BEGIN");
    transaccionActiva = true;

    // ==================================================
    // 1. BUSCAR ALERTA CORRESPONDIENTE A HOY
    // ==================================================

    const { rows } = await client.query(
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
            <= clock_timestamp()

          AND (
            fecha_programada_original
              AT TIME ZONE $1
          )::date
          =
          (
            clock_timestamp()
              AT TIME ZONE $1
          )::date

        ORDER BY
          proxima_ejecucion ASC,
          id ASC

        LIMIT 1

        FOR UPDATE SKIP LOCKED
      `,
      [ZONA_HORARIA]
    );

    if (!rows.length) {
      await client.query("COMMIT");
      transaccionActiva = false;

      return {
        accion: "SIN_PENDIENTES",
      };
    }

    const alerta = rows[0];

    // ==================================================
    // 2. VALIDAR MOTIVO
    // ==================================================

    const motivo = String(
      alerta.motivo ?? ""
    ).trim();

    if (!motivo) {
      throw new Error(
        "El recordatorio programado no contiene motivo."
      );
    }

    // ==================================================
    // 3. FORMATEAR FECHA ORIGINAL
    // ==================================================

    const fechaTexto =
      formatearFechaWhatsApp(
        alerta.fecha_programada_original
      );

    // ==================================================
    // 4. CREAR ENVÍO INICIAL
    // ==================================================
    //
    // No llama directamente a Meta.
    //
    // Secuencia 1.
    // Intento técnico 1.
    // Estado PENDIENTE.
    //
    // ==================================================

    const resultadoEnvio =
      await alertaEnviosService
        .crearEnvioWhatsAppPendiente(
          client,
          {
            alertaId: alerta.id,

            mensaje:
              alerta.mensaje ||
              `Recordatorio programado: ${motivo}`,

            plantillaMeta:
              obtenerPlantillaProgramada(),

            parametrosPlantilla: [
              motivo,
              fechaTexto,
            ],

            secuenciaNotificacion: 1,

            intento: 1,

            fechaProgramadaIntento: null,
          }
        );

    // ==================================================
    // 5. SIN DESTINATARIO
    // ==================================================
    //
    // Se conserva PENDIENTE.
    //
    // Puede reintentarse mientras continúe
    // siendo el mismo día de Guatemala.
    //
    // Al día siguiente será cerrada.
    //
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

    if (!resultadoEnvio.envio?.id) {
      throw new Error(
        "No fue posible crear el envío pendiente del recordatorio."
      );
    }

    // ==================================================
    // 6. ACTIVAR SOLAMENTE SI SIGUE SIENDO HOY
    // ==================================================
    //
    // Revalidación dentro del UPDATE.
    //
    // Si cambia el día durante el procesamiento,
    // no se confirma la activación.
    //
    // ==================================================

    const actualizacion = await client.query(
      `
        UPDATE alertas

        SET
          estado = 'ACTIVA',

          fecha_activacion = COALESCE(
            fecha_activacion,
            clock_timestamp()
          )

        WHERE id = $1

          AND tipo = 'PROGRAMADA'

          AND estado = 'PENDIENTE'

          AND (
            fecha_programada_original
              AT TIME ZONE $2
          )::date
          =
          (
            clock_timestamp()
              AT TIME ZONE $2
          )::date

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
        ZONA_HORARIA,
      ]
    );

    if (!actualizacion.rows.length) {
      await client.query("ROLLBACK");
      transaccionActiva = false;

      return {
        accion: "FECHA_PROGRAMADA_VENCIDA",
        alertaId: alerta.id,
      };
    }

    // ==================================================
    // 7. CONFIRMAR
    // ==================================================

    await client.query("COMMIT");
    transaccionActiva = false;

    return {
      accion: "RECORDATORIO_ACTIVADO",

      alerta: actualizacion.rows[0],

      envioId: resultadoEnvio.envio.id,

      plantilla:
        resultadoEnvio.envio.plantilla_meta ||
        obtenerPlantillaProgramada(),

      parametros: [
        motivo,
        fechaTexto,
      ],
    };

  } catch (error) {
    if (transaccionActiva) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
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
//
// Primero:
// cerrar alertas de días anteriores.
//
// Después:
// activar alertas programadas para hoy.
//
// ======================================================

async function ejecutarCiclo() {
  if (ejecucionEnCurso) {
    return {
      accion: "CICLO_EN_PROCESO",
    };
  }

  ejecucionEnCurso = true;

  let procesados = 0;
  let vencidos = 0;

  try {
    // ==================================================
    // 1. CERRAR ALERTAS VENCIDAS
    // ==================================================

    for (let i = 0; i < MAX_ALERTAS_POR_CICLO; i++) {
      const cerrados =
        await cerrarAlertasVencidas();

      vencidos += cerrados;

      if (
        cerrados < MAX_ALERTAS_POR_CICLO
      ) {
        break;
      }
    }

    // ==================================================
    // 2. ACTIVAR ALERTAS DE HOY
    // ==================================================

    for (let i = 0; i < MAX_ALERTAS_POR_CICLO; i++) {
      const resultado =
        await procesarSiguienteRecordatorio();

      if (
        resultado.accion === "SIN_PENDIENTES" ||
        resultado.accion === "FECHA_PROGRAMADA_VENCIDA"
      ) {
        break;
      }

      if (
        resultado.accion === "SIN_DESTINATARIO"
      ) {
        console.warn(
          "Existe una alerta programada para hoy, " +
          "pero no hay destinatario WhatsApp configurado."
        );

        break;
      }

      if (
        resultado.accion === "RECORDATORIO_ACTIVADO"
      ) {
        procesados++;

        console.log(
          `Recordatorio programado activado: ` +
          `alerta ${resultado.alerta.id} | ` +
          `envío ${resultado.envioId}`
        );
      }
    }

    return {
      accion: "CICLO_COMPLETADO",
      procesados,
      vencidos,
    };

  } catch (error) {
    console.error(
      "Error ejecutando monitor de alertas programadas:",
      error.message
    );

    return {
      accion:
        "ERROR_MONITOR_ALERTAS_PROGRAMADAS",

      procesados,
      vencidos,

      error: error.message,
    };

  } finally {
    ejecucionEnCurso = false;
  }
}

// ======================================================
// INICIAR MONITOR
// ======================================================

async function iniciarMonitor() {
  if (timerMonitor) {
    return {
      iniciado: false,
      motivo: "MONITOR_YA_INICIADO",
    };
  }

  // Primera evaluación al arrancar Railway.
  await ejecutarCiclo();

  timerMonitor = setInterval(() => {
    ejecutarCiclo().catch((error) => {
      console.error(
        "Error inesperado en monitor de alertas programadas:",
        error.message
      );
    });
  }, INTERVALO_MONITOR_MS);

  console.log(
    `Monitor de alertas programadas activo ` +
    `cada ${INTERVALO_MONITOR_MS} ms.`
  );

  return {
    iniciado: true,
    intervaloMs: INTERVALO_MONITOR_MS,
  };
}

// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitor() {
  if (!timerMonitor) {
    return {
      detenido: false,
      motivo: "MONITOR_NO_INICIADO",
    };
  }

  clearInterval(timerMonitor);
  timerMonitor = null;

  return {
    detenido: true,
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
