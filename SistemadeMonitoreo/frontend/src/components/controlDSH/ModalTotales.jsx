
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
// HELPERS
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

  return Number.isFinite(numero) ? numero : 0;
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

const formatearFechaHistorica = (fecha) => {
  if (!fecha) {
    return "Fecha no disponible";
  }

  const fechaObjeto = new Date(fecha);

  if (Number.isNaN(fechaObjeto.getTime())) {
    return String(fecha);
  }

  return fechaObjeto.toLocaleString("es-GT", {
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

  const [estadoUI, setEstadoUI] = useState(
    ESTADO_UI.ESPERANDO
  );

  const [
    resultadoVisual,
    setResultadoVisual,
  ] = useState(null);

  const [
    resultadoHistorico,
    setResultadoHistorico,
  ] = useState(null);

  const [
    consultandoHistorico,
    setConsultandoHistorico,
  ] = useState(false);

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

  const generacionHistoricoRef = useRef(0);

  // ====================================================
  // DETENER POLLING
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
      generacionHistoricoRef.current += 1;

      if (pollingTimerRef.current !== null) {
        clearTimeout(pollingTimerRef.current);
      }
    };
  }, []);

  // ====================================================
  // REINICIAR AL ABRIR O CERRAR
  // ====================================================

  useEffect(() => {
    if (!show) {
      generacionHistoricoRef.current += 1;
      return;
    }

    detenerPolling();

    solicitudEnCursoRef.current = false;

    generacionCalculoRef.current += 1;
    generacionHistoricoRef.current += 1;

    setEstadoUI(ESTADO_UI.ESPERANDO);
    setResultadoVisual(null);
    setResultadoHistorico(null);

    setConsultandoHistorico(false);
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

  const mostrandoHistorico =
    estadoUI === ESTADO_UI.HISTORICO &&
    resultadoHistorico !== null;

  const movimientoDetectado =
    estadoMedicion ===
    ESTADO_MEDICION.MOVIMIENTO_DETECTADO;

  const estabilizando =
    estadoMedicion ===
    ESTADO_MEDICION.ESTABILIZANDO;

  const ocupado =
    calculando || consultandoHistorico;

  // ====================================================
  // ACTUALIZAR ESTADO DESDE BACKEND
  // ====================================================

  const aplicarEstadoBackend = (data) => {
    if (!data || typeof data !== "object") {
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
  // CONSULTAR ESTADO REAL DE MEDICIÓN
  // ====================================================

  const consultarEstadoMedicion = async (
    generacion
  ) => {
    try {
      const res = await apiClient.get(
        `${URL_CALCULO}/estado`,
        { timeout: 5000 }
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
      // El POST /calculo maneja los errores finales.
      // Evitamos mostrar alertas repetidas.
    }
  };

  // ====================================================
  // INICIAR POLLING DEL PESAJE REAL
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
  // Este procedimiento solo hace solicitudes GET.
  //
  // No ejecuta POST /calculo.
  // No inicia el módulo HX711.
  // No guarda costos.
  // No permite finalizar una recolección.
  // ====================================================

  const handleConsultarHistorico = async () => {
    if (
      solicitudEnCursoRef.current ||
      consultandoHistorico ||
      calculando
    ) {
      return;
    }

    const generacion =
      ++generacionHistoricoRef.current;

    setConsultandoHistorico(true);
    setResultadoHistorico(null);

    try {
      // El backend identifica el proceso activo
      // del usuario autenticado.

      const procesoRes = await apiClient.get(
        URL_PROCESO_ACTIVO,
        { timeout: 10000 }
      );

      const procesoData = procesoRes?.data;

      if (
        procesoData?.tiene_proceso_activo !== true
      ) {
        throw new Error(
          "NO_EXISTE_PROCESO_ACTIVO"
        );
      }

      const proceso =
        procesoData?.proceso;

      const contenedorId = Number(
        proceso?.contenedor_id
      );

      if (
        !Number.isSafeInteger(contenedorId) ||
        contenedorId <= 0
      ) {
        throw new Error(
          "CONTENEDOR_NO_DISPONIBLE"
        );
      }

      // Consulta histórica en PostgreSQL.

      const historicoRes = await apiClient.get(
        `${URL_BASE}/ultimo-peso/${contenedorId}`,
        { timeout: 10000 }
      );

      if (
        generacion !==
        generacionHistoricoRef.current
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

      const peso = Number(
        historico.peso_lb
      );

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

    } catch (err) {
      if (
        generacion !==
        generacionHistoricoRef.current
      ) {
        return;
      }

      let mensaje =
        "No fue posible consultar el último peso registrado.";

      if (
        err?.message ===
        "NO_EXISTE_PROCESO_ACTIVO"
      ) {
        mensaje =
          "No existe un proceso activo para consultar su contenedor.";
      }

      if (
        err?.message ===
        "CONTENEDOR_NO_DISPONIBLE"
      ) {
        mensaje =
          "No se pudo identificar el contenedor del proceso.";
      }

      if (
        err?.message ===
        "SIN_PESO_HISTORICO"
      ) {
        mensaje =
          "Este contenedor no tiene lecturas históricas de peso disponibles.";
      }

      if (
        err?.message ===
        "PESO_HISTORICO_INVALIDO"
      ) {
        mensaje =
          "La lectura histórica de peso no es válida.";
      }

      await showBackendAlert({
        status: err?.response?.status || 400,
        data: err?.response?.data || {
          message: mensaje,
        },
      });

    } finally {
      if (
        generacion ===
        generacionHistoricoRef.current
      ) {
        setConsultandoHistorico(false);
      }
    }
  };

  // ====================================================
  // REGRESAR A OPCIONES DE PESAJE
  // ====================================================

  const handleVolver = () => {
    if (ocupado) {
      return;
    }

    setResultadoHistorico(null);
    setEstadoUI(ESTADO_UI.ESPERANDO);
  };

  // ====================================================
  // CANCELAR PROCESO
  // ====================================================

  const handleCancelar = () => {
    if (
      solicitudEnCursoRef.current ||
      consultandoHistorico
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
  // CALCULAR PESO REAL
  // ====================================================

  const handleCalcular = async () => {
    if (
      solicitudEnCursoRef.current ||
      consultandoHistorico
    ) {
      return;
    }

    solicitudEnCursoRef.current = true;

    const generacionCalculo =
      ++generacionCalculoRef.current;

    setResultadoVisual(null);
    setResultadoHistorico(null);

    setEstadoMedicion(
      ESTADO_MEDICION.OBTENIENDO_LECTURA
    );

    setMensajeMedicion(
      "Preparando medición de peso..."
    );

    setEstadoUI(ESTADO_UI.PROCESANDO);

    iniciarPolling();

    try {
      // El frontend no envía peso ni costo.
      // El backend valida y calcula todo.

      const res = await apiClient.post(
        URL_CALCULO,
        {},
        {
          timeout: TIMEOUT_CALCULO_MS,
        }
      );

      if (
        generacionCalculo !==
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

    } catch (err) {
      if (
        generacionCalculo !==
        generacionCalculoRef.current
      ) {
        return;
      }

      detenerPolling();

      setEstadoUI(ESTADO_UI.ESPERANDO);
      setResultadoVisual(null);

      const esTimeoutAxios =
        err?.code === "ECONNABORTED" ||
        err?.code === "ETIMEDOUT";

      if (
        err?.message ===
        "RESPUESTA_INVALIDA"
      ) {
        await showBackendAlert({
          status: 502,
          data: {
            message:
              "El servidor devolvió una respuesta de cálculo inválida.",
          },
        });

        return;
      }

      if (esTimeoutAxios) {
        await showBackendAlert({
          status: 504,
          data: {
            message:
              "No se recibió una respuesta del servidor dentro del tiempo esperado. Verifique el estado del proceso antes de intentar nuevamente.",
          },
        });

        return;
      }

      await showBackendAlert({
        status: err?.response?.status || 500,
        data: err?.response?.data || {
          message:
            "No fue posible realizar la medición de peso.",
        },
      });

    } finally {
      if (
        generacionCalculo ===
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
    // Solo se permite un cálculo real completado.
    // Una lectura histórica nunca habilita continuar.

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
  // DATOS DEL CÁLCULO REAL
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

  const tipoHistorico = obtenerTipoResiduo(
    resultadoHistorico
  );

  // ====================================================
  // MENSAJES DE MEDICIÓN
  // ====================================================

  const obtenerMensajePrincipal = () => {
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
    movimientoDetectado
      ? "warning"
      : "info";

  // ====================================================
  // RENDER
  // ====================================================

  return (
    <Modal
      show={show}
      onHide={
        ocupado ? undefined : handleClose
      }
      backdrop={
        ocupado ? "static" : true
      }
      keyboard={!ocupado}
      centered
      size="lg"
    >
      <Modal.Header
        className="modal-costo-header"
      >
        <Modal.Title>
          Total en libras y Costos
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>

        {/* ==========================================
            OPCIONES INICIALES
        ========================================== */}

        {estadoUI ===
          ESTADO_UI.ESPERANDO && (
          <Alert variant="info">
            Puede realizar una nueva medición
            utilizando el módulo de peso o
            consultar el último peso almacenado
            en la base de datos.
          </Alert>
        )}

        {/* ==========================================
            PESAJE REAL EN PROCESO
        ========================================== */}

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
                  movimientoDetectado
                    ? "warning"
                    : undefined
                }
              >
                <span
                  className="visually-hidden"
                >
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
                movimientoDetectado
                  ? "warning"
                  : undefined
              }
            />
          </div>
        )}

        {/* ==========================================
            CONSULTANDO HISTÓRICO
        ========================================== */}

        {consultandoHistorico && (
          <div className="text-center py-4">
            <Spinner
              animation="border"
              role="status"
              className="mb-3"
            />

            <p className="mb-0">
              Consultando último peso registrado...
            </p>
          </div>
        )}

        {/* ==========================================
            RESULTADO HISTÓRICO
        ========================================== */}

        {mostrandoHistorico &&
          !consultandoHistorico && (
          <>
            <Alert variant="warning">
              <strong>
                LECTURA HISTÓRICA
              </strong>

              <div className="mt-2">
                Este peso fue recuperado de
                PostgreSQL. No corresponde
                a una medición en tiempo real
                del módulo HX711.
              </div>
            </Alert>

            <Form>
              <Row>
                <Col md={6}>
                  <Form.Group className="mb-3">
                    <Form.Label>
                      Último peso registrado
                    </Form.Label>

                    <Form.Control
                      type="text"
                      value={
                        `${Number(
                          resultadoHistorico.peso_lb
                        ).toFixed(2)} lb`
                      }
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
                      Fecha de registro
                    </Form.Label>

                    <Form.Control
                      type="text"
                      value={
                        formatearFechaHistorica(
                          resultadoHistorico.fecha_hora
                        )
                      }
                      disabled
                    />
                  </Form.Group>

                  <Form.Group className="mb-3">
                    <Form.Label>
                      Estado de medición
                    </Form.Label>

                    <Form.Control
                      type="text"
                      value="Histórica / No vigente"
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
              Consulta de demostración.
              No se han registrado costos,
              lecturas nuevas ni recolecciones.
            </Alert>
          </>
        )}

        {/* ==========================================
            RESULTADO REAL DE CÁLCULO
        ========================================== */}

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
                    value={
                      `${porcentajeLlenado.toFixed(2)} %`
                    }
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

      {/* ==========================================
          BOTONES
      ========================================== */}

      <Modal.Footer>

        {estadoUI ===
          ESTADO_UI.ESPERANDO && (
          <>
            <Button
              variant="outline-primary"
              onClick={handleConsultarHistorico}
              disabled={ocupado}
            >
              Consultar último peso
            </Button>

            <Button
              variant="success"
              onClick={handleCalcular}
              disabled={ocupado}
            >
              Calcular peso
            </Button>
          </>
        )}

        {mostrandoHistorico && (
          <Button
            variant="outline-secondary"
            onClick={handleVolver}
            disabled={ocupado}
          >
            Volver
          </Button>
        )}

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

        {consultandoHistorico && (
          <Button
            variant="outline-primary"
            disabled
          >
            <Spinner
              animation="border"
              size="sm"
              className="me-2"
            />

            Consultando...
          </Button>
        )}

        {hayResultado && (
          <Button
            variant="success"
            onClick={handleContinuar}
            disabled={ocupado}
          >
            Continuar
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={handleCancelar}
          disabled={ocupado}
        >
          Cancelar
        </Button>

      </Modal.Footer>
    </Modal>
  );
};

export default ModalTotales;
