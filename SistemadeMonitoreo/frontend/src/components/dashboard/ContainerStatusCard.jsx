import React from "react";
import { FaBiohazard, FaSyringe } from "react-icons/fa";

import ContainerStatusItem from "./ContainerStatusItem";

const containerIcons = {
  bioinfeccioso: <FaBiohazard />,
  punzocortante: <FaSyringe />,
};

const ContainerStatusCard = ({
  monitored = 0,
  attention = 0,
  containers = [],
  onClick,
}) => {
  const handleKeyDown = (event) => {
    if (!onClick) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <article
      className={`dash-card ${
        attention > 0 ? "dash-card--attention" : ""
      } ${onClick ? "dash-card--interactive" : ""}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={
        onClick
          ? "Ver detalle del estado de contenedores"
          : undefined
      }
    >
      <header className="dashboard-card-header">
        <div>
          <h3 className="dashboard-card-title">
            Estado de Contenedores
          </h3>

          <p className="dashboard-card-subtitle">
            {monitored} monitoreados · {attention} requiere atención
          </p>
        </div>
      </header>

      <div className="container-status-list">
        {containers.map((container) => (
          <ContainerStatusItem
            key={container.id}
            name={container.name}
            percentage={container.percentage}
            status={container.status}
            color={container.color}
            icon={containerIcons[container.type] ?? null}
          />
        ))}
      </div>
    </article>
  );
};

export default ContainerStatusCard;