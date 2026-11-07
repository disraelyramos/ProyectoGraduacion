
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  FaClipboardList,
  FaSave,
  FaTimes,
} from "react-icons/fa";

import apiClient from "../../utils/apiClient";

import {
  showBackendAlert,
  showConfirmAlert,
} from "../../utils/alerts";

import "../../styles/nuevo-registro.css";

// ======================================================
// ENDPOINTS
// ======================================================

const URL_DATOS =
  "/control-dsh/registro-pesaje/recoleccion/datos";

const URL_PREVIEW =
  "/control-dsh/registro-pesaje/recoleccion/preview";

const URL_GUARDAR =
  "/control-dsh/registro-pesaje/recoleccion";

const URL_DISTRITOS =
  "/control-dsh/catalogos/distritos";

const URL_EMPRESAS =
  "/control-dsh/catalogos/empresas";

// ======================================================
// DATOS INICIALES
// ======================================================

const DATOS_PROCESO_INICIALES = {
  codigo_contenedor: "",
  responsable: "",
  fecha_recoleccion: "",
};

const FORMULARIO_INICIAL = {
  distrito_id: "",
  empresa_id: "",
  numero_recibo: "",
  cantidad_libras_pendientes: "",
  observaciones: "",
};

const PREVIEW_INICIAL = {
  porcentaje_pendiente: 0,
  porcentaje_recolectado: 0,
};

// ======================================================
// FORMATEAR FECHA EN GUATEMALA
// ======================================================

const formatearFecha = (valor) => {
  if (!valor) {
    return "";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return String(valor);
  }

  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "America/Guatemala",
  }).format(fecha);
};

// ======================================================
// VALIDAR CAMPOS
// ======================================================

const validarCampo = (name, value) => {
  const valor = String(value ?? "").trim();

  const requeridos = [
    "distrito_id",
    "empresa_id",
    "numero_recibo",
    "cantidad_libras_pendientes",
  ];

  if (
    requeridos.includes(name) &&
    !valor
  ) {
    return "Este campo es obligatorio";
  }

  // ====================================================
  // VALIDAR IDENTIFICADORES
  // ====================================================

  if (
    (
      name === "distrito_id" ||
      name === "empresa_id"
    ) &&
    valor
  ) {
    const numero = Number(valor);

    if (
      !Number.isSafeInteger(numero) ||
      numero <= 0
    ) {
      return "Seleccione una opción válida";
    }
  }

  // ====================================================
  // VALIDAR RECIBO
  // ====================================================

  if (
    name === "numero_recibo" &&
    valor &&
    !/^[a-zA-Z0-9-]+$/.test(valor)
  ) {
    return "Use solo letras, números o guiones";
  }

  // ====================================================
  // VALIDAR LIBRAS PENDIENTES
  // ====================================================

  if (
    name === "cantidad_libras_pendientes" &&
    valor
  ) {
    if (!/^\d+(\.\d{1,2})?$/.test(valor)) {
      return "Ej: 0, 10, 10.5";
    }

    const numero = Number(valor);

    if (
      !Number.isFinite(numero) ||
      numero < 0
    ) {
      return "Cantidad inválida";
    }
  }

  return "";
};

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

const RegistroRecoleccion = ({
  onCancel,
  onFinish,
}) => {

  // ====================================================
  // DATOS DEL PROCESO
  // ====================================================

  const [
    datosProceso,
    setDatosProceso,
  ] = useState({
    ...DATOS_PROCESO_INICIALES,
  });

  // ====================================================
  // CATÁLOGOS
  // ====================================================

  const [
    distritos,
    setDistritos,
  ] = useState([]);

  const [
    empresas,
    setEmpresas,
  ] = useState([]);

  // ====================================================
  // DATOS DEL FORMULARIO
  // ====================================================

  const [
    formData,
    setFormData,
  ] = useState({
    ...FORMULARIO_INICIAL,
  });

  // ====================================================
  // PORCENTAJES CALCULADOS POR BACKEND
  // ====================================================

  const [
    preview,
    setPreview,
  ] = useState({
    ...PREVIEW_INICIAL,
  });

  // ====================================================
  // ESTADOS VISUALES
  // ====================================================

  const [
    loadingInicial,
    setLoadingInicial,
  ] = useState(true);

  const [
    previewLoading,
    setPreviewLoading,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    errors,
    setErrors,
  ] = useState({});

  // ====================================================
  // MODO CONSULTA DE DEMOSTRACIÓN
  // ====================================================
  //
  // El backend determina si existe un cálculo
  // completado o si la pantalla es solo consulta.
  //
  // No se decide únicamente desde React.
  //
  // Si soloLectura es true:
  // - Se muestran los campos normales.
  // - Se cargan los catálogos.
  // - Se consultan los porcentajes.
  // - No se registra una nueva recolección.
  // ====================================================

  const [
    soloLectura,
    setSoloLectura,
  ] = useState(false);

  const [
    datosCargados,
    setDatosCargados,
  ] = useState(false);

  // ====================================================
  // PROTECCIONES
  // ====================================================

  const guardarEnCursoRef =
    useRef(false);

  const previewRequestRef =
    useRef(0);

  // ====================================================
  // CARGAR DATOS DE RECOLECCIÓN
  // ====================================================

  const cargarDatosProceso =
    useCallback(async () => {

      const res = await apiClient.get(
        URL_DATOS,
        {
          timeout: 10000,
        }
      );

      const data = res?.data || {};

      const codigo = String(
        data.codigo_contenedor || ""
      ).trim();

      const responsable = String(
        data.responsable || ""
      ).trim();

      const fecha = formatearFecha(
        data.fecha_servidor
      );

      // El modo se recibe explícitamente
      // desde el backend.
      const consultaHistorica =
        data.solo_lectura === true;

      setSoloLectura(
        consultaHistorica
      );

      // Evitar mostrar un formulario vacío
      // como si los datos se hubieran cargado.
      if (
        !codigo ||
        !responsable ||
        !fecha
      ) {
        throw new Error(
          "DATOS_PROCESO_INCOMPLETOS"
        );
      }

      setDatosProceso({
        codigo_contenedor: codigo,
        responsable,
        fecha_recoleccion: fecha,
      });

      setDatosCargados(true);

    }, []);

  // ====================================================
  // CARGAR CATÁLOGOS
  // ====================================================

  const cargarCatalogos =
    useCallback(async () => {

      const [
        resDistritos,
        resEmpresas,
      ] = await Promise.all([
        apiClient.get(
          URL_DISTRITOS,
          { timeout: 10000 }
        ),

        apiClient.get(
          URL_EMPRESAS,
          { timeout: 10000 }
        ),
      ]);

      setDistritos(
        Array.isArray(resDistritos.data)
          ? resDistritos.data
          : []
      );

      setEmpresas(
        Array.isArray(resEmpresas.data)
          ? resEmpresas.data
          : []
      );

    }, []);

  // ====================================================
  // INICIALIZAR PANTALLA
  // ====================================================

  useEffect(() => {
    let activo = true;

    const inicializar = async () => {

      setLoadingInicial(true);
      setDatosCargados(false);
      setSoloLectura(false);
      setErrors({});

      try {
        await Promise.all([
          cargarDatosProceso(),
          cargarCatalogos(),
        ]);

      } catch (err) {
        if (!activo) {
          return;
        }

        setDatosCargados(false);

        const errorLocal =
          err?.message ===
          "DATOS_PROCESO_INCOMPLETOS";

        await showBackendAlert({
          status:
            errorLocal
              ? 502
              : err?.response?.status || 500,

          data:
            errorLocal
              ? {
                message:
                  "El servidor no devolvió todos los datos del proceso de recolección.",
              }
              : err?.response?.data || {
                message:
                  "No fue posible cargar la información de recolección.",
              },
        });

      } finally {
        if (activo) {
          setLoadingInicial(false);
        }
      }
    };

    inicializar();

    return () => {
      activo = false;

      previewRequestRef.current += 1;
    };

  }, [
    cargarDatosProceso,
    cargarCatalogos,
  ]);

  // ====================================================
  // MODIFICAR CAMPO
  // ====================================================

  const setField = (name, value) => {

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    setErrors((prev) => ({
      ...prev,
      [name]: validarCampo(
        name,
        value
      ),
    }));
  };

  // ====================================================
  // PREVISUALIZAR PORCENTAJES
  // ====================================================
  //
  // El frontend no calcula porcentajes.
  // Siempre consulta el backend.
  //
  // El backend utiliza:
  // - Peso real del proceso, o
  // - Peso histórico auditado en demostración.
  // ====================================================

  useEffect(() => {

    const valor = String(
      formData.cantidad_libras_pendientes ?? ""
    ).trim();

    // Invalidar solicitudes anteriores.
    previewRequestRef.current += 1;

    const requestId =
      previewRequestRef.current;

    if (
      !datosCargados ||
      !valor
    ) {
      setPreview({
        ...PREVIEW_INICIAL,
      });

      setPreviewLoading(false);

      return;
    }

    const errorCampo = validarCampo(
      "cantidad_libras_pendientes",
      valor
    );

    if (errorCampo) {
      setPreview({
        ...PREVIEW_INICIAL,
      });

      setPreviewLoading(false);

      return;
    }

    const timer = setTimeout(
      async () => {

        if (
          requestId !==
          previewRequestRef.current
        ) {
          return;
        }

        setPreviewLoading(true);

        try {
          const res = await apiClient.post(
            URL_PREVIEW,
            {
              cantidad_libras_pendientes:
                Number(valor),
            },
            {
              timeout: 10000,
            }
          );

          if (
            requestId !==
            previewRequestRef.current
          ) {
            return;
          }

          const porcentajePendiente = Number(
            res?.data?.porcentaje_pendiente
          );

          const porcentajeRecolectado = Number(
            res?.data?.porcentaje_recolectado
          );

          if (
            !Number.isFinite(porcentajePendiente) ||
            !Number.isFinite(porcentajeRecolectado) ||
            porcentajePendiente < 0 ||
            porcentajePendiente > 100 ||
            porcentajeRecolectado < 0 ||
            porcentajeRecolectado > 100
          ) {
            throw new Error(
              "PREVIEW_INVALIDO"
            );
          }

          setPreview({
            porcentaje_pendiente:
              porcentajePendiente,

            porcentaje_recolectado:
              porcentajeRecolectado,
          });

        } catch (err) {

          if (
            requestId !==
            previewRequestRef.current
          ) {
            return;
          }

          setPreview({
            ...PREVIEW_INICIAL,
          });

          await showBackendAlert({
            status:
              err?.response?.status || 500,

            data:
              err?.response?.data || {
                message:
                  "No fue posible calcular los porcentajes de recolección.",
              },
          });

        } finally {
          if (
            requestId ===
            previewRequestRef.current
          ) {
            setPreviewLoading(false);
          }
        }

      },
      500
    );

    return () => {
      clearTimeout(timer);
    };

  }, [
    formData.cantidad_libras_pendientes,
    datosCargados,
  ]);

  // ====================================================
  // CANCELAR
  // ====================================================

  const handleCancelar = () => {

    if (
      saving ||
      guardarEnCursoRef.current
    ) {
      return;
    }

    showConfirmAlert(
      "¿Desea cancelar el proceso?",
      "Si confirma, el proceso será cancelado y deberá iniciar uno nuevo.",
      async () => {
        await onCancel?.();
      },
      null
    );
  };

  // ====================================================
  // VALIDAR FORMULARIO
  // ====================================================

  const validarFormulario = () => {

    const campos = [
      "distrito_id",
      "empresa_id",
      "numero_recibo",
      "cantidad_libras_pendientes",
    ];

    const nuevosErrores = {};

    for (const campo of campos) {
      nuevosErrores[campo] =
        validarCampo(
          campo,
          formData[campo]
        );
    }

    setErrors(nuevosErrores);

    return !Object.values(
      nuevosErrores
    ).some(Boolean);
  };

  // ====================================================
  // GUARDAR RECOLECCIÓN
  // ====================================================

  const guardarRecoleccion = async () => {

    // Nunca enviar una recolección histórica
    // al endpoint real de guardado.
    if (
      soloLectura ||
      !datosCargados
    ) {
      return;
    }

    if (
      guardarEnCursoRef.current ||
      saving
    ) {
      return;
    }

    if (!validarFormulario()) {
      return;
    }

    guardarEnCursoRef.current = true;

    setSaving(true);

    try {

      const payload = {
        empresa_id:
          Number(formData.empresa_id),

        distrito_id:
          Number(formData.distrito_id),

        numero_recibo:
          String(
            formData.numero_recibo
          ).trim(),

        cantidad_libras_pendientes:
          Number(
            formData.cantidad_libras_pendientes
          ),

        observaciones:
          String(
            formData.observaciones || ""
          ).trim() || null,
      };

      await apiClient.post(
        URL_GUARDAR,
        payload
      );

      await onFinish?.();

    } catch (err) {

      await showBackendAlert({
        status:
          err?.response?.status || 500,

        data:
          err?.response?.data || {
            message:
              "No fue posible guardar la recolección.",
          },
      });

    } finally {
      guardarEnCursoRef.current = false;

      setSaving(false);
    }
  };

  // ====================================================
  // ENVIAR FORMULARIO
  // ====================================================

  const handleSubmit = (event) => {
    event.preventDefault();

    if (
      soloLectura ||
      !datosCargados
    ) {
      return;
    }

    if (
      saving ||
      guardarEnCursoRef.current
    ) {
      return;
    }

    if (!validarFormulario()) {
      return;
    }

    showConfirmAlert(
      "¿Desea guardar la recolección?",
      "Se finalizará el proceso actual.",
      async () => {
        await guardarRecoleccion();
      },
      null
    );
  };

  // ====================================================
  // CARGANDO INFORMACIÓN
  // ====================================================

  if (loadingInicial) {
    return (
      <div className="registro-recoleccion">

        <div className="system-card registro-recoleccion-loading">

          <span
            className="system-spinner"
            aria-hidden="true"
          />

          <p>
            Cargando información de recolección...
          </p>

        </div>

      </div>
    );
  }

  // ====================================================
  // RENDER ORIGINAL
  // ====================================================

  return (
    <div className="registro-recoleccion">

      <div className="system-card registro-recoleccion-card">

        {/* ==========================================
            CABECERA
        ========================================== */}

        <header className="system-card-header registro-recoleccion-header">

          <div className="registro-recoleccion-title">

            <FaClipboardList />

            <div>
              <h2 className="system-card-title">
                Registro de Recolección
              </h2>

              <p className="system-card-description">
                Complete los datos requeridos para
                finalizar la recolección.
              </p>
            </div>

          </div>

        </header>

        {/* ==========================================
            FORMULARIO
        ========================================== */}

        <form
          className="system-form"
          onSubmit={handleSubmit}
        >

          <div className="system-form-grid">

            {/* ====================================
                CÓDIGO DEL CONTENEDOR
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-codigo"
                className="system-form-label"
              >
                Código del Contenedor
              </label>

              <input
                id="recoleccion-codigo"
                type="text"
                className="system-form-control"
                value={
                  datosProceso.codigo_contenedor
                }
                disabled
              />

            </div>

            {/* ====================================
                RESPONSABLE
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-responsable"
                className="system-form-label"
              >
                Responsable
              </label>

              <input
                id="recoleccion-responsable"
                type="text"
                className="system-form-control"
                value={
                  datosProceso.responsable
                }
                disabled
              />

            </div>

            {/* ====================================
                FECHA DE RECOLECCIÓN
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-fecha"
                className="system-form-label"
              >
                Fecha de Recolección
              </label>

              <input
                id="recoleccion-fecha"
                type="text"
                className="system-form-control"
                value={
                  datosProceso.fecha_recoleccion
                }
                disabled
              />

            </div>

            {/* ====================================
                EMPRESA RECOLECTORA
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-empresa"
                className="system-form-label"
              >
                Empresa Recolectora
              </label>

              <select
                id="recoleccion-empresa"
                className={`system-form-select ${errors.empresa_id
                  ? "is-invalid"
                  : ""
                  }`}
                value={
                  formData.empresa_id
                }
                disabled={saving}
                onChange={(event) =>
                  setField(
                    "empresa_id",
                    event.target.value
                  )
                }
              >
                <option value="">
                  Seleccione una empresa
                </option>

                {empresas.map((empresa) => (
                  <option
                    key={empresa.id}
                    value={
                      String(empresa.id)
                    }
                  >
                    {empresa.nombre}
                  </option>
                ))}
              </select>

              {errors.empresa_id && (
                <small className="system-form-error">
                  {errors.empresa_id}
                </small>
              )}

            </div>

            {/* ====================================
                DISTRITO
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-distrito"
                className="system-form-label"
              >
                Distrito
              </label>

              <select
                id="recoleccion-distrito"
                className={`system-form-select ${errors.distrito_id
                  ? "is-invalid"
                  : ""
                  }`}
                value={
                  formData.distrito_id
                }
                disabled={
                  saving ||
                  previewLoading
                }
              >
                <option value="">
                  Seleccione un distrito
                </option>

                {distritos.map((distrito) => (
                  <option
                    key={distrito.id}
                    value={
                      String(distrito.id)
                    }
                  >
                    {distrito.nombre}
                  </option>
                ))}
              </select>

              {errors.distrito_id && (
                <small className="system-form-error">
                  {errors.distrito_id}
                </small>
              )}

            </div>

            {/* ====================================
                NÚMERO DE RECIBO
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-recibo"
                className="system-form-label"
              >
                Número de Recibo
              </label>

              <input
                id="recoleccion-recibo"
                type="text"
                className={`system-form-control ${errors.numero_recibo
                  ? "is-invalid"
                  : ""
                  }`}
                value={
                  formData.numero_recibo
                }
                disabled={saving}
                onChange={(event) =>
                  setField(
                    "numero_recibo",
                    event.target.value
                  )
                }
                placeholder="Ej: REC-001"
                autoComplete="off"
              />

              {errors.numero_recibo && (
                <small className="system-form-error">
                  {errors.numero_recibo}
                </small>
              )}

            </div>

            {/* ====================================
                LIBRAS PENDIENTES
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-libras"
                className="system-form-label"
              >
                Cantidad en Libras Pendientes
              </label>

              <input
                id="recoleccion-libras"
                type="text"
                className={`system-form-control ${errors.cantidad_libras_pendientes
                  ? "is-invalid"
                  : ""
                  }`}
                value={
                  formData.cantidad_libras_pendientes
                }
                disabled={saving}
                onChange={(event) =>
                  setField(
                    "cantidad_libras_pendientes",
                    event.target.value
                  )
                }
                placeholder="Ej: 0, 10, 10.5"
                inputMode="decimal"
                autoComplete="off"
              />

              {errors.cantidad_libras_pendientes && (
                <small className="system-form-error">
                  {errors.cantidad_libras_pendientes}
                </small>
              )}

            </div>

            {/* ====================================
                PORCENTAJE PENDIENTE
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-porcentaje-pendiente"
                className="system-form-label"
              >
                % DSH Pendientes de Recolectar
              </label>

              <input
                id="recoleccion-porcentaje-pendiente"
                type="text"
                className="system-form-control"
                value={
                  previewLoading
                    ? "Calculando..."
                    : `${Number(
                      preview.porcentaje_pendiente || 0
                    ).toFixed(2)} %`
                }
                disabled
              />

            </div>

            {/* ====================================
                PORCENTAJE RECOLECTADO
            ==================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-porcentaje-recolectado"
                className="system-form-label"
              >
                % DSH Recolectados
              </label>

              <input
                id="recoleccion-porcentaje-recolectado"
                type="text"
                className="system-form-control"
                value={
                  previewLoading
                    ? "Calculando..."
                    : `${Number(
                      preview.porcentaje_recolectado || 0
                    ).toFixed(2)} %`
                }
                disabled
              />

            </div>

            {/* ====================================
                OBSERVACIONES
            ==================================== */}

            <div className="system-form-group system-form-full">

              <label
                htmlFor="recoleccion-observaciones"
                className="system-form-label"
              >
                Observaciones

                <span className="registro-optional">
                  Opcional
                </span>
              </label>

              <textarea
                id="recoleccion-observaciones"
                className="system-form-textarea"
                value={
                  formData.observaciones
                }
                disabled={saving}
                onChange={(event) =>
                  setField(
                    "observaciones",
                    event.target.value
                  )
                }
                placeholder="Ingrese una observación si es necesario"
              />

            </div>

          </div>

          {/* ==========================================
              BOTONES ORIGINALES
          ========================================== */}

          <div className="system-actions registro-recoleccion-actions">

            {/* CANCELAR */}

            <button
              type="button"
              className="app-btn app-btn-cancel"
              onClick={handleCancelar}
              disabled={saving}
            >
              <FaTimes />

              <span>
                Cancelar
              </span>
            </button>

            {/* GUARDAR */}

            <button
              type="submit"
              className="app-btn app-btn-primary"
              disabled={
                saving ||
                previewLoading ||
                soloLectura ||
                !datosCargados
              }
            >
              {saving ? (
                <>
                  <span
                    className="system-spinner system-spinner-small"
                    aria-hidden="true"
                  />

                  <span>
                    Guardando...
                  </span>
                </>
              ) : (
                <>
                  <FaSave />

                  <span>
                    Guardar
                  </span>
                </>
              )}
            </button>

          </div>

        </form>

      </div>

    </div>
  );
};

export default RegistroRecoleccion;
