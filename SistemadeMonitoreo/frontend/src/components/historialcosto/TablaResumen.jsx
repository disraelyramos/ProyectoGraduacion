import React, {
  useMemo,
} from "react";

import {
  Card,
  Table,
} from "react-bootstrap";


const fmtQ =
  (value) =>
    `Q ${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      }
    )}`;


const fmtLb =
  (value) =>
    `${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          0,

        maximumFractionDigits:
          2,
      }
    )} lbs`;


const fmtQlb =
  (value) =>
    `Q ${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          4,

        maximumFractionDigits:
          4,
      }
    )}/lb`;


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
    normalized ===
      "anio" ||
    normalized ===
      "año"
  ) {
    return "Año";
  }


  return "Mes";
}


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
    <Card className="shadow-sm border-0">

      <Card.Body>

        <div className="fw-bold mb-2">
          Resumen de Costos (por {label})
        </div>


        <Table
          responsive
          bordered
          hover
          size="sm"
          className="mb-0"
        >

          <thead className="table-dark">
            <tr>
              <th>
                Periodo
              </th>

              <th className="text-end">
                Total Gastado (Q)
              </th>

              <th className="text-end">
                Total lbs
              </th>

              <th className="text-end">
                Promedio Q/lb
              </th>

              <th className="text-end">
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

                  <td className="text-end">
                    {fmtQ(
                      row.total_q
                    )}
                  </td>

                  <td className="text-end">
                    {fmtLb(
                      row.total_lbs
                    )}
                  </td>

                  <td className="text-end">
                    {fmtQlb(
                      row.q_por_lb
                    )}
                  </td>

                  <td className="text-end">
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


            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="text-center text-muted py-3"
                >
                  Sin datos para mostrar.
                </td>
              </tr>
            ) : null}

          </tbody>

        </Table>

      </Card.Body>

    </Card>
  );
}