import React, { useEffect, useState } from "react";
import { Modal, Button, Form, Alert } from "react-bootstrap";
import { showConfirmAlert, showSuccessAlert } from "../../utils/alerts";
import apiClient from "../../utils/apiClient";
import "../../styles/nuevo-registro.css";

const ModalCosto = ({ show, handleClose, handleOpenTotales }) => {
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [costoVigente, setCostoVigente] = useState("");
  const [costoInput, setCostoInput] = useState("");

  const [sinCostoVigente, setSinCostoVigente] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchCostoGlobal = async () => {
      if (!show) return;

      setLoading(true);
      setError("");
      setSinCostoVigente(false);
      setIsEditing(false);
      setCostoVigente("");
      setCostoInput("");

      try {
        const res = await apiClient.get("/control-dsh/registro-pesaje/costo-global");
        const c = res.data?.costo_por_libra;

        setCostoVigente(c != null ? String(c) : "");
        setCostoInput(c != null ? String(c) : "");
      } catch (err) {
        if (err?.response?.status === 404) {
          // No hay costo: obligar a registrar
          setSinCostoVigente(true);
          setIsEditing(true);
          setCostoInput("");
        } else {
          setError(err?.response?.data?.message || "Error obteniendo costo global");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchCostoGlobal();
  }, [show]);

  const validarCosto = (v) => {
    const s = String(v ?? "").trim();
    if (!s) return "Debe ingresar un costo";
    if (!/^\d+(\.\d{1,4})?$/.test(s)) return "Formato inválido (ej: 12, 12.5, 12.2500)";
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return "Costo inválido";
    return "";
  };

  const guardarCostoGlobal = async (costoNum) => {
    await apiClient.post("/control-dsh/registro-pesaje/costo-global", {
      costo_por_libra: costoNum,
    });
  };

  const handleEditSave = () => {
    if (loading) return;

    if (!isEditing) {
      setIsEditing(true);
      setError("");
      return;
    }

    const e = validarCosto(costoInput);
    if (e) {
      setError(e);
      return;
    }

    showConfirmAlert(
      "¿Desea guardar el costo por libra?",
      "Se aplicará como costo global (Bioinfeccioso y Punzocortante).",
      async () => {
        try {
          setLoading(true);
          const costoNum = Number(costoInput);
          await guardarCostoGlobal(costoNum);

          setCostoVigente(String(costoNum));
          setSinCostoVigente(false);
          setIsEditing(false);

          await showSuccessAlert("Costo guardado correctamente");

          // ✅ Continuar a totales: ya quedó guardado en BD
          handleOpenTotales({
            editar_costo: false,
            costo_por_libra_vigente: costoNum,
          });
        } catch (err) {
          setError(err?.response?.data?.message || "Error guardando costo global");
        } finally {
          setLoading(false);
        }
      },
      () => handleClose()
    );
  };

  const handleOmitir = () => {
    if (loading) return;

    if (sinCostoVigente) {
      setError("No hay costo vigente. Debe ingresar uno para continuar.");
      return;
    }

    showConfirmAlert(
      "¿Desea continuar con el costo actual?",
      "Se usará el último costo global vigente.",
      () => {
        handleOpenTotales({
          editar_costo: false,
          costo_por_libra_vigente: Number(costoVigente || 0),
        });
      },
      () => handleClose()
    );
  };

  return (
    <Modal show={show} onHide={handleClose} centered>
      <Modal.Header className="modal-costo-header">
        <Modal.Title>Costo por libra (Global)</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {sinCostoVigente && (
          <Alert variant="warning">
            No hay costo global vigente. <strong>Debe registrar un costo para continuar.</strong>
          </Alert>
        )}

        {error && (
          <Alert variant="danger">{error}</Alert>
        )}

        <Form>
          <Form.Group controlId="formCosto">
            <Form.Label>{sinCostoVigente ? "Ingrese costo inicial" : "Costo vigente"}</Form.Label>
            <Form.Control
              type="number"
              value={costoInput}
              disabled={!isEditing || loading}
              onChange={(e) => setCostoInput(e.target.value)}
              className={error ? "is-invalid" : ""}
            />
          </Form.Group>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button
          variant={isEditing ? "success" : "primary"}
          onClick={handleEditSave}
          disabled={loading}
        >
          {isEditing ? "Guardar" : "Editar"}
        </Button>

        <Button
          variant="secondary"
          onClick={handleOmitir}
          disabled={loading || sinCostoVigente}
        >
          Omitir
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ModalCosto;
