import React, { useState, useMemo } from "react";
import { FaLock, FaCheckCircle, FaTimesCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import "../styles/login.css";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [nuevaContrasena, setNuevaContrasena] = useState("");
  const [confirmarContrasena, setConfirmarContrasena] = useState("");
  const [loading, setLoading] = useState(false);

  //  Reglas de la contraseña (sin carácter especial)
  const rules = useMemo(() => {
    const np = nuevaContrasena || "";
    return {
      length: np.length >= 8,
      upper: /[A-Z]/.test(np),
      lower: /[a-z]/.test(np),
      number: /\d/.test(np),
    };
  }, [nuevaContrasena]);

  const cumpleRequisitos = rules.length && rules.upper && rules.lower && rules.number;
  const coincideConfirmacion =
    confirmarContrasena.length > 0 && nuevaContrasena === confirmarContrasena;

  const disableSubmit = loading || !cumpleRequisitos || !coincideConfirmacion;

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!nuevaContrasena || !confirmarContrasena) {
      toast.error("Por favor complete ambos campos");
      return;
    }

    if (!cumpleRequisitos) {
      toast.error("La nueva contraseña no cumple los requisitos");
      return;
    }

    if (nuevaContrasena !== confirmarContrasena) {
      toast.error("Las contraseñas no coinciden");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post("http://localhost:3001/api/recuperacion/restablecer", {
        token,
        nuevaContrasena,
        confirmarContrasena,
      });

      toast.success(res.data.message || "Contraseña restablecida con éxito ");
      navigate("/");
    } catch (err) {
      console.error(" Error restableciendo contraseña:", err);
      if (err.response && err.response.data) {
        toast.error(err.response.data.message || "No se pudo restablecer la contraseña");
      } else {
        toast.error("Error en la conexión con el servidor");
      }
    } finally {
      setLoading(false);
    }
  };

  const Icon = ({ ok }) =>
    ok ? <FaCheckCircle className="me-2" style={{ color: "#16a34a" }} /> : <FaTimesCircle className="me-2" style={{ color: "#dc2626" }} />;

  return (
    <div className="login-container">
      {/* Sección izquierda */}
      <div className="brand-section">
        <h2 className="brand-title">Sistema de Monitoreo Bioinfeccioso</h2>
      </div>

      {/* Sección derecha */}
      <div className="login-form-section">
        <h2 className="login-title">Restablecer Contraseña</h2>
        <p className="login-description">
          Ingrese su nueva contraseña para completar el proceso de recuperación.
        </p>

        <form onSubmit={handleSubmit}>
          {/* Nueva contraseña */}
          <div className="mb-3">
            <div className="input-group">
              <span className="input-group-text">
                <FaLock />
              </span>
              <input
                type="password"
                id="nuevaContrasena"
                className={`form-control ${nuevaContrasena && !cumpleRequisitos ? "is-invalid" : ""}`}
                placeholder="Nueva contraseña"
                value={nuevaContrasena}
                onChange={(e) => setNuevaContrasena(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
              />
            </div>
          </div>

          {/* Checklist de requisitos */}
          <div className="p-3 mt-2 mb-3 rounded" style={{ background: "#f6f8ff", borderLeft: "4px solid #3758f9" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Requisitos de la contraseña:</div>
            <ul className="mb-0" style={{ paddingLeft: 0, listStyle: "none" }}>
              <li className="d-flex align-items-center">
                <Icon ok={rules.length} /> Mínimo 8 caracteres
              </li>
              <li className="d-flex align-items-center">
                <Icon ok={rules.upper} /> Al menos una letra mayúscula
              </li>
              <li className="d-flex align-items-center">
                <Icon ok={rules.lower} /> Al menos una letra minúscula
              </li>
              <li className="d-flex align-items-center">
                <Icon ok={rules.number} /> Al menos un número
              </li>
            </ul>
          </div>

          {/* Confirmar contraseña */}
          <div className="mb-3">
            <div className="input-group">
              <span className="input-group-text">
                <FaLock />
              </span>
              <input
                type="password"
                id="confirmarContrasena"
                className={`form-control ${confirmarContrasena && !coincideConfirmacion ? "is-invalid" : ""}`}
                placeholder="Confirmar contraseña"
                value={confirmarContrasena}
                onChange={(e) => setConfirmarContrasena(e.target.value)}
                required
                disabled={loading}
                autoComplete="new-password"
              />
              {confirmarContrasena && !coincideConfirmacion && (
                <div className="invalid-feedback">Las contraseñas no coinciden.</div>
              )}
            </div>
          </div>

          {/* Botón */}
          <button type="submit" className="btn-login w-100" disabled={disableSubmit}>
            {loading ? "Procesando..." : "Restablecer Contraseña"}
          </button>

          {/* Link volver */}
          <Link to="/" className="forgot-password">
            Volver al inicio de sesión
          </Link>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
