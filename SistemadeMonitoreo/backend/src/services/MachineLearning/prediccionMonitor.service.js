const alertaPredictivaService = require(
  "./alertaPredictiva.service"
);


// ======================================================
// CONFIGURACIÓN
// ======================================================

const ML_MONITOR_INTERVAL_MS =
  Number(
    process.env.ML_MONITOR_INTERVAL_MS ||
    300000
  );


if (
  !Number.isFinite(
    ML_MONITOR_INTERVAL_MS
  ) ||
  ML_MONITOR_INTERVAL_MS <= 0
) {

  throw new Error(
    "ML_MONITOR_INTERVAL_MS no está configurado correctamente."
  );
}


// ======================================================
// ESTADO INTERNO
// ======================================================

let intervalo = null;

let ejecucionEnCurso =
  false;


// ======================================================
// EJECUTAR EVALUACIÓN
// ======================================================

async function ejecutarEvaluacion() {

  if (ejecucionEnCurso) {

    console.log(
      "ML: evaluación omitida porque existe otra en curso."
    );

    return;
  }


  ejecucionEnCurso =
    true;


  try {

    const resultado =
      await alertaPredictivaService
        .evaluarPredicciones();


    console.log(
      "ML: evaluación predictiva completada.",
      {
        total:
          resultado.total,
      }
    );

  } catch (error) {

    console.error(
      "ML: error en evaluación predictiva:",
      error.message
    );

  } finally {

    ejecucionEnCurso =
      false;
  }
}


// ======================================================
// INICIAR MONITOR
// ======================================================

function iniciarMonitorPredicciones() {

  if (intervalo) {

    return;
  }


  console.log(
    `ML: monitor predictivo iniciado cada ${ML_MONITOR_INTERVAL_MS} ms.`
  );


  /*
   * Primera evaluación al iniciar backend.
   */
  ejecutarEvaluacion();


  intervalo =
    setInterval(
      ejecutarEvaluacion,
      ML_MONITOR_INTERVAL_MS
    );
}


// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitorPredicciones() {

  if (!intervalo) {

    return;
  }


  clearInterval(
    intervalo
  );


  intervalo =
    null;


  console.log(
    "ML: monitor predictivo detenido."
  );
}


// ======================================================
// EXPORTAR
// ======================================================

module.exports = {

  iniciarMonitorPredicciones,

  detenerMonitorPredicciones,

};