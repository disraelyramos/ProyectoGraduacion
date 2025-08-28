import React, { useState } from "react";
import { Form, Button, Row, Col, Card } from "react-bootstrap";
import { FaClipboardList } from "react-icons/fa";
import "../../styles/nuevo-registro.css";

const RegistroRecoleccion = () => {
  const [formData, setFormData] = useState({
    codigoContenedor: "",
    fechaRecoleccion: "",
    distrito: "",
    numeroRecibo: "",
    responsable: "",
    empresaRecolectora: "",
    porcentajePendiente: "75", // ejemplo precargado
    librasPendientes: "",
    observaciones: "",
  });

  const [errors, setErrors] = useState({});

  // 🔹 Validaciones personalizadas
  const validateField = (name, value) => {
    let error = "";

    // Campos solo letras
    const onlyLetters = ["distrito", "responsable", "empresaRecolectora"];
    if (onlyLetters.includes(name) && !/^[a-zA-Z\s]*$/.test(value)) {
      error = "Solo se permiten letras";
    }

    // Campos solo números
    const onlyNumbers = ["codigoContenedor", "numeroRecibo", "librasPendientes"];
    if (onlyNumbers.includes(name) && !/^\d*$/.test(value)) {
      error = "Solo se permiten números";
    }

    // Campos requeridos
    if (!value.trim()) {
      error = "Este campo es obligatorio";
    }

    return error;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const error = validateField(name, value);
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: error });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let newErrors = {};

    Object.keys(formData).forEach((key) => {
      newErrors[key] = validateField(key, formData[key]);
    });

    setErrors(newErrors);

    const hasErrors = Object.values(newErrors).some((err) => err);
    if (!hasErrors) {
      console.log("Formulario válido:", formData);
      // Aquí se conecta al backend más adelante
    }
  };

  return (
    <div className="registro-recoleccion-container p-4">
      <Card className="shadow-sm border-0">
        <Card.Body>
          <h4 className="mb-4 d-flex align-items-center">
            <FaClipboardList className="text-primary me-2" />
            Registro de Recolección
          </h4>

          <Form onSubmit={handleSubmit}>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3" controlId="codigoContenedor">
                  <Form.Label>Código del Contenedor</Form.Label>
                  <Form.Control
                    type="text"
                    name="codigoContenedor"
                    value={formData.codigoContenedor}
                    onChange={handleChange}
                    className={errors.codigoContenedor ? "is-invalid" : ""}
                  />
                  {errors.codigoContenedor && (
                    <div className="invalid-feedback">{errors.codigoContenedor}</div>
                  )}
                </Form.Group>

                <Form.Group className="mb-3" controlId="fechaRecoleccion">
                  <Form.Label>Fecha de Recolección</Form.Label>
                  <Form.Control
                    type="date"
                    name="fechaRecoleccion"
                    value={formData.fechaRecoleccion}
                    onChange={handleChange}
                    className={errors.fechaRecoleccion ? "is-invalid" : ""}
                  />
                  {errors.fechaRecoleccion && (
                    <div className="invalid-feedback">{errors.fechaRecoleccion}</div>
                  )}
                </Form.Group>

                <Form.Group className="mb-3" controlId="distrito">
                  <Form.Label>Distrito</Form.Label>
                  <Form.Control
                    type="text"
                    name="distrito"
                    value={formData.distrito}
                    onChange={handleChange}
                    className={errors.distrito ? "is-invalid" : ""}
                  />
                  {errors.distrito && (
                    <div className="invalid-feedback">{errors.distrito}</div>
                  )}
                </Form.Group>

                <Form.Group className="mb-3" controlId="numeroRecibo">
                  <Form.Label>Número de Recibo</Form.Label>
                  <Form.Control
                    type="text"
                    name="numeroRecibo"
                    value={formData.numeroRecibo}
                    onChange={handleChange}
                    className={errors.numeroRecibo ? "is-invalid" : ""}
                  />
                  {errors.numeroRecibo && (
                    <div className="invalid-feedback">{errors.numeroRecibo}</div>
                  )}
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3" controlId="responsable">
                  <Form.Label>Responsable</Form.Label>
                  <Form.Control
                    type="text"
                    name="responsable"
                    value={formData.responsable}
                    onChange={handleChange}
                    className={errors.responsable ? "is-invalid" : ""}
                  />
                  {errors.responsable && (
                    <div className="invalid-feedback">{errors.responsable}</div>
                  )}
                </Form.Group>

                <Form.Group className="mb-3" controlId="empresaRecolectora">
                  <Form.Label>Empresa Recolectora</Form.Label>
                  <Form.Control
                    type="text"
                    name="empresaRecolectora"
                    value={formData.empresaRecolectora}
                    onChange={handleChange}
                    className={errors.empresaRecolectora ? "is-invalid" : ""}
                  />
                  {errors.empresaRecolectora && (
                    <div className="invalid-feedback">{errors.empresaRecolectora}</div>
                  )}
                </Form.Group>

                <Form.Group className="mb-3" controlId="porcentajePendiente">
                  <Form.Label>% DSH Pendientes de Recolectar</Form.Label>
                  <Form.Control
                    type="text"
                    name="porcentajePendiente"
                    value={formData.porcentajePendiente}
                    disabled // 🔹 Bloqueado
                  />
                </Form.Group>

                <Form.Group className="mb-3" controlId="librasPendientes">
                  <Form.Label>Cantidad en Libras Pendientes</Form.Label>
                  <Form.Control
                    type="text"
                    name="librasPendientes"
                    value={formData.librasPendientes}
                    onChange={handleChange}
                    className={errors.librasPendientes ? "is-invalid" : ""}
                  />
                  {errors.librasPendientes && (
                    <div className="invalid-feedback">{errors.librasPendientes}</div>
                  )}
                </Form.Group>
              </Col>
            </Row>

            {/* 🔹 Nuevo campo Observaciones */}
            <Row>
              <Col md={12}>
                <Form.Group className="mb-3" controlId="observaciones">
                  <Form.Label>Observaciones</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="observaciones"
                    value={formData.observaciones}
                    onChange={handleChange}
                    className={errors.observaciones ? "is-invalid" : ""}
                  />
                  {errors.observaciones && (
                    <div className="invalid-feedback">{errors.observaciones}</div>
                  )}
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex justify-content-end">
              <Button type="submit" variant="success">
                Guardar
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default RegistroRecoleccion;
