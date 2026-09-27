import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Card,
  Form,
  Button,
  Spinner,
} from "react-bootstrap";

import {
  FaInfoCircle,
  FaExclamationTriangle,
  FaBell,
} from "react-icons/fa";

import apiClient from "../../utils/apiClient";

import {
  showConfirmAlert,
  showSuccessAlert,
  showInfoAlert,
  showBackendAlert,
} from "../../utils/alerts";

import AlertasProgramadas from "./AlertasProgramadas";

import "../../styles/umbral-llenado.css";


// ======================================================
// OPCIONES PERMITIDAS EN LA INTERFAZ
// ======================================================
//
// El backend también valida estos valores.
//
// Los porcentajes seleccionados NO se guardan aquí:
// se obtienen de PostgreSQL.
// ======================================================

const OPCIONES_PRIMER_AVISO = [
  40,
  50,
  60,
];

const OPCIONES_NIVEL_ALTO = [
  70,
  80,
  90,
];


// ======================================================
// COMPONENTE
// ======================================================

const UmbralDeLlenado = () => {

  // ====================================================
  // CONFIGURACIÓN
  // ====================================================

  const [formData, setFormData] = useState({
    primerAviso: null,
    nivelAlto: null,
  });

  const [
    configuracionGuardada,
    setConfiguracionGuardada,
  ] = useState(null);

  const [
    configuracionActiva,
    setConfiguracionActiva,
  ] = useState(true);


  // ====================================================
  // ESTADOS DE INTERFAZ
  // ====================================================

  const [errors, setErrors] = useState({});

  const [isEditing, setIsEditing] = useState(true);

  const [mostrarAlertas, setMostrarAlertas] =
    useState(false);

  const [cargando, setCargando] = useState(true);

  const [guardando, setGuardando] = useState(false);

  const [configuracionCargada, setConfiguracionCargada] =
    useState(false);

  const guardadoEnCursoRef = useRef(false);

  const componenteMontadoRef = useRef(false);


  // ====================================================
  // CARGAR CONFIGURACIÓN DESDE POSTGRESQL
  // ====================================================

  const cargarConfiguracion = useCallback(
    async () => {

      setCargando(true);

      try {

        const response = await apiClient.get(
          "/configuracion-alertas"
        );

        const configuracion =
          response.data?.configuracion;

        const primerAviso = Number(
          configuracion?.primer_aviso_pct
        );

        const nivelAlto = Number(
          configuracion?.segundo_aviso_pct
        );


        // ==============================================
        // VERIFICAR RESPUESTA
        // ==============================================

        if (
          response.data?.success !== true ||
          !OPCIONES_PRIMER_AVISO.includes(
            primerAviso
          ) ||
          !OPCIONES_NIVEL_ALTO.includes(
            nivelAlto
          ) ||
          primerAviso >= nivelAlto
        ) {

          throw new Error(
            "La configuración recibida del servidor no es válida."
          );
        }


        if (!componenteMontadoRef.current) {
          return;
        }


        const valores = {
          primerAviso,
          nivelAlto,
        };


        // ==============================================
        // DATOS RECIBIDOS DE BASE DE DATOS
        // ==============================================

        setFormData(valores);

        setConfiguracionGuardada(valores);

        setConfiguracionActiva(
          configuracion.activa === true
        );

        setConfiguracionCargada(true);

        setErrors({});


      } catch (error) {

        if (!componenteMontadoRef.current) {
          return;
        }

        setConfiguracionCargada(false);

        console.error(
          "Error consultando configuración de alertas:",
          error
        );

        await showBackendAlert({

          status:
            error?.response?.status || 500,

          data:
            error?.response?.data || {
              message:
                error.message ||
                "No fue posible cargar la configuración de alertas.",
            },

        });


      } finally {

        if (componenteMontadoRef.current) {
          setCargando(false);
        }

      }

    },
    []
  );


  // ====================================================
  // CARGA INICIAL
  // ====================================================

  useEffect(() => {

    componenteMontadoRef.current = true;

    cargarConfiguracion();

    return () => {

      componenteMontadoRef.current = false;

    };

  }, [
    cargarConfiguracion,
  ]);


  // ====================================================
  // CAMBIAR PORCENTAJE
  // ====================================================

  const handleChange = (event) => {

    if (
      !isEditing ||
      guardando
    ) {
      return;
    }

    const {
      name,
      value,
    } = event.target;


    setFormData((actual) => ({

      ...actual,

      [name]: Number(value),

    }));


    setErrors((actual) => ({

      ...actual,

      [name]: "",

    }));

  };


  // ====================================================
  // VALIDAR FORMULARIO
  // ====================================================

  const validate = () => {

    const nuevosErrores = {};


    if (
      !OPCIONES_PRIMER_AVISO.includes(
        formData.primerAviso
      )
    ) {

      nuevosErrores.primerAviso =
        "Debe seleccionar el porcentaje del primer aviso.";

    }


    if (
      !OPCIONES_NIVEL_ALTO.includes(
        formData.nivelAlto
      )
    ) {

      nuevosErrores.nivelAlto =
        "Debe seleccionar el porcentaje del nivel alto.";

    }


    if (
      Object.keys(nuevosErrores).length === 0 &&
      formData.primerAviso >= formData.nivelAlto
    ) {

      nuevosErrores.nivelAlto =
        "El nivel alto debe ser mayor que el primer aviso.";

    }


    return nuevosErrores;

  };


  // ====================================================
  // GUARDAR CONFIGURACIÓN
  // ====================================================

  const handleSave = async () => {

    // ==================================================
    // EVITAR SOLICITUDES DUPLICADAS
    // ==================================================

    if (
      cargando ||
      guardando ||
      guardadoEnCursoRef.current ||
      !configuracionCargada
    ) {

      return;

    }


    // ==================================================
    // MODO EDITAR
    // ==================================================

    if (!isEditing) {

      setIsEditing(true);

      return;

    }


    // ==================================================
    // VALIDACIONES VISUALES
    // ==================================================

    const validationErrors = validate();


    if (
      Object.keys(validationErrors).length > 0
    ) {

      setErrors(validationErrors);

      return;

    }


    // ==================================================
    // SIN CAMBIOS
    // ==================================================

    if (
      configuracionGuardada &&
      formData.primerAviso ===
        configuracionGuardada.primerAviso &&
      formData.nivelAlto ===
        configuracionGuardada.nivelAlto
    ) {

      setIsEditing(false);

      await showInfoAlert(
        "No hay cambios pendientes en la configuración."
      );

      return;

    }


    // ==================================================
    // CONFIRMACIÓN CENTRALIZADA
    // ==================================================

    await showConfirmAlert(

      "¿Desea guardar los cambios?",

      "Los porcentajes seleccionados se aplicarán a ambos contenedores.",

      async () => {

        if (guardadoEnCursoRef.current) {
          return;
        }

        guardadoEnCursoRef.current = true;

        setGuardando(true);


        try {

          // ============================================
          // GUARDAR EN POSTGRESQL
          // ============================================

          const response = await apiClient.put(

            "/configuracion-alertas",

            {

              primer_aviso_pct:
                formData.primerAviso,

              segundo_aviso_pct:
                formData.nivelAlto,

            }

          );


          const configuracion =
            response.data?.configuracion;


          if (
            response.data?.success !== true ||
            !configuracion
          ) {

            throw new Error(
              "El servidor no confirmó el guardado de la configuración."
            );

          }


          // ============================================
          // USAR VALORES CONFIRMADOS POR EL BACKEND
          // ============================================

          const valoresGuardados = {

            primerAviso: Number(
              configuracion.primer_aviso_pct
            ),

            nivelAlto: Number(
              configuracion.segundo_aviso_pct
            ),

          };


          if (componenteMontadoRef.current) {

            setFormData(
              valoresGuardados
            );

            setConfiguracionGuardada(
              valoresGuardados
            );

            setConfiguracionActiva(
              configuracion.activa === true
            );

            setErrors({});

            setIsEditing(false);

          }


          // ============================================
          // ÉXITO REAL
          // ============================================

          await showSuccessAlert(
            "Los umbrales de llenado se guardaron correctamente."
          );


        } catch (error) {

          console.error(
            "Error guardando configuración de alertas:",
            error
          );


          await showBackendAlert({

            status:
              error?.response?.status || 500,

            data:
              error?.response?.data || {
                message:
                  error.message ||
                  "No fue posible guardar la configuración de alertas.",
              },

          });


        } finally {

          guardadoEnCursoRef.current = false;

          if (componenteMontadoRef.current) {
            setGuardando(false);
          }

        }

      }

      /*
       * Si el usuario selecciona "No",
       * no hacemos nada.
       *
       * Conservamos sus porcentajes para que
       * pueda revisarlos y volver a guardar.
       */

    );

  };


  // ====================================================
  // DESHABILITAR CAMPOS CUANDO CORRESPONDA
  // ====================================================

  const camposDeshabilitados =
    !isEditing ||
    !configuracionCargada ||
    cargando ||
    guardando;


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <div className="container-fluid px-2 px-md-4 py-3">

      <div className="row g-4">


        {/* ============================================
            COLUMNA IZQUIERDA
            CONFIGURACIÓN DE UMBRALES
        ============================================ */}

        <div className="col-12 col-lg-6">

          <h4 className="fw-bold d-flex align-items-center mb-4">

            <FaInfoCircle
              className="text-primary me-2"
            />

            Umbral de Llenado

          </h4>


          {/* ==========================================
              ESTADO DE CARGA
          ========================================== */}

          {cargando && (

            <div
              className="d-flex align-items-center gap-2 mb-3"
              role="status"
            >

              <Spinner
                animation="border"
                size="sm"
              />

              <span>
                Cargando configuración de alertas...
              </span>

            </div>

          )}


          {/* ==========================================
              ERROR DE CARGA
          ========================================== */}

          {!cargando &&
            !configuracionCargada && (

              <Card className="mb-4 shadow-sm border-0">

                <Card.Body>

                  <p className="mb-3">

                    No fue posible cargar los
                    umbrales de llenado.

                  </p>

                  <Button
                    variant="outline-primary"
                    onClick={
                      cargarConfiguracion
                    }
                  >

                    Reintentar

                  </Button>

                </Card.Body>

              </Card>

            )}


          {/* ==========================================
              CONFIGURACIÓN INACTIVA
          ========================================== */}

          {configuracionCargada &&
            !configuracionActiva && (

              <div
                className="alert alert-warning"
                role="status"
              >

                La configuración de alertas
                de nivel está desactivada.
                Los porcentajes pueden
                consultarse, pero las alertas
                no se emitirán mientras
                permanezca inactiva.

              </div>

            )}


          {/* ==========================================
              PRIMER AVISO
          ========================================== */}

          <Card className="mb-4 shadow-sm border-0 w-100">

            <Card.Body>

              <h6 className="fw-bold text-warning d-flex align-items-center">

                <FaExclamationTriangle
                  className="me-2"
                />

                Primer aviso de llenado

              </h6>

              <hr />

              <Form>

                {OPCIONES_PRIMER_AVISO.map(
                  (opcion) => (

                    <Form.Check

                      key={opcion}

                      type="radio"

                      name="primerAviso"

                      label={`${opcion}%`}

                      value={opcion}

                      checked={
                        formData.primerAviso ===
                        opcion
                      }

                      onChange={
                        handleChange
                      }

                      disabled={
                        camposDeshabilitados
                      }

                      className={
                        errors.primerAviso
                          ? "is-invalid"
                          : ""
                      }

                    />

                  )
                )}


                {errors.primerAviso && (

                  <div className="invalid-feedback d-block">

                    {errors.primerAviso}

                  </div>

                )}

              </Form>

            </Card.Body>

          </Card>


          {/* ==========================================
              NIVEL ALTO
          ========================================== */}

          <Card className="mb-4 shadow-sm border-0 w-100">

            <Card.Body>

              <h6 className="fw-bold text-danger d-flex align-items-center">

                <FaExclamationTriangle
                  className="me-2"
                />

                Nivel alto de llenado

              </h6>

              <hr />

              <Form>

                {OPCIONES_NIVEL_ALTO.map(
                  (opcion) => (

                    <Form.Check

                      key={opcion}

                      type="radio"

                      name="nivelAlto"

                      label={`${opcion}%`}

                      value={opcion}

                      checked={
                        formData.nivelAlto ===
                        opcion
                      }

                      onChange={
                        handleChange
                      }

                      disabled={
                        camposDeshabilitados
                      }

                      className={
                        errors.nivelAlto
                          ? "is-invalid"
                          : ""
                      }

                    />

                  )
                )}


                {errors.nivelAlto && (

                  <div className="invalid-feedback d-block">

                    {errors.nivelAlto}

                  </div>

                )}

              </Form>

            </Card.Body>

          </Card>


          {/* ==========================================
              BOTONES
          ========================================== */}

          <div className="d-flex flex-wrap gap-2">

            <Button

              variant={
                isEditing
                  ? "success"
                  : "primary"
              }

              onClick={
                handleSave
              }

              disabled={
                !configuracionCargada ||
                cargando ||
                guardando
              }

            >

              {guardando
                ? "Guardando..."
                : isEditing
                  ? "Guardar"
                  : "Editar"}

            </Button>


            <Button

              variant="outline-dark"

              className="btn-configurar-alertas"

              onClick={() => {

                setMostrarAlertas(
                  (actual) => !actual
                );

              }}

            >

              <FaBell className="me-2" />

              {mostrarAlertas
                ? "Ocultar alertas"
                : "Configurar alertas"}

            </Button>

          </div>


          {/* ==========================================
              INFORMACIÓN
          ========================================== */}

          <small className="text-muted d-block mt-3">

            Los porcentajes configurados
            se aplican a los dos contenedores
            del sistema.

          </small>

        </div>


        {/* ============================================
            COLUMNA DERECHA
            ALERTAS PROGRAMADAS
        ============================================ */}

        {mostrarAlertas && (

          <div className="col-12 col-lg-6">

            <Card className="shadow-sm border-0 w-100 p-3">

              <AlertasProgramadas />

            </Card>

          </div>

        )}


      </div>

    </div>

  );

};


export default UmbralDeLlenado;