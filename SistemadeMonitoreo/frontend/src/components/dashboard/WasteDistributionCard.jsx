
import React, { useMemo } from "react";
import { Doughnut } from "react-chartjs-2";

import "../charts/ChartSetup";
import { getCssVariable } from "../../utils/getCssVariable";

const chartColors = {
  bioinfeccioso: {
    variable: "--color-red",
    fallback: "#ff2d35",
    className: "red",
  },

  punzocortante: {
    variable: "--color-blue",
    fallback: "#2563eb",
    className: "blue",
  },
};

// ======================================================
// FORMATO DE DATOS RECIBIDOS DEL BACKEND
// ======================================================

const formatoLibras = (valor) =>
  `${Number(valor).toLocaleString("es-GT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} lb`;

const formatoPorcentaje = (valor) =>
  `${Number(valor).toLocaleString("es-GT", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })} %`;

// ======================================================
// COMPARACIÓN MENSUAL
// ======================================================

const ComparacionMensual = ({
  comparison,
  currentCollected,
  previousPeriod,
  currentPeriod,
  general = false,
}) => {
  if (!comparison) {
    return null;
  }

  const {
    previousCollected,
    difference,
    changePercentage,
    trend,
  } = comparison;

  const estados = {
    increase: {
      icon: "↑",
      text: `${formatoPorcentaje(
        Math.abs(changePercentage)
      )} más que ${previousPeriod}`,
      className: "increase",
    },

    decrease: {
      icon: "↓",
      text: `${formatoPorcentaje(
        Math.abs(changePercentage)
      )} menos que ${previousPeriod}`,
      className: "decrease",
    },

    unchanged: {
      icon: "→",
      text: `Sin variación respecto a ${previousPeriod}`,
      className: "unchanged",
    },

    "no-base": {
      icon: "—",
      text: `Sin base porcentual de comparación con ${previousPeriod}`,
      className: "no-base",
    },
  };

  const estado = estados[trend];

  if (!estado) {
    return null;
  }

  return (
    <div
      className={[
        "waste-comparison",
        `waste-comparison--${estado.className}`,
        general ? "waste-comparison--general" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {general && (
        <strong className="waste-comparison-title">
          Comparación general
        </strong>
      )}

      <strong className="waste-comparison-result">
        <span aria-hidden="true">
          {estado.icon}
        </span>

        {estado.text}
      </strong>

      <span className="waste-comparison-detail">
        {previousPeriod}:{" "}
        {formatoLibras(previousCollected)}
        {" → "}
        {currentPeriod}:{" "}
        {formatoLibras(currentCollected)}
      </span>

      {trend !== "unchanged" && (
        <span className="waste-comparison-difference">
          Diferencia:{" "}
          {difference > 0 ? "+" : ""}
          {formatoLibras(difference)}
        </span>
      )}
    </div>
  );
};

// ======================================================
// TARJETA DE DISTRIBUCIÓN
// ======================================================

const WasteDistributionCard = ({
  distribution,
  loading = false,
  error = false,
}) => {
  const {
    period = "",
    total = 0,
    containers = [],
    previousMonth = null,
    comparison = null,
  } = distribution ?? {};

  const chartData = useMemo(
    () => ({
      labels: containers.map(
        (item) => item.name
      ),

      datasets: [
        {
          data: containers.map(
            (item) => item.collected
          ),

          backgroundColor: containers.map(
            (item) => {
              const color =
                chartColors[item.id];

              return color
                ? getCssVariable(
                    color.variable,
                    color.fallback
                  )
                : "#94a3b8";
            }
          ),

          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    }),
    [containers]
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
              const item =
                containers[
                  context.dataIndex
                ];

              if (!item) {
                return "";
              }

              return (
                `${item.name}: ` +
                formatoLibras(
                  item.collected
                ) +
                ` · ${formatoPorcentaje(
                  item.percentage
                )}`
              );
            },
          },
        },
      },
    }),
    [containers]
  );

  // ====================================================
  // ESTADOS DE CONSULTA
  // ====================================================

  if (loading) {
    return (
      <article className="dash-card dashboard-analysis-card">
        <header className="dashboard-card-header">
          <h3 className="dashboard-card-title">
            Distribución del residuo
          </h3>
        </header>

        <p className="dashboard-insight">
          Cargando distribución de residuos...
        </p>
      </article>
    );
  }

  if (error || !distribution) {
    return (
      <article className="dash-card dashboard-analysis-card">
        <header className="dashboard-card-header">
          <h3 className="dashboard-card-title">
            Distribución del residuo
          </h3>
        </header>

        <p className="dashboard-insight">
          No fue posible consultar la distribución
          de residuos. Intente nuevamente.
        </p>
      </article>
    );
  }

  const hayPesos = total > 0;

  const periodoAnterior =
    previousMonth?.period || "";

  // ====================================================
  // PRESENTACIÓN
  // ====================================================

  return (
    <article className="dash-card dashboard-analysis-card">
      <header className="dashboard-card-header">
        <h3 className="dashboard-card-title">
          Distribución del residuo
        </h3>

        <span className="dashboard-period">
          {period}
        </span>
      </header>

      <div className="waste-distribution-content">
        <div className="waste-chart-wrapper">
          {hayPesos ? (
            <Doughnut
              data={chartData}
              options={chartOptions}
            />
          ) : (
            <div className="waste-chart-empty">
              Sin pesos registrados
            </div>
          )}

          <div className="waste-chart-center">
            <strong>
              {formatoLibras(total)}
            </strong>

            <span>Total del mes</span>
          </div>
        </div>

        <div className="waste-distribution-legend">
          {containers.map((item) => {
            const color =
              chartColors[item.id];

            const colorClass =
              color?.className || "";

            return (
              <div
                className="waste-residue-block"
                key={item.id}
              >
                <div className="waste-legend-item">
                  <div className="waste-legend-name">
                    <span
                      className={
                        `waste-legend-dot ` +
                        `waste-legend-dot--${colorClass}`
                      }
                    />

                    <span>
                      {item.name}
                    </span>
                  </div>

                  <strong
                    className={
                      `waste-legend-value ` +
                      `waste-legend-value--${colorClass}`
                    }
                  >
                    {formatoLibras(
                      item.collected
                    )}
                    {" · "}
                    {formatoPorcentaje(
                      item.percentage
                    )}
                  </strong>
                </div>

                <ComparacionMensual
                  comparison={item}
                  currentCollected={
                    item.collected
                  }
                  previousPeriod={
                    periodoAnterior
                  }
                  currentPeriod={period}
                />
              </div>
            );
          })}
        </div>
      </div>

      {comparison && (
        <ComparacionMensual
          comparison={comparison}
          currentCollected={total}
          previousPeriod={
            periodoAnterior
          }
          currentPeriod={period}
          general
        />
      )}

      <p className="waste-comparison-note">
        Comparación del acumulado del mes
        actual hasta la fecha frente al
        total del mes anterior.
      </p>
    </article>
  );
};

export default WasteDistributionCard;
