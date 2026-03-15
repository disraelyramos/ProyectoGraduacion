// frontend/src/components/historialcosto/TablaResumen.jsx
import React, { useMemo } from "react";
import { Card, Table } from "react-bootstrap";

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

const fmtQlb = (n) =>
  `Q ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}/lb`;

function prettyAgrupar(v) {
  const s = String(v || "mes").toLowerCase();
  if (s === "semana") return "Semana";
  if (s === "anio" || s === "año") return "Año";
  return "Mes";
}

export default function TablaResumen({ agruparPor, rows = [] }) {
  const label = useMemo(() => prettyAgrupar(agruparPor), [agruparPor]);

  return (
    <Card className="shadow-sm border-0">
      <Card.Body>
        <div className="fw-bold mb-2">Resumen de Costos (por {label})</div>

        <Table responsive bordered hover size="sm" className="mb-0">
          <thead className="table-dark">
            <tr>
              <th>Periodo</th>
              <th className="text-end">Total Gastado (Q)</th>
              <th className="text-end">Total lbs</th>
              <th className="text-end">Promedio Q/lb</th>
              <th className="text-end"># Recolecciones</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((r) => (
              <tr key={String(r.periodo)}>
                <td>{r.periodo}</td>
                <td className="text-end">{fmtQ(r.total_q)}</td>
                <td className="text-end">{fmtLb(r.total_lbs)}</td>
                <td className="text-end">{fmtQlb(r.q_por_lb)}</td>
                <td className="text-end">{Number(r.recolecciones || 0)}</td>
              </tr>
            ))}

            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center text-muted py-3">
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
