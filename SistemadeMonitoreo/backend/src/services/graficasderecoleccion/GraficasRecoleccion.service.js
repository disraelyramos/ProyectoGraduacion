const pool = require("../../config/db");


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


const TOTAL_SEMANAS_MES = 5;


function obtenerMesesPorCuatrimestre(cuatrimestre) {
  const meses =
    MESES_POR_CUATRIMESTRE[
      cuatrimestre
    ];


  return meses
    ? [...meses]
    : [];
}


function resolverTipoSerie(nombre) {
  const valor =
    String(nombre || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(
        /[\u0300-\u036f]/g,
        ""
      )
      .trim();


  if (
    valor.includes("infeccioso") ||
    valor.includes("bio")
  ) {
    return "Bioinfeccioso";
  }


  if (
    valor.includes("punzo")
  ) {
    return "Punzocortante";
  }


  return null;
}


function crearMesBase(numeroMes) {
  return {
    mes:
      numeroMes,

    nombreMes:
      NOMBRES_MESES[
        numeroMes
      ],

    categorias: [
      ...CATEGORIAS_SEMANALES,
    ],

    series: {
      Bioinfeccioso: [
        0,
        0,
        0,
        0,
        0,
      ],

      Punzocortante: [
        0,
        0,
        0,
        0,
        0,
      ],
    },

    totales: {
      bioinfeccioso:
        0,

      punzocortante:
        0,

      general:
        0,
    },

    promedioSemanal: {
      bioinfeccioso:
        0,

      punzocortante:
        0,

      general:
        0,
    },
  };
}


function redondearDos(valor) {
  const numero =
    Number(
      valor || 0
    );


  if (
    !Number.isFinite(
      numero
    )
  ) {
    return 0;
  }


  return Number(
    numero.toFixed(2)
  );
}


function validarParametrosInternos({
  anio,
  cuatrimestre,
}) {
  if (
    !Number.isSafeInteger(anio) ||
    anio < 2000 ||
    anio > 3000
  ) {
    const error =
      new Error(
        "El año recibido por el servicio no es válido."
      );


    error.statusCode =
      400;

    error.type =
      "validation";

    error.code =
      "ANIO_INVALIDO";


    throw error;
  }


  if (
    !Number.isSafeInteger(cuatrimestre) ||
    ![1, 2, 3].includes(
      cuatrimestre
    )
  ) {
    const error =
      new Error(
        "El cuatrimestre recibido por el servicio no es válido."
      );


    error.statusCode =
      400;

    error.type =
      "validation";

    error.code =
      "CUATRIMESTRE_INVALIDO";


    throw error;
  }
}


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

        WHERE h.recoleccion_id =
          r.id

        ORDER BY
          h.id DESC

        LIMIT 1
      ) hcc
        ON TRUE

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


  const {
    rows,
  } =
    await pool.query(
      query,
      [
        anio,
        meses,
      ]
    );


  return rows || [];
}


function existenDatosReales(rows) {
  if (
    !Array.isArray(rows) ||
    rows.length === 0
  ) {
    return false;
  }


  return rows.some(
    (row) => {

      const tipo =
        resolverTipoSerie(
          row.tipo_residuo
        );


      const semanaIndice =
        Number(
          row.semana_indice
        );


      const totalLibras =
        Number(
          row.total_libras
        );


      const totalRecolecciones =
        Number(
          row.total_recolecciones
        );


      return (
        Boolean(tipo) &&

        Number.isSafeInteger(
          semanaIndice
        ) &&

        semanaIndice >= 1 &&

        semanaIndice <= 5 &&

        Number.isFinite(
          totalLibras
        ) &&

        Number.isSafeInteger(
          totalRecolecciones
        ) &&

        totalRecolecciones > 0
      );
    }
  );
}


function construirRespuesta({
  meses,
  rows,
}) {
  const respuesta =
    meses.map(
      crearMesBase
    );


  const mapaMeses =
    new Map(
      respuesta.map(
        (mes) => [
          mes.mes,
          mes,
        ]
      )
    );


  for (
    const row of rows
  ) {
    const mes =
      Number(
        row.mes
      );


    const semanaIndice =
      Number(
        row.semana_indice
      );


    const totalLibras =
      Number(
        row.total_libras ??
        0
      );


    const tipo =
      resolverTipoSerie(
        row.tipo_residuo
      );


    const mesActual =
      mapaMeses.get(
        mes
      );


    if (
      !mesActual ||
      !tipo ||
      !Number.isSafeInteger(
        semanaIndice
      ) ||
      semanaIndice < 1 ||
      semanaIndice > 5 ||
      !Number.isFinite(
        totalLibras
      )
    ) {
      continue;
    }


    mesActual
      .series[
        tipo
      ][
        semanaIndice - 1
      ] +=
      totalLibras;
  }


  for (
    const mes of respuesta
  ) {
    const serieBio =
      mes.series
        .Bioinfeccioso;


    const seriePunzo =
      mes.series
        .Punzocortante;


    const totalBio =
      serieBio.reduce(
        (
          total,
          valor
        ) =>
          total + valor,
        0
      );


    const totalPunzo =
      seriePunzo.reduce(
        (
          total,
          valor
        ) =>
          total + valor,
        0
      );


    const totalGeneral =
      totalBio +
      totalPunzo;


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


    mes.promedioSemanal = {
      bioinfeccioso:
        redondearDos(
          totalBio /
          TOTAL_SEMANAS_MES
        ),

      punzocortante:
        redondearDos(
          totalPunzo /
          TOTAL_SEMANAS_MES
        ),

      general:
        redondearDos(
          totalGeneral /
          TOTAL_SEMANAS_MES
        ),
    };


    mes.series = [
      {
        name:
          "Bioinfeccioso",

        data:
          serieBio.map(
            redondearDos
          ),
      },

      {
        name:
          "Punzocortante",

        data:
          seriePunzo.map(
            redondearDos
          ),
      },
    ];
  }


  return respuesta;
}


async function obtenerGraficasRecoleccionCuatrimestral({
  anio,
  cuatrimestre,
}) {
  validarParametrosInternos({
    anio,
    cuatrimestre,
  });


  const meses =
    obtenerMesesPorCuatrimestre(
      cuatrimestre
    );


  if (
    meses.length !== 4
  ) {
    const error =
      new Error(
        "No fue posible determinar los meses del cuatrimestre."
      );


    error.statusCode =
      400;

    error.type =
      "validation";

    error.code =
      "CUATRIMESTRE_INVALIDO";


    throw error;
  }


  const rows =
    await consultarDatosCuatrimestrales({
      anio,
      meses,
    });


  const hayDatos =
    existenDatosReales(
      rows
    );


  if (
    !hayDatos
  ) {
    return {
      filtros: {
        anio,
        cuatrimestre,
        meses,
      },

      hayDatos:
        false,

      data:
        [],
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

    hayDatos:
      true,

    data,
  };
}


module.exports = {
  obtenerGraficasRecoleccionCuatrimestral,
};