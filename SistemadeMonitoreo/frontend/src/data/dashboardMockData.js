export const dashboardMockData = {
  // Los valores reales se reciben del backend.
  metrics: [
    {
      id: "prediction",
      title: "Predicción de llenado",
      icon: "prediction",
      iconColor: "purple",
      value: "No disponible",
      valueColor: "purple",
      subtitle: "Consultando predicción",
    },
    {
      id: "month",
      title: "Recolectado esta semana",
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