import React, { useState } from "react";
import { FaUser } from "react-icons/fa";
import { Link } from "react-router-dom";
import axios from "axios";
import "../styles/login.css";

const RecuperarContrasena = () => {
  const [usuario, setUsuario] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorInput, setErrorInput] = useState(""); // mensaje de error

  const handleSubmit = async (e) => {
    e.preventDefault();

    // 🔹 Validaciones frontend
    if (!usuario.trim()) {
      setErrorInput("Debe ingresar su usuario o correo registrado");
      return;
    }

    if (/^\d+$/.test(usuario)) {
      setErrorInput("El usuario o correo no puede ser solo números");
      return;
    }

    try {
      setLoading(true);
      setErrorInput("");

      const res = await axios.post("http://localhost:3001/api/recuperacion/solicitar", {
        identificador: usuario,
      });

      // ✅ mostrar confirmación en verde
      setErrorInput(""); // limpia error
      alert(res.data.message || "Se enviaron las instrucciones a tu correo");
      setUsuario(""); // limpiar input
    } catch (err) {
      console.error("❌ Error en recuperación:", err);

      if (err.response && err.response.status === 404) {
        setErrorInput("Usuario o correo no encontrado");
      } else {
        setErrorInput("No se pudo procesar la solicitud. Intente de nuevo.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Sección izquierda */}
      <div className="brand-section">
        <h2 className="brand-title">Sistema de Monitoreo Bioinfeccioso</h2>
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
              className={`form-control ${errorInput ? "is-invalid" : ""}`}
              placeholder="Usuario o correo"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              disabled={loading}
            />
            <label htmlFor="usuario">
              <FaUser /> Usuario o Correo
            </label>

            {/* Mensaje de error debajo del input */}
            {errorInput && <div className="invalid-feedback">{errorInput}</div>}
          </div>

          {/* Botón */}
          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Enviando..." : "Enviar Instrucciones"}
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
