// frontend/src/services/graficasderecoleccion/GraficasRecoleccion.service.js

import apiClient from "../../utils/apiClient";


/* =========================================================
   CONSTANTES
   ========================================================= */

const EXPORT_TIMEOUT_MS =
  60_000;


/* =========================================================
   OBTENER REPORTE CUATRIMESTRAL

   El frontend únicamente envía criterios:

   - anio
   - cuatrimestre

   El backend valida y construye:
   - meses
   - semanas
   - series
   - totales
   - promedios
   - export_id
   ========================================================= */

export async function obtenerGraficasCuatrimestrales({
  anio,
  cuatrimestre,
}) {
  const response =
    await apiClient.get(
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


/* =========================================================
   OBTENER PDF

   IMPORTANTE:

   Para exportar NO enviamos:
   - año
   - cuatrimestre
   - series
   - totales
   - promedios

   Solamente exportId.
   ========================================================= */

export async function obtenerPdfCuatrimestral(
  exportId
) {
  const response =
    await apiClient.get(
      "/graficas-recoleccion/cuatrimestral/export/pdf",
      {
        params: {
          exportId,
        },

        responseType:
          "blob",

        timeout:
          EXPORT_TIMEOUT_MS,
      }
    );


  return response.data;
}


/* =========================================================
   OBTENER EXCEL
   ========================================================= */

export async function obtenerExcelCuatrimestral(
  exportId
) {
  const response =
    await apiClient.get(
      "/graficas-recoleccion/cuatrimestral/export/excel",
      {
        params: {
          exportId,
        },

        responseType:
          "blob",

        timeout:
          EXPORT_TIMEOUT_MS,
      }
    );


  return response.data;
}


/* =========================================================
   NORMALIZAR ERROR DEL BACKEND

   Los endpoints normales devuelven JSON.

   PDF y Excel utilizan responseType: "blob".
   Cuando backend devuelve un 400/410/500, Axios puede
   entregar también ese JSON convertido a Blob.

   Aquí lo recuperamos para que SweetAlert2 pueda mostrar:

   data.message
   data.code
   data.field
   ========================================================= */

export async function normalizarErrorApi(
  error
) {
  const status =
    Number(
      error?.response?.status
    ) || 500;


  let data =
    error?.response?.data;


  /* =======================================================
     ERROR COMO BLOB
     ======================================================= */

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
            JSON.parse(
              texto
            );

        } catch {
          data = {
            message:
              texto.trim(),
          };
        }

      } else {
        data =
          null;
      }

    } catch {
      data =
        null;
    }
  }


  /* =======================================================
     ERROR COMO STRING
     ======================================================= */

  if (
    typeof data ===
    "string"
  ) {
    try {
      data =
        JSON.parse(
          data
        );

    } catch {
      data = {
        message:
          data,
      };
    }
  }


  /* =======================================================
     ERROR SIN RESPUESTA DEL SERVIDOR
     ======================================================= */

  if (
    !data ||
    typeof data !==
      "object" ||
    Array.isArray(
      data
    )
  ) {
    data = {
      message:
        error?.code ===
        "ECONNABORTED"
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