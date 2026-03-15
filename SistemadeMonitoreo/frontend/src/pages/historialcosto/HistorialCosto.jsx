// frontend/src/pages/historialcosto/HistorialCosto.jsx
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Card, Row, Col, Button, Spinner } from "react-bootstrap";
import { FaSearch, FaFilePdf, FaFileExcel } from "react-icons/fa";
import { toast } from "react-toastify";
import apiClient from "../../utils/apiClient";

import FiltroCostos from "../../components/historialcosto/FiltroCostos";
import ResumenKpis from "../../components/historialcosto/ResumenKpis";
import TablaResumen from "../../components/historialcosto/TablaResumen";
import PanelRankings from "../../components/historialcosto/PanelRankings";

const TablaDetalle = lazy(() => import("../../components/historialcosto/TablaDetalle"));

const DEFAULT_DETALLE = { total: 0, page: 1, limit: 10, rows: [] };

function downloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

function openBlobInNewTab(blob) {
  const url = window.URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  // no revoke inmediato (para que cargue); lo liberamos “después”
  setTimeout(() => window.URL.revokeObjectURL(url), 60_000);
}

const HistorialCosto = () => {
  const [form, setForm] = useState({
    fechaInicio: "",
    fechaFin: "",
    agruparPor: "mes",
    distritoId: "",
    empresaId: "",
    contenedorId: "",
  });

  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);

  const [catalogos, setCatalogos] = useState({
    distritos: [],
    empresas: [],
    contenedores: [],
    contenedoresLoading: false,
  });

  const [data, setData] = useState({
    exportId: null,
    kpis: null,
    resumen: [],
    topContenedores: [],
    detalle: DEFAULT_DETALLE,
  });

  const canSearch = useMemo(() => {
    return Boolean(
      form.fechaInicio &&
        form.fechaFin &&
        form.distritoId &&
        form.empresaId &&
        form.contenedorId
    );
  }, [form.fechaInicio, form.fechaFin, form.distritoId, form.empresaId, form.contenedorId]);

  // Si cambian filtros, ocultamos resultados hasta que presione "Ver"
  const prevKeyRef = useRef("");
  useEffect(() => {
    const key = JSON.stringify(form);
    if (prevKeyRef.current && prevKeyRef.current !== key) {
      setLoaded(false);
      setData((p) => ({ ...p, exportId: null }));
    }
    prevKeyRef.current = key;
  }, [form]);

  // Catálogos (distritos/empresas)
  useEffect(() => {
    let alive = true;

    const loadCatalogos = async () => {
      setCatalogLoading(true);
      try {
        const [dRes, eRes] = await Promise.all([
          apiClient.get("/control-dsh/catalogos/distritos"),
          apiClient.get("/control-dsh/catalogos/empresas"),
        ]);

        if (!alive) return;

        setCatalogos((prev) => ({
          ...prev,
          distritos: Array.isArray(dRes.data) ? dRes.data : [],
          empresas: Array.isArray(eRes.data) ? eRes.data : [],
        }));
      } catch (e) {
        console.error(e);
        toast.error("No se pudieron cargar distritos/empresas.");
      } finally {
        if (alive) setCatalogLoading(false);
      }
    };

    loadCatalogos();
    return () => {
      alive = false;
    };
  }, []);

  // Contenedores (select)
  const cargarContenedores = async ({ search = "" } = {}) => {
    setCatalogos((prev) => ({ ...prev, contenedoresLoading: true }));
    try {
      const res = await apiClient.get("/codigo-contenedor", {
        params: { search, page: 1, limit: 50 },
      });

      const rows = res.data?.data || res.data?.rows || res.data || [];
      setCatalogos((prev) => ({
        ...prev,
        contenedores: Array.isArray(rows) ? rows : [],
      }));
    } catch (e) {
      console.error(e);
      toast.error("No se pudieron cargar los contenedores.");
    } finally {
      setCatalogos((prev) => ({ ...prev, contenedoresLoading: false }));
    }
  };

  useEffect(() => {
    cargarContenedores({ search: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const buildParams = (overrides = {}) => {
    const f = { ...form, ...overrides };
    const params = {
      fechaInicio: f.fechaInicio,
      fechaFin: f.fechaFin,
      agruparPor: f.agruparPor,
      page: overrides.page || 1,
      limit: overrides.limit || data.detalle.limit || 10,
      order: "desc",
      distritoId: f.distritoId,
      empresaId: f.empresaId,
      contenedorId: f.contenedorId,
    };
    return params;
  };

  const fetchReporte = async (opts = {}) => {
    if (!canSearch) {
      toast.info("Completa todos los filtros antes de ver el reporte.");
      return;
    }

    setLoading(true);
    try {
      const params = buildParams(opts);
      const res = await apiClient.get("/historial-costo", { params });

      setData({
        exportId: res.data?.export_id ?? null,
        kpis: res.data?.kpis ?? null,
        resumen: res.data?.resumen || [],
        topContenedores: res.data?.topContenedores || [],
        detalle: res.data?.detalle || DEFAULT_DETALLE,
      });

      setLoaded(true);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "Error al obtener reporte de costos.");
    } finally {
      setLoading(false);
    }
  };

  const onExportPdf = async () => {
    if (!loaded || !data.exportId) {
      toast.info("Primero presiona Ver para generar el reporte.");
      return;
    }

    try {
      const res = await apiClient.get("/historial-costo/export/pdf", {
        params: { exportId: data.exportId },
        responseType: "blob",
      });

      // lo abrimos en pestaña nueva (como el otro módulo)
      openBlobInNewTab(res.data);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "No se pudo generar el PDF.");
    }
  };

  const onExportExcel = async () => {
    if (!loaded || !data.exportId) {
      toast.info("Primero presiona Ver para generar el reporte.");
      return;
    }

    try {
      const res = await apiClient.get("/historial-costo/export/excel", {
        params: { exportId: data.exportId },
        responseType: "blob",
      });

      downloadBlob(res.data, `reporte_costos_${data.exportId}.xlsx`);
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.message || "No se pudo generar el Excel.");
    }
  };

  return (
    <div className="p-3">
      <Card className="shadow-sm">
        <Card.Body>
          <Row className="align-items-center">
            <Col>
              <h4 className="mb-0">Reporte de Costos</h4>
              <small className="text-muted">Control DSH</small>
            </Col>

            <Col xs="auto" className="d-flex gap-2">
              <Button
                variant="success"
                onClick={() => fetchReporte({ page: 1 })}
                disabled={!canSearch || loading}
              >
                {loading ? (
                  <>
                    <Spinner size="sm" className="me-2" />
                    Cargando...
                  </>
                ) : (
                  <>
                    <FaSearch className="me-2" />
                    Ver
                  </>
                )}
              </Button>

              <Button variant="danger" onClick={onExportPdf} disabled={!loaded}>
                <FaFilePdf className="me-2" />
                PDF
              </Button>

              <Button variant="success" onClick={onExportExcel} disabled={!loaded}>
                <FaFileExcel className="me-2" />
                Excel
              </Button>
            </Col>
          </Row>

          <hr />

          <FiltroCostos
            value={form}
            onChange={setForm}
            disabled={loading}
            distritos={catalogos.distritos}
            empresas={catalogos.empresas}
            contenedores={catalogos.contenedores}
            contenedoresLoading={catalogos.contenedoresLoading}
            catalogLoading={catalogLoading}
          />

          {!loaded ? null : (
            <>
              <ResumenKpis kpis={data.kpis} />

              <Row className="mt-3 g-3">
                <Col lg={8}>
                  <TablaResumen agruparPor={form.agruparPor} rows={data.resumen} />
                </Col>
                <Col lg={4}>
                  <PanelRankings topContenedores={data.topContenedores} />
                </Col>
              </Row>

              <Row className="mt-3">
                <Col>
                  <Suspense
                    fallback={
                      <Card className="shadow-sm">
                        <Card.Body className="d-flex align-items-center gap-2">
                          <Spinner size="sm" />
                          <span>Cargando tabla de detalle...</span>
                        </Card.Body>
                      </Card>
                    }
                  >
                    <TablaDetalle
                      detalle={data.detalle}
                      onPageChange={(nextPage) => fetchReporte({ page: nextPage })}
                    />
                  </Suspense>
                </Col>
              </Row>
            </>
          )}
        </Card.Body>
      </Card>
    </div>
  );
};

export default HistorialCosto;