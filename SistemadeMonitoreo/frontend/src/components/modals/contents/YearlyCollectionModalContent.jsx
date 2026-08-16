import React from "react";

import "../../../styles/dashboard-modals.css";

const YearlyCollectionModalContent = ({
  summary,
  containers = [],
  onHistory,
}) => {
  const totalCollected =
    summary?.totalCollected ?? 0;

  const totalCollections =
    summary?.totalCollections ?? 0;

  const monthlyAverage =
    summary?.monthlyAverage ?? 0;

  return (
    <div className="collection-modal">

      <div className="collection-summary">

        <div className="collection-summary-item">
          <span className="collection-summary-label">
            Recolectado este año
          </span>

          <strong className="collection-summary-value">
            {totalCollected.toLocaleString()} lb
          </strong>
        </div>

        <div className="collection-summary-item">
          <span className="collection-summary-label">
            Recolecciones realizadas
          </span>

          <strong className="collection-summary-value">
            {totalCollections}
          </strong>
        </div>

        <div className="collection-summary-item">
          <span className="collection-summary-label">
            Promedio mensual
          </span>

          <strong className="collection-summary-value">
            {monthlyAverage.toLocaleString()} lb
          </strong>
        </div>

      </div>

      <div className="collection-table-wrapper">

        <table className="collection-table">

          <thead>
            <tr>
              <th>Contenedor</th>
              <th>Recolectado</th>
              <th>Recolecciones</th>
              <th>Promedio por recolección</th>
              <th>Promedio mensual</th>
            </tr>
          </thead>

          <tbody>
            {containers.map((container) => (
              <tr key={container.id}>

                <td className="collection-container-name">
                  {container.name}
                </td>

                <td>
                  {container.collected.toLocaleString()} lb
                </td>

                <td>
                  {container.collections}
                </td>

                <td>
                  {container.averagePerCollection.toLocaleString()} lb
                </td>

                <td>
                  {container.monthlyAverage.toLocaleString()} lb
                </td>

              </tr>
            ))}
          </tbody>

        </table>

      </div>

      <div className="container-modal-actions">
        <button
          type="button"
          className="app-modal-primary-button"
          onClick={onHistory}
        >
          Ir a historial de recolección
        </button>
      </div>

    </div>
  );
};

export default YearlyCollectionModalContent;