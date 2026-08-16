export const dashboardMockData = {
  containers: {
    monitored: 2,
    normal: 1,
    attention: 0,
    critical: 1,

    items: [
      {
        id: 1,
        type: "bioinfeccioso",
        name: "Bioinfeccioso",
        percentage: 82,
        status: "Requiere recolección",
        statusType: "critical",
        color: "red",
      },
      {
        id: 2,
        type: "punzocortante",
        name: "Punzocortante",
        percentage: 40,
        status: "Nivel normal",
        statusType: "normal",
        color: "green",
      },
    ],
  },

  metrics: [
    {
      id: "prediction",
      title: "Predicción de llenado",
      icon: "prediction",
      iconColor: "purple",
      value: "2 días",
      valueColor: "purple",
      subtitle: "Para alcanzar nivel crítico",
    },
    {
      id: "month",
      title: "Resumen recolección",
      icon: "weight",
      iconColor: "green",
      value: "3,518 lb",
      valueColor: "green",
      subtitle: "8 recolecciones",
    },
  
    {
      id: "year",
      title: "Recolectado este año",
      icon: "calendar",
      iconColor: "orange",
      value: "3,842 lb",
      valueColor: "orange",
      subtitle: "Total acumulado",
    },
  ],

  distribution: {
    period: "Marzo 2026",
    total: 3518,

    items: [
      {
        id: "bioinfeccioso",
        name: "Bioinfeccioso",
        value: 2750,
        percentage: 78,
        color: "red",
      },
      {
        id: "punzocortante",
        name: "Punzocortante",
        value: 768,
        percentage: 22,
        color: "blue",
      },
    ],

    insight: "La mayor generación este mes proviene del bioinfeccioso.",
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
        data: [
          2300,
          2450,
          2980,
          2750,
          2900,
          3100,
          3250,
          3400,
          3200,
          3600,
          3900,
          4200,
        ],
      },
      {
        id: "punzocortante",
        name: "Punzocortante",
        data: [
          600,
          650,
          700,
          620,
          680,
          720,
          750,
          770,
          730,
          780,
          850,
          900,
        ],
      },
    ],

    insight: "Bioinfeccioso aumentó 18 % respecto al mes anterior.",
  },
};