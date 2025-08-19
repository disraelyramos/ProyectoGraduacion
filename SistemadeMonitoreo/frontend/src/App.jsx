import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

// Páginas
import Login from "./pages/Login";
import RecuperacionContrasena from "./pages/RecuperacionContrasena";
import Dashboard from "./pages/Dashboard";

// Ruta protegida
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        {/* Ruta principal → Login */}
        <Route path="/" element={<Login />} />

        {/* Ruta de recuperación de contraseña */}
        <Route
          path="/recuperar-contrasena"
          element={<RecuperacionContrasena />}
        />

        {/* Ruta del dashboard (protegida) */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>

      {/* 👇 Contenedor global de Toastify */}
      <ToastContainer
        position="top-right"
        autoClose={3000}   // 3 segundos
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
