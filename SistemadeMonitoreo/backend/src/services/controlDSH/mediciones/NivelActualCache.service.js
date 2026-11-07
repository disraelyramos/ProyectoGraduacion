
"use strict";

const pool = require("../../../config/db");

// ======================================================
// CONFIGURACIÓN
// ======================================================

function obtenerEnteroPositivo(nombre, respaldo) {
  const valor = Number(process.env[nombre]);

  return Number.isSafeInteger(valor) && valor > 0
    ? valor
    : respaldo;
}

const NIVEL_CACHE_MAX_AGE_MS = obtenerEnteroPositivo(
  "NIVEL_CACHE_MAX_AGE_MS",
  15000
);

const HISTORIAL_INTERVAL_MS = obtenerEnteroPositivo(
  "NIVEL_HISTORIAL_INTERVAL_MS",
  300000
);

// ======================================================
// CACHÉ DE NIVEL Y PESO
// ======================================================

const nivelesCache = new Map();
const pesosCache = new Map();
const ultimoHistorialPorContenedor = new Map();

// ======================================================
// VALIDACIONES
// ======================================================

function toInt(valor) {
  const numero = Number(valor);

  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : null;
}

function toNumber(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}

function validarFecha(valor) {
  const fecha = valor instanceof Date
    ? new Date(valor.getTime())
    : new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    throw new Error("Fecha de medición inválida.");
  }

  if (fecha.getTime() > Date.now() + 60000) {
    throw new Error("La medición tiene una fecha futura.");
  }

  return fecha;
}

function calcularAntiguedadMs(registro) {
  if (!registro?.fechaActualizacion) {
    return Infinity;
  }

  const fecha = new Date(registro.fechaActualizacion);

  if (Number.isNaN(fecha.getTime())) {
    return Infinity;
  }

  return Math.max(0, Date.now() - fecha.getTime());
}

function esNivelVigente(registro) {
  return calcularAntiguedadMs(registro) <=
    NIVEL_CACHE_MAX_AGE_MS;
}

// ======================================================
// RESPUESTA DE NIVEL
// ======================================================

function crearNivelCero({ contenedorId, registro = null }) {
  const porcentaje = registro
    ? toNumber(registro.porcentaje)
    : null;

  return {
    contenedorId: Number(contenedorId),

    porcentaje:
      porcentaje !== null &&
      porcentaje >= 0 &&
      porcentaje <= 100
        ? Number(porcentaje.toFixed(2))
        : 0,

    proveedor: registro?.proveedor || null,

    fechaActualizacion:
      registro?.fechaActualizacion || null,

    vigente: false,

    antiguedadMs: registro
      ? calcularAntiguedadMs(registro)
      : null,

    sinLectura: !registro,

    lecturaHistorica: Boolean(registro),
  };
}

// ======================================================
// CONTROL DEL HISTORIAL
// ======================================================

function debeGuardarHistorial(contenedorId) {
  const ultimo =
    ultimoHistorialPorContenedor.get(contenedorId);

  if (!ultimo) {
    return true;
  }

  return Date.now() - ultimo >= HISTORIAL_INTERVAL_MS;
}

// ======================================================
// GUARDAR HISTORIAL DE NIVEL
// ======================================================

async function guardarHistorialNivel({
  contenedorId,
  porcentaje,
  db = pool,
}) {
  const id = toInt(contenedorId);
  const nivel = toNumber(porcentaje);

  if (
    !id ||
    nivel === null ||
    nivel < 0 ||
    nivel > 100
  ) {
    return null;
  }

  const { rows } = await db.query(
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
      id,
      Number(nivel.toFixed(2)),
      "sensor",
      "normal",
      "nivel_porcentaje",
      "%",
    ]
  );

  if (rows.length === 0) {
    throw new Error(
      "No fue posible guardar el historial de nivel."
    );
  }

  ultimoHistorialPorContenedor.set(id, Date.now());

  return rows[0];
}

// ======================================================
// ACTUALIZAR NIVEL DESDE EL MÓDULO
// ======================================================

async function actualizarNivel({
  contenedorId,
  porcentaje,
  proveedor,
  fechaActualizacion = new Date(),
  db = pool,
}) {
  const id = toInt(contenedorId);
  const nivel = toNumber(porcentaje);

  if (!id) {
    throw new Error("Contenedor inválido.");
  }

  if (
    nivel === null ||
    nivel < 0 ||
    nivel > 100
  ) {
    throw new Error(
      "El porcentaje debe estar entre 0 y 100."
    );
  }

  const fecha = validarFecha(fechaActualizacion);

  const anterior = nivelesCache.get(id);

  if (
    anterior &&
    fecha.getTime() <
      new Date(anterior.fechaActualizacion).getTime()
  ) {
    return obtenerNivel(id);
  }

  const registro = {
    contenedorId: id,
    porcentaje: Number(nivel.toFixed(2)),
    proveedor: String(proveedor || "").trim() || null,
    fechaActualizacion: fecha,
  };

  nivelesCache.set(id, registro);

  if (debeGuardarHistorial(id)) {
    try {
      await guardarHistorialNivel({
        contenedorId: id,
        porcentaje: nivel,
        db,
      });
    } catch (error) {
      console.error(
        "Error guardando historial de nivel:",
        error.message
      );
    }
  }

  return {
    ...registro,
    vigente: esNivelVigente(registro),
    antiguedadMs: calcularAntiguedadMs(registro),
    lecturaHistorica: !esNivelVigente(registro),
    sinLectura: false,
  };
}

// ======================================================
// OBTENER NIVEL
// ======================================================

function obtenerNivel(contenedorId) {
  const id = toInt(contenedorId);

  if (!id) {
    return null;
  }

  const registro = nivelesCache.get(id);

  if (!registro) {
    return crearNivelCero({ contenedorId: id });
  }

  const vigente = esNivelVigente(registro);

  if (!vigente) {
    return crearNivelCero({
      contenedorId: id,
      registro,
    });
  }

  return {
    ...registro,
    porcentaje: Number(
      registro.porcentaje.toFixed(2)
    ),
    vigente: true,
    antiguedadMs: calcularAntiguedadMs(registro),
    lecturaHistorica: false,
    sinLectura: false,
  };
}

function obtenerNivelVigente(contenedorId) {
  return obtenerNivel(contenedorId);
}

// ======================================================
// HISTORIAL PERIÓDICO
// SOLO GUARDA LECTURAS VIGENTES
// ======================================================

async function guardarHistorialCache() {
  for (const [contenedorId, registro] of nivelesCache) {
    if (!esNivelVigente(registro)) {
      continue;
    }

    if (!debeGuardarHistorial(contenedorId)) {
      continue;
    }

    try {
      await guardarHistorialNivel({
        contenedorId,
        porcentaje: registro.porcentaje,
      });
    } catch (error) {
      console.error(
        `Error guardando historial ${contenedorId}:`,
        error.message
      );
    }
  }
}

// ======================================================
// RECUPERAR ÚLTIMOS NIVELES DE POSTGRESQL
// ======================================================

async function cargarUltimosNivelesDesdeHistorial() {
  const { rows } = await pool.query(
    `
      SELECT DISTINCT ON (l.contenedor_id)
        l.contenedor_id,
        l.valor,
        l.fecha_hora
      FROM lecturas l
      JOIN tipos_lectura tl
        ON tl.id = l.tipo_lectura_id
      JOIN unidad_medida um
        ON um.id = l.unidad_id
      WHERE tl.nombre = 'nivel_porcentaje'
        AND um.nombre = '%'
        AND l.estado_lectura = 'normal'
      ORDER BY
        l.contenedor_id ASC,
        l.fecha_hora DESC,
        l.id DESC
    `
  );

  let recuperados = 0;

  for (const fila of rows) {
    const id = toInt(fila.contenedor_id);
    const nivel = toNumber(fila.valor);

    if (
      !id ||
      nivel === null ||
      nivel < 0 ||
      nivel > 100
    ) {
      continue;
    }

    let fecha;

    try {
      fecha = validarFecha(fila.fecha_hora);
    } catch {
      continue;
    }

    const anterior = nivelesCache.get(id);

    if (
      anterior &&
      new Date(anterior.fechaActualizacion).getTime() >=
        fecha.getTime()
    ) {
      continue;
    }

    nivelesCache.set(id, {
      contenedorId: id,
      porcentaje: nivel,
      proveedor: "historial",
      fechaActualizacion: fecha,
    });

    ultimoHistorialPorContenedor.set(
      id,
      fecha.getTime()
    );

    recuperados++;
  }

  return recuperados;
}

// ======================================================
// CACHÉ DEL ÚLTIMO PESO REAL RECIBIDO DEL HX711
// ======================================================

// Llamar exclusivamente desde el servicio que confirma
// que la medición se recibió del módulo físico.

function guardarPesoRecibido({
  contenedorId,
  pesoLibras,
  fechaActualizacion = new Date(),
}) {
  const id = toInt(contenedorId);
  const peso = toNumber(pesoLibras);

  if (!id || peso === null || peso < 0) {
    throw new Error("Medición de peso inválida.");
  }

  const fecha = validarFecha(fechaActualizacion);

  const anterior = pesosCache.get(id);

  if (
    anterior &&
    fecha.getTime() <
      new Date(anterior.fechaActualizacion).getTime()
  ) {
    return obtenerUltimoPeso({ contenedorId: id });
  }

  const registro = {
    contenedorId: id,
    pesoLibras: Number(peso.toFixed(2)),
    fechaActualizacion: fecha.toISOString(),
    origen: "modulo",
  };

  pesosCache.set(id, registro);

  return obtenerUltimoPeso({ contenedorId: id });
}

// ======================================================
// OBTENER ÚLTIMO PESO
// ======================================================

function obtenerUltimoPeso({
  contenedorId,
  maxAgeMs = 25000,
}) {
  const id = toInt(contenedorId);

  if (!id) {
    return null;
  }

  const registro = pesosCache.get(id);

  if (!registro) {
    return null;
  }

  const antiguedadMs = calcularAntiguedadMs(registro);

  const vigente =
    Number.isSafeInteger(maxAgeMs) &&
    maxAgeMs > 0 &&
    antiguedadMs <= maxAgeMs;

  return {
    ...registro,
    antiguedadMs,
    vigente,
    lecturaHistorica: !vigente,
  };
}

// ======================================================
// LIMPIEZA
// ======================================================

function eliminarNivel(contenedorId) {
  const id = toInt(contenedorId);

  if (!id) {
    return false;
  }

  ultimoHistorialPorContenedor.delete(id);

  return nivelesCache.delete(id);
}

function limpiarCache() {
  nivelesCache.clear();
  ultimoHistorialPorContenedor.clear();
}

function limpiarUltimosPesos() {
  pesosCache.clear();
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  actualizarNivel,
  obtenerNivel,
  obtenerNivelVigente,
  eliminarNivel,
  limpiarCache,
  guardarHistorialNivel,
  guardarHistorialCache,
  cargarUltimosNivelesDesdeHistorial,
  guardarPesoRecibido,
  obtenerUltimoPeso,
  limpiarUltimosPesos,
};
