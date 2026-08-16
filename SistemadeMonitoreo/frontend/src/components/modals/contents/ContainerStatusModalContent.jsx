import React from "react";

import "../../../styles/dashboard-modals.css";

const ContainerStatusModalContent = ({
  containers = [],
  onNewRecord,
}) => {
  return (
    <div className="container-modal-content">
      <div className="container-modal-grid">
        {containers.map((container) => (
          <section
            className="container-modal-card"
            key={container.id}
          >
            <header className="container-modal-card__header">
              <h3 className="container-modal-card__title">
                {container.name}
              </h3>
            </header>

            <dl className="container-modal-details">
              <div className="container-modal-detail">
                <dt>Advertencia configurada</dt>
                <dd>{container.warningThreshold} %</dd>
              </div>

              <div className="container-modal-detail">
                <dt>Crítico configurado</dt>
                <dd>{container.criticalThreshold} %</dd>
              </div>

              <div className="container-modal-detail">
                <dt>Última actualización</dt>
                <dd>{container.lastUpdate}</dd>
              </div>

            </dl>
          </section>
        ))}
      </div>

      <div className="container-modal-actions">
        <button
          type="button"
          className="app-modal-primary-button"
          onClick={onNewRecord}
        >
          Ir a nuevo registro
        </button>
      </div>
    </div>
  );
};

export default ContainerStatusModalContent;