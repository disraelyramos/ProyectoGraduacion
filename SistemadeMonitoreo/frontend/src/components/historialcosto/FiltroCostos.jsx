// frontend/src/components/historialcosto/FiltroCostos.jsx
import React, { useRef } from "react";
import { Row, Col, Form, InputGroup } from "react-bootstrap";
import { FaCalendarAlt } from "react-icons/fa";

const AGRUPAR_OPTIONS = [
  { value: "semana", label: "Semana" },
  { value: "mes", label: "Mes" },
  { value: "anio", label: "Año" },
];

export default function FiltroCostos({
  value,
  onChange,
  disabled,
  catalogLoading = false,
  distritos = [],
  empresas = [],
  contenedores = [],
}) {
  const refIni = useRef(null);
  const refFin = useRef(null);

  const setField = (name, v) => {
    onChange((prev) => ({ ...prev, [name]: String(v ?? "") }));
  };

  const openPicker = (ref) => {
    const el = ref?.current;
    if (!el || disabled) return;

    // Chrome/Edge: abre el datepicker nativo
    if (typeof el.showPicker === "function") {
      el.showPicker();
      return;
    }

    // fallback
    el.focus();
    el.click();
  };

  const disableSelects = disabled || catalogLoading;

  return (
    <Form>
      <Row className="g-3">
        <Col md={4}>
          <Form.Group>
            <Form.Label>Fecha inicio</Form.Label>
            <InputGroup>
              <Form.Control
                ref={refIni}
                type="date"
                value={value.fechaInicio || ""}
                onChange={(e) => setField("fechaInicio", e.target.value)}
                disabled={disabled}
              />
              <InputGroup.Text
                role="button"
                aria-label="Abrir calendario (inicio)"
                onClick={() => openPicker(refIni)}
                style={{ cursor: disabled ? "not-allowed" : "pointer" }}
              >
                <FaCalendarAlt />
              </InputGroup.Text>
            </InputGroup>
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label>Fecha fin</Form.Label>
            <InputGroup>
              <Form.Control
                ref={refFin}
                type="date"
                value={value.fechaFin || ""}
                onChange={(e) => setField("fechaFin", e.target.value)}
                disabled={disabled}
              />
              <InputGroup.Text
                role="button"
                aria-label="Abrir calendario (fin)"
                onClick={() => openPicker(refFin)}
                style={{ cursor: disabled ? "not-allowed" : "pointer" }}
              >
                <FaCalendarAlt />
              </InputGroup.Text>
            </InputGroup>
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label>Agrupar por</Form.Label>
            <Form.Select
              value={value.agruparPor || "mes"}
              onChange={(e) => setField("agruparPor", e.target.value)}
              disabled={disabled}
            >
              {AGRUPAR_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label>Distrito</Form.Label>
            <Form.Select
              value={value.distritoId || ""}
              onChange={(e) => setField("distritoId", e.target.value)}
              disabled={disableSelects}
            >
              <option value="">
                {catalogLoading ? "Cargando..." : "Seleccione un distrito"}
              </option>
              {distritos.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label>Empresa</Form.Label>
            <Form.Select
              value={value.empresaId || ""}
              onChange={(e) => setField("empresaId", e.target.value)}
              disabled={disableSelects}
            >
              <option value="">
                {catalogLoading ? "Cargando..." : "Seleccione una empresa"}
              </option>
              {empresas.map((e1) => (
                <option key={e1.id} value={String(e1.id)}>
                  {e1.nombre}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>

        <Col md={4}>
          <Form.Group>
            <Form.Label>Contenedor</Form.Label>
            <Form.Select
              value={value.contenedorId || ""}
              onChange={(e) => setField("contenedorId", e.target.value)}
              disabled={disabled}
            >
              <option value="">Seleccione un contenedor</option>
              {contenedores.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.codigo}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
        </Col>
      </Row>
    </Form>
  );
}
