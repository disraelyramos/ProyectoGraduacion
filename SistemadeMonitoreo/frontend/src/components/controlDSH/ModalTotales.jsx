import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Modal,
  Button,
  Form,
  Row,
  Col,
  Spinner,
  ProgressBar,
  Alert,
} from "react-bootstrap";

import {
  showConfirmAlert,
  showBackendAlert,
} from "../../utils/alerts";

import apiClient from "../../utils/apiClient";

import "../../styles/nuevo-registro.css";


// ======================================================
// ESTADOS VISUALES
// ======================================================

const ESTADO_UI = {
  ESPERANDO: "ESPERANDO",
  PROCESANDO: "PROCESANDO",
  RESULTADO: "RESULTADO",
};


// ======================================================
// COMPONENTE
// ======================================================

const ModalTotales = ({
  show,
  handleClose,
  handleShowRecoleccion,
  onCancel,
}) => {

  // ====================================================
  // ESTADO VISUAL
  // ====================================================

  const [
    estadoUI,
    setEstadoUI,
  ] = useState(
    ESTADO_UI.ESPERANDO
  );


  const [
    resultadoVisual,
    setResultadoVisual,
  ] = useState(null);


  // ====================================================
  // PROTECCIÓN CONTRA DOBLE SOLICITUD
  // ====================================================

  const solicitudEnCursoRef =
    useRef(false);


  // ====================================================
  // REINICIAR MODAL AL ABRIR
  // ====================================================

  useEffect(() => {

    if (!show) {
      return;
    }


    solicitudEnCursoRef.current =
      false;


    setEstadoUI(
      ESTADO_UI.ESPERANDO
    );


    setResultadoVisual(
      null
    );

  }, [show]);


  // ====================================================
  // ESTADOS DERIVADOS
  // ====================================================

  const calculando =
    estadoUI ===
    ESTADO_UI.PROCESANDO;


  const hayResultado =
    estadoUI ===
      ESTADO_UI.RESULTADO &&
    resultadoVisual !== null;


  // ====================================================
  // CANCELAR
  // ====================================================

  const handleCancelar = () => {

    if (
      solicitudEnCursoRef.current
    ) {
      return;
    }


    showConfirmAlert(

      "¿Desea cancelar el proceso?",

      "Si confirma, el proceso actual será cancelado y deberá iniciar uno nuevo.",


      async () => {

        await onCancel?.();

      },


      null
    );
  };


  // ====================================================
  // CALCULAR PESO
  // ====================================================

  const handleCalcular =
    async () => {

      // =================================================
      // EVITAR DOBLE PETICIÓN
      // =================================================

      if (
        solicitudEnCursoRef.current
      ) {
        return;
      }


      solicitudEnCursoRef.current =
        true;


      setResultadoVisual(
        null
      );


      setEstadoUI(
        ESTADO_UI.PROCESANDO
      );


      try {

        // ===============================================
        // FOTO 3
        //
        // Frontend manda cuerpo vacío.
        //
        // Backend obtiene:
        //
        // usuario
        // proceso
        // contenedor
        // tipo
        // costo
        // peso
        // nivel
        // ===============================================

        const res =
          await apiClient.post(

            "/control-dsh/registro-pesaje/calculo",

            {},

            {
              timeout:
                20000,
            }
          );


        // ===============================================
        // VALIDAR RESPUESTA VISUAL
        // ===============================================

        const data =
          res?.data;


        if (
          !data ||
          typeof data !==
            "object"
        ) {

          throw new Error(
            "RESPUESTA_INVALIDA"
          );
        }


        // ===============================================
        // GUARDAR SOLO PARA MOSTRAR
        // ===============================================

        setResultadoVisual(
          data
        );


        setEstadoUI(
          ESTADO_UI.RESULTADO
        );


      } catch (err) {

        // ===============================================
        // TIMEOUT
        // ===============================================

        const esTimeout =
          err?.code ===
            "ECONNABORTED" ||
          err?.code ===
            "ETIMEDOUT";


        if (esTimeout) {

          setEstadoUI(
            ESTADO_UI.ESPERANDO
          );


          await showBackendAlert({

            status:
              504,

            data: {
              message:
                "El sistema de pesaje no respondió dentro del tiempo esperado.",
            },
          });


          return;
        }


        // ===============================================
        // RESPUESTA LOCAL INVÁLIDA
        // ===============================================

        if (
          err?.message ===
          "RESPUESTA_INVALIDA"
        ) {

          setEstadoUI(
            ESTADO_UI.ESPERANDO
          );


          await showBackendAlert({

            status:
              502,

            data: {
              message:
                "El servidor devolvió una respuesta de cálculo inválida.",
            },
          });


          return;
        }


        // ===============================================
        // ERROR DEL BACKEND
        // ===============================================

        setEstadoUI(
          ESTADO_UI.ESPERANDO
        );


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
                "No fue posible realizar la medición de peso.",
            },
        });


      } finally {

        solicitudEnCursoRef.current =
          false;
      }
    };


  // ====================================================
  // CONTINUAR A FOTO 4
  // ====================================================
  //
  // NO:
  //
  // - alerta de éxito
  // - pasar resultadoVisual
  // - pasar peso
  // - pasar costo
  // - pasar IDs
  //
  // Solamente cambiamos de vista.
  //
  // Foto 4 consultará nuevamente al backend.
  // ====================================================

  const handleContinuar = () => {

    if (
      !hayResultado ||
      calculando ||
      solicitudEnCursoRef.current
    ) {
      return;
    }


    /*
     * Foto 3 ya terminó correctamente.
     *
     * El cálculo ya está guardado en BD.
     *
     * Avanzamos DIRECTAMENTE a Foto 4.
     */
    handleShowRecoleccion?.();
  };


  // ====================================================
  // TOTAL LIBRAS
  // ====================================================

  const totalLb =
    useMemo(() => {

      const valor =
        Number(
          resultadoVisual
            ?.total_en_libras
        );


      return Number.isFinite(
        valor
      )
        ? valor
        : 0;

    }, [
      resultadoVisual,
    ]);


  // ====================================================
  // PORCENTAJE LLENADO
  // ====================================================

  const porcentajeLlenado =
    useMemo(() => {

      const valor =
        Number(
          resultadoVisual
            ?.porcentaje_llenado
        );


      return Number.isFinite(
        valor
      )
        ? valor
        : 0;

    }, [
      resultadoVisual,
    ]);


  // ====================================================
  // COSTO APLICADO
  // ====================================================

  const costoAplicado =
    useMemo(() => {

      const valor =
        Number(
          resultadoVisual
            ?.costo_por_libra_aplicado
        );


      return Number.isFinite(
        valor
      )
        ? valor
        : 0;

    }, [
      resultadoVisual,
    ]);


  // ====================================================
  // TOTAL COSTO
  // ====================================================

  const totalCosto =
    useMemo(() => {

      const valor =
        Number(
          resultadoVisual
            ?.total_costo_q
        );


      return Number.isFinite(
        valor
      )
        ? valor
        : 0;

    }, [
      resultadoVisual,
    ]);


  // ====================================================
  // TIPO DE DESECHO
  // ====================================================

  const tipoTexto =
    useMemo(() => {

      const tipoId =
        Number(
          resultadoVisual
            ?.contenedor
            ?.id_tipo_residuo ??
          resultadoVisual
            ?.id_tipo_residuo
        );


      if (
        tipoId === 1
      ) {

        return "Bioinfeccioso";
      }


      if (
        tipoId === 2
      ) {

        return "Punzocortante";
      }


      return "";

    }, [
      resultadoVisual,
    ]);


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <Modal
      show={
        show
      }

      onHide={
        calculando
          ? undefined
          : handleClose
      }

      backdrop={
        calculando
          ? "static"
          : true
      }

      keyboard={
        !calculando
      }

      centered

      size="lg"
    >

      {/* ============================================= */}
      {/* HEADER                                       */}
      {/* ============================================= */}

      <Modal.Header
        className="modal-costo-header"
      >

        <Modal.Title>

          Total en libras y Costos

        </Modal.Title>

      </Modal.Header>


      {/* ============================================= */}
      {/* BODY                                         */}
      {/* ============================================= */}

      <Modal.Body>


        {/* =========================================== */}
        {/* ESPERANDO                                  */}
        {/* =========================================== */}

        {estadoUI ===
          ESTADO_UI.ESPERANDO && (

          <Alert
            variant="info"
          >

            Presione{" "}

            <strong>
              Calcular peso
            </strong>

            {" "}para iniciar la medición
            del contenedor.

          </Alert>
        )}


        {/* =========================================== */}
        {/* PROCESANDO                                 */}
        {/* =========================================== */}

        {calculando && (

          <div
            className="
              text-center
              py-4
            "
          >

            <Spinner
              animation="border"
              role="status"
              className="mb-3"
            >

              <span
                className="visually-hidden"
              >

                Procesando medición...

              </span>

            </Spinner>


            <h6
              className="mb-3"
            >

              Procesando medición de peso...

            </h6>


            <ProgressBar
              animated
              striped
              now={100}
            />


            <small
              className="
                text-muted
                d-block
                mt-3
              "
            >

              Espere mientras el sistema obtiene
              una medición válida.

            </small>

          </div>
        )}


        {/* =========================================== */}
        {/* RESULTADO                                  */}
        {/* =========================================== */}

        {hayResultado && (

          <Form>

            <Row>


              {/* ===================================== */}
              {/* IZQUIERDA                            */}
              {/* ===================================== */}

              <Col md={6}>


                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Total en libras
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      `${totalLb.toFixed(
                        2
                      )} lb`
                    }

                    disabled
                  />

                </Form.Group>


                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    % de llenado
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      `${porcentajeLlenado.toFixed(
                        2
                      )} %`
                    }

                    disabled
                  />

                </Form.Group>

              </Col>


              {/* ===================================== */}
              {/* DERECHA                              */}
              {/* ===================================== */}

              <Col md={6}>


                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Tipo de desecho
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      tipoTexto
                    }

                    disabled
                  />

                </Form.Group>


                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Costo aplicado (Q/LB)
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      costoAplicado
                        .toFixed(4)
                    }

                    disabled
                  />

                </Form.Group>


                <Form.Group
                  className="mb-3"
                >

                  <Form.Label>
                    Total de costos (Q)
                  </Form.Label>


                  <Form.Control
                    type="text"

                    value={
                      totalCosto
                        .toFixed(2)
                    }

                    disabled
                  />

                </Form.Group>

              </Col>

            </Row>

          </Form>
        )}

      </Modal.Body>


      {/* ============================================= */}
      {/* FOOTER                                       */}
      {/* ============================================= */}

      <Modal.Footer>


        {/* =========================================== */}
        {/* CALCULAR PESO                              */}
        {/* =========================================== */}

        {!hayResultado && (

          <Button
            variant="success"

            onClick={
              handleCalcular
            }

            disabled={
              calculando
            }
          >

            {calculando ? (

              <>

                <Spinner
                  animation="border"
                  size="sm"
                  className="me-2"
                />

                Procesando...

              </>

            ) : (

              "Calcular peso"

            )}

          </Button>
        )}


        {/* =========================================== */}
        {/* CONTINUAR A FOTO 4                         */}
        {/* =========================================== */}

        {hayResultado && (

          <Button
            variant="success"

            onClick={
              handleContinuar
            }

            disabled={
              calculando
            }
          >

            Continuar

          </Button>
        )}


        {/* =========================================== */}
        {/* CANCELAR                                   */}
        {/* =========================================== */}

        <Button
          variant="secondary"

          onClick={
            handleCancelar
          }

          disabled={
            calculando
          }
        >

          Cancelar

        </Button>

      </Modal.Footer>

    </Modal>
  );
};


export default ModalTotales;