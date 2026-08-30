const pool = require("../../config/db");


const BUSQUEDAS_PERMITIDAS = new Set([
  "codigo",
  "tipo",
]);

const ORDENES_PERMITIDOS = new Set([
  "ASC",
  "DESC",
]);

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

const MIN_SEARCH_LENGTH = 2;
const MAX_SEARCH_LENGTH = 200;


function crearErrorValidacion(
  message,
  code = "VALIDATION_ERROR"
) {
  const error =
    new Error(message);

  error.statusCode = 400;
  error.type = "validation";
  error.code = code;

  return error;
}


function normalizarBuscarPor(valor) {
  const buscarPor =
    String(valor || "")
      .trim()
      .toLowerCase();


  if (
    !BUSQUEDAS_PERMITIDAS.has(
      buscarPor
    )
  ) {
    throw crearErrorValidacion(
      "El tipo de búsqueda debe ser 'codigo' o 'tipo'."
    );
  }


  return buscarPor;
}


function normalizarValorBusqueda(valor) {
  const texto =
    String(valor || "")
      .trim();


  if (
    texto.length <
    MIN_SEARCH_LENGTH
  ) {
    throw crearErrorValidacion(
      `La búsqueda debe tener al menos ${MIN_SEARCH_LENGTH} caracteres.`
    );
  }


  if (
    texto.length >
    MAX_SEARCH_LENGTH
  ) {
    throw crearErrorValidacion(
      `La búsqueda no puede superar ${MAX_SEARCH_LENGTH} caracteres.`
    );
  }


  return texto;
}


function normalizarTexto(valor) {
  return String(valor || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    );
}


function normalizarTipoBusqueda(valor) {
  const texto =
    String(valor || "")
      .trim();


  const normalizado =
    normalizarTexto(
      texto
    );


  if (
    normalizado.includes(
      "bio"
    )
  ) {
    return "Infeccioso";
  }


  return texto;
}


function normalizarFechaISO(
  valor,
  campo
) {
  const fecha =
    String(valor || "")
      .trim();


  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      fecha
    )
  ) {
    throw crearErrorValidacion(
      `${campo} debe tener formato YYYY-MM-DD.`
    );
  }


  const fechaUtc =
    new Date(
      `${fecha}T00:00:00.000Z`
    );


  if (
    Number.isNaN(
      fechaUtc.getTime()
    ) ||
    fechaUtc
      .toISOString()
      .slice(0, 10) !== fecha
  ) {
    throw crearErrorValidacion(
      `${campo} contiene una fecha inválida.`
    );
  }


  return fecha;
}


function normalizarOrden(valor) {
  if (
    valor === undefined ||
    valor === null ||
    String(valor).trim() === ""
  ) {
    return "DESC";
  }


  const order =
    String(valor)
      .trim()
      .toUpperCase();


  if (
    !ORDENES_PERMITIDOS.has(
      order
    )
  ) {
    throw crearErrorValidacion(
      "El orden debe ser 'asc' o 'desc'."
    );
  }


  return order;
}


function normalizarFiltros(
  filtros = {}
) {
  const buscarPor =
    normalizarBuscarPor(
      filtros.buscarPor
    );


  const valorBusqueda =
    normalizarValorBusqueda(
      filtros.valorBusqueda
    );


  const fechaInicio =
    normalizarFechaISO(
      filtros.fechaInicio,
      "fechaInicio"
    );


  const fechaFin =
    normalizarFechaISO(
      filtros.fechaFin,
      "fechaFin"
    );


  if (
    fechaInicio >
    fechaFin
  ) {
    throw crearErrorValidacion(
      "La fecha de inicio no puede ser mayor que la fecha final."
    );
  }


  const order =
    normalizarOrden(
      filtros.order
    );


  return {
    buscarPor,
    valorBusqueda,
    fechaInicio,
    fechaFin,
    order,
  };
}


function crearFiltrosAplicados(
  filtrosSeguros
) {
  return {
    buscarPor:
      filtrosSeguros.buscarPor,

    valorBusqueda:
      filtrosSeguros.valorBusqueda,

    fechaInicio:
      filtrosSeguros.fechaInicio,

    fechaFin:
      filtrosSeguros.fechaFin,

    order:
      filtrosSeguros.order
        .toLowerCase(),
  };
}


function normalizarPaginacion(
  opciones = {}
) {
  const paginado =
    opciones.paginado !== false;


  if (!paginado) {
    return {
      paginado: false,
      limit: null,
      offset: null,
    };
  }


  const limitRecibido =
    Number(
      opciones.limit
    );


  const offsetRecibido =
    Number(
      opciones.offset
    );


  const limit =
    Number.isSafeInteger(
      limitRecibido
    ) &&
    limitRecibido > 0
      ? Math.min(
          limitRecibido,
          MAX_LIMIT
        )
      : DEFAULT_LIMIT;


  const offset =
    Number.isSafeInteger(
      offsetRecibido
    ) &&
    offsetRecibido >= 0
      ? offsetRecibido
      : 0;


  return {
    paginado: true,
    limit,
    offset,
  };
}


function construirFiltroSQL({
  buscarPor,
  fechaInicio,
  fechaFin,
  valorBusqueda,
}) {
  const valorBusquedaSQL =
    buscarPor === "tipo"
      ? normalizarTipoBusqueda(
          valorBusqueda
        )
      : valorBusqueda;


  const params = [
    fechaInicio,
    fechaFin,
    valorBusquedaSQL,
  ];


  let where = `
    WHERE r.fecha_recoleccion >= $1::date

      AND r.fecha_recoleccion <
        (
          $2::date +
          INTERVAL '1 day'
        )
  `;


  if (
    buscarPor === "codigo"
  ) {
    where += `
      AND c.codigo
        ILIKE '%' || $3 || '%'
    `;
  }


  if (
    buscarPor === "tipo"
  ) {
    where += `
      AND tr.nombre
        ILIKE '%' || $3 || '%'
    `;
  }


  return {
    where,
    params,
  };
}


async function detectarCriterioAlternativo({
  buscarPor,
  valorBusqueda,
}) {
  const valorTipo =
    normalizarTipoBusqueda(
      valorBusqueda
    );


  const sql = `
    SELECT

      EXISTS (
        SELECT 1

        FROM contenedores c

        WHERE
          regexp_replace(
            translate(
              LOWER(
                COALESCE(
                  c.codigo,
                  ''
                )
              ),
              'áéíóúüñ',
              'aeiouun'
            ),
            '[^a-z0-9]',
            '',
            'g'
          )

          LIKE

          '%' ||

          regexp_replace(
            translate(
              LOWER($1),
              'áéíóúüñ',
              'aeiouun'
            ),
            '[^a-z0-9]',
            '',
            'g'
          )

          || '%'
      ) AS existe_codigo,


      EXISTS (
        SELECT 1

        FROM tipos_residuo tr

        WHERE
          regexp_replace(
            translate(
              LOWER(
                COALESCE(
                  tr.nombre,
                  ''
                )
              ),
              'áéíóúüñ',
              'aeiouun'
            ),
            '[^a-z0-9]',
            '',
            'g'
          )

          LIKE

          '%' ||

          regexp_replace(
            translate(
              LOWER($2),
              'áéíóúüñ',
              'aeiouun'
            ),
            '[^a-z0-9]',
            '',
            'g'
          )

          || '%'
      ) AS existe_tipo
  `;


  const { rows } =
    await pool.query(
      sql,
      [
        valorBusqueda,
        valorTipo,
      ]
    );


  const resultado =
    rows?.[0] || {};


  const existeCodigo =
    resultado.existe_codigo ===
    true;


  const existeTipo =
    resultado.existe_tipo ===
    true;


  if (
    buscarPor === "codigo" &&
    !existeCodigo &&
    existeTipo
  ) {
    throw crearErrorValidacion(
      "Seleccionó 'Código', pero el valor ingresado corresponde a un Tipo de Residuo. Cambie la opción 'Buscar por' a 'Tipo Residuo'.",
      "SEARCH_TYPE_MISMATCH"
    );
  }


  if (
    buscarPor === "tipo" &&
    !existeTipo &&
    existeCodigo
  ) {
    throw crearErrorValidacion(
      "Seleccionó 'Tipo Residuo', pero el valor ingresado corresponde a un Código. Cambie la opción 'Buscar por' a 'Código'.",
      "SEARCH_TYPE_MISMATCH"
    );
  }
}


async function contarHistorial({
  where,
  params,
}) {
  const sql = `
    SELECT
      COUNT(*)::int AS total

    FROM recolecciones r

    INNER JOIN contenedores c
      ON c.id_contenedor =
         r.contenedor_id

    INNER JOIN tipos_residuo tr
      ON tr.id =
         c.id_tipo_residuo

    ${where}
  `;


  const { rows } =
    await pool.query(
      sql,
      params
    );


  return Number(
    rows?.[0]?.total ||
    0
  );
}


async function consultarDetalle({
  where,
  params,
  order,
  paginacion,
}) {
  const paginacionSQL =
    paginacion.paginado
      ? "LIMIT $4 OFFSET $5"
      : "";


  const sql = `
    SELECT
      r.id
        AS recoleccion_id,

      c.codigo
        AS codigo,

      to_char(
        r.fecha_recoleccion,
        'DD/MM/YY HH24:MI'
      ) AS fecha,

      d.nombre
        AS distrito,

      tr.id
        AS tipo_residuo_id,

      tr.nombre
        AS tipo_residuo,

      r.numero_recibo,

      r.responsable,

      er.nombre
        AS empresa_recolectora,

      r.porcentaje_pendiente,

      r.cantidad_libras_pendientes,

      r.observaciones

    FROM recolecciones r

    INNER JOIN contenedores c
      ON c.id_contenedor =
         r.contenedor_id

    INNER JOIN tipos_residuo tr
      ON tr.id =
         c.id_tipo_residuo

    LEFT JOIN distritos d
      ON d.id =
         r.distrito_id

    LEFT JOIN empresas_recolectoras er
      ON er.id =
         r.empresa_id

    ${where}

    ORDER BY
      r.fecha_recoleccion ${order},
      r.id ${order}

    ${paginacionSQL}
  `;


  const queryParams =
    paginacion.paginado
      ? [
          ...params,
          paginacion.limit,
          paginacion.offset,
        ]
      : params;


  const { rows } =
    await pool.query(
      sql,
      queryParams
    );


  return rows || [];
}


function mapearDetalle(
  rows = []
) {
  return rows.map(
    (row) => ({
      recoleccion_id:
        Number(
          row.recoleccion_id
        ),

      codigo:
        row.codigo,

      fecha:
        row.fecha,

      distrito:
        row.distrito,

      tipo_residuo_id:
        Number(
          row.tipo_residuo_id
        ),

      tipo_residuo:
        row.tipo_residuo,

      numero_recibo:
        row.numero_recibo,

      responsable:
        row.responsable,

      empresa_recolectora:
        row.empresa_recolectora,

      porcentaje_pendiente:
        row.porcentaje_pendiente,

      cantidad_libras_pendientes:
        row.cantidad_libras_pendientes,

      observaciones:
        row.observaciones,
    })
  );
}


async function consultarPesajes(
  recoleccionIds
) {
  if (
    !Array.isArray(
      recoleccionIds
    ) ||
    recoleccionIds.length === 0
  ) {
    return [];
  }


  const sql = `
    SELECT DISTINCT ON (
      h.recoleccion_id
    )

      h.recoleccion_id,

      h.total_en_libras,

      h.porcentaje_recolectado,

      h.porcentaje_llenado,

      h.costo_por_libra_aplicado,

      h.total_costo_q

    FROM historial_calculo_costos h

    WHERE h.recoleccion_id =
      ANY($1::int[])

    ORDER BY
      h.recoleccion_id ASC,
      h.id DESC;
  `;


  const { rows } =
    await pool.query(
      sql,
      [
        recoleccionIds,
      ]
    );


  return rows || [];
}


function mapearPesajes(
  detalleRows,
  pesajeRows
) {
  const pesajePorRecoleccion =
    new Map();


  for (
    const row of pesajeRows
  ) {
    pesajePorRecoleccion.set(
      Number(
        row.recoleccion_id
      ),
      row
    );
  }


  return detalleRows.map(
    (row) => {

      const recoleccionId =
        Number(
          row.recoleccion_id
        );


      const pesaje =
        pesajePorRecoleccion.get(
          recoleccionId
        );


      return {
        recoleccion_id:
          recoleccionId,

        total_en_libras:
          pesaje
            ?.total_en_libras ??
          null,

        porcentaje_recolectado:
          pesaje
            ?.porcentaje_recolectado ??
          null,

        porcentaje_llenado:
          pesaje
            ?.porcentaje_llenado ??
          null,

        costo_por_libra_aplicado:
          pesaje
            ?.costo_por_libra_aplicado ??
          null,

        total_costo_q:
          pesaje
            ?.total_costo_q ??
          null,
      };
    }
  );
}


async function consultarHistorial(
  filtros,
  opciones = {}
) {
  const filtrosSeguros =
    normalizarFiltros(
      filtros
    );


  const paginacion =
    normalizarPaginacion(
      opciones
    );


  const filtrosAplicados =
    crearFiltrosAplicados(
      filtrosSeguros
    );


  const {
    where,
    params,
  } =
    construirFiltroSQL(
      filtrosSeguros
    );


  const total =
    await contarHistorial({
      where,
      params,
    });


  if (
    total === 0
  ) {
    await detectarCriterioAlternativo({
      buscarPor:
        filtrosSeguros.buscarPor,

      valorBusqueda:
        filtrosSeguros.valorBusqueda,
    });


    return {
      total: 0,
      detalle: [],
      pesaje: [],
      filtrosAplicados,
    };
  }


  if (
    paginacion.paginado &&
    paginacion.offset >= total
  ) {
    return {
      total,
      detalle: [],
      pesaje: [],
      filtrosAplicados,
    };
  }


  const detalleRows =
    await consultarDetalle({
      where,
      params,

      order:
        filtrosSeguros.order,

      paginacion,
    });


  if (
    detalleRows.length === 0
  ) {
    return {
      total,
      detalle: [],
      pesaje: [],
      filtrosAplicados,
    };
  }


  const recoleccionIds =
    detalleRows
      .map(
        (row) =>
          Number(
            row.recoleccion_id
          )
      )
      .filter(
        (id) =>
          Number.isSafeInteger(
            id
          ) &&
          id > 0
      );


  const pesajeRows =
    await consultarPesajes(
      recoleccionIds
    );


  return {
    total,

    detalle:
      mapearDetalle(
        detalleRows
      ),

    pesaje:
      mapearPesajes(
        detalleRows,
        pesajeRows
      ),

    filtrosAplicados,
  };
}


module.exports = {
  consultarHistorial,
};