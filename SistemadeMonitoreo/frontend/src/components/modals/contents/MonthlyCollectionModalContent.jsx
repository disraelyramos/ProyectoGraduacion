import React, { useState } from "react";

import "../../../styles/dashboard-modals.css";

const PERIODS = {
  MONTH: "month",
  WEEK: "week",
};

const MonthlyCollectionModalContent = ({
  collectionData,
  onHistory,
}) => {
  const [activePeriod, setActivePeriod] = useState(PERIODS.MONTH);

  const currentData = collectionData?.[activePeriod];

  const totalCollected =
    currentData?.summary?.totalCollected ?? 0;

  const totalCollections =
    currentData?.summary?.totalCollections ?? 0;

  const containers =
    currentData?.containers ?? [];

  const periodLabel =
    currentData?.label ?? "";

  return (
    <div className="collection-modal">

      <div
        className="collection-period-tabs"
        role="group"
        aria-label="Periodo de recolección"
      >
        <button
          type="button"
          className={`collection-period-tab ${
            activePeriod === PERIODS.MONTH
              ? "collection-period-tab--active"
              : ""
          }`}
          onClick={() =>
            setActivePeriod(PERIODS.MONTH)
          }
        >
          Este mes
        </button>

        <button
          type="button"
          className={`collection-period-tab ${
            activePeriod === PERIODS.WEEK
              ? "collection-period-tab--active"
              : ""
          }`}
          onClick={() =>
            setActivePeriod(PERIODS.WEEK)
          }
        >
          Esta semana
        </button>
      </div>

      <div className="collection-summary">

        <div className="collection-summary-item">
          <span className="collection-summary-label">
            Recolectado {periodLabel.toLowerCase()}
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

      </div>

      <div className="collection-table-wrapper">

        <table className="collection-table">

          <thead>
            <tr>
              <th>Contenedor</th>
              <th>Recolectado</th>
              <th>Recolecciones</th>
              <th>Promedio por recolección</th>
              <th>Última recolección</th>
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
                  {container.lastCollection}
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

export default MonthlyCollectionModalContent;