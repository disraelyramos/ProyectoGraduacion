"use strict";

const pool = require("../../config/db");

const PrediccionService = require("./prediccion.service");

const AlertaEnviosService = require(
  "../controlDSH/alertas/AlertaEnvios.service"
);

// ======================================================
// CONFIGURACIÓN
// ======================================================

function numeroEnv(nombre, defecto) {
  const valor = Number(process.env[nombre] ?? defecto);

  if (!Number.isFinite(valor) || valor <= 0) {
    throw new Error(
      `${nombre} debe ser un número mayor que cero.`
    );
  }

  return valor;
}

const CONFIG = Object.freeze({
  aviso: numeroEnv(
    "ML_AVISO_INICIAL_DIAS",
    5
  ),

  recordatorio1: numeroEnv(
    "ML_RECORDATORIO_1_DIAS",
    2
  ),

  recordatorio2: numeroEnv(
    "ML_RECORDATORIO_2_DIAS",
    1
  ),

  recordatorio3: numeroEnv(
    "ML_RECORDATORIO_3_DIAS",
    0.25
  ),

  separacionMs: numeroEnv(
    "ML_SEPARACION_MIN_NOTIFICACIONES_MS",
    21600000
  ),
});

if (
  !(
    CONFIG.aviso > CONFIG.recordatorio1 &&
    CONFIG.recordatorio1 > CONFIG.recordatorio2 &&
    CONFIG.recordatorio2 > CONFIG.recordatorio3
  )
) {
  throw new Error(
    "ML requiere: aviso inicial > recordatorio 1 > " +
    "recordatorio 2 > recordatorio 3 > 0."
  );
}

const ESTADOS_OK = new Set([
  "ACEPTADO",
  "ENVIADO",
  "ENTREGADO",
  "LEIDO",
]);

// ======================================================
// HELPERS
// ======================================================

const redondear2 = (valor) =>
  Number(valor.toFixed(2));

function numero(valor) {
  if (
    valor === null ||
    valor === undefined ||
    typeof valor === "boolean" ||
    (
      typeof valor === "string" &&
      !valor.trim()
    )
  ) {
    return null;
  }

  const resultado = Number(valor);

  return Number.isFinite(resultado)
    ? resultado
    : null;
}

function formatearTiempoEstimado(dias) {
  const valor = numero(dias);

  if (valor === null || valor < 0) {
    throw new Error(
      "Tiempo estimado inválido."
    );
  }

  if (valor === 0) {
    return "nivel alto alcanzado";
  }

  const minutos = Math.max(
    1,
    Math.round(valor * 1440)
  );

  if (minutos < 60) {
    return `${minutos} ${
      minutos === 1 ? "minuto" : "minutos"
    }`;
  }

  const horas = Math.round(minutos / 60);

  const diasEnteros = Math.floor(horas / 24);

  const horasRestantes = horas % 24;

  const partes = [];

  if (diasEnteros) {
    partes.push(
      `${diasEnteros} ${
        diasEnteros === 1 ? "día" : "días"
      }`
    );
  }

  if (horasRestantes) {
    partes.push(
      `${horasRestantes} ${
        horasRestantes === 1 ? "hora" : "horas"
      }`
    );
  }

  return partes.join(" y ");
}

// ======================================================
// RANGO ACTUAL DE NOTIFICACIÓN
// ======================================================
//
// 1 = aviso inicial
// 2 = recordatorio 1
// 3 = recordatorio 2
// 4 = recordatorio 3
//
// Si el nivel alto ya fue alcanzado, no se genera
// una nueva notificación predictiva.
// ======================================================

function obtenerSecuenciaPorTiempo(dias) {
  const valor = numero(dias);

  if (
    valor === null ||
    valor <= 0 ||
    valor > CONFIG.aviso
  ) {
    return null;
  }

  if (valor <= CONFIG.recordatorio3) {
    return 4;
  }

  if (valor <= CONFIG.recordatorio2) {
    return 3;
  }

  if (valor <= CONFIG.recordatorio1) {
    return 2;
  }

  return 1;
}

// ======================================================
// VALIDAR PREDICCIÓN
// ======================================================

function validarPrediccion(prediccion) {
  if (
    !prediccion ||
    typeof prediccion !== "object" ||
    Array.isArray(prediccion)
  ) {
    throw new Error(
      "Predicción inválida."
    );
  }

  const contenedorId = numero(
    prediccion.contenedor_id
  );

  if (
    !Number.isSafeInteger(contenedorId) ||
    contenedorId <= 0
  ) {
    throw new Error(
      "Contenedor de predicción inválido."
    );
  }

  if (
    typeof prediccion.estado !== "string" ||
    !prediccion.estado.trim()
  ) {
    throw new Error(
      "Estado de predicción inválido."
    );
  }

  if (prediccion.estado !== "OK") {
    return {
      contenedorId,
      estado: prediccion.estado,
    };
  }

  const nivelActual = numero(
    prediccion.nivel_actual
  );

  const crecimiento = numero(
    prediccion.crecimiento_estimado_dia
  );

  const diasParaAlto = numero(
    prediccion.dias_para_alto
  );

  const umbralAlto = numero(
    prediccion.umbral_alto
  );

  const riesgo = String(
    prediccion.riesgo ?? ""
  )
    .trim()
    .toUpperCase();

  if (
    nivelActual === null ||
    nivelActual < 0 ||
    nivelActual > 100 ||
    crecimiento === null ||
    crecimiento < 0 ||
    diasParaAlto === null ||
    diasParaAlto < 0 ||
    umbralAlto === null ||
    umbralAlto <= 0 ||
    umbralAlto > 100 ||
    !["BAJO", "MEDIO", "ALTO"].includes(riesgo)
  ) {
    throw new Error(
      "La predicción contiene valores inválidos."
    );
  }

  return {
    contenedorId,
    estado: "OK",
    nivelActual,
    crecimiento,
    diasParaAlto,
    umbralAlto,
    riesgo,
  };
}

// ======================================================
// MENSAJE
// ======================================================

function crearMensajeTrazabilidad(
  contenedor,
  datos
) {
  return (
    `El contenedor ${contenedor.codigo} ` +
    `(${contenedor.tipo_residuo}) ` +
    `presenta riesgo predictivo ${datos.riesgo}. ` +
    `El modelo estima que alcanzará ` +
    `su nivel alto (${datos.umbralAlto}%) ` +
    `en aproximadamente ${
      formatearTiempoEstimado(
        datos.diasParaAlto
      )
    }. ` +
    `Nivel actual: ${
      redondear2(datos.nivelActual)
    }%.`
  );
}

// ======================================================
// CONSULTAR ENVÍOS
// ======================================================

async function obtenerEnvios(
  client,
  alertaId
) {
  const { rows } = await client.query(
    `
      SELECT
        id,
        canal,
        secuencia_notificacion,
        intento,
        estado,
        plantilla_meta,
        contenido_enviado,
        fecha_programada_intento,
        fecha_intento,
        fecha_actualizacion,
        CURRENT_TIMESTAMP AS fecha_evaluacion

      FROM alertas_envios

      WHERE alerta_id = $1

      ORDER BY
        secuencia_notificacion,
        intento,
        id
    `,
    [alertaId]
  );

  return rows;
}

function secuenciaFinalizada(
  envios,
  secuencia
) {
  return envios.some(
    (envio) =>
      envio.canal === "WHATSAPP" &&

      Number(
        envio.secuencia_notificacion
      ) === secuencia &&

      (
        ESTADOS_OK.has(envio.estado) ||

        (
          Number(envio.intento) === 3 &&
          envio.estado === "FALLIDO"
        )
      )
  );
}

// ======================================================
// RANGOS YA CUBIERTOS
// ======================================================
//
// El aviso inicial siempre utiliza secuencia 1.
//
// Si se crea cuando faltan 12 horas, también cubre
// los rangos de 2 días y 1 día. No se generan después
// esos recordatorios atrasados.
//
// La marca queda en alertas.mensaje.
// No requiere nuevas columnas y no se incorpora
// a los parámetros de la plantilla de WhatsApp.
// ======================================================

function obtenerRangoCubierto(
  alerta,
  envios
) {
  let rango = Math.max(
    1,
    ...envios.map(
      (envio) =>
        Number(
          envio.secuencia_notificacion
        )
    )
  );

  const texto = String(
    alerta.mensaje ?? ""
  );

  const marca = texto.match(
    /\[ML_RANGO_INICIAL=([1-4])\]/
  );

  if (marca) {
    return Math.max(
      rango,
      Number(marca[1])
    );
  }

  // Compatibilidad con avisos de la versión anterior.
  const tiempo = texto.match(
    /en aproximadamente\s+(\d+(?:\.\d+)?)\s*(días?|horas?|minutos?)(?:\s+y\s+(\d+)\s+horas?)?/i
  );

  if (!tiempo) {
    return rango;
  }

  let dias = Number(tiempo[1]);

  const unidad = tiempo[2].toLowerCase();

  if (unidad.startsWith("hora")) {
    dias /= 24;
  } else if (unidad.startsWith("minuto")) {
    dias /= 1440;
  }

  if (tiempo[3]) {
    dias += Number(tiempo[3]) / 24;
  }

  return Math.max(
    rango,
    obtenerSecuenciaPorTiempo(dias) ?? 1
  );
}

// ======================================================
// CREAR ENVÍO PENDIENTE
// ======================================================
//
// Los reintentos y el correo de respaldo continúan
// siendo responsabilidad de los servicios existentes.
// ======================================================

async function crearEnvio(
  client,
  alerta,
  contenedor,
  datos,
  secuencia
) {
  const plantilla = String(
    process.env.WHATSAPP_TEMPLATE_PREDICCION ?? ""
  ).trim();

  if (!plantilla) {
    throw new Error(
      "WHATSAPP_TEMPLATE_PREDICCION no está configurado."
    );
  }

  return AlertaEnviosService
    .crearEnvioWhatsAppPendiente(
      client,
      {
        alertaId: alerta.id,

        mensaje: crearMensajeTrazabilidad(
          contenedor,
          datos
        ),

        plantillaMeta: plantilla,

        parametrosPlantilla: [
          `${contenedor.codigo} (${contenedor.tipo_residuo})`,

          formatearTiempoEstimado(
            datos.diasParaAlto
          ),
        ],

        secuenciaNotificacion: secuencia,

        intento: 1,

        fechaProgramadaIntento: null,
      }
    );
}

// ======================================================
// PROCESAR AVISO O RECORDATORIO
// ======================================================

async function procesarNotificacion(
  client,
  alerta,
  contenedor,
  datos
) {
  if (alerta.estado !== "ACTIVA") {
    return {
      accion: "ALERTA_PREDICTIVA_NO_ACTIVA",
    };
  }

  const envios = (
    await obtenerEnvios(
      client,
      alerta.id
    )
  ).filter(
    (envio) =>
      envio.canal === "WHATSAPP"
  );

  const iniciales = envios.filter(
    (envio) =>
      Number(
        envio.secuencia_notificacion
      ) === 1
  );

  // Primero se asegura el aviso inicial.
  if (!iniciales.length) {
    const rango = obtenerSecuenciaPorTiempo(
      datos.diasParaAlto
    );

    const mensaje =
      `${crearMensajeTrazabilidad(
        contenedor,
        datos
      )} [ML_RANGO_INICIAL=${rango}]`;

    await client.query(
      `
        UPDATE alertas
        SET mensaje = $1
        WHERE id = $2
      `,
      [
        mensaje,
        alerta.id,
      ]
    );

    alerta.mensaje = mensaje;

    const envio = await crearEnvio(
      client,
      alerta,
      contenedor,
      datos,
      1
    );

    return {
      accion: "ENVIO_INICIAL_PREDICTIVO_CREADO",
      envio,
    };
  }

  if (
    !iniciales.some(
      (envio) =>
        String(
          envio.plantilla_meta ?? ""
        ).trim()
    )
  ) {
    return {
      accion: "ENVIO_INICIAL_NO_COMPATIBLE",
    };
  }

  const objetivo = obtenerSecuenciaPorTiempo(
    datos.diasParaAlto
  );

  const rangoCubierto = obtenerRangoCubierto(
    alerta,
    envios
  );

  if (
    !objetivo ||
    objetivo <= rangoCubierto
  ) {
    return {
      accion: "SIN_NUEVO_RECORDATORIO",
    };
  }

  const ultima = Math.max(
    ...envios.map(
      (envio) =>
        Number(
          envio.secuencia_notificacion
        )
    )
  );

  if (
    !secuenciaFinalizada(
      envios,
      ultima
    )
  ) {
    return {
      accion: "ESPERANDO_ENVIO_PREDICTIVO_ANTERIOR",
    };
  }

  const ultimaFecha = Math.max(
    ...envios.map(
      (envio) => {
        const fechas = [
          envio.fecha_intento,
          envio.fecha_actualizacion,
          envio.fecha_programada_intento,
        ]
          .filter(Boolean)
          .map(
            (fecha) =>
              new Date(fecha).getTime()
          )
          .filter(Number.isFinite);

        return fechas.length
          ? Math.max(...fechas)
          : NaN;
      }
    )
  );

  const ahora = new Date(
    envios[0].fecha_evaluacion
  ).getTime();

  if (
    !Number.isFinite(ultimaFecha) ||
    !Number.isFinite(ahora)
  ) {
    return {
      accion: "FECHA_ENVIO_PREVIO_NO_DISPONIBLE",
    };
  }

  if (
    ahora - ultimaFecha <
    CONFIG.separacionMs
  ) {
    return {
      accion: "ESPERANDO_SEPARACION_MINIMA",
    };
  }

  const envio = await crearEnvio(
    client,
    alerta,
    contenedor,
    datos,
    objetivo
  );

  return {
    accion: "RECORDATORIO_PREDICTIVO_CREADO",

    secuencia: objetivo,

    numero_recordatorio: objetivo - 1,

    envio,
  };
}

// ======================================================
// EVALUAR UNA PREDICCIÓN
// ======================================================

async function evaluarPrediccion(
  prediccion
) {
  const datos = validarPrediccion(
    prediccion
  );

  const base = {
    contenedor_id: datos.contenedorId,

    alerta: null,

    envio_whatsapp: null,
  };

  if (datos.estado !== "OK") {
    return {
      ...base,

      accion: "PREDICCION_NO_DISPONIBLE",

      estado_prediccion: datos.estado,
    };
  }

  // El evento ya ocurrió: corresponde a las alertas
  // de nivel existentes, no a un nuevo aviso predictivo.
  if (
    datos.nivelActual >= datos.umbralAlto ||
    datos.diasParaAlto <= 0
  ) {
    return {
      ...base,

      accion: "NIVEL_ALTO_YA_ALCANZADO",
    };
  }

  // La decisión se toma por tiempo estimado.
  // No depende de una clasificación fija de 3 días.
  if (
    datos.diasParaAlto >
    CONFIG.aviso
  ) {
    return {
      ...base,

      accion: "SIN_ALERTA_PREDICTIVA",

      dias_para_alto: datos.diasParaAlto,
    };
  }

  const client = await pool.connect();

  let transaccion = false;

  try {
    await client.query("BEGIN");

    transaccion = true;

    await client.query(
      `
        INSERT INTO estado_alertas_contenedor
          (contenedor_id)

        VALUES ($1)

        ON CONFLICT (contenedor_id)
        DO NOTHING
      `,
      [datos.contenedorId]
    );

    // Serializa evaluaciones del mismo contenedor.
    const estadoResultado = await client.query(
      `
        SELECT fecha_reinicio

        FROM estado_alertas_contenedor

        WHERE contenedor_id = $1

        FOR UPDATE
      `,
      [datos.contenedorId]
    );

    if (!estadoResultado.rows.length) {
      throw new Error(
        "No se encontró el estado del ciclo."
      );
    }

    const contenedorResultado = await client.query(
      `
        SELECT
          c.id_contenedor,
          c.codigo,
          tr.nombre AS tipo_residuo

        FROM contenedores c

        JOIN tipos_residuo tr
          ON tr.id = c.id_tipo_residuo

        WHERE c.id_contenedor = $1
      `,
      [datos.contenedorId]
    );

    const contenedor =
      contenedorResultado.rows[0];

    if (!contenedor) {
      throw new Error(
        "No existe el contenedor evaluado."
      );
    }

    const existente = await client.query(
      `
        SELECT *

        FROM alertas

        WHERE tipo = $1

          AND contenedor_id = $2

          AND (
            $3::timestamptz IS NULL

            OR fecha_creacion >=
              $3::timestamptz
          )

        ORDER BY
          fecha_creacion DESC,
          id DESC

        LIMIT 1
      `,
      [
        "PREDICTIVA",

        datos.contenedorId,

        estadoResultado.rows[0]
          .fecha_reinicio ?? null,
      ]
    );

    let alerta = existente.rows[0];

    const nueva = !alerta;

    if (nueva) {
      const resultado = await client.query(
        `
          INSERT INTO alertas
          (
            tipo,
            contenedor_id,
            lectura_id,
            motivo,
            nivel_porcentaje,
            umbral_configurado,
            fecha_programada_original,
            proxima_ejecucion,
            cantidad_posposiciones,
            mensaje,
            estado,
            creado_por,
            fecha_creacion,
            fecha_activacion
          )

          VALUES
          (
            $1,
            $2,
            NULL,
            $3,
            $4,
            $5,
            NULL,
            NULL,
            0,
            $6,
            'ACTIVA',
            NULL,
            CURRENT_TIMESTAMP,
            CURRENT_TIMESTAMP
          )

          RETURNING *
        `,
        [
          "PREDICTIVA",

          datos.contenedorId,

          `RIESGO_${datos.riesgo}`,

          redondear2(
            datos.nivelActual
          ),

          redondear2(
            datos.umbralAlto
          ),

          crearMensajeTrazabilidad(
            contenedor,
            datos
          ),
        ]
      );

      alerta = resultado.rows[0];
    }

    const notificacion =
      await procesarNotificacion(
        client,
        alerta,
        contenedor,
        datos
      );

    await client.query("COMMIT");

    transaccion = false;

    return {
      ...base,

      accion: nueva
        ? "ALERTA_PREDICTIVA_CREADA"
        : notificacion.accion,

      riesgo: datos.riesgo,

      dias_para_alto: datos.diasParaAlto,

      alerta,

      recordatorio: notificacion,

      envio_whatsapp:
        notificacion.envio ?? null,
    };
  } catch (error) {
    if (transaccion) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "ML: error de rollback:",
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
// EVALUAR TODOS LOS CONTENEDORES
// ======================================================

async function evaluarPredicciones() {
  const predicciones =
    await PrediccionService
      .ejecutarPrediccion();

  const resultados = [];

  for (const prediccion of predicciones) {
    resultados.push(
      await evaluarPrediccion(
        prediccion
      )
    );
  }

  return {
    total: resultados.length,

    resultados,
  };
}

module.exports = {
  evaluarPrediccion,

  evaluarPredicciones,

  formatearTiempoEstimado,

  obtenerSecuenciaPorTiempo,
};