import React, { useState } from "react";
import { Form, Button, Card, Row, Col } from "react-bootstrap";
import { FaHistory, FaSearch } from "react-icons/fa";
import "../../styles/historial-recoleccion.css";
import HistorialEnTablas from "./HistorialEnTablas"; // ✅ Importamos la vista de tablas

const HistorialRecoleccion = () => {
  const [formData, setFormData] = useState({
    numeroContenedor: "",
    fechaDesde: "",
    fechaHasta: "",
  });

  const [errors, setErrors] = useState({});
  const [mostrarTablas, setMostrarTablas] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setErrors({ ...errors, [name]: "" }); // limpiar error al escribir
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    let newErrors = {};

    // Validaciones: no deben estar vacíos
    Object.keys(formData).forEach((key) => {
      if (!formData[key].trim()) {
        newErrors[key] = "Este campo es obligatorio";
      }
    });

    setErrors(newErrors);

    // Si no hay errores, mostrar las tablas
    if (Object.keys(newErrors).length === 0) {
      console.log("Filtros aplicados:", formData);
      setMostrarTablas(true);
    } else {
      setMostrarTablas(false);
    }
  };

  return (
    <div className="historial-recoleccion-container p-4 d-flex flex-column align-items-center">
      <Card className="shadow-sm border-0 w-75 mb-5">
        <Card.Body>
          {/* Header */}
          <h4 className="mb-4 d-flex align-items-center">
            <FaHistory className="text-primary me-2" />
            Historial de Recolección
          </h4>
          <hr className="mb-4" />

          <Form onSubmit={handleSubmit}>
            <Row className="mb-3 text-center">
              <Col md={12}>
                <Form.Label className="fw-semibold">
                  Número de contenedor
                </Form.Label>
              </Col>
              <Col md={12} className="d-flex justify-content-center gap-2">
                <Form.Control
                  type="text"
                  name="numeroContenedor"
                  placeholder="Buscar o ingresar número..."
                  value={formData.numeroContenedor}
                  onChange={handleChange}
                  className={`w-50 ${
                    errors.numeroContenedor ? "is-invalid" : ""
                  }`}
                />
                {errors.numeroContenedor && (
                  <div className="invalid-feedback d-block">
                    {errors.numeroContenedor}
                  </div>
                )}
              </Col>
            </Row>

            <Row className="mb-3 text-center">
              <Col md={12}>
                <Form.Label className="fw-semibold">Rango de Fechas</Form.Label>
              </Col>
              <Col
                md={12}
                className="d-flex justify-content-center gap-3 align-items-center"
              >
                <div>
                  <Form.Control
                    type="date"
                    name="fechaDesde"
                    value={formData.fechaDesde}
                    onChange={handleChange}
                    className={`w-100 ${
                      errors.fechaDesde ? "is-invalid" : ""
                    }`}
                  />
                  {errors.fechaDesde && (
                    <div className="invalid-feedback d-block">
                      {errors.fechaDesde}
                    </div>
                  )}
                </div>

                <span className="fw-bold">—</span>

                <div>
                  <Form.Control
                    type="date"
                    name="fechaHasta"
                    value={formData.fechaHasta}
                    onChange={handleChange}
                    className={`w-100 ${
                      errors.fechaHasta ? "is-invalid" : ""
                    }`}
                  />
                  {errors.fechaHasta && (
                    <div className="invalid-feedback d-block">
                      {errors.fechaHasta}
                    </div>
                  )}
                </div>
              </Col>
            </Row>

            {/* Botón Ver */}
            <div className="d-flex justify-content-center mt-4">
              <Button type="submit" variant="primary" className="px-4">
                <FaSearch className="me-2" />
                Ver
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>

      {/* 🔹 Renderizar tablas debajo con espacio */}
      {mostrarTablas && (
        <div className="w-100 d-flex flex-column align-items-center gap-5">
          <HistorialEnTablas />
        </div>
      )}
    </div>
  );
};

export default HistorialRecoleccion;
