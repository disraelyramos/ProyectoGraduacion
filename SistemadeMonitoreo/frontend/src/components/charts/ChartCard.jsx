import React from "react";

const ChartCard = ({ title, subtitle, children }) => (
  <div className="dash-card" style={{ minHeight: 320, display: "flex", flexDirection: "column" }}>
    <div className="card-head" style={{ marginBottom: 8 }}>
      <div className="card-icon icon-gray">📈</div>
      <div>
        <h4>{title}</h4>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0 }}>
      {children}
    </div>
  </div>
);

export default ChartCard;
