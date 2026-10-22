"use strict";

// ======================================================
// RESUMEN DE PREDICCIONES PARA KPI
// ======================================================
// Este servicio NO ejecuta Machine Learning.
// Solo recibe las predicciones ya calculadas y validadas
// por prediccion.service.js, y selecciona la que debe
// mostrarse en la KPI "Predicción de llenado".
// ======================================================

function esPrediccionDisponible(item) {
  return (
    item &&
    typeof item === "object" &&
    item.estado === "OK" &&
    typeof item.dias_para_alto === "number" &&
    Number.isFinite(item.dias_para_alto) &&
    item.dias_para_alto >= 0 &&
    item.dias_para_alto <= 3650 &&
    Number.isInteger(item.ciclos_utilizados) &&
    item.ciclos_utilizados >= 2 &&
    typeof item.tiempo_para_alto_texto === "string" &&
    item.tiempo_para_alto_texto.trim().length > 0 &&
    ["BAJO", "MEDIO", "ALTO"].includes(item.riesgo)
  );
}

// ======================================================
// CONSTRUIR RESUMEN KPI
// ======================================================

function construirResumenPredicciones(predicciones) {
  if (!Array.isArray(predicciones)) {
    throw new Error(
      "Las predicciones deben ser un arreglo."
    );
  }

  const disponibles =
    predicciones.filter(
      esPrediccionDisponible
    );

  // ================================================
  // SIN DATOS SUFICIENTES
  // ================================================
  if (disponibles.length === 0) {
    return {
      predicciones,
      kpi: {
        disponible: false,
        value: "No disponible",
        subtitle: "Datos insuficientes",
        contenedor_id: null,
        riesgo: null,
      },
    };
  }

  // ================================================
  // CONTENEDOR MÁS PRÓXIMO AL UMBRAL ALTO
  // ================================================
  const masProximo =
    disponibles.reduce(
      (menor, actual) =>
        actual.dias_para_alto <
        menor.dias_para_alto
          ? actual
          : menor
    );

  return {
    predicciones,
    kpi: {
      disponible: true,
      value:
        masProximo.tiempo_para_alto_texto,
      subtitle: `Riesgo ${String(
        masProximo.riesgo
      ).toLowerCase()}`,
      contenedor_id:
        masProximo.contenedor_id,
      riesgo: masProximo.riesgo,
    },
  };
}

// ======================================================
// EXPORTAR
// ======================================================

module.exports = {
  construirResumenPredicciones,
};