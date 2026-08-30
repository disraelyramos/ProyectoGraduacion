import React, {
  useMemo,
} from "react";

import {
  Table,
  Card,
  Button,
} from "react-bootstrap";

import {
  FaFilePdf,
  FaFileExcel,
  FaChartBar,
} from "react-icons/fa";

import "../../styles/historial-recoleccion.css";

import AppPagination from "../../components/common/AppPagination";


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

  if (!Number.isFinite(number)) {
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
          Number.isSafeInteger(id)
        ) {
          map.set(
            id,
            registro
          );
        }
      }

      return map;

    }, [pesaje]);


  const sinResultados =
    !loading &&
    (detalle || []).length === 0;


  /* =======================================================
     VISTA
     ======================================================= */

  return (

    <div className="historial-tables">

      <Card className="app-card historial-results-card">

        <Card.Body className="app-card-body historial-results-body">


          {/* =================================================
              CABECERA GENERAL
              ================================================= */}

          <div className="historial-results-header">

            <div className="historial-results-title-wrap">

              <FaChartBar
                className="historial-results-title-icon"
                aria-hidden="true"
              />

              <h2 className="historial-results-title">
                Resultados de la búsqueda
              </h2>

            </div>


            <div className="historial-export-actions">

              <Button
                variant="danger"
                size="sm"
                className="app-btn app-btn--compact historial-export-btn"
                onClick={onExportPdf}
                disabled={!canExport}
                title={
                  !canExport
                    ? "Realice una búsqueda con resultados para exportar."
                    : "Exportar resultados a PDF"
                }
              >

                <FaFilePdf
                  className="me-2"
                  aria-hidden="true"
                />

                Exportar PDF

              </Button>


              <Button
                variant="success"
                size="sm"
                className="app-btn app-btn--compact historial-export-btn"
                onClick={onExportExcel}
                disabled={!canExport}
                title={
                  !canExport
                    ? "Realice una búsqueda con resultados para exportar."
                    : "Exportar resultados a Excel"
                }
              >

                <FaFileExcel
                  className="me-2"
                  aria-hidden="true"
                />

                Exportar Excel

              </Button>

            </div>

          </div>


          <div className="historial-results-divider" />


          {/* =================================================
              DATOS DE RECOLECCIÓN
              ================================================= */}

          <section className="historial-result-section">

            <h3 className="historial-table-title">
              Datos de Registro de Recolección
            </h3>


            <div className="app-table-scroll">

              <Table
                bordered
                hover
                className="custom-table historial-table historial-table--detail"
              >

                <thead className="sticky-head">

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

                    <th>
                      % Pend.
                    </th>

                    <th>
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

                        <td className="historial-cell-number">
                          {fmt(
                            registro.porcentaje_pendiente,
                            "%"
                          )}
                        </td>

                        <td className="historial-cell-number">
                          {fmt(
                            registro.cantidad_libras_pendientes
                          )}
                        </td>

                        <td>
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
                        className="historial-table-state"
                      >
                        Sin resultados para mostrar.
                      </td>

                    </tr>

                  )}


                  {loading && (

                    <tr>

                      <td
                        colSpan={10}
                        className="historial-table-state"
                      >
                        Cargando resultados...
                      </td>

                    </tr>

                  )}

                </tbody>

              </Table>

            </div>

          </section>


          {/* =================================================
              CONTROL DE PESAJE
              ================================================= */}

          <section className="historial-result-section">

            <h3 className="historial-table-title">
              Control de Pesaje
            </h3>


            <div className="app-table-scroll">

              <Table
                bordered
                hover
                className="custom-table historial-table historial-table--weight"
              >

                <thead className="sticky-head">

                  <tr>

                    <th>
                      Total (lb)
                    </th>

                    <th>
                      % Recolectado
                    </th>

                    <th>
                      % Llenado Actual
                    </th>

                    <th>
                      Costo por Libra
                    </th>

                    <th>
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

                          <td className="historial-cell-number">
                            {fmt(
                              pesajeRegistro
                                ?.total_en_libras
                            )}
                          </td>

                          <td className="historial-cell-number">
                            {fmt(
                              pesajeRegistro
                                ?.porcentaje_recolectado,
                              "%"
                            )}
                          </td>

                          <td className="historial-cell-number">
                            {fmt(
                              pesajeRegistro
                                ?.porcentaje_llenado,
                              "%"
                            )}
                          </td>

                          <td className="historial-cell-number">
                            {fmtMoney(
                              pesajeRegistro
                                ?.costo_por_libra_aplicado,
                              4
                            )}
                          </td>

                          <td className="historial-cell-number">
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
                        className="historial-table-state"
                      >
                        Sin resultados para mostrar.
                      </td>

                    </tr>

                  )}


                  {loading && (

                    <tr>

                      <td
                        colSpan={5}
                        className="historial-table-state"
                      >
                        Cargando resultados...
                      </td>

                    </tr>

                  )}

                </tbody>

              </Table>

            </div>

          </section>


          {/* =================================================
              PAGINACIÓN GENERAL
              ================================================= */}

          <div className="historial-pagination-bar">

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

          </div>

        </Card.Body>

      </Card>

    </div>
  );
};


export default HistorialEnTablas;