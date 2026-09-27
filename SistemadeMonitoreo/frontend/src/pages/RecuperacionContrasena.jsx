import React, {
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  FaEnvelope,
  FaKey,
} from "react-icons/fa";

import {
  toast,
} from "react-toastify";

import apiClient
  from "../utils/apiClient";

import "../styles/login.css";


const RecuperarContrasena = () => {

  const [
    identificador,
    setIdentificador,
  ] =
    useState("");


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  /* =========================================================
     ENVIAR SOLICITUD
     ========================================================= */

  const handleSubmit =
    async (
      event
    ) => {

      event.preventDefault();


      /*
       * Validación solamente de UX.
       *
       * El backend vuelve a validar absolutamente todo.
       */

      if (
        !identificador.trim()
      ) {

        toast.error(
          "Ingrese su usuario o correo electrónico."
        );

        return;
      }


      try {

        setLoading(
          true
        );


        const {
          data,
        } =
          await apiClient.post(
            "/recuperacion/solicitar",
            {
              identificador:
                identificador.trim(),
            }
          );


        toast.success(
          data?.message ||
          "Si la cuenta existe, se enviarán las instrucciones al correo registrado."
        );


      } catch (
        error
      ) {

        console.error(
          "Error solicitando recuperación:",
          error
        );


        const message =
          error
            ?.response
            ?.data
            ?.message ||
          "No fue posible procesar la recuperación de contraseña.";


        toast.error(
          message
        );


      } finally {

        setLoading(
          false
        );
      }
    };


  /* =========================================================
     RENDER
     ========================================================= */

  return (

    <main className="login-page">

      <div className="login-container">

        {/* =================================================
            PANEL IZQUIERDO
        ================================================= */}

        <section className="brand-section">

          <h1 className="brand-title">
            Sistema de Monitoreo Bioinfeccioso
          </h1>

        </section>


        {/* =================================================
            PANEL DERECHO
        ================================================= */}

        <section className="login-form-section">

          {/* ===============================================
              ENCABEZADO
          =============================================== */}

          <header className="reconfirmar-header">

            <span className="reconfirmar-icon">

              <FaKey
                aria-hidden="true"
              />

            </span>


            <h2 className="login-title">
              Recuperar Contraseña
            </h2>


            <p className="system-subtitle">
              Ingrese su usuario o correo electrónico para recibir
              las instrucciones de recuperación.
            </p>

          </header>


          {/* ===============================================
              FORMULARIO
          =============================================== */}

          <form
            className="system-form"
            onSubmit={
              handleSubmit
            }
            noValidate
          >

            <div className="system-form-group">

              <label
                htmlFor="identificador"
                className="system-form-label login-field-label"
              >

                <FaEnvelope
                  aria-hidden="true"
                />

                Usuario o correo electrónico

              </label>


              <input
                id="identificador"
                type="text"
                className="system-form-control"
                placeholder="Ingrese su usuario o correo"
                value={
                  identificador
                }
                onChange={
                  (event) =>
                    setIdentificador(
                      event.target.value
                    )
                }
                disabled={
                  loading
                }
                maxLength={254}
                autoComplete="username"
                autoFocus
                required
              />

            </div>


            {/* ===============================================
                ENVIAR
            =============================================== */}

            <button
              type="submit"
              className="app-btn app-btn-primary app-btn-block"
              disabled={
                loading ||
                !identificador.trim()
              }
            >

              {loading ? (

                <>

                  <span
                    className="system-spinner system-spinner-small"
                    aria-hidden="true"
                  />

                  <span>
                    Enviando...
                  </span>

                </>

              ) : (

                <>

                  <FaEnvelope
                    aria-hidden="true"
                  />

                  <span>
                    Enviar instrucciones
                  </span>

                </>

              )}

            </button>


            {/* ===============================================
                VOLVER
            =============================================== */}

            <Link
              to="/"
              className="forgot-password"
            >
              Volver al inicio de sesión
            </Link>

          </form>

        </section>

      </div>

    </main>

  );
};


export default RecuperarContrasena;