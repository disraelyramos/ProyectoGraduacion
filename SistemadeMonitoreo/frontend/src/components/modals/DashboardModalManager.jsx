import React from "react";

import ModalBase from "./ModalBase";
import ContainerStatusModalContent from "./contents/ContainerStatusModalContent";
import FillingPredictionModalContent from "./contents/FillingPredictionModalContent";
import MonthlyCollectionModalContent from "./contents/MonthlyCollectionModalContent";
import YearlyCollectionModalContent from "./contents/YearlyCollectionModalContent";

import { dashboardModalMockData } from "../../data/dashboardModalMockData";


export const DASHBOARD_MODAL_IDS = {
  CONTAINER_STATUS: "container-status",
  FILLING_PREDICTION: "filling-prediction",
  MONTHLY_COLLECTION: "monthly-collection",
  YEARLY_COLLECTION: "yearly-collection",
};


const modalConfig = {
  [DASHBOARD_MODAL_IDS.CONTAINER_STATUS]: {
    title: "Estado de Contenedores",

    renderContent: ({ onNewRecord }) => (
      <ContainerStatusModalContent
        containers={
          dashboardModalMockData.containerStatus.containers
        }
        onNewRecord={onNewRecord}
      />
    ),
  },

  [DASHBOARD_MODAL_IDS.FILLING_PREDICTION]: {
    title: "Predicción de llenado",

    renderContent: () => (
      <FillingPredictionModalContent
        predictions={
          dashboardModalMockData.fillingPrediction.containers
        }
      />
    ),
  },

  [DASHBOARD_MODAL_IDS.MONTHLY_COLLECTION]: {
    title: "Resumen de recolección",

    renderContent: ({ onHistory }) => (
      <MonthlyCollectionModalContent
        collectionData={
          dashboardModalMockData.monthlyCollection
        }
        onHistory={onHistory}
      />
    ),
  },

  [DASHBOARD_MODAL_IDS.YEARLY_COLLECTION]: {
    title: "Recolectado este año",

    renderContent: ({ onHistory }) => (
      <YearlyCollectionModalContent
        summary={
          dashboardModalMockData.yearlyCollection.summary
        }
        containers={
          dashboardModalMockData.yearlyCollection.containers
        }
        onHistory={onHistory}
      />
    ),
  },
};


const DashboardModalManager = ({
  activeModalId,
  onClose,
  onNewRecord,
  onHistory,
}) => {
  const modal = modalConfig[activeModalId];

  if (!modal) {
    return null;
  }

  return (
    <ModalBase
      isOpen={Boolean(activeModalId)}
      title={modal.title}
      onClose={onClose}
    >
      {modal.renderContent({
        onNewRecord,
        onHistory,
      })}
    </ModalBase>
  );
};

export default DashboardModalManager;