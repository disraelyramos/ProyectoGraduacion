const pool = require("../../../../config/db");

// ======================================================
// CONSTANTES
// ======================================================

const ESTADO_SOLICITUD = Object.freeze({
  PENDIENTE: "PENDIENTE",
  MIDIENDO: "MIDIENDO",
  ESTABILIZANDO: "ESTABILIZANDO",
  MOVIMIENTO_DETECTADO: "MOVIMIENTO_DETECTADO",
  ESPERANDO_RETIRO: "ESPERANDO_RETIRO",
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
  ESTADO_SOLICITUD.ESPERANDO_RETIRO,
]);

// ======================================================
// CONFIGURACION DESDE .env
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
// HELPERS
// ======================================================

function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toInt(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numero = Number(value);

  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : null;
}

function toNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numero = Number(value);

  return Number.isFinite(numero)
    ? numero
    : null;
}

// ======================================================
// ERROR DEL PROVEEDOR
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
// DETERMINAR MODULO DEL CONTENEDOR
// ======================================================
//
// BD:
// tipo 1 = Bioinfeccioso
// tipo 2 = Punzocortante
//
// El backend determina el modulo.
// No se acepta el modulo enviado por el frontend.
//
// ======================================================

async function obtenerModuloPorContenedor({
  contenedorId,
  db,
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
  db,
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
// CREAR SOLICITUD
// ======================================================

async function crearSolicitud({
  procesoId,
  contenedorId,
  moduloCodigo,
  db,
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
          $1,
          $2,
          $3,
          $4,
          $5,
          NOW(),
          NOW()
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
    // Conservamos el manejo de concurrencia original.
    // Si existe una solicitud activa, se reutiliza
    // después de validar contenedor y módulo.

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
  db,
}) {
  const existente = await buscarSolicitudActiva({
    procesoId,
    db,
  });

  const solicitud = existente || await crearSolicitud({
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
// CONSULTAR SOLICITUD
// ======================================================

async function obtenerSolicitudPorId({
  solicitudId,
  db,
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
  db,
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
// OBTENER LECTURA FINAL
// ======================================================
//
// Se verifica que la lectura:
// - exista;
// - corresponda al contenedor;
// - sea de tipo peso_lb;
// - utilice libras;
// - tenga estado normal.
//
// ======================================================

async function obtenerLecturaFinal({
  lecturaId,
  contenedorId,
  db,
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
// VALIDAR RESULTADO COMPLETADO
// ======================================================

async function validarResultadoCompletado({
  solicitud,
  contenedorId,
  db,
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

  const valor = toNumber(
    lectura.valor
  );

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

  // La lectura registrada en BD es la fuente
  // utilizada para calcular el costo.

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
// ESPERAR RESULTADO DEL MODULO
// ======================================================
//
// ESPERANDO_RETIRO sigue siendo un estado activo.
//
// El resultado final únicamente se devuelve
// cuando el módulo registra COMPLETADO.
//
// ======================================================

async function esperarResultado({
  solicitudId,
  contenedorId,
  db,
}) {
  const inicio = Date.now();

  while (
    Date.now() - inicio <
    TIMEOUT_MEDICION_MS
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

    // Estados que todavía esperan resultado:
    //
    // PENDIENTE
    // MIDIENDO
    // ESTABILIZANDO
    // MOVIMIENTO_DETECTADO
    // ESPERANDO_RETIRO

    if (!ESTADOS_ACTIVOS.includes(solicitud.estado)) {
      throw new ModuloMedicionesError(
        "La solicitud tiene un estado de medición desconocido.",
        {
          codigo: "ESTADO_MEDICION_INVALIDO",
        }
      );
    }

    await esperar(
      INTERVALO_CONSULTA_MS
    );
  }

  // No se sobrescribe una medición que ya
  // haya sido completada por el módulo.

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
// OBTENER PESO ACTUAL DESDE EL MODULO
// ======================================================

async function obtenerPesoActual({
  procesoId,
  contenedorId,
  db = pool,
}) {
  const procesoIdNumero = toInt(
    procesoId
  );

  const contenedorIdNumero = toInt(
    contenedorId
  );

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

  // 1. Determinar módulo según contenedor.

  const { moduloCodigo } =
    await obtenerModuloPorContenedor({
      contenedorId: contenedorIdNumero,
      db,
    });

  // 2. Obtener o crear solicitud.

  const solicitud =
    await obtenerOCrearSolicitud({
      procesoId: procesoIdNumero,
      contenedorId: contenedorIdNumero,
      moduloCodigo,
      db,
    });

  // 3. Esperar el peso final.

  return esperarResultado({
    solicitudId: solicitud.id,
    contenedorId: contenedorIdNumero,
    db,
  });
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerPesoActual,
  ModuloMedicionesError,
};