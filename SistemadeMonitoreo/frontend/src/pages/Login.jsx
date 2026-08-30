import React, { useState, useEffect } from "react";
import {
  FaUser,
  FaLock,
} from "react-icons/fa";
import { toast } from "react-toastify";
import {
  Link,
  useNavigate,
} from "react-router-dom";
import axios from "axios";

import "../styles/login.css";

/**
 * =====================================================
 * CONFIGURACIÓN DE ENTORNO
 * =====================================================
 *
 * Esta URL viene del .env del FRONTEND:
 * VITE_API_URL
 */
const API_URL = import.meta.env.VITE_API_URL;

const Login = () => {
  const [usuario, setUsuario] = useState("");
  const [contrasena, setContrasena] = useState("");

  const [
    tiempoRestante,
    setTiempoRestante,
  ] = useState(0);

  const navigate = useNavigate();

  /**
   * =====================================================
   * CONTADOR REGRESIVO DE BLOQUEO
   * =====================================================
   */
  useEffect(() => {
    let intervalo;

    if (tiempoRestante > 0) {
      intervalo = setInterval(() => {
        setTiempoRestante((prev) =>
          prev > 0
            ? prev - 1
            : 0
        );
      }, 1000);
    }

    return () => {
      clearInterval(intervalo);
    };
  }, [tiempoRestante]);

  /**
   * =====================================================
   * FORMATEAR SEGUNDOS A MM:SS
   * =====================================================
   */
  const formatearTiempo = (segundos) => {
    const minutos =
      Math.floor(segundos / 60);

    const seg =
      segundos % 60;

    return `${minutos}:${
      seg < 10
        ? `0${seg}`
        : seg
    }`;
  };

  /**
   * =====================================================
   * LOGIN
   * =====================================================
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!usuario || !contrasena) {
      toast.error(
        "Por favor complete todos los campos"
      );

      return;
    }

    try {
      const res = await axios.post(
        `${API_URL}/api/auth/login`,
        {
          usuario,
          contrasena,
        }
      );

      /**
       * =================================================
       * CAMBIO DE CONTRASEÑA REQUERIDO
       * =================================================
       */
      if (res.data.requiereCambio) {
        if (res.data.token) {
          localStorage.setItem(
            "token",
            res.data.token
          );
        }

        if (
          res.data.tipo ===
          "reconfirmacion"
        ) {
          navigate(
            "/reconfirmar-contrasena",
            {
              state: {
                usuario,
              },
            }
          );
        } else {
          navigate(
            "/contrasena-obligatoria",
            {
              state: {
                usuario,
              },
            }
          );
        }

        return;
      }

      /**
       * =================================================
       * LOGIN NORMAL
       * =================================================
       */
      localStorage.setItem(
        "token",
        res.data.token
      );

      toast.success(
        "Inicio de sesión exitoso"
      );

      navigate("/dashboard");

    } catch (err) {

      /**
       * =================================================
       * FALLBACK CAMBIO DE CONTRASEÑA
       * =================================================
       */
      if (
        err?.response?.data
          ?.requiereCambio
      ) {
        if (
          err.response.data.token
        ) {
          localStorage.setItem(
            "token",
            err.response.data.token
          );
        }

        if (
          err.response.data.tipo ===
          "reconfirmacion"
        ) {
          navigate(
            "/reconfirmar-contrasena",
            {
              state: {
                usuario,
              },
            }
          );
        } else {
          navigate(
            "/contrasena-obligatoria",
            {
              state: {
                usuario,
              },
            }
          );
        }

        return;
      }

      /**
       * =================================================
       * ERRORES DEL BACKEND
       * =================================================
       */
      if (
        err.response &&
        err.response.data
      ) {
        const mensaje =
          err.response.data.message ||
          "Error en la autenticación";

        toast.error(mensaje);

        if (
          err.response.data
            .bloqueado_hasta
        ) {
          const finBloqueo =
            new Date(
              err.response.data
                .bloqueado_hasta
            ).getTime();

          const ahora =
            Date.now();

          const diffSegundos =
            Math.max(
              Math.floor(
                (
                  finBloqueo -
                  ahora
                ) / 1000
              ),
              0
            );

          setTiempoRestante(
            diffSegundos
          );
        }
      } else {
        toast.error(
          "Error en la conexión con el servidor"
        );
      }
    }
  };

  /**
   * =====================================================
   * VISTA
   * =====================================================
   */
  return (
    <main className="login-page">

      <section className="login-container">

        {/* ================================================
            IDENTIDAD DEL SISTEMA
        ================================================ */}

        <div className="brand-section">

          <h1 className="brand-title">
            Sistema de Monitoreo
            Bioinfeccioso
          </h1>

        </div>


        {/* ================================================
            FORMULARIO
        ================================================ */}

        <div className="login-form-section">

          <h2 className="login-title">
            Iniciar Sesión
          </h2>


          <form
            className="system-form"
            onSubmit={handleSubmit}
          >

            {/* ============================================
                USUARIO
            ============================================ */}

            <div className="system-form-group">

              <label
                htmlFor="usuario"
                className="system-form-label login-field-label"
              >
                <FaUser />

                <span>
                  Usuario
                </span>
              </label>

              <input
                type="text"
                id="usuario"
                className="system-form-control"
                placeholder="Ingrese su usuario"
                value={usuario}
                onChange={(e) =>
                  setUsuario(
                    e.target.value
                  )
                }
                required
                disabled={
                  tiempoRestante > 0
                }
                autoComplete="username"
              />

            </div>


            {/* ============================================
                CONTRASEÑA
            ============================================ */}

            <div className="system-form-group">

              <label
                htmlFor="contrasena"
                className="system-form-label login-field-label"
              >
                <FaLock />

                <span>
                  Contraseña
                </span>
              </label>

              <input
                type="password"
                id="contrasena"
                className="system-form-control"
                placeholder="Ingrese su contraseña"
                value={contrasena}
                onChange={(e) =>
                  setContrasena(
                    e.target.value
                  )
                }
                required
                disabled={
                  tiempoRestante > 0
                }
                autoComplete="current-password"
              />

            </div>


            {/* ============================================
                BLOQUEO TEMPORAL
            ============================================ */}

            {tiempoRestante > 0 && (

              <div
                className="
                  system-alert
                  system-alert-danger
                  login-lockout-alert
                "
                role="alert"
              >
                Intente de nuevo en{" "}

                <strong>
                  {formatearTiempo(
                    tiempoRestante
                  )}
                </strong>
              </div>

            )}


            {/* ============================================
                ACCIÓN PRINCIPAL
            ============================================ */}

            <button
              type="submit"
              className="
                app-btn
                app-btn-primary
                app-btn-block
                btn-login
              "
              disabled={
                tiempoRestante > 0
              }
            >
              Iniciar Sesión
            </button>


            {/* ============================================
                RECUPERAR CONTRASEÑA
            ============================================ */}

            <Link
              to="/recuperar-contrasena"
              className="forgot-password"
            >
              ¿Olvidaste la contraseña?
            </Link>

          </form>

        </div>

      </section>

    </main>
  );
};

export default Login;