import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";

import "../charts/ChartSetup";
import { getCssVariable } from "../../utils/getCssVariable";

const chartColors = {
  red: {
    variable: "--color-red",
    fallback: "#ff2d35",
  },
  blue: {
    variable: "--color-blue",
    fallback: "#2563eb",
  },
};

const WasteDistributionCard = ({ distribution }) => {
  const {
    period = "",
    total = 0,
    items = [],
    insight = "",
  } = distribution ?? {};

  const chartData = useMemo(
    () => ({
      labels: items.map((item) => item.name),

      datasets: [
        {
          data: items.map((item) => item.value),

          backgroundColor: items.map((item) => {
            const color = chartColors[item.color];

            if (!color) {
              return "#94a3b8";
            }

            return getCssVariable(
              color.variable,
              color.fallback
            );
          }),

          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    }),
    [items]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,

      cutout: "68%",

      plugins: {
        legend: {
          display: false,
        },

        tooltip: {
          callbacks: {
            label: (context) => {
              const item = items[context.dataIndex];

              if (!item) {
                return "";
              }

              return `${item.name}: ${item.value.toLocaleString()} lb`;
            },
          },
        },
      },
    }),
    [items]
  );

  if (!distribution) {
    return null;
  }

  return (
    <article className="dash-card dashboard-analysis-card">
      <header className="dashboard-card-header">
        <h3 className="dashboard-card-title">
          Distribución del residuo — este mes
        </h3>

        <span className="dashboard-period">
          {period}
        </span>
      </header>

      <div className="waste-distribution-content">
        <div className="waste-chart-wrapper">
          <Doughnut
            data={chartData}
            options={chartOptions}
          />

          <div className="waste-chart-center">
            <strong>
              {total.toLocaleString()} lb
            </strong>

            <span>Total</span>
          </div>
        </div>

        <div className="waste-distribution-legend">
          {items.map((item) => (
            <div
              className="waste-legend-item"
              key={item.id}
            >
              <div className="waste-legend-name">
                <span
                  className={`waste-legend-dot waste-legend-dot--${item.color}`}
                />

                <span>{item.name}</span>
              </div>

              <strong
                className={`waste-legend-value waste-legend-value--${item.color}`}
              >
                {item.value.toLocaleString()} lb · {item.percentage} %
              </strong>
            </div>
          ))}
        </div>
      </div>

      {insight && (
        <div className="dashboard-insight">
          {insight}
        </div>
      )}
    </article>
  );
};

export default WasteDistributionCard;