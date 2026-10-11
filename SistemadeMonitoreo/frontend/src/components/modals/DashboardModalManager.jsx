import React from "react";

import ModalBase from "./ModalBase";

import ContainerStatusModalContent
  from "./contents/ContainerStatusModalContent";

import FillingPredictionModalContent
  from "./contents/FillingPredictionModalContent";

import MonthlyCollectionModalContent
  from "./contents/MonthlyCollectionModalContent";

import YearlyCollectionModalContent
  from "./contents/YearlyCollectionModalContent";


// ======================================================
// IDENTIFICADORES DE MODALES
// ======================================================

export const DASHBOARD_MODAL_IDS = {

  CONTAINER_STATUS:
    "container-status",

  FILLING_PREDICTION:
    "filling-prediction",

  MONTHLY_COLLECTION:
    "monthly-collection",

  YEARLY_COLLECTION:
    "yearly-collection",

};


// ======================================================
// CONFIGURACIÓN CENTRALIZADA DE MODALES
// ======================================================

const modalConfig = {

  // ====================================================
  // ESTADO DE CONTENEDORES
  // ====================================================

  [DASHBOARD_MODAL_IDS.CONTAINER_STATUS]: {

    title:
      "Estado de Contenedores",


    renderContent: ({
      containerStatus,
      onNewRecord,
    }) => (

      <ContainerStatusModalContent
        containers={
          containerStatus
        }

        onNewRecord={
          onNewRecord
        }
      />

    ),

  },


  // ====================================================
  // PREDICCIÓN DE LLENADO
  // ====================================================

  [DASHBOARD_MODAL_IDS.FILLING_PREDICTION]: {

    title:
      "Predicción de llenado",


    renderContent: ({
      predictions,
      predictionLoading,
      predictionError,
    }) => (

      <FillingPredictionModalContent
        predictions={
          predictions
        }

        loading={
          predictionLoading
        }

        error={
          predictionError
        }
      />

    ),

  },


  // ====================================================
  // RESUMEN MENSUAL
  // ====================================================

  [DASHBOARD_MODAL_IDS.MONTHLY_COLLECTION]: {

    title:
      "Resumen de recolección",


    renderContent: ({
      collectionSummary,
      onHistory,
    }) => (

      <MonthlyCollectionModalContent
        collectionData={{

          month:
            collectionSummary.month,

          week:
            collectionSummary.week,

        }}

        onHistory={
          onHistory
        }
      />

    ),

  },


  // ====================================================
  // RESUMEN ANUAL
  // ====================================================

  [DASHBOARD_MODAL_IDS.YEARLY_COLLECTION]: {

    title:
      "Recolectado este año",


    renderContent: ({
      collectionSummary,
      onHistory,
    }) => (

      <YearlyCollectionModalContent
        summary={
          collectionSummary
            .year
            .summary
        }

        containers={
          collectionSummary
            .year
            .containers
        }

        onHistory={
          onHistory
        }
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


  // ====================================================
  // DATOS REALES DE MACHINE LEARNING
  // ====================================================

  predictions = [],

  predictionLoading = false,

  predictionError = false,


  // ====================================================
  // RECOLECCIONES
  // ====================================================

  collectionSummary = null,

  collectionLoading = false,

  collectionError = false,

}) => {

  const modal =
    modalConfig[
      activeModalId
    ];


  if (!modal) {

    return null;
  }


  const esModalRecoleccion =
    activeModalId ===
      DASHBOARD_MODAL_IDS
        .MONTHLY_COLLECTION ||

    activeModalId ===
      DASHBOARD_MODAL_IDS
        .YEARLY_COLLECTION;


  let contenido;


  // ====================================================
  // CARGANDO RECOLECCIONES
  // ====================================================

  if (
    esModalRecoleccion &&
    collectionLoading
  ) {

    contenido = (

      <div className="collection-modal">

        <p>
          Consultando recolecciones...
        </p>

      </div>

    );


  // ====================================================
  // ERROR RECOLECCIONES
  // ====================================================

  } else if (
    esModalRecoleccion &&
    (
      collectionError ||
      !collectionSummary
    )
  ) {

    contenido = (

      <div className="collection-modal">

        <p>
          No fue posible consultar el resumen de
          recolección.
        </p>

      </div>

    );


  // ====================================================
  // CONTENIDO NORMAL
  // ====================================================

  } else {

    contenido =
      modal.renderContent({

        containerStatus,

        collectionSummary,

        onNewRecord,

        onHistory,


        // ==============================================
        // MACHINE LEARNING
        // ==============================================

        predictions,

        predictionLoading,

        predictionError,

      });
  }


  return (

    <ModalBase
      isOpen={
        Boolean(
          activeModalId
        )
      }

      title={
        modal.title
      }

      onClose={
        onClose
      }
    >

      {contenido}

    </ModalBase>

  );
};


export default DashboardModalManager;