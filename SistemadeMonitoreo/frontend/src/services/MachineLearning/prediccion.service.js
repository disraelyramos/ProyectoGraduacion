import apiClient from "../../utils/apiClient";

async function obtenerPredicciones() {
  const response =
    await apiClient.get(
      "/predicciones"
    );

  return response.data;
}

export {
  obtenerPredicciones,
};