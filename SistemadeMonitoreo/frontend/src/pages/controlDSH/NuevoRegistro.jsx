import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FaChartLine, FaSyringe, FaBiohazard, FaInfoCircle } from "react-icons/fa";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/nuevo-registro.css";

import apiClient from "../../utils/apiClient";

import ModalCosto from "../../components/controlDSH/ModalCosto";
import ModalTotales from "../../components/controlDSH/ModalTotales";
import RegistroRecoleccion from "./RegistroRecoleccion";

const TIPOS = [
  { id: 2, label: "Punzocortante", Icon: FaSyringe, iconClass: "text-danger", barClass: "bg-danger", barTextClass: "" },
  { id: 1, label: "Bioinfeccioso", Icon: FaBiohazard, iconClass: "text-warning", barClass: "bg-warning", barTextClass: "text-dark" },
];

const clamp0to100 = (n) => Math.min(100, Math.max(0, Number.isFinite(+n) ? +n : 0));
const pctLitros = (actual, cap) => {
  const a = Number(actual) || 0;
  const c = Number(cap) || 0;
  return c > 0 ? clamp0to100((a / c) * 100) : 0;
};

const getResponsableDesdeToken = () => {
  const token = localStorage.getItem("token");
  if (!token) return "";
  try {
    const decoded = jwtDecode(token);
    return String(decoded?.nombre || decoded?.usuario || "").trim();
  } catch {
    return "";
  }
};

const NuevoRegistro = () => {
  const [loading, setLoading] = useState(false);
  const [nivelesPorTipo, setNivelesPorTipo] = useState({ 1: null, 2: null });

  // Flujo
  const [showCosto, setShowCosto] = useState(false);
  const [showTotales, setShowTotales] = useState(false);
  const [showRecoleccion, setShowRecoleccion] = useState(false);

  const [tipoSeleccionado, setTipoSeleccionado] = useState(null);
  const [contenedorSel, setContenedorSel] = useState(null);

  const [decisionCosto, setDecisionCosto] = useState(null);

  // ✅ en vez de historial_calculo_id, ahora usamos proceso_token + base_total_lb desde Foto 3
  const [calculoData, setCalculoData] = useState(null);

  // ✅ % pendiente: cálculo local (display), el backend recalcula al guardar
  const [porcentajePendiente, setPorcentajePendiente] = useState(0);

  const responsableNombre = useMemo(() => getResponsableDesdeToken(), []);
  const hayProcesoUIActivo = useMemo(() => showCosto || showTotales || showRecoleccion, [showCosto, showTotales, showRecoleccion]);

  const resetFlujo = useCallback(() => {
    setShowCosto(false);
    setShowTotales(false);
    setShowRecoleccion(false);
    setTipoSeleccionado(null);
    setContenedorSel(null);
    setDecisionCosto(null);
    setCalculoData(null);
    setPorcentajePendiente(0);
  }, []);

  const closeCosto = useCallback(() => setShowCosto(false), []);
  const closeTotales = useCallback(() => setShowTotales(false), []);

  const cargarNiveles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/contenedores");
      const list = Array.isArray(res.data) ? res.data : res.data?.rows || res.data?.data || [];

      const next = { 1: null, 2: null };
      for (const c of list) {
        const tipoId = Number(c.id_tipo_residuo);
        if (tipoId !== 1 && tipoId !== 2) continue;
        if (!next[tipoId]) {
          next[tipoId] = {
            id_contenedor: c.id_contenedor,
            codigo: c.codigo,
            estado_id: c.estado_id,
            capacidad_max_litros: c.capacidad_max_litros,
            estado_actual_litros: c.estado_actual_litros,
          };
        }
      }

      setNivelesPorTipo(next);
    } catch (err) {
      console.error(err);
      toast.error("No se pudieron cargar los niveles.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarNiveles();
  }, [cargarNiveles]);

  const handleSelectTipo = useCallback(
    async (id_tipo_residuo) => {
      if (hayProcesoUIActivo) return toast.info("Terminá o cancelá el proceso actual para iniciar otro.");

      try {
        const res = await apiClient.post("/control-dsh/registro-pesaje/iniciar", { id_tipo_residuo });

        setTipoSeleccionado(id_tipo_residuo);
        setContenedorSel(res.data?.contenedor || null);
        setPorcentajePendiente(0);
        setShowCosto(true);
      } catch (err) {
        const status = err?.response?.status;
        const msg = err?.response?.data?.message;

        if (status === 409) return toast.warning(msg || "No se puede iniciar el proceso.");
        if (status === 404) return toast.error(msg || "No existe contenedor para el tipo seleccionado.");
        toast.error("Error iniciando el proceso.");
      }
    },
    [hayProcesoUIActivo]
  );

  const handleOpenTotales = useCallback((payloadDecisionCosto) => {
    setDecisionCosto(payloadDecisionCosto);
    setShowCosto(false);
    setShowTotales(true);
  }, []);

  // ✅ aquí recibimos res.data del /calculo (proceso_token + preview)
  const handleShowRecoleccion = useCallback((payloadCalculo) => {
    setCalculoData(payloadCalculo);
    setShowTotales(false);
    setPorcentajePendiente(0);
    setShowRecoleccion(true);
  }, []);

  // ✅ cálculo local en 1 línea útil: (pendiente / total) * 100
  const handlePreviewPendiente = useCallback(
    (cantidadLibrasStr) => {
      const total = Number(calculoData?.contenedor?.total_en_libras ?? calculoData?.total_en_libras ?? 0) || 0;
      const v = Number(String(cantidadLibrasStr ?? "").trim());
      setPorcentajePendiente(total > 0 && Number.isFinite(v) && v >= 0 ? Number(clamp0to100((v / total) * 100).toFixed(2)) : 0);
    },
    [calculoData]
  );

  // ✅ Cancelar = solo reset UI (tu regla nueva)
  const handleCancel = useCallback(() => {
    toast.info("Proceso cancelado.");
    resetFlujo();
  }, [resetFlujo]);

  const handleFinish = useCallback(async () => {
    toast.success("Recolección guardada. Proceso finalizado.");
    resetFlujo();
    await cargarNiveles();
  }, [cargarNiveles, resetFlujo]);

  const renderCard = useCallback(
    (t) => {
      const cont = nivelesPorTipo[t.id];
      const pct = cont ? Number(pctLitros(cont.estado_actual_litros, cont.capacidad_max_litros).toFixed(0)) : 0;
      const disabled = loading;

      return (
        <div
          key={t.id}
          className={`mb-4 residuo-card ${disabled ? "opacity-75" : ""}`}
          onClick={() => !disabled && handleSelectTipo(t.id)}
          role="button"
          tabIndex={0}
        >
          <div className="d-flex align-items-center mb-2">
            <t.Icon className={`${t.iconClass} me-2`} />
            <span className="fw-semibold">{t.label}</span>
          </div>

          <div className="progress custom-progress">
            <div
              className={`progress-bar ${t.barClass} ${t.barTextClass}`}
              role="progressbar"
              style={{ width: `${pct}%` }}
              aria-valuenow={pct}
              aria-valuemin="0"
              aria-valuemax="100"
            >
              {pct}%
            </div>
          </div>

          {!cont && !loading && <small className="text-muted d-block mt-2">Sin datos (contenedor no disponible o inactivo).</small>}
        </div>
      );
    },
    [nivelesPorTipo, loading, handleSelectTipo]
  );

  return (
    <div className="d-flex justify-content-start align-items-start p-4 gap-5">
      <div className="card shadow-sm border-0 nuevo-registro-card">
        <div className="card-body p-4">
          <h4 className="card-title d-flex align-items-center mb-4">
            <FaChartLine className="text-primary me-2" size={24} />
            <span className="fw-bold">Niveles de Residuos</span>
          </h4>

          {TIPOS.map(renderCard)}

          <div className="alert alert-info d-flex align-items-start mb-0">
            <FaInfoCircle className="me-2 mt-1" />
            <div>
              <strong>Información:</strong> Debe seleccionar uno de los desechos para el cálculo del pesaje.
            </div>
          </div>
        </div>
      </div>

      {showRecoleccion && (
        <div className="flex-grow-1">
          <RegistroRecoleccion
            codigoContenedor={contenedorSel?.codigo || ""}
            responsableNombre={responsableNombre}
            procesoToken={calculoData?.proceso_token || ""}                 // ✅ CAMBIO
            porcentajePendiente={porcentajePendiente}
            onPreviewPendiente={handlePreviewPendiente}
            onCancel={handleCancel}
            onFinish={handleFinish}
          />
        </div>
      )}

      <ModalCosto
        show={showCosto}
        handleClose={closeCosto}
        handleOpenTotales={handleOpenTotales}
        contenedorId={contenedorSel?.id_contenedor || null}
      />

      <ModalTotales
        show={showTotales}
        handleClose={closeTotales}
        handleShowRecoleccion={handleShowRecoleccion}
        onCancel={handleCancel}
        idTipoResiduo={tipoSeleccionado}
        contenedor={contenedorSel}
        decisionCosto={decisionCosto}
      />
    </div>
  );
};

export default NuevoRegistro;
