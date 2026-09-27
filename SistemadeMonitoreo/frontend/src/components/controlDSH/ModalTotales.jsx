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
// ESTADOS DEL MODULO
// ======================================================

const ESTADO_MEDICION = {

  OBTENIENDO_LECTURA:
    "OBTENIENDO_LECTURA",

  PENDIENTE:
    "PENDIENTE",

  MIDIENDO:
    "MIDIENDO",

  ESTABILIZANDO:
    "ESTABILIZANDO",

  MOVIMIENTO_DETECTADO:
    "MOVIMIENTO_DETECTADO",

  COMPLETADO:
    "COMPLETADO",

  ERROR:
    "ERROR",

  TIMEOUT:
    "TIMEOUT",
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
  // ESTADO ACTUAL DEL MODULO
  // ====================================================

  const [
    estadoMedicion,
    setEstadoMedicion,
  ] = useState(
    ESTADO_MEDICION
      .OBTENIENDO_LECTURA
  );


  const [
    mensajeMedicion,
    setMensajeMedicion,
  ] = useState(
    "Preparando medición de peso..."
  );


  // ====================================================
  // PROTECCIÓN CONTRA DOBLE SOLICITUD
  // ====================================================

  const solicitudEnCursoRef =
    useRef(false);


  // ====================================================
  // CONTROL DEL POLLING
  // ====================================================

  const pollingActivoRef =
    useRef(false);


  const pollingTimerRef =
    useRef(null);


  /*
   * Conserva el último estado conocido.
   *
   * Esto también permite distinguir un TIMEOUT
   * reportado por el backend de otros errores.
   */
  const ultimoEstadoRef =
    useRef(null);


  // ====================================================
  // DETENER POLLING
  // ====================================================

  const detenerPolling = () => {

    pollingActivoRef.current =
      false;


    if (
      pollingTimerRef.current
    ) {

      clearTimeout(
        pollingTimerRef.current
      );


      pollingTimerRef.current =
        null;
    }
  };


  // ====================================================
  // LIMPIEZA AL DESMONTAR
  // ====================================================

  useEffect(() => {

    return () => {

      pollingActivoRef.current =
        false;


      if (
        pollingTimerRef.current
      ) {

        clearTimeout(
          pollingTimerRef.current
        );
      }
    };

  }, []);


  // ====================================================
  // REINICIAR MODAL AL ABRIR
  // ====================================================

  useEffect(() => {

    if (!show) {
      return;
    }


    detenerPolling();


    solicitudEnCursoRef.current =
      false;


    ultimoEstadoRef.current =
      null;


    setEstadoUI(
      ESTADO_UI.ESPERANDO
    );


    setResultadoVisual(
      null
    );


    setEstadoMedicion(
      ESTADO_MEDICION
        .OBTENIENDO_LECTURA
    );


    setMensajeMedicion(
      "Preparando medición de peso..."
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


  const movimientoDetectado =
    estadoMedicion ===
    ESTADO_MEDICION
      .MOVIMIENTO_DETECTADO;


  // ====================================================
  // TEXTO PRINCIPAL DEL ESTADO
  // ====================================================

  const tituloEstado =
    useMemo(() => {

      switch (
        estadoMedicion
      ) {

        case ESTADO_MEDICION
          .PENDIENTE:

          return (
            "Esperando módulo de pesaje..."
          );


        case ESTADO_MEDICION
          .MIDIENDO:

          return (
            "Calculando peso..."
          );


        case ESTADO_MEDICION
          .ESTABILIZANDO:

          return (
            "Estabilizando contenedor..."
          );


        case ESTADO_MEDICION
          .MOVIMIENTO_DETECTADO:

          return (
            "Movimiento detectado"
          );


        case ESTADO_MEDICION
          .COMPLETADO:

          return (
            "Peso obtenido correctamente"
          );


        case ESTADO_MEDICION
          .TIMEOUT:

          return (
            "Tiempo de espera agotado"
          );


        case ESTADO_MEDICION
          .ERROR:

          return (
            "Error durante la medición"
          );


        case ESTADO_MEDICION
          .OBTENIENDO_LECTURA:

        default:

          return (
            "Preparando medición de peso..."
          );
      }

    }, [
      estadoMedicion,
    ]);


  // ====================================================
  // MENSAJE SECUNDARIO
  // ====================================================

  const detalleEstado =
    useMemo(() => {

      if (
        mensajeMedicion
      ) {

        return mensajeMedicion;
      }


      switch (
        estadoMedicion
      ) {

        case ESTADO_MEDICION
          .ESTABILIZANDO:

          return (
            "Mantenga el contenedor completamente quieto."
          );


        case ESTADO_MEDICION
          .MOVIMIENTO_DETECTADO:

          return (
            "Mantenga el contenedor completamente quieto. La estabilización se reiniciará automáticamente."
          );


        case ESTADO_MEDICION
          .MIDIENDO:

          return (
            "El sistema está obteniendo la medición de peso."
          );


        default:

          return (
            "Espere mientras el sistema obtiene una medición válida."
          );
      }

    }, [
      estadoMedicion,
      mensajeMedicion,
    ]);


  // ====================================================
  // CONSULTAR ESTADO ACTUAL DEL BACKEND
  // ====================================================

  const consultarEstadoMedicion =
    async () => {

      try {

        const res =
          await apiClient.get(

            "/control-dsh/registro-pesaje/calculo/estado",

            {
              timeout:
                5000,
            }
          );


        const data =
          res?.data;


        if (
          !data ||
          typeof data !==
            "object"
        ) {

          return;
        }


        const estado =
          String(
            data
              ?.estado_medicion ||
            ""
          )
            .trim()
            .toUpperCase();


        if (!estado) {
          return;
        }


        ultimoEstadoRef.current =
          estado;


        // ===============================================
        // ACTUALIZAR ESTADO VISUAL
        // ===============================================

        switch (
          estado
        ) {

          case ESTADO_MEDICION
            .OBTENIENDO_LECTURA:

          case ESTADO_MEDICION
            .PENDIENTE:

          case ESTADO_MEDICION
            .MIDIENDO:

          case ESTADO_MEDICION
            .ESTABILIZANDO:

          case ESTADO_MEDICION
            .MOVIMIENTO_DETECTADO:

          case ESTADO_MEDICION
            .COMPLETADO:

          case ESTADO_MEDICION
            .ERROR:

          case ESTADO_MEDICION
            .TIMEOUT:

            setEstadoMedicion(
              estado
            );


            setMensajeMedicion(
              data
                ?.mensaje ||
              ""
            );

            break;


          default:

            break;
        }


      } catch (
        error
      ) {

        /*
         * El polling es informativo.
         *
         * No mostramos alertas aquí porque
         * la petición principal /calculo
         * es quien controla el resultado
         * final y los errores.
         */
      }
    };


  // ====================================================
  // INICIAR POLLING
  // ====================================================

  const iniciarPolling =
    () => {

      detenerPolling();


      pollingActivoRef.current =
        true;


      const ejecutar =
        async () => {

          if (
            !pollingActivoRef.current
          ) {

            return;
          }


          await consultarEstadoMedicion();


          if (
            !pollingActivoRef.current
          ) {

            return;
          }


          pollingTimerRef.current =
            setTimeout(
              ejecutar,
              700
            );
        };


      /*
       * Primera consulta inmediatamente.
       */
      ejecutar();
    };


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


      ultimoEstadoRef.current =
        null;


      setResultadoVisual(
        null
      );


      setEstadoMedicion(
        ESTADO_MEDICION
          .OBTENIENDO_LECTURA
      );


      setMensajeMedicion(
        "Preparando medición de peso..."
      );


      setEstadoUI(
        ESTADO_UI.PROCESANDO
      );


      // =================================================
      // EMPEZAR A CONSULTAR ESTADOS
      // =================================================

      iniciarPolling();


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
              /*
               * El timeout principal del backend
               * debe decidir cuándo finaliza la
               * medición.
               *
               * 130 segundos permite que el backend
               * con timeout de 120 segundos responda
               * primero.
               */
              timeout:
                130000,
            }
          );


        // ===============================================
        // DETENER POLLING
        // ===============================================

        detenerPolling();


        // ===============================================
        // VALIDAR RESPUESTA
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
        // MOSTRAR COMPLETADO
        // ===============================================

        setEstadoMedicion(
          ESTADO_MEDICION
            .COMPLETADO
        );


        setMensajeMedicion(
          "Peso obtenido correctamente."
        );


        // ===============================================
        // GUARDAR RESULTADO VISUAL
        // ===============================================

        setResultadoVisual(
          data
        );


        setEstadoUI(
          ESTADO_UI.RESULTADO
        );


      } catch (err) {

        detenerPolling();


        const ultimoEstado =
          ultimoEstadoRef.current;


        // ===============================================
        // TIMEOUT DEL MODULO REPORTADO POR BACKEND
        // ===============================================

        if (
          ultimoEstado ===
          ESTADO_MEDICION.TIMEOUT
        ) {

          setEstadoUI(
            ESTADO_UI.ESPERANDO
          );


          setEstadoMedicion(
            ESTADO_MEDICION
              .OBTENIENDO_LECTURA
          );


          setMensajeMedicion(
            "Preparando medición de peso..."
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
        // TIMEOUT DE AXIOS
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


          setEstadoMedicion(
            ESTADO_MEDICION
              .OBTENIENDO_LECTURA
          );


          setMensajeMedicion(
            "Preparando medición de peso..."
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


        setEstadoMedicion(
          ESTADO_MEDICION
            .OBTENIENDO_LECTURA
        );


        setMensajeMedicion(
          "Preparando medición de peso..."
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

        detenerPolling();


        solicitudEnCursoRef.current =
          false;
      }
    };


  // ====================================================
  // CONTINUAR A FOTO 4
  // ====================================================

  const handleContinuar = () => {

    if (
      !hayResultado ||
      calculando ||
      solicitudEnCursoRef.current
    ) {

      return;
    }


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

            {/* ======================================= */}
            {/* MOVIMIENTO DETECTADO                   */}
            {/* ======================================= */}

            {movimientoDetectado ? (

              <Alert
                variant="warning"
                className="
                  text-start
                  mb-4
                "
              >

                <Alert.Heading>

                  ⚠ Movimiento detectado

                </Alert.Heading>


                <div>

                  {detalleEstado}

                </div>


                <div
                  className="
                    mt-2
                    fw-semibold
                  "
                >

                  La medición se reanudará
                  automáticamente cuando el
                  contenedor permanezca quieto.

                </div>

              </Alert>

            ) : (

              <>

                <Spinner
                  animation="border"
                  role="status"
                  className="mb-3"
                >

                  <span
                    className="visually-hidden"
                  >

                    {tituloEstado}

                  </span>

                </Spinner>


                <h6
                  className="mb-3"
                >

                  {tituloEstado}

                </h6>

              </>
            )}


            <ProgressBar
              animated
              striped
              now={100}

              variant={
                movimientoDetectado
                  ? "warning"
                  : undefined
              }
            />


            {!movimientoDetectado && (

              <small
                className="
                  text-muted
                  d-block
                  mt-3
                "
              >

                {detalleEstado}

              </small>
            )}

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