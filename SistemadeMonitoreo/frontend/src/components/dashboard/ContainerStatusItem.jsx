import React from "react";

const ContainerStatusItem = ({
  name,
  percentage,
  status,
  icon,
  color = "green",
}) => {
  const disponible =
    typeof percentage === "number" &&
    Number.isFinite(percentage) &&
    percentage >= 0 &&
    percentage <= 100;

  const porcentajeVisible = disponible
    ? `${percentage} %`
    : "-- %";

  const anchoBarra = disponible
    ? percentage
    : 0;

  return (
    <div className="container-status-item">

      <div
        className={`dashboard-icon dashboard-icon--${color}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div className="container-status-content">

        <div className="container-status-header">
          <span className="container-status-name">
            {name}
          </span>

          <span className="container-status-percentage">
            {porcentajeVisible}
          </span>
        </div>

        <div className="dashboard-progress">
          <span
            className={`dashboard-progress-bar dashboard-progress-bar--${color}`}
            style={{
              width: `${anchoBarra}%`,
            }}
          />
        </div>

        <div className="dashboard-status">
          <span
            className={`dashboard-status-dot dashboard-status-dot--${color}`}
          />

          <span>{status}</span>
        </div>

      </div>

    </div>
  );
};

export default ContainerStatusItem;