import React, {
  useMemo,
  useState,
} from "react";

import {
  FaLock,
  FaCheckCircle,
  FaTimesCircle,
} from "react-icons/fa";

import {
  toast,
} from "react-toastify";

import {
  useParams,
  useNavigate,
  Link,
} from "react-router-dom";

import apiClient
  from "../utils/apiClient";

import "../styles/login.css";


/* =========================================================
   INDICADOR DE REGLA
   ========================================================= */

const RuleItem = ({
  ok,
  children,
}) => (

  <li
    className={
      `password-rule ${
        ok
          ? "password-rule-valid"
          : "password-rule-invalid"
      }`
    }
  >

    {ok ? (

      <FaCheckCircle
        aria-hidden="true"
      />

    ) : (

      <FaTimesCircle
        aria-hidden="true"
      />

    )}


    <span>
      {children}
    </span>

  </li>

);


/* =========================================================
   COMPONENTE
   ========================================================= */

const ResetPassword = () => {

  const {
    token,
  } =
    useParams();


  const navigate =
    useNavigate();


  const [
    nuevaContrasena,
    setNuevaContrasena,
  ] =
    useState("");


  const [
    confirmarContrasena,
    setConfirmarContrasena,
  ] =
    useState("");


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  /* =======================================================
     REGLAS DE CONTRASEÑA

     Se mantiene la lógica actual:
     - mínimo 8 caracteres
     - mayúscula
     - minúscula
     - número
     ======================================================= */

  const rules =
    useMemo(
      () => {

        const nueva =
          nuevaContrasena ||
          "";


        return {

          length:
            nueva.length >= 8,

          upper:
            /[A-Z]/.test(
              nueva
            ),

          lower:
            /[a-z]/.test(
              nueva
            ),

          number:
            /\d/.test(
              nueva
            ),
        };

      },
      [
        nuevaContrasena,
      ]
    );


  const cumpleRequisitos =
    rules.length &&
    rules.upper &&
    rules.lower &&
    rules.number;


  const coincideConfirmacion =
    confirmarContrasena.length > 0 &&
    nuevaContrasena ===
      confirmarContrasena;


  const disableSubmit =
    loading ||
    !cumpleRequisitos ||
    !coincideConfirmacion;


  /* =======================================================
     RESTABLECER CONTRASEÑA
     ======================================================= */

  const handleSubmit =
    async (
      event
    ) => {

      event.preventDefault();


      if (
        !nuevaContrasena ||
        !confirmarContrasena
      ) {

        toast.error(
          "Por favor complete ambos campos"
        );

        return;
      }


      if (
        !cumpleRequisitos
      ) {

        toast.error(
          "La nueva contraseña no cumple los requisitos"
        );

        return;
      }


      if (
        nuevaContrasena !==
        confirmarContrasena
      ) {

        toast.error(
          "Las contraseñas no coinciden"
        );

        return;
      }


      try {

        setLoading(
          true
        );


        /*
         * apiClient ya utiliza:
         *
         * VITE_API_URL
         *        +
         *      /api
         *
         * No se coloca localhost aquí.
         */

        const {
          data,
        } =
          await apiClient.post(
            "/recuperacion/restablecer",
            {
              token,
              nuevaContrasena,
              confirmarContrasena,
            }
          );


        toast.success(
          data?.message ||
          "Contraseña restablecida con éxito"
        );


        navigate("/");


      } catch (
        error
      ) {

        console.error(
          "Error restableciendo contraseña:",
          error
        );


        const message =
          error
            ?.response
            ?.data
            ?.message ||
          "Error en la conexión con el servidor";


        toast.error(
          message
        );


      } finally {

        setLoading(
          false
        );
      }
    };


  /* =======================================================
     VALIDACIÓN VISUAL
     ======================================================= */

  const nuevaValidationClass =
    nuevaContrasena.length === 0
      ? ""
      : cumpleRequisitos
        ? "is-valid"
        : "is-invalid";


  const confirmacionValidationClass =
    confirmarContrasena.length === 0
      ? ""
      : coincideConfirmacion
        ? "is-valid"
        : "is-invalid";


  /* =======================================================
     RENDER
     ======================================================= */

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

          <div className="reconfirmar-header">

            <span className="reconfirmar-icon">

              <FaLock
                aria-hidden="true"
              />

            </span>


            <h2 className="login-title">
              Restablecer Contraseña
            </h2>


            <p className="system-subtitle">
              Ingrese su nueva contraseña para completar el proceso de recuperación.
            </p>

          </div>


          <form
            className="system-form"
            onSubmit={
              handleSubmit
            }
          >

            {/* ===============================================
                NUEVA CONTRASEÑA
            =============================================== */}

            <div className="system-form-group">

              <label
                htmlFor="nuevaContrasena"
                className="system-form-label"
              >
                Nueva contraseña
              </label>


              <input
                type="password"
                id="nuevaContrasena"
                className={
                  `system-form-control ${nuevaValidationClass}`
                }
                placeholder="Ingrese su nueva contraseña"
                value={
                  nuevaContrasena
                }
                onChange={
                  (event) =>
                    setNuevaContrasena(
                      event.target.value
                    )
                }
                required
                disabled={
                  loading
                }
                autoComplete="new-password"
              />


              {nuevaContrasena &&
              !cumpleRequisitos && (

                <small className="system-form-error">
                  La nueva contraseña no cumple con los requisitos.
                </small>

              )}

            </div>


            {/* ===============================================
                REQUISITOS
            =============================================== */}

            <div className="password-requirements">

              <h3 className="password-requirements-title">
                Requisitos de la contraseña
              </h3>


              <ul className="password-rules">

                <RuleItem
                  ok={
                    rules.length
                  }
                >
                  Mínimo 8 caracteres
                </RuleItem>


                <RuleItem
                  ok={
                    rules.upper
                  }
                >
                  Al menos una letra mayúscula
                </RuleItem>


                <RuleItem
                  ok={
                    rules.lower
                  }
                >
                  Al menos una letra minúscula
                </RuleItem>


                <RuleItem
                  ok={
                    rules.number
                  }
                >
                  Al menos un número
                </RuleItem>

              </ul>

            </div>


            {/* ===============================================
                CONFIRMAR CONTRASEÑA
            =============================================== */}

            <div className="system-form-group">

              <label
                htmlFor="confirmarContrasena"
                className="system-form-label"
              >
                Confirmar contraseña
              </label>


              <input
                type="password"
                id="confirmarContrasena"
                className={
                  `system-form-control ${confirmacionValidationClass}`
                }
                placeholder="Confirme su nueva contraseña"
                value={
                  confirmarContrasena
                }
                onChange={
                  (event) =>
                    setConfirmarContrasena(
                      event.target.value
                    )
                }
                required
                disabled={
                  loading
                }
                autoComplete="new-password"
              />


              {confirmarContrasena &&
              !coincideConfirmacion && (

                <small className="system-form-error">
                  Las contraseñas no coinciden.
                </small>

              )}

            </div>


            {/* ===============================================
                BOTÓN
            =============================================== */}

            <button
              type="submit"
              className="app-btn app-btn-primary app-btn-block"
              disabled={
                disableSubmit
              }
            >

              {loading ? (

                <>

                  <span
                    className="system-spinner system-spinner-small"
                    aria-hidden="true"
                  />

                  <span>
                    Procesando...
                  </span>

                </>

              ) : (

                <span>
                  Restablecer Contraseña
                </span>

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


export default ResetPassword;