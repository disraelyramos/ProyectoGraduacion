"use strict";

const pool = require("../config/db");

const nivelCache = require(
  "./controlDSH/mediciones/NivelActualCache.service"
);

// ======================================================
// VALIDAR PORCENTAJE
// ======================================================

function porcentajeValido(valor) {
  if (valor === null || valor === undefined || valor === "") {
    return null;
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero < 0 || numero > 100) {
    return null;
  }

  return Number(numero.toFixed(2));
}

// ======================================================
// NORMALIZAR FECHA PARA RESPUESTA API
// ======================================================
// Las fechas válidas se envían en formato ISO UTC.
// No se suman ni restan horas manualmente.
// No se modifican registros en PostgreSQL.
// ======================================================

function normalizarFecha(fecha) {
  if (fecha === null || fecha === undefined || fecha === "") {
    return null;
  }

  if (fecha instanceof Date) {
    if (Number.isNaN(fecha.getTime())) {
      return null;
    }

    return fecha.toISOString();
  }

  if (typeof fecha !== "string") {
    return null;
  }

  const texto = fecha.trim();

  if (!texto) {
    return null;
  }

  if (!/[zZ]$|[+-]\d{2}:\d{2}$/.test(texto)) {
    return null;
  }

  const valor = new Date(texto);

  if (Number.isNaN(valor.getTime())) {
    return null;
  }

  return valor.toISOString();
}

// ======================================================
// LISTAR CONTENEDORES
// ======================================================

async function listarContenedores() {
  // Se consulta la lectura de nivel insertada más recientemente.
  // El ID identifica el orden de inserción, aunque una lectura
  // anterior tenga una fecha_hora futura o distinta.
  // Esta consulta es de solo lectura.
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
      historial.fecha_hora AS nivel_historico_fecha,
      historial.fuente_lectura AS nivel_historico_fuente

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
      WHERE l.contenedor_id = c.id_contenedor
        AND tl.nombre = 'nivel_porcentaje'
        AND um.nombre = '%'
        AND l.estado_lectura = 'normal'
        AND l.valor BETWEEN 0 AND 100
      ORDER BY l.id DESC
      LIMIT 1
    ) historial ON TRUE

    ORDER BY c.id_contenedor DESC
  `);

  const contenedores = rows.map((contenedor) => {
    const nivel = nivelCache.obtenerNivel(
      contenedor.id_contenedor
    );

    const porcentajeCache = nivel?.fechaActualizacion
      ? porcentajeValido(nivel.porcentaje)
      : null;

    const porcentajeHistorico = porcentajeValido(
      contenedor.nivel_historico_valor
    );

    const nivelVigente =
      nivel?.vigente === true &&
      porcentajeCache !== null &&
      nivel?.proveedor !== "historial";

    let porcentaje = null;
    let fechaActualizacion = null;
    let proveedor = null;
    let origenDato = null;

    // Prioridad: última lectura guardada en PostgreSQL.
    // Esto permite reflejar los INSERT sin reiniciar Railway.
    // Si no hay lecturas en BD, se usa la caché como respaldo.
    if (porcentajeHistorico !== null) {
      porcentaje = porcentajeHistorico;
      fechaActualizacion = contenedor.nivel_historico_fecha;
      proveedor = "historial";
      origenDato = "base_datos_historica";
    } else if (nivelVigente) {
      porcentaje = porcentajeCache;
      fechaActualizacion = nivel.fechaActualizacion;
      proveedor = nivel.proveedor || null;
      origenDato = "cache_vigente";
    } else if (porcentajeCache !== null) {
      porcentaje = porcentajeCache;
      fechaActualizacion = nivel.fechaActualizacion;
      proveedor = nivel.proveedor || null;
      origenDato = "cache_historica";
    }

    const nivelDisponible = porcentaje !== null;

    const nivelEnVivo =
      nivelDisponible &&
      origenDato === "cache_vigente";

    const fechaNormalizada = normalizarFecha(fechaActualizacion);

    const {
      nivel_historico_valor,
      nivel_historico_fecha,
      nivel_historico_fuente,
      ...datosContenedor
    } = contenedor;

    return {
      ...datosContenedor,
      estado_actual_litros: porcentaje,
      porcentaje_llenado: porcentaje,
      nivel_disponible: nivelDisponible,
      nivel_vigente: nivelEnVivo,
      nivel_historico: nivelDisponible && !nivelEnVivo,
      nivel_actualizado_en: fechaNormalizada,
      nivel_proveedor: proveedor,
      nivel_origen_dato: origenDato,
      nivel_fuente_historica: nivel_historico_fuente || null,
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
