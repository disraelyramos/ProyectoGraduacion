import React, {
  useEffect,
  useState,
} from "react";

import {
  Navigate,
  useLocation,
} from "react-router-dom";

import {
  jwtDecode,
} from "jwt-decode";

import {
  showSessionExpiredAlert,
} from "../utils/alerts";


// ======================================================
// DESTINO EXCLUSIVO DESDE WHATSAPP
// ======================================================

const RUTA_CONSULTA =
  "/consulta-niveles";

const CLAVE_DESTINO =
  "bioinfeccioso_post_login";


// ======================================================
// RUTA PROTEGIDA
// ======================================================

const ProtectedRoute = ({
  children,
}) => {

  const location =
    useLocation();

  const [
    isValid,
    setIsValid,
  ] = useState(null);


  useEffect(() => {

    const token =
      localStorage.getItem(
        "token"
      );


    // ==================================================
    // CONSERVAR DESTINO DE WHATSAPP
    // ==================================================

    const conservarDestino = () => {

      if (
        location.pathname ===
        RUTA_CONSULTA
      ) {

        sessionStorage.setItem(
          CLAVE_DESTINO,
          RUTA_CONSULTA
        );

      }

    };


    // ==================================================
    // SIN SESIÓN
    // ==================================================
    //
    // Si nunca inició sesión, enviamos al Login
    // sin mostrar falsamente "Sesión caducada".
    // ==================================================

    if (!token) {

      conservarDestino();

      setIsValid(false);

      return;

    }


    // ==================================================
    // VERIFICAR TOKEN
    // ==================================================

    try {

      const decoded =
        jwtDecode(token);

      const exp =
        Number(
          decoded?.exp
        );


      if (
        !Number.isFinite(exp) ||
        exp * 1000 <= Date.now()
      ) {

        throw new Error(
          "TOKEN_NO_VALIDO"
        );

      }


      setIsValid(true);

    } catch (error) {

      conservarDestino();

      /*
       * alerts.js ya elimina el token,
       * muestra una sola alerta y envía
       * al Login al pulsar Aceptar.
       */

      showSessionExpiredAlert();

      setIsValid(false);

    }

  }, [
    location.pathname,
  ]);


  // ====================================================
  // VALIDANDO SESIÓN
  // ====================================================

  if (
    isValid === null
  ) {

    return null;

  }


  // ====================================================
  // SIN ACCESO
  // ====================================================

  if (!isValid) {

    return (

      <Navigate

        to="/"

        replace

        state={{

          from:
            location.pathname === RUTA_CONSULTA
              ? RUTA_CONSULTA
              : null,

        }}

      />

    );

  }


  return children;

};


export default ProtectedRoute;