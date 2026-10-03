
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";

import "../../styles/card-dasboard.css";

import apiClient from "../../utils/apiClient";

import ContainerStatusCard from "../../components/dashboard/ContainerStatusCard";
import DashboardMetricsSection from "../../components/dashboard/DashboardMetricsSection";
import WasteDistributionCard from "../../components/dashboard/WasteDistributionCard";
import MonthlyTrendCard from "../../components/dashboard/MonthlyTrendCard";

import DashboardModalManager, {
  DASHBOARD_MODAL_IDS,
} from "../../components/modals/DashboardModalManager";

import { dashboardMockData } from "../../data/dashboardMockData";

// ======================================================
// MODALES DE MÉTRICAS
// ======================================================

const metricModalMap = {
  prediction: DASHBOARD_MODAL_IDS.FILLING_PREDICTION,
  month: DASHBOARD_MODAL_IDS.MONTHLY_COLLECTION,
  year: DASHBOARD_MODAL_IDS.YEARLY_COLLECTION,
};

// ======================================================
// INTERVALOS DE ACTUALIZACIÓN
// ======================================================

const NIVEL_REFRESH_MS = (() => {
  const valor = Number(
    import.meta.env.VITE_NIVEL_REFRESH_INTERVAL_MS
  );

  return Number.isFinite(valor) && valor >= 1000
    ? valor
    : 3000;
})();

const CONFIGURACION_REFRESH_MS = 15000;

// ======================================================
// TIPOS DE CONTENEDOR
// ======================================================

const TIPOS_CONTENEDOR = [
  {
    idTipoResiduo: 1,
    type: "bioinfeccioso",
    name: "Bioinfeccioso",
  },
  {
    idTipoResiduo: 2,
    type: "punzocortante",
    name: "Punzocortante",
  },
];

// ======================================================
// PORCENTAJE PARA PRESENTACIÓN
// ======================================================

const obtenerPorcentaje = (contenedor) => {
  if (
    contenedor?.nivel_disponible !== true ||
    contenedor?.porcentaje_llenado === null ||
    contenedor?.porcentaje_llenado === undefined
  ) {
    return null;
  }

  const porcentaje = Number(
    contenedor.porcentaje_llenado
  );

  if (
    !Number.isFinite(porcentaje) ||
    porcentaje < 0 ||
    porcentaje > 100
  ) {
    return null;
  }

  return Math.round(porcentaje);
};

// ======================================================
// ESTADO VISUAL
// ======================================================

// Solo determina cómo presentar la información.
// Las reglas reales de alertas pertenecen al backend.

const obtenerEstadoVisual = (
  porcentaje,
  configuracion
) => {
  if (porcentaje === null) {
    return {
      status: "Sin lectura",
      color: "gray",
      requiereAtencion: false,
    };
  }

  if (!configuracion) {
    return {
      status: "Umbrales no disponibles",
      color: "gray",
      requiereAtencion: false,
    };
  }

  if (
    porcentaje >=
    configuracion.segundo_aviso_pct
  ) {
    return {
      status: "Nivel alto",
      color: "red",
      requiereAtencion: true,
    };
  }

  if (
    porcentaje >=
    configuracion.primer_aviso_pct
  ) {
    return {
      status: "Primer aviso",
      color: "orange",
      requiereAtencion: true,
    };
  }

  return {
    status: "Normal",
    color: "green",
    requiereAtencion: false,
  };
};

// ======================================================
// FECHA DE ACTUALIZACIÓN
// ======================================================

const formatearActualizacion = (fecha) => {
  if (!fecha) {
    return "Sin actualización";
  }

  const valor = new Date(fecha);

  if (Number.isNaN(valor.getTime())) {
    return "Sin actualización";
  }

  return valor.toLocaleString("es-GT", {
    dateStyle: "short",
    timeStyle: "short",
  });
};

// ======================================================
// VALIDACIÓN DE RESPUESTA DEL RESUMEN
// ======================================================

// El backend calcula todos los valores.
// Aquí únicamente comprobamos que la respuesta
// tenga la estructura necesaria para presentarla.

const esNumeroValido = (valor) =>
  typeof valor === "number" &&
  Number.isFinite(valor);

const esComparacionValida = (valor) =>
  valor !== null &&
  typeof valor === "object" &&
  esNumeroValido(valor.previousCollected) &&
  esNumeroValido(valor.difference) &&
  (
    valor.changePercentage === null ||
    esNumeroValido(valor.changePercentage)
  ) &&
  [
    "increase",
    "decrease",
    "unchanged",
    "no-base",
  ].includes(valor.trend);

const esDistribucionValida = (valor) => {
  if (
    !valor ||
    typeof valor !== "object" ||
    typeof valor.period !== "string" ||
    !esNumeroValido(valor.total) ||
    !valor.previousMonth ||
    typeof valor.previousMonth.period !== "string" ||
    !esNumeroValido(valor.previousMonth.total) ||
    !Array.isArray(valor.containers) ||
    !esComparacionValida(valor.comparison)
  ) {
    return false;
  }

  const tiposEsperados = [
    "bioinfeccioso",
    "punzocortante",
  ];

  if (
    valor.containers.length !==
    tiposEsperados.length
  ) {
    return false;
  }

  return tiposEsperados.every((tipo) => {
    const coincidencias =
      valor.containers.filter(
        (item) => item?.id === tipo
      );

    if (coincidencias.length !== 1) {
      return false;
    }

    const item = coincidencias[0];

    return (
      typeof item.name === "string" &&
      esNumeroValido(item.collected) &&
      esNumeroValido(item.percentage) &&
      esComparacionValida(item)
    );
  });
};

const esResumenValido = (data) => {
  if (!data || typeof data !== "object") {
    return false;
  }

  const periodos = [
    "month",
    "week",
    "year",
  ];

  const resumenesValidos =
    periodos.every((periodo) => {
      const resumen = data[periodo];

      return (
        resumen &&
        resumen.summary &&
        esNumeroValido(
          resumen.summary.totalCollected
        ) &&
        esNumeroValido(
          resumen.summary.totalCollections
        ) &&
        Array.isArray(
          resumen.containers
        )
      );
    });

  return (
    resumenesValidos &&
    esDistribucionValida(
      data.distribution
    )
  );
};

// ======================================================
// DASHBOARD DE INICIO
// ======================================================

const Dashboard = ({ onNavigate }) => {
  // ====================================================
  // ESTADOS DE MODALES
  // ====================================================

  const [
    activeModalId,
    setActiveModalId,
  ] = useState(null);

  // ====================================================
  // ESTADOS DE CONTENEDORES
  // ====================================================

  const [
    contenedoresBackend,
    setContenedoresBackend,
  ] = useState([]);

  const [
    configuracionAlertas,
    setConfiguracionAlertas,
  ] = useState(null);

  // ====================================================
  // DATOS TEMPORALES NO INTEGRADOS
  // ====================================================

  // El mock permanece únicamente para las métricas
  // pendientes de integración y la tendencia mensual.
  // La distribución NO utiliza este mock.

  const {
    metrics: mockMetrics,
    monthlyTrend,
  } = dashboardMockData;

  // ====================================================
  // RESUMEN REAL DE RECOLECCIÓN
  // ====================================================

  const [
    resumenRecoleccion,
    setResumenRecoleccion,
  ] = useState(null);

  const [
    cargandoResumen,
    setCargandoResumen,
  ] = useState(true);

  const [
    errorResumen,
    setErrorResumen,
  ] = useState(false);

  // ====================================================
  // CONSULTAR RESUMEN DE RECOLECCIÓN
  // ====================================================

  const cargarResumenRecoleccion =
    useCallback(async () => {
      setCargandoResumen(true);
      setErrorResumen(false);

      try {
        const response = await apiClient.get(
          "/dashboard/resumen-recoleccion"
        );

        const data = response.data?.data;

        if (
          response.data?.success !== true ||
          !esResumenValido(data)
        ) {
          throw new Error(
            "El resumen de recolección no es válido."
          );
        }

        setResumenRecoleccion(data);
      } catch (error) {
        console.error(
          "Error consultando resumen de recolección:",
          error
        );

        // No presentar datos anteriores como vigentes
        // cuando la consulta falla.

        setResumenRecoleccion(null);
        setErrorResumen(true);
      } finally {
        setCargandoResumen(false);
      }
    }, []);

  // ====================================================
  // MÉTRICAS DEL DASHBOARD
  // ====================================================

  const metrics = mockMetrics.map((metric) => {
    if (
      metric.id !== "month" &&
      metric.id !== "year"
    ) {
      return metric;
    }

    const summary =
      resumenRecoleccion?.[
        metric.id
      ]?.summary;

    if (cargandoResumen) {
      return {
        ...metric,
        value: "Cargando...",
        subtitle:
          "Consultando recolecciones",
      };
    }

    if (errorResumen || !summary) {
      return {
        ...metric,
        value: "No disponible",
        subtitle:
          "No fue posible consultar las recolecciones",
      };
    }

    const total =
      summary.totalCollected;

    const count =
      summary.totalCollections;

    if (
      !esNumeroValido(total) ||
      !esNumeroValido(count)
    ) {
      return {
        ...metric,
        value: "No disponible",
        subtitle:
          "Datos de recolección no válidos",
      };
    }

    return {
      ...metric,

      value: `${total.toLocaleString(
        "es-GT",
        {
          maximumFractionDigits: 2,
        }
      )} lb`,

      subtitle: `${count.toLocaleString(
        "es-GT"
      )} recolecciones`,
    };
  });

  // ====================================================
  // CONSULTAR CONTENEDORES
  // ====================================================

  const cargarContenedores =
    useCallback(async () => {
      try {
        const response = await apiClient.get(
          "/contenedores"
        );

        if (
          !Array.isArray(response.data)
        ) {
          throw new Error(
            "La respuesta de contenedores no es válida."
          );
        }

        setContenedoresBackend(
          response.data
        );
      } catch (error) {
        console.error(
          "Error consultando contenedores:",
          error
        );

        // No conservar lecturas anteriores
        // como si continuaran vigentes.

        setContenedoresBackend([]);
      }
    }, []);

  // ====================================================
  // CONSULTAR CONFIGURACIÓN DE ALERTAS
  // ====================================================

  const cargarConfiguracion =
    useCallback(async () => {
      try {
        const response = await apiClient.get(
          "/configuracion-alertas"
        );

        const configuracion =
          response.data?.configuracion;

        const primerAviso = Number(
          configuracion?.primer_aviso_pct
        );

        const segundoAviso = Number(
          configuracion?.segundo_aviso_pct
        );

        if (
          response.data?.success !== true ||
          ![40, 50, 60].includes(
            primerAviso
          ) ||
          ![70, 80, 90].includes(
            segundoAviso
          ) ||
          primerAviso >= segundoAviso
        ) {
          throw new Error(
            "La configuración de alertas no es válida."
          );
        }

        setConfiguracionAlertas({
          primer_aviso_pct:
            primerAviso,

          segundo_aviso_pct:
            segundoAviso,

          activa:
            configuracion.activa === true,
        });
      } catch (error) {
        console.error(
          "Error consultando configuración de alertas:",
          error
        );

        // No inventar umbrales
        // si falla la consulta.

        setConfiguracionAlertas(null);
      }
    }, []);

  // ====================================================
  // ACTUALIZACIÓN PERIÓDICA
  // ====================================================

  useEffect(() => {
    cargarContenedores();

    cargarConfiguracion();

    cargarResumenRecoleccion();

    const intervaloNiveles = setInterval(
      () => {
        if (!document.hidden) {
          cargarContenedores();
        }
      },
      NIVEL_REFRESH_MS
    );

    const intervaloConfiguracion =
      setInterval(() => {
        if (!document.hidden) {
          cargarConfiguracion();
        }
      }, CONFIGURACION_REFRESH_MS);

    const actualizarAlVolver = () => {
      if (!document.hidden) {
        cargarContenedores();

        cargarConfiguracion();

        cargarResumenRecoleccion();
      }
    };

    document.addEventListener(
      "visibilitychange",
      actualizarAlVolver
    );

    return () => {
      clearInterval(
        intervaloNiveles
      );

      clearInterval(
        intervaloConfiguracion
      );

      document.removeEventListener(
        "visibilitychange",
        actualizarAlVolver
      );
    };
  }, [
    cargarContenedores,
    cargarConfiguracion,
    cargarResumenRecoleccion,
  ]);

  // ====================================================
  // DATOS PARA TARJETA Y MODAL DE CONTENEDORES
  // ====================================================

  const contenedores =
    TIPOS_CONTENEDOR.map((tipo) => {
      // Identificar por tipo real de residuo,
      // no por coincidencias en el nombre.

      const contenedor =
        contenedoresBackend.find(
          (item) =>
            Number(
              item.id_tipo_residuo
            ) ===
            tipo.idTipoResiduo
        );

      const percentage =
        obtenerPorcentaje(
          contenedor
        );

      const estado =
        obtenerEstadoVisual(
          percentage,
          configuracionAlertas
        );

      return {
        id:
          contenedor?.id_contenedor ??
          tipo.type,

        name: tipo.name,

        type: tipo.type,

        percentage,

        status: estado.status,

        color: estado.color,

        requiereAtencion:
          estado.requiereAtencion,

        warningThreshold:
          configuracionAlertas
            ?.primer_aviso_pct ?? "--",

        criticalThreshold:
          configuracionAlertas
            ?.segundo_aviso_pct ?? "--",

        lastUpdate:
          formatearActualizacion(
            contenedor
              ?.nivel_actualizado_en
          ),
      };
    });

  const monitored =
    contenedores.filter(
      (contenedor) =>
        contenedor.percentage !== null
    ).length;

  const attention =
    contenedores.filter(
      (contenedor) =>
        contenedor.requiereAtencion
    ).length;

  // ====================================================
  // CONTROL DE MODALES
  // ====================================================

  const openModal = (modalId) => {
    setActiveModalId(modalId);
  };

  const closeModal = () => {
    setActiveModalId(null);
  };

  const handleMetricClick = (
    metricId
  ) => {
    const modalId =
      metricModalMap[metricId];

    if (modalId) {
      openModal(modalId);
    }
  };

  // ====================================================
  // BOTÓN: IR A NUEVO REGISTRO
  // ====================================================

  const handleNewRecord = () => {
    if (
      typeof onNavigate !== "function"
    ) {
      console.error(
        "Navegación interna no disponible."
      );

      return;
    }

    closeModal();

    onNavigate(
      "/control-dsh/nuevo-registro"
    );
  };

  // ====================================================
  // BOTÓN: IR A HISTORIAL DE RECOLECCIÓN
  // ====================================================

  const handleHistory = () => {
    if (
      typeof onNavigate !== "function"
    ) {
      console.error(
        "Navegación interna no disponible."
      );

      return;
    }

    closeModal();

    onNavigate(
      "/control-dsh/historial"
    );
  };

  // ====================================================
  // INTERFAZ
  // ====================================================

  return (
    <>
      <main className="dashboard-wrap">
        <section
          className="dashboard-summary-grid"
          aria-label="Resumen general del sistema"
        >
          <ContainerStatusCard
            monitored={monitored}
            attention={attention}
            containers={contenedores}
            onClick={() =>
              openModal(
                DASHBOARD_MODAL_IDS
                  .CONTAINER_STATUS
              )
            }
          />

          <DashboardMetricsSection
            metrics={metrics}
            interactiveMetricIds={[
              "prediction",
              "month",
              "year",
            ]}
            onMetricClick={
              handleMetricClick
            }
          />
        </section>

        <section
          className="dashboard-analytics-grid"
          aria-label="Análisis de residuos"
        >
          <WasteDistributionCard
            distribution={
              resumenRecoleccion
                ?.distribution
            }
            loading={
              cargandoResumen
            }
            error={
              errorResumen
            }
          />

          <MonthlyTrendCard
            monthlyTrend={
              monthlyTrend
            }
          />
        </section>
      </main>

      <DashboardModalManager
        activeModalId={
          activeModalId
        }
        onClose={
          closeModal
        }
        containerStatus={
          contenedores
        }
        onNewRecord={
          handleNewRecord
        }
        onHistory={
          handleHistory
        }
        collectionSummary={
          resumenRecoleccion
        }
        collectionLoading={
          cargandoResumen
        }
        collectionError={
          errorResumen
        }
      />
    </>
  );
};

export default Dashboard;
