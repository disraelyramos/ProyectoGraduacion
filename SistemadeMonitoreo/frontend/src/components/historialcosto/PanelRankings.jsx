// frontend/src/components/historialcosto/PanelRankings.jsx
import React from "react";
import { Card, Table } from "react-bootstrap";

const fmtQ = (n) =>
  `Q ${Number(n || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function PanelRankings({ topContenedores = [] }) {
  return (
    <Card className="shadow-sm">
      <Card.Body>
        <div className="fw-bold mb-2">Top 5 Contenedores por Costo</div>

        <Table bordered hover size="sm" className="mb-0">
          <thead className="table-dark">
            <tr>
              <th>Contenedor</th>
              <th>Total (Q)</th>
            </tr>
          </thead>
          <tbody>
            {topContenedores.map((r, idx) => (
              <tr key={`${r.contenedor_codigo || "CNT"}-${idx}`}>
                <td>{r.contenedor_codigo}</td>
                <td>{fmtQ(r.total_q)}</td>
              </tr>
            ))}

            {topContenedores.length === 0 ? (
              <tr>
                <td colSpan={2} className="text-center text-muted py-3">
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
