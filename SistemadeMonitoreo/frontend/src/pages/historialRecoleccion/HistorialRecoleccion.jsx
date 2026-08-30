import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Form,
  Button,
  Card,
  InputGroup,
} from "react-bootstrap";

import {
  FaHistory,
  FaSearch,
  FaCalendarAlt,
} from "react-icons/fa";

import "../../styles/historial-recoleccion.css";

import HistorialEnTablas from "./HistorialEnTablas";
import apiClient from "../../utils/apiClient";

import {
  showBackendAlert,
} from "../../utils/alerts";


/* =========================================================
   CONFIGURACIÓN VISUAL
   ========================================================= */

const DEFAULT_PAGE_SIZE = 10;


/* =========================================================
   MENSAJE EXPORTACIÓN VENCIDA

   Solo UX.

   Backend sigue siendo la fuente de verdad.
   ========================================================= */

const MENSAJE_EXPORTACION_EXPIRADA =
  "El tiempo disponible para exportar esta búsqueda venció. Por seguridad, PDF y Excel se bloquearon. Presione 'Ver' nuevamente para habilitarlos.";


/* =========================================================
   VALIDACIÓN VISUAL
   ========================================================= */

function validarFormulario({
  buscarPor,
  valorBusqueda,
  fechaInicio,
  fechaFin,
}) {
  const errors = {};


  if (!buscarPor) {
    errors.buscarPor =
      "Este campo es obligatorio";
  }


  const busqueda =
    String(
      valorBusqueda || ""
    ).trim();


  if (!busqueda) {
    errors.valorBusqueda =
      "Este campo es obligatorio";

  } else if (
    busqueda.length < 2
  ) {
    errors.valorBusqueda =
      "Ingrese al menos 2 caracteres";
  }


  if (!fechaInicio) {
    errors.fechaInicio =
      "Este campo es obligatorio";
  }


  if (!fechaFin) {
    errors.fechaFin =
      "Este campo es obligatorio";
  }


  if (
    fechaInicio &&
    fechaFin &&
    fechaInicio > fechaFin
  ) {
    errors.fechaFin =
      "La fecha final no puede ser menor a la inicial";
  }


  return errors;
}


/* =========================================================
   ERROR HTTP
   ========================================================= */

function obtenerErrorHttp(err) {
  return {
    status:
      Number(
        err?.response?.status
      ) || 500,

    data:
      err?.response?.data &&
      typeof err.response.data === "object"
        ? err.response.data
        : {
            message:
              err?.message ||
              "No se pudo conectar con el servidor.",
          },
  };
}


/* =========================================================
   ERROR BLOB PDF / EXCEL
   ========================================================= */

async function obtenerErrorBlob(
  err
) {
  const status =
    Number(
      err?.response?.status
    ) || 500;


  const responseData =
    err?.response?.data;


  if (
    responseData instanceof Blob
  ) {
    try {

      const text =
        await responseData.text();


      const json =
        JSON.parse(
          text
        );


      return {
        status,

        data: {
          message:
            json?.message ||
            "No fue posible realizar la exportación.",

          code:
            json?.code ||
            json?.codigo ||
            null,

          type:
            json?.type ||
            "validation",
        },
      };


    } catch {

      return {
        status,

        data: {
          message:
            "No fue posible procesar la respuesta de exportación.",
        },
      };
    }
  }


  return obtenerErrorHttp(
    err
  );
}


/* =========================================================
   CALENDARIO
   ========================================================= */

function abrirCalendario(
  inputEl
) {
  if (!inputEl) {
    return;
  }


  if (
    typeof inputEl.showPicker ===
    "function"
  ) {
    inputEl.showPicker();

    return;
  }


  inputEl.focus();

  inputEl.click();
}


/* =========================================================
   PDF
   ========================================================= */

function abrirBlobEnPestana(
  blob,
  ventana
) {
  const url =
    URL.createObjectURL(
      blob
    );


  try {

    if (
      ventana &&
      !ventana.closed
    ) {

      ventana.location.href =
        url;

      ventana.focus();

    } else {

      window.open(
        url,
        "_blank"
      );
    }


  } finally {

    setTimeout(
      () => {

        URL.revokeObjectURL(
          url
        );

      },
      60_000
    );
  }
}


/* =========================================================
   EXCEL
   ========================================================= */

function descargarBlob(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(
      blob
    );


  const link =
    document.createElement(
      "a"
    );


  link.href =
    url;

  link.download =
    filename;


  document.body.appendChild(
    link
  );


  link.click();

  link.remove();


  setTimeout(
    () => {

      URL.revokeObjectURL(
        url
      );

    },
    30_000
  );
}


/* =========================================================
   CAMPO FECHA
   ========================================================= */

const DateField = ({
  name,
  value,
  error,
  inputRef,
  onChange,
}) => {

  const handleCalendar =
    () => {

      abrirCalendario(
        inputRef?.current
      );

    };


  return (

    <div className="historial-date-field">

      <InputGroup className="historial-date-input-group">

        <Form.Control
          ref={inputRef}

          type="date"

          name={name}

          value={value}

          onChange={onChange}

          className={`
            app-control
            ${
              error
                ? "is-invalid"
                : ""
            }
          `}
        />


        <InputGroup.Text
          role="button"

          tabIndex={0}

          title="Abrir calendario"

          className="historial-date-trigger"

          onClick={
            handleCalendar
          }

          onKeyDown={(e) => {

            if (
              e.key === "Enter" ||
              e.key === " "
            ) {
              handleCalendar();
            }

          }}
        >

          <FaCalendarAlt />

        </InputGroup.Text>

      </InputGroup>


      {error && (

        <div className="invalid-feedback d-block historial-error">

          {error}

        </div>

      )}

    </div>
  );
};


/* =========================================================
   COMPONENTE
   ========================================================= */

const HistorialRecoleccion =
  () => {

  /* =======================================================
     FORMULARIO
     ======================================================= */

  const [
    formData,
    setFormData,
  ] = useState({
    buscarPor: "",
    valorBusqueda: "",
    fechaInicio: "",
    fechaFin: "",
    order: "desc",
  });


  const [
    errors,
    setErrors,
  ] = useState({});


  /* =======================================================
     CARGA
     ======================================================= */

  const [
    loading,
    setLoading,
  ] = useState(false);


  /*
    IMPORTANTE:

    false:
    no renderizar tablas.

    true:
    backend confirmó una búsqueda válida
    con resultados.
  */

  const [
    hasSearched,
    setHasSearched,
  ] = useState(false);


  /* =======================================================
     RESULTADOS
     ======================================================= */

  const [
    detalle,
    setDetalle,
  ] = useState([]);


  const [
    pesaje,
    setPesaje,
  ] = useState([]);


  const [
    page,
    setPage,
  ] = useState(1);


  const [
    total,
    setTotal,
  ] = useState(0);


  const [
    pageSize,
    setPageSize,
  ] = useState(
    DEFAULT_PAGE_SIZE
  );


  /* =======================================================
     SNAPSHOT
     ======================================================= */

  const [
    exportId,
    setExportId,
  ] = useState("");


  const [
    exportExpiresAtMs,
    setExportExpiresAtMs,
  ] = useState(null);


  const [
    exportExpired,
    setExportExpired,
  ] = useState(false);


  /* =======================================================
     REFERENCIAS
     ======================================================= */

  const fechaInicioRef =
    useRef(null);


  const fechaFinRef =
    useRef(null);


  /* =======================================================
     TOTAL DE PÁGINAS
     ======================================================= */

  const totalPages =
    useMemo(() => {

      if (
        total <= 0 ||
        pageSize <= 0
      ) {
        return 1;
      }


      return Math.max(
        1,
        Math.ceil(
          total /
          pageSize
        )
      );

    }, [
      total,
      pageSize,
    ]);


  /* =======================================================
     LIMPIAR EXPORTACIÓN
     ======================================================= */

  const limpiarExportacion =
    useCallback(() => {

      setExportId("");

      setExportExpiresAtMs(
        null
      );

      setExportExpired(
        false
      );

    }, []);


  /* =======================================================
     LIMPIAR RESULTADOS

     Oculta completamente la tabla anterior.
     ======================================================= */

  const limpiarResultados =
    useCallback(() => {

      setDetalle([]);

      setPesaje([]);

      setTotal(0);

      setPage(1);

      setPageSize(
        DEFAULT_PAGE_SIZE
      );


      limpiarExportacion();

    }, [
      limpiarExportacion,
    ]);


  /* =======================================================
     BLOQUEAR EXPORTACIÓN

     No elimina resultados.

     Solo bloquea PDF / Excel y muestra Modal.
     ======================================================= */

  const bloquearExportacion =
    useCallback(
      (
        message =
          MENSAJE_EXPORTACION_EXPIRADA,

        code =
          "EXPORT_SNAPSHOT_EXPIRADO"
      ) => {

        setExportId("");

        setExportExpiresAtMs(
          null
        );

        setExportExpired(
          true
        );


        void showBackendAlert({
          status: 410,

          data: {
            message,

            code,

            type:
              "validation",
          },
        });

      },
      []
    );


  /* =======================================================
     TEMPORIZADOR DEL SNAPSHOT
     ======================================================= */

  useEffect(() => {

    if (
      !exportId ||
      !Number.isFinite(
        exportExpiresAtMs
      )
    ) {
      return undefined;
    }


    const tiempoRestante =
      exportExpiresAtMs -
      Date.now();


    if (
      tiempoRestante <= 0
    ) {

      bloquearExportacion();

      return undefined;
    }


    const timer =
      window.setTimeout(
        () => {

          bloquearExportacion();

        },
        tiempoRestante
      );


    return () => {

      window.clearTimeout(
        timer
      );

    };

  }, [
    exportId,
    exportExpiresAtMs,
    bloquearExportacion,
  ]);


  /* =======================================================
     LIMPIAR ERROR DE CAMPO
     ======================================================= */

  const limpiarErrorCampo =
    useCallback(
      (name) => {

        setErrors(
          (prev) => {

            if (
              !prev[name]
            ) {
              return prev;
            }


            return {
              ...prev,

              [name]:
                "",
            };
          }
        );

      },
      []
    );


  /* =======================================================
     CAMBIO DE FILTROS

     Cualquier cambio invalida visualmente
     la búsqueda anterior.
     ======================================================= */

  const handleChange =
    useCallback(
      (e) => {

        const {
          name,
          value,
        } =
          e.target;


        setFormData(
          (prev) => ({
            ...prev,

            [name]:
              value,
          })
        );


        limpiarErrorCampo(
          name
        );


        /*
          Ocultamos inmediatamente
          resultados anteriores.
        */

        setHasSearched(
          false
        );


        limpiarResultados();

      },
      [
        limpiarErrorCampo,
        limpiarResultados,
      ]
    );


  /* =======================================================
     CONFIGURAR SNAPSHOT
     ======================================================= */

  const configurarSnapshot =
    useCallback(
      (data) => {

        const nuevoExportId =
          typeof data?.export_id ===
            "string"
            ? data.export_id.trim()
            : "";


        const segundos =
          Number(
            data
              ?.export_expires_in_seconds
          );


        if (
          nuevoExportId &&
          Number.isFinite(
            segundos
          ) &&
          segundos > 0
        ) {

          setExportId(
            nuevoExportId
          );


          setExportExpiresAtMs(
            Date.now() +
            (
              segundos *
              1000
            )
          );


          setExportExpired(
            false
          );


          return true;
        }


        limpiarExportacion();

        return false;

      },
      [
        limpiarExportacion,
      ]
    );


  /* =======================================================
     CONSULTA

     REGLA IMPORTANTE:

     Los datos NO se guardan en el estado visual hasta
     comprobar que toda la respuesta es válida.

     Esto evita que una tabla aparezca por un instante.
     ======================================================= */

  const consultar =
    useCallback(
      async (
        targetPage = 1,
        prepararExportacion = false
      ) => {

        setLoading(
          true
        );


        try {

          const response =
            await apiClient.get(
              "/historial-recoleccion",
              {
                params: {

                  buscarPor:
                    formData
                      .buscarPor,

                  valorBusqueda:
                    String(
                      formData
                        .valorBusqueda ||
                      ""
                    ).trim(),

                  fechaInicio:
                    formData
                      .fechaInicio,

                  fechaFin:
                    formData
                      .fechaFin,

                  order:
                    formData.order,

                  page:
                    targetPage,

                  prepararExportacion,
                },
              }
            );


          const data =
            response?.data ||
            {};


          /* =================================================
             PREPARAR DATOS

             Todavía NO hacemos setDetalle ni setPesaje.
             ================================================= */

          const totalBackend =
            Number(
              data.total
            );


          const totalSeguro =
            Number.isSafeInteger(
              totalBackend
            ) &&
            totalBackend >= 0
              ? totalBackend
              : 0;


          const pageBackend =
            Number(
              data.page
            );


          const pageSeguro =
            Number.isSafeInteger(
              pageBackend
            ) &&
            pageBackend >= 1
              ? pageBackend
              : targetPage;


          const limitBackend =
            Number(
              data.limit
            );


          const limitSeguro =
            Number.isSafeInteger(
              limitBackend
            ) &&
            limitBackend > 0
              ? limitBackend
              : DEFAULT_PAGE_SIZE;


          const detalleSeguro =
            Array.isArray(
              data?.data?.detalle
            )
              ? data.data.detalle
              : [];


          const pesajeSeguro =
            Array.isArray(
              data?.data?.pesaje
            )
              ? data.data.pesaje
              : [];


          /* =================================================
             SIN RESULTADOS

             No guardamos ningún dato.

             Las tablas continúan ocultas.
             ================================================= */

          if (
            totalSeguro === 0
          ) {

            setHasSearched(
              false
            );


            limpiarResultados();


            await showBackendAlert({
              status: 404,

              data: {
                message:
                  typeof data.message ===
                    "string"
                    ? data.message
                    : "No se encontraron registros con los criterios seleccionados.",
              },
            });


            return;
          }


          /* =================================================
             VERIFICAR QUE HAYA FILAS

             Protección adicional.

             total > 0 pero detalle vacío en página 1
             no debe mostrar una tabla vacía.
             ================================================= */

          if (
            prepararExportacion &&
            detalleSeguro.length === 0
          ) {

            setHasSearched(
              false
            );


            limpiarResultados();


            await showBackendAlert({
              status: 500,

              data: {
                message:
                  "El servidor indicó que existen registros, pero no devolvió información para mostrar.",
              },
            });


            return;
          }


          /* =================================================
             SNAPSHOT

             Solo en nueva búsqueda con Ver.
             ================================================= */

          if (
            prepararExportacion
          ) {

            const snapshotConfigurado =
              configurarSnapshot(
                data
              );


            if (
              !snapshotConfigurado
            ) {

              setHasSearched(
                false
              );


              limpiarResultados();


              await showBackendAlert({
                status: 500,

                data: {
                  message:
                    "La consulta se realizó correctamente, pero no fue posible habilitar temporalmente la exportación. Presione 'Ver' nuevamente.",
                },
              });


              return;
            }
          }


          /* =================================================
             RESPUESTA CONFIRMADA

             RECIÉN AQUÍ actualizamos la pantalla.
             ================================================= */

          setTotal(
            totalSeguro
          );


          setPage(
            pageSeguro
          );


          setPageSize(
            limitSeguro
          );


          setDetalle(
            detalleSeguro
          );


          setPesaje(
            pesajeSeguro
          );


          /* =================================================
             MOSTRAR TABLAS

             Solo nueva búsqueda válida.

             Durante paginación ya estaba en true.
             ================================================= */

          if (
            prepararExportacion
          ) {

            setHasSearched(
              true
            );

          }


        } catch (err) {

          const errorHttp =
            obtenerErrorHttp(
              err
            );


          /*
            Si esta petición viene del botón Ver,
            jamás dejamos visible información anterior.
          */

          if (
            prepararExportacion
          ) {

            setHasSearched(
              false
            );


            limpiarResultados();

          }


          await showBackendAlert({
            status:
              errorHttp.status,

            data:
              errorHttp.data,
          });


        } finally {

          setLoading(
            false
          );

        }

      },
      [
        formData,
        configurarSnapshot,
        limpiarResultados,
      ]
    );


  /* =======================================================
     BOTÓN VER

     CORRECCIÓN DEL BUG:

     NO hacemos setHasSearched(true) aquí.
     ======================================================= */

  const handleSubmit =
    useCallback(
      async (e) => {

        e.preventDefault();


        const validationErrors =
          validarFormulario(
            formData
          );


        setErrors(
          validationErrors
        );


        /* =================================================
           CAMPOS INVÁLIDOS
           ================================================= */

        if (
          Object.keys(
            validationErrors
          ).length > 0
        ) {

          setHasSearched(
            false
          );


          limpiarResultados();


          return;
        }


        /* =================================================
           NUEVA BÚSQUEDA

           PRIMERO:
           ocultamos tabla anterior.

           DESPUÉS:
           consultamos backend.

           Solo consultar() puede volver a poner
           hasSearched=true cuando todo sea correcto.
           ================================================= */

        setHasSearched(
          false
        );


        limpiarResultados();


        await consultar(
          1,
          true
        );

      },
      [
        consultar,
        formData,
        limpiarResultados,
      ]
    );


  /* =======================================================
     PAGINACIÓN

     No borra la tabla mientras cambia página.
     No crea snapshot nuevo.
     ======================================================= */

  const handlePageChange =
    useCallback(
      async (
        nextPage
      ) => {

        if (loading) {
          return;
        }


        const pagina =
          Number(
            nextPage
          );


        if (
          !Number.isSafeInteger(
            pagina
          ) ||
          pagina < 1 ||
          pagina >
            totalPages ||
          pagina === page
        ) {
          return;
        }


        await consultar(
          pagina,
          false
        );

      },
      [
        consultar,
        loading,
        page,
        totalPages,
      ]
    );


  /* =======================================================
     EXPORTACIÓN
     ======================================================= */

  const canExport =
    hasSearched &&
    !loading &&
    total > 0 &&
    Boolean(
      exportId
    ) &&
    !exportExpired;


  /* =======================================================
     PDF
     ======================================================= */

  const handleExportPdf =
    useCallback(
      async () => {

        if (
          !canExport
        ) {
          return;
        }


        const newTab =
          window.open(
            "about:blank",
            "_blank"
          );


        try {

          const response =
            await apiClient.get(
              "/historial-recoleccion/export/pdf",
              {
                params: {
                  exportId,
                },

                responseType:
                  "blob",
              }
            );


          const blob =
            response.data
              instanceof Blob
              ? response.data
              : new Blob(
                  [
                    response.data,
                  ],
                  {
                    type:
                      "application/pdf",
                  }
                );


          abrirBlobEnPestana(
            blob,
            newTab
          );


        } catch (err) {

          if (
            newTab &&
            !newTab.closed
          ) {
            newTab.close();
          }


          const errorHttp =
            await obtenerErrorBlob(
              err
            );


          const codigo =
            errorHttp
              ?.data?.code ||
            errorHttp
              ?.data?.codigo ||
            null;


          if (
            codigo ===
              "EXPORT_SNAPSHOT_EXPIRADO" ||
            codigo ===
              "EXPORT_SNAPSHOT_INVALIDO"
          ) {

            setExportId("");

            setExportExpiresAtMs(
              null
            );

            setExportExpired(
              true
            );


            await showBackendAlert({
              status:
                errorHttp.status,

              data:
                errorHttp.data,
            });


            return;
          }


          await showBackendAlert({
            status:
              errorHttp.status,

            data:
              errorHttp.data,
          });

        }

      },
      [
        canExport,
        exportId,
      ]
    );


  /* =======================================================
     EXCEL
     ======================================================= */

  const handleExportExcel =
    useCallback(
      async () => {

        if (
          !canExport
        ) {
          return;
        }


        try {

          const response =
            await apiClient.get(
              "/historial-recoleccion/export/excel",
              {
                params: {
                  exportId,
                },

                responseType:
                  "blob",
              }
            );


          const blob =
            response.data
              instanceof Blob
              ? response.data
              : new Blob(
                  [
                    response.data,
                  ],
                  {
                    type:
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }
                );


          descargarBlob(
            blob,
            "historial_recoleccion.xlsx"
          );


        } catch (err) {

          const errorHttp =
            await obtenerErrorBlob(
              err
            );


          const codigo =
            errorHttp
              ?.data?.code ||
            errorHttp
              ?.data?.codigo ||
            null;


          if (
            codigo ===
              "EXPORT_SNAPSHOT_EXPIRADO" ||
            codigo ===
              "EXPORT_SNAPSHOT_INVALIDO"
          ) {

            setExportId("");

            setExportExpiresAtMs(
              null
            );

            setExportExpired(
              true
            );


            await showBackendAlert({
              status:
                errorHttp.status,

              data:
                errorHttp.data,
            });


            return;
          }


          await showBackendAlert({
            status:
              errorHttp.status,

            data:
              errorHttp.data,
          });

        }

      },
      [
        canExport,
        exportId,
      ]
    );


  /* =======================================================
     VISTA
     ======================================================= */

  return (

    <main className="historial-recoleccion-container app-page">


      {/* ===================================================
          BÚSQUEDA
          =================================================== */}

      <Card className="app-card historial-search-card">

        <Card.Body className="app-card-body">


          <div className="app-section-heading">

            <h1 className="app-page-title">

              <FaHistory
                className="app-page-title-icon"
                aria-hidden="true"
              />

              Historial de Recolección

            </h1>

          </div>


          <div className="app-divider" />


          <Form
            onSubmit={
              handleSubmit
            }

            className="historial-search-form"
          >


            {/* =============================================
                FILTROS PRINCIPALES
                ============================================= */}

            <div className="historial-filter-grid">


              {/* BUSCAR POR */}

              <div className="historial-filter-group">

                <Form.Label className="app-label">

                  Buscar por

                </Form.Label>


                <Form.Select
                  name="buscarPor"

                  value={
                    formData.buscarPor
                  }

                  onChange={
                    handleChange
                  }

                  className={`
                    app-control
                    historial-field
                    ${
                      errors.buscarPor
                        ? "is-invalid"
                        : ""
                    }
                  `}
                >

                  <option value="">
                    Seleccione…
                  </option>

                  <option value="codigo">
                    Código
                  </option>

                  <option value="tipo">
                    Tipo Residuo
                  </option>

                </Form.Select>


                {errors.buscarPor && (

                  <div className="invalid-feedback d-block historial-error">

                    {errors.buscarPor}

                  </div>

                )}

              </div>


              {/* BÚSQUEDA */}

              <div className="historial-filter-group">

                <Form.Label className="app-label">

                  Búsqueda

                </Form.Label>


                <InputGroup className="historial-search-input-group">

                  <InputGroup.Text className="historial-search-icon">

                    <FaSearch />

                  </InputGroup.Text>


                  <Form.Control
                    type="text"

                    name="valorBusqueda"

                    placeholder="Ej: CNT-001 o Bioinfeccioso..."

                    value={
                      formData.valorBusqueda
                    }

                    onChange={
                      handleChange
                    }

                    className={`
                      app-control
                      historial-field
                      historial-search-input
                      ${
                        errors.valorBusqueda
                          ? "is-invalid"
                          : ""
                      }
                    `}
                  />

                </InputGroup>


                {errors.valorBusqueda && (

                  <div className="invalid-feedback d-block historial-error">

                    {errors.valorBusqueda}

                  </div>

                )}

              </div>


              {/* ORDEN */}

              <div className="historial-filter-group">

                <Form.Label className="app-label">

                  Orden

                </Form.Label>


                <Form.Select
                  name="order"

                  value={
                    formData.order
                  }

                  onChange={
                    handleChange
                  }

                  className="app-control historial-field"
                >

                  <option value="desc">
                    Fecha (Más reciente)
                  </option>

                  <option value="asc">
                    Fecha (Más antigua)
                  </option>

                </Form.Select>

              </div>

            </div>


            {/* =============================================
                FECHAS
                ============================================= */}

            <div className="historial-date-group">

              <Form.Label className="app-label">

                Rango de Fechas

              </Form.Label>


              <div className="historial-date-range">

                <DateField
                  name="fechaInicio"

                  value={
                    formData.fechaInicio
                  }

                  error={
                    errors.fechaInicio
                  }

                  inputRef={
                    fechaInicioRef
                  }

                  onChange={
                    handleChange
                  }
                />


                <span
                  className="historial-date-separator"
                  aria-hidden="true"
                >
                  —
                </span>


                <DateField
                  name="fechaFin"

                  value={
                    formData.fechaFin
                  }

                  error={
                    errors.fechaFin
                  }

                  inputRef={
                    fechaFinRef
                  }

                  onChange={
                    handleChange
                  }
                />

              </div>

            </div>


            {/* =============================================
                VER
                ============================================= */}

            <div className="historial-submit-wrap">

              <Button
                type="submit"

                variant="primary"

                className="app-btn historial-submit-btn"

                disabled={
                  loading
                }
              >

                <FaSearch
                  aria-hidden="true"
                />


                {
                  loading
                    ? "Consultando..."
                    : "Ver"
                }

              </Button>

            </div>

          </Form>

        </Card.Body>

      </Card>


      {/* ===================================================
          RESULTADOS

          Solo existen después de una respuesta
          completamente válida.
          =================================================== */}

      {hasSearched && (

        <section className="historial-results">

          <HistorialEnTablas
            loading={
              loading
            }

            detalle={
              detalle
            }

            pesaje={
              pesaje
            }

            page={
              page
            }

            total={
              total
            }

            pageSize={
              pageSize
            }

            onPageChange={
              handlePageChange
            }

            canExport={
              canExport
            }

            exportExpired={
              exportExpired
            }

            onExportPdf={
              handleExportPdf
            }

            onExportExcel={
              handleExportExcel
            }
          />

        </section>

      )}

    </main>
  );
};


export default HistorialRecoleccion;