import React, { useCallback, useMemo, useRef, useState } from "react";
import { Form, Button, Card, Row, Col, InputGroup } from "react-bootstrap";
import { FaHistory, FaSearch, FaCalendarAlt } from "react-icons/fa";
import "../../styles/historial-recoleccion.css";
import HistorialEnTablas from "./HistorialEnTablas";
import apiClient from "../../utils/apiClient";

// ===============================
// Constantes (normativa)
// ===============================
const LIMIT = 10;

// ===============================
// Helpers (limpios, reutilizables)
// ===============================
const clampPage = (p, totalPages) => Math.min(Math.max(1, p), totalPages);

const buildValidationErrors = ({ buscarPor, valorBusqueda, fechaInicio, fechaFin }) => {
  const errors = {};

  if (!buscarPor) errors.buscarPor = "Este campo es obligatorio";

  const value = String(valorBusqueda || "").trim();
  if (!value) errors.valorBusqueda = "Este campo es obligatorio";
  else if (value.length < 2) errors.valorBusqueda = "Ingrese al menos 2 caracteres";

  if (!fechaInicio) errors.fechaInicio = "Este campo es obligatorio";
  if (!fechaFin) errors.fechaFin = "Este campo es obligatorio";

  if (fechaInicio && fechaFin) {
    const ini = new Date(`${fechaInicio}T00:00:00`);
    const fin = new Date(`${fechaFin}T23:59:59`);
    if (ini > fin) errors.fechaFin = "La fecha final no puede ser menor a la inicial";
  }

  return errors;
};

const getErrorMessage = (err) =>
  err?.response?.data?.message || err?.message || "No se pudo conectar con el servidor.";

const tryOpenNativeDatePicker = (inputEl) => {
  if (!inputEl) return;


  if (typeof inputEl.showPicker === "function") {
    inputEl.showPicker();
    return;
  }

  // Fallback
  inputEl.focus();
  inputEl.click();
};

// ===============================
// Componente DateField (pro)
// ===============================
const DateField = ({ name, value, error, inputRef, onChange }) => {
  const handleIconClick = () => tryOpenNativeDatePicker(inputRef?.current);

  return (
    <div>
      <InputGroup>
        <Form.Control
          ref={inputRef}
          type="date"
          name={name}
          value={value}
          onChange={onChange}
          className={error ? "is-invalid" : ""}
        />
        <InputGroup.Text
          role="button"
          tabIndex={0}
          title="Abrir calendario"
          style={{ cursor: "pointer" }}
          onClick={handleIconClick}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") handleIconClick();
          }}
        >
          <FaCalendarAlt />
        </InputGroup.Text>
      </InputGroup>

      {error && <div className="invalid-feedback d-block">{error}</div>}
    </div>
  );
};

// ===============================
// Página principal
// ===============================
const HistorialRecoleccion = () => {
  const [formData, setFormData] = useState({
    buscarPor: "", 
    valorBusqueda: "",
    fechaInicio: "",
    fechaFin: "",
    order: "desc", 
  });

  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const [detalle, setDetalle] = useState([]);
  const [pesaje, setPesaje] = useState([]);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [serverMessage, setServerMessage] = useState("");

  // Tablas SOLO después de “Ver”
  const [hasSearched, setHasSearched] = useState(false);

  // Refs para datepicker con ícono
  const fechaInicioRef = useRef(null);
  const fechaFinRef = useRef(null);

  const totalPages = useMemo(() => Math.max(1, Math.ceil((total || 0) / LIMIT)), [total]);

  const resetResults = useCallback(() => {
    setDetalle([]);
    setPesaje([]);
    setTotal(0);
    setPage(1);
  }, []);

  const clearErrorsFor = useCallback((name) => {
    setErrors((prev) => (prev[name] ? { ...prev, [name]: "" } : prev));
  }, []);

  const handleChange = useCallback(
    (e) => {
      const { name, value } = e.target;

      setFormData((prev) => ({ ...prev, [name]: value }));
      clearErrorsFor(name);

      // Si cambia un filtro, ocultar tablas hasta que presione “Ver”
      setHasSearched(false);
      setServerMessage("");
      resetResults();
    },
    [clearErrorsFor, resetResults]
  );

  const fetchHistorial = useCallback(
    async (targetPage = 1) => {
      setLoading(true);
      setServerMessage("");

      try {
        const res = await apiClient.get("/historial-recoleccion", {
          params: {
            buscarPor: formData.buscarPor,
            valorBusqueda: String(formData.valorBusqueda || "").trim(),
            fechaInicio: formData.fechaInicio,
            fechaFin: formData.fechaFin,
            page: targetPage,
            limit: LIMIT,
            order: formData.order,
          },
        });

        const data = res.data || {};

        setServerMessage(data?.message || "");
        setTotal(Number(data?.total || 0));

        const nextPage = Number(data?.page || targetPage);
        setPage(nextPage);

        setDetalle(data?.data?.detalle || []);
        setPesaje(data?.data?.pesaje || []);
      } catch (err) {
        resetResults();
        setServerMessage(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [formData, resetResults]
  );

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      const validationErrors = buildValidationErrors(formData);
      setErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        setHasSearched(false);
        setServerMessage("");
        resetResults();
        return;
      }

      setHasSearched(true);

      const targetPage = 1;
      setPage(targetPage);
      await fetchHistorial(targetPage);
    },
    [fetchHistorial, formData, resetResults]
  );

  const handlePageChange = useCallback(
    async (nextPage) => {
      if (loading) return;

      const safeNext = clampPage(nextPage, totalPages);
      if (safeNext === page) return;

      setPage(safeNext);
      await fetchHistorial(safeNext);
    },
    [fetchHistorial, loading, page, totalPages]
  );

  return (
    <div className="historial-recoleccion-container p-4 d-flex flex-column align-items-center">
      <Card className="shadow-sm border-0 w-100 mb-4">
        <Card.Body>
          <h4 className="mb-4 d-flex align-items-center">
            <FaHistory className="text-primary me-2" />
            Historial de Recolección
          </h4>
          <hr className="mb-4" />

          <Form onSubmit={handleSubmit}>
            {/* Buscar por */}
            <Row className="mb-3 text-center">
              <Col md={12}>
                <Form.Label className="fw-semibold">Buscar por</Form.Label>
              </Col>

              <Col md={12} className="d-flex justify-content-center">
                <Form.Select
                  name="buscarPor"
                  value={formData.buscarPor}
                  onChange={handleChange}
                  className={`w-50 ${errors.buscarPor ? "is-invalid" : ""}`}
                >
                  <option value="">Seleccione…</option>
                  <option value="codigo">Código</option>
                  <option value="tipo">Tipo Residuo</option>
                </Form.Select>
              </Col>

              {errors.buscarPor && (
                <div className="invalid-feedback d-block text-center">{errors.buscarPor}</div>
              )}
            </Row>

            {/* Valor búsqueda */}
            <Row className="mb-3 text-center">
              <Col md={12}>
                <Form.Label className="fw-semibold">Búsqueda</Form.Label>
              </Col>

              <Col md={12} className="d-flex justify-content-center">
                <Form.Control
                  type="text"
                  name="valorBusqueda"
                  placeholder="Ej: CNT-001 o Bioinfeccioso..."
                  value={formData.valorBusqueda}
                  onChange={handleChange}
                  className={`w-50 ${errors.valorBusqueda ? "is-invalid" : ""}`}
                />
              </Col>

              {errors.valorBusqueda && (
                <div className="invalid-feedback d-block text-center">{errors.valorBusqueda}</div>
              )}
            </Row>

            {/* Rango de fechas (con icono) */}
            <Row className="mb-3 text-center">
              <Col md={12}>
                <Form.Label className="fw-semibold">Rango de Fechas</Form.Label>
              </Col>

              <Col md={12} className="d-flex justify-content-center gap-3 align-items-center flex-wrap">
                <DateField
                  name="fechaInicio"
                  value={formData.fechaInicio}
                  error={errors.fechaInicio}
                  inputRef={fechaInicioRef}
                  onChange={handleChange}
                />

                <span className="fw-bold">—</span>

                <DateField
                  name="fechaFin"
                  value={formData.fechaFin}
                  error={errors.fechaFin}
                  inputRef={fechaFinRef}
                  onChange={handleChange}
                />
              </Col>
            </Row>

            {/* Orden */}
            <Row className="mb-3 text-center">
              <Col md={12}>
                <Form.Label className="fw-semibold">Orden</Form.Label>
              </Col>

              <Col md={12} className="d-flex justify-content-center">
                <Form.Select
                  name="order"
                  value={formData.order}
                  onChange={handleChange}
                  className="w-50"
                >
                  <option value="desc">Fecha (Más reciente)</option>
                  <option value="asc">Fecha (Más antigua)</option>
                </Form.Select>
              </Col>
            </Row>

            <div className="d-flex justify-content-center mt-4">
              <Button type="submit" variant="primary" className="px-4" disabled={loading}>
                <FaSearch className="me-2" />
                {loading ? "Consultando..." : "Ver"}
              </Button>
            </div>

            {serverMessage && <div className="text-center mt-3 fw-semibold">{serverMessage}</div>}
          </Form>
        </Card.Body>
      </Card>

      {/*Tablas SOLO si ya se presionó "Ver" */}
      {hasSearched && (
        <div className="w-100 d-flex flex-column align-items-center gap-4">
          <HistorialEnTablas
            loading={loading}
            detalle={detalle}
            pesaje={pesaje}
            page={page}
            total={total}
            limit={LIMIT}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default HistorialRecoleccion;
