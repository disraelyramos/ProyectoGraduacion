
"use strict";

const pool = require("../../../config/db");

const {
  enviarPlantillaWhatsApp,
  MetaWhatsAppError,
} = require("./MetaWhatsApp.service");

const {
  registrarAceptacionMeta,
  registrarFalloMeta,
} = require("./ResultadoEnvios.service");

const {
  enviarRespaldoEmail,
} = require("./RespaldoEmail.service");

const NivelCacheService = require(
  "../mediciones/NivelActualCache.service"
);

// ======================================================
// CONSTANTES
// ======================================================

const CANAL_WHATSAPP = "WHATSAPP";
const ESTADO_PENDIENTE = "PENDIENTE";
const ESTADO_ALERTA_ACTIVA = "ACTIVA";

const ZONA_HORARIA = "America/Guatemala";

const TIPOS_NIVEL = new Set([
  "NIVEL_AVISO",
  "NIVEL_ALTO",
]);

const MAX_INTENTOS_WHATSAPP = 3;
const LIMITE_MAXIMO_CONSULTA = 100;

// ======================================================
// VALIDACIONES
// ======================================================

function validarEnteroPositivo(valor, nombre) {
  const numero = Number(valor);

  if (
    !Number.isSafeInteger(numero) ||
    numero <= 0
  ) {
    throw new Error(`${nombre} inválido.`);
  }

  return numero;
}

function validarLimite(valor) {
  return Math.min(
    validarEnteroPositivo(valor, "Límite"),
    LIMITE_MAXIMO_CONSULTA
  );
}

// ======================================================
// CONFIGURACIÓN DE WHATSAPP
// ======================================================

function obtenerIdiomaWhatsApp() {
  const idioma = String(
    process.env.WHATSAPP_LANGUAGE || "es"
  ).trim();

  if (!idioma) {
    throw new Error(
      "WHATSAPP_LANGUAGE no está configurado correctamente."
    );
  }

  return idioma;
}

// ======================================================
// LEER CONTENIDO ESTRUCTURADO
// ======================================================

function leerContenidoEstructurado(contenidoEnviado) {
  const contenido = String(
    contenidoEnviado ?? ""
  ).trim();

  if (!contenido) {
    throw new Error(
      "El envío no contiene información para procesar."
    );
  }

  let datos;

  try {
    datos = JSON.parse(contenido);
  } catch {
    throw new Error(
      "El contenido del envío no tiene el formato estructurado esperado."
    );
  }

  if (
    !datos ||
    typeof datos !== "object" ||
    Array.isArray(datos)
  ) {
    throw new Error(
      "El contenido estructurado del envío no es válido."
    );
  }

  if (Number(datos.version) !== 1) {
    throw new Error(
      "La versión del contenido del envío no es compatible."
    );
  }

  if (
    !Array.isArray(datos.parametros) ||
    datos.parametros.length === 0
  ) {
    throw new Error(
      "El envío no contiene parámetros para la plantilla de WhatsApp."
    );
  }

  const parametros = datos.parametros.map(
    (parametro, index) => {
      const texto = String(
        parametro ?? ""
      ).trim();

      if (!texto) {
        throw new Error(
          `El parámetro ${index + 1} de WhatsApp está vacío.`
        );
      }

      return texto;
    }
  );

  return {
    version: 1,
    mensaje: String(datos.mensaje ?? "").trim(),
    parametros,
  };
}

// ======================================================
// NORMALIZAR PLANTILLA META
// ======================================================

function normalizarPlantilla(value) {
  const plantilla = String(value ?? "").trim();

  if (!plantilla) {
    throw new Error(
      "El envío no contiene una plantilla de Meta."
    );
  }

  if (!/^[a-z0-9_]+$/.test(plantilla)) {
    throw new Error(
      "La plantilla de Meta del envío no es válida."
    );
  }

  return plantilla;
}

// ======================================================
// MANEJO DE ERRORES DE META
// ======================================================

function obtenerCodigoError(error) {
  const valor =
    error?.codigo ??
    error?.code ??
    (
      error?.status
        ? `HTTP_${error.status}`
        : null
    ) ??
    "META_WHATSAPP_ERROR";

  return (
    String(valor).trim().slice(0, 100) ||
    "META_WHATSAPP_ERROR"
  );
}

function obtenerDetalleError(error) {
  return (
    String(
      error?.message ??
      "No fue posible enviar el mensaje mediante WhatsApp."
    ).trim() ||
    "No fue posible enviar el mensaje mediante WhatsApp."
  );
}

function obtenerErrorReintentable(error) {
  if (typeof error?.reintentable === "boolean") {
    return error.reintentable;
  }

  return true;
}

// ======================================================
// VALIDAR NIVEL VIGENTE DEL ESP8266
// ======================================================
//
// Solo aplica a NIVEL_AVISO y NIVEL_ALTO.
//
// Si la lectura:
// - está vencida;
// - no existe;
// - está por debajo del umbral;
// el envío se suspende.
//
// No se interpreta un nivel no vigente como 0 % real.
//
// No se modifican alertas ni intentos técnicos.
//
// ======================================================

function validarNivelAntesDeEnviar(envio) {
  if (!TIPOS_NIVEL.has(envio.tipo_alerta)) {
    return {
      permitido: true,
      motivo: "ALERTA_SIN_VALIDACION_NIVEL",
    };
  }

  const contenedorId = Number(
    envio.contenedor_id
  );

  const umbral = Number(
    envio.umbral_configurado
  );

  if (
    !Number.isSafeInteger(contenedorId) ||
    contenedorId <= 0 ||
    envio.umbral_configurado === null ||
    envio.umbral_configurado === undefined ||
    !Number.isFinite(umbral) ||
    umbral < 0 ||
    umbral > 100
  ) {
    return {
      permitido: false,
      motivo: "DATOS_ALERTA_INVALIDOS",
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
      motivo: "LECTURA_INVALIDA",
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
    motivo: "NIVEL_VALIDADO",
    contenedorId,
    porcentaje,
    umbral,
  };
}

// ======================================================
// CONDICIÓN SQL PARA ALERTAS PROGRAMADAS
// ======================================================
//
// Una alerta PROGRAMADA solamente puede enviarse
// durante el día de fecha_programada_original
// en America/Guatemala.
//
// Para otros tipos no aplica.
//
// Se utiliza en:
// 1. Selección de la cola.
// 2. Reconsulta antes del envío.
// 3. Última verificación antes de llamar a Meta.
//
// Si Railway se reinicia al día siguiente,
// los envíos PROGRAMADA vencidos quedan excluidos.
//
// ======================================================

// ======================================================
// OBTENER ENVÍOS PENDIENTES
// ======================================================

async function obtenerEnviosPendientes({
  limite = 20,
} = {}) {
  const limiteValidado = validarLimite(limite);

  const { rows } = await pool.query(
    `
      SELECT
        ae.id,
        ae.alerta_id,
        ae.secuencia_notificacion,
        ae.canal,
        ae.intento,

        ae.usuario_destinatario_id,
        ae.destinatario,

        ae.estado,
        ae.plantilla_meta,
        ae.contenido_enviado,

        ae.fecha_programada_intento,
        ae.fecha_intento,

        a.tipo AS tipo_alerta,
        a.motivo AS motivo_alerta,
        a.contenedor_id,
        a.umbral_configurado,
        a.fecha_programada_original

      FROM alertas_envios ae

      INNER JOIN alertas a
        ON a.id = ae.alerta_id

      WHERE ae.canal = $1
        AND ae.estado = $2
        AND a.estado = $3

        AND ae.fecha_programada_intento
          <= clock_timestamp()

        AND ae.plantilla_meta IS NOT NULL
        AND TRIM(ae.plantilla_meta) <> ''

        AND ae.contenido_enviado IS NOT NULL
        AND TRIM(ae.contenido_enviado) <> ''

        AND (
          a.tipo <> 'PROGRAMADA'

          OR (
            a.fecha_programada_original
              IS NOT NULL

            AND (
              a.fecha_programada_original
                AT TIME ZONE $4
            )::date
            =
            (
              clock_timestamp()
                AT TIME ZONE $4
            )::date

            AND a.fecha_programada_original
                <= clock_timestamp()
          )
        )

      ORDER BY
        ae.fecha_programada_intento ASC,
        ae.id ASC

      LIMIT $5
    `,
    [
      CANAL_WHATSAPP,
      ESTADO_PENDIENTE,
      ESTADO_ALERTA_ACTIVA,
      ZONA_HORARIA,
      limiteValidado,
    ]
  );

  return rows;
}

// ======================================================
// OBTENER ENVÍO ACTUAL
// ======================================================
//
// Segunda protección:
//
// Aunque un registro estuviera en la consulta
// inicial, debe seguir:
// - PENDIENTE;
// - con alerta ACTIVA;
// - dentro del día correcto si es PROGRAMADA.
//
// ======================================================

async function obtenerEnvioActual(client, envioId) {
  const id = validarEnteroPositivo(
    envioId,
    "Envío"
  );

  const { rows } = await client.query(
    `
      SELECT
        ae.id,
        ae.alerta_id,
        ae.secuencia_notificacion,
        ae.canal,
        ae.intento,

        ae.usuario_destinatario_id,
        ae.destinatario,

        ae.estado,
        ae.plantilla_meta,
        ae.contenido_enviado,

        ae.fecha_programada_intento,
        ae.fecha_intento,

        a.tipo AS tipo_alerta,
        a.motivo AS motivo_alerta,
        a.contenedor_id,
        a.umbral_configurado,
        a.fecha_programada_original

      FROM alertas_envios ae

      INNER JOIN alertas a
        ON a.id = ae.alerta_id

      WHERE ae.id = $1
        AND ae.canal = $2
        AND ae.estado = $3
        AND a.estado = $4

        AND ae.fecha_programada_intento
          <= clock_timestamp()

        AND (
          a.tipo <> 'PROGRAMADA'

          OR (
            a.fecha_programada_original
              IS NOT NULL

            AND (
              a.fecha_programada_original
                AT TIME ZONE $5
            )::date
            =
            (
              clock_timestamp()
                AT TIME ZONE $5
            )::date

            AND a.fecha_programada_original
                <= clock_timestamp()
          )
        )

      LIMIT 1
    `,
    [
      id,
      CANAL_WHATSAPP,
      ESTADO_PENDIENTE,
      ESTADO_ALERTA_ACTIVA,
      ZONA_HORARIA,
    ]
  );

  return rows[0] || null;
}

// ======================================================
// VERIFICAR PROGRAMADA INMEDIATAMENTE ANTES DE META
// ======================================================
//
// Consulta la BD sin confiar en el frontend.
//
// No aplica a alertas de nivel ni predictivas.
//
// ======================================================

async function validarProgramadaAntesDeEnviar(
  client,
  envio
) {
  if (envio.tipo_alerta !== "PROGRAMADA") {
    return {
      permitido: true,
      motivo: "NO_ES_PROGRAMADA",
    };
  }

  const { rows } = await client.query(
    `
      SELECT EXISTS (
        SELECT 1

        FROM alertas a

        JOIN alertas_envios ae
          ON ae.alerta_id = a.id

        WHERE ae.id = $1
          AND ae.estado = 'PENDIENTE'

          AND a.estado = 'ACTIVA'
          AND a.tipo = 'PROGRAMADA'

          AND a.fecha_programada_original
              IS NOT NULL

          AND a.fecha_programada_original
              <= clock_timestamp()

          AND (
            a.fecha_programada_original
              AT TIME ZONE $2
          )::date
          =
          (
            clock_timestamp()
              AT TIME ZONE $2
          )::date
      ) AS permitido
    `,
    [
      envio.id,
      ZONA_HORARIA,
    ]
  );

  const permitido =
    rows[0]?.permitido === true;

  return {
    permitido,
    motivo: permitido
      ? "PROGRAMADA_VIGENTE"
      : "PROGRAMADA_FUERA_DE_FECHA",
  };
}

// ======================================================
// BLOQUEAR ENVÍO
// ======================================================

async function intentarBloquearEnvio(client, envioId) {
  const id = validarEnteroPositivo(
    envioId,
    "Envío"
  );

  const { rows } = await client.query(
    `
      SELECT
        pg_try_advisory_lock(
          $1::bigint
        ) AS adquirido
    `,
    [id]
  );

  return rows[0]?.adquirido === true;
}

// ======================================================
// LIBERAR BLOQUEO
// ======================================================

async function liberarBloqueoEnvio(client, envioId) {
  const id = validarEnteroPositivo(
    envioId,
    "Envío"
  );

  await client.query(
    `
      SELECT
        pg_advisory_unlock(
          $1::bigint
        )
    `,
    [id]
  );
}

// ======================================================
// ENVIAR A META WHATSAPP
// ======================================================

async function enviarAMeta(envio) {
  const plantilla = normalizarPlantilla(
    envio.plantilla_meta
  );

  const contenido =
    leerContenidoEstructurado(
      envio.contenido_enviado
    );

  const idioma = obtenerIdiomaWhatsApp();

  return enviarPlantillaWhatsApp({
    destinatario: envio.destinatario,

    plantilla,
    nombrePlantilla: plantilla,

    idioma,
    codigoIdioma: idioma,

    parametros: contenido.parametros,
    parametrosBody: contenido.parametros,
  });
}

// ======================================================
// RESPALDO EMAIL
// ======================================================
//
// Se mantiene solamente después de agotar
// los tres intentos técnicos de WhatsApp.
//
// ======================================================

async function ejecutarRespaldoEmailSeguro(
  envioWhatsAppId
) {
  try {
    return await enviarRespaldoEmail({
      envioWhatsAppId,
    });
  } catch (error) {
    console.error(
      "Error ejecutando respaldo por correo:",
      error.message
    );

    return {
      accion: "ERROR_RESPALDO_EMAIL",
      error: error.message,
    };
  }
}

// ======================================================
// PROCESAR FALLO DE WHATSAPP
// ======================================================

async function procesarFalloWhatsApp({
  envio,
  codigoError,
  detalleError,
  errorReintentable,
  esErrorMeta = false,
}) {
  const resultadoFallo =
    await registrarFalloMeta({
      envioId: envio.id,
      codigoError,
      detalleError,
      errorReintentable,
    });

  const requiereRespaldo =
    resultadoFallo
      ?.requiereEvaluarRespaldoEmail === true;

  let respaldoEmail = null;

  if (requiereRespaldo) {
    respaldoEmail =
      await ejecutarRespaldoEmailSeguro(
        envio.id
      );
  }

  return {
    envioId: envio.id,
    alertaId: envio.alerta_id,

    secuenciaNotificacion:
      envio.secuencia_notificacion,

    intento: envio.intento,

    accion: "WHATSAPP_FALLO",
    esErrorMeta,

    resultado: resultadoFallo,

    requiereEvaluarRespaldoEmail:
      requiereRespaldo,

    respaldoEmail,
  };
}

// ======================================================
// PROCESAR UN ENVÍO PENDIENTE
// ======================================================
//
// Conserva:
// - máximo 3 intentos de WhatsApp;
// - respaldo por correo;
// - bloqueos contra procesamiento simultáneo;
// - trazabilidad de los resultados.
//
// Protecciones:
// - alerta ACTIVA;
// - nivel vigente para NIVEL_AVISO/NIVEL_ALTO;
// - fecha correcta para PROGRAMADA.
//
// ======================================================

async function procesarEnvioPendiente(
  envioOriginal
) {
  const envioId = validarEnteroPositivo(
    envioOriginal?.id,
    "Envío"
  );

  const client = await pool.connect();

  let bloqueoAdquirido = false;
  let destruirConexion = false;

  try {
    // ==================================================
    // 1. BLOQUEAR ENVÍO
    // ==================================================

    bloqueoAdquirido =
      await intentarBloquearEnvio(
        client,
        envioId
      );

    if (!bloqueoAdquirido) {
      return {
        envioId,
        accion:
          "ENVIO_EN_PROCESO_POR_OTRO_WORKER",
      };
    }

    // ==================================================
    // 2. RECONSULTAR ESTADO ACTUAL
    // ==================================================

    const envio = await obtenerEnvioActual(
      client,
      envioId
    );

    if (!envio) {
      return {
        envioId,
        accion: "ENVIO_NO_ELEGIBLE",
      };
    }

    // ==================================================
    // 3. VALIDAR NIVEL DEL ESP8266
    // ==================================================

    const validacionNivel =
      validarNivelAntesDeEnviar(envio);

    if (!validacionNivel.permitido) {
      return {
        envioId,
        alertaId: envio.alerta_id,

        accion: "ENVIO_NIVEL_SUSPENDIDO",

        motivo: validacionNivel.motivo,

        nivel_actual:
          validacionNivel.porcentaje ?? null,

        umbral:
          validacionNivel.umbral ?? null,
      };
    }

    // ==================================================
    // 4. VALIDAR INTENTO TÉCNICO
    // ==================================================

    const intento = validarEnteroPositivo(
      envio.intento,
      "Intento"
    );

    if (intento > MAX_INTENTOS_WHATSAPP) {
      throw new Error(
        "El envío supera el máximo de intentos de WhatsApp."
      );
    }

    // ==================================================
    // 5. VALIDAR PLANTILLA Y CONTENIDO
    // ==================================================

    normalizarPlantilla(
      envio.plantilla_meta
    );

    leerContenidoEstructurado(
      envio.contenido_enviado
    );

    // ==================================================
    // 6. ÚLTIMA VALIDACIÓN DE FECHA PROGRAMADA
    // ==================================================

    const validacionFecha =
      await validarProgramadaAntesDeEnviar(
        client,
        envio
      );

    if (!validacionFecha.permitido) {
      return {
        envioId,
        alertaId: envio.alerta_id,

        accion: "ENVIO_PROGRAMADO_SUSPENDIDO",

        motivo: validacionFecha.motivo,
      };
    }

    // ==================================================
    // 7. ENVIAR A META
    // ==================================================

    let respuestaMeta;

    try {
      respuestaMeta = await enviarAMeta(
        envio
      );

    } catch (error) {
      return procesarFalloWhatsApp({
        envio,

        codigoError:
          obtenerCodigoError(error),

        detalleError:
          obtenerDetalleError(error),

        errorReintentable:
          obtenerErrorReintentable(error),

        esErrorMeta:
          error instanceof MetaWhatsAppError,
      });
    }

    // ==================================================
    // 8. VALIDAR MESSAGE ID
    // ==================================================

    const proveedorMensajeId = String(
      respuestaMeta?.proveedorMensajeId ?? ""
    ).trim();

    if (!proveedorMensajeId) {
      return procesarFalloWhatsApp({
        envio,

        codigoError: "META_SIN_MESSAGE_ID",

        detalleError:
          "Meta respondió sin devolver un identificador de mensaje.",

        errorReintentable: true,
        esErrorMeta: false,
      });
    }

    // ==================================================
    // 9. REGISTRAR ACEPTACIÓN META
    // ==================================================

    const resultadoAceptacion =
      await registrarAceptacionMeta({
        envioId: envio.id,
        proveedorMensajeId,
      });

    return {
      envioId: envio.id,
      alertaId: envio.alerta_id,

      secuenciaNotificacion:
        envio.secuencia_notificacion,

      intento: envio.intento,

      accion: "WHATSAPP_ACEPTADO",

      proveedorMensajeId,

      estadoMeta:
        respuestaMeta?.estadoMeta ?? null,

      resultado: resultadoAceptacion,

      requiereEvaluarRespaldoEmail: false,

      respaldoEmail: null,
    };

  } finally {
    // ==================================================
    // 10. LIBERAR BLOQUEO
    // ==================================================

    if (bloqueoAdquirido) {
      try {
        await liberarBloqueoEnvio(
          client,
          envioId
        );

      } catch (error) {
        destruirConexion = true;

        console.error(
          "No fue posible liberar el bloqueo del envío WhatsApp:",
          envioId,
          error.message
        );
      }
    }

    client.release(destruirConexion);
  }
}

// ======================================================
// PROCESAR COLA
// ======================================================

async function procesarEnviosPendientes({
  limite = 20,
} = {}) {
  const pendientes =
    await obtenerEnviosPendientes({
      limite,
    });

  const resultados = [];

  for (const envio of pendientes) {
    try {
      const resultado =
        await procesarEnvioPendiente(
          envio
        );

      resultados.push(resultado);

    } catch (error) {
      console.error(
        `Error procesando envío WhatsApp ${envio.id}:`,
        error.message
      );

      resultados.push({
        envioId: envio.id,
        alertaId: envio.alerta_id,

        accion: "ERROR_PROCESANDO_ENVIO",

        error: error.message,
      });
    }
  }

  return {
    totalPendientes: pendientes.length,
    totalProcesados: resultados.length,
    resultados,
  };
}

// ======================================================
// CONSULTAR INTENTOS DE WHATSAPP
// ======================================================

async function obtenerIntentosWhatsApp({
  alertaId,
  secuenciaNotificacion = 1,
}) {
  const alertaIdValidado =
    validarEnteroPositivo(
      alertaId,
      "Alerta"
    );

  const secuenciaValidada =
    validarEnteroPositivo(
      secuenciaNotificacion,
      "Secuencia de notificación"
    );

  const { rows } = await pool.query(
    `
      SELECT
        id,
        alerta_id,
        secuencia_notificacion,

        canal,
        intento,
        estado,

        plantilla_meta,

        proveedor_mensaje_id,

        codigo_error,
        detalle_error,
        error_reintentable,

        fecha_programada_intento,
        fecha_intento,
        fecha_actualizacion,
        fecha_entregado,
        fecha_leido

      FROM alertas_envios

      WHERE alerta_id = $1
        AND secuencia_notificacion = $2
        AND canal = $3

      ORDER BY
        intento ASC,
        id ASC
    `,
    [
      alertaIdValidado,
      secuenciaValidada,
      CANAL_WHATSAPP,
    ]
  );

  return {
    alertaId: alertaIdValidado,

    secuenciaNotificacion:
      secuenciaValidada,

    maxIntentos:
      MAX_INTENTOS_WHATSAPP,

    intentosRegistrados:
      rows.length,

    intentos: rows,
  };
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerEnviosPendientes,
  procesarEnvioPendiente,
  procesarEnviosPendientes,
  obtenerIntentosWhatsApp,
};
