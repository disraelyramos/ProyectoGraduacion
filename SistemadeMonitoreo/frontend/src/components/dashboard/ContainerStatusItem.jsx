import React from "react";

const ContainerStatusItem = ({
  name,
  percentage,
  status,
  icon,
  color = "green",
}) => {
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
            {percentage} %
          </span>
        </div>

        <div className="dashboard-progress">
          <span
            className={`dashboard-progress-bar dashboard-progress-bar--${color}`}
            style={{ width: `${percentage}%` }}
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