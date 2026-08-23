import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Form,
  Button,
  Card,
  Row,
  Col,
  InputGroup,
} from "react-bootstrap";

import {
  FaHistory,
  FaSearch,
  FaCalendarAlt,
} from "react-icons/fa";

import "../../styles/historial-recoleccion.css";
import "../../styles/historial-recoleccion2.css";
import HistorialEnTablas from "./HistorialEnTablas";
import apiClient from "../../utils/apiClient";


const LIMIT = 10;


/* =========================================================
   PAGINACIÓN
   ========================================================= */

const clampPage = (p, totalPages) =>
  Math.min(
    Math.max(1, p),
    totalPages
  );


/* =========================================================
   VALIDACIONES
   ========================================================= */

const buildValidationErrors = ({
  buscarPor,
  valorBusqueda,
  fechaInicio,
  fechaFin,
}) => {

  const errors = {};

  if (!buscarPor) {
    errors.buscarPor =
      "Este campo es obligatorio";
  }

  const value = String(
    valorBusqueda || ""
  ).trim();

  if (!value) {
    errors.valorBusqueda =
      "Este campo es obligatorio";
  } else if (value.length < 2) {
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

  if (fechaInicio && fechaFin) {

    const ini =
      new Date(
        `${fechaInicio}T00:00:00`
      );

    const fin =
      new Date(
        `${fechaFin}T23:59:59`
      );

    if (ini > fin) {
      errors.fechaFin =
        "La fecha final no puede ser menor a la inicial";
    }
  }

  return errors;
};


/* =========================================================
   MENSAJES DE ERROR
   ========================================================= */

const getErrorMessage = (err) =>
  err?.response?.data?.message ||
  err?.message ||
  "No se pudo conectar con el servidor.";


/* =========================================================
   ABRIR CALENDARIO NATIVO
   ========================================================= */

const tryOpenNativeDatePicker = (
  inputEl
) => {

  if (!inputEl) return;

  if (
    typeof inputEl.showPicker ===
    "function"
  ) {
    return inputEl.showPicker();
  }

  inputEl.focus();
  inputEl.click();
};


/* =========================================================
   ABRIR PDF
   ========================================================= */

const openBlobInNewTab = (
  blob,
  preOpenedWindow
) => {

  const url =
    URL.createObjectURL(blob);

  try {

    if (
      preOpenedWindow &&
      !preOpenedWindow.closed
    ) {

      preOpenedWindow.location.href =
        url;

      preOpenedWindow.focus();

    } else {

      window.open(
        url,
        "_blank"
      );
    }

  } finally {

    setTimeout(
      () =>
        URL.revokeObjectURL(url),
      60_000
    );
  }
};


/* =========================================================
   DESCARGAR ARCHIVO
   ========================================================= */

const downloadBlob = (
  blob,
  filename
) => {

  const url =
    URL.createObjectURL(blob);

  const a =
    document.createElement("a");

  a.href = url;
  a.download = filename;

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(url),
    30_000
  );
};


/* =========================================================
   CAMPO DE FECHA
   ========================================================= */

const DateField = ({
  name,
  value,
  error,
  inputRef,
  onChange,
}) => {

  const handleIconClick = () =>
    tryOpenNativeDatePicker(
      inputRef?.current
    );

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
            ${error ? "is-invalid" : ""}
          `}
        />

        <InputGroup.Text
          role="button"
          tabIndex={0}
          title="Abrir calendario"
          className="historial-date-trigger"
          onClick={handleIconClick}
          onKeyDown={(e) => {

            if (
              e.key === "Enter" ||
              e.key === " "
            ) {
              handleIconClick();
            }

          }}
        >

          <FaCalendarAlt />

        </InputGroup.Text>

      </InputGroup>

      {error && (

        <div className="invalid-feedback d-block">

          {error}

        </div>

      )}

    </div>
  );
};


/* =========================================================
   COMPONENTE PRINCIPAL
   ========================================================= */

const HistorialRecoleccion = () => {

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


  /* =======================================================
     ESTADOS
     ======================================================= */

  const [
    errors,
    setErrors,
  ] = useState({});

  const [
    loading,
    setLoading,
  ] = useState(false);


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
    serverMessage,
    setServerMessage,
  ] = useState("");

  const [
    hasSearched,
    setHasSearched,
  ] = useState(false);

  const [
    exportId,
    setExportId,
  ] = useState("");


  /* =======================================================
     REFERENCIAS DE FECHA
     ======================================================= */

  const fechaInicioRef =
    useRef(null);

  const fechaFinRef =
    useRef(null);


  /* =======================================================
     TOTAL DE PÁGINAS
     ======================================================= */

  const totalPages =
    useMemo(
      () =>
        Math.max(
          1,
          Math.ceil(
            (total || 0) / LIMIT
          )
        ),
      [total]
    );


  /* =======================================================
     LIMPIAR RESULTADOS
     ======================================================= */

  const resetResults =
    useCallback(() => {

      setDetalle([]);
      setPesaje([]);
      setTotal(0);
      setPage(1);
      setExportId("");

    }, []);


  /* =======================================================
     LIMPIAR ERROR DEL CAMPO
     ======================================================= */

  const clearErrorsFor =
    useCallback(
      (name) => {

        setErrors(
          (prev) =>
            prev[name]
              ? {
                  ...prev,
                  [name]: "",
                }
              : prev
        );

      },
      []
    );


  /* =======================================================
     CAMBIO DE CAMPOS
     ======================================================= */

  const handleChange =
    useCallback(
      (e) => {

        const {
          name,
          value,
        } = e.target;

        setFormData(
          (prev) => ({
            ...prev,
            [name]: value,
          })
        );

        clearErrorsFor(name);

        setHasSearched(false);

        setServerMessage("");

        resetResults();

      },
      [
        clearErrorsFor,
        resetResults,
      ]
    );


  /* =======================================================
     CONSULTAR HISTORIAL
     ======================================================= */

  const fetchHistorial =
    useCallback(
      async (
        targetPage = 1
      ) => {

        setLoading(true);

        setServerMessage("");

        try {

          const res =
            await apiClient.get(
              "/historial-recoleccion",
              {
                params: {

                  buscarPor:
                    formData.buscarPor,

                  valorBusqueda:
                    String(
                      formData.valorBusqueda ||
                        ""
                    ).trim(),

                  fechaInicio:
                    formData.fechaInicio,

                  fechaFin:
                    formData.fechaFin,

                  page:
                    targetPage,

                  limit:
                    LIMIT,

                  order:
                    formData.order,
                },
              }
            );


          const data =
            res.data || {};


          const totalValue =
            Number(
              data?.total || 0
            );


          setServerMessage(
            data?.message || ""
          );


          setTotal(
            totalValue
          );


          const nextPage =
            Number(
              data?.page ||
                targetPage
            );


          setPage(
            nextPage
          );


          setDetalle(
            data?.data?.detalle ||
              []
          );


          setPesaje(
            data?.data?.pesaje ||
              []
          );


          setExportId(
            totalValue > 0 &&
              data?.export_id
              ? String(
                  data.export_id
                )
              : ""
          );

        } catch (err) {

          resetResults();

          setServerMessage(
            getErrorMessage(err)
          );

        } finally {

          setLoading(false);

        }

      },
      [
        formData,
        resetResults,
      ]
    );


  /* =======================================================
     ENVIAR FORMULARIO
     ======================================================= */

  const handleSubmit =
    useCallback(
      async (e) => {

        e.preventDefault();


        const validationErrors =
          buildValidationErrors(
            formData
          );


        setErrors(
          validationErrors
        );


        if (
          Object.keys(
            validationErrors
          ).length > 0
        ) {

          setHasSearched(false);

          setServerMessage("");

          resetResults();

          return;
        }


        setHasSearched(true);

        setPage(1);

        await fetchHistorial(1);

      },
      [
        fetchHistorial,
        formData,
        resetResults,
      ]
    );


  /* =======================================================
     CAMBIO DE PÁGINA
     ======================================================= */

  const handlePageChange =
    useCallback(
      async (
        nextPage
      ) => {

        if (loading) return;


        const safeNext =
          clampPage(
            nextPage,
            totalPages
          );


        if (
          safeNext === page
        ) {
          return;
        }


        setPage(
          safeNext
        );


        await fetchHistorial(
          safeNext
        );

      },
      [
        fetchHistorial,
        loading,
        page,
        totalPages,
      ]
    );


  /* =======================================================
     EXPORTACIÓN DISPONIBLE
     ======================================================= */

  const canExport =
    hasSearched &&
    !loading &&
    total > 0 &&
    Boolean(exportId);


  /* =======================================================
     EXPORTAR PDF
     ======================================================= */

  const handleExportPdf =
    useCallback(
      async () => {

        if (!canExport) {
          return;
        }


        const newTab =
          window.open(
            "about:blank",
            "_blank"
          );


        try {

          const res =
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
            res.data instanceof Blob
              ? res.data
              : new Blob(
                  [res.data],
                  {
                    type:
                      "application/pdf",
                  }
                );


          openBlobInNewTab(
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


          setServerMessage(
            getErrorMessage(err)
          );

        }

      },
      [
        canExport,
        exportId,
      ]
    );


  /* =======================================================
     EXPORTAR EXCEL
     ======================================================= */

  const handleExportExcel =
    useCallback(
      async () => {

        if (!canExport) {
          return;
        }


        try {

          const res =
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
            res.data instanceof Blob
              ? res.data
              : new Blob(
                  [res.data],
                  {
                    type:
                      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                  }
                );


          downloadBlob(
            blob,
            "historial_recoleccion.xlsx"
          );

        } catch (err) {

          setServerMessage(
            getErrorMessage(err)
          );

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

      {/* ================================================
          TARJETA DE BÚSQUEDA
          ================================================ */}

      <Card className="app-card historial-search-card">

        <Card.Body className="app-card-body">


          {/* TÍTULO */}

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


          {/* ============================================
              FORMULARIO
              ============================================ */}

          <Form
            onSubmit={handleSubmit}
            className="historial-search-form"
          >


            {/* ========================================
                BUSCAR POR
                ======================================== */}

            <Row className="historial-form-row">

              <Col xs={12}>

                <Form.Label className="app-label">

                  Buscar por

                </Form.Label>

              </Col>


              <Col
                xs={12}
                className="historial-field-wrap"
              >

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

              </Col>


              {errors.buscarPor && (

                <Col xs={12}>

                  <div className="invalid-feedback d-block historial-error">

                    {
                      errors.buscarPor
                    }

                  </div>

                </Col>

              )}

            </Row>


            {/* ========================================
                TEXTO DE BÚSQUEDA
                ======================================== */}

            <Row className="historial-form-row">

              <Col xs={12}>

                <Form.Label className="app-label">

                  Búsqueda

                </Form.Label>

              </Col>


              <Col
                xs={12}
                className="historial-field-wrap"
              >

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
                    ${
                      errors.valorBusqueda
                        ? "is-invalid"
                        : ""
                    }
                  `}
                />

              </Col>


              {errors.valorBusqueda && (

                <Col xs={12}>

                  <div className="invalid-feedback d-block historial-error">

                    {
                      errors.valorBusqueda
                    }

                  </div>

                </Col>

              )}

            </Row>


            {/* ========================================
                RANGO DE FECHAS
                ======================================== */}

            <Row className="historial-form-row">

              <Col xs={12}>

                <Form.Label className="app-label">

                  Rango de Fechas

                </Form.Label>

              </Col>


              <Col xs={12}>

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

              </Col>

            </Row>


            {/* ========================================
                ORDEN
                ======================================== */}

            <Row className="historial-form-row">

              <Col xs={12}>

                <Form.Label className="app-label">

                  Orden

                </Form.Label>

              </Col>


              <Col
                xs={12}
                className="historial-field-wrap"
              >

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

              </Col>

            </Row>


            {/* ========================================
                BOTÓN VER
                ======================================== */}

            <div className="historial-submit-wrap">

              <Button
                type="submit"
                variant="primary"
                className="app-btn historial-submit-btn"
                disabled={loading}
              >

                <FaSearch
                  className="me-2"
                  aria-hidden="true"
                />

                {
                  loading
                    ? "Consultando..."
                    : "Ver"
                }

              </Button>

            </div>


            {/* ========================================
                MENSAJE BACKEND
                ======================================== */}

            {serverMessage && (

              <div
                className="historial-server-message"
                role="status"
              >

                {serverMessage}

              </div>

            )}


          </Form>

        </Card.Body>

      </Card>


      {/* ================================================
          RESULTADOS
          ================================================ */}

      {hasSearched && (

        <section className="historial-results">

          <HistorialEnTablas
            loading={loading}
            detalle={detalle}
            pesaje={pesaje}
            page={page}
            total={total}
            limit={LIMIT}
            onPageChange={
              handlePageChange
            }
            canExport={
              canExport
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