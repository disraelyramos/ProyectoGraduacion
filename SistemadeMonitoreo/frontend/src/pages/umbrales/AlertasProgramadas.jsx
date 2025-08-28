import React, { useState } from "react";
import { Card, Form, Button } from "react-bootstrap";
import {
  FaClock,
  FaPen,
  FaCalendarAlt,
} from "react-icons/fa";
import { showConfirmAlert, showSuccessAlert } from "../../utils/alerts";
import "../../styles/umbral-llenado.css";


const AlertasProgramadas = () => {
  const [formData, setFormData] = useState({
    motivo: "",
    fecha: "",
    hora: "",
  });

  const [errors, setErrors] = useState({});
  const [isEditing, setIsEditing] = useState(true);

  // Manejar cambios de inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" }); // limpiar error al escribir
  };

  // Validaciones
  const validate = () => {
    let newErrors = {};
    if (!formData.motivo.trim())
      newErrors.motivo = "Debe ingresar un motivo";
    if (!formData.fecha)
      newErrors.fecha = "Debe seleccionar una fecha";
    if (!formData.hora)
      newErrors.hora = "Debe seleccionar una hora";
    return newErrors;
  };

  // Guardar / Editar
  const handleSave = () => {
    if (!isEditing) {
      setIsEditing(true); // desbloquear campos
      return;
    }

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    // Confirmación antes de guardar
    showConfirmAlert(
      "¿Desea guardar la alerta programada?",
      "El recordatorio será almacenado en el sistema.",
      () => {
        setIsEditing(false); // bloquear campos
        showSuccessAlert("¡Alerta programada guardada con éxito!");
      },
      () => {
        setFormData({ motivo: "", fecha: "", hora: "" }); // limpiar si cancela
        setErrors({});
      }
    );
  };

  return (
    <div className="p-4">
      <h4 className="fw-bold d-flex align-items-center mb-4">
        <FaClock className="text-dark me-2" /> Establecer Horario
      </h4>

      {/* Motivo */}
      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <h6 className="fw-bold text-primary d-flex align-items-center">
            <FaPen className="me-2" /> Motivo
          </h6>
          <Form.Control
            type="text"
            name="motivo"
            placeholder="Ej: Revisión periódica"
            value={formData.motivo}
            onChange={handleChange}
            disabled={!isEditing}
            className={errors.motivo ? "is-invalid" : ""}
          />
          {errors.motivo && (
            <div className="invalid-feedback d-block">{errors.motivo}</div>
          )}
        </Card.Body>
      </Card>

      {/* Fecha */}
      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <h6 className="fw-bold text-success d-flex align-items-center">
            <FaCalendarAlt className="me-2" /> Fecha
          </h6>
          <Form.Control
            type="date"
            name="fecha"
            value={formData.fecha}
            onChange={handleChange}
            disabled={!isEditing}
            className={errors.fecha ? "is-invalid" : ""}
          />
          {errors.fecha && (
            <div className="invalid-feedback d-block">{errors.fecha}</div>
          )}
        </Card.Body>
      </Card>

      {/* Hora */}
      <Card className="mb-3 shadow-sm border-0">
        <Card.Body>
          <h6 className="fw-bold text-info d-flex align-items-center">
            <FaClock className="me-2" /> Hora
          </h6>
          <Form.Control
            type="time"
            name="hora"
            value={formData.hora}
            onChange={handleChange}
            disabled={!isEditing}
            className={errors.hora ? "is-invalid" : ""}
          />
          {errors.hora && (
            <div className="invalid-feedback d-block">{errors.hora}</div>
          )}
        </Card.Body>
      </Card>

      {/* Botón dinámico */}
      <div>
        <Button
          variant={isEditing ? "primary" : "warning"}
          onClick={handleSave}
        >
          {isEditing ? "Guardar" : "Editar"}
        </Button>
      </div>
    </div>
  );
};

export default AlertasProgramadas;
