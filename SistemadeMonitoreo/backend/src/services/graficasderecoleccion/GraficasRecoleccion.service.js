const pool = require("../../config/db");

// ======================================================
// CATÁLOGOS
// ======================================================

const NOMBRES_MESES = Object.freeze({
  1: "Enero",
  2: "Febrero",
  3: "Marzo",
  4: "Abril",
  5: "Mayo",
  6: "Junio",
  7: "Julio",
  8: "Agosto",
  9: "Septiembre",
  10: "Octubre",
  11: "Noviembre",
  12: "Diciembre",
});

const MESES_POR_CUATRIMESTRE = Object.freeze({
  1: Object.freeze([1, 2, 3, 4]),
  2: Object.freeze([5, 6, 7, 8]),
  3: Object.freeze([9, 10, 11, 12]),
});

const CATEGORIAS_SEMANALES = Object.freeze([
  "Semana 1",
  "Semana 2",
  "Semana 3",
  "Semana 4",
  "Semana 5",
]);

const MAX_SEMANAS_MES =
  CATEGORIAS_SEMANALES.length;

// ======================================================
// UTILIDADES
// ======================================================

function obtenerMesesPorCuatrimestre(cuatrimestre) {
  const meses =
    MESES_POR_CUATRIMESTRE[cuatrimestre];

  return meses ? [...meses] : [];
}

function resolverTipoSerie(nombre) {
  const valor = String(nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (
    valor.includes("infeccioso") ||
    valor.includes("bio")
  ) {
    return "Bioinfeccioso";
  }

  if (valor.includes("punzo")) {
    return "Punzocortante";
  }

  return null;
}

function redondearDos(valor) {
  const numero = Number(valor || 0);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Number(numero.toFixed(2));
}

function calcularPromedio(totalLibras, cantidadSemanas) {
  if (
    !Number.isSafeInteger(cantidadSemanas) ||
    cantidadSemanas <= 0
  ) {
    return 0;
  }

  return redondearDos(
    totalLibras / cantidadSemanas
  );
}

// ======================================================
// AÑOS DISPONIBLES
// ======================================================

async function consultarAniosDisponibles() {
  const query = `
    SELECT
      EXTRACT(
        YEAR FROM MIN(fecha_recoleccion)
      )::int AS anio_inicial,

      EXTRACT(
        YEAR FROM (
          CURRENT_TIMESTAMP
          AT TIME ZONE 'America/Guatemala'
        )
      )::int AS anio_actual

    FROM recolecciones;
  `;

  const { rows } = await pool.query(query);

  const registro = rows[0] || {};

  const anioActual = Number(
    registro.anio_actual
  );

  const anioInicial =
    registro.anio_inicial == null
      ? null
      : Number(registro.anio_inicial);

  if (
    !Number.isSafeInteger(anioActual) ||
    anioActual < 2000
  ) {
    throw new Error(
      "No fue posible determinar el año actual."
    );
  }

  if (anioInicial === null) {
    return {
      anioInicial: null,
      anioActual,
      anios: [],
    };
  }

  if (
    !Number.isSafeInteger(anioInicial) ||
    anioInicial < 2000
  ) {
    throw new Error(
      "El año de la primera recolección no es válido."
    );
  }

  if (anioInicial > anioActual) {
    return {
      anioInicial,
      anioActual,
      anios: [],
    };
  }

  const anios = [];

  for (
    let anio = anioActual;
    anio >= anioInicial;
    anio--
  ) {
    anios.push(anio);
  }

  return {
    anioInicial,
    anioActual,
    anios,
  };
}

// ======================================================
// ESTRUCTURA BASE POR MES
// ======================================================

function crearMesBase(numeroMes) {
  return {
    mes: numeroMes,

    nombreMes:
      NOMBRES_MESES[numeroMes],

    categorias: [
      ...CATEGORIAS_SEMANALES,
    ],

    series: {
      Bioinfeccioso:
        Array(MAX_SEMANAS_MES).fill(0),

      Punzocortante:
        Array(MAX_SEMANAS_MES).fill(0),
    },

    totales: {
      bioinfeccioso: 0,
      punzocortante: 0,
      general: 0,
    },

    promedioSemanal: {
      bioinfeccioso: 0,
      punzocortante: 0,
      general: 0,
    },
  };
}

// ======================================================
// VALIDACIONES
// ======================================================

function validarParametrosInternos({
  anio,
  cuatrimestre,
}) {
  if (
    !Number.isSafeInteger(anio) ||
    anio < 2000 ||
    anio > 3000
  ) {
    const error = new Error(
      "El año recibido por el servicio no es válido."
    );

    error.statusCode = 400;
    error.type = "validation";
    error.code = "ANIO_INVALIDO";

    throw error;
  }

  if (
    !Number.isSafeInteger(cuatrimestre) ||
    ![1, 2, 3].includes(cuatrimestre)
  ) {
    const error = new Error(
      "El cuatrimestre recibido por el servicio no es válido."
    );

    error.statusCode = 400;
    error.type = "validation";
    error.code = "CUATRIMESTRE_INVALIDO";

    throw error;
  }
}

// ======================================================
// CONSULTA DE RECOLECCIONES CUATRIMESTRALES
// ======================================================

async function consultarDatosCuatrimestrales({
  anio,
  meses,
}) {
  const query = `
    WITH recolecciones_con_peso AS (
      SELECT
        r.id AS recoleccion_id,

        r.fecha_recoleccion,

        c.id_contenedor,

        c.codigo AS codigo_contenedor,

        tr.id AS tipo_residuo_id,

        tr.nombre AS tipo_residuo,

        hcc.total_en_libras

      FROM recolecciones r

      INNER JOIN contenedores c
        ON c.id_contenedor =
           r.contenedor_id

      INNER JOIN tipos_residuo tr
        ON tr.id =
           c.id_tipo_residuo

      LEFT JOIN LATERAL (
        SELECT
          h.total_en_libras

        FROM historial_calculo_costos h

        WHERE h.recoleccion_id = r.id

        ORDER BY h.id DESC

        LIMIT 1
      ) hcc ON TRUE

      WHERE EXTRACT(
        YEAR FROM r.fecha_recoleccion
      ) = $1

      AND EXTRACT(
        MONTH FROM r.fecha_recoleccion
      ) = ANY($2::int[])
    )

    SELECT
      EXTRACT(
        MONTH FROM fecha_recoleccion
      )::int AS mes,

      CEIL(
        EXTRACT(
          DAY FROM fecha_recoleccion
        ) / 7.0
      )::int AS semana_indice,

      tipo_residuo_id,

      tipo_residuo,

      SUM(
        COALESCE(
          total_en_libras,
          0
        )
      ) AS total_libras,

      COUNT(*)::int
        AS total_recolecciones

    FROM recolecciones_con_peso

    GROUP BY
      EXTRACT(
        MONTH FROM fecha_recoleccion
      ),

      CEIL(
        EXTRACT(
          DAY FROM fecha_recoleccion
        ) / 7.0
      ),

      tipo_residuo_id,

      tipo_residuo

    ORDER BY
      mes ASC,
      semana_indice ASC,
      tipo_residuo_id ASC;
  `;

  const { rows } = await pool.query(
    query,
    [
      anio,
      meses,
    ]
  );

  return rows || [];
}

// ======================================================
// VERIFICAR SI EXISTEN DATOS
// ======================================================

function existenDatosReales(rows) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return false;
  }

  return rows.some((row) => {
    const tipo = resolverTipoSerie(
      row.tipo_residuo
    );

    const semanaIndice = Number(
      row.semana_indice
    );

    const totalLibras = Number(
      row.total_libras
    );

    const totalRecolecciones = Number(
      row.total_recolecciones
    );

    return (
      Boolean(tipo) &&

      Number.isSafeInteger(semanaIndice) &&
      semanaIndice >= 1 &&
      semanaIndice <= MAX_SEMANAS_MES &&

      Number.isFinite(totalLibras) &&

      Number.isSafeInteger(totalRecolecciones) &&
      totalRecolecciones > 0
    );
  });
}

// ======================================================
// CONSTRUIR RESPUESTA
// ======================================================

function construirRespuesta({
  meses,
  rows,
}) {
  const respuesta =
    meses.map(crearMesBase);

  const mapaMeses = new Map(
    respuesta.map((mes) => [
      mes.mes,
      mes,
    ])
  );

  // Semanas con recolecciones por mes y tipo.

  const semanasPorMes = new Map(
    meses.map((numeroMes) => [
      numeroMes,
      {
        bioinfeccioso: new Set(),
        punzocortante: new Set(),
        general: new Set(),
      },
    ])
  );

  // ====================================================
  // DISTRIBUIR RECOLECCIONES POR SEMANA
  // ====================================================

  for (const row of rows) {
    const mes = Number(
      row.mes
    );

    const semanaIndice = Number(
      row.semana_indice
    );

    const totalLibras = Number(
      row.total_libras ?? 0
    );

    const totalRecolecciones = Number(
      row.total_recolecciones ?? 0
    );

    const tipo = resolverTipoSerie(
      row.tipo_residuo
    );

    const mesActual = mapaMeses.get(
      mes
    );

    if (
      !mesActual ||
      !tipo ||
      !Number.isSafeInteger(semanaIndice) ||
      semanaIndice < 1 ||
      semanaIndice > MAX_SEMANAS_MES ||
      !Number.isFinite(totalLibras) ||
      !Number.isSafeInteger(totalRecolecciones) ||
      totalRecolecciones < 0
    ) {
      continue;
    }

    // Sumar las libras de la semana.

    mesActual.series[tipo][
      semanaIndice - 1
    ] += totalLibras;

    // Registrar la semana si tuvo recolecciones.

    if (totalRecolecciones > 0) {
      const semanas =
        semanasPorMes.get(mes);

      if (tipo === "Bioinfeccioso") {
        semanas.bioinfeccioso.add(
          semanaIndice
        );
      }

      if (tipo === "Punzocortante") {
        semanas.punzocortante.add(
          semanaIndice
        );
      }

      // Una semana se cuenta una sola vez
      // aunque ambos contenedores tengan recolección.

      semanas.general.add(
        semanaIndice
      );
    }
  }

  // ====================================================
  // CALCULAR TOTALES Y PROMEDIOS
  // ====================================================

  for (const mes of respuesta) {
    const serieBio =
      mes.series.Bioinfeccioso;

    const seriePunzo =
      mes.series.Punzocortante;

    const totalBio =
      serieBio.reduce(
        (total, valor) =>
          total + valor,
        0
      );

    const totalPunzo =
      seriePunzo.reduce(
        (total, valor) =>
          total + valor,
        0
      );

    const totalGeneral =
      totalBio + totalPunzo;

    const semanas =
      semanasPorMes.get(
        mes.mes
      );

    const semanasBio =
      semanas.bioinfeccioso.size;

    const semanasPunzo =
      semanas.punzocortante.size;

    const semanasGeneral =
      semanas.general.size;

    mes.totales = {
      bioinfeccioso:
        redondearDos(
          totalBio
        ),

      punzocortante:
        redondearDos(
          totalPunzo
        ),

      general:
        redondearDos(
          totalGeneral
        ),
    };

    // Promedios basados en semanas con recolección.

    mes.promedioSemanal = {
      bioinfeccioso:
        calcularPromedio(
          totalBio,
          semanasBio
        ),

      punzocortante:
        calcularPromedio(
          totalPunzo,
          semanasPunzo
        ),

      general:
        calcularPromedio(
          totalGeneral,
          semanasGeneral
        ),
    };

    // Conservar estructura utilizada por frontend.

    mes.series = [
      {
        name: "Bioinfeccioso",

        data:
          serieBio.map(
            redondearDos
          ),
      },

      {
        name: "Punzocortante",

        data:
          seriePunzo.map(
            redondearDos
          ),
      },
    ];
  }

  return respuesta;
}

// ======================================================
// SERVICIO PRINCIPAL
// ======================================================

async function obtenerGraficasRecoleccionCuatrimestral({
  anio,
  cuatrimestre,
}) {
  validarParametrosInternos({
    anio,
    cuatrimestre,
  });

  // ====================================================
  // VALIDAR AÑO CONTRA LA BASE DE DATOS
  // ====================================================

  const disponibilidad =
    await consultarAniosDisponibles();

  if (
    !disponibilidad.anios.includes(anio)
  ) {
    const error = new Error(
      "El año seleccionado no está disponible para consulta."
    );

    error.statusCode = 400;
    error.type = "validation";
    error.code = "ANIO_NO_DISPONIBLE";

    throw error;
  }

  // ====================================================
  // OBTENER MESES DEL CUATRIMESTRE
  // ====================================================

  const meses =
    obtenerMesesPorCuatrimestre(
      cuatrimestre
    );

  if (meses.length !== 4) {
    const error = new Error(
      "No fue posible determinar los meses del cuatrimestre."
    );

    error.statusCode = 400;
    error.type = "validation";
    error.code = "CUATRIMESTRE_INVALIDO";

    throw error;
  }

  // ====================================================
  // CONSULTAR DATOS
  // ====================================================

  const rows =
    await consultarDatosCuatrimestrales({
      anio,
      meses,
    });

  const hayDatos =
    existenDatosReales(rows);

  if (!hayDatos) {
    return {
      filtros: {
        anio,
        cuatrimestre,
        meses,
      },

      hayDatos: false,

      data: [],
    };
  }

  const data =
    construirRespuesta({
      meses,
      rows,
    });

  return {
    filtros: {
      anio,
      cuatrimestre,
      meses,
    },

    hayDatos: true,

    data,
  };
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerGraficasRecoleccionCuatrimestral,
  consultarAniosDisponibles,
};