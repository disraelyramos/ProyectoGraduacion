
import React, {
  useEffect,
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
// CONFIGURACIÓN
// ======================================================

const leerMilisegundos = (valor, predeterminado) => {
  const numero = Number(valor);

  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : predeterminado;
};

const INTERVALO_CONSULTA_MS = leerMilisegundos(
  import.meta.env.VITE_MEDICION_PESO_POLL_MS,
  700
);

const TIMEOUT_CALCULO_MS = leerMilisegundos(
  import.meta.env.VITE_MEDICION_PESO_TIMEOUT_MS,
  135000
);



const DEMO_PESO_HISTORICO = true;

// ======================================================
// ENDPOINTS
// ======================================================

const URL_BASE =
  "/control-dsh/registro-pesaje";

const URL_CALCULO =
  `${URL_BASE}/calculo`;

const URL_PROCESO_ACTIVO =
  `${URL_BASE}/proceso-activo`;

// ======================================================
// ESTADOS
// ======================================================

const ESTADO_UI = Object.freeze({
  ESPERANDO: "ESPERANDO",
  PROCESANDO: "PROCESANDO",
  RESULTADO: "RESULTADO",
  HISTORICO: "HISTORICO",
});

const ESTADO_MEDICION = Object.freeze({
  OBTENIENDO_LECTURA: "OBTENIENDO_LECTURA",
  PENDIENTE: "PENDIENTE",
  MIDIENDO: "MIDIENDO",
  ESTABILIZANDO: "ESTABILIZANDO",
  MOVIMIENTO_DETECTADO: "MOVIMIENTO_DETECTADO",
  COMPLETADO: "COMPLETADO",
  ERROR: "ERROR",
  TIMEOUT: "TIMEOUT",
  CANCELADO: "CANCELADO",
});

const ESTADOS_VALIDOS = new Set(
  Object.values(ESTADO_MEDICION)
);

// ======================================================
// FUNCIONES AUXILIARES
// ======================================================

const obtenerNumero = (valor) => {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return 0;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : 0;
};

const obtenerTipoResiduo = (resultado) => {
  const tipoId = Number(
    resultado?.contenedor?.id_tipo_residuo ??
    resultado?.id_tipo_residuo
  );

  const tipos = {
    1: "Bioinfeccioso",
    2: "Punzocortante",
  };

  return tipos[tipoId] || "";
};

const normalizarEstado = (estado) => {
  const valor = String(estado || "")
    .trim()
    .toUpperCase();

  return ESTADOS_VALIDOS.has(valor)
    ? valor
    : null;
};

const respuestaCalculoValida = (data) => {
  if (
    !data ||
    typeof data !== "object" ||
    data.estado_medicion !==
      ESTADO_MEDICION.COMPLETADO
  ) {
    return false;
  }

  const peso = Number(data.total_en_libras);
  const costo = Number(data.total_costo_q);

  return (
    data.total_en_libras !== null &&
    data.total_en_libras !== undefined &&
    data.total_costo_q !== null &&
    data.total_costo_q !== undefined &&
    Number.isFinite(peso) &&
    peso >= 0 &&
    Number.isFinite(costo) &&
    costo >= 0
  );
};

// Se muestra la fecha enviada por el backend.
// Si la BD usa timestamp sin zona horaria,
// se debe verificar su interpretación.

const formatearFecha = (valor) => {
  if (!valor) {
    return "No disponible";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return String(valor);
  }

  return fecha.toLocaleString("es-GT", {
    dateStyle: "short",
    timeStyle: "medium",
    timeZone: "America/Guatemala",
  });
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
  // ESTADOS VISUALES
  // ====================================================

  const [
    estadoUI,
    setEstadoUI,
  ] = useState(ESTADO_UI.ESPERANDO);

  const [
    resultadoVisual,
    setResultadoVisual,
  ] = useState(null);

  const [
    resultadoHistorico,
    setResultadoHistorico,
  ] = useState(null);

  const [
    estadoMedicion,
    setEstadoMedicion,
  ] = useState(null);

  const [
    mensajeMedicion,
    setMensajeMedicion,
  ] = useState("");

  // ====================================================
  // REFERENCIAS
  // ====================================================

  const solicitudEnCursoRef = useRef(false);

  const pollingActivoRef = useRef(false);

  const pollingTimerRef = useRef(null);

  const generacionPollingRef = useRef(0);

  const generacionCalculoRef = useRef(0);

  // ====================================================
  // DETENER CONSULTAS AUTOMÁTICAS
  // ====================================================

  const detenerPolling = () => {
    pollingActivoRef.current = false;

    generacionPollingRef.current += 1;

    if (pollingTimerRef.current !== null) {
      clearTimeout(pollingTimerRef.current);
      pollingTimerRef.current = null;
    }
  };

  // ====================================================
  // LIMPIEZA AL DESMONTAR
  // ====================================================

  useEffect(() => {
    return () => {
      pollingActivoRef.current = false;

      generacionPollingRef.current += 1;
      generacionCalculoRef.current += 1;

      if (pollingTimerRef.current !== null) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  // ====================================================
  // REINICIAR AL ABRIR
  // ====================================================

  useEffect(() => {
    if (!show) {
      generacionCalculoRef.current += 1;
      detenerPolling();
      return;
    }

    detenerPolling();

    solicitudEnCursoRef.current = false;

    generacionCalculoRef.current += 1;

    setEstadoUI(ESTADO_UI.ESPERANDO);

    setResultadoVisual(null);
    setResultadoHistorico(null);

    setEstadoMedicion(null);
    setMensajeMedicion("");

  }, [show]);

  // ====================================================
  // ESTADOS DERIVADOS
  // ====================================================

  const calculando =
    estadoUI === ESTADO_UI.PROCESANDO;

  const hayResultado =
    estadoUI === ESTADO_UI.RESULTADO &&
    resultadoVisual !== null;

  const hayHistorico =
    estadoUI === ESTADO_UI.HISTORICO &&
    resultadoHistorico !== null;

  const movimientoDetectado =
    estadoMedicion ===
    ESTADO_MEDICION.MOVIMIENTO_DETECTADO;

  const estabilizando =
    estadoMedicion ===
    ESTADO_MEDICION.ESTABILIZANDO;

  // ====================================================
  // ACTUALIZAR ESTADO DESDE BACKEND
  // ====================================================

  const aplicarEstadoBackend = (data) => {
    if (
      !data ||
      typeof data !== "object"
    ) {
      return;
    }

    const estado = normalizarEstado(
      data.estado_medicion
    );

    if (!estado) {
      return;
    }

    setEstadoMedicion(estado);

    setMensajeMedicion(
      typeof data.mensaje === "string"
        ? data.mensaje
        : ""
    );
  };

  // ====================================================
  // CONSULTAR ESTADO DE MEDICIÓN FÍSICA
  // ====================================================

  const consultarEstadoMedicion = async (
    generacion
  ) => {
    try {
      const res = await apiClient.get(
        `${URL_CALCULO}/estado`,
        {
          timeout: 5000,
        }
      );

      if (
        !pollingActivoRef.current ||
        generacion !==
          generacionPollingRef.current
      ) {
        return;
      }

      aplicarEstadoBackend(res?.data);

    } catch (error) {
      // El POST /calculo controla errores finales.
    }
  };

  // ====================================================
  // INICIAR POLLING FÍSICO
  // ====================================================

  const iniciarPolling = () => {
    detenerPolling();

    pollingActivoRef.current = true;

    const generacion =
      generacionPollingRef.current;

    const ejecutar = async () => {
      if (
        !pollingActivoRef.current ||
        generacion !==
          generacionPollingRef.current
      ) {
        return;
      }

      await consultarEstadoMedicion(generacion);

      if (
        !pollingActivoRef.current ||
        generacion !==
          generacionPollingRef.current
      ) {
        return;
      }

      pollingTimerRef.current = setTimeout(
        ejecutar,
        INTERVALO_CONSULTA_MS
      );
    };

    ejecutar();
  };

  // ====================================================
  // CONSULTAR ÚLTIMO PESO HISTÓRICO
  // ====================================================
  //
  // Solo se utiliza cuando:
  // VITE_DEMO_PESO_HISTORICO=true
  //
  // No ejecuta POST /calculo.
  // No crea una solicitud de pesaje.
  // No guarda costos.
  // No permite continuar a recolección.
  // ====================================================

  const consultarPesoHistorico = async (
    generacion
  ) => {
    const procesoRes = await apiClient.get(
      URL_PROCESO_ACTIVO,
      {
        timeout: 10000,
      }
    );

    const procesoData = procesoRes?.data;

    if (
      procesoData?.tiene_proceso_activo !== true ||
      !procesoData?.proceso
    ) {
      throw new Error(
        "NO_EXISTE_PROCESO_ACTIVO"
      );
    }

    const proceso = procesoData.proceso;

    const contenedorId = Number(
      proceso.contenedor_id
    );

    if (
      !Number.isSafeInteger(contenedorId) ||
      contenedorId <= 0
    ) {
      throw new Error(
        "CONTENEDOR_INVALIDO"
      );
    }

    const historicoRes = await apiClient.get(
      `${URL_BASE}/ultimo-peso/${contenedorId}`,
      {
        timeout: 10000,
      }
    );

    if (
      generacion !==
      generacionCalculoRef.current
    ) {
      return;
    }

    const historico = historicoRes?.data;

    if (
      historico?.disponible !== true ||
      historico?.origen !== "historial" ||
      historico?.lectura_historica !== true
    ) {
      throw new Error(
        "SIN_PESO_HISTORICO"
      );
    }

    const peso = Number(historico.peso_lb);

    if (
      !Number.isFinite(peso) ||
      peso < 0
    ) {
      throw new Error(
        "PESO_HISTORICO_INVALIDO"
      );
    }

    setResultadoHistorico({
      ...historico,
      peso_lb: peso,
      id_tipo_residuo:
        proceso.id_tipo_residuo,
      contenedor_id: contenedorId,
    });

    setEstadoUI(ESTADO_UI.HISTORICO);
  };

  // ====================================================
  // MOSTRAR ERRORES
  // ====================================================

  const mostrarErrorCalculo = async (error) => {
    const erroresLocales = {
      NO_EXISTE_PROCESO_ACTIVO:
        "No existe un proceso activo para consultar el peso.",

      CONTENEDOR_INVALIDO:
        "No fue posible identificar el contenedor.",

      SIN_PESO_HISTORICO:
        "El contenedor no tiene lecturas históricas de peso.",

      PESO_HISTORICO_INVALIDO:
        "El peso almacenado no es válido.",

      RESPUESTA_INVALIDA:
        "El servidor devolvió una respuesta de cálculo inválida.",
    };

    if (erroresLocales[error?.message]) {
      await showBackendAlert({
        status: 400,
        data: {
          message:
            erroresLocales[error.message],
        },
      });

      return;
    }

    const esTimeout =
      error?.code === "ECONNABORTED" ||
      error?.code === "ETIMEDOUT";

    if (esTimeout) {
      await showBackendAlert({
        status: 504,
        data: {
          message:
            "No se recibió una respuesta del servidor dentro del tiempo esperado.",
        },
      });

      return;
    }

    await showBackendAlert({
      status: error?.response?.status || 500,
      data: error?.response?.data || {
        message:
          "No fue posible obtener la medición de peso.",
      },
    });
  };

  // ====================================================
  // CALCULAR PESO
  // ====================================================
  //
  // DEMO:
  //   GET del último peso almacenado.
  //
  // NORMAL:
  //   POST /calculo y espera del HX711.
  // ====================================================

  const handleCalcular = async () => {
    if (solicitudEnCursoRef.current) {
      return;
    }

    solicitudEnCursoRef.current = true;

    const generacion =
      ++generacionCalculoRef.current;

    setResultadoVisual(null);
    setResultadoHistorico(null);

    setEstadoMedicion(
      ESTADO_MEDICION.OBTENIENDO_LECTURA
    );

    setMensajeMedicion(
      DEMO_PESO_HISTORICO
        ? "Consultando último peso registrado..."
        : "Preparando medición de peso..."
    );

    setEstadoUI(ESTADO_UI.PROCESANDO);

    try {
      // ================================================
      // MODO DEMOSTRACIÓN
      // ================================================

      if (DEMO_PESO_HISTORICO) {
        await consultarPesoHistorico(
          generacion
        );

        return;
      }

      // ================================================
      // MODO NORMAL - MÓDULO HX711
      // ================================================

      iniciarPolling();

      const res = await apiClient.post(
        URL_CALCULO,
        {},
        {
          timeout: TIMEOUT_CALCULO_MS,
        }
      );

      if (
        generacion !==
        generacionCalculoRef.current
      ) {
        return;
      }

      detenerPolling();

      const data = res?.data;

      if (!respuestaCalculoValida(data)) {
        throw new Error(
          "RESPUESTA_INVALIDA"
        );
      }

      aplicarEstadoBackend(data);

      setResultadoVisual(data);

      setEstadoUI(ESTADO_UI.RESULTADO);

    } catch (error) {
      if (
        generacion !==
        generacionCalculoRef.current
      ) {
        return;
      }

      detenerPolling();

      setResultadoVisual(null);
      setResultadoHistorico(null);

      setEstadoUI(ESTADO_UI.ESPERANDO);

      await mostrarErrorCalculo(error);

    } finally {
      if (
        generacion ===
        generacionCalculoRef.current
      ) {
        detenerPolling();
        solicitudEnCursoRef.current = false;
      }
    }
  };

  // ====================================================
  // CONTINUAR A RECOLECCIÓN
  // ====================================================

  const handleContinuar = () => {
    // Nunca permite continuar usando
    // una consulta histórica.

    if (
      !hayResultado ||
      calculando ||
      solicitudEnCursoRef.current ||
      DEMO_PESO_HISTORICO
    ) {
      return;
    }

    handleShowRecoleccion?.();
  };

  // ====================================================
  // CANCELAR PROCESO
  // ====================================================

  const handleCancelar = () => {
    if (solicitudEnCursoRef.current) {
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
  // VOLVER A LA PANTALLA DE CÁLCULO
  // ====================================================

  const handleVolver = () => {
    if (solicitudEnCursoRef.current) {
      return;
    }

    setResultadoHistorico(null);
    setResultadoVisual(null);

    setEstadoUI(ESTADO_UI.ESPERANDO);
  };

  // ====================================================
  // DATOS DEL RESULTADO REAL
  // ====================================================

  const totalLb = obtenerNumero(
    resultadoVisual?.total_en_libras
  );

  const porcentajeLlenado = obtenerNumero(
    resultadoVisual?.porcentaje_llenado
  );

  const costoAplicado = obtenerNumero(
    resultadoVisual?.costo_por_libra_aplicado
  );

  const totalCosto = obtenerNumero(
    resultadoVisual?.total_costo_q
  );

  const tipoTexto = obtenerTipoResiduo(
    resultadoVisual
  );

  // ====================================================
  // DATOS HISTÓRICOS
  // ====================================================

  const pesoHistorico = obtenerNumero(
    resultadoHistorico?.peso_lb
  );

  const tipoHistorico = obtenerTipoResiduo(
    resultadoHistorico
  );

  const fechaHistorica = formatearFecha(
    resultadoHistorico?.fecha_hora
  );

  // ====================================================
  // MENSAJES DEL MÓDULO
  // ====================================================

  const obtenerMensajePrincipal = () => {
    if (DEMO_PESO_HISTORICO) {
      return "CONSULTANDO PESO REGISTRADO";
    }

    if (movimientoDetectado) {
      return "MOVIMIENTO DETECTADO";
    }

    if (estabilizando) {
      return (
        "NO MUEVA EL CONTENEDOR MIENTRAS SE CALCULA EL PESO"
      );
    }

    if (
      estadoMedicion ===
      ESTADO_MEDICION.MIDIENDO
    ) {
      return "CALCULANDO PESO";
    }

    if (
      estadoMedicion ===
      ESTADO_MEDICION.PENDIENTE
    ) {
      return "ESPERANDO MÓDULO DE PESO";
    }

    return (
      mensajeMedicion ||
      "Consultando estado de medición..."
    );
  };

  const obtenerMensajeSecundario = () => {
    if (DEMO_PESO_HISTORICO) {
      return "Recuperando la última lectura almacenada.";
    }

    if (
      movimientoDetectado ||
      estabilizando
    ) {
      return (
        mensajeMedicion ||
        "Mantenga el contenedor inmóvil."
      );
    }

    return mensajeMedicion || "";
  };

  const mensajeSecundario =
    obtenerMensajeSecundario();

  const varianteProceso =
    movimientoDetectado &&
    !DEMO_PESO_HISTORICO
      ? "warning"
      : "info";

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <Modal
      show={show}
      onHide={
        calculando
          ? undefined
          : handleClose
      }
      backdrop={
        calculando ? "static" : true
      }
      keyboard={!calculando}
      centered
      size="lg"
    >

      {/* ================================================
          ENCABEZADO
      ================================================ */}

      <Modal.Header
        className="modal-costo-header"
      >
        <Modal.Title>
          Total en libras y Costos
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>

        {/* ==============================================
            PANTALLA INICIAL
        ============================================== */}

        {estadoUI ===
          ESTADO_UI.ESPERANDO && (
          <Alert variant="info">
            {DEMO_PESO_HISTORICO ? (
              <>
                Presione{" "}
                <strong>
                  Calcular peso
                </strong>{" "}
                para consultar el último peso
                registrado durante la demostración.
              </>
            ) : (
              <>
                Presione{" "}
                <strong>
                  Calcular peso
                </strong>{" "}
                para iniciar la medición
                del contenedor.
              </>
            )}
          </Alert>
        )}

        {/* ==============================================
            PROCESANDO
        ============================================== */}

        {calculando && (
          <div className="py-4">

            <Alert
              variant={varianteProceso}
              className="text-center mb-4"
            >

              <Spinner
                animation="border"
                role="status"
                className="mb-3"
                variant={
                  movimientoDetectado &&
                  !DEMO_PESO_HISTORICO
                    ? "warning"
                    : undefined
                }
              >
                <span className="visually-hidden">
                  Procesando medición
                </span>
              </Spinner>

              <h5 className="mb-3">
                <strong>
                  {obtenerMensajePrincipal()}
                </strong>
              </h5>

              {mensajeSecundario && (
                <p className="mb-0">
                  {mensajeSecundario}
                </p>
              )}

            </Alert>

            <ProgressBar
              animated
              striped
              now={100}
              variant={
                movimientoDetectado &&
                !DEMO_PESO_HISTORICO
                  ? "warning"
                  : undefined
              }
            />

          </div>
        )}

        {/* ==============================================
            RESULTADO HISTÓRICO
        ============================================== */}

        {hayHistorico && (
          <>
            <Alert variant="warning">
              <strong>
                LECTURA HISTÓRICA — DEMOSTRACIÓN
              </strong>

              <p className="mb-0 mt-2">
                El peso se recuperó de PostgreSQL.
                No es una medición en tiempo real
                del módulo HX711.
              </p>
            </Alert>

            <Form>
              <Row>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      Total en libras
                    </Form.Label>

                    <Form.Control
                      type="text"
                      value={`${pesoHistorico.toFixed(2)} lb`}
                      disabled
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>
                      Tipo de residuo
                    </Form.Label>

                    <Form.Control
                      type="text"
                      value={tipoHistorico}
                      disabled
                    />
                  </Form.Group>
                </Col>

                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      Fecha de la lectura
                    </Form.Label>

                    <Form.Control
                      type="text"
                      value={fechaHistorica}
                      disabled
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>
                      Estado del peso
                    </Form.Label>

                    <Form.Control
                      type="text"
                      value="Histórico / No vigente"
                      disabled
                    />
                  </Form.Group>
                </Col>

              </Row>
            </Form>

            <Alert
              variant="secondary"
              className="mb-0"
            >
              Esta consulta no guarda costos
              ni registra una nueva recolección.
            </Alert>
          </>
        )}

        {/* ==============================================
            RESULTADO DEL PESAJE REAL
        ============================================== */}

        {hayResultado && (
          <Form>
            <Row>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Total en libras
                  </Form.Label>

                  <Form.Control
                    type="text"
                    value={`${totalLb.toFixed(2)} lb`}
                    disabled
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    % de llenado
                  </Form.Label>

                  <Form.Control
                    type="text"
                    value={`${porcentajeLlenado.toFixed(2)} %`}
                    disabled
                  />
                </Form.Group>
              </Col>

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Tipo de residuo
                  </Form.Label>

                  <Form.Control
                    type="text"
                    value={tipoTexto}
                    disabled
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    Costo aplicado (Q/LB)
                  </Form.Label>

                  <Form.Control
                    type="text"
                    value={costoAplicado.toFixed(4)}
                    disabled
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    Total de costos (Q)
                  </Form.Label>

                  <Form.Control
                    type="text"
                    value={totalCosto.toFixed(2)}
                    disabled
                  />
                </Form.Group>
              </Col>

            </Row>
          </Form>
        )}

      </Modal.Body>

      {/* ================================================
          BOTONES
      ================================================ */}

      <Modal.Footer>

        {/* SOLO UN BOTÓN PARA CALCULAR */}

        {estadoUI ===
          ESTADO_UI.ESPERANDO && (
          <Button
            variant="success"
            onClick={handleCalcular}
          >
            Calcular peso
          </Button>
        )}

        {/* PROCESANDO */}

        {calculando && (
          <Button
            variant="success"
            disabled
          >
            <Spinner
              animation="border"
              size="sm"
              className="me-2"
            />

            Procesando...
          </Button>
        )}

        {/* RESULTADO REAL */}

        {hayResultado && (
          <Button
            variant="success"
            onClick={handleContinuar}
          >
            Continuar
          </Button>
        )}

        {/* CONSULTA HISTÓRICA */}

        {hayHistorico && (
          <Button
            variant="outline-secondary"
            onClick={handleVolver}
          >
            Volver
          </Button>
        )}

        {/* CANCELAR */}

        <Button
          variant="secondary"
          onClick={handleCancelar}
          disabled={calculando}
        >
          Cancelar
        </Button>

      </Modal.Footer>

    </Modal>
  );
};

export default ModalTotales;
