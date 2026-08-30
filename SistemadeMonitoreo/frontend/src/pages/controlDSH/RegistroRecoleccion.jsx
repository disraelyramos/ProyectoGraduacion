// frontend/src/pages/controlDSH/RegistroRecoleccion.jsx

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


const RegistroRecoleccion = ({
  onCancel,
  onFinish,
}) => {

  /* =====================================================
     DATOS DEL PROCESO
     ===================================================== */

  const [
    datosProceso,
    setDatosProceso,
  ] = useState({
    codigo_contenedor: "",
    responsable: "",
    fecha_recoleccion: "",
  });


  /* =====================================================
     CATÁLOGOS
     ===================================================== */

  const [
    distritos,
    setDistritos,
  ] = useState([]);

  const [
    empresas,
    setEmpresas,
  ] = useState([]);


  /* =====================================================
     DATOS INTRODUCIDOS POR EL USUARIO
     ===================================================== */

  const [
    formData,
    setFormData,
  ] = useState({
    distrito_id: "",
    empresa_id: "",
    numero_recibo: "",
    cantidad_libras_pendientes: "",
    observaciones: "",
  });


  /* =====================================================
     PORCENTAJES CALCULADOS POR BACKEND
     ===================================================== */

  const [
    preview,
    setPreview,
  ] = useState({
    porcentaje_pendiente: 0,
    porcentaje_recolectado: 0,
  });


  /* =====================================================
     ESTADOS DE UI
     ===================================================== */

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


  /* =====================================================
     PROTECCIONES
     ===================================================== */

  const guardarEnCursoRef =
    useRef(false);

  const previewRequestRef =
    useRef(0);


  /* =====================================================
     FORMATEAR FECHA
     ===================================================== */

  const formatearFecha = (
    value
  ) => {

    if (!value) {
      return "";
    }

    const fecha =
      new Date(value);

    if (
      Number.isNaN(
        fecha.getTime()
      )
    ) {
      return String(value);
    }

    const dia =
      String(
        fecha.getDate()
      ).padStart(
        2,
        "0"
      );

    const mes =
      String(
        fecha.getMonth() + 1
      ).padStart(
        2,
        "0"
      );

    const anio =
      fecha.getFullYear();

    return `${dia}/${mes}/${anio}`;
  };


  /* =====================================================
     CARGAR DATOS DE RECOLECCIÓN
     ===================================================== */

  const cargarDatosProceso =
    useCallback(async () => {

      const res =
        await apiClient.get(
          "/control-dsh/registro-pesaje/recoleccion/datos"
        );

      const data =
        res?.data || {};

      setDatosProceso({
        codigo_contenedor:
          String(
            data?.codigo_contenedor ||
            ""
          ),

        responsable:
          String(
            data?.responsable ||
            ""
          ),

        fecha_recoleccion:
          formatearFecha(
            data?.fecha_servidor
          ),
      });

    }, []);


  /* =====================================================
     CARGAR CATÁLOGOS
     ===================================================== */

  const cargarCatalogos =
    useCallback(async () => {

      const [
        resDistritos,
        resEmpresas,
      ] =
        await Promise.all([

          apiClient.get(
            "/control-dsh/catalogos/distritos"
          ),

          apiClient.get(
            "/control-dsh/catalogos/empresas"
          ),
        ]);

      setDistritos(
        Array.isArray(
          resDistritos.data
        )
          ? resDistritos.data
          : []
      );

      setEmpresas(
        Array.isArray(
          resEmpresas.data
        )
          ? resEmpresas.data
          : []
      );

    }, []);


  /* =====================================================
     INICIALIZACIÓN
     ===================================================== */

  useEffect(() => {

    let activo = true;

    const inicializar =
      async () => {

        setLoadingInicial(true);

        try {

          await Promise.all([
            cargarDatosProceso(),
            cargarCatalogos(),
          ]);

        } catch (err) {

          if (!activo) {
            return;
          }

          await showBackendAlert({
            status:
              err?.response
                ?.status ||
              500,

            data:
              err?.response
                ?.data ||
              {
                message:
                  "No fue posible cargar la información de recolección.",
              },
          });

        } finally {

          if (activo) {
            setLoadingInicial(
              false
            );
          }
        }
      };

    inicializar();

    return () => {
      activo = false;
    };

  }, [
    cargarCatalogos,
    cargarDatosProceso,
  ]);


  /* =====================================================
     VALIDACIONES FRONTEND
     ===================================================== */

  const validateField = (
    name,
    value
  ) => {

    const valor =
      String(
        value ?? ""
      ).trim();

    const requeridos = [
      "distrito_id",
      "empresa_id",
      "numero_recibo",
      "cantidad_libras_pendientes",
    ];

    if (
      requeridos.includes(
        name
      ) &&
      !valor
    ) {
      return "Este campo es obligatorio";
    }


    /* IDs */

    if (
      (
        name === "distrito_id" ||
        name === "empresa_id"
      ) &&
      valor
    ) {

      const numero =
        Number(valor);

      if (
        !Number.isInteger(
          numero
        ) ||
        numero <= 0
      ) {
        return "Seleccione una opción válida";
      }
    }


    /* NÚMERO DE RECIBO */

    if (
      name === "numero_recibo" &&
      valor &&
      !/^[a-zA-Z0-9-]+$/.test(
        valor
      )
    ) {
      return "Use solo letras, números o guiones";
    }


    /* LIBRAS PENDIENTES */

    if (
      name ===
        "cantidad_libras_pendientes" &&
      valor
    ) {

      if (
        !/^\d+(\.\d{1,2})?$/.test(
          valor
        )
      ) {
        return "Ej: 0, 10, 10.5";
      }

      const numero =
        Number(valor);

      if (
        !Number.isFinite(
          numero
        ) ||
        numero < 0
      ) {
        return "Cantidad inválida";
      }
    }

    return "";
  };


  /* =====================================================
     CAMBIAR CAMPO
     ===================================================== */

  const setField = (
    name,
    value
  ) => {

    setFormData(
      (prev) => ({
        ...prev,
        [name]: value,
      })
    );

    setErrors(
      (prev) => ({
        ...prev,

        [name]:
          validateField(
            name,
            value
          ),
      })
    );
  };


  /* =====================================================
     PREVIEW DE PORCENTAJES
     ===================================================== */

  useEffect(() => {

    const valor =
      String(
        formData
          .cantidad_libras_pendientes ??
        ""
      ).trim();


    if (!valor) {

      setPreview({
        porcentaje_pendiente: 0,
        porcentaje_recolectado: 0,
      });

      setPreviewLoading(false);

      return;
    }


    const errorCampo =
      validateField(
        "cantidad_libras_pendientes",
        valor
      );


    if (errorCampo) {

      setPreview({
        porcentaje_pendiente: 0,
        porcentaje_recolectado: 0,
      });

      return;
    }


    const timer =
      setTimeout(
        async () => {

          const requestId =
            previewRequestRef.current +
            1;

          previewRequestRef.current =
            requestId;

          setPreviewLoading(true);


          try {

            const res =
              await apiClient.post(
                "/control-dsh/registro-pesaje/recoleccion/preview",

                {
                  cantidad_libras_pendientes:
                    Number(valor),
                }
              );


            if (
              requestId !==
              previewRequestRef.current
            ) {
              return;
            }


            setPreview({
              porcentaje_pendiente:
                Number(
                  res.data
                    ?.porcentaje_pendiente ??
                  0
                ),

              porcentaje_recolectado:
                Number(
                  res.data
                    ?.porcentaje_recolectado ??
                  0
                ),
            });


          } catch (err) {

            if (
              requestId !==
              previewRequestRef.current
            ) {
              return;
            }


            setPreview({
              porcentaje_pendiente: 0,
              porcentaje_recolectado: 0,
            });


            await showBackendAlert({
              status:
                err?.response
                  ?.status ||
                500,

              data:
                err?.response
                  ?.data ||
                {
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
    formData
      .cantidad_libras_pendientes,
  ]);


  /* =====================================================
     CANCELAR
     ===================================================== */

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


  /* =====================================================
     VALIDAR FORMULARIO COMPLETO
     ===================================================== */

  const validarFormulario = () => {

    const campos = [
      "distrito_id",
      "empresa_id",
      "numero_recibo",
      "cantidad_libras_pendientes",
    ];


    const nuevosErrores =
      {};


    for (
      const campo
      of campos
    ) {

      nuevosErrores[campo] =
        validateField(
          campo,
          formData[campo]
        );
    }


    setErrors(
      nuevosErrores
    );


    return !Object.values(
      nuevosErrores
    ).some(Boolean);
  };


  /* =====================================================
     GUARDAR RECOLECCIÓN
     ===================================================== */

  const guardarRecoleccion =
    async () => {

      if (
        guardarEnCursoRef.current ||
        saving
      ) {
        return;
      }


      if (
        !validarFormulario()
      ) {
        return;
      }


      guardarEnCursoRef.current =
        true;

      setSaving(true);


      try {

        const payload = {

          empresa_id:
            Number(
              formData.empresa_id
            ),

          distrito_id:
            Number(
              formData.distrito_id
            ),

          numero_recibo:
            String(
              formData.numero_recibo
            ).trim(),

          cantidad_libras_pendientes:
            Number(
              formData
                .cantidad_libras_pendientes
            ),

          observaciones:
            String(
              formData.observaciones ||
              ""
            ).trim() ||
            null,
        };


        await apiClient.post(
          "/control-dsh/registro-pesaje/recoleccion",
          payload
        );


        await onFinish?.();


      } catch (err) {

        await showBackendAlert({
          status:
            err?.response
              ?.status ||
            500,

          data:
            err?.response
              ?.data ||
            {
              message:
                "No fue posible guardar la recolección.",
            },
        });


      } finally {

        guardarEnCursoRef.current =
          false;

        setSaving(false);
      }
    };


  /* =====================================================
     SUBMIT
     ===================================================== */

  const handleSubmit = (
    event
  ) => {

    event.preventDefault();


    if (
      saving ||
      guardarEnCursoRef.current
    ) {
      return;
    }


    if (
      !validarFormulario()
    ) {
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


  /* =====================================================
     CARGANDO
     ===================================================== */

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


  /* =====================================================
     RENDER
     ===================================================== */

  return (

    <div className="registro-recoleccion">

      <div className="system-card registro-recoleccion-card">

        {/* ===============================================
            CABECERA
        =============================================== */}

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


        {/* ===============================================
            FORMULARIO
        =============================================== */}

        <form
          className="system-form"
          onSubmit={handleSubmit}
        >

          <div className="system-form-grid">

            {/* ===========================================
                CÓDIGO
            =========================================== */}

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
                  datosProceso
                    .codigo_contenedor
                }
                disabled
              />

            </div>


            {/* ===========================================
                RESPONSABLE
            =========================================== */}

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


            {/* ===========================================
                FECHA
            =========================================== */}

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
                  datosProceso
                    .fecha_recoleccion
                }
                disabled
              />

            </div>


            {/* ===========================================
                EMPRESA
            =========================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-empresa"
                className="system-form-label"
              >
                Empresa Recolectora
              </label>

              <select
                id="recoleccion-empresa"
                className={`system-form-select ${
                  errors.empresa_id
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

                {empresas.map(
                  (empresa) => (

                    <option
                      key={empresa.id}
                      value={String(
                        empresa.id
                      )}
                    >
                      {empresa.nombre}
                    </option>

                  )
                )}

              </select>


              {errors.empresa_id && (

                <small className="system-form-error">
                  {errors.empresa_id}
                </small>

              )}

            </div>


            {/* ===========================================
                DISTRITO
            =========================================== */}

            <div className="system-form-group">

              <label
                htmlFor="recoleccion-distrito"
                className="system-form-label"
              >
                Distrito
              </label>

              <select
                id="recoleccion-distrito"
                className={`system-form-select ${
                  errors.distrito_id
                    ? "is-invalid"
                    : ""
                }`}
                value={
                  formData.distrito_id
                }
                disabled={saving}
                onChange={(event) =>
                  setField(
                    "distrito_id",
                    event.target.value
                  )
                }
              >

                <option value="">
                  Seleccione un distrito
                </option>

                {distritos.map(
                  (distrito) => (

                    <option
                      key={distrito.id}
                      value={String(
                        distrito.id
                      )}
                    >
                      {distrito.nombre}
                    </option>

                  )
                )}

              </select>


              {errors.distrito_id && (

                <small className="system-form-error">
                  {errors.distrito_id}
                </small>

              )}

            </div>


            {/* ===========================================
                RECIBO
            =========================================== */}

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
                className={`system-form-control ${
                  errors.numero_recibo
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


            {/* ===========================================
                LIBRAS PENDIENTES
            =========================================== */}

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
                className={`system-form-control ${
                  errors
                    .cantidad_libras_pendientes
                    ? "is-invalid"
                    : ""
                }`}
                value={
                  formData
                    .cantidad_libras_pendientes
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


              {errors
                .cantidad_libras_pendientes && (

                <small className="system-form-error">
                  {
                    errors
                      .cantidad_libras_pendientes
                  }
                </small>

              )}

            </div>


            {/* ===========================================
                PORCENTAJE PENDIENTE
            =========================================== */}

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
                        preview
                          .porcentaje_pendiente ||
                        0
                      ).toFixed(2)} %`
                }
                disabled
              />

            </div>


            {/* ===========================================
                PORCENTAJE RECOLECTADO
            =========================================== */}

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
                        preview
                          .porcentaje_recolectado ||
                        0
                      ).toFixed(2)} %`
                }
                disabled
              />

            </div>


            {/* ===========================================
                OBSERVACIONES
            =========================================== */}

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


          {/* =============================================
              ACCIONES
          ============================================= */}

          <div className="system-actions registro-recoleccion-actions">

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


            <button
              type="submit"
              className="app-btn app-btn-primary"
              disabled={
                saving ||
                previewLoading
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