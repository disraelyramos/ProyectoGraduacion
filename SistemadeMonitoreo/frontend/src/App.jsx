import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "./styles/responsive.css";

// Páginas
import Login from "./pages/Login";
import RecuperacionContrasena from "./pages/RecuperacionContrasena";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import ContrasenaObligatoria from "./pages/ContrasenaObligatoria.jsx"; // 
import ReconfirmarContrasena from "./pages/ReconfirmarContrasena.jsx"; // 

// Ruta protegida
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />

        <Route
          path="/recuperar-contrasena"
          element={<RecuperacionContrasena />}
        />

        <Route path="/reset-password/:token" element={<ResetPassword />} />

        {/* Cambio obligatorio de contraseña */}
        <Route
          path="/contrasena-obligatoria"
          element={<ContrasenaObligatoria />}
        />

        {/* Reconfirmación por vencimiento */}
        <Route
          path="/reconfirmar-contrasena"
          element={<ReconfirmarContrasena />}
        />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
      </Routes>

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
