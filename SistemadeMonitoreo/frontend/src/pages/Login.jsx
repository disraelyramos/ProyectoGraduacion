import React, { useState, useEffect } from "react";
import { FaUser, FaLock } from "react-icons/fa";
import { toast } from "react-toastify";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../styles/login.css";

const Login = () => {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");
  const [tiempoRestante, setTiempoRestante] = useState(0); // ⏱ contador
  const navigate = useNavigate();

  // 🔹 Manejo del contador regresivo
  useEffect(() => {
    let intervalo;
    if (tiempoRestante > 0) {
      intervalo = setInterval(() => {
        setTiempoRestante((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(intervalo);
  }, [tiempoRestante]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!usuario || !contrasena) {
      toast.error("Por favor complete todos los campos");
      return;
    }

    try {
      const res = await axios.post("http://localhost:3001/api/auth/login", {
        usuario,
        contrasena,
      });

      localStorage.setItem("token", res.data.token);
      toast.success("Inicio de sesión exitoso ");
      navigate("/dashboard");

    } catch (err) {
      if (err.response && err.response.data) {
        const mensaje = err.response.data.message || "Error en la autenticación";
        toast.error(mensaje);

        // Si el backend devuelve que está bloqueado, calculamos segundos exactos
        if (err.response.data.bloqueado_hasta) {
          const finBloqueo = new Date(err.response.data.bloqueado_hasta).getTime();
          const ahora = Date.now();
          const diffSegundos = Math.max(Math.floor((finBloqueo - ahora) / 1000), 0);
          setTiempoRestante(diffSegundos);
        }
      } else {
        toast.error("Error en la conexión con el servidor");
      }
    }
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
        <h2 className="login-title">Iniciar Sesión</h2>
        <form onSubmit={handleSubmit}>
          {/* Usuario */}
          <div className="form-floating">
            <input
              type="text"
              id="usuario"
              className="form-control"
              placeholder="Usuario"
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              required
              disabled={tiempoRestante > 0} // Bloquear usuario durante el bloqueo
            />
            <label htmlFor="usuario">
              <FaUser /> Usuario
            </label>
          </div>

          {/* Contraseña */}
          <div className="form-floating">
            <input
              type="password"
              id="contrasena"
              className="form-control"
              placeholder="Contraseña"
              value={contrasena}
              onChange={(e) => setContrasena(e.target.value)}
              required
              disabled={tiempoRestante > 0} // Bloquear contraseña durante el bloqueo
            />
            <label htmlFor="contrasena">
              <FaLock /> Contraseña
            </label>
          </div>

          {/* Tiempo de bloqueo visible en rojo */}
          {tiempoRestante > 0 && (
            <div className="alert alert-danger text-center mt-2">
              Intente de nuevo en <strong>{tiempoRestante}</strong> segundos 
            </div>
          )}

          {/* Botón */}
          <button type="submit" className="btn-login" disabled={tiempoRestante > 0}>
            Iniciar Sesión
          </button>

          {/* Link a recuperar contraseña */}
          <Link to="/recuperar-contrasena" className="forgot-password">
            ¿Olvidaste la contraseña?
          </Link>
        </form>
      </div>
    </div>
  );
};

export default Login;
