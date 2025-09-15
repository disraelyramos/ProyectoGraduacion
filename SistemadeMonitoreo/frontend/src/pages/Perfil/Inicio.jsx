import React from "react";
import {
  FiPackage,
  FiBell,
  FiAlertTriangle,
  FiDroplet,
  FiTrendingUp,
  FiClipboard,
} from "react-icons/fi";
import "../../styles/card-dasboard.css";

// ⬇️ importa la sección de gráficas (ruta según lo que creaste)
import ChartsSection from "../../components/charts/ChartsSection";

export default function Dashboard() {
  return (
    <>
      <div className="dashboard-wrap">
        <div className="cards-grid">
          {/* 1) Contenedores Totales */}
          <article className="dash-card">
            <header className="card-head">
              <span className="card-icon icon-blue"><FiPackage /></span>
              <div>
                <h4>Contenedores Totales</h4>
                <p className="muted">En el sistema</p>
              </div>
            </header>

            <div className="metric-row">
              <span className="metric">247</span>
            </div>

            <div className="progress">
              <span className="progress-bar bg-green" style={{ width: "82%" }}></span>
            </div>
            <div className="chip chip-soft-green">● Sistema operativo — 82% capacidad</div>
          </article>

          {/* 2) Alertas Programadas */}
          <article className="dash-card">
            <header className="card-head">
              <span className="card-icon icon-orange"><FiBell /></span>
              <div>
                <h4>Alertas Programadas</h4>
                <p className="muted">Próximas 24 horas</p>
              </div>
            </header>

            <div className="metric-row">
              <span className="metric">14</span>
            </div>

            <div className="progress">
              <span className="progress-bar bg-orange" style={{ width: "60%" }}></span>
            </div>
            <div className="chip chip-soft-orange">● 12 recolecciones pendientes</div>
          </article>

          {/* 3) Punzocortantes (sin barra) */}
          <article className="dash-card">
            <header className="card-head">
              <span className="card-icon icon-red"><FiAlertTriangle /></span>
              <div>
                <h4>Punzocortantes</h4>
                <p className="muted">Estado de contenedores</p>
              </div>
            </header>

            <div className="metric-row">
              <span className="metric">8</span>
            </div>

            <div className="chips-col">
              <div className="chip chip-soft-orange">● 3 al 90% de capacidad</div>
              <div className="chip chip-soft-red">● 1 requiere recolección inmediata</div>
            </div>
          </article>

          {/* 4) Bioinfecciosos (sin barra) */}
          <article className="dash-card">
            <header className="card-head">
              <span className="card-icon icon-purple"><FiDroplet /></span>
              <div>
                <h4>Bioinfecciosos</h4>
                <p className="muted">Estado de contenedores</p>
              </div>
            </header>

            <div className="metric-row">
              <span className="metric">12</span>
            </div>

            <div className="chips-col">
              <div className="chip chip-soft-purple">● 10 en condiciones óptimas</div>
              <div className="chip chip-soft-orange">● 2 programados para recolección</div>
            </div>
          </article>

          {/* 5) Residuos del Mes */}
          <article className="dash-card">
            <header className="card-head">
              <span className="card-icon icon-teal"><FiTrendingUp /></span>
              <div>
                <h4>Residuos del Mes</h4>
                <p className="muted">Septiembre 2025</p>
              </div>
            </header>

            <div className="metric-row">
              <span className="metric">3518</span>
              <span className="unit">lbs</span>
            </div>

            <div className="progress">
              <span className="progress-bar bg-teal" style={{ width: "78%" }}></span>
            </div>
            <div className="chip chip-soft-teal">● 78% del objetivo mensual</div>
          </article>

          {/* 6) Incidencias Reportadas */}
          <article className="dash-card">
            <header className="card-head">
              <span className="card-icon icon-gray"><FiClipboard /></span>
              <div>
                <h4>Incidencias</h4>
                <p className="muted">Últimos 7 días</p>
              </div>
            </header>

            <div className="metric-row">
              <span className="metric">5</span>
            </div>

            <div className="chips-col">
              <div className="chip chip-soft-gray">● 4 pendientes</div>
              <div className="chip chip-soft-green">● 1 resuelta</div>
            </div>
          </article>
        </div>
      </div>

      {/* ⬇️ sección de gráficas (Line, Bar, Doughnut) debajo de las tarjetas */}
      <ChartsSection />
    </>
  );
}
