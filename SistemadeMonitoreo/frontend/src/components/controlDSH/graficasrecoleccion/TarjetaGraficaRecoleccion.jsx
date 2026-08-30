import React from "react";

import {
  FaBiohazard,
  FaSyringe,
  FaChartBar,
  FaCalendarAlt,
} from "react-icons/fa";

import GraficaLineaRecoleccion
  from "../../charts/GraficaLineaRecoleccion";


/* =========================================================
   FORMATO VISUAL DE LIBRAS
   ========================================================= */

function formatearLibras(
  valor
) {

  const numero =
    Number(valor);


  if (
    !Number.isFinite(
      numero
    )
  ) {

    return "0.00 lb";
  }


  return `${numero.toLocaleString(
    "es-GT",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )} lb`;
}


/* =========================================================
   COMPONENTE
   ========================================================= */

const TarjetaGraficaRecoleccion = ({
  data,
}) => {

  const nombreMes =
    data?.nombreMes ||
    "-";


  return (

    <article className="system-card graficas-month-card">

      {/* =================================================
          ENCABEZADO
      ================================================= */}

      <header className="graficas-month-header">

        <FaCalendarAlt
          className="graficas-month-header-icon"
          aria-hidden="true"
        />


        <h3 className="graficas-month-title">

          Desechos Sólidos generados en el mes de{" "}

          <span>
            {nombreMes}
          </span>

        </h3>

      </header>


      {/* =================================================
          GRÁFICA
      ================================================= */}

      <div className="graficas-chart-container">

        <GraficaLineaRecoleccion
          categorias={
            data?.categorias
          }

          series={
            data?.series
          }
        />

      </div>


      {/* =================================================
          RESUMEN
      ================================================= */}

      <div className="graficas-summary-grid">

        {/* =================================================
            BIOINFECCIOSO
        ================================================= */}

        <div className="graficas-summary-item graficas-summary-bio">

          <span className="graficas-summary-icon">

            <FaBiohazard
              aria-hidden="true"
            />

          </span>


          <div className="graficas-summary-content">

            <span className="graficas-summary-label">
              Total Bioinfeccioso
            </span>


            <strong className="graficas-summary-value">

              {formatearLibras(
                data
                  ?.totales
                  ?.bioinfeccioso
              )}

            </strong>

          </div>

        </div>


        {/* =================================================
            PUNZOCORTANTE
        ================================================= */}

        <div className="graficas-summary-item graficas-summary-punzocortante">

          <span className="graficas-summary-icon">

            <FaSyringe
              aria-hidden="true"
            />

          </span>


          <div className="graficas-summary-content">

            <span className="graficas-summary-label">
              Total Punzocortante
            </span>


            <strong className="graficas-summary-value">

              {formatearLibras(
                data
                  ?.totales
                  ?.punzocortante
              )}

            </strong>

          </div>

        </div>


        {/* =================================================
            PROMEDIO
        ================================================= */}

        <div className="graficas-summary-item graficas-summary-promedio">

          <span className="graficas-summary-icon">

            <FaChartBar
              aria-hidden="true"
            />

          </span>


          <div className="graficas-summary-content">

            <span className="graficas-summary-label">
              Promedio General
            </span>


            <strong className="graficas-summary-value">

              {formatearLibras(
                data
                  ?.promedioSemanal
                  ?.general
              )}

            </strong>

          </div>

        </div>

      </div>

    </article>
  );
};


export default TarjetaGraficaRecoleccion;