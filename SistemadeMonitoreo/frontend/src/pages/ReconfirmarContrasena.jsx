// frontend/src/pages/ReconfirmarContrasena.jsx

import React, {
  useMemo,
  useState,
} from "react";

import {
  toast,
} from "react-toastify";

import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEyeSlash,
  FaLock,
} from "react-icons/fa";

import apiClient
  from "../utils/apiClient";

import "react-toastify/dist/ReactToastify.css";
import "../styles/login.css";


/* =========================================================
   OBTENER USUARIO DESDE TOKEN
   ========================================================= */

function getUsuarioFromToken() {

  try {

    const token =
      localStorage.getItem(
        "token"
      );


    if (
      !token
    ) {
      return null;
    }


    const payload =
      JSON.parse(
        atob(
          token.split(".")[1]
        )
      );


    return (
      payload?.usuario ||
      null
    );

  } catch {

    return null;
  }
}


/* =========================================================
   REGLA DE CONTRASEÑA
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
   CAMPO DE CONTRASEÑA
   ========================================================= */

const PasswordField = ({
  label,
  name,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  validationClass = "",
  errorText,
}) => (

  <div className="system-form-group">

    <label
      htmlFor={name}
      className="system-form-label"
    >
      {label}
    </label>


    <div className="password-input-group">

      <input
        id={name}
        type={
          show
            ? "text"
            : "password"
        }
        name={name}
        className={
          `system-form-control password-input ${validationClass}`
        }
        value={value}
        onChange={onChange}
        required
        autoComplete={
          autoComplete
        }
      />


      <button
        type="button"
        className="password-toggle"
        onClick={
          onToggleShow
        }
        aria-label={
          show
            ? `Ocultar ${label}`
            : `Mostrar ${label}`
        }
        title={
          show
            ? "Ocultar"
            : "Mostrar"
        }
      >

        {show ? (

          <FaEyeSlash
            aria-hidden="true"
          />

        ) : (

          <FaEye
            aria-hidden="true"
          />

        )}

      </button>

    </div>


    {errorText && (

      <small className="system-form-error">
        {errorText}
      </small>

    )}

  </div>

);


/* =========================================================
   COMPONENTE
   ========================================================= */

const ReconfirmarContrasena = () => {

  /* =======================================================
     ESTADOS
     ======================================================= */

  const [
    form,
    setForm,
  ] =
    useState({
      actual: "",
      nueva: "",
      confirmar: "",
    });


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    show,
    setShow,
  ] =
    useState({
      actual: false,
      nueva: false,
      confirmar: false,
    });


  const navigate =
    useNavigate();


  const location =
    useLocation();


  /* =======================================================
     USUARIO

     Primero usa navigate(state).
     Si no existe, lo obtiene del JWT.
     ======================================================= */

  const usuario =
    useMemo(
      () =>
        location.state?.usuario ||
        getUsuarioFromToken(),
      [
        location.state,
      ]
    );


  /* =======================================================
     CAMBIAR CAMPOS
     ======================================================= */

  const onChange =
    (event) => {

      const {
        name,
        value,
      } =
        event.target;


      setForm(
        (state) => ({
          ...state,

          [name]:
            value,
        })
      );
    };


  /* =======================================================
     REGLAS DE CONTRASEÑA

     Se conserva la lógica actual:
     - mínimo 8 caracteres
     - mayúscula
     - minúscula
     - número
     - sin requisito de carácter especial
     ======================================================= */

  const rules =
    useMemo(
      () => {

        const nuevaPassword =
          form.nueva ||
          "";


        return {

          length:
            nuevaPassword.length >=
            8,

          upper:
            /[A-Z]/.test(
              nuevaPassword
            ),

          lower:
            /[a-z]/.test(
              nuevaPassword
            ),

          number:
            /\d/.test(
              nuevaPassword
            ),
        };

      },
      [
        form.nueva,
      ]
    );


  const cumpleRequisitos =
    rules.length &&
    rules.upper &&
    rules.lower &&
    rules.number;


  const coincideConfirmacion =
    form.nueva ===
      form.confirmar &&
    form.confirmar.length >
      0;


  const nuevaNoIgualActual =
    form.nueva &&
    form.actual &&
    form.nueva !==
      form.actual;


  /* =======================================================
     ESTADO DEL BOTÓN
     ======================================================= */

  const disableSubmit =
    loading ||
    !usuario ||
    !form.actual ||
    !form.nueva ||
    !form.confirmar ||
    !cumpleRequisitos ||
    !coincideConfirmacion ||
    !nuevaNoIgualActual;


  /* =======================================================
     ENVIAR CAMBIO DE CONTRASEÑA
     ======================================================= */

  const onSubmit =
    async (
      event
    ) => {

      event.preventDefault();


      if (
        !usuario
      ) {

        toast.error(
          "No se pudo identificar el usuario. Inicie sesión nuevamente."
        );


        navigate("/");

        return;
      }


      const token =
        localStorage.getItem(
          "token"
        );


      if (
        !token
      ) {

        toast.error(
          "Sesión no válida. Inicie sesión nuevamente."
        );


        navigate("/");

        return;
      }


      try {

        setLoading(
          true
        );


        /*
         * apiClient ya:
         * - usa VITE_API_URL
         * - agrega /api
         * - adjunta Bearer token
         */

        const {
          data,
        } =
          await apiClient.post(
            "/auth/reconfirmar-password",
            {
              usuario,
              actual:
                form.actual,
              nueva:
                form.nueva,
            }
          );


        if (
          data?.token
        ) {

          localStorage.setItem(
            "token",
            data.token
          );
        }


        toast.success(
          "Contraseña actualizada correctamente"
        );


        setForm({
          actual: "",
          nueva: "",
          confirmar: "",
        });


        navigate(
          "/dashboard"
        );

      } catch (
        error
      ) {

        const message =
          error
            ?.response
            ?.data
            ?.message ||
          "Error al actualizar la contraseña";


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

  const validationActual =
    form.actual.length === 0
      ? ""
      : "is-valid";


  const validationNueva =
    form.nueva.length === 0
      ? ""
      : cumpleRequisitos
        ? "is-valid"
        : "is-invalid";


  const validationConfirm =
    form.confirmar.length === 0
      ? ""
      : coincideConfirmacion
        ? "is-valid"
        : "is-invalid";


  /* =======================================================
     RENDER
     ======================================================= */

  return (

    <main className="login-page">

      <section className="system-card login-card reconfirmar-card">

        {/* =================================================
            ENCABEZADO
        ================================================= */}

        <header className="reconfirmar-header">

          <span className="reconfirmar-icon">

            <FaLock
              aria-hidden="true"
            />

          </span>


          <h1 className="system-title">
            Actualizar Contraseña
          </h1>


          <p className="system-subtitle">
            Mantén tu cuenta segura con una contraseña fuerte.
          </p>


          {usuario && (

            <p className="reconfirmar-user">

              Usuario:{" "}

              <strong>
                {usuario}
              </strong>

            </p>

          )}

        </header>


        {/* =================================================
            FORMULARIO
        ================================================= */}

        <form
          className="system-form"
          onSubmit={
            onSubmit
          }
          autoComplete="on"
        >

          {/* ===============================================
              CONTRASEÑA ACTUAL
          =============================================== */}

          <PasswordField
            label="Contraseña Actual"
            name="actual"
            value={
              form.actual
            }
            onChange={
              onChange
            }
            show={
              show.actual
            }
            onToggleShow={
              () =>
                setShow(
                  (state) => ({
                    ...state,

                    actual:
                      !state.actual,
                  })
                )
            }
            autoComplete="current-password"
            validationClass={
              validationActual
            }
          />


          {/* ===============================================
              NUEVA CONTRASEÑA
          =============================================== */}

          <PasswordField
            label="Nueva Contraseña"
            name="nueva"
            value={
              form.nueva
            }
            onChange={
              onChange
            }
            show={
              show.nueva
            }
            onToggleShow={
              () =>
                setShow(
                  (state) => ({
                    ...state,

                    nueva:
                      !state.nueva,
                  })
                )
            }
            autoComplete="new-password"
            validationClass={
              validationNueva
            }
            errorText={
              form.nueva.length > 0 &&
              !cumpleRequisitos
                ? "La nueva contraseña no cumple con los requisitos"
                : undefined
            }
          />


          {/* ===============================================
              REQUISITOS
          =============================================== */}

          <div className="password-requirements">

            <h2 className="password-requirements-title">
              Requisitos de la contraseña
            </h2>


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

          <PasswordField
            label="Confirmar Nueva Contraseña"
            name="confirmar"
            value={
              form.confirmar
            }
            onChange={
              onChange
            }
            show={
              show.confirmar
            }
            onToggleShow={
              () =>
                setShow(
                  (state) => ({
                    ...state,

                    confirmar:
                      !state.confirmar,
                  })
                )
            }
            autoComplete="new-password"
            validationClass={
              validationConfirm
            }
            errorText={
              form.confirmar.length > 0 &&
              !coincideConfirmacion
                ? "Las contraseñas no coinciden"
                : form.nueva &&
                    form.actual &&
                    !nuevaNoIgualActual
                  ? "La nueva contraseña no puede ser igual a la actual"
                  : undefined
            }
          />


          {/* ===============================================
              GUARDAR
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
                  Actualizando...
                </span>

              </>

            ) : (

              <span>
                Actualizar Contraseña
              </span>

            )}

          </button>

        </form>

      </section>

    </main>

  );
};


export default ReconfirmarContrasena;