import React, {
  useMemo,
} from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";


/* =========================================================
   NÚMERO VISUAL SEGURO

   Esto solamente protege Recharts frente a valores no
   numéricos.

   NO realiza cálculos de negocio.
   ========================================================= */

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
    : 0;
}


/* =========================================================
   FORMATO TOOLTIP
   ========================================================= */

function formatearTooltip(
  valor
) {
  const numero =
    numeroSeguro(
      valor
    );


  return [
    `${numero.toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      }
    )} lb`,
  ];
}


/* =========================================================
   COMPONENTE
   ========================================================= */

const GraficaLineaRecoleccion = ({
  categorias = [],
  series = [],
}) => {

  /* =======================================================
     PREPARAR DATOS PARA RECHARTS

     Esta transformación es exclusivamente de presentación.

     El backend ya decidió:
     - categorías
     - semanas
     - valores
     - tipos de residuo
     ======================================================= */

  const data =
    useMemo(
      () => {

        const categoriasSeguras =
          Array.isArray(
            categorias
          )
            ? categorias
            : [];


        const seriesSeguras =
          Array.isArray(
            series
          )
            ? series
            : [];


        const bio =
          seriesSeguras.find(
            (item) =>
              item?.name ===
              "Bioinfeccioso"
          );


        const punzo =
          seriesSeguras.find(
            (item) =>
              item?.name ===
              "Punzocortante"
          );


        const valoresBio =
          Array.isArray(
            bio?.data
          )
            ? bio.data
            : [];


        const valoresPunzo =
          Array.isArray(
            punzo?.data
          )
            ? punzo.data
            : [];


        return categoriasSeguras.map(
          (
            categoria,
            index
          ) => ({
            semana:
              String(
                categoria ||
                `Semana ${index + 1}`
              ),

            Bioinfeccioso:
              numeroSeguro(
                valoresBio[
                  index
                ]
              ),

            Punzocortante:
              numeroSeguro(
                valoresPunzo[
                  index
                ]
              ),
          })
        );

      },
      [
        categorias,
        series,
      ]
    );


  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <div
      style={{
        width:
          "100%",

        height:
          320,
      }}
    >

      <ResponsiveContainer
        width="100%"
        height="100%"
      >

        <LineChart
          data={
            data
          }

          margin={{
            top:
              10,

            right:
              20,

            left:
              0,

            bottom:
              0,
          }}
        >

          <CartesianGrid
            strokeDasharray="3 3"
          />


          <XAxis
            dataKey="semana"
          />


          <YAxis
            domain={[
              0,
              "auto",
            ]}
          />


          <Tooltip
            formatter={
              formatearTooltip
            }
          />


          <Legend />


          <Line
            type="monotone"

            dataKey="Bioinfeccioso"

            name="Bioinfeccioso"

            stroke="#0d6efd"

            strokeWidth={2}

            connectNulls={false}
          />


          <Line
            type="monotone"

            dataKey="Punzocortante"

            name="Punzocortante"

            stroke="#dc3545"

            strokeWidth={2}

            connectNulls={false}
          />

        </LineChart>

      </ResponsiveContainer>

    </div>
  );
};


export default GraficaLineaRecoleccion;