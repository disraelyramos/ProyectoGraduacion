import React from "react";

import ModalBase from "./ModalBase";

import ContainerStatusModalContent from "./contents/ContainerStatusModalContent";
import FillingPredictionModalContent from "./contents/FillingPredictionModalContent";
import MonthlyCollectionModalContent from "./contents/MonthlyCollectionModalContent";
import YearlyCollectionModalContent from "./contents/YearlyCollectionModalContent";

import { dashboardModalMockData } from "../../data/dashboardModalMockData";

// ======================================================
// IDENTIFICADORES DE MODALES
// ======================================================

export const DASHBOARD_MODAL_IDS = {
  CONTAINER_STATUS: "container-status",
  FILLING_PREDICTION: "filling-prediction",
  MONTHLY_COLLECTION: "monthly-collection",
  YEARLY_COLLECTION: "yearly-collection",
};

// ======================================================
// CONFIGURACIÓN CENTRALIZADA DE MODALES
// ======================================================

const modalConfig = {
  [DASHBOARD_MODAL_IDS.CONTAINER_STATUS]: {
    title: "Estado de Contenedores",

    renderContent: ({
      containerStatus,
      onNewRecord,
    }) => (
      <ContainerStatusModalContent
        containers={containerStatus}
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

    renderContent: ({
      collectionSummary,
      onHistory,
    }) => (
      <MonthlyCollectionModalContent
        collectionData={{
          month: collectionSummary.month,
          week: collectionSummary.week,
        }}
        onHistory={onHistory}
      />
    ),
  },

  [DASHBOARD_MODAL_IDS.YEARLY_COLLECTION]: {
    title: "Recolectado este año",

    renderContent: ({
      collectionSummary,
      onHistory,
    }) => (
      <YearlyCollectionModalContent
        summary={collectionSummary.year.summary}
        containers={collectionSummary.year.containers}
        onHistory={onHistory}
      />
    ),
  },
};

// ======================================================
// ADMINISTRADOR CENTRAL DE MODALES
// ======================================================

const DashboardModalManager = ({
  activeModalId,
  onClose,
  onNewRecord,
  onHistory,
  containerStatus = [],
  collectionSummary = null,
  collectionLoading = false,
  collectionError = false,
}) => {
  const modal = modalConfig[activeModalId];

  if (!modal) {
    return null;
  }

  const esModalRecoleccion =
    activeModalId ===
      DASHBOARD_MODAL_IDS.MONTHLY_COLLECTION ||
    activeModalId ===
      DASHBOARD_MODAL_IDS.YEARLY_COLLECTION;

  let contenido;

  if (esModalRecoleccion && collectionLoading) {
    contenido = (
      <div className="collection-modal">
        <p>Consultando recolecciones...</p>
      </div>
    );
  } else if (
    esModalRecoleccion &&
    (collectionError || !collectionSummary)
  ) {
    contenido = (
      <div className="collection-modal">
        <p>
          No fue posible consultar el resumen de
          recolección.
        </p>
      </div>
    );
  } else {
    contenido = modal.renderContent({
      containerStatus,
      collectionSummary,
      onNewRecord,
      onHistory,
    });
  }

  return (
    <ModalBase
      isOpen={Boolean(activeModalId)}
      title={modal.title}
      onClose={onClose}
    >
      {contenido}
    </ModalBase>
  );
};

export default DashboardModalManager;