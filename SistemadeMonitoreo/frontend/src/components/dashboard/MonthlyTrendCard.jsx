import React, {
  useMemo,
} from "react";

import {
  Line,
} from "react-chartjs-2";

import "../charts/ChartSetup";

import {
  getCssVariable,
} from "../../utils/getCssVariable";


// ======================================================
// COLORES
// ======================================================

const seriesColors = {

  bioinfeccioso: {
    variable:
      "--color-red",

    fallback:
      "#ff2d35",
  },


  punzocortante: {
    variable:
      "--color-blue",

    fallback:
      "#2563eb",
  },

};


// ======================================================
// HELPERS
// ======================================================

function numeroSeguro(
  valor
) {

  const numero =
    Number(
      valor
    );


  return Number.isFinite(
    numero
  )
    ? numero
    : null;
}


function nombreContenedor(
  contenedorId
) {

  const id =
    Number(
      contenedorId
    );


  if (id === 1) {

    return {
      id:
        "bioinfeccioso",

      name:
        "Bioinfeccioso",
    };
  }


  if (id === 2) {

    return {
      id:
        "punzocortante",

      name:
        "Punzocortante",
    };
  }


  return {
    id:
      `contenedor-${id}`,

    name:
      `Contenedor ${id}`,
  };
}


// ======================================================
// CONSTRUIR PROYECCIÓN VISUAL
// ======================================================
//
// El backend ya calculó:
//
// - nivel actual;
// - crecimiento por día;
// - días para umbral alto.
//
// Aquí únicamente convertimos esos datos
// en puntos para dibujar la línea.
//
// ======================================================

function construirProyeccion(
  prediccion,
  diasMaximos
) {

  const nivelActual =
    numeroSeguro(
      prediccion
        ?.nivel_actual
    );


  const crecimiento =
    numeroSeguro(
      prediccion
        ?.crecimiento_estimado_dia
    );


  if (
    nivelActual === null ||
    crecimiento === null
  ) {

    return [];
  }


  const puntos =
    [];


  for (
    let dia = 0;
    dia <= diasMaximos;
    dia += 1
  ) {

    const nivel =
      Math.min(
        100,
        nivelActual +
          (
            crecimiento *
            dia
          )
      );


    puntos.push(
      Number(
        nivel.toFixed(2)
      )
    );
  }


  return puntos;
}


// ======================================================
// COMPONENTE
// ======================================================

export default function MonthlyTrendCard({
  predictions = [],
  loading = false,
  error = false,
}) {

  // ====================================================
  // PREPARAR DATOS
  // ====================================================

  const {
    chartData,
    labels,
    umbralAviso,
    umbralAlto,
    hayDatos,
  } =
    useMemo(
      () => {

        const lista =
          Array.isArray(
            predictions
          )
            ? predictions
            : [];


        const validas =
          lista.filter(
            (item) =>
              item &&
              item.estado ===
                "OK"
          );


        if (
          validas.length === 0
        ) {

          return {

            chartData: {
              labels:
                [],

              datasets:
                [],
            },

            labels:
              [],

            umbralAviso:
              null,

            umbralAlto:
              null,

            hayDatos:
              false,
          };
        }


        // ==============================================
        // DÍAS A MOSTRAR
        // ==============================================

        const diasParaAlto =
          validas
            .map(
              (item) =>
                numeroSeguro(
                  item
                    .dias_para_alto
                )
            )
            .filter(
              (valor) =>
                valor !== null
            );


        let diasMaximos =
          7;


        if (
          diasParaAlto.length >
          0
        ) {

          diasMaximos =
            Math.max(
              1,
              Math.ceil(
                Math.max(
                  ...diasParaAlto
                )
              )
            );
        }


        /*
         * Evitamos una gráfica excesivamente larga.
         *
         * Si alguna predicción tarda más,
         * mostramos hasta 14 días.
         */
        diasMaximos =
          Math.min(
            diasMaximos,
            14
          );


        const labelsGenerados =
          Array.from(
            {
              length:
                diasMaximos +
                1,
            },
            (
              _,
              index
            ) =>
              index === 0
                ? "Hoy"
                : `Día ${index}`
          );


        // ==============================================
        // SERIES
        // ==============================================

        const datasets =
          validas.map(
            (prediccion) => {

              const contenedor =
                nombreContenedor(
                  prediccion
                    .contenedor_id
                );


              const colorConfig =
                seriesColors[
                  contenedor.id
                ];


              const lineColor =
                colorConfig
                  ? getCssVariable(
                      colorConfig
                        .variable,

                      colorConfig
                        .fallback
                    )
                  : "#94a3b8";


              return {

                label:
                  contenedor
                    .name,

                data:
                  construirProyeccion(
                    prediccion,
                    diasMaximos
                  ),

                borderColor:
                  lineColor,

                backgroundColor:
                  lineColor,

                borderWidth:
                  2,

                pointRadius:
                  3,

                pointHoverRadius:
                  5,

                tension:
                  0.35,

                fill:
                  false,

              };
            }
          );


        const primerUmbral =
          numeroSeguro(
            validas[0]
              ?.umbral_aviso
          );


        const segundoUmbral =
          numeroSeguro(
            validas[0]
              ?.umbral_alto
          );


        return {

          chartData: {

            labels:
              labelsGenerados,

            datasets,

          },

          labels:
            labelsGenerados,

          umbralAviso:
            primerUmbral,

          umbralAlto:
            segundoUmbral,

          hayDatos:
            datasets.length >
            0,
        };

      },
      [
        predictions,
      ]
    );


  // ====================================================
  // OPCIONES
  // ====================================================

  const chartOptions =
    useMemo(
      () => ({

        responsive:
          true,

        maintainAspectRatio:
          false,


        interaction: {

          mode:
            "index",

          intersect:
            false,

        },


        plugins: {

          legend: {

            display:
              true,

            position:
              "bottom",

            labels: {

              usePointStyle:
                true,

              boxWidth:
                8,

              boxHeight:
                8,

              padding:
                18,

            },

          },


          tooltip: {

            callbacks: {

              label: (
                context
              ) => {

                const value =
                  context
                    .parsed
                    .y ??
                  0;


                return (
                  `${context.dataset.label}: ` +
                  `${Number(
                    value
                  ).toLocaleString(
                    "es-GT",
                    {
                      minimumFractionDigits:
                        2,

                      maximumFractionDigits:
                        2,
                    }
                  )}%`
                );
              },

            },

          },

        },


        scales: {

          x: {

            grid: {

              display:
                false,

            },


            ticks: {

              maxRotation:
                0,

            },

          },


          y: {

            beginAtZero:
              true,

            min:
              0,

            max:
              100,


            grid: {

              color:
                "rgba(148, 163, 184, 0.18)",

            },


            ticks: {

              callback:
                (value) =>
                  `${value}%`,

            },

          },

        },

      }),
      []
    );


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <article className="dash-card dashboard-analysis-card">

      <header className="dashboard-card-header">

        <div>

          <h3 className="dashboard-card-title">

            Predicción de llenado

          </h3>


          <span className="dashboard-period">

            Machine Learning

          </span>

        </div>

      </header>


      {loading && (

        <div className="dashboard-insight">

          Consultando predicciones...

        </div>

      )}


      {!loading &&
        error && (

          <div className="dashboard-insight">

            No fue posible consultar la predicción.

          </div>

        )}


      {!loading &&
        !error &&
        !hayDatos && (

          <div className="dashboard-insight">

            No hay datos suficientes para generar la predicción.

          </div>

        )}


      {!loading &&
        !error &&
        hayDatos && (

          <>

            <div className="monthly-trend-chart">

              <Line
                data={
                  chartData
                }

                options={
                  chartOptions
                }
              />

            </div>


            <div className="dashboard-insight">

              {umbralAviso !==
                null && (

                <span>

                  Aviso:{" "}
                  <strong>

                    {umbralAviso}%

                  </strong>

                </span>

              )}


              {umbralAviso !==
                null &&
                umbralAlto !==
                  null && (

                  <span>

                    {" · "}

                  </span>

                )}


              {umbralAlto !==
                null && (

                <span>

                  Nivel alto:{" "}

                  <strong>

                    {umbralAlto}%

                  </strong>

                </span>

              )}

            </div>

          </>

        )}

    </article>

  );
}