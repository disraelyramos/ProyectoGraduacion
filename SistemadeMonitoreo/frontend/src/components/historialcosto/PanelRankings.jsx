import React from "react";

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


export default function PanelRankings({
  topContenedores = [],
}) {

  return (
    <Card className="shadow-sm border-0">

      <Card.Body>

        <div className="fw-bold mb-2">
          Top 5 Contenedores por Costo
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
                Contenedor
              </th>

              <th className="text-end">
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
                    {row.contenedor_codigo || "-"}
                  </td>

                  <td className="text-end">
                    {fmtQ(
                      row.total_q
                    )}
                  </td>
                </tr>
              )
            )}


            {topContenedores.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="text-center text-muted py-3"
                >
                  Sin datos
                </td>
              </tr>
            ) : null}

          </tbody>

        </Table>

      </Card.Body>

    </Card>
  );
}