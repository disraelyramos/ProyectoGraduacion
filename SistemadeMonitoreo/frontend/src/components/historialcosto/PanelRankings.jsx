import React from "react";

import {
  FaTrophy,
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


export default function PanelRankings({
  topContenedores = [],
}) {

  return (

    <section className="system-card">

      {/* =================================================
          ENCABEZADO
      ================================================= */}

      <div className="system-card-header">

        <div>

          <h3 className="system-card-title">

            <FaTrophy />

            {" "}
            Top 5 Contenedores por Costo

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
                Contenedor
              </th>

              <th className="system-text-right">
                Total (Q)
              </th>

            </tr>

          </thead>


          <tbody>

            {topContenedores.map(
              (
                row,
                index
              ) => (

                <tr
                  key={
                    `${row.contenedor_codigo || "CNT"}-${index}`
                  }
                >

                  <td>

                    <span className="system-badge system-badge-info">

                      {row.contenedor_codigo || "-"}

                    </span>

                  </td>


                  <td className="system-table-number">

                    {fmtQ(
                      row.total_q
                    )}

                  </td>

                </tr>

              )
            )}


            {topContenedores.length === 0 && (

              <tr>

                <td
                  colSpan={2}
                  className="system-table-empty"
                >
                  Sin datos
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>

    </section>

  );
}