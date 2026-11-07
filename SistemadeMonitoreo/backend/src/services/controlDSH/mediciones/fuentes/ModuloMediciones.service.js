
"use strict";

const pool = require("../../../../config/db");

// ======================================================
// ESTADOS DE SOLICITUD
// ======================================================

const ESTADO_SOLICITUD = Object.freeze({
  PENDIENTE: "PENDIENTE",
  MIDIENDO: "MIDIENDO",
  ESTABILIZANDO: "ESTABILIZANDO",
  MOVIMIENTO_DETECTADO: "MOVIMIENTO_DETECTADO",
  COMPLETADO: "COMPLETADO",
  ERROR: "ERROR",
  TIMEOUT: "TIMEOUT",
  CANCELADO: "CANCELADO",
});

const ESTADOS_ACTIVOS = Object.freeze([
  ESTADO_SOLICITUD.PENDIENTE,
  ESTADO_SOLICITUD.MIDIENDO,
  ESTADO_SOLICITUD.ESTABILIZANDO,
  ESTADO_SOLICITUD.MOVIMIENTO_DETECTADO,
]);

// ======================================================
// CONFIGURACIÓN DESDE RAILWAY
// ======================================================

function obtenerEnteroPositivo(nombre, respaldo) {
  const valor = Number(process.env[nombre]);

  return Number.isSafeInteger(valor) && valor > 0
    ? valor
    : respaldo;
}

const INTERVALO_CONSULTA_MS = obtenerEnteroPositivo(
  "MEDICION_PESO_POLL_MS",
  500
);

const TIMEOUT_MEDICION_MS = obtenerEnteroPositivo(
  "MEDICION_PESO_TIMEOUT_MS",
  120000
);

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

function esperar(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function toInt(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numero = Number(value);

  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : null;
}

function toNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numero = Number(value);

  return Number.isFinite(numero)
    ? numero
    : null;
}

// ======================================================
// ERRORES DEL MÓDULO
// ======================================================

class ModuloMedicionesError extends Error {
  constructor(
    message,
    {
      codigo = "ERROR_MODULO_PESO",
      estado = ESTADO_SOLICITUD.ERROR,
    } = {}
  ) {
    super(message);

    this.name = "ModuloMedicionesError";
    this.codigo = codigo;
    this.estado = estado;
  }
}

// ======================================================
// OBTENER MÓDULO SEGÚN CONTENEDOR
// ======================================================

async function obtenerModuloPorContenedor({
  contenedorId,
  db = pool,
}) {
  const { rows } = await db.query(
    `
      SELECT
        id_contenedor,
        id_tipo_residuo
      FROM contenedores
      WHERE id_contenedor = $1
      LIMIT 1
    `,
    [contenedorId]
  );

  if (!rows.length) {
    throw new ModuloMedicionesError(
      "No existe el contenedor solicitado.",
      {
        codigo: "CONTENEDOR_NO_ENCONTRADO",
      }
    );
  }

  const tipoResiduoId = toInt(
    rows[0].id_tipo_residuo
  );

  const MODULOS = {
    1: "PESO_BIOINFECCIOSO",
    2: "PESO_PUNZOCORTANTE",
  };

  const moduloCodigo = MODULOS[tipoResiduoId];

  if (!moduloCodigo) {
    throw new ModuloMedicionesError(
      "El tipo de residuo no tiene un módulo de peso configurado.",
      {
        codigo: "MODULO_NO_CONFIGURADO",
      }
    );
  }

  return {
    moduloCodigo,
    tipoResiduoId,
  };
}

// ======================================================
// BUSCAR SOLICITUD ACTIVA
// ======================================================

async function buscarSolicitudActiva({
  procesoId,
  db = pool,
}) {
  const { rows } = await db.query(
    `
      SELECT
        id,
        proceso_id,
        contenedor_id,
        modulo_codigo,
        estado,
        mensaje,
        peso_lb,
        lectura_id,
        creado_en,
        actualizado_en,
        completado_en
      FROM solicitudes_medicion_peso
      WHERE proceso_id = $1
        AND estado = ANY($2::varchar[])
      ORDER BY id DESC
      LIMIT 1
    `,
    [
      procesoId,
      ESTADOS_ACTIVOS,
    ]
  );

  return rows[0] || null;
}

// ======================================================
// CREAR SOLICITUD DE MEDICIÓN
// ======================================================

async function crearSolicitud({
  procesoId,
  contenedorId,
  moduloCodigo,
  db = pool,
}) {
  try {
    const { rows } = await db.query(
      `
        INSERT INTO solicitudes_medicion_peso (
          proceso_id,
          contenedor_id,
          modulo_codigo,
          estado,
          mensaje,
          creado_en,
          actualizado_en
        )
        VALUES (
          $1, $2, $3, $4, $5,
          NOW(), NOW()
        )
        RETURNING
          id,
          proceso_id,
          contenedor_id,
          modulo_codigo,
          estado,
          mensaje,
          peso_lb,
          lectura_id,
          creado_en,
          actualizado_en,
          completado_en
      `,
      [
        procesoId,
        contenedorId,
        moduloCodigo,
        ESTADO_SOLICITUD.PENDIENTE,
        "Esperando módulo de peso",
      ]
    );

    return rows[0];

  } catch (error) {
    if (error?.code === "23505") {
      const existente = await buscarSolicitudActiva({
        procesoId,
        db,
      });

      if (existente) {
        return existente;
      }
    }

    throw error;
  }
}

// ======================================================
// VALIDAR SOLICITUD EXISTENTE
// ======================================================

function validarSolicitudExistente({
  solicitud,
  contenedorId,
  moduloCodigo,
}) {
  if (
    Number(solicitud.contenedor_id) !==
    Number(contenedorId)
  ) {
    throw new ModuloMedicionesError(
      "La solicitud de medición activa pertenece a otro contenedor.",
      {
        codigo: "SOLICITUD_INCONSISTENTE",
      }
    );
  }

  if (solicitud.modulo_codigo !== moduloCodigo) {
    throw new ModuloMedicionesError(
      "La solicitud activa pertenece a otro módulo.",
      {
        codigo: "MODULO_INCONSISTENTE",
      }
    );
  }

  return solicitud;
}

// ======================================================
// OBTENER O CREAR SOLICITUD
// ======================================================

async function obtenerOCrearSolicitud({
  procesoId,
  contenedorId,
  moduloCodigo,
  db = pool,
}) {
  const existente = await buscarSolicitudActiva({
    procesoId,
    db,
  });

  const solicitud =
    existente ||
    await crearSolicitud({
      procesoId,
      contenedorId,
      moduloCodigo,
      db,
    });

  return validarSolicitudExistente({
    solicitud,
    contenedorId,
    moduloCodigo,
  });
}

// ======================================================
// CONSULTAR SOLICITUD POR ID
// ======================================================

async function obtenerSolicitudPorId({
  solicitudId,
  db = pool,
}) {
  const { rows } = await db.query(
    `
      SELECT
        id,
        proceso_id,
        contenedor_id,
        modulo_codigo,
        estado,
        mensaje,
        peso_lb,
        lectura_id,
        creado_en,
        actualizado_en,
        completado_en
      FROM solicitudes_medicion_peso
      WHERE id = $1
      LIMIT 1
    `,
    [solicitudId]
  );

  return rows[0] || null;
}

// ======================================================
// MARCAR TIMEOUT
// ======================================================

async function marcarTimeout({
  solicitudId,
  db = pool,
}) {
  await db.query(
    `
      UPDATE solicitudes_medicion_peso
      SET
        estado = $1,
        mensaje = $2,
        actualizado_en = NOW()
      WHERE id = $3
        AND estado = ANY($4::varchar[])
    `,
    [
      ESTADO_SOLICITUD.TIMEOUT,
      "Se agotó el tiempo para obtener la medición.",
      solicitudId,
      ESTADOS_ACTIVOS,
    ]
  );
}

// ======================================================
// VALIDAR LECTURA FINAL DEL MÓDULO
// ======================================================

async function obtenerLecturaFinal({
  lecturaId,
  contenedorId,
  db = pool,
}) {
  const { rows } = await db.query(
    `
      SELECT
        l.id,
        l.contenedor_id,
        l.valor,
        l.fuente_lectura,
        l.estado_lectura,
        l.fecha_hora,
        tl.nombre AS tipo_lectura,
        um.nombre AS unidad
      FROM lecturas l
      JOIN tipos_lectura tl
        ON tl.id = l.tipo_lectura_id
      JOIN unidad_medida um
        ON um.id = l.unidad_id
      WHERE l.id = $1
        AND l.contenedor_id = $2
        AND tl.nombre = $3
        AND um.nombre = $4
        AND l.estado_lectura = $5
      LIMIT 1
    `,
    [
      lecturaId,
      contenedorId,
      "peso_lb",
      "lb",
      "normal",
    ]
  );

  return rows[0] || null;
}

// ======================================================
// VALIDAR MEDICIÓN COMPLETADA
// ======================================================

async function validarResultadoCompletado({
  solicitud,
  contenedorId,
  db = pool,
}) {
  const lecturaId = toInt(
    solicitud.lectura_id
  );

  const pesoSolicitud = toNumber(
    solicitud.peso_lb
  );

  if (
    !lecturaId ||
    pesoSolicitud === null ||
    pesoSolicitud < 0
  ) {
    throw new ModuloMedicionesError(
      "El módulo completó la medición con datos inválidos.",
      {
        codigo: "RESULTADO_MODULO_INVALIDO",
      }
    );
  }

  const lectura = await obtenerLecturaFinal({
    lecturaId,
    contenedorId,
    db,
  });

  if (!lectura) {
    throw new ModuloMedicionesError(
      "No fue posible validar la lectura generada por el módulo.",
      {
        codigo: "LECTURA_MODULO_INVALIDA",
      }
    );
  }

  const valor = toNumber(lectura.valor);

  if (
    valor === null ||
    valor < 0
  ) {
    throw new ModuloMedicionesError(
      "La lectura final de peso contiene un valor inválido.",
      {
        codigo: "PESO_MODULO_INVALIDO",
      }
    );
  }

  // Solo una solicitud completada con lectura
  // validada permite continuar al cálculo de costo.

  return {
    tipo: "peso_lb",
    valor,
    unidad: "lb",
    proveedor: "modulo",
    lectura_id: lectura.id,
    fecha_hora: lectura.fecha_hora,
    estado_lectura: lectura.estado_lectura,
    fuente_lectura: lectura.fuente_lectura,
  };
}

// ======================================================
// VALIDAR ESTADOS TERMINALES
// ======================================================

function validarEstadoTerminal(solicitud) {
  switch (solicitud.estado) {

    case ESTADO_SOLICITUD.ERROR:
      throw new ModuloMedicionesError(
        solicitud.mensaje ||
          "El módulo reportó un error durante la medición.",
        {
          codigo: "MODULO_REPORTO_ERROR",
        }
      );

    case ESTADO_SOLICITUD.CANCELADO:
      throw new ModuloMedicionesError(
        "La medición fue cancelada.",
        {
          codigo: "MEDICION_CANCELADA",
          estado: ESTADO_SOLICITUD.CANCELADO,
        }
      );

    case ESTADO_SOLICITUD.TIMEOUT:
      throw new ModuloMedicionesError(
        solicitud.mensaje ||
          "Se agotó el tiempo de medición.",
        {
          codigo: "MEDICION_TIMEOUT",
          estado: ESTADO_SOLICITUD.TIMEOUT,
        }
      );

    default:
      return;
  }
}

// ======================================================
// ESPERAR RESULTADO REAL DEL MÓDULO
// ======================================================

async function esperarResultado({
  solicitudId,
  contenedorId,
  db = pool,
}) {
  const inicio = Date.now();

  while (
    Date.now() - inicio < TIMEOUT_MEDICION_MS
  ) {
    const solicitud = await obtenerSolicitudPorId({
      solicitudId,
      db,
    });

    if (!solicitud) {
      throw new ModuloMedicionesError(
        "La solicitud de medición dejó de existir.",
        {
          codigo: "SOLICITUD_NO_ENCONTRADA",
        }
      );
    }

    if (
      solicitud.estado ===
      ESTADO_SOLICITUD.COMPLETADO
    ) {
      return validarResultadoCompletado({
        solicitud,
        contenedorId,
        db,
      });
    }

    validarEstadoTerminal(solicitud);

    if (!ESTADOS_ACTIVOS.includes(solicitud.estado)) {
      throw new ModuloMedicionesError(
        "La solicitud tiene un estado de medición desconocido.",
        {
          codigo: "ESTADO_MEDICION_INVALIDO",
        }
      );
    }

    await esperar(INTERVALO_CONSULTA_MS);
  }

  await marcarTimeout({
    solicitudId,
    db,
  });

  throw new ModuloMedicionesError(
    "Se agotó el tiempo para obtener el peso del módulo.",
    {
      codigo: "MEDICION_TIMEOUT",
      estado: ESTADO_SOLICITUD.TIMEOUT,
    }
  );
}

// ======================================================
// PESO ACTUAL DESDE EL MÓDULO FÍSICO
// ======================================================

async function obtenerPesoActual({
  procesoId,
  contenedorId,
  db = pool,
}) {
  const procesoIdNumero = toInt(procesoId);
  const contenedorIdNumero = toInt(contenedorId);

  if (!procesoIdNumero) {
    throw new ModuloMedicionesError(
      "El proceso de pesaje no es válido.",
      {
        codigo: "PROCESO_INVALIDO",
      }
    );
  }

  if (!contenedorIdNumero) {
    throw new ModuloMedicionesError(
      "El contenedor de pesaje no es válido.",
      {
        codigo: "CONTENEDOR_INVALIDO",
      }
    );
  }

  const { moduloCodigo } =
    await obtenerModuloPorContenedor({
      contenedorId: contenedorIdNumero,
      db,
    });

  const solicitud =
    await obtenerOCrearSolicitud({
      procesoId: procesoIdNumero,
      contenedorId: contenedorIdNumero,
      moduloCodigo,
      db,
    });

  return esperarResultado({
    solicitudId: solicitud.id,
    contenedorId: contenedorIdNumero,
    db,
  });
}

// ======================================================
// CONSULTAR ÚLTIMO PESO HISTÓRICO
// ======================================================
//
// Uso: visualización y consulta únicamente.
//
// NO crea solicitudes de medición.
// NO devuelve un peso como medición actual.
// NO completa procesos.
// NO genera lecturas nuevas.
// NO habilita cálculos de costos.
// ======================================================

async function obtenerUltimoPesoHistorico({
  contenedorId,
  db = pool,
}) {
  const id = toInt(contenedorId);

  if (!id) {
    throw new ModuloMedicionesError(
      "El contenedor de peso no es válido.",
      {
        codigo: "CONTENEDOR_INVALIDO",
      }
    );
  }

  const { rows } = await db.query(
    `
      SELECT
        l.id,
        l.contenedor_id,
        l.valor,
        l.fecha_hora,
        l.fuente_lectura,
        l.estado_lectura
      FROM lecturas l
      JOIN tipos_lectura tl
        ON tl.id = l.tipo_lectura_id
      JOIN unidad_medida um
        ON um.id = l.unidad_id
      WHERE l.contenedor_id = $1
        AND tl.nombre = 'peso_lb'
        AND um.nombre = 'lb'
        AND l.estado_lectura = 'normal'
        AND l.valor >= 0
      ORDER BY
        l.fecha_hora DESC,
        l.id DESC
      LIMIT 1
    `,
    [id]
  );

  if (!rows.length) {
    return {
      disponible: false,
      contenedor_id: id,
      peso_lb: null,
      lectura_id: null,
      fecha_hora: null,
      origen: "sin_datos",
      vigente: false,
      lectura_historica: false,
      mensaje: "No existen pesos registrados.",
    };
  }

  const lectura = rows[0];

  const peso = toNumber(lectura.valor);

  if (
    peso === null ||
    peso < 0
  ) {
    throw new ModuloMedicionesError(
      "El peso histórico es inválido.",
      {
        codigo: "PESO_HISTORICO_INVALIDO",
      }
    );
  }

  return {
    disponible: true,
    contenedor_id: id,
    peso_lb: Number(peso.toFixed(2)),
    lectura_id: lectura.id,
    fecha_hora: lectura.fecha_hora,
    fuente_registrada: lectura.fuente_lectura,
    estado_lectura: lectura.estado_lectura,
    origen: "historial",
    vigente: false,
    lectura_historica: true,
    permite_calculo_costo: false,
    mensaje: "Último peso registrado",
  };
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerPesoActual,
  obtenerUltimoPesoHistorico,
  ModuloMedicionesError,
};
