import React, {
  useMemo,
} from "react";

import {
  FaFilePdf,
  FaFileExcel,
  FaChartBar,
} from "react-icons/fa";

import "../../styles/historial-recoleccion.css";
import "../../styles/tables.css";

import AppPagination
  from "../../components/common/AppPagination";


/* =========================================================
   FORMATO DE VALORES
   ========================================================= */

function fmt(
  value,
  suffix = ""
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  return `${value}${suffix}`;
}


function fmtMoney(
  value,
  decimals = 2
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }


  const number =
    Number(value);


  if (
    !Number.isFinite(
      number
    )
  ) {
    return value;
  }


  return `Q${number.toFixed(
    decimals
  )}`;
}


/* =========================================================
   COMPONENTE
   ========================================================= */

const HistorialEnTablas = ({
  loading,
  detalle,
  pesaje,
  page,
  total,
  pageSize,
  onPageChange,
  canExport,
  onExportPdf,
  onExportExcel,
}) => {

  /* =======================================================
     RANGO MOSTRADO
     ======================================================= */

  const showingFrom =
    total === 0
      ? 0
      : (
          (page - 1) *
          pageSize
        ) + 1;


  const showingTo =
    total === 0
      ? 0
      : Math.min(
          page * pageSize,
          total
        );


  /* =======================================================
     PESAJE POR RECOLECCIÓN
     ======================================================= */

  const pesajeById =
    useMemo(() => {

      const map =
        new Map();


      for (
        const registro
        of pesaje || []
      ) {

        const id =
          Number(
            registro.recoleccion_id
          );


        if (
          Number.isSafeInteger(
            id
          )
        ) {

          map.set(
            id,
            registro
          );
        }
      }


      return map;

    }, [
      pesaje,
    ]);


  const sinResultados =
    !loading &&
    (detalle || []).length === 0;


  /* =======================================================
     VISTA
     ======================================================= */

  return (

    <div className="historial-tables">

      <div className="system-card historial-results-card">

        {/* =================================================
            CABECERA
        ================================================= */}

        <header className="historial-results-header">

          <div className="historial-results-title-wrap">

            <FaChartBar
              className="historial-results-title-icon"
              aria-hidden="true"
            />


            <div>

              <h2 className="system-card-title">
                Resultados de la búsqueda
              </h2>

              <p className="system-card-description">
                Consulte la información de recolección
                y control de pesaje encontrada.
              </p>

            </div>

          </div>


          {/* ===============================================
              EXPORTACIONES
          =============================================== */}

          <div className="historial-export-actions">

            <button
              type="button"
              className="app-btn app-btn-danger"
              onClick={onExportPdf}
              disabled={!canExport}
              title={
                !canExport
                  ? "Realice una búsqueda con resultados para exportar."
                  : "Exportar resultados a PDF"
              }
            >

              <FaFilePdf
                aria-hidden="true"
              />

              <span>
                Exportar PDF
              </span>

            </button>


            <button
              type="button"
              className="app-btn app-btn-success"
              onClick={onExportExcel}
              disabled={!canExport}
              title={
                !canExport
                  ? "Realice una búsqueda con resultados para exportar."
                  : "Exportar resultados a Excel"
              }
            >

              <FaFileExcel
                aria-hidden="true"
              />

              <span>
                Exportar Excel
              </span>

            </button>

          </div>

        </header>


        <div className="system-divider" />


        {/* =================================================
            DATOS DE RECOLECCIÓN
        ================================================= */}

        <section className="historial-result-section">

          <h3 className="system-section-title historial-table-title">
            Datos de Registro de Recolección
          </h3>


          <div className="system-table-wrapper historial-table-wrapper">

            <table className="system-table historial-table historial-table-detail">

              <thead>

                <tr>

                  <th>
                    Código
                  </th>

                  <th>
                    Fecha
                  </th>

                  <th>
                    Distrito
                  </th>

                  <th>
                    Tipo de Residuo
                  </th>

                  <th>
                    No. recibo
                  </th>

                  <th>
                    Responsable
                  </th>

                  <th>
                    Empresa
                  </th>

                  <th className="system-text-right">
                    % Pend.
                  </th>

                  <th className="system-text-right">
                    Lbs Pend.
                  </th>

                  <th>
                    Observaciones
                  </th>

                </tr>

              </thead>


              <tbody>

                {(detalle || []).map(
                  (registro) => (

                    <tr
                      key={
                        registro.recoleccion_id
                      }
                    >

                      <td>
                        {fmt(
                          registro.codigo
                        )}
                      </td>

                      <td>
                        {fmt(
                          registro.fecha
                        )}
                      </td>

                      <td>
                        {fmt(
                          registro.distrito
                        )}
                      </td>

                      <td>
                        {fmt(
                          registro.tipo_residuo
                        )}
                      </td>

                      <td>
                        {fmt(
                          registro.numero_recibo
                        )}
                      </td>

                      <td>
                        {fmt(
                          registro.responsable
                        )}
                      </td>

                      <td>
                        {fmt(
                          registro.empresa_recolectora
                        )}
                      </td>

                      <td className="system-table-number">
                        {fmt(
                          registro.porcentaje_pendiente,
                          "%"
                        )}
                      </td>

                      <td className="system-table-number">
                        {fmt(
                          registro.cantidad_libras_pendientes
                        )}
                      </td>

                      <td className="historial-observaciones-cell">
                        {fmt(
                          registro.observaciones
                        )}
                      </td>

                    </tr>

                  )
                )}


                {sinResultados && (

                  <tr>

                    <td
                      colSpan={10}
                      className="system-table-empty"
                    >
                      Sin resultados para mostrar.
                    </td>

                  </tr>

                )}


                {loading && (

                  <tr>

                    <td
                      colSpan={10}
                      className="system-table-empty"
                    >

                      <span className="historial-loading-inline">

                        <span
                          className="system-spinner system-spinner-small-dark"
                          aria-hidden="true"
                        />

                        Cargando resultados...

                      </span>

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* =================================================
            CONTROL DE PESAJE
        ================================================= */}

        <section className="historial-result-section">

          <h3 className="system-section-title historial-table-title">
            Control de Pesaje
          </h3>


          <div className="system-table-wrapper historial-table-wrapper">

            <table className="system-table historial-table historial-table-weight">

              <thead>

                <tr>

                  <th className="system-text-right">
                    Total (lb)
                  </th>

                  <th className="system-text-right">
                    % Recolectado
                  </th>

                  <th className="system-text-right">
                    % Llenado Actual
                  </th>

                  <th className="system-text-right">
                    Costo por Libra
                  </th>

                  <th className="system-text-right">
                    Costo Total
                  </th>

                </tr>

              </thead>


              <tbody>

                {(detalle || []).map(
                  (registro) => {

                    const pesajeRegistro =
                      pesajeById.get(
                        Number(
                          registro.recoleccion_id
                        )
                      );


                    return (

                      <tr
                        key={
                          `pesaje-${registro.recoleccion_id}`
                        }
                      >

                        <td className="system-table-number">
                          {fmt(
                            pesajeRegistro
                              ?.total_en_libras
                          )}
                        </td>

                        <td className="system-table-number">
                          {fmt(
                            pesajeRegistro
                              ?.porcentaje_recolectado,
                            "%"
                          )}
                        </td>

                        <td className="system-table-number">
                          {fmt(
                            pesajeRegistro
                              ?.porcentaje_llenado,
                            "%"
                          )}
                        </td>

                        <td className="system-table-number">
                          {fmtMoney(
                            pesajeRegistro
                              ?.costo_por_libra_aplicado,
                            4
                          )}
                        </td>

                        <td className="system-table-number">
                          {fmtMoney(
                            pesajeRegistro
                              ?.total_costo_q,
                            2
                          )}
                        </td>

                      </tr>

                    );
                  }
                )}


                {sinResultados && (

                  <tr>

                    <td
                      colSpan={5}
                      className="system-table-empty"
                    >
                      Sin resultados para mostrar.
                    </td>

                  </tr>

                )}


                {loading && (

                  <tr>

                    <td
                      colSpan={5}
                      className="system-table-empty"
                    >

                      <span className="historial-loading-inline">

                        <span
                          className="system-spinner system-spinner-small-dark"
                          aria-hidden="true"
                        />

                        Cargando resultados...

                      </span>

                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>

        </section>


        {/* =================================================
            PAGINACIÓN
        ================================================= */}

        <footer className="historial-pagination-bar">

          <div className="historial-pagination-info">

            Mostrando{" "}

            <strong>
              {showingFrom}
            </strong>

            {" "}a{" "}

            <strong>
              {showingTo}
            </strong>

            {" "}de{" "}

            <strong>
              {total}
            </strong>

            {" "}registros

          </div>


          <div className="historial-pagination-control">

            <AppPagination
              page={page}
              total={total}
              limit={pageSize}
              disabled={
                loading ||
                total === 0
              }
              onChange={
                onPageChange
              }
            />

          </div>

        </footer>

      </div>

    </div>
  );
};


export default HistorialEnTablas;