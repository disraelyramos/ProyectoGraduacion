import React, {
  useMemo,
} from "react";

import {
  Card,
  Table,
  Button,
  Spinner,
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


const fmtPct =
  (value) => {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }


    const numero =
      Number(
        value
      );


    if (
      !Number.isFinite(
        numero
      )
    ) {
      return String(
        value
      );
    }


    return `${numero.toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      }
    )}%`;
  };


const fmtQlb =
  (value) => {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return "-";
    }


    const numero =
      Number(
        value
      );


    if (
      !Number.isFinite(
        numero
      )
    ) {
      return String(
        value
      );
    }


    return `Q ${numero.toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          4,

        maximumFractionDigits:
          4,
      }
    )}/lb`;
  };


export default function TablaDetalle({
  detalle,
  loading = false,
  onPageChange,
}) {

  const rows =
    Array.isArray(
      detalle?.rows
    )
      ? detalle.rows
      : [];


  const page =
    Number(
      detalle?.page ||
      1
    );


  const limit =
    Number(
      detalle?.limit ||
      10
    );


  const total =
    Number(
      detalle?.total ||
      0
    );


  const totalPages =
    useMemo(
      () =>
        Math.max(
          1,

          Math.ceil(
            total /
            limit
          )
        ),
      [
        total,
        limit,
      ]
    );


  const from =
    total === 0
      ? 0
      : (
          (
            page -
            1
          ) *
          limit
        ) + 1;


  const to =
    Math.min(
      page *
      limit,

      total
    );


  return (
    <Card className="shadow-sm border-0">

      <Card.Body>

        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">

          <div className="fw-bold">
            Detalle de Recolecciones
          </div>


          <div className="d-flex align-items-center gap-2">

            {loading ? (
              <Spinner
                size="sm"
              />
            ) : null}


            <small className="text-muted">
              Mostrando {from}-{to} de {total}
            </small>


            <Button
              size="sm"

              variant="outline-dark"

              disabled={
                loading ||
                page <= 1
              }

              onClick={
                () =>
                  onPageChange?.(
                    page - 1
                  )
              }
            >
              ◀
            </Button>


            <small className="text-muted">
              {page} / {totalPages}
            </small>


            <Button
              size="sm"

              variant="outline-dark"

              disabled={
                loading ||
                page >= totalPages
              }

              onClick={
                () =>
                  onPageChange?.(
                    page + 1
                  )
              }
            >
              ▶
            </Button>

          </div>

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
                Fecha
              </th>

              <th>
                Código Contenedor
              </th>

              <th>
                Distrito
              </th>

              <th>
                Empresa
              </th>

              <th className="text-end">
                Total lbs
              </th>

              <th className="text-end">
                % Llenado
              </th>

              <th className="text-end">
                Costo/lb
              </th>

              <th className="text-end">
                Total Pagado (Q)
              </th>
            </tr>
          </thead>


          <tbody>

            {rows.map(
              (
                row,
                index
              ) => (

                <tr
                  key={
                    `${row.fecha || "F"}-${row.codigo_contenedor || "C"}-${index}`
                  }
                >

                  <td>
                    {row.fecha || "-"}
                  </td>

                  <td>
                    {row.codigo_contenedor || "-"}
                  </td>

                  <td>
                    {row.distrito || "-"}
                  </td>

                  <td>
                    {row.empresa_recolectora || "-"}
                  </td>

                  <td className="text-end">
                    {fmtLb(
                      row.total_en_libras
                    )}
                  </td>

                  <td className="text-end">
                    {fmtPct(
                      row.porcentaje_llenado
                    )}
                  </td>

                  <td className="text-end">
                    {fmtQlb(
                      row.costo_por_libra_aplicado
                    )}
                  </td>

                  <td className="text-end">
                    {fmtQ(
                      row.total_costo_q
                    )}
                  </td>

                </tr>
              )
            )}


            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="text-center text-muted py-3"
                >
                  Sin registros para mostrar.
                </td>
              </tr>
            ) : null}

          </tbody>

        </Table>

      </Card.Body>

    </Card>
  );
}