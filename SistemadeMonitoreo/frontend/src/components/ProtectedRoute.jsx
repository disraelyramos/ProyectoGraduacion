import React, { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode";
import { toast } from "react-toastify";

const ProtectedRoute = ({ children }) => {
  const [isValid, setIsValid] = useState(null); // null = aún verificando

  useEffect(() => {
    const token = localStorage.getItem("token");

    if (!token) {
      setIsValid(false);
      return;
    }

    try {
      const decoded = jwtDecode(token);
      const now = Date.now() / 1000;

      if (decoded.exp < now) {
        localStorage.removeItem("token");

        //  Mostrar alerta de sesión expirada
        toast.error("Tu sesión ha caducado, vuelve a iniciar sesión ");

        setIsValid(false);
      } else {
        setIsValid(true);
      }
    } catch (err) {
      localStorage.removeItem("token");

      // 🔹 Mostrar alerta de token inválido
      toast.error("Token inválido. Inicia sesión nuevamente ");
      setIsValid(false);
    }
  }, []);

  if (isValid === null) {
    //  pantalla intermedia (spinner invisible para evitar parpadeos)
    return <div style={{ display: "none" }}></div>;
  }

  if (!isValid) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
