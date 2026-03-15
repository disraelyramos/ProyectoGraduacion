// frontend/src/components/historialcosto/TablaDetalle.jsx
import React, { useMemo } from "react";
import { Card, Table, Button } from "react-bootstrap";

const fmtQ = (n) =>
  `Q ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const fmtLb = (n) =>
  `${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} lbs`;

const fmtPct = (n) => {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return `${num.toFixed(2)}%`;
};

const fmtQlb = (n) => {
  if (n === null || n === undefined || n === "") return "";
  const num = Number(n);
  if (!Number.isFinite(num)) return String(n);
  return `Q ${num.toFixed(2)}/lb`;
};

export default function TablaDetalle({ detalle, onPageChange }) {
  const rows = detalle?.rows || [];
  const page = Number(detalle?.page || 1);
  const limit = Number(detalle?.limit || 10);
  const total = Number(detalle?.total || 0);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / limit)), [total, limit]);
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <Card className="shadow-sm border-0">
      <Card.Body>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mb-2">
          <div className="fw-bold">Detalle de Recolecciones</div>

          <div className="d-flex align-items-center gap-2">
            <small className="text-muted">
              Mostrando {from}-{to} de {total}
            </small>

            <Button
              size="sm"
              variant="outline-dark"
              disabled={page <= 1}
              onClick={() => onPageChange?.(page - 1)}
            >
              ◀
            </Button>

            <small className="text-muted">
              {page} / {totalPages}
            </small>

            <Button
              size="sm"
              variant="outline-dark"
              disabled={page >= totalPages}
              onClick={() => onPageChange?.(page + 1)}
            >
              ▶
            </Button>
          </div>
        </div>

        <Table responsive bordered hover size="sm" className="mb-0">
          <thead className="table-dark">
            <tr>
              <th>Fecha</th>
              <th>Código Contenedor</th>
              <th>Distrito</th>
              <th>Empresa</th>
              <th className="text-end">Total lbs</th>
              <th className="text-end">% Llenado</th>
              <th className="text-end">Costo/lb</th>
              <th className="text-end">Total Pagado (Q)</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r, idx) => (
              <tr key={`${r.fecha || "F"}-${r.codigo_contenedor || "C"}-${idx}`}>
                <td>{r.fecha}</td>
                <td>{r.codigo_contenedor}</td>
                <td>{r.distrito}</td>
                <td>{r.empresa_recolectora}</td>
                <td className="text-end">{fmtLb(r.total_en_libras)}</td>
                <td className="text-end">{fmtPct(r.porcentaje_llenado)}</td>
                <td className="text-end">{fmtQlb(r.costo_por_libra_aplicado)}</td>
                <td className="text-end">{fmtQ(r.total_costo_q)}</td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center text-muted py-3">
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
