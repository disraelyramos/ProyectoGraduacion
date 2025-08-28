import React, { useState } from "react";
import { Card, Form, Button } from "react-bootstrap";
import {
  FaInfoCircle,
  FaExclamationTriangle,
  FaBell,
  FaWeightHanging,
} from "react-icons/fa";
import { showConfirmAlert, showSuccessAlert } from "../../utils/alerts";
import AlertasProgramadas from "./AlertasProgramadas"; // ✅ misma carpeta
import "../../styles/umbral-llenado.css";


const UmbralDeLlenado = () => {
  const [formData, setFormData] = useState({
    casiLleno: "",
    lleno: "",
    pesoCritico: "",
    predictiva: "",
  });

  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(true);
  const [mostrarAlertas, setMostrarAlertas] = useState(false); // ✅ controlar vista

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" });
  };

  const validate = () => {
    let newErrors = {};
    if (!formData.casiLleno) newErrors.casiLleno = "Debe seleccionar una opción";
    if (!formData.lleno) newErrors.lleno = "Debe seleccionar una opción";
    if (!formData.pesoCritico) newErrors.pesoCritico = "Debe seleccionar una opción";
    return newErrors;
  };

  const handleSave = () => {
    if (!isEditing) {
      setIsEditing(true);
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    showConfirmAlert(
      "¿Desea guardar los cambios?",
      "Se aplicarán los umbrales seleccionados.",
      () => {
        setIsEditing(false);
        showSuccessAlert("¡Guardado correctamente!");
      },
      () => {
        setFormData({
          casiLleno: "",
          lleno: "",
          pesoCritico: "",
          predictiva: "",
        });
        setErrors({});
      }
    );
  };

  return (
    <div className="d-flex p-4">
      {/* Columna izquierda (50%) → Umbral de Llenado */}
      <div className="col-6 pe-4">
        <h4 className="fw-bold d-flex align-items-center mb-4">
          <FaInfoCircle className="text-primary me-2" /> Umbral de Llenado
        </h4>

        {/* Nivel Mínimo para Alerta de Casi Lleno */}
        <Card className="mb-4 shadow-sm border-0 w-100">
          <Card.Body>
            <h6 className="fw-bold text-warning d-flex align-items-center">
              <FaExclamationTriangle className="me-2" />
              Nivel Mínimo para Alerta de Casi Lleno
            </h6>
            <hr />
            <Form>
              {["40%", "50%", "60%"].map((op) => (
                <Form.Check
                  key={op}
                  type="radio"
                  name="casiLleno"
                  label={op}
                  value={op}
                  checked={formData.casiLleno === op}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={errors.casiLleno ? "is-invalid" : ""}
                />
              ))}
              {errors.casiLleno && (
                <div className="invalid-feedback d-block">{errors.casiLleno}</div>
              )}
            </Form>
          </Card.Body>
        </Card>

        {/* Nivel para Alertas de Lleno */}
        <Card className="mb-4 shadow-sm border-0 w-100">
          <Card.Body>
            <h6 className="fw-bold text-danger d-flex align-items-center">
              <FaExclamationTriangle className="me-2" />
              Nivel para Alertas de Lleno
            </h6>
            <hr />
            <Form>
              {["70%", "80%", "90%"].map((op) => (
                <Form.Check
                  key={op}
                  type="radio"
                  name="lleno"
                  label={op}
                  value={op}
                  checked={formData.lleno === op}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={errors.lleno ? "is-invalid" : ""}
                />
              ))}
              {errors.lleno && (
                <div className="invalid-feedback d-block">{errors.lleno}</div>
              )}
            </Form>
          </Card.Body>
        </Card>

        {/* Nivel Crítico de Peso */}
        <Card className="mb-4 shadow-sm border-0 w-100">
          <Card.Body>
            <h6 className="fw-bold d-flex align-items-center">
              <FaWeightHanging className="me-2" />
              Nivel Crítico de Peso
            </h6>
            <hr />
            <Form>
              {["100 kg", "300 kg", "400 kg"].map((op) => (
                <Form.Check
                  key={op}
                  type="radio"
                  name="pesoCritico"
                  label={op}
                  value={op}
                  checked={formData.pesoCritico === op}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className={errors.pesoCritico ? "is-invalid" : ""}
                />
              ))}
              {errors.pesoCritico && (
                <div className="invalid-feedback d-block">{errors.pesoCritico}</div>
              )}
            </Form>
          </Card.Body>
        </Card>

        {/* Alertas Predictivas */}
        <Card className="mb-4 shadow-sm border-0 w-100">
          <Card.Body>
            <h6 className="fw-bold text-info d-flex align-items-center">
              <FaBell className="me-2" />
              Alertas Predictivas
            </h6>
            <hr />
            <Form>
              {["Una semana antes", "3 días antes", "Un mes antes"].map((op) => (
                <Form.Check
                  key={op}
                  type="radio"
                  name="predictiva"
                  label={op}
                  value={op}
                  checked={formData.predictiva === op}
                  onChange={handleChange}
                  disabled={!isEditing}
                />
              ))}
            </Form>
          </Card.Body>
        </Card>

        {/* Botón Guardar/Editar + Configurar alertas */}
        <div className="d-flex gap-2">
          <Button
            variant={isEditing ? "success" : "primary"}
            onClick={handleSave}
          >
            {isEditing ? "Guardar" : "Editar"}
          </Button>

          <Button
            variant="outline-dark"
            className="btn-configurar-alertas"
            onClick={() => setMostrarAlertas(true)} // ✅ al dar click muestra la vista
          >
            Configurar alertas
          </Button>
        </div>
      </div>

      {/* Columna derecha (50%) → Alertas Programadas */}
      <div className="col-6 ps-4">
        {mostrarAlertas && (
          <Card className="shadow-sm border-0 w-100 p-3">
            <AlertasProgramadas />
          </Card>
        )}
      </div>
    </div>
  );
};

export default UmbralDeLlenado;
