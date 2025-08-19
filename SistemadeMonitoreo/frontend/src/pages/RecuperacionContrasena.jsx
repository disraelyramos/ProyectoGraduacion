import React, { useState } from "react";
import { FaUser } from "react-icons/fa";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import "../styles/login.css";

const RecuperarContrasena = () => {
  const [usuario, setUsuario] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!usuario) {
      toast.error("Por favor ingrese su usuario o correo registrado");
      return;
    }

    toast.success("Enviando instrucciones para restablecer contraseña...");
    // Aquí irá la conexión al backend
  };

  return (
    <div className="login-container">
      {/* Sección izquierda */}
      <div className="brand-section">
        <h2 className="brand-title">
          Sistema de Monitoreo Bioinfeccioso
        </h2>
      </div>

      {/* Sección derecha */}
      <div className="login-form-section">
        <h2 className="login-title">Recuperar Contraseña</h2>
        <p className="login-description">
          Ingresa tu usuario o correo electrónico para recibir un enlace de recuperación.
        </p>
        
        <form onSubmit={handleSubmit}>
          {/* Usuario o correo */}
          <div className="form-floating">
            <input
              type="text"
              id="usuario"
              className="form-control"
              placeholder="Usuario o correo"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
            />
            <label htmlFor="usuario">
              <FaUser /> Usuario o Correo
            </label>
          </div>

          {/* Botón */}
          <button type="submit" className="btn-login">
            Enviar Instrucciones
          </button>

          {/* Link para volver al login */}
          <Link to="/" className="forgot-password">
            Volver al inicio de sesión
          </Link>
        </form>
      </div>
    </div>
  );
};

export default RecuperarContrasena;
