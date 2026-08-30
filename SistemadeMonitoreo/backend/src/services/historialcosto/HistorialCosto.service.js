const pool = require("../../config/db");


/* =========================================================
   CONSTANTES
   ========================================================= */

const TIMEZONE =
  "America/Guatemala";


/* =========================================================
   AGRUPACIÓN SQL
   ========================================================= */

function groupLabelExpr(
  groupBy
) {
  if (groupBy === "semana") {
    return `
      to_char(
        date_trunc(
          'week',
          r.fecha_recoleccion
        ),
        '"Semana "IW" - "IYYY'
      )
    `;
  }


  if (groupBy === "anio") {
    return `
      to_char(
        date_trunc(
          'year',
          r.fecha_recoleccion
        ),
        'YYYY'
      )
    `;
  }


  return `
    to_char(
      date_trunc(
        'month',
        r.fecha_recoleccion
      ),
      'YYYY-MM'
    )
  `;
}


/* =========================================================
   NORMALIZAR KPIS
   ========================================================= */

function mapKpis(row) {
  return {
    total_q:
      Number(
        row?.total_q
      ) || 0,

    total_lbs:
      Number(
        row?.total_lbs
      ) || 0,

    q_por_lb:
      Number(
        row?.q_por_lb
      ) || 0,

    recolecciones:
      Number(
        row?.recolecciones
      ) || 0,
  };
}


/* =========================================================
   CONSTRUIR WHERE

   IMPORTANTE:
   Los valores continúan parametrizados.

   Nunca se insertan directamente valores recibidos
   desde frontend dentro del SQL.
   ========================================================= */

function buildWhere({
  fechaInicio,
  fechaFin,
  distritoId,
  empresaId,
  contenedorId,
}) {
  let where = `
    WHERE
      r.fecha_recoleccion::date
      BETWEEN
        $1::date
      AND
        $2::date
  `;


  const params = [
    fechaInicio,
    fechaFin,
  ];


  let position = 2;


  const addEq = (
    field,
    value
  ) => {
    if (
      value === null ||
      value === undefined
    ) {
      return;
    }


    params.push(
      value
    );


    position += 1;


    where += `
      AND
        ${field}
        =
        $${position}
    `;
  };


  addEq(
    "r.distrito_id",
    distritoId
  );


  addEq(
    "r.empresa_id",
    empresaId
  );


  addEq(
    "r.contenedor_id",
    contenedorId
  );


  return {
    where,
    params,
  };
}


/* =========================================================
   FROM / JOINS DEL REPORTE

   Se conserva exactamente la estructura utilizada
   actualmente por HistorialCosto.controller.
   ========================================================= */

const FROM_JOIN = `
  FROM
    historial_calculo_costos h

  JOIN
    recolecciones r
    ON
      r.id =
      h.recoleccion_id

  JOIN
    contenedores c
    ON
      c.id_contenedor =
      r.contenedor_id

  LEFT JOIN
    distritos d
    ON
      d.id =
      r.distrito_id

  LEFT JOIN
    empresas_recolectoras er
    ON
      er.id =
      r.empresa_id
`;


/* =========================================================
   OBTENER NOMBRES DE LOS FILTROS

   Estos nombres son utilizados principalmente para:

   - respuesta del reporte
   - snapshot
   - PDF
   - Excel
   ========================================================= */

async function fetchFiltrosLabels(
  client,
  {
    distritoId,
    empresaId,
    contenedorId,
  }
) {
  const sql = `
    SELECT
      COALESCE(
        d.nombre,
        ''
      )
        AS distrito_nombre,

      COALESCE(
        er.nombre,
        ''
      )
        AS empresa_nombre,

      COALESCE(
        c.codigo,
        ''
      )
        AS contenedor_codigo

    FROM
      distritos d

    CROSS JOIN
      empresas_recolectoras er

    CROSS JOIN
      contenedores c

    WHERE
      d.id = $1

      AND
      er.id = $2

      AND
      c.id_contenedor = $3

    LIMIT 1
  `;


  const {
    rows,
  } =
    await client.query(
      sql,
      [
        distritoId,
        empresaId,
        contenedorId,
      ]
    );


  const row =
    rows?.[0] || {};


  return {
    distritoNombre:
      row.distrito_nombre || "",

    empresaNombre:
      row.empresa_nombre || "",

    contenedorCodigo:
      row.contenedor_codigo || "",
  };
}


/* =========================================================
   CONSULTAR REPORTE

   Esta función concentra toda la consulta del Historial
   de Costos.

   Puede trabajar:

   - paginado para la pantalla
   - sin paginación para PDF / Excel
   ========================================================= */

async function consultarReporteCosto(
  client,
  filtros,
  {
    paginado = true,
    limit = 10,
    offset = 0,
  } = {}
) {
  const {
    fechaInicio,
    fechaFin,
    agruparPor,
    distritoId,
    empresaId,
    contenedorId,
    order,
  } =
    filtros;


  const {
    where,
    params,
  } =
    buildWhere({
      fechaInicio,
      fechaFin,
      distritoId,
      empresaId,
      contenedorId,
    });


  const grpLabel =
    groupLabelExpr(
      agruparPor
    );


  /* =======================================================
     KPIS
     ======================================================= */

  const kpiSql = `
    SELECT
      COALESCE(
        SUM(
          h.total_costo_q
        ),
        0
      )::numeric
        AS total_q,

      COALESCE(
        SUM(
          h.total_en_libras
        ),
        0
      )::numeric
        AS total_lbs,

      CASE

        WHEN
          COALESCE(
            SUM(
              h.total_en_libras
            ),
            0
          ) > 0

        THEN
          ROUND(
            SUM(
              h.total_costo_q
            )
            /
            SUM(
              h.total_en_libras
            ),
            4
          )

        ELSE
          0

      END
        AS q_por_lb,

      COUNT(*)::int
        AS recolecciones

    ${FROM_JOIN}

    ${where}
  `;


  const {
    rows:
      kpiRows,
  } =
    await client.query(
      kpiSql,
      params
    );


  const kpis =
    mapKpis(
      kpiRows?.[0]
    );


  /* =======================================================
     RESUMEN POR PERIODO
     ======================================================= */

  const resumenSql = `
    SELECT
      ${grpLabel}
        AS periodo,

      COALESCE(
        SUM(
          h.total_costo_q
        ),
        0
      )::numeric
        AS total_q,

      COALESCE(
        SUM(
          h.total_en_libras
        ),
        0
      )::numeric
        AS total_lbs,

      CASE

        WHEN
          COALESCE(
            SUM(
              h.total_en_libras
            ),
            0
          ) > 0

        THEN
          ROUND(
            SUM(
              h.total_costo_q
            )
            /
            SUM(
              h.total_en_libras
            ),
            4
          )

        ELSE
          0

      END
        AS q_por_lb,

      COUNT(*)::int
        AS recolecciones

    ${FROM_JOIN}

    ${where}

    GROUP BY
      ${grpLabel}

    ORDER BY
      ${grpLabel}
      ASC
  `;


  const {
    rows:
      resumenRows,
  } =
    await client.query(
      resumenSql,
      params
    );


  const resumen =
    resumenRows || [];


  /* =======================================================
     TOP 5 CONTENEDORES
     ======================================================= */

  const topContenedoresSql = `
    SELECT
      c.codigo
        AS contenedor_codigo,

      COALESCE(
        SUM(
          h.total_costo_q
        ),
        0
      )::numeric
        AS total_q

    ${FROM_JOIN}

    ${where}

    GROUP BY
      c.codigo

    ORDER BY
      total_q
      DESC

    LIMIT 5
  `;


  const {
    rows:
      topRows,
  } =
    await client.query(
      topContenedoresSql,
      params
    );


  const topContenedores =
    topRows || [];


  /* =======================================================
     DETALLE
     ======================================================= */

  const detalleBaseSql = `
    SELECT
      to_char(
        r.fecha_recoleccion
          AT TIME ZONE
          '${TIMEZONE}',
        'DD/MM/YY HH24:MI'
      )
        AS fecha,

      c.codigo
        AS codigo_contenedor,

      COALESCE(
        d.nombre,
        ''
      )
        AS distrito,

      COALESCE(
        er.nombre,
        ''
      )
        AS empresa_recolectora,

      h.total_en_libras,

      h.porcentaje_llenado,

      h.costo_por_libra_aplicado,

      h.total_costo_q

    ${FROM_JOIN}

    ${where}

    ORDER BY
      r.fecha_recoleccion
      ${order},

      r.id
      ${order}
  `;


  let detalleRows;


  if (paginado) {
    const sqlPaginado = `
      ${detalleBaseSql}

      LIMIT
        $${params.length + 1}

      OFFSET
        $${params.length + 2}
    `;


    const {
      rows,
    } =
      await client.query(
        sqlPaginado,
        [
          ...params,
          limit,
          offset,
        ]
      );


    detalleRows =
      rows || [];
  } else {
    const {
      rows,
    } =
      await client.query(
        detalleBaseSql,
        params
      );


    detalleRows =
      rows || [];
  }


  /* =======================================================
     TOTAL DEL DETALLE
     ======================================================= */

  const totalDetalleSql = `
    SELECT
      COUNT(*)::int
        AS total

    ${FROM_JOIN}

    ${where}
  `;


  const {
    rows:
      totalRows,
  } =
    await client.query(
      totalDetalleSql,
      params
    );


  const totalDetalle =
    Number(
      totalRows?.[0]?.total
    ) || 0;


  return {
    kpis,

    resumen,

    topContenedores,

    detalle: {
      total:
        totalDetalle,

      rows:
        detalleRows,
    },
  };
}


/* =========================================================
   REPORTE PARA PANTALLA

   El Controller ya no necesita manejar conexión ni SQL.
   ========================================================= */

async function obtenerReporteCosto({
  filtros,
  limit,
  offset,
}) {
  const client =
    await pool.connect();


  try {
    const [
      labels,
      result,
    ] =
      await Promise.all([
        fetchFiltrosLabels(
          client,
          {
            distritoId:
              filtros.distritoId,

            empresaId:
              filtros.empresaId,

            contenedorId:
              filtros.contenedorId,
          }
        ),

        consultarReporteCosto(
          client,
          filtros,
          {
            paginado:
              true,

            limit,

            offset,
          }
        ),
      ]);


    return {
      labels,
      result,
    };
  } finally {
    client.release();
  }
}


/* =========================================================
   REPORTE COMPLETO PARA EXPORTACIÓN

   PDF y Excel utilizan exactamente la misma fuente
   de datos del backend, pero sin paginación.
   ========================================================= */

async function obtenerReporteCostoExportacion(
  filtros
) {
  const client =
    await pool.connect();


  try {
    return await consultarReporteCosto(
      client,
      filtros,
      {
        paginado:
          false,
      }
    );
  } finally {
    client.release();
  }
}


/* =========================================================
   EXPORTACIÓN PÚBLICA
   ========================================================= */

module.exports = {
  obtenerReporteCosto,
  obtenerReporteCostoExportacion,
};