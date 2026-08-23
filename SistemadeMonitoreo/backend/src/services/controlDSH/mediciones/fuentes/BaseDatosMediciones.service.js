const pool = require("../../../../config/db");

// ======================================================
// Helpers
// ======================================================

function toNumber(value) {
  const numero = Number(value);

  return Number.isFinite(numero)
    ? numero
    : null;
}

// ======================================================
// NIVEL ACTUAL
// ======================================================

/**
 * Obtiene el nivel actual desde la base de datos.
 *
 * PROVEEDOR ACTUAL:
 * contenedores.estado_actual_litros
 *
 * IMPORTANTE:
 * Aunque el campo diga "litros", en este proyecto
 * representa directamente el porcentaje de llenado.
 *
 * Esta función mantiene un contrato estable para que
 * posteriormente el dato pueda venir del módulo.
 */
async function obtenerNivelActual({
  contenedorId,
  db = pool,
}) {
  const { rows } = await db.query(
    `
      SELECT
        id_contenedor,
        estado_actual_litros
      FROM contenedores
      WHERE id_contenedor = $1
      LIMIT 1
    `,
    [contenedorId]
  );

  if (rows.length === 0) {
    return null;
  }

  const valor =
    toNumber(
      rows[0].estado_actual_litros
    );

  return {
    tipo: "nivel_porcentaje",

    valor,

    unidad: "%",

    /*
     * Fuente lógica utilizada por
     * Mediciones.service.
     */
    proveedor: "base_datos",

    /*
     * Estos metadatos forman parte del contrato.
     *
     * En contenedores no tenemos lectura_id ni
     * fecha de lectura asociada directamente,
     * por eso permanecen null.
     */
    lectura_id: null,

    fecha_hora: null,

    estado_lectura:
      valor === null
        ? "sin_dato"
        : "normal",
  };
}

// ======================================================
// PESO ACTUAL
// ======================================================

/**
 * Obtiene el último peso válido almacenado en lecturas.
 *
 * Esto será utilizado en Foto 3 mientras todavía
 * no esté conectado el HX711/ESP8266 al backend.
 *
 * IMPORTANTE:
 * Se filtra específicamente por "peso_lb".
 *
 * Así evitamos confundir una lectura de nivel
 * con una lectura de peso.
 */
async function obtenerPesoActual({
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
        l.fecha_hora
      FROM lecturas l
      JOIN tipos_lectura tl
        ON tl.id = l.tipo_lectura_id
      WHERE l.contenedor_id = $1
        AND tl.nombre = $2
        AND l.estado_lectura = $3
      ORDER BY
        l.fecha_hora DESC,
        l.id DESC
      LIMIT 1
    `,
    [
      contenedorId,
      "peso_lb",
      "normal",
    ]
  );

  if (rows.length === 0) {
    return null;
  }

  const lectura =
    rows[0];

  return {
    tipo: "peso_lb",

    valor:
      toNumber(
        lectura.valor
      ),

    unidad: "lb",

    proveedor:
      "base_datos",

    lectura_id:
      lectura.id,

    fecha_hora:
      lectura.fecha_hora,

    estado_lectura:
      lectura.estado_lectura,

    fuente_lectura:
      lectura.fuente_lectura,
  };
}

// ======================================================
// Exportaciones
// ======================================================

module.exports = {
  obtenerNivelActual,
  obtenerPesoActual,
};