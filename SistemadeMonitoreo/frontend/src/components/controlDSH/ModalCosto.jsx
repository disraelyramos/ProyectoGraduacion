import React, { useState } from "react";
import { Modal, Button, Form } from "react-bootstrap";
import { showConfirmAlert, showSuccessAlert } from "../../utils/alerts";
import "../../styles/nuevo-registro.css";

const ModalCosto = ({ show, handleClose, handleOpenTotales }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [costo, setCosto] = useState("");
  const [error, setError] = useState("");

  const handleEditSave = () => {
    if (!isEditing) {
      // Cambiar a modo edición
      setIsEditing(true);
      setError("");
    } else {
      // Validar antes de guardar
      if (costo.trim() === "" || isNaN(costo)) {
        setError("Debe ser un valor numérico");
        return;
      }

      setError("");

      //  Confirmación antes de guardar
      showConfirmAlert(
        "¿Desea guardar el costo por libra?",
        "Este valor será almacenado en el sistema.",
        () => {
          console.log("Costo guardado:", costo);

          //  Bloquear campo y limpiar después de guardar
          setIsEditing(false);
          setCosto("");

          // Mostrar alerta de éxito y redirigir al modal de totales
          showSuccessAlert("Guardado correctamente").then(() => {
            if (typeof handleOpenTotales === "function") {
              handleOpenTotales(); // abrir modal totales al dar OK
            }
          });
        },
        () => {
          //  Si cancela, cerramos el modal
          console.log("Usuario canceló la acción. Modal cerrado.");
          handleClose();
        }
      );
    }
  };

  // Acción para el botón Omitir
  const handleOmitir = () => {
    showConfirmAlert(
      "¿Desea continuar con el costo actual?",
      "Si confirma, se abrirá el modal de totales.",
      () => {
        console.log("Usuario decidió continuar con costo actual.");
        if (typeof handleOpenTotales === "function") {
          handleOpenTotales(); // abrir modal totales
        }
      },
      () => {
        console.log("Usuario eligió no continuar. Modal cerrado.");
        handleClose();
      }
    );
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header className="modal-costo-header">
        <Modal.Title>Costo por libra</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group controlId="formCosto">
            <Form.Label>Ingrese el costo</Form.Label>
            <Form.Control
              type="number"
              value={costo}
              disabled={!isEditing}
              onChange={(e) => setCosto(e.target.value)}
              className={error ? "is-invalid" : ""}
            />
            {error && <div className="invalid-feedback">{error}</div>}
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant={isEditing ? "success" : "primary"}
          onClick={handleEditSave}
        >
          {isEditing ? "Guardar" : "Editar"}
        </Button>
        <Button variant="secondary" onClick={handleOmitir}>
          Omitir
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ModalCosto;
