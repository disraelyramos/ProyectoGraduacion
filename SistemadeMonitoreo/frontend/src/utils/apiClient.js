// frontend/src/utils/apiClient.js

import axios from "axios";


/* =========================================================
   URL DEL BACKEND
   =========================================================
   Se configura en el .env del FRONTEND.

   Desarrollo:
   VITE_API_URL=http://localhost:3001

   Producción:
   VITE_API_URL=https://tu-backend.up.railway.app

   IMPORTANTE:
   No colocar /api dentro de VITE_API_URL.
   ========================================================= */

const API_URL =
  import.meta.env.VITE_API_URL;


/* =========================================================
   VALIDAR CONFIGURACIÓN
   ========================================================= */

if (!API_URL) {
  throw new Error(
    "Falta configurar VITE_API_URL en el archivo .env del frontend."
  );
}


/* =========================================================
   NORMALIZAR URL
   Evita terminar con //api
   ========================================================= */

const BACKEND_URL =
  API_URL.replace(
    /\/+$/,
    ""
  );


/* =========================================================
   CLIENTE AXIOS
   ========================================================= */

const apiClient =
  axios.create({

    baseURL:
      `${BACKEND_URL}/api`,

    timeout:
      15000,

  });


/* =========================================================
   INTERCEPTOR DE REQUEST
   Adjunta automáticamente el token JWT.
   ========================================================= */

apiClient.interceptors.request.use(

  (config) => {

    const token =
      localStorage.getItem(
        "token"
      );


    if (token) {

      config.headers =
        config.headers || {};


      config.headers.Authorization =
        `Bearer ${token}`;
    }


    return config;
  },


  (error) =>
    Promise.reject(
      error
    )

);


/* =========================================================
   INTERCEPTOR DE RESPONSE
   Manejo centralizado de autenticación.
   ========================================================= */

apiClient.interceptors.response.use(

  (response) =>
    response,


  (error) => {

    const status =
      error?.response?.status;


    /*
     * Se conserva el comportamiento actual:
     * 401 / 403 limpian la sesión.
     *
     * No modificamos esta lógica durante
     * la migración visual/configuración.
     */

    if (
      status === 401 ||
      status === 403
    ) {

      localStorage.removeItem(
        "token"
      );


      /*
       * Evita redirección repetitiva
       * si ya estamos en Login.
       */

      if (
        window.location.pathname !==
        "/"
      ) {

        window.location.href =
          "/";
      }
    }


    return Promise.reject(
      error
    );
  }

);


export default apiClient;