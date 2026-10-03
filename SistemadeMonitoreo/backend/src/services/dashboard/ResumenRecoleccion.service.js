
const pool = require("../../config/db");

// ======================================================
// TIPOS DE RESIDUO
// ======================================================

const TIPOS = [
  {
    id: 1,
    key: "bioinfeccioso",
    name: "Bioinfeccioso",
  },
  {
    id: 2,
    key: "punzocortante",
    name: "Punzocortante",
  },
];

// ======================================================
// MESES PARA PRESENTACIÓN
// ======================================================

const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// ======================================================
// UTILIDADES NUMÉRICAS
// ======================================================

const numero = (valor) => {
  const resultado = Number(valor);

  return Number.isFinite(resultado)
    ? resultado
    : 0;
};

const redondear = (valor) =>
  Math.round(
    (numero(valor) + Number.EPSILON) * 100
  ) / 100;

// ======================================================
// FORMATO DE PERÍODO
// ======================================================

const nombrePeriodo = (mes, anio) => {
  const indice = numero(mes) - 1;
  const nombre = MESES[indice];

  if (!nombre || !Number.isInteger(numero(anio))) {
    throw new Error(
      "El período recibido de la base de datos no es válido."
    );
  }

  return `${nombre} ${anio}`;
};

// ======================================================
// COMPARACIÓN ENTRE PERÍODOS
// ======================================================

const compararPesos = (
  pesoActual,
  pesoAnterior
) => {
  const actual = redondear(pesoActual);
  const anterior = redondear(pesoAnterior);

  const diferencia = redondear(
    actual - anterior
  );

  // No existe una base válida para calcular
  // un porcentaje de crecimiento.
  if (anterior === 0 && actual > 0) {
    return {
      previousCollected: anterior,
      difference: diferencia,
      changePercentage: null,
      trend: "no-base",
    };
  }

  if (actual === 0 && anterior === 0) {
    return {
      previousCollected: anterior,
      difference: 0,
      changePercentage: 0,
      trend: "unchanged",
    };
  }

  const changePercentage = redondear(
    (diferencia / anterior) * 100
  );

  return {
    previousCollected: anterior,
    difference: diferencia,
    changePercentage,
    trend:
      diferencia > 0
        ? "increase"
        : diferencia < 0
          ? "decrease"
          : "unchanged",
  };
};

// ======================================================
// CONSULTAR RESUMEN DE RECOLECCIÓN
// ======================================================

async function consultarResumenRecoleccion() {
  const sql = `
    WITH referencia AS (
      SELECT
        CURRENT_TIMESTAMP AS ahora,

        date_trunc(
          'month',
          CURRENT_TIMESTAMP
        ) AS inicio_mes,

        date_trunc(
          'week',
          CURRENT_TIMESTAMP
        ) AS inicio_semana,

        date_trunc(
          'year',
          CURRENT_TIMESTAMP
        ) AS inicio_anio
    ),

    periodos AS (
      SELECT
        'month'::text AS periodo,
        inicio_mes AS inicio,
        ahora AS fin

      FROM referencia

      UNION ALL

      SELECT
        'week'::text,
        inicio_semana,
        ahora

      FROM referencia

      UNION ALL

      SELECT
        'year'::text,
        inicio_anio,
        ahora

      FROM referencia

      UNION ALL

      SELECT
        'previousMonth'::text,

        inicio_mes - INTERVAL '1 month',

        inicio_mes

      FROM referencia
    ),

    registros AS (
      SELECT
        p.periodo,

        tr.id AS tipo_residuo_id,

        r.id AS recoleccion_id,

        r.fecha_recoleccion,

        h.total_en_libras

      FROM periodos p

      CROSS JOIN tipos_residuo tr

      LEFT JOIN contenedores c
        ON c.id_tipo_residuo = tr.id

      LEFT JOIN recolecciones r
        ON r.contenedor_id = c.id_contenedor

        AND r.fecha_recoleccion >= p.inicio

        AND r.fecha_recoleccion < p.fin

      LEFT JOIN LATERAL (
        SELECT
          hc.total_en_libras

        FROM historial_calculo_costos hc

        WHERE hc.recoleccion_id = r.id

        ORDER BY hc.id DESC

        LIMIT 1
      ) h ON TRUE

      WHERE tr.id IN (1, 2)
    ),

    totales AS (
      SELECT
        periodo,

        tipo_residuo_id,

        COUNT(
          recoleccion_id
        )::int AS recolecciones,

        COALESCE(
          SUM(total_en_libras),
          0
        ) AS libras,

        COUNT(
          total_en_libras
        )::int AS pesajes_disponibles,

        TO_CHAR(
          MAX(fecha_recoleccion),
          'DD/MM/YYYY HH24:MI'
        ) AS ultima_recoleccion

      FROM registros

      GROUP BY
        periodo,
        tipo_residuo_id
    )

    SELECT
      t.*,

      EXTRACT(
        MONTH FROM ref.ahora
      )::int AS mes_actual,

      EXTRACT(
        YEAR FROM ref.ahora
      )::int AS anio_actual,

      EXTRACT(
        MONTH FROM (
          ref.inicio_mes - INTERVAL '1 month'
        )
      )::int AS mes_anterior,

      EXTRACT(
        YEAR FROM (
          ref.inicio_mes - INTERVAL '1 month'
        )
      )::int AS anio_anterior

    FROM totales t

    CROSS JOIN referencia ref

    ORDER BY
      t.periodo,
      t.tipo_residuo_id;
  `;

  const { rows } = await pool.query(sql);

  // ====================================================
  // REFERENCIA TEMPORAL DE POSTGRESQL
  // ====================================================

  const referencia = rows[0];

  if (!referencia) {
    throw new Error(
      "No fue posible obtener el período de consulta."
    );
  }

  const mesesTranscurridos = numero(
    referencia.mes_actual
  );

  if (
    !Number.isInteger(mesesTranscurridos) ||
    mesesTranscurridos < 1 ||
    mesesTranscurridos > 12
  ) {
    throw new Error(
      "La referencia temporal no es válida."
    );
  }

  const periodoActual = nombrePeriodo(
    referencia.mes_actual,
    referencia.anio_actual
  );

  const periodoAnterior = nombrePeriodo(
    referencia.mes_anterior,
    referencia.anio_anterior
  );

  // ====================================================
  // OBTENER REGISTRO DE UN TIPO Y PERÍODO
  // ====================================================

  const obtenerRegistro = (
    periodo,
    tipoId
  ) =>
    rows.find(
      (row) =>
        row.periodo === periodo &&
        numero(row.tipo_residuo_id) === tipoId
    );

  // ====================================================
  // CONSTRUIR RESUMEN POR PERÍODO
  // ====================================================

  const construirPeriodo = (periodo) => {
    const containers = TIPOS.map((tipo) => {
      const registro = obtenerRegistro(
        periodo,
        tipo.id
      );

      const collected = redondear(
        registro?.libras
      );

      const collections = numero(
        registro?.recolecciones
      );

      const availableWeights = numero(
        registro?.pesajes_disponibles
      );

      return {
        id: tipo.key,

        name: tipo.name,

        collected,

        collections,

        averagePerCollection:
          availableWeights > 0
            ? redondear(
                collected / availableWeights
              )
            : 0,

        monthlyAverage:
          periodo === "year"
            ? redondear(
                collected / mesesTranscurridos
              )
            : 0,

        lastCollection:
          registro?.ultima_recoleccion ||
          "Sin recolecciones",

        availableWeights,

        missingWeights: Math.max(
          0,
          collections - availableWeights
        ),
      };
    });

    const totalCollected = redondear(
      containers.reduce(
        (total, item) =>
          total + item.collected,
        0
      )
    );

    const totalCollections = containers.reduce(
      (total, item) =>
        total + item.collections,
      0
    );

    return {
      summary: {
        totalCollected,

        totalCollections,

        monthlyAverage:
          periodo === "year"
            ? redondear(
                totalCollected /
                  mesesTranscurridos
              )
            : 0,
      },

      containers,
    };
  };

  // ====================================================
  // RESÚMENES COMPARTIDOS
  // ====================================================

  const month = construirPeriodo("month");

  const week = construirPeriodo("week");

  const year = construirPeriodo("year");

  const previousMonth = construirPeriodo(
    "previousMonth"
  );

  // ====================================================
  // DISTRIBUCIÓN DEL RESIDUO
  // ====================================================

  const totalActual =
    month.summary.totalCollected;

  const totalAnterior =
    previousMonth.summary.totalCollected;

  const distributionContainers =
    month.containers.map((actual) => {
      const anterior =
        previousMonth.containers.find(
          (item) =>
            item.id === actual.id
        );

      const percentage =
        totalActual > 0
          ? redondear(
              (actual.collected /
                totalActual) *
                100
            )
          : 0;

      const comparison = compararPesos(
        actual.collected,
        anterior?.collected
      );

      return {
        id: actual.id,

        name: actual.name,

        collected: actual.collected,

        percentage,

        ...comparison,
      };
    });

  // ====================================================
  // COMPARACIÓN GENERAL
  // ====================================================

  const comparison = compararPesos(
    totalActual,
    totalAnterior
  );

  // ====================================================
  // RESPUESTA FINAL
  // ====================================================

  return {
    month: {
      label: periodoActual,

      ...month,
    },

    week: {
      label: "Esta semana",

      ...week,
    },

    year: {
      label: String(
        referencia.anio_actual
      ),

      ...year,
    },

    distribution: {
      period: periodoActual,

      total: totalActual,

      previousMonth: {
        period: periodoAnterior,

        total: totalAnterior,
      },

      containers:
        distributionContainers,

      comparison,
    },
  };
}

// ======================================================
// EXPORTACIÓN
// ======================================================

module.exports = {
  consultarResumenRecoleccion,
};
