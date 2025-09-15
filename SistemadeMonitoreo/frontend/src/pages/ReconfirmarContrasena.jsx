// pages/ReconfirmarContrasena.jsx
import React, { useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { useLocation, useNavigate } from "react-router-dom";
import { FaCheckCircle, FaTimesCircle, FaEye, FaEyeSlash } from "react-icons/fa";
import "react-toastify/dist/ReactToastify.css";
import "../styles/login.css";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001/api";

// --- utils ---
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

// --- small UI components ---
const RuleItem = ({ ok, children }) => (
  <li className="d-flex align-items-center gap-2">
    {ok ? (
      <FaCheckCircle className="text-success" aria-hidden="true" />
    ) : (
      <FaTimesCircle className="text-danger" aria-hidden="true" />
    )}
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
  errorText, // opcional
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

const ReconfirmarContrasena = () => {
  const [form, setForm] = useState({ actual: "", nueva: "", confirmar: "" });
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState({ actual: false, nueva: false, confirmar: false });

  const navigate = useNavigate();
  const location = useLocation();

  // usuario: del navigate(state) o del JWT
  const usuario = useMemo(() => location.state?.usuario || getUsuarioFromToken(), [location.state]);

  const onChange = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  // Reglas (sin carácter especial)
  const rules = useMemo(() => {
    const np = form.nueva || "";
    return {
      length: np.length >= 8,
      upper: /[A-Z]/.test(np),
      lower: /[a-z]/.test(np),
      number: /\d/.test(np),
    };
  }, [form.nueva]);

  const cumpleRequisitos = rules.length && rules.upper && rules.lower && rules.number;
  const coincideConfirmacion = form.nueva === form.confirmar && form.confirmar.length > 0;
  const nuevaNoIgualActual = form.nueva && form.actual && form.nueva !== form.actual;

  const disableSubmit =
    loading ||
    !usuario ||
    !form.actual ||
    !form.nueva ||
    !form.confirmar ||
    !cumpleRequisitos ||
    !coincideConfirmacion ||
    !nuevaNoIgualActual;

  const onSubmit = async (e) => {
    e.preventDefault();

    if (!usuario) {
      toast.error("No se pudo identificar el usuario. Inicie sesión nuevamente.");
      navigate("/");
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      toast.error("Sesión no válida. Inicie sesión nuevamente.");
      navigate("/");
      return;
    }

    try {
      setLoading(true);
      const { data } = await axios.post(
        `${API_BASE}/auth/reconfirmar-password`,
        { usuario, actual: form.actual, nueva: form.nueva },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (data?.token) localStorage.setItem("token", data.token);

      toast.success("Contraseña actualizada correctamente");
      setForm({ actual: "", nueva: "", confirmar: "" });
      navigate("/dashboard");
    } catch (err) {
      const msg = err?.response?.data?.message || "Error al actualizar la contraseña";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Clases de validación visual
  const inputClassActual = form.actual.length === 0 ? "form-control" : "form-control is-valid";
  const inputClassNueva =
    form.nueva.length === 0 ? "form-control" : cumpleRequisitos ? "form-control is-valid" : "form-control is-invalid";
  const inputClassConfirm =
    form.confirmar.length === 0
      ? "form-control"
      : coincideConfirmacion
      ? "form-control is-valid"
      : "form-control is-invalid";

  return (
    <div className="container d-flex justify-content-center align-items-center min-vh-100">
      <div className="col-md-6 col-lg-5 p-4 shadow rounded bg-light">
        <div className="text-center mb-2" style={{ fontSize: 28, fontWeight: 700 }}>
          Actualizar Contraseña
        </div>
        <p className="text-center text-muted" style={{ marginTop: -6 }}>
          Mantén tu cuenta segura con una contraseña fuerte
        </p>

        {usuario && (
          <p className="text-center text-muted" style={{ marginTop: -6 }}>
            Usuario: <strong>{usuario}</strong>
          </p>
        )}

        <form onSubmit={onSubmit} autoComplete="on">
          {/* Actual */}
          <PasswordField
            label="Contraseña Actual"
            name="actual"
            value={form.actual}
            onChange={onChange}
            show={show.actual}
            onToggleShow={() => setShow((s) => ({ ...s, actual: !s.actual }))}
            autoComplete="current-password"
            inputClass={inputClassActual}
          />

          {/* Nueva */}
          <PasswordField
            label="Nueva Contraseña"
            name="nueva"
            value={form.nueva}
            onChange={onChange}
            show={show.nueva}
            onToggleShow={() => setShow((s) => ({ ...s, nueva: !s.nueva }))}
            autoComplete="new-password"
            inputClass={inputClassNueva}
            errorText={
              form.nueva.length > 0 && !cumpleRequisitos
                ? "La nueva contraseña no cumple con los requisitos"
                : undefined
            }
          />

          {/* Requisitos */}
          <div className="p-3 mt-2 mb-2 rounded" style={{ background: "#f6f8ff", borderLeft: "4px solid #3758f9" }}>
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
            value={form.confirmar}
            onChange={onChange}
            show={show.confirmar}
            onToggleShow={() => setShow((s) => ({ ...s, confirmar: !s.confirmar }))}
            autoComplete="new-password"
            inputClass={inputClassConfirm}
            errorText={
              form.confirmar.length > 0 && !coincideConfirmacion
                ? "Las contraseñas no coinciden"
                : form.nueva && form.actual && !nuevaNoIgualActual
                ? "La nueva contraseña no puede ser igual a la actual"
                : undefined
            }
          />

          <button type="submit" className="btn btn-primary w-100 mt-2" disabled={disableSubmit}>
            {loading ? "Actualizando..." : "Actualizar Contraseña"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReconfirmarContrasena;
