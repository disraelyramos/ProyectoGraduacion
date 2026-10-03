const pool = require("../../../config/db");

// ======================================================
// ESTADOS DE MEDICIÓN
// ======================================================

const ESTADO = {
  PENDIENTE: "PENDIENTE",
  MIDIENDO: "MIDIENDO",
  ESTABILIZANDO: "ESTABILIZANDO",
  MOVIMIENTO_DETECTADO: "MOVIMIENTO_DETECTADO",
  ESPERANDO_RETIRO: "ESPERANDO_RETIRO",
  COMPLETADO: "COMPLETADO",
  ERROR: "ERROR",
  TIMEOUT: "TIMEOUT",
  CANCELADO: "CANCELADO",
};

const ESTADOS_ACTIVOS = [
  ESTADO.MIDIENDO,
  ESTADO.ESTABILIZANDO,
  ESTADO.MOVIMIENTO_DETECTADO,
  ESTADO.ESPERANDO_RETIRO,
];

// Los mensajes se controlan desde el backend.
// No se confía en mensajes enviados por el ESP.

const MENSAJES = {
  MIDIENDO: "Calculando peso...",

  ESTABILIZANDO:
    "Estabilizando contenedor...",

  MOVIMIENTO_DETECTADO:
    "Movimiento detectado. Mantenga el contenedor completamente quieto.",

  ESPERANDO_RETIRO:
    "Medición finalizada. Retire el contenedor completo para registrar el peso.",

  ERROR:
    "Ocurrió un error durante la medición.",
};

// ======================================================
// ERROR CONTROLADO
// ======================================================

class ModuloPesoError extends Error {
  constructor(statusCode, message, codigo) {
    super(message);

    this.statusCode = statusCode;
    this.codigo = codigo;
  }
}

// ======================================================
// HELPERS
// ======================================================

function toInt(value) {
  const numero = Number.parseInt(
    String(value),
    10
  );

  return Number.isFinite(numero)
    ? numero
    : null;
}

function toNumber(value) {
  const numero = Number(value);

  return Number.isFinite(numero)
    ? numero
    : null;
}

// ======================================================
// OBTENER SOLICITUD PENDIENTE
// ======================================================

async function obtenerSolicitudPendiente({
  moduloCodigo,
}) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `
        WITH pendiente AS (
          SELECT s.id
          FROM solicitudes_medicion_peso s

          JOIN historial_calculo_costos h
            ON h.id = s.proceso_id

          WHERE s.modulo_codigo = $1
            AND s.estado = $2
            AND h.estado_proceso = $3

          ORDER BY s.id ASC

          FOR UPDATE OF s SKIP LOCKED

          LIMIT 1
        )

        UPDATE solicitudes_medicion_peso s

        SET
          estado = $4,
          mensaje = $5,
          actualizado_en = NOW()

        FROM pendiente p

        WHERE s.id = p.id

        RETURNING
          s.id,
          s.proceso_id,
          s.contenedor_id,
          s.modulo_codigo,
          s.estado,
          s.mensaje,
          s.creado_en,
          s.actualizado_en
      `,
      [
        moduloCodigo,
        ESTADO.PENDIENTE,
        "EN_PROCESO",
        ESTADO.MIDIENDO,
        MENSAJES.MIDIENDO,
      ]
    );

    await client.query("COMMIT");

    if (rows.length === 0) {
      return {
        disponible: false,
        solicitud: null,
      };
    }

    return {
      disponible: true,

      solicitud: {
        id: Number(rows[0].id),
        estado: rows[0].estado,
        mensaje: rows[0].mensaje,
      },
    };

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    throw error;

  } finally {
    client.release();
  }
}

// ======================================================
// ACTUALIZAR ESTADO DE MEDICIÓN
// ======================================================

async function actualizarEstado({
  moduloCodigo,
  solicitudId,
  estado,
}) {
  const id = toInt(solicitudId);

  if (!id) {
    throw new ModuloPesoError(
      400,
      "Solicitud no válida.",
      "SOLICITUD_INVALIDA"
    );
  }

  const estadoNuevo = String(estado || "")
    .trim()
    .toUpperCase();

  const permitidos = [
    ESTADO.MIDIENDO,
    ESTADO.ESTABILIZANDO,
    ESTADO.MOVIMIENTO_DETECTADO,
    ESTADO.ESPERANDO_RETIRO,
    ESTADO.ERROR,
  ];

  if (!permitidos.includes(estadoNuevo)) {
    throw new ModuloPesoError(
      400,
      "Estado de medición no válido.",
      "ESTADO_INVALIDO"
    );
  }

  const mensaje = MENSAJES[estadoNuevo];

  const { rows } = await pool.query(
    `
      UPDATE solicitudes_medicion_peso

      SET
        estado = $1,
        mensaje = $2,
        actualizado_en = NOW()

      WHERE id = $3
        AND modulo_codigo = $4
        AND estado = ANY($5::varchar[])

      RETURNING
        id,
        estado,
        mensaje,
        actualizado_en
    `,
    [
      estadoNuevo,
      mensaje,
      id,
      moduloCodigo,
      ESTADOS_ACTIVOS,
    ]
  );

  if (rows.length === 0) {
    throw new ModuloPesoError(
      409,
      "La solicitud no está disponible para actualizar.",
      "SOLICITUD_NO_ACTIVA"
    );
  }

  return {
    solicitud_id: Number(rows[0].id),
    estado: rows[0].estado,
    mensaje: rows[0].mensaje,
  };
}

// ======================================================
// COMPLETAR MEDICIÓN
// ======================================================
//
// El ESP8285 únicamente envía peso_lb.
//
// El backend determina:
// - proceso
// - contenedor
// - tipo de lectura
// - unidad de medida
// - lectura_id
//
// ======================================================

async function completarMedicion({
  moduloCodigo,
  solicitudId,
  pesoLb,
}) {
  const id = toInt(solicitudId);
  const peso = toNumber(pesoLb);

  if (!id) {
    throw new ModuloPesoError(
      400,
      "Solicitud no válida.",
      "SOLICITUD_INVALIDA"
    );
  }

  if (peso === null || peso < 0) {
    throw new ModuloPesoError(
      400,
      "Peso no válido.",
      "PESO_INVALIDO"
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ==================================================
    // 1. BLOQUEAR SOLICITUD
    // ==================================================

    const { rows: solicitudes } =
      await client.query(
        `
          SELECT
            s.id,
            s.proceso_id,
            s.contenedor_id,
            s.modulo_codigo,
            s.estado,
            h.estado_proceso

          FROM solicitudes_medicion_peso s

          JOIN historial_calculo_costos h
            ON h.id = s.proceso_id

          WHERE s.id = $1
            AND s.modulo_codigo = $2

          LIMIT 1

          FOR UPDATE OF s
        `,
        [
          id,
          moduloCodigo,
        ]
      );

    if (solicitudes.length === 0) {
      throw new ModuloPesoError(
        404,
        "Solicitud no encontrada.",
        "SOLICITUD_NO_ENCONTRADA"
      );
    }

    const solicitud = solicitudes[0];

    // ==================================================
    // 2. VALIDAR PROCESO ACTIVO
    // ==================================================

    if (
      solicitud.estado_proceso !==
      "EN_PROCESO"
    ) {
      await client.query(
        `
          UPDATE solicitudes_medicion_peso

          SET
            estado = $1,
            mensaje = $2,
            actualizado_en = NOW()

          WHERE id = $3
        `,
        [
          ESTADO.CANCELADO,
          "El proceso ya no se encuentra activo.",
          id,
        ]
      );

      throw new ModuloPesoError(
        409,
        "El proceso ya no está activo.",
        "PROCESO_NO_ACTIVO"
      );
    }

    // ==================================================
    // 3. EVITAR DUPLICAR UNA MEDICIÓN
    // ==================================================

    if (
      solicitud.estado ===
      ESTADO.COMPLETADO
    ) {
      throw new ModuloPesoError(
        409,
        "La medición ya fue completada.",
        "MEDICION_YA_COMPLETADA"
      );
    }

    if (
      !ESTADOS_ACTIVOS.includes(
        solicitud.estado
      )
    ) {
      throw new ModuloPesoError(
        409,
        "La solicitud no está activa.",
        "SOLICITUD_NO_ACTIVA"
      );
    }

    const contenedorId = Number(
      solicitud.contenedor_id
    );

    // ==================================================
    // 4. REGISTRAR LECTURA REAL
    // ==================================================

    const { rows: lecturas } =
      await client.query(
        `
          INSERT INTO lecturas (
            contenedor_id,
            tipo_lectura_id,
            unidad_id,
            valor,
            fuente_lectura,
            estado_lectura,
            fecha_hora
          )

          SELECT
            $1,
            tl.id,
            um.id,
            $2,
            $3,
            $4,
            NOW()

          FROM tipos_lectura tl

          CROSS JOIN unidad_medida um

          WHERE tl.nombre = $5
            AND um.nombre = $6

          RETURNING
            id,
            contenedor_id,
            valor,
            fuente_lectura,
            estado_lectura,
            fecha_hora
        `,
        [
          contenedorId,
          Number(peso.toFixed(2)),
          "sensor",
          "normal",
          "peso_lb",
          "lb",
        ]
      );

    if (lecturas.length === 0) {
      throw new ModuloPesoError(
        500,
        "No fue posible registrar la lectura de peso.",
        "LECTURA_NO_CREADA"
      );
    }

    const lectura = lecturas[0];

    // ==================================================
    // 5. COMPLETAR SOLICITUD
    // ==================================================

    const { rows: completadas } =
      await client.query(
        `
          UPDATE solicitudes_medicion_peso

          SET
            estado = $1,
            mensaje = $2,
            peso_lb = $3,
            lectura_id = $4,
            actualizado_en = NOW(),
            completado_en = NOW()

          WHERE id = $5
            AND modulo_codigo = $6

          RETURNING
            id,
            estado,
            mensaje,
            peso_lb,
            lectura_id,
            completado_en
        `,
        [
          ESTADO.COMPLETADO,
          "Peso obtenido correctamente.",
          Number(peso.toFixed(2)),
          lectura.id,
          id,
          moduloCodigo,
        ]
      );

    if (completadas.length === 0) {
      throw new ModuloPesoError(
        500,
        "No fue posible completar la solicitud.",
        "SOLICITUD_NO_COMPLETADA"
      );
    }

    await client.query("COMMIT");

    return {
      message: "Peso registrado correctamente.",
      solicitud_id: Number(
        completadas[0].id
      ),
      estado: ESTADO.COMPLETADO,
      peso_lb: Number(
        completadas[0].peso_lb
      ),
    };

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (_) {}

    throw error;

  } finally {
    client.release();
  }
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerSolicitudPendiente,
  actualizarEstado,
  completarMedicion,
  ModuloPesoError,
};