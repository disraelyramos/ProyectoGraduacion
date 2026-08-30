import React, {
  useMemo,
} from "react";

import {
  FaChartBar,
} from "react-icons/fa";


const fmtQ =
  (value) =>
    `Q ${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;


const fmtLb =
  (value) =>
    `${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )} lbs`;


const fmtQlb =
  (value) =>
    `Q ${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }
    )}/lb`;


/* =========================================================
   TEXTO DE AGRUPACIÓN
   ========================================================= */

function prettyAgrupar(
  value
) {

  const normalized =
    String(
      value ||
      "mes"
    )
      .trim()
      .toLowerCase();


  if (
    normalized ===
    "semana"
  ) {
    return "Semana";
  }


  if (
    normalized === "anio" ||
    normalized === "año"
  ) {
    return "Año";
  }


  return "Mes";
}


/* =========================================================
   COMPONENTE
   ========================================================= */

export default function TablaResumen({
  agruparPor,
  rows = [],
}) {

  const label =
    useMemo(
      () =>
        prettyAgrupar(
          agruparPor
        ),
      [
        agruparPor,
      ]
    );


  return (

    <section className="system-card">

      {/* =================================================
          ENCABEZADO
      ================================================= */}

      <div className="system-card-header">

        <div>

          <h3 className="system-card-title">

            <FaChartBar />

            {" "}
            Resumen de Costos por {label}

          </h3>

        </div>

      </div>


      {/* =================================================
          TABLA
      ================================================= */}

      <div className="system-table-wrapper">

        <table className="system-table">

          <thead>

            <tr>

              <th>
                Periodo
              </th>

              <th className="system-text-right">
                Total Gastado (Q)
              </th>

              <th className="system-text-right">
                Total lbs
              </th>

              <th className="system-text-right">
                Promedio Q/lb
              </th>

              <th className="system-text-right">
                # Recolecciones
              </th>

            </tr>

          </thead>


          <tbody>

            {rows.map(
              (row) => (

                <tr
                  key={
                    String(
                      row.periodo
                    )
                  }
                >

                  <td>
                    {row.periodo}
                  </td>


                  <td className="system-table-number">

                    {fmtQ(
                      row.total_q
                    )}

                  </td>


                  <td className="system-table-number">

                    {fmtLb(
                      row.total_lbs
                    )}

                  </td>


                  <td className="system-table-number">

                    {fmtQlb(
                      row.q_por_lb
                    )}

                  </td>


                  <td className="system-table-number">

                    {Number(
                      row.recolecciones ||
                      0
                    ).toLocaleString(
                      "es-GT"
                    )}

                  </td>

                </tr>

              )
            )}


            {rows.length === 0 && (

              <tr>

                <td
                  colSpan={5}
                  className="system-table-empty"
                >
                  Sin datos para mostrar.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

    </section>

  );
}