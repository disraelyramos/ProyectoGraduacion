export const dashboardModalMockData = {
  containerStatus: {
    containers: [
      {
        id: "bioinfeccioso",
        name: "Bioinfeccioso",
        warningThreshold: 60,
        criticalThreshold: 80,
        lastUpdate: "Hace 1 min",
      },
      {
        id: "punzocortante",
        name: "Punzocortante",
        warningThreshold: 50,
        criticalThreshold: 70,
        lastUpdate: "Hace 1 min",
      },
    ],
  },

  fillingPrediction: {
    containers: [
      {
        id: "bioinfeccioso",
        name: "Bioinfeccioso",
        predictedLevel: 90,
        estimatedTime: "En 6 horas",
        risk: "Alto",
        riskColor: "red",
        recommendedAction: "Programar recolección hoy",
      },
      {
        id: "punzocortante",
        name: "Punzocortante",
        predictedLevel: 70,
        estimatedTime: "En 2 días",
        risk: "Preventivo",
        riskColor: "orange",
        recommendedAction: "Preparar próxima recolección",
      },
    ],
  },
monthlyCollection: {
  month: {
    label: "Este mes",

    summary: {
      totalCollected: 3518,
      totalCollections: 8,
    },

    containers: [
      {
        id: "bioinfeccioso",
        name: "Bioinfeccioso",
        collected: 2750,
        collections: 5,
        averagePerCollection: 550,
        lastCollection: "Hace 2 días",
      },
      {
        id: "punzocortante",
        name: "Punzocortante",
        collected: 768,
        collections: 3,
        averagePerCollection: 256,
        lastCollection: "Hace 1 día",
      },
    ],
  },

  week: {
    label: "Esta semana",

    summary: {
      totalCollected: 1100,
      totalCollections: 3,
    },

    containers: [
      {
        id: "bioinfeccioso",
        name: "Bioinfeccioso",
        collected: 820,
        collections: 2,
        averagePerCollection: 410,
        lastCollection: "Hoy",
      },
      {
        id: "punzocortante",
        name: "Punzocortante",
        collected: 280,
        collections: 1,
        averagePerCollection: 280,
        lastCollection: "Hace 2 días",
      },
    ],
  },
},
yearlyCollection: {
  summary: {
    totalCollected: 37370,
    totalCollections: 83,
    monthlyAverage: 3114,
  },

  containers: [
    {
      id: "bioinfeccioso",
      name: "Bioinfeccioso",
      collected: 28450,
      collections: 52,
      averagePerCollection: 547,
      monthlyAverage: 2371,
    },
    {
      id: "punzocortante",
      name: "Punzocortante",
      collected: 8920,
      collections: 31,
      averagePerCollection: 288,
      monthlyAverage: 743,
    },
  ],
},
};