import React, { useMemo } from "react";
import { Table, Card } from "react-bootstrap";
import { FaPrint } from "react-icons/fa";
import "../../styles/historial-recoleccion.css";
import AppPagination from "../../components/common/AppPagination";

const fmt = (v, suffix = "") => {
  if (v === null || v === undefined || v === "") return "-";
  return `${v}${suffix}`;
};

const HistorialEnTablas = ({ loading, detalle, pesaje, page, total, limit, onPageChange }) => {
  const showingFrom = total === 0 ? 0 : (page - 1) * limit + 1;
  const showingTo = total === 0 ? 0 : Math.min(page * limit, total);

  const pesajeById = useMemo(() => {
    const m = new Map();
    (pesaje || []).forEach((p) => m.set(Number(p.recoleccion_id), p));
    return m;
  }, [pesaje]);

  const emptyDetalle = !loading && (detalle || []).length === 0;

  return (
   <div className="w-100 d-flex flex-column gap-4 historial-fullwidth">
      {/* Tabla 1 */}
      <Card className="shadow-sm border-0 w-100 mb-4">
        <Card.Body>
          <h5 className="fw-semibold mb-3">Datos de Registro de Recolección</h5>
          <hr />

          <div className="table-scroll table-scroll-dark">
           <Table striped bordered hover responsive className="mb-0 custom-table">
              <thead className="sticky-head sticky-head-dark">
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
                  <th>Acción</th>
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
                    <td>{fmt(r.empresa_recolectora)}</td>
                    <td>{fmt(r.porcentaje_pendiente, "%")}</td>
                    <td>{fmt(r.cantidad_libras_pendientes)}</td>
                    <td>{fmt(r.observaciones)}</td>
                    <td className="text-center">
                      <FaPrint
                        className="text-info print-icon"
                        title="Imprimir (pendiente)"
                        style={{ cursor: "not-allowed", opacity: 0.6 }}
                      />
                    </td>
                  </tr>
                ))}

                {emptyDetalle && (
                  <tr>
                    <td colSpan={11} className="text-center py-4">
                      Sin resultados para mostrar.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={11} className="text-center py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      {/* Tabla 2 */}
      <Card className="shadow-sm border-0 w-100 mb-4">

        <Card.Body>
          <h5 className="fw-semibold mb-3">Control de Pesaje</h5>
          <hr />

          <div className="table-scroll table-scroll-dark">
            <Table striped bordered hover responsive className="mb-0 custom-table">
              <thead className="sticky-head sticky-head-dark">
                <tr>
                  <th>Total (lb)</th>
                  <th>% Recolectado</th>
                  <th>% Llenado Actual</th>
                  <th>Costo por Libra</th>
                  <th>Costo Total</th>
                  <th>Acción</th>
                </tr>
              </thead>

              <tbody>
                {(detalle || []).map((r) => {
                  const p = pesajeById.get(Number(r.recoleccion_id));
                  return (
                    <tr key={`pesaje-${r.recoleccion_id}`}>
                      <td>{fmt(p?.total_en_libras)}</td>
                      <td>{fmt(p?.porcentaje_recolectado, "%")}</td>
                      <td>{fmt(p?.porcentaje_llenado, "%")}</td>
                      <td>{fmt(p?.costo_por_libra_aplicado)}</td>
                      <td>{fmt(p?.total_costo_q)}</td>
                      <td className="text-center">
                        <FaPrint
                          className="text-success print-icon"
                          title="Imprimir (pendiente)"
                          style={{ cursor: "not-allowed", opacity: 0.6 }}
                        />
                      </td>
                    </tr>
                  );
                })}

                {emptyDetalle && (
                  <tr>
                    <td colSpan={6} className="text-center py-4">
                      Sin resultados para mostrar.
                    </td>
                  </tr>
                )}

                {loading && (
                  <tr>
                    <td colSpan={6} className="text-center py-4">
                      Cargando...
                    </td>
                  </tr>
                )}
              </tbody>
            </Table>
          </div>

          {/* PAGINACIÓN ABAJO DE LA ÚLTIMA TABLA */}
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mt-3">
            <div className="fw-semibold">
              Mostrando {showingFrom}-{showingTo} de {total}
            </div>

            <AppPagination
              page={page}
              total={total}
              limit={limit}
              disabled={loading || total === 0}
              onChange={onPageChange}
            />
          </div>
        </Card.Body>
      </Card>
    </div>
  );
};

export default HistorialEnTablas;
