import React, { useMemo } from "react";
import { Line } from "react-chartjs-2";

import "../charts/ChartSetup";
import { getCssVariable } from "../../utils/getCssVariable";

const seriesColors = {
  bioinfeccioso: {
    variable: "--color-red",
    fallback: "#ff2d35",
  },

  punzocortante: {
    variable: "--color-blue",
    fallback: "#2563eb",
  },
};

export default function MonthlyTrendCard({ monthlyTrend }) {
  const {
    period = "",
    categories = [],
    series = [],
    insight = "",
  } = monthlyTrend ?? {};

  const chartData = useMemo(() => {
    return {
      labels: categories,

      datasets: series.map((item) => {
        const color = seriesColors[item.id];

        const lineColor = color
          ? getCssVariable(color.variable, color.fallback)
          : "#94a3b8";

        return {
          label: item.name,
          data: item.data,

          borderColor: lineColor,
          backgroundColor: lineColor,

          borderWidth: 2,
          pointRadius: 3,
          pointHoverRadius: 5,

          tension: 0.35,
          fill: false,
        };
      }),
    };
  }, [categories, series]);

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false,
      },

      plugins: {
        legend: {
          display: true,
          position: "bottom",

          labels: {
            usePointStyle: true,
            boxWidth: 8,
            boxHeight: 8,
            padding: 18,
          },
        },

        tooltip: {
          callbacks: {
            label: (context) => {
              const value = context.parsed.y ?? 0;

              return `${context.dataset.label}: ${value.toLocaleString()} lb`;
            },
          },
        },
      },

      scales: {
        x: {
          grid: {
            display: false,
          },

          ticks: {
            maxRotation: 0,
          },
        },

        y: {
          beginAtZero: true,

          grid: {
            color: "rgba(148, 163, 184, 0.18)",
          },

          ticks: {
            callback: (value) => value.toLocaleString(),
          },
        },
      },
    }),
    []
  );

  if (!monthlyTrend) {
    return null;
  }

  return (
    <article className="dash-card dashboard-analysis-card">
      <header className="dashboard-card-header">
        <h3 className="dashboard-card-title">
          Tendencia mensual de residuos
        </h3>

        <span className="dashboard-period">
          {period}
        </span>
      </header>

      <div className="monthly-trend-chart">
        <Line data={chartData} options={chartOptions} />
      </div>

      {insight && (
        <div className="dashboard-insight">
          {insight}
        </div>
      )}
    </article>
  );
}