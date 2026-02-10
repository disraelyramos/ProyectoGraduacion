import React, { useMemo, useState } from "react";
import { Modal, Button, Form, Row, Col } from "react-bootstrap";
import { toast } from "react-toastify";
import { showConfirmAlert, showSuccessAlert } from "../../utils/alerts";
import apiClient from "../../utils/apiClient";
import "../../styles/nuevo-registro.css";

const clamp0to100 = (n) => Math.min(100, Math.max(0, Number.isFinite(+n) ? +n : 0));

const pctLitros = (actual, cap) => {
  const a = Number(actual) || 0;
  const c = Number(cap) || 0;
  return c > 0 ? clamp0to100((a / c) * 100) : 0;
};

const ModalTotales = ({
  show,
  handleClose,
  handleShowRecoleccion,
  onCancel,
  idTipoResiduo,
  contenedor,
  decisionCosto,
}) => {
  const [saving, setSaving] = useState(false);

  const tipoTexto = useMemo(
    () => (idTipoResiduo === 1 ? "Bioinfeccioso" : idTipoResiduo === 2 ? "Punzocortante" : ""),
    [idTipoResiduo]
  );

  const costoAplicado = useMemo(() => {
    if (!decisionCosto) return 0;
    const v = decisionCosto.editar_costo ? decisionCosto.nuevo_costo_por_libra : decisionCosto.costo_por_libra_vigente;
    return Number(v) || 0;
  }, [decisionCosto]);

  const preview = useMemo(() => {
    const totalLb = Number(contenedor?.estado_actual_lb) || 0;
    const totalQ = Number((totalLb * costoAplicado).toFixed(2));

    const actualLitros = Number(contenedor?.estado_actual_litros) || 0;
    const capLitros = Number(contenedor?.capacidad_max_litros) || 0;

    return {
      totalLb,
      totalQ,
      pctLlenado: Number(pctLitros(actualLitros, capLitros).toFixed(2)),
      pctRecolectado: 0, // se calcula al final en Foto 4
    };
  }, [contenedor, costoAplicado]);

  const handleCancelar = () =>
    showConfirmAlert(
      "¿Desea cancelar el proceso?",
      "Si confirma, se cerrará y deberá iniciar desde cero.",
      () => onCancel?.(),
      () => {}
    );

  const handleCalcular = async () => {
    if (!idTipoResiduo || !contenedor?.id_contenedor) return toast.error("Faltan datos para calcular.");

    setSaving(true);
    try {
      const payload = {
        id_tipo_residuo: idTipoResiduo,
        contenedor_id: contenedor.id_contenedor,
        // estos 2 vienen por compatibilidad, aunque el backend actual ya no los usa para guardar nada
        editar_costo: Boolean(decisionCosto?.editar_costo),
        nuevo_costo_por_libra: decisionCosto?.editar_costo ? decisionCosto?.nuevo_costo_por_libra : null,
      };

      const res = await apiClient.post("/control-dsh/registro-pesaje/calculo", payload);

      await showSuccessAlert("Cálculo realizado exitosamente");

      handleClose();
      // ✅ res.data ahora debe traer proceso_token + datos preview
      handleShowRecoleccion(res.data);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Error al calcular");
    } finally {
      setSaving(false);
    }
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
                <Form.Control type="text" value={preview.totalLb} disabled />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>% de desechos recolectados</Form.Label>
                <Form.Control type="text" value={preview.pctRecolectado} disabled />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>% de llenado (L)</Form.Label>
                <Form.Control type="text" value={preview.pctLlenado} disabled />
              </Form.Group>
            </Col>

            <Col md={6}>
              <Form.Group className="mb-3">
                <Form.Label>Tipo de desecho</Form.Label>
                <Form.Control type="text" value={tipoTexto} disabled />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Costo aplicado (Q/LB)</Form.Label>
                <Form.Control type="text" value={costoAplicado} disabled />
              </Form.Group>

              <Form.Group className="mb-3">
                <Form.Label>Total de costos (Q)</Form.Label>
                <Form.Control type="text" value={preview.totalQ} disabled />
              </Form.Group>
            </Col>
          </Row>
        </Form>
      </Modal.Body>

      <Modal.Footer>
        <Button variant="success" onClick={handleCalcular} disabled={saving}>
          Calcular
        </Button>

        <Button variant="secondary" onClick={handleCancelar} disabled={saving}>
          Cancelar
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default ModalTotales;
