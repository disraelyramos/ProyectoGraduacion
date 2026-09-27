import React from "react";

import {
  BrowserRouter as Router,
  Routes,
  Route,
} from "react-router-dom";

import { ToastContainer } from "react-toastify";

import "react-toastify/dist/ReactToastify.css";

import "./styles/responsive.css";


// ======================================================
// PÁGINAS
// ======================================================

import Login from "./pages/Login";

import RecuperacionContrasena from "./pages/RecuperacionContrasena";

import ResetPassword from "./pages/ResetPassword";

import Dashboard from "./pages/Dashboard";

import ContrasenaObligatoria from "./pages/ContrasenaObligatoria.jsx";

import ReconfirmarContrasena from "./pages/ReconfirmarContrasena.jsx";


// ======================================================
// CONSULTA EXCLUSIVA DE NIVELES
// ======================================================

import ConsultaNiveles from "./pages/controlDSH/ConsultaNiveles";


// ======================================================
// RUTA PROTEGIDA
// ======================================================

import ProtectedRoute from "./components/ProtectedRoute";


// ======================================================
// APP
// ======================================================

function App() {

  return (

    <Router>

      <Routes>

        {/* ==========================================
            AUTENTICACIÓN
        ========================================== */}

        <Route
          path="/"
          element={<Login />}
        />

        <Route
          path="/recuperar-contrasena"
          element={<RecuperacionContrasena />}
        />

        <Route
          path="/reset-password/:token"
          element={<ResetPassword />}
        />

        <Route
          path="/contrasena-obligatoria"
          element={<ContrasenaObligatoria />}
        />

        <Route
          path="/reconfirmar-contrasena"
          element={<ReconfirmarContrasena />}
        />


        {/* ==========================================
            DASHBOARD ADMINISTRATIVO
        ========================================== */}

        <Route

          path="/dashboard"

          element={

            <ProtectedRoute>

              <Dashboard />

            </ProtectedRoute>

          }

        />


        {/* ==========================================
            CONSULTA DE NIVELES DESDE WHATSAPP
        ========================================== */}

        <Route

          path="/consulta-niveles"

          element={

            <ProtectedRoute>

              <ConsultaNiveles />

            </ProtectedRoute>

          }

        />

      </Routes>


      {/* ==========================================
          NOTIFICACIONES EXISTENTES
      ========================================== */}

      <ToastContainer

        position="top-right"

        autoClose={3000}

        hideProgressBar={false}

        newestOnTop={false}

        closeOnClick

        rtl={false}

        pauseOnFocusLoss

        draggable

        pauseOnHover

      />

    </Router>

  );

}

export default App;