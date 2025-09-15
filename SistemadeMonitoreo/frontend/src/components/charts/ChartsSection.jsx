import React, { useMemo } from "react";
import { Line, Bar, Doughnut } from "react-chartjs-2";
import "./ChartSetup";
import ChartCard from "./ChartCard";

// Opciones comunes
const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: true, position: "bottom" },
    tooltip: { enabled: true },
  },
  layout: { padding: 6 },
};

const ChartsSection = () => {
  // Datos de ejemplo — reemplaza con tu API cuando quieras
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  const residuosMesData = useMemo(() => ({
    labels: meses,
    datasets: [
      {
        label: "Residuos (lbs)",
        data: [220, 240, 260, 210, 290, 300, 280, 310, 351, 330, 340, 360],
        fill: true,
        borderColor: "rgba(37, 99, 235, 1)",           // azul
        backgroundColor: "rgba(37, 99, 235, 0.15)",
        pointRadius: 3,
        tension: 0.35,
      },
    ],
  }), []);

  const residuosMesOpts = {
    ...baseOptions,
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 100 } },
      x: { grid: { display: false } },
    },
  };

  const semana = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];
  const recoleccionesSemanaData = useMemo(() => ({
    labels: semana,
    datasets: [
      {
        label: "Recolecciones",
        data: [3, 5, 4, 6, 7, 2, 1],
        borderWidth: 0,
        backgroundColor: [
          "rgba(245, 158, 11, 0.9)",  // naranja
          "rgba(37, 99, 235, 0.9)",   // azul
          "rgba(16, 185, 129, 0.9)",  // verde
          "rgba(124, 58, 237, 0.9)",  // morado
          "rgba(239, 68, 68, 0.9)",   // rojo
          "rgba(14, 165, 233, 0.9)",  // cyan
          "rgba(99, 102, 241, 0.9)",  // indigo
        ],
        borderRadius: 6,
      },
    ],
  }), []);

  const recoleccionesSemanaOpts = {
    ...baseOptions,
    scales: {
      y: { beginAtZero: true, ticks: { stepSize: 2 } },
      x: { grid: { display: false } },
    },
  };

  const tiposData = useMemo(() => ({
    labels: ["Bioinfecciosos", "Punzocortantes", "Comunes", "Reciclables"],
    datasets: [
      {
        label: "Contenedores",
        data: [158, 89, 44, 28],
        backgroundColor: [
          "rgba(124,58,237,0.9)",   // morado
          "rgba(239,68,68,0.9)",    // rojo
          "rgba(2,132,199,0.9)",    // azul cielo
          "rgba(16,185,129,0.9)",   // verde
        ],
        borderWidth: 0,
      },
    ],
  }), []);

  const tiposOpts = {
    ...baseOptions,
    plugins: {
      ...baseOptions.plugins,
      legend: { position: "right", labels: { boxWidth: 14 } },
    },
    cutout: "62%",
  };

  return (
    <section className="dashboard-wrap" style={{ paddingTop: 0 }}>
      <div className="cards-grid">
        <ChartCard title="Residuos del Año" subtitle="Libras por mes">
          <Line data={residuosMesData} options={residuosMesOpts} />
        </ChartCard>

        <ChartCard title="Recolecciones por Semana" subtitle="Últimos 7 días">
          <Bar data={recoleccionesSemanaData} options={recoleccionesSemanaOpts} />
        </ChartCard>

        <ChartCard title="Distribución por Tipo de Desecho" subtitle="Total contenedores">
          <Doughnut data={tiposData} options={tiposOpts} />
        </ChartCard>
      </div>
    </section>
  );
};

export default ChartsSection;
