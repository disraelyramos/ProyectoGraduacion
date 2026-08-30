// pages/ContrasenaObligatoria.jsx

import React, { useState, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  useNavigate,
  useLocation,
} from "react-router-dom";
import {
  FaCheckCircle,
  FaTimesCircle,
  FaEye,
  FaEyeSlash,
} from "react-icons/fa";

import "react-toastify/dist/ReactToastify.css";
import "../styles/login.css";
import "../styles/system.css";

/**
 * =====================================================
 * CONFIGURACIÓN DE ENTORNO
 * =====================================================
 *
 * La URL viene del .env del FRONTEND:
 *
 * VITE_API_URL
 */
const API_URL = import.meta.env.VITE_API_URL;


/**
 * =====================================================
 * OBTENER USUARIO DESDE TOKEN
 * =====================================================
 */
function getUsuarioFromToken() {
  try {
    const token = localStorage.getItem("token");

    if (!token) return null;

    const payload = JSON.parse(
      atob(token.split(".")[1])
    );

    return payload?.usuario || null;
  } catch {
    return null;
  }
}


/**
 * =====================================================
 * REGLA VISUAL DE CONTRASEÑA
 * =====================================================
 */
const RuleItem = ({ ok, children }) => (
  <li
    className={`password-rule ${
      ok ? "password-rule-valid" : ""
    }`}
  >
    <span className="password-rule-icon">
      {ok ? (
        <FaCheckCircle />
      ) : (
        <FaTimesCircle />
      )}
    </span>

    <span>{children}</span>
  </li>
);


/**
 * =====================================================
 * CAMPO DE CONTRASEÑA REUTILIZABLE
 * =====================================================
 */
const PasswordField = ({
  label,
  name,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  inputState,
  errorText,
}) => (
  <div className="system-form-group">

    <label
      className="system-form-label"
      htmlFor={name}
    >
      {label}
    </label>

    <div
      className={`password-input-group ${
        inputState || ""
      }`}
    >
      <input
        id={name}
        type={show ? "text" : "password"}
        name={name}
        className="system-form-control password-input"
        value={value}
        onChange={onChange}
        required
        autoComplete={autoComplete}
      />

      <button
        type="button"
        className="password-toggle-button"
        onClick={onToggleShow}
        aria-label={
          show
            ? `Ocultar ${label}`
            : `Mostrar ${label}`
        }
        aria-pressed={show}
        title={show ? "Ocultar" : "Mostrar"}
      >
        {show ? (
          <FaEyeSlash />
        ) : (
          <FaEye />
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


/**
 * =====================================================
 * COMPONENTE PRINCIPAL
 * =====================================================
 */
const ContraseñaObligatoria = () => {

  const [formData, setFormData] = useState({
    nueva: "",
    confirmar: "",
  });

  const [loading, setLoading] = useState(false);

  const [show, setShow] = useState({
    nueva: false,
    confirmar: false,
  });

  const navigate = useNavigate();
  const location = useLocation();


  /**
   * Usuario recibido por state o token
   */
  const usuario = useMemo(
    () =>
      location.state?.usuario ||
      getUsuarioFromToken(),
    [location.state]
  );


  /**
   * =====================================================
   * CAMBIO DE INPUTS
   * =====================================================
   */
  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };


  /**
   * =====================================================
   * REGLAS DE CONTRASEÑA
   * =====================================================
   */
  const rules = useMemo(() => {

    const nuevaPassword =
      formData.nueva || "";

    return {
      length:
        nuevaPassword.length >= 8,

      upper:
        /[A-Z]/.test(nuevaPassword),

      lower:
        /[a-z]/.test(nuevaPassword),

      number:
        /\d/.test(nuevaPassword),
    };

  }, [formData.nueva]);


  const cumpleRequisitos =
    rules.length &&
    rules.upper &&
    rules.lower &&
    rules.number;


  const coincideConfirmacion =
    formData.nueva === formData.confirmar &&
    formData.confirmar.length > 0;


  const disableSubmit =
    loading ||
    !usuario ||
    !formData.nueva ||
    !formData.confirmar ||
    !cumpleRequisitos ||
    !coincideConfirmacion;


  /**
   * =====================================================
   * GUARDAR NUEVA CONTRASEÑA
   * =====================================================
   */
  const handleSubmit = async (e) => {

    e.preventDefault();

    if (!usuario) {

      toast.error(
        "No se pudo identificar el usuario. Inicie sesión nuevamente."
      );

      navigate("/");

      return;
    }


    if (
      !formData.nueva ||
      !formData.confirmar
    ) {

      toast.error(
        "Todos los campos son obligatorios"
      );

      return;
    }


    if (
      formData.nueva !==
      formData.confirmar
    ) {

      toast.error(
        "La nueva contraseña y la confirmación no coinciden"
      );

      return;
    }


    try {

      setLoading(true);

      const token =
        localStorage.getItem("token");


      if (!token) {

        toast.error(
          "Sesión no válida. Inicie sesión nuevamente."
        );

        navigate("/");

        return;
      }


      const res = await axios.post(
        `${API_URL}/api/auth/cambiar-password-obligatorio`,

        {
          usuario,
          nueva: formData.nueva,
        },

        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );


      /**
       * Si backend devuelve
       * token nuevo, reemplazarlo
       */
      if (res?.data?.token) {

        localStorage.setItem(
          "token",
          res.data.token
        );
      }


      toast.success(
        "Contraseña actualizada correctamente"
      );


      setFormData({
        nueva: "",
        confirmar: "",
      });


      navigate("/dashboard");

    } catch (error) {

      const msg =
        error.response?.data?.message ||
        "Error al actualizar contraseña";

      toast.error(msg);

    } finally {

      setLoading(false);
    }
  };


  /**
   * =====================================================
   * ESTADOS VISUALES DE INPUTS
   * =====================================================
   */

  const estadoNueva =
    formData.nueva.length === 0
      ? ""
      : cumpleRequisitos
      ? "is-valid"
      : "is-invalid";


  const estadoConfirmacion =
    formData.confirmar.length === 0
      ? ""
      : coincideConfirmacion
      ? "is-valid"
      : "is-invalid";


  /**
   * =====================================================
   * VISTA
   * =====================================================
   */

  return (

    <div className="password-required-page">

      <section className="password-required-card">

        {/* ===============================
            CABECERA
        =============================== */}

        <header className="password-header">

          <h1>
            Cambio obligatorio de contraseña
          </h1>

          <p>
            Por seguridad debes establecer
            una nueva contraseña antes de continuar.
          </p>

        </header>


        {/* ===============================
            USUARIO
        =============================== */}

        {usuario && (

          <div className="password-user-info">

            <span>
              Usuario
            </span>

            <strong>
              {usuario}
            </strong>

          </div>

        )}


        {/* ===============================
            FORMULARIO
        =============================== */}

        <form
          className="password-form"
          onSubmit={handleSubmit}
          autoComplete="on"
        >

          {/* Nueva contraseña */}

          <PasswordField
            label="Nueva contraseña"
            name="nueva"
            value={formData.nueva}
            onChange={handleChange}
            show={show.nueva}
            onToggleShow={() =>
              setShow((prev) => ({
                ...prev,
                nueva: !prev.nueva,
              }))
            }
            autoComplete="new-password"
            inputState={estadoNueva}
            errorText={
              formData.nueva.length > 0 &&
              !cumpleRequisitos
                ? "La contraseña aún no cumple todos los requisitos."
                : undefined
            }
          />


          {/* ===============================
              REQUISITOS
          =============================== */}

          <div className="password-requirements">

            <div className="password-requirements-title">
              Requisitos de la contraseña
            </div>

            <ul className="password-rules">

              <RuleItem
                ok={rules.length}
              >
                Mínimo 8 caracteres
              </RuleItem>

              <RuleItem
                ok={rules.upper}
              >
                Al menos una letra mayúscula
              </RuleItem>

              <RuleItem
                ok={rules.lower}
              >
                Al menos una letra minúscula
              </RuleItem>

              <RuleItem
                ok={rules.number}
              >
                Al menos un número
              </RuleItem>

            </ul>

          </div>


          {/* Confirmación */}

          <PasswordField
            label="Confirmar nueva contraseña"
            name="confirmar"
            value={formData.confirmar}
            onChange={handleChange}
            show={show.confirmar}
            onToggleShow={() =>
              setShow((prev) => ({
                ...prev,
                confirmar:
                  !prev.confirmar,
              }))
            }
            autoComplete="new-password"
            inputState={
              estadoConfirmacion
            }
            errorText={
              formData.confirmar.length >
                0 &&
              !coincideConfirmacion
                ? "Las contraseñas no coinciden."
                : undefined
            }
          />


          {/* ===============================
              ACCIÓN PRINCIPAL
          =============================== */}

          <button
            type="submit"
            className="password-submit-button"
            disabled={disableSubmit}
          >
            {loading
              ? "Actualizando..."
              : "Cambiar contraseña"}
          </button>

        </form>

      </section>

    </div>

  );
};

export default ContraseñaObligatoria;