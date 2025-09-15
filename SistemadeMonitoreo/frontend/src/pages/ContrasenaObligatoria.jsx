// pages/ContrasenaObligatoria.jsx
import React, { useState, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useNavigate, useLocation } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaEye, FaEyeSlash } from "react-icons/fa";
import "react-toastify/dist/ReactToastify.css";
import "../styles/login.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

/** Decodifica el JWT para extraer el usuario si no viene por state */
function getUsuarioFromToken() {
  try {
    const token = localStorage.getItem("token");
    if (!token) return null;
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload?.usuario || null;
  } catch {
    return null;
  }
}

/* ---- UI helpers ---- */
const RuleItem = ({ ok, children }) => (
  <li className="d-flex align-items-center gap-2">
    {ok ? <FaCheckCircle className="text-success" /> : <FaTimesCircle className="text-danger" />}
    <span>{children}</span>
  </li>
);

const PasswordField = ({
  label,
  name,
  value,
  onChange,
  show,
  onToggleShow,
  autoComplete,
  inputClass,
  errorText,
}) => (
  <div className="mb-3">
    <label className="form-label">{label}</label>
    <div className="input-group">
      <input
        type={show ? "text" : "password"}
        name={name}
        className={inputClass || "form-control"}
        value={value}
        onChange={onChange}
        required
        autoComplete={autoComplete}
      />
      <button
        type="button"
        className="btn btn-outline-secondary"
        onClick={onToggleShow}
        aria-label={`Mostrar/Ocultar ${label}`}
        title={show ? "Ocultar" : "Mostrar"}
      >
        {show ? <FaEyeSlash /> : <FaEye />}
      </button>
    </div>
    {errorText ? <small className="text-danger">{errorText}</small> : null}
  </div>
);

const ContraseñaObligatoria = () => {
  const [formData, setFormData] = useState({ nueva: "", confirmar: "" });
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ nueva: false, confirmar: false });

  const navigate = useNavigate();
  const location = useLocation();

  // 1) Usuario puede venir del navigate state o del token
  const usuario = useMemo(() => location.state?.usuario || getUsuarioFromToken(), [location.state]);

  const handleChange = (e) => {
    setFormData((s) => ({ ...s, [e.target.name]: e.target.value }));
  };

  // Reglas (sin carácter especial)
  const rules = useMemo(() => {
    const np = formData.nueva || "";
    return {
      length: np.length >= 8,
      upper: /[A-Z]/.test(np),
      lower: /[a-z]/.test(np),
      number: /\d/.test(np),
    };
  }, [formData.nueva]);

  const cumpleRequisitos = rules.length && rules.upper && rules.lower && rules.number;
  const coincideConfirmacion =
    formData.nueva === formData.confirmar && formData.confirmar.length > 0;

  const disableSubmit =
    loading || !usuario || !formData.nueva || !formData.confirmar || !cumpleRequisitos || !coincideConfirmacion;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!usuario) {
      toast.error("No se pudo identificar el usuario. Inicie sesión nuevamente.");
      navigate("/");
      return;
    }

    if (!formData.nueva || !formData.confirmar) {
      toast.error("Todos los campos son obligatorios");
      return;
    }

    if (formData.nueva !== formData.confirmar) {
      toast.error("La nueva contraseña y la confirmación no coinciden");
      return;
    }

    try {
      setLoading(true);

      const token = localStorage.getItem("token");
      if (!token) {
        toast.error("Sesión no válida. Inicie sesión nuevamente.");
        navigate("/");
        return;
      }

      const res = await axios.post(
        `${API_BASE}/auth/cambiar-password-obligatorio`,
        { usuario, nueva: formData.nueva },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      // si el backend devuelve un token nuevo, úsalo
      if (res?.data?.token) {
        localStorage.setItem("token", res.data.token);
      }

      toast.success("Contraseña actualizada correctamente");
      setFormData({ nueva: "", confirmar: "" });
      navigate("/dashboard");
    } catch (error) {
      const msg = error.response?.data?.message || "Error al actualizar contraseña";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Clases de validación visual
  const inputClassNueva =
    formData.nueva.length === 0
      ? "form-control"
      : cumpleRequisitos
      ? "form-control is-valid"
      : "form-control is-invalid";

  const inputClassConfirm =
    formData.confirmar.length === 0
      ? "form-control"
      : coincideConfirmacion
      ? "form-control is-valid"
      : "form-control is-invalid";

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100">
      <div className="col-md-6 col-lg-4 p-4 shadow rounded bg-light">
        <h3 className="text-center mb-2">Cambio Obligatorio de Contraseña</h3>

        {/* Mostrar a quién se le cambiará (opcional) */}
        {usuario && (
          <p className="text-center text-muted" style={{ marginTop: -4 }}>
            Usuario: <strong>{usuario}</strong>
          </p>
        )}

        <form onSubmit={handleSubmit} autoComplete="on">
          {/* Nueva */}
          <PasswordField
            label="Nueva Contraseña"
            name="nueva"
            value={formData.nueva}
            onChange={handleChange}
            show={show.nueva}
            onToggleShow={() => setShow((s) => ({ ...s, nueva: !s.nueva }))}
            autoComplete="new-password"
            inputClass={inputClassNueva}
            errorText={
              formData.nueva.length > 0 && !cumpleRequisitos
                ? "La nueva contraseña no cumple con los requisitos"
                : undefined
            }
          />

          {/* Requisitos */}
          <div
            className="p-3 mt-2 mb-2 rounded"
            style={{ background: "#f6f8ff", borderLeft: "4px solid #3758f9" }}
          >
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Requisitos de la contraseña:</div>
            <ul className="mb-0" style={{ paddingLeft: 0, listStyle: "none" }}>
              <RuleItem ok={rules.length}>Mínimo 8 caracteres</RuleItem>
              <RuleItem ok={rules.upper}>Al menos una letra mayúscula</RuleItem>
              <RuleItem ok={rules.lower}>Al menos una letra minúscula</RuleItem>
              <RuleItem ok={rules.number}>Al menos un número</RuleItem>
            </ul>
          </div>

          {/* Confirmar */}
          <PasswordField
            label="Confirmar Nueva Contraseña"
            name="confirmar"
            value={formData.confirmar}
            onChange={handleChange}
            show={show.confirmar}
            onToggleShow={() => setShow((s) => ({ ...s, confirmar: !s.confirmar }))}
            autoComplete="new-password"
            inputClass={inputClassConfirm}
            errorText={
              formData.confirmar.length > 0 && !coincideConfirmacion
                ? "Las contraseñas no coinciden"
                : undefined
            }
          />

          <button type="submit" className="btn btn-primary w-100" disabled={disableSubmit}>
            {loading ? "Actualizando..." : "Cambiar Contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ContraseñaObligatoria;
