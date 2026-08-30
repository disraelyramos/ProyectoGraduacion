import React, {
  useMemo,
} from "react";

import {
  FaClipboardList,
  FaChevronLeft,
  FaChevronRight,
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


/* =========================================================
   PORCENTAJE
   ========================================================= */

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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}%`;
  };


/* =========================================================
   COSTO POR LIBRA
   ========================================================= */

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
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }
    )}/lb`;
  };


/* =========================================================
   COMPONENTE
   ========================================================= */

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
            page - 1
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

    <section className="system-card">

      {/* =================================================
          CABECERA
      ================================================= */}

      <div className="system-card-header">

        <div>

          <h3 className="system-card-title">

            <FaClipboardList />

            {" "}
            Detalle de Recolecciones

          </h3>

        </div>


        {loading && (

          <span
            className="system-spinner system-spinner-small-dark"
            aria-label="Cargando"
          />

        )}

      </div>


      {/* =================================================
          TABLA
      ================================================= */}

      <div className="system-table-wrapper">

        <table className="system-table">

          <thead>

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

              <th className="system-text-right">
                Total lbs
              </th>

              <th className="system-text-right">
                % Llenado
              </th>

              <th className="system-text-right">
                Costo/lb
              </th>

              <th className="system-text-right">
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

                    <span className="system-badge system-badge-info">

                      {row.codigo_contenedor || "-"}

                    </span>

                  </td>


                  <td>
                    {row.distrito || "-"}
                  </td>


                  <td>
                    {row.empresa_recolectora || "-"}
                  </td>


                  <td className="system-table-number">

                    {fmtLb(
                      row.total_en_libras
                    )}

                  </td>


                  <td className="system-table-number">

                    {fmtPct(
                      row.porcentaje_llenado
                    )}

                  </td>


                  <td className="system-table-number">

                    {fmtQlb(
                      row.costo_por_libra_aplicado
                    )}

                  </td>


                  <td className="system-table-number">

                    {fmtQ(
                      row.total_costo_q
                    )}

                  </td>

                </tr>

              )
            )}


            {rows.length === 0 && (

              <tr>

                <td
                  colSpan={8}
                  className="system-table-empty"
                >
                  Sin registros para mostrar.
                </td>

              </tr>

            )}

          </tbody>

        </table>

      </div>


      {/* =================================================
          PAGINACIÓN
      ================================================= */}

      <div className="system-pagination-container">

        <span className="system-text-muted">

          Mostrando{" "}
          <strong>
            {from}-{to}
          </strong>
          {" "}de{" "}
          <strong>
            {total}
          </strong>

        </span>


        <div className="system-pagination">

          <button
            type="button"
            className="system-page-button"
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
            aria-label="Página anterior"
            title="Página anterior"
          >
            <FaChevronLeft />
          </button>


          <span className="system-badge system-badge-neutral">

            Página {page} de {totalPages}

          </span>


          <button
            type="button"
            className="system-page-button"
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
            aria-label="Página siguiente"
            title="Página siguiente"
          >
            <FaChevronRight />
          </button>

        </div>

      </div>

    </section>

  );
}