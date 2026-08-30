// frontend/src/services/historialcosto/HistorialCosto.service.js

import apiClient from "../../utils/apiClient";


/* =========================================================
   CONSTANTES
   ========================================================= */

const EXPORT_TIMEOUT_MS = 60_000;


/* =========================================================
   CATÁLOGOS
   ========================================================= */

export async function obtenerDistritos() {
  const response =
    await apiClient.get(
      "/control-dsh/catalogos/distritos"
    );

  return response.data;
}


export async function obtenerEmpresas() {
  const response =
    await apiClient.get(
      "/control-dsh/catalogos/empresas"
    );

  return response.data;
}


export async function obtenerContenedores({
  search = "",
  page = 1,
  limit = 50,
} = {}) {
  const response =
    await apiClient.get(
      "/codigo-contenedor",
      {
        params: {
          search,
          page,
          limit,
        },
      }
    );

  return response.data;
}


/* =========================================================
   REPORTE
   ========================================================= */

export async function obtenerReporteCostos(
  params
) {
  const response =
    await apiClient.get(
      "/historial-costo",
      {
        params,
      }
    );

  return response.data;
}


/* =========================================================
   EXPORTAR PDF
   ========================================================= */

export async function obtenerPdfCostos(
  exportId
) {
  const response =
    await apiClient.get(
      "/historial-costo/export/pdf",
      {
        params: {
          exportId,
        },

        responseType:
          "blob",

        /*
          Las exportaciones pueden tardar más que una
          consulta paginada normal.
        */
        timeout:
          EXPORT_TIMEOUT_MS,
      }
    );

  return response.data;
}


/* =========================================================
   EXPORTAR EXCEL
   ========================================================= */

export async function obtenerExcelCostos(
  exportId
) {
  const response =
    await apiClient.get(
      "/historial-costo/export/excel",
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
   NORMALIZAR ERROR

   Devuelve siempre:

   {
     status,
     data
   }

   Compatible directamente con showBackendAlert().
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
     ERROR RECIBIDO COMO BLOB

     PDF y Excel utilizan responseType: "blob".

     Si backend responde JSON 400/410/500, Axios puede
     convertir también ese JSON a Blob.
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
        data = null;
      }

    } catch {
      data = null;
    }
  }


  /* =======================================================
     ERROR STRING
     ======================================================= */

  if (
    typeof data === "string"
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
     ERROR SIN RESPUESTA HTTP

     Ejemplos:
     - servidor no disponible
     - timeout
     - error de red
     ======================================================= */

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
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