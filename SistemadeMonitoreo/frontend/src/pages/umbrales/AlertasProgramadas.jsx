import React, {
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
  FaClock,
  FaPen,
  FaCalendarAlt,
  FaInfoCircle,
} from "react-icons/fa";

import apiClient from "../../utils/apiClient";

import {
  showConfirmAlert,
  showSuccessAlert,
  showBackendAlert,
} from "../../utils/alerts";

import "../../styles/umbral-llenado.css";


// ======================================================
// VALORES INICIALES
// ======================================================

const FORMULARIO_INICIAL = {
  motivo: "",
  fecha: "",
  hora: "",
};


// ======================================================
// COMPONENTE
// ======================================================

const AlertasProgramadas = () => {

  // ====================================================
  // ESTADOS
  // ====================================================

  const [
    formData,
    setFormData,
  ] = useState({
    ...FORMULARIO_INICIAL,
  });

  const [
    errors,
    setErrors,
  ] = useState({});

  const [
    guardando,
    setGuardando,
  ] = useState(false);

  const [
    ultimaAlerta,
    setUltimaAlerta,
  ] = useState(null);


  // ====================================================
  // EVITAR GUARDADOS DUPLICADOS
  // ====================================================

  const operacionEnCursoRef =
    useRef(false);


  // ====================================================
  // MANEJAR CAMBIOS
  // ====================================================

  const handleChange = (event) => {

    if (operacionEnCursoRef.current) {
      return;
    }

    const {
      name,
      value,
    } = event.target;


    setFormData((actual) => ({

      ...actual,

      [name]: value,

    }));


    setErrors((actual) => ({

      ...actual,

      [name]: "",

    }));

  };


  // ====================================================
  // VALIDAR FORMULARIO
  // ====================================================
  //
  // Estas validaciones mejoran la experiencia visual.
  //
  // El backend realiza nuevamente las validaciones
  // y comprueba que el horario sea futuro.
  // ====================================================

  const validate = () => {

    const nuevosErrores = {};


    if (!formData.motivo.trim()) {

      nuevosErrores.motivo =
        "Debe ingresar el motivo del recordatorio.";

    } else if (
      formData.motivo.trim().length > 500
    ) {

      nuevosErrores.motivo =
        "El motivo no puede superar los 500 caracteres.";

    }


    if (!formData.fecha) {

      nuevosErrores.fecha =
        "Debe seleccionar una fecha.";

    }


    if (!formData.hora) {

      nuevosErrores.hora =
        "Debe seleccionar una hora.";

    }


    return nuevosErrores;

  };


  // ====================================================
  // GUARDAR ALERTA PROGRAMADA
  // ====================================================

  const handleSave = async () => {

    // ==================================================
    // EVITAR CONFIRMACIONES SIMULTÁNEAS
    // ==================================================

    if (operacionEnCursoRef.current) {
      return;
    }


    // ==================================================
    // VALIDAR
    // ==================================================

    const validationErrors =
      validate();


    if (
      Object.keys(validationErrors).length > 0
    ) {

      setErrors(validationErrors);

      return;

    }


    // ==================================================
    // CONSERVAR VALORES QUE SE VAN A CONFIRMAR
    // ==================================================

    const datos = {

      motivo:
        formData.motivo.trim(),

      fecha:
        formData.fecha,

      hora:
        formData.hora,

    };


    operacionEnCursoRef.current = true;

    setGuardando(true);


    try {

      // ==================================================
      // CONFIRMACIÓN CENTRALIZADA
      // ==================================================

      await showConfirmAlert(

        "¿Desea guardar la alerta programada?",

        `Se registrará el recordatorio para el ${datos.fecha} a las ${datos.hora}, hora de Guatemala.`,

        async () => {

          try {

            // ==========================================
            // GUARDAR MEDIANTE EL BACKEND
            // ==========================================

            const response =
              await apiClient.post(

                "/alertas-programadas",

                datos

              );


            const alerta =
              response.data?.alerta;


            // ==========================================
            // VERIFICAR CONFIRMACIÓN REAL
            // ==========================================

            if (
              response.data?.success !== true ||
              !alerta?.id
            ) {

              throw new Error(
                "El servidor no confirmó el registro del recordatorio."
              );

            }


            // ==========================================
            // CONSERVAR REFERENCIA DEL REGISTRO
            // ==========================================

            setUltimaAlerta({

              id:
                alerta.id,

              motivo:
                alerta.motivo,

              fecha:
                datos.fecha,

              hora:
                datos.hora,

              estado:
                alerta.estado,

            });


            // ==========================================
            // LIMPIAR PARA UN NUEVO RECORDATORIO
            // ==========================================

            setFormData({
              ...FORMULARIO_INICIAL,
            });

            setErrors({});


            // ==========================================
            // ÉXITO REAL
            // ==========================================

            await showSuccessAlert(
              "El recordatorio se guardó correctamente y quedó pendiente de ejecución."
            );


          } catch (error) {

            console.error(
              "Error guardando alerta programada:",
              error
            );


            await showBackendAlert({

              status:
                error?.response?.status || 500,

              data:
                error?.response?.data || {

                  message:
                    error?.response
                      ? "No fue posible guardar el recordatorio."
                      : "No fue posible conectar con el servidor para guardar el recordatorio.",

                },

            });

          }

        }

        /*
         * Si selecciona "No":
         *
         * - No hacemos POST.
         * - No limpiamos los campos.
         * - Conservamos el motivo y horario.
         */

      );


    } finally {

      operacionEnCursoRef.current = false;

      setGuardando(false);

    }

  };


  // ======================================================
  // RENDER
  // ======================================================

  return (

    <div className="p-2 p-md-4">

      <h4 className="fw-bold d-flex align-items-center mb-4">

        <FaClock
          className="text-dark me-2"
        />

        Establecer Horario

      </h4>


      {/* ================================================
          MOTIVO
      ================================================ */}

      <Card className="mb-3 shadow-sm border-0 w-100">

        <Card.Body>

          <h6 className="fw-bold text-primary d-flex align-items-center">

            <FaPen className="me-2" />

            Motivo

          </h6>


          <Form.Control

            type="text"

            name="motivo"

            placeholder="Ej: Revisión periódica"

            maxLength={500}

            value={
              formData.motivo
            }

            onChange={
              handleChange
            }

            disabled={
              guardando
            }

            isInvalid={
              Boolean(errors.motivo)
            }

          />


          {errors.motivo && (

            <div className="invalid-feedback d-block">

              {errors.motivo}

            </div>

          )}

        </Card.Body>

      </Card>


      {/* ================================================
          FECHA
      ================================================ */}

      <Card className="mb-3 shadow-sm border-0 w-100">

        <Card.Body>

          <h6 className="fw-bold text-success d-flex align-items-center">

            <FaCalendarAlt className="me-2" />

            Fecha

          </h6>


          <Form.Control

            type="date"

            name="fecha"

            value={
              formData.fecha
            }

            onChange={
              handleChange
            }

            disabled={
              guardando
            }

            isInvalid={
              Boolean(errors.fecha)
            }

          />


          {errors.fecha && (

            <div className="invalid-feedback d-block">

              {errors.fecha}

            </div>

          )}

        </Card.Body>

      </Card>


      {/* ================================================
          HORA
      ================================================ */}

      <Card className="mb-3 shadow-sm border-0 w-100">

        <Card.Body>

          <h6 className="fw-bold text-info d-flex align-items-center">

            <FaClock className="me-2" />

            Hora

          </h6>


          <Form.Control

            type="time"

            name="hora"

            value={
              formData.hora
            }

            onChange={
              handleChange
            }

            disabled={
              guardando
            }

            isInvalid={
              Boolean(errors.hora)
            }

          />


          {errors.hora && (

            <div className="invalid-feedback d-block">

              {errors.hora}

            </div>

          )}

        </Card.Body>

      </Card>


      {/* ================================================
          BOTÓN GUARDAR
      ================================================ */}

      <div className="d-flex flex-wrap gap-2">

        <Button

          variant="primary"

          onClick={
            handleSave
          }

          disabled={
            guardando
          }

        >

          {guardando ? (

            <>

              <Spinner
                animation="border"
                size="sm"
                className="me-2"
              />

              Procesando...

            </>

          ) : (

            "Guardar"

          )}

        </Button>

      </div>


      {/* ================================================
          ÚLTIMO RECORDATORIO REGISTRADO
      ================================================ */}

      {ultimaAlerta && (

        <div
          className="alert alert-success mt-3 mb-0"
          role="status"
        >

          <strong>

            Recordatorio registrado

          </strong>


          <div className="mt-2">

            <strong>Motivo: </strong>

            {ultimaAlerta.motivo}

          </div>


          <div>

            <strong>Fecha: </strong>

            {ultimaAlerta.fecha}

          </div>


          <div>

            <strong>Hora: </strong>

            {ultimaAlerta.hora}

          </div>


          <div>

            <strong>Estado: </strong>

            {ultimaAlerta.estado}

          </div>

        </div>

      )}


      {/* ================================================
          INFORMACIÓN DE HORARIO
      ================================================ */}

      <div className="d-flex gap-2 align-items-start text-muted mt-3">

        <FaInfoCircle
          className="mt-1 flex-shrink-0"
        />

        <small>

          El horario se interpreta según la hora
          de Guatemala. El recordatorio debe
          programarse para una fecha y hora futuras.

        </small>

      </div>

    </div>

  );

};


export default AlertasProgramadas;