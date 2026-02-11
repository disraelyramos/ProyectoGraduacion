
// frontend/src/pages/controlDSH/RegistroRecoleccion.jsx
import React, { useEffect, useMemo, useState } from "react";
import { Form, Button, Row, Col, Card, Spinner } from "react-bootstrap";
import { FaClipboardList } from "react-icons/fa";
import { toast } from "react-toastify";
import apiClient from "../../utils/apiClient";
import "../../styles/nuevo-registro.css";

const RegistroRecoleccion = ({
  codigoContenedor = "",
  responsableNombre = "",
  procesoToken = "", 
  porcentajePendiente = 0,
  onPreviewPendiente,
  onCancel,
  onFinish,
}) => {
  // Fecha visual dd/mm/yy (solo display)
  const fechaDisplay = useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yy = String(d.getFullYear()).slice(-2);
    return `${dd}/${mm}/${yy}`;
  }, []);

  // Catálogos
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [distritos, setDistritos] = useState([]);
  const [empresas, setEmpresas] = useState([]);

  const [formData, setFormData] = useState({
    codigoContenedor: codigoContenedor || "",
    responsable: responsableNombre || "",
    fechaRecoleccion: fechaDisplay, // solo visual

    // IDs (strings en UI, se convierten a number al enviar)
    distrito_id: "",
    empresa_id: "",

    numeroRecibo: "",
    librasPendientes: "",
    observaciones: "",
  });

  // Sincroniza cuando llegue/actualice el código o el responsable (sin pisar con vacíos)
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      ...(codigoContenedor ? { codigoContenedor } : {}),
      ...(responsableNombre ? { responsable: responsableNombre } : {}),
    }));
  }, [codigoContenedor, responsableNombre]);

  // cargar catálogos (distritos / empresas)
  useEffect(() => {
    let mounted = true;

    const loadCatalogos = async () => {
      setCatalogLoading(true);
      try {
        const [resDist, resEmp] = await Promise.all([
          apiClient.get("/control-dsh/catalogos/distritos"),
          apiClient.get("/control-dsh/catalogos/empresas"),
        ]);

        if (!mounted) return;

        setDistritos(Array.isArray(resDist.data) ? resDist.data : []);
        setEmpresas(Array.isArray(resEmp.data) ? resEmp.data : []);
      } catch (err) {
        console.error(err);
        toast.error("No se pudieron cargar distritos/empresas.");
      } finally {
        if (mounted) setCatalogLoading(false);
      }
    };

    loadCatalogos();
    return () => {
      mounted = false;
    };
  }, []);

  const [errors, setErrors] = useState({});

  const validateField = (name, value) => {
    const v = String(value ?? "").trim();

    // Requeridos (excepto observaciones)
    const required = ["distrito_id", "empresa_id", "numeroRecibo", "librasPendientes"];
    if (required.includes(name) && !v) return "Este campo es obligatorio";

    // IDs deben ser numéricos > 0
    if ((name === "distrito_id" || name === "empresa_id") && v) {
      const n = Number(v);
      if (!Number.isFinite(n) || n <= 0) return "Seleccione una opción válida";
    }

    // Número de recibo: obligatorio y solo letras/números/guiones
    if (name === "numeroRecibo" && v && !/^[a-zA-Z0-9\-]+$/.test(v)) {
      return "Use solo letras, números o guiones";
    }

    // Libras: numérico, permite decimales (2)
    if (name === "librasPendientes" && v && !/^\d+(\.\d{1,2})?$/.test(v)) {
      return "Ej: 0, 10, 10.5";
    }

    return "";
  };

  const setField = (name, value) => {
    const error = validateField(name, value);

    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: error }));

    if (name === "librasPendientes") onPreviewPendiente?.(value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const keysToValidate = ["distrito_id", "empresa_id", "numeroRecibo", "librasPendientes"];
    const newErrors = {};
    for (const k of keysToValidate) newErrors[k] = validateField(k, formData[k]);

    setErrors(newErrors);
    if (Object.values(newErrors).some(Boolean)) return;

    if (!String(procesoToken || "").trim()) {
      toast.error("No existe token de proceso. Vuelva a calcular.");
      return;
    }

    const payload = {
      proceso_token: String(procesoToken).trim(), 
      empresa_id: Number(formData.empresa_id),
      distrito_id: Number(formData.distrito_id),
      numero_recibo: String(formData.numeroRecibo).trim(),
      cantidad_libras_pendientes: Number(formData.librasPendientes),
      observaciones: String(formData.observaciones || "").trim() || null,
    };

    setSaving(true);
    try {
      await apiClient.post("/control-dsh/registro-pesaje/recoleccion", payload);

      toast.success("Recolección guardada.");
      onFinish?.();
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || "Error guardando recolección";

      // opcional: mensaje más claro si expira el token
      if (status === 401) toast.error(msg || "Token expirado. Vuelva a calcular.");
      else toast.error(msg);
    } finally {
      setSaving(false);
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
                  <Form.Control type="text" value={formData.codigoContenedor} disabled />
                </Form.Group>

                <Form.Group className="mb-3" controlId="fechaRecoleccion">
                  <Form.Label>Fecha de Recolección</Form.Label>
                  <Form.Control type="text" value={formData.fechaRecoleccion} disabled />
                </Form.Group>

                <Form.Group className="mb-3" controlId="distrito_id">
                  <Form.Label>Distrito</Form.Label>
                  <Form.Select
                    name="distrito_id"
                    value={formData.distrito_id}
                    disabled={catalogLoading || saving}
                    onChange={(e) => setField("distrito_id", e.target.value)}
                    className={errors.distrito_id ? "is-invalid" : ""}
                  >
                    <option value="">{catalogLoading ? "Cargando..." : "Seleccione un distrito"}</option>
                    {distritos.map((d) => (
                      <option key={d.id} value={String(d.id)}>
                        {d.nombre}
                      </option>
                    ))}
                  </Form.Select>
                  {errors.distrito_id && <div className="invalid-feedback">{errors.distrito_id}</div>}
                </Form.Group>

                <Form.Group className="mb-3" controlId="numeroRecibo">
                  <Form.Label>Número de Recibo</Form.Label>
                  <Form.Control
                    type="text"
                    name="numeroRecibo"
                    value={formData.numeroRecibo}
                    disabled={saving}
                    onChange={(e) => setField("numeroRecibo", e.target.value)}
                    className={errors.numeroRecibo ? "is-invalid" : ""}
                  />
                  {errors.numeroRecibo && <div className="invalid-feedback">{errors.numeroRecibo}</div>}
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3" controlId="responsable">
                  <Form.Label>Responsable</Form.Label>
                  <Form.Control type="text" value={formData.responsable || "(usuario logeado)"} disabled />
                </Form.Group>

                <Form.Group className="mb-3" controlId="empresa_id">
                  <Form.Label>Empresa Recolectora</Form.Label>
                  <Form.Select
                    name="empresa_id"
                    value={formData.empresa_id}
                    disabled={catalogLoading || saving}
                    onChange={(e) => setField("empresa_id", e.target.value)}
                    className={errors.empresa_id ? "is-invalid" : ""}
                  >
                    <option value="">{catalogLoading ? "Cargando..." : "Seleccione una empresa"}</option>
                    {empresas.map((em) => (
                      <option key={em.id} value={String(em.id)}>
                        {em.nombre}
                      </option>
                    ))}
                  </Form.Select>
                  {errors.empresa_id && <div className="invalid-feedback">{errors.empresa_id}</div>}
                </Form.Group>

                <Form.Group className="mb-3" controlId="porcentajePendiente">
                  <Form.Label>% DSH Pendientes de Recolectar</Form.Label>
                  <Form.Control type="text" value={Number(porcentajePendiente || 0).toFixed(2)} disabled />
                </Form.Group>

                <Form.Group className="mb-3" controlId="librasPendientes">
                  <Form.Label>Cantidad en Libras Pendientes</Form.Label>
                  <Form.Control
                    type="text"
                    name="librasPendientes"
                    value={formData.librasPendientes}
                    disabled={saving}
                    onChange={(e) => setField("librasPendientes", e.target.value)}
                    placeholder="Ej: 0, 10, 10.5"
                    className={errors.librasPendientes ? "is-invalid" : ""}
                  />
                  {errors.librasPendientes && <div className="invalid-feedback">{errors.librasPendientes}</div>}
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={12}>
                <Form.Group className="mb-3" controlId="observaciones">
                  <Form.Label>Observaciones (opcional)</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={formData.observaciones}
                    disabled={saving}
                    onChange={(e) => setField("observaciones", e.target.value)}
                  />
                </Form.Group>
              </Col>
            </Row>

            <div className="d-flex justify-content-end gap-2">
              <Button type="button" variant="secondary" onClick={() => onCancel?.()} disabled={saving}>
                Cancelar
              </Button>

              <Button type="submit" variant="success" disabled={catalogLoading || saving}>
                {catalogLoading || saving ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    {catalogLoading ? "Cargando..." : "Guardando..."}
                  </>
                ) : (
                  "Guardar"
                )}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </div>
  );
};

export default RegistroRecoleccion;
