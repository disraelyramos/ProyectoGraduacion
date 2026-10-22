
"use strict";

const pool = require("../../../config/db");

const AlertaEnviosService = require(
  "./AlertaEnvios.service"
);

const NivelCacheService = require(
  "../mediciones/NivelActualCache.service"
);

// ======================================================
// CONSTANTES
// ======================================================

const ZONA_HORARIA = "America/Guatemala";

const TIPOS_PERMITIDOS = [
  "NIVEL_AVISO",
  "NIVEL_ALTO",
  "PROGRAMADA",
];

const TIPOS_NIVEL = new Set([
  "NIVEL_AVISO",
  "NIVEL_ALTO",
]);

const CANAL_WHATSAPP = "WHATSAPP";
const CANAL_EMAIL = "EMAIL";

const ESTADO_ALERTA_ACTIVA = "ACTIVA";
const ESTADO_ENVIO_ACEPTADO = "ACEPTADO";

const MAX_SECUENCIA_NOTIFICACION = 4;
const MAX_RECORDATORIOS = 3;

// ======================================================
// CONFIGURACIÓN DESDE .ENV
// ======================================================

function obtenerIntervaloRecordatorioMin() {
  const valor = Number(
    process.env.WHATSAPP_RECORDATORIO_INTERVAL_MIN
  );

  if (
    Number.isSafeInteger(valor) &&
    valor >= 1 &&
    valor <= 1440
  ) {
    return valor;
  }

  return 5;
}

function obtenerIntervaloMonitorMs() {
  const valor = Number(
    process.env.WHATSAPP_RECORDATORIOS_MONITOR_INTERVAL_MS
  );

  if (
    Number.isSafeInteger(valor) &&
    valor >= 1000 &&
    valor <= 3600000
  ) {
    return valor;
  }

  return 5000;
}

function obtenerLimitePorCiclo() {
  const valor = Number(
    process.env.WHATSAPP_RECORDATORIOS_LIMIT
  );

  if (
    Number.isSafeInteger(valor) &&
    valor >= 1 &&
    valor <= 100
  ) {
    return valor;
  }

  return 20;
}

// ======================================================
// ESTADO INTERNO DEL MONITOR
// ======================================================

let timerMonitor = null;
let ejecucionEnCurso = false;

// ======================================================
// LEER CONTENIDO ESTRUCTURADO
// ======================================================

function leerContenidoEstructurado(
  contenidoEnviado
) {
  const contenido = String(
    contenidoEnviado ?? ""
  ).trim();

  if (!contenido) {
    throw new Error(
      "El envío inicial no contiene información."
    );
  }

  let datos;

  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error(
      "El contenido del envío inicial no tiene formato estructurado."
    );
  }

  if (
    !datos ||
    typeof datos !== "object" ||
    Array.isArray(datos)
  ) {
    throw new Error(
      "El contenido estructurado del envío inicial es inválido."
    );
  }

  if (Number(datos.version) !== 1) {
    throw new Error(
      "La versión del envío inicial no es compatible."
    );
  }

  if (
    !Array.isArray(datos.parametros) ||
    datos.parametros.length === 0
  ) {
    throw new Error(
      "El envío inicial no contiene parámetros de plantilla."
    );
  }

  const parametros = datos.parametros.map(
    (parametro, index) => {
      const texto = String(
        parametro ?? ""
      ).trim();

      if (!texto) {
        throw new Error(
          `El parámetro ${index + 1} del envío inicial está vacío.`
        );
      }

      return texto;
    }
  );

  return {
    mensaje: String(datos.mensaje ?? "").trim(),
    parametros,
  };
}

// ======================================================
// CONSULTAR ENVÍO INICIAL
// ======================================================

async function obtenerEnvioBase(
  client,
  alertaId
) {
  const { rows } = await client.query(
    `
      SELECT
        id,
        alerta_id,
        secuencia_notificacion,
        canal,
        plantilla_meta,
        contenido_enviado

      FROM alertas_envios

      WHERE alerta_id = $1

        AND secuencia_notificacion = 1

        AND canal = $2

        AND plantilla_meta IS NOT NULL

        AND TRIM(plantilla_meta) <> ''

        AND contenido_enviado IS NOT NULL

        AND TRIM(contenido_enviado) <> ''

      ORDER BY id ASC

      LIMIT 1
    `,
    [
      alertaId,
      CANAL_WHATSAPP,
    ]
  );

  return rows[0] || null;
}

// ======================================================
// VALIDAR NIVEL VIGENTE DEL ESP8266
// ======================================================
//
// Solo NIVEL_AVISO y NIVEL_ALTO.
//
// Lectura vigente y porcentaje >= umbral:
// permite generar recordatorio.
//
// Lectura inferior al umbral:
// suspende recordatorio.
//
// Lectura vencida:
// suspende sin interpretar 0 % como nivel real.
//
// No reinicia el ciclo de alertas.
// No modifica indicadores de recolección.
//
// ======================================================

function validarNivelParaRecordatorio(alerta) {
  if (!TIPOS_NIVEL.has(alerta.tipo)) {
    return {
      permitido: true,
      motivo: "NO_REQUIERE_VALIDACION_NIVEL",
    };
  }

  const contenedorId = Number(
    alerta.contenedor_id
  );

  const umbral = Number(
    alerta.umbral_configurado
  );

  if (
    !Number.isSafeInteger(contenedorId) ||
    contenedorId <= 0 ||
    alerta.umbral_configurado === null ||
    alerta.umbral_configurado === undefined ||
    !Number.isFinite(umbral) ||
    umbral < 0 ||
    umbral > 100
  ) {
    return {
      permitido: false,
      motivo: "DATOS_ALERTA_NIVEL_INVALIDOS",
    };
  }

  const lectura =
    NivelCacheService.obtenerNivelVigente(
      contenedorId
    );

  if (!lectura || lectura.vigente !== true) {
    return {
      permitido: false,
      motivo: "SIN_LECTURA_VIGENTE",
      contenedorId,
    };
  }

  const porcentaje = Number(
    lectura.porcentaje
  );

  if (
    !Number.isFinite(porcentaje) ||
    porcentaje < 0 ||
    porcentaje > 100
  ) {
    return {
      permitido: false,
      motivo: "LECTURA_NIVEL_INVALIDA",
      contenedorId,
    };
  }

  if (porcentaje < umbral) {
    return {
      permitido: false,
      motivo: "NIVEL_DEBAJO_DEL_UMBRAL",
      contenedorId,
      porcentaje,
      umbral,
    };
  }

  return {
    permitido: true,
    motivo: "NIVEL_VIGENTE_EN_UMBRAL",
    contenedorId,
    porcentaje,
    umbral,
  };
}

// ======================================================
// VALIDAR FECHA DE ALERTA PROGRAMADA
// ======================================================
//
// REGLA NUEVA:
//
// PROGRAMADA solo puede generar recordatorios
// el mismo día de fecha_programada_original,
// tomando como referencia America/Guatemala.
//
// La comparación se realiza en PostgreSQL.
//
// No depende de la zona horaria de Railway.
//
// Para alertas de nivel no aplica.
//
// ======================================================

async function validarFechaProgramada(
  client,
  alerta
) {
  if (alerta.tipo !== "PROGRAMADA") {
    return {
      permitido: true,
      motivo: "NO_ES_ALERTA_PROGRAMADA",
    };
  }

  if (
    alerta.fecha_programada_original === null ||
    alerta.fecha_programada_original === undefined
  ) {
    return {
      permitido: false,
      motivo: "FECHA_PROGRAMADA_NO_DISPONIBLE",
    };
  }

  const { rows } = await client.query(
    `
      SELECT
        (
          $1::timestamptz AT TIME ZONE $2
        )::date
        =
        (
          clock_timestamp() AT TIME ZONE $2
        )::date
        AS corresponde_hoy
    `,
    [
      alerta.fecha_programada_original,
      ZONA_HORARIA,
    ]
  );

  const permitido =
    rows[0]?.corresponde_hoy === true;

  return {
    permitido,
    motivo: permitido
      ? "FECHA_PROGRAMADA_VIGENTE"
      : "FECHA_PROGRAMADA_FUERA_DEL_DIA",
  };
}

// ======================================================
// VALIDAR RECORDATORIO SEGÚN TIPO
// ======================================================
//
// NIVEL:
// valida la lectura real del ESP8266.
//
// PROGRAMADA:
// valida el día original de programación.
//
// ======================================================

async function validarRecordatorio(
  client,
  alerta
) {
  if (alerta.tipo === "PROGRAMADA") {
    return validarFechaProgramada(
      client,
      alerta
    );
  }

  return validarNivelParaRecordatorio(
    alerta
  );
}

// ======================================================
// OBTENER SIGUIENTE ALERTA ELEGIBLE
// ======================================================
//
// Se conservan:
//
// - Solo alertas ACTIVAS.
// - Hasta 3 recordatorios.
// - Intervalos configurados por .env.
// - No incluir PREDICTIVA.
// - Esperar envío anterior ACEPTADO.
// - No recordar NIVEL_AVISO cuando existe
//   NIVEL_ALTO posterior activo.
//
// NUEVO:
//
// PROGRAMADA debe corresponder a HOY
// según America/Guatemala.
//
// ======================================================

async function obtenerSiguienteAlerta(
  client,
  alertasExcluidas = []
) {
  const intervaloMin =
    obtenerIntervaloRecordatorioMin();

  const limite =
    obtenerLimitePorCiclo();

  const { rows } = await client.query(
    `
      WITH ultima_secuencia AS (
        SELECT
          ae.alerta_id,

          MAX(
            ae.secuencia_notificacion
          )::integer AS ultima_secuencia

        FROM alertas_envios ae

        WHERE ae.canal = $1

        GROUP BY ae.alerta_id
      )

      SELECT
        a.id,
        a.tipo,
        a.contenedor_id,
        a.motivo,
        a.mensaje,
        a.estado,
        a.umbral_configurado,

        a.fecha_programada_original,

        a.fecha_creacion,
        a.fecha_activacion,

        us.ultima_secuencia,

        completada.fecha_completada

      FROM alertas a

      INNER JOIN ultima_secuencia us
        ON us.alerta_id = a.id

      JOIN LATERAL (
        SELECT
          MAX(ae2.fecha_intento)
            AS fecha_completada

        FROM alertas_envios ae2

        WHERE ae2.alerta_id = a.id

          AND ae2.secuencia_notificacion =
              us.ultima_secuencia

          AND ae2.estado = $2

          AND ae2.canal IN ($1, $3)

      ) AS completada
        ON TRUE

      WHERE a.estado = $4

        AND a.tipo = ANY($5::text[])

        AND us.ultima_secuencia >= 1

        AND us.ultima_secuencia < $6

        AND completada.fecha_completada
            IS NOT NULL

        AND completada.fecha_completada
            + (
                $7::integer *
                INTERVAL '1 minute'
              )
            <= clock_timestamp()

        -- ==========================================
        -- NUEVA REGLA PARA ALERTAS PROGRAMADAS
        -- ==========================================
        --
        -- Las alertas de nivel no se afectan.
        --
        -- PROGRAMADA solo se procesa si
        -- su fecha original corresponde a hoy.
        --
        -- ==========================================

        AND (
          a.tipo <> 'PROGRAMADA'

          OR (
            a.fecha_programada_original
              IS NOT NULL

            AND (
              a.fecha_programada_original
                AT TIME ZONE $10
            )::date
            =
            (
              clock_timestamp()
                AT TIME ZONE $10
            )::date
          )
        )

        -- ==========================================
        -- EVITAR RECORDATORIOS DE NIVEL INFERIOR
        -- SI YA EXISTE NIVEL ALTO ACTIVO
        -- ==========================================

        AND NOT (
          a.tipo = 'NIVEL_AVISO'

          AND EXISTS (
            SELECT 1

            FROM alertas alta

            WHERE alta.tipo = 'NIVEL_ALTO'

              AND alta.contenedor_id =
                  a.contenedor_id

              AND alta.estado = 'ACTIVA'

              AND alta.fecha_creacion >=
                  a.fecha_creacion
          )
        )

        -- ==========================================
        -- REQUERIR ENVÍO INICIAL CON PLANTILLA
        -- ==========================================

        AND EXISTS (
          SELECT 1

          FROM alertas_envios inicial

          WHERE inicial.alerta_id = a.id

            AND inicial.secuencia_notificacion = 1

            AND inicial.canal = $1

            AND inicial.plantilla_meta
              IS NOT NULL

            AND TRIM(
              inicial.plantilla_meta
            ) <> ''
        )

        AND NOT (
          a.id = ANY($9::integer[])
        )

      ORDER BY
        completada.fecha_completada ASC,
        a.id ASC

      LIMIT $8

      FOR UPDATE OF a
      SKIP LOCKED
    `,
    [
      CANAL_WHATSAPP,
      ESTADO_ENVIO_ACEPTADO,
      CANAL_EMAIL,
      ESTADO_ALERTA_ACTIVA,
      TIPOS_PERMITIDOS,
      MAX_SECUENCIA_NOTIFICACION,
      intervaloMin,
      limite,
      alertasExcluidas,
      ZONA_HORARIA,
    ]
  );

  for (const alerta of rows) {
    const validacion =
      await validarRecordatorio(
        client,
        alerta
      );

    if (!validacion.permitido) {
      continue;
    }

    return alerta;
  }

  return null;
}

// ======================================================
// CREAR SIGUIENTE RECORDATORIO
// ======================================================

async function crearSiguienteRecordatorio(
  alertasExcluidas = []
) {
  const client = await pool.connect();
  let transaccionActiva = false;

  try {
    await client.query("BEGIN");
    transaccionActiva = true;

    // ==================================================
    // 1. BUSCAR ALERTA ELEGIBLE
    // ==================================================

    const alerta =
      await obtenerSiguienteAlerta(
        client,
        alertasExcluidas
      );

    if (!alerta) {
      await client.query("COMMIT");
      transaccionActiva = false;

      return {
        accion: "SIN_RECORDATORIOS_PENDIENTES",
      };
    }

    // ==================================================
    // 2. DETERMINAR SIGUIENTE SECUENCIA
    // ==================================================

    const ultimaSecuencia = Number(
      alerta.ultima_secuencia
    );

    if (
      !Number.isSafeInteger(ultimaSecuencia) ||
      ultimaSecuencia < 1 ||
      ultimaSecuencia >=
        MAX_SECUENCIA_NOTIFICACION
    ) {
      throw new Error(
        "La secuencia actual de la alerta no es válida."
      );
    }

    const siguienteSecuencia =
      ultimaSecuencia + 1;

    // ==================================================
    // 3. OBTENER PLANTILLA ORIGINAL
    // ==================================================

    const envioBase =
      await obtenerEnvioBase(
        client,
        alerta.id
      );

    if (!envioBase) {
      throw new Error(
        "No existe un envío inicial válido para generar el recordatorio."
      );
    }

    const plantilla = String(
      envioBase.plantilla_meta ?? ""
    ).trim();

    if (!plantilla) {
      throw new Error(
        "El envío inicial no contiene plantilla Meta."
      );
    }

    const contenido =
      leerContenidoEstructurado(
        envioBase.contenido_enviado
      );

    // ==================================================
    // 4. PREPARAR MENSAJE
    // ==================================================

    const mensaje =
      contenido.mensaje ||
      String(
        alerta.mensaje ?? ""
      ).trim();

    if (!mensaje) {
      throw new Error(
        "La alerta no contiene mensaje para el recordatorio."
      );
    }

    // ==================================================
    // 5. REVALIDAR ANTES DE CREAR ENVÍO
    // ==================================================
    //
    // NIVEL:
    // vuelve a consultar el ESP8266.
    //
    // PROGRAMADA:
    // vuelve a verificar el día Guatemala.
    //
    // Esto cubre un cambio de día mientras
    // se preparaba el recordatorio.
    //
    // ==================================================

    const validacionFinal =
      await validarRecordatorio(
        client,
        alerta
      );

    if (!validacionFinal.permitido) {
      await client.query("COMMIT");
      transaccionActiva = false;

      return {
        accion: "RECORDATORIO_SUSPENDIDO",
        alertaId: alerta.id,
        motivo: validacionFinal.motivo,
      };
    }

    // ==================================================
    // 6. CREAR ENVÍO PENDIENTE
    // ==================================================

    const resultadoEnvio =
      await AlertaEnviosService
        .crearEnvioWhatsAppPendiente(
          client,
          {
            alertaId: alerta.id,
            mensaje,
            plantillaMeta: plantilla,

            parametrosPlantilla:
              contenido.parametros,

            secuenciaNotificacion:
              siguienteSecuencia,

            intento: 1,

            fechaProgramadaIntento: null,
          }
        );

    // ==================================================
    // 7. SIN DESTINATARIO
    // ==================================================

    if (
      resultadoEnvio.motivo ===
      "SIN_DESTINATARIO_WHATSAPP"
    ) {
      await client.query("COMMIT");
      transaccionActiva = false;

      return {
        accion: "SIN_DESTINATARIO",
        alertaId: alerta.id,
        siguienteSecuencia,
      };
    }

    if (!resultadoEnvio.envio?.id) {
      throw new Error(
        "No fue posible crear el recordatorio de WhatsApp."
      );
    }

    // ==================================================
    // 8. VERIFICACIÓN FINAL PARA PROGRAMADA
    // ==================================================
    //
    // Si el día cambió después de crear el registro,
    // revertimos la transacción completa.
    //
    // Así tampoco queda el nuevo envío en la cola.
    //
    // ==================================================

    if (alerta.tipo === "PROGRAMADA") {
      const ultimaValidacion =
        await validarFechaProgramada(
          client,
          alerta
        );

      if (!ultimaValidacion.permitido) {
        await client.query("ROLLBACK");
        transaccionActiva = false;

        return {
          accion: "RECORDATORIO_SUSPENDIDO",
          alertaId: alerta.id,
          motivo: "FECHA_PROGRAMADA_FUERA_DEL_DIA",
        };
      }
    }

    // ==================================================
    // 9. CONFIRMAR
    // ==================================================

    await client.query("COMMIT");
    transaccionActiva = false;

    return {
      accion: resultadoEnvio.creado
        ? "RECORDATORIO_CREADO"
        : "RECORDATORIO_YA_EXISTE",

      alertaId: alerta.id,

      tipo: alerta.tipo,

      secuencia: siguienteSecuencia,

      numeroRecordatorio:
        siguienteSecuencia - 1,

      envioId: resultadoEnvio.envio.id,

      plantilla,
    };

  } catch (error) {
    if (transaccionActiva) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Error revirtiendo recordatorio WhatsApp:",
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
// EJECUTAR CICLO DEL MONITOR
// ======================================================

async function ejecutarCiclo() {
  if (ejecucionEnCurso) {
    return {
      accion: "CICLO_EN_PROCESO",
    };
  }

  ejecucionEnCurso = true;

  const resultados = [];
  const alertasExcluidas = new Set();

  try {
    const limite =
      obtenerLimitePorCiclo();

    for (let i = 0; i < limite; i++) {
      const resultado =
        await crearSiguienteRecordatorio(
          Array.from(alertasExcluidas)
        );

      if (
        resultado.accion ===
        "SIN_RECORDATORIOS_PENDIENTES"
      ) {
        break;
      }

      resultados.push(resultado);

      if (resultado.alertaId) {
        alertasExcluidas.add(
          resultado.alertaId
        );
      }

      if (
        resultado.accion ===
        "SIN_DESTINATARIO"
      ) {
        break;
      }

      if (
        resultado.accion ===
        "RECORDATORIO_CREADO"
      ) {
        console.log(
          `Recordatorio WhatsApp ${resultado.numeroRecordatorio}/${MAX_RECORDATORIOS} creado | alerta ${resultado.alertaId} | envío ${resultado.envioId}`
        );
      }
    }

    return {
      accion: "CICLO_COMPLETADO",
      total: resultados.length,
      resultados,
    };

  } catch (error) {
    console.error(
      "Error ejecutando recordatorios WhatsApp:",
      error.message
    );

    return {
      accion: "ERROR_RECORDATORIOS_WHATSAPP",
      error: error.message,
      resultados,
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

  const intervaloMs =
    obtenerIntervaloMonitorMs();

  await ejecutarCiclo();

  timerMonitor = setInterval(() => {
    ejecutarCiclo().catch(error => {
      console.error(
        "Error inesperado en monitor de recordatorios WhatsApp:",
        error.message
      );
    });
  }, intervaloMs);

  console.log(
    `Monitor de recordatorios WhatsApp activo cada ${intervaloMs} ms.`
  );

  return {
    iniciado: true,

    intervaloMs,

    intervaloRecordatorioMin:
      obtenerIntervaloRecordatorioMin(),

    maxRecordatorios:
      MAX_RECORDATORIOS,
  };
}

// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitor() {
  if (timerMonitor) {
    clearInterval(timerMonitor);
    timerMonitor = null;
  }

  ejecucionEnCurso = false;

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
  crearSiguienteRecordatorio,
};
