const pool = require("../../config/db");
const xss = require("xss");

const NOMBRES_MESES = {
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
};

function parseEnteroSeguro(valor) {
  const limpio = xss(String(valor ?? "").trim());
  const numero = parseInt(limpio, 10);

  if (Number.isNaN(numero)) {
    return null;
  }

  return numero;
}

function obtenerMesesPorCuatrimestre(cuatrimestre) {
  const mesesMap = {
    1: [1, 2, 3, 4],
    2: [5, 6, 7, 8],
    3: [9, 10, 11, 12],
  };

  return mesesMap[cuatrimestre] || [];
}

function normalizarTipoResiduo(nombre) {
  const valor = String(nombre || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (valor.includes("bio")) {
    return "Bioinfeccioso";
  }

  if (valor.includes("punzo")) {
    return "Punzocortante";
  }

  return null;
}

function crearMesBase(numeroMes) {
  return {
    mes: numeroMes,
    nombreMes: NOMBRES_MESES[numeroMes],
    categorias: ["Semana 1", "Semana 2", "Semana 3", "Semana 4", "Semana 5"],
    series: {
      Bioinfeccioso: [0, 0, 0, 0, 0],
      Punzocortante: [0, 0, 0, 0, 0],
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

function redondearDos(valor) {
  return Number(Number(valor || 0).toFixed(2));
}

exports.getGraficasRecoleccionCuatrimestral = async (req, res) => {
  try {
    if (!req.user || !req.user.id_usuario) {
      return res.status(401).json({
        success: false,
        message: "Usuario no autenticado",
      });
    }

    const anio = parseEnteroSeguro(req.query.anio);
    const cuatrimestre = parseEnteroSeguro(req.query.cuatrimestre);

    if (!anio || anio < 2000 || anio > 3000) {
      return res.status(400).json({
        success: false,
        message: "El año enviado no es válido",
      });
    }

    if (![1, 2, 3].includes(cuatrimestre)) {
      return res.status(400).json({
        success: false,
        message: "El cuatrimestre debe ser 1, 2 o 3",
      });
    }

    const meses = obtenerMesesPorCuatrimestre(cuatrimestre);

    const query = `
      WITH fechas_del_mes AS (
        SELECT
          EXTRACT(MONTH FROM hcc.calculado_en)::int AS mes,
          DATE(hcc.calculado_en) AS fecha_evento
        FROM historial_calculo_costos hcc
        WHERE EXTRACT(YEAR FROM hcc.calculado_en) = $1
          AND EXTRACT(MONTH FROM hcc.calculado_en) = ANY($2::int[])
        GROUP BY EXTRACT(MONTH FROM hcc.calculado_en), DATE(hcc.calculado_en)
      ),
      fechas_posicionadas AS (
        SELECT
          mes,
          fecha_evento,
          ROW_NUMBER() OVER (
            PARTITION BY mes
            ORDER BY fecha_evento ASC
          ) AS semana_indice
        FROM fechas_del_mes
      ),
      totales_por_fecha_y_tipo AS (
        SELECT
          EXTRACT(MONTH FROM hcc.calculado_en)::int AS mes,
          DATE(hcc.calculado_en) AS fecha_evento,
          tr.nombre AS tipo_residuo,
          SUM(COALESCE(hcc.total_en_libras, 0)) AS total_libras
        FROM historial_calculo_costos hcc
        INNER JOIN tipos_residuo tr
          ON tr.id = hcc.id_tipo_residuo
        WHERE EXTRACT(YEAR FROM hcc.calculado_en) = $1
          AND EXTRACT(MONTH FROM hcc.calculado_en) = ANY($2::int[])
        GROUP BY
          EXTRACT(MONTH FROM hcc.calculado_en),
          DATE(hcc.calculado_en),
          tr.nombre
      )
      SELECT
        tf.mes,
        fp.semana_indice,
        tf.tipo_residuo,
        tf.total_libras
      FROM totales_por_fecha_y_tipo tf
      INNER JOIN fechas_posicionadas fp
        ON fp.mes = tf.mes
       AND fp.fecha_evento = tf.fecha_evento
      WHERE fp.semana_indice <= 5
      ORDER BY tf.mes ASC, fp.semana_indice ASC;
    `;

    const result = await pool.query(query, [anio, meses]);

    const respuestaBase = meses.map((mes) => crearMesBase(mes));
    const mapaMeses = {};

    for (const item of respuestaBase) {
      mapaMeses[item.mes] = item;
    }

    for (const row of result.rows) {
      const mes = Number(row.mes);
      const semanaIndice = Number(row.semana_indice);
      const totalLibras = Number(row.total_libras || 0);
      const tipoNormalizado = normalizarTipoResiduo(row.tipo_residuo);

      if (!mapaMeses[mes] || !tipoNormalizado) {
        continue;
      }

      if (semanaIndice < 1 || semanaIndice > 5) {
        continue;
      }

      mapaMeses[mes].series[tipoNormalizado][semanaIndice - 1] += totalLibras;
    }

    for (const mes of respuestaBase) {
      const totalBio = mes.series.Bioinfeccioso.reduce((acc, val) => acc + val, 0);
      const totalPunzo = mes.series.Punzocortante.reduce((acc, val) => acc + val, 0);
      const totalGeneral = totalBio + totalPunzo;

      const semanasBioConDato = mes.series.Bioinfeccioso.filter((v) => v > 0).length;
      const semanasPunzoConDato = mes.series.Punzocortante.filter((v) => v > 0).length;
      const semanasGeneralConDato = mes.series.Bioinfeccioso.map((bio, index) => {
        const punzo = mes.series.Punzocortante[index];
        return bio + punzo;
      }).filter((v) => v > 0).length;

      mes.totales.bioinfeccioso = redondearDos(totalBio);
      mes.totales.punzocortante = redondearDos(totalPunzo);
      mes.totales.general = redondearDos(totalGeneral);

      mes.promedioSemanal.bioinfeccioso = redondearDos(
        semanasBioConDato > 0 ? totalBio / semanasBioConDato : 0
      );

      mes.promedioSemanal.punzocortante = redondearDos(
        semanasPunzoConDato > 0 ? totalPunzo / semanasPunzoConDato : 0
      );

      mes.promedioSemanal.general = redondearDos(
        semanasGeneralConDato > 0 ? totalGeneral / semanasGeneralConDato : 0
      );

      mes.series = [
        {
          name: "Bioinfeccioso",
          data: mes.series.Bioinfeccioso.map(redondearDos),
        },
        {
          name: "Punzocortante",
          data: mes.series.Punzocortante.map(redondearDos),
        },
      ];
    }

    return res.status(200).json({
      success: true,
      filtros: {
        anio,
        cuatrimestre,
        meses,
      },
      data: respuestaBase,
    });
  } catch (error) {
    console.error("Error obteniendo gráficas de recolección:", error.message);

    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
    });
  }
};