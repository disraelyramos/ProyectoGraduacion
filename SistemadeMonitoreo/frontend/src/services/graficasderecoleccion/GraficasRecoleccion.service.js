// frontend/src/services/graficasderecoleccion/GraficasRecoleccion.service.js

import apiClient from "../../utils/apiClient";

// ======================================================
// CONSTANTES
// ======================================================

const EXPORT_TIMEOUT_MS = 60_000;

// ======================================================
// OBTENER AÑOS DISPONIBLES
//
// El backend consulta PostgreSQL para determinar:
//
// - Año de la primera recolección.
// - Año actual en Guatemala.
// - Lista de años permitidos.
//
// No se generan años desde el frontend.
// No se permiten años futuros.
// ======================================================

export async function obtenerAniosDisponibles() {

  const response = await apiClient.get(
    "/graficas-recoleccion/anios-disponibles"
  );

  const resultado = response.data;

  // ====================================================
  // VALIDAR RESPUESTA
  // ====================================================

  if (
    !resultado?.success ||
    !resultado?.data ||
    !Array.isArray(resultado.data.anios)
  ) {
    throw new Error(
      "No fue posible obtener los años disponibles."
    );
  }

  return {
    anioInicial:
      resultado.data.anioInicial,

    anioActual:
      resultado.data.anioActual,

    anios:
      resultado.data.anios,
  };
}

// ======================================================
// OBTENER GRÁFICAS CUATRIMESTRALES
//
// El frontend envía únicamente:
//
// - anio
// - cuatrimestre
//
// El backend valida y construye:
//
// - Meses.
// - Semanas.
// - Series.
// - Totales.
// - Promedios.
// - Snapshot de exportación.
// ======================================================

export async function obtenerGraficasCuatrimestrales({
  anio,
  cuatrimestre,
}) {

  const response = await apiClient.get(
    "/graficas-recoleccion/cuatrimestral",
    {
      params: {
        anio,
        cuatrimestre,
      },
    }
  );

  return response.data;
}

// ======================================================
// OBTENER PDF
//
// Para exportar solamente enviamos exportId.
// No enviamos datos calculados desde React.
// ======================================================

export async function obtenerPdfCuatrimestral(
  exportId
) {

  const response = await apiClient.get(
    "/graficas-recoleccion/cuatrimestral/export/pdf",
    {
      params: {
        exportId,
      },

      responseType: "blob",

      timeout: EXPORT_TIMEOUT_MS,
    }
  );

  return response.data;
}

// ======================================================
// OBTENER EXCEL
//
// Para exportar solamente enviamos exportId.
// ======================================================

export async function obtenerExcelCuatrimestral(
  exportId
) {

  const response = await apiClient.get(
    "/graficas-recoleccion/cuatrimestral/export/excel",
    {
      params: {
        exportId,
      },

      responseType: "blob",

      timeout: EXPORT_TIMEOUT_MS,
    }
  );

  return response.data;
}

// ======================================================
// NORMALIZAR ERRORES DEL BACKEND
//
// Los endpoints normales devuelven JSON.
//
// Las exportaciones utilizan responseType: "blob".
// Cuando ocurre un error, recuperamos el mensaje
// para mostrarlo correctamente mediante SweetAlert2.
// ======================================================

export async function normalizarErrorApi(
  error
) {

  const status =
    Number(error?.response?.status) || 500;

  let data =
    error?.response?.data;

  // ====================================================
  // ERROR RECIBIDO COMO BLOB
  // ====================================================

  if (
    typeof Blob !== "undefined" &&
    data instanceof Blob
  ) {

    try {

      const texto =
        await data.text();

      if (
        texto &&
        texto.trim()
      ) {

        try {

          data =
            JSON.parse(texto);

        } catch {

          data = {
            message: texto.trim(),
          };
        }

      } else {

        data = null;
      }

    } catch {

      data = null;
    }
  }

  // ====================================================
  // ERROR RECIBIDO COMO STRING
  // ====================================================

  if (
    typeof data === "string"
  ) {

    try {

      data =
        JSON.parse(data);

    } catch {

      data = {
        message: data,
      };
    }
  }

  // ====================================================
  // ERROR SIN RESPUESTA VÁLIDA
  // ====================================================

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {

    data = {
      message:
        error?.code === "ECONNABORTED"
          ? "La solicitud tardó demasiado tiempo. Intente nuevamente."
          : error?.message ||
            "No fue posible comunicarse con el servidor.",
    };
  }

  return {
    status,
    data,
  };
}