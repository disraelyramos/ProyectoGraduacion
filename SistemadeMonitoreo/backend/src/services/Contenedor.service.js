
"use strict";

const pool = require("../config/db");

const nivelCache = require(
  "./controlDSH/mediciones/NivelActualCache.service"
);

// ======================================================
// VALIDAR PORCENTAJE
// ======================================================

function porcentajeValido(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);

  if (
    !Number.isFinite(numero) ||
    numero < 0 ||
    numero > 100
  ) {
    return null;
  }

  return Number(numero.toFixed(2));
}

// ======================================================
// LISTAR CONTENEDORES
// ======================================================

async function listarContenedores() {

  // ====================================================
  // CONSULTAR INFORMACIÓN E HISTORIAL
  // ====================================================
  // La consulta NO crea mediciones nuevas.
  //
  // Si Railway pierde su caché, se recupera
  // el último nivel almacenado en PostgreSQL.
  // ====================================================

  const { rows } = await pool.query(`
    SELECT
      c.id_contenedor,
      c.codigo,
      c.id_tipo_residuo,
      c.estado_id,
      c.capacidad_max_litros,
      c.capacidad_max_lb,
      c.estado_actual_lb,

      u.id_ubicacion,
      u.nombre AS ubicacion,

      tr.nombre AS tipo_residuo,

      TO_CHAR(
        c.fecha_registro,
        'YYYY-MM-DD'
      ) AS fecha_registro,

      ec.nombre AS estado,

      historial.valor AS nivel_historico_valor,

      historial.fecha_hora
        AS nivel_historico_fecha,

      historial.fuente_lectura
        AS nivel_historico_fuente

    FROM contenedores c

    JOIN ubicaciones u
      ON c.id_ubicacion = u.id_ubicacion

    JOIN tipos_residuo tr
      ON c.id_tipo_residuo = tr.id

    JOIN estados_contenedor ec
      ON c.estado_id = ec.id

    LEFT JOIN LATERAL (
      SELECT
        l.valor,
        l.fecha_hora,
        l.fuente_lectura

      FROM lecturas l

      JOIN tipos_lectura tl
        ON tl.id = l.tipo_lectura_id

      JOIN unidad_medida um
        ON um.id = l.unidad_id

      WHERE
        l.contenedor_id = c.id_contenedor

        AND tl.nombre = 'nivel_porcentaje'

        AND um.nombre = '%'

        AND l.estado_lectura = 'normal'

        AND l.valor BETWEEN 0 AND 100

      ORDER BY
        l.fecha_hora DESC,
        l.id DESC

      LIMIT 1
    ) historial ON TRUE

    ORDER BY
      c.id_contenedor DESC
  `);

  // ====================================================
  // CONSTRUIR RESPUESTA
  // ====================================================

  const contenedores = rows.map((contenedor) => {

    const nivel = nivelCache.obtenerNivel(
      contenedor.id_contenedor
    );

    // ==================================================
    // NIVEL PROCEDENTE DE CACHÉ
    // ==================================================

    const porcentajeCache = (
      nivel?.fechaActualizacion
    )
      ? porcentajeValido(nivel.porcentaje)
      : null;

    // ==================================================
    // NIVEL PROCEDENTE DEL HISTORIAL
    // ==================================================

    const porcentajeHistorico = porcentajeValido(
      contenedor.nivel_historico_valor
    );

    // ==================================================
    // IDENTIFICAR LECTURA VIGENTE
    // ==================================================

    const nivelVigente =
      nivel?.vigente === true &&
      porcentajeCache !== null &&
      nivel?.proveedor !== "historial";

    // ==================================================
    // SELECCIONAR INFORMACIÓN
    // ==================================================
    // Prioridad:
    //
    // 1. Lectura vigente del módulo.
    // 2. Última lectura del historial.
    // 3. Lectura conservada en caché.
    //
    // Una lectura histórica NO se considera
    // una transmisión nueva del módulo.
    // ==================================================

    let porcentaje = null;
    let fechaActualizacion = null;
    let proveedor = null;
    let origenDato = null;

    if (nivelVigente) {

      porcentaje = porcentajeCache;

      fechaActualizacion =
        nivel.fechaActualizacion;

      proveedor =
        nivel.proveedor || null;

      origenDato = "cache_vigente";

    } else if (porcentajeHistorico !== null) {

      porcentaje = porcentajeHistorico;

      fechaActualizacion =
        contenedor.nivel_historico_fecha;

      proveedor = "historial";

      origenDato = "base_datos_historica";

    } else if (porcentajeCache !== null) {

      porcentaje = porcentajeCache;

      fechaActualizacion =
        nivel.fechaActualizacion;

      proveedor =
        nivel.proveedor || null;

      origenDato = "cache_historica";
    }

    // ==================================================
    // DISPONIBILIDAD DEL DATO
    // ==================================================

    const nivelDisponible =
      porcentaje !== null;

    const nivelEnVivo =
      nivelDisponible &&
      nivelVigente &&
      origenDato === "cache_vigente";

    // ==================================================
    // RESPUESTA AL FRONTEND
    // ==================================================

    const {
      nivel_historico_valor,
      nivel_historico_fecha,
      nivel_historico_fuente,
      ...datosContenedor
    } = contenedor;

    return {
      ...datosContenedor,

      // Compatibilidad con NuevoRegistro.
      estado_actual_litros: porcentaje,

      // Porcentaje para el dashboard.
      porcentaje_llenado: porcentaje,

      // Existe un dato que se puede mostrar.
      nivel_disponible: nivelDisponible,

      // Estado real de vigencia.
      nivel_vigente: nivelEnVivo,

      // Indica que no es lectura en vivo.
      nivel_historico:
        nivelDisponible && !nivelEnVivo,

      // Última fecha conocida.
      nivel_actualizado_en:
        fechaActualizacion,

      // Procedencia del dato mostrado.
      nivel_proveedor: proveedor,

      // Información para diagnóstico.
      nivel_origen_dato: origenDato,

      // Fuente declarada en la lectura histórica.
      nivel_fuente_historica:
        nivel_historico_fuente || null,
    };
  });

  return contenedores;
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  listarContenedores,
};
