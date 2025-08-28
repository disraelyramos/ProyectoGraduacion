import React, { useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { showConfirmAlert, showSuccessAlert } from "../../utils/alerts"; // ✅ agregado showSuccessAlert
import "../../styles/nuevo-registro.css";

const ModalTotales = ({ show, handleClose, handleShowRecoleccion }) => {
  const [formData] = useState({
    totalLibras: "",
    porcentajeRecolectado: "",
    porcentajeLlenado: "",
    tipoDesecho: "",
    totalCostos: "",
  });

  // 🔹 Botón Cancelar con confirmación
  const handleCancel = () => {
    showConfirmAlert(
      "¿Desea cancelar el pasaje?",
      "Si confirma, se cerrará el modal.",
      () => {
        console.log("Modal cancelado por usuario.");
        handleClose();
      },
      () => {
        console.log("Usuario decidió no cancelar, modal sigue abierto.");
      }
    );
  };

  // 🔹 Botón Calcular con alerta de éxito y mostrar vista
  const handleCalcular = () => {
    showSuccessAlert("Cálculo realizado exitosamente").then(() => {
      console.log("Cálculo confirmado, mostrando vista RegistroRecoleccion.");
      handleClose();
      if (typeof handleShowRecoleccion === "function") {
        handleShowRecoleccion(); // abrir vista a la par del card
      }
    });
  };

  return (
    <Modal show={show} onHide={handleClose} centered size="lg">
      <Modal.Header className="modal-costo-header">
        <Modal.Title>Total en libras y Costos</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Row>
            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Total en libras</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.totalLibras}
                  disabled
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>% de desechos recolectados</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.porcentajeRecolectado}
                  disabled
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>% de llenado</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.porcentajeLlenado}
                  disabled
                />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Tipo de desecho</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.tipoDesecho}
                  disabled
                />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Total de costos (Q)</Form.Label>
                <Form.Control
                  type="text"
                  value={formData.totalCostos}
                  disabled
                />
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="success" onClick={handleCalcular}>
          Calcular
        </Button>
        <Button variant="secondary" onClick={handleCancel}>
          Cancelar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ModalTotales;
