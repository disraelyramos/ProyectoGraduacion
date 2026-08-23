import React, {
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Modal,
  Button,
  Form,
  Alert,
  Spinner,
} from "react-bootstrap";

import {
  showConfirmAlert,
  showSuccessAlert,
  showBackendAlert,
} from "../../utils/alerts";

import apiClient from "../../utils/apiClient";

import "../../styles/nuevo-registro.css";


// ======================================================
// COMPONENTE
// ======================================================

const ModalCosto = ({
  show,
  handleClose,
  handleOpenTotales,
}) => {

  // ====================================================
  // ESTADOS DE INTERFAZ
  // ====================================================

  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    isEditing,
    setIsEditing,
  ] = useState(false);


  const [
    costoVigente,
    setCostoVigente,
  ] = useState("");


  const [
    costoInput,
    setCostoInput,
  ] = useState("");


  const [
    sinCostoVigente,
    setSinCostoVigente,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  // ====================================================
  // PROTECCIÓN CONTRA DOBLE PETICIÓN
  // ====================================================
  //
  // loading protege visualmente.
  //
  // Este ref protege inmediatamente incluso antes
  // de que React termine de actualizar el estado.
  // ====================================================

  const operacionEnCursoRef =
    useRef(false);


  // ====================================================
  // OBTENER COSTO VIGENTE
  // ====================================================

  useEffect(() => {

    if (!show) {
      return;
    }


    let activo =
      true;


    const fetchCostoGlobal =
      async () => {

        setLoading(true);

        setError("");

        setSinCostoVigente(
          false
        );

        setIsEditing(
          false
        );

        setCostoVigente(
          ""
        );

        setCostoInput(
          ""
        );


        try {

          const res =
            await apiClient.get(
              "/control-dsh/registro-pesaje/costo-global"
            );


          if (!activo) {
            return;
          }


          const costo =
            res.data
              ?.costo_por_libra;


          if (
            costo === null ||
            costo === undefined
          ) {

            setSinCostoVigente(
              true
            );

            setIsEditing(
              true
            );

            return;
          }


          setCostoVigente(
            String(costo)
          );


          setCostoInput(
            String(costo)
          );


        } catch (err) {

          if (!activo) {
            return;
          }


          const status =
            err?.response
              ?.status;


          const data =
            err?.response
              ?.data ||
            {};


          // =============================================
          // NO EXISTE COSTO VIGENTE
          // =============================================

          if (
            status === 404
          ) {

            setSinCostoVigente(
              true
            );

            setIsEditing(
              true
            );

            setCostoVigente(
              ""
            );

            setCostoInput(
              ""
            );

            return;
          }


          // =============================================
          // OTROS ERRORES
          // =============================================

          await showBackendAlert({
            status:
              status ||
              500,

            data:
              data,
          });


        } finally {

          if (activo) {

            setLoading(
              false
            );
          }
        }
      };


    fetchCostoGlobal();


    return () => {

      activo =
        false;

    };

  }, [show]);


  // ====================================================
  // VALIDAR COSTO INGRESADO
  // ====================================================

  const validarCosto = (
    value
  ) => {

    const costo =
      String(
        value ?? ""
      ).trim();


    if (!costo) {

      return "Debe ingresar un costo";
    }


    /*
     * Hasta 4 decimales.
     *
     * Ejemplos válidos:
     *
     * 12
     * 12.5
     * 12.25
     * 12.2500
     */
    if (
      !/^\d+(\.\d{1,4})?$/.test(
        costo
      )
    ) {

      return "Formato inválido (ej: 12, 12.5, 12.2500)";
    }


    const numero =
      Number(costo);


    if (
      !Number.isFinite(
        numero
      ) ||
      numero < 0
    ) {

      return "Costo inválido";
    }


    return "";
  };


  // ====================================================
  // EDITAR / GUARDAR COSTO NUEVO
  // ====================================================

  const handleEditSave = () => {

    if (
      loading ||
      operacionEnCursoRef.current
    ) {
      return;
    }


    // ==================================================
    // PRIMER CLIC: HABILITAR EDICIÓN
    // ==================================================

    if (!isEditing) {

      setIsEditing(
        true
      );

      setError(
        ""
      );

      return;
    }


    // ==================================================
    // VALIDAR CAMPO
    // ==================================================

    const errorValidacion =
      validarCosto(
        costoInput
      );


    if (errorValidacion) {

      setError(
        errorValidacion
      );

      return;
    }


    setError("");


    // ==================================================
    // CONFIRMACIÓN
    // ==================================================

    showConfirmAlert(

      "¿Desea guardar el costo por libra?",

      "Se aplicará como costo global para Bioinfeccioso y Punzocortante.",


      // ===============================================
      // SÍ
      // ===============================================

      async () => {

        /*
         * Protección inmediata.
         */
        if (
          operacionEnCursoRef.current
        ) {
          return;
        }


        operacionEnCursoRef.current =
          true;


        setLoading(
          true
        );


        try {

          const costoNum =
            Number(
              costoInput
            );


          /*
           * Este sí es un dato ingresado
           * explícitamente por el usuario.
           *
           * El backend vuelve a validarlo.
           */
          const res =
            await apiClient.post(
              "/control-dsh/registro-pesaje/costo-global",

              {
                costo_por_libra:
                  costoNum,
              }
            );


          /*
           * Solo actualizamos la visualización.
           *
           * El backend ya:
           *
           * - cambió el costo global;
           * - creó historial;
           * - confirmó el costo dentro del
           *   proceso EN_PROCESO.
           */
          const costoConfirmado =
            res.data
              ?.costo_por_libra;


          setCostoVigente(
            costoConfirmado !==
              undefined &&
            costoConfirmado !==
              null

              ? String(
                  costoConfirmado
                )

              : String(
                  costoNum
                )
          );


          setCostoInput(
            costoConfirmado !==
              undefined &&
            costoConfirmado !==
              null

              ? String(
                  costoConfirmado
                )

              : String(
                  costoNum
                )
          );


          setSinCostoVigente(
            false
          );


          setIsEditing(
            false
          );


          await showSuccessAlert(
            "Costo guardado correctamente"
          );


          /*
           * NO mandamos:
           *
           * costo
           * contenedor
           * proceso
           *
           * Foto 3 consultará todo
           * directamente desde backend.
           */
          handleOpenTotales?.();


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
                  "No fue posible guardar el costo.",
              },
          });


        } finally {

          operacionEnCursoRef.current =
            false;


          setLoading(
            false
          );
        }
      },


      // ===============================================
      // NO
      // ===============================================

      null
    );
  };


  // ====================================================
  // OMITIR / CONFIRMAR COSTO ACTUAL
  // ====================================================
  //
  // IMPORTANTE:
  //
  // El frontend NO envía costoVigente.
  //
  // Solo informa:
  //
  // "quiero utilizar el costo vigente".
  //
  // El backend:
  //
  // 1. obtiene el usuario autenticado;
  // 2. busca su EN_PROCESO;
  // 3. obtiene el contenedor;
  // 4. busca el costo vigente en BD;
  // 5. lo congela en ese proceso.
  // ====================================================

  const handleOmitir = () => {

    if (
      loading ||
      operacionEnCursoRef.current
    ) {
      return;
    }


    if (sinCostoVigente) {

      setError(
        "No hay costo vigente. Debe ingresar uno para continuar."
      );

      return;
    }


    setError("");


    showConfirmAlert(

      "¿Desea continuar con el costo actual?",

      "Se utilizará el costo vigente registrado en el sistema.",


      // ===============================================
      // SÍ
      // ===============================================

      async () => {

        if (
          operacionEnCursoRef.current
        ) {
          return;
        }


        operacionEnCursoRef.current =
          true;


        setLoading(
          true
        );


        try {

          /*
           * CUERPO VACÍO.
           *
           * No mandamos:
           *
           * costo_por_libra
           * contenedor_id
           * historial_calculo_id
           * tipo de residuo
           *
           * El backend obtiene todo.
           */
          await apiClient.post(
            "/control-dsh/registro-pesaje/costo-global/confirmar",

            {}
          );


          /*
           * Foto 2 terminó correctamente.
           *
           * Ya puede pasar a Foto 3.
           */
          handleOpenTotales?.();


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
                  "No fue posible confirmar el costo vigente.",
              },
          });


        } finally {

          operacionEnCursoRef.current =
            false;


          setLoading(
            false
          );
        }
      },


      // ===============================================
      // NO
      // ===============================================
      //
      // El usuario permanece en Foto 2.
      // ===============================================

      null
    );
  };


  // ====================================================
  // CERRAR MODAL
  // ====================================================

  const handleCerrar = () => {

    /*
     * No permitimos cerrar mientras existe
     * una operación HTTP activa.
     */
    if (
      loading ||
      operacionEnCursoRef.current
    ) {
      return;
    }


    handleClose?.();
  };


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <Modal
      show={
        show
      }

      onHide={
        handleCerrar
      }

      backdrop={
        loading
          ? "static"
          : true
      }

      keyboard={
        !loading
      }

      centered
    >

      <Modal.Header
        className="modal-costo-header"
      >

        <Modal.Title>
          Costo por libra (Global)
        </Modal.Title>

      </Modal.Header>


      <Modal.Body>


        {/* ============================================= */}
        {/* SIN COSTO VIGENTE                            */}
        {/* ============================================= */}

        {sinCostoVigente && (

          <Alert
            variant="warning"
          >

            No hay costo global vigente.{" "}

            <strong>
              Debe registrar un costo
              para continuar.
            </strong>

          </Alert>
        )}


        {/* ============================================= */}
        {/* ERROR DE VALIDACIÓN                          */}
        {/* ============================================= */}

        {error && (

          <Alert
            variant="danger"
          >
            {error}
          </Alert>
        )}


        <Form>

          <Form.Group
            controlId="formCosto"
          >

            <Form.Label>

              {sinCostoVigente
                ? "Ingrese costo inicial"
                : "Costo vigente"}

            </Form.Label>


            <Form.Control
              type="number"

              value={
                costoInput
              }

              disabled={
                !isEditing ||
                loading
              }

              onChange={(event) => {

                setCostoInput(
                  event.target.value
                );


                if (error) {

                  setError(
                    ""
                  );
                }
              }}

              className={
                error
                  ? "is-invalid"
                  : ""
              }

              min="0"

              step="0.0001"

              inputMode="decimal"

              autoComplete="off"
            />

          </Form.Group>

        </Form>


        {/* ============================================= */}
        {/* PROCESANDO                                   */}
        {/* ============================================= */}

        {loading && (

          <div
            className="
              d-flex
              align-items-center
              mt-3
              text-muted
            "
          >

            <Spinner
              animation="border"
              size="sm"
              className="me-2"
            />

            Procesando solicitud...

          </div>
        )}

      </Modal.Body>


      <Modal.Footer>


        {/* ============================================= */}
        {/* EDITAR / GUARDAR                             */}
        {/* ============================================= */}

        <Button
          variant={
            isEditing
              ? "success"
              : "primary"
          }

          onClick={
            handleEditSave
          }

          disabled={
            loading
          }
        >

          {loading
            ? "Procesando..."
            : isEditing
              ? "Guardar"
              : "Editar"}

        </Button>


        {/* ============================================= */}
        {/* OMITIR                                       */}
        {/* ============================================= */}

        <Button
          variant="secondary"

          onClick={
            handleOmitir
          }

          disabled={
            loading ||
            sinCostoVigente ||
            isEditing
          }
        >

          Omitir

        </Button>

      </Modal.Footer>

    </Modal>
  );
};


export default ModalCosto;