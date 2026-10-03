
export const dashboardMockData = {
  // ======================================================
  // PREDICCIÓN DE LLENADO
  // Pendiente de integrar Machine Learning.
  // ======================================================

  metrics: [
    {
      id: "prediction",
      title: "Predicción de llenado",
      icon: "prediction",
      iconColor: "purple",
      value: "No disponible",
      valueColor: "purple",
      subtitle: "Pendiente de predicción",
    },

    {
      id: "month",
      title: "Resumen recolección",
      icon: "weight",
      iconColor: "green",
      value: "Cargando...",
      valueColor: "green",
      subtitle: "Consultando recolecciones",
    },

    {
      id: "year",
      title: "Recolectado este año",
      icon: "calendar",
      iconColor: "orange",
      value: "Cargando...",
      valueColor: "orange",
      subtitle: "Consultando recolecciones",
    },
  ],

  // ======================================================
  // DISTRIBUCIÓN DEL RESIDUO
  // Pendiente de conexión al backend.
  // ======================================================

  distribution: {
    period: "Este mes",
    total: 0,
    items: [
      {
        id: "bioinfeccioso",
        name: "Bioinfeccioso",
        value: 0,
        percentage: 0,
        color: "red",
      },
      {
        id: "punzocortante",
        name: "Punzocortante",
        value: 0,
        percentage: 0,
        color: "blue",
      },
    ],
    insight: "Datos pendientes de consulta.",
  },

  // ======================================================
  // TENDENCIA MENSUAL
  // Pendiente de conexión al backend.
  // ======================================================

  monthlyTrend: {
    period: "Este año",

    categories: [
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ],

    series: [
      {
        id: "bioinfeccioso",
        name: "Bioinfeccioso",
        data: Array(12).fill(0),
      },
      {
        id: "punzocortante",
        name: "Punzocortante",
        data: Array(12).fill(0),
      },
    ],

    insight: "Datos pendientes de consulta.",
  },
};
