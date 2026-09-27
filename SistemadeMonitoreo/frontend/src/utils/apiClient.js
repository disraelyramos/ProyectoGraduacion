import axios from "axios";

import {
  showSessionExpiredAlert,
} from "./alerts";


// ======================================================
// URL DEL BACKEND
// ======================================================
//
// Se configura desde el .env del FRONTEND.
//
// VITE_API_URL debe contener la URL del backend,
// sin /api al final.
//
// No se queman direcciones locales ni de producción.
// ======================================================

const API_URL =
  import.meta.env.VITE_API_URL;


// ======================================================
// VALIDAR CONFIGURACIÓN
// ======================================================

if (
  !API_URL ||
  typeof API_URL !== "string" ||
  !API_URL.trim()
) {

  throw new Error(
    "Falta configurar VITE_API_URL en el archivo .env del frontend."
  );
}


// ======================================================
// NORMALIZAR URL
// ======================================================

const BACKEND_URL =
  API_URL.trim().replace(/\/+$/, "");


// ======================================================
// CLIENTE AXIOS
// ======================================================

const apiClient = axios.create({

  baseURL:
    `${BACKEND_URL}/api`,

  timeout:
    15000,

});


// ======================================================
// INTERCEPTOR DE REQUEST
// ======================================================
//
// Adjunta automáticamente el JWT.
//
// Los componentes no necesitan repetir:
//
// localStorage.getItem("token")
// Authorization: Bearer ...
// ======================================================

apiClient.interceptors.request.use(

  (config) => {

    const token =
      localStorage.getItem(
        "token"
      );


    if (token) {

      config.headers.Authorization =
        `Bearer ${token}`;
    }


    return config;

  },

  (error) =>
    Promise.reject(error)

);


// ======================================================
// INTERCEPTOR DE RESPONSE
// ======================================================
//
// 401:
// Sesión no válida.
// Se muestra una sola alerta y el usuario
// regresa al login después de pulsar Aceptar.
//
// 403:
// Usuario autenticado sin permisos.
// No se elimina el token.
//
// Los demás errores se entregan al componente
// para utilizar showBackendAlert.
// ======================================================

apiClient.interceptors.response.use(

  (response) =>
    response,


  (error) => {

    const status =
      error?.response?.status;


    /*
     * Verificamos si esta solicitud utilizó
     * un token de autenticación.
     *
     * Esto evita tratar un error 401 de un
     * inicio de sesión sin token como si fuera
     * una sesión que acaba de caducar.
     */

    const tokenEnviado =
      error?.config?.headers?.get?.(
        "Authorization"
      ) ||
      error?.config?.headers
        ?.Authorization;


    // ==================================================
    // SESIÓN CADUCADA
    // ==================================================

    if (
      status === 401 &&
      tokenEnviado
    ) {

      /*
       * alerts.js ya controla que no se
       * abran múltiples modales de sesión.
       *
       * También elimina el token y redirige
       * únicamente después de Aceptar.
       */

      showSessionExpiredAlert();
    }


    /*
     * No interceptamos el 403 para cerrar sesión.
     *
     * El componente mostrará el mensaje
     * correspondiente con showBackendAlert.
     */


    return Promise.reject(
      error
    );

  }

);


export default apiClient;