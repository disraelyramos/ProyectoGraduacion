import React, { useState } from "react";

import "../../styles/card-dasboard.css";

import ContainerStatusCard from "../../components/dashboard/ContainerStatusCard";
import DashboardMetricsSection from "../../components/dashboard/DashboardMetricsSection";
import WasteDistributionCard from "../../components/dashboard/WasteDistributionCard";
import MonthlyTrendCard from "../../components/dashboard/MonthlyTrendCard";

import DashboardModalManager, {
  DASHBOARD_MODAL_IDS,
} from "../../components/modals/DashboardModalManager";

import { dashboardMockData } from "../../data/dashboardMockData";


const metricModalMap = {
  prediction: DASHBOARD_MODAL_IDS.FILLING_PREDICTION,
  month: DASHBOARD_MODAL_IDS.MONTHLY_COLLECTION,
  year: DASHBOARD_MODAL_IDS.YEARLY_COLLECTION,
};


const Dashboard = () => {
  const [activeModalId, setActiveModalId] = useState(null);

  const {
    containers,
    metrics,
    distribution,
    monthlyTrend,
  } = dashboardMockData;


  const openModal = (modalId) => {
    setActiveModalId(modalId);
  };


  const closeModal = () => {
    setActiveModalId(null);
  };


  const handleMetricClick = (metricId) => {
    const modalId = metricModalMap[metricId];

    if (modalId) {
      openModal(modalId);
    }
  };


  return (
    <>
      <main className="dashboard-wrap">

        <section
          className="dashboard-summary-grid"
          aria-label="Resumen general del sistema"
        >
          <ContainerStatusCard
            monitored={containers.monitored}
            attention={containers.attention}
            containers={containers.items}
            onClick={() =>
              openModal(DASHBOARD_MODAL_IDS.CONTAINER_STATUS)
            }
          />

          <DashboardMetricsSection
            metrics={metrics}
            interactiveMetricIds={[
              "prediction",
              "month",
              "year",
            ]}
            onMetricClick={handleMetricClick}
          />
        </section>

        <section
          className="dashboard-analytics-grid"
          aria-label="Análisis de residuos"
        >
          <WasteDistributionCard
            distribution={distribution}
          />

          <MonthlyTrendCard
            monthlyTrend={monthlyTrend}
          />
        </section>

      </main>

      <DashboardModalManager
        activeModalId={activeModalId}
        onClose={closeModal}
      />
    </>
  );
};

export default Dashboard;