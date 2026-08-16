import React from "react";

const DashboardMetricCard = ({
  title,
  icon,
  iconColor = "blue",
  value,
  valueColor = "blue",
  subtitle,
  footer,
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
        onClick ? "dash-card--interactive" : ""
      }`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={
        onClick
          ? `Ver detalle de ${title}`
          : undefined
      }
    >
      <header className="dashboard-card-header">
        <h3 className="dashboard-card-title">
          {title}
        </h3>
      </header>

      <div
        className={`dashboard-icon dashboard-icon--${iconColor}`}
        aria-hidden="true"
      >
        {icon}
      </div>

      <div
        className={`dashboard-metric dashboard-metric--${valueColor}`}
      >
        {value}
      </div>

      {subtitle && (
        <p className="dashboard-muted">
          {subtitle}
        </p>
      )}

      {footer && (
        <div className="dashboard-card-footer">
          {footer}
        </div>
      )}
    </article>
  );
};

export default DashboardMetricCard;