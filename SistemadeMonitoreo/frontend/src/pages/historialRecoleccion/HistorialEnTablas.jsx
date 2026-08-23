import React, { useMemo } from "react";
import { Table, Card, Button } from "react-bootstrap";
import { FaFilePdf, FaFileExcel } from "react-icons/fa";
import "../../styles/historial-recoleccion.css";
import AppPagination from "../../components/common/AppPagination";

const fmt = (v, suffix = "") => {
  if (v === null || v === undefined || v === "") return "-";
  return `${v}${suffix}`;
};

const HistorialEnTablas = ({
  loading,
  detalle,
  pesaje,
  page,
  total,
  limit,
  onPageChange,
  canExport,
  onExportPdf,
  onExportExcel,
}) => {
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = total === 0 ? 0 : Math.min(page * limit, total);

  const pesajeById = useMemo(() => {
    const m = new Map();

    (pesaje || []).forEach((p) =>
      m.set(Number(p.recoleccion_id), p)
    );

    return m;
  }, [pesaje]);

  const emptyDetalle =
    !loading && (detalle || []).length === 0;

  return (
    <div className="historial-tables">

      {/* TABLA 1 */}
      <Card className="app-card historial-table-card">
        <Card.Body className="app-card-body">

          <div className="historial-table-header">

            <h2 className="app-subtitle">
              Datos de Registro de Recolección
            </h2>

            <div className="historial-export-actions">

              <Button
                variant="danger"
                size="sm"
                className="app-btn app-btn--compact"
                onClick={onExportPdf}
                disabled={!canExport}
                title={
                  !canExport
                    ? "Presione 'Ver' y asegúrese de tener resultados"
                    : "Ver PDF"
                }
              >
                <FaFilePdf
                  className="me-1"
                  aria-hidden="true"
                />
                PDF
              </Button>

              <Button
                variant="success"
                size="sm"
                className="app-btn app-btn--compact"
                onClick={onExportExcel}
                disabled={!canExport}
                title={
                  !canExport
                    ? "Presione 'Ver' y asegúrese de tener resultados"
                    : "Descargar Excel"
                }
              >
                <FaFileExcel
                  className="me-1"
                  aria-hidden="true"
                />
                Excel
              </Button>

            </div>

          </div>

          <div className="app-divider" />

          <div className="app-table-scroll">

            <Table
              striped
              bordered
              hover
              className="custom-table historial-table historial-table--detail"
            >

              <thead className="sticky-head">
                <tr>
                  <th>Código</th>
                  <th>Fecha</th>
                  <th>Distrito</th>
                  <th>Tipo de Residuo</th>
                  <th>Número de Recibo</th>
                  <th>Responsable</th>
                  <th>Empresa Recolectora</th>
                  <th>% DSH Pendientes</th>
                  <th>Cantidad en Libras Pendientes</th>
                  <th>Observación</th>
                </tr>
              </thead>

              <tbody>

                {(detalle || []).map((r) => (
                  <tr key={r.recoleccion_id}>

                    <td>{fmt(r.codigo)}</td>

                    <td>{fmt(r.fecha)}</td>

                    <td>{fmt(r.distrito)}</td>

                    <td>{fmt(r.tipo_residuo)}</td>

                    <td>{fmt(r.numero_recibo)}</td>

                    <td>{fmt(r.responsable)}</td>

                    <td>
                      {fmt(r.empresa_recolectora)}
                    </td>

                    <td>
                      {fmt(
                        r.porcentaje_pendiente,
                        "%"
                      )}
                    </td>

                    <td>
                      {fmt(
                        r.cantidad_libras_pendientes
                      )}
                    </td>

                    <td>
                      {fmt(r.observaciones)}
                    </td>

                  </tr>
                ))}

                {emptyDetalle && (
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
                      Cargando...
                    </td>
                  </tr>
                )}

              </tbody>

            </Table>

          </div>

        </Card.Body>
      </Card>

      {/* TABLA 2 */}
      <Card className="app-card historial-table-card">

        <Card.Body className="app-card-body">

          <div className="historial-table-header">

            <h2 className="app-subtitle">
              Control de Pesaje
            </h2>

          </div>

          <div className="app-divider" />

          <div className="app-table-scroll">

            <Table
              striped
              bordered
              hover
              className="custom-table historial-table historial-table--weight"
            >

              <thead className="sticky-head">
                <tr>
                  <th>Total (lb)</th>
                  <th>% Recolectado</th>
                  <th>% Llenado Actual</th>
                  <th>Costo por Libra</th>
                  <th>Costo Total</th>
                </tr>
              </thead>

              <tbody>

                {(detalle || []).map((r) => {

                  const p = pesajeById.get(
                    Number(r.recoleccion_id)
                  );

                  return (
                    <tr
                      key={`pesaje-${r.recoleccion_id}`}
                    >
                      <td>
                        {fmt(p?.total_en_libras)}
                      </td>

                      <td>
                        {fmt(
                          p?.porcentaje_recolectado,
                          "%"
                        )}
                      </td>

                      <td>
                        {fmt(
                          p?.porcentaje_llenado,
                          "%"
                        )}
                      </td>

                      <td>
                        {fmt(
                          p?.costo_por_libra_aplicado
                        )}
                      </td>

                      <td>
                        {fmt(p?.total_costo_q)}
                      </td>

                    </tr>
                  );
                })}

                {emptyDetalle && (
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
                      Cargando...
                    </td>
                  </tr>
                )}

              </tbody>

            </Table>

          </div>

          {/* PAGINACIÓN */}
          <div className="historial-pagination-bar">

            <div className="historial-pagination-info">
              Mostrando {showingFrom}-{showingTo} de {total}
            </div>

            <div className="historial-pagination-control">

              <AppPagination
                page={page}
                total={total}
                limit={limit}
                disabled={
                  loading || total === 0
                }
                onChange={onPageChange}
              />

            </div>

          </div>

        </Card.Body>

      </Card>

    </div>
  );
};

export default HistorialEnTablas;