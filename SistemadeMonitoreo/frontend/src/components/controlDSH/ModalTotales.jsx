
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
// CONFIGURACIÓN DESDE .ENV
// ======================================================

const leerMilisegundos = (
  valor,
  predeterminado
) => {
  const numero = Number(valor);

  return Number.isSafeInteger(numero) && numero > 0
    ? numero
    : predeterminado;
};

const INTERVALO_CONSULTA_MS =
  leerMilisegundos(
    import.meta.env.VITE_MEDICION_PESO_POLL_MS,
    700
  );

const TIMEOUT_CALCULO_MS =
  leerMilisegundos(
    import.meta.env.VITE_MEDICION_PESO_TIMEOUT_MS,
    135000
);

// ======================================================
// ENDPOINTS
// ======================================================

const URL_CALCULO =
  "/control-dsh/registro-pesaje/calculo";

const URL_CALCULO_HISTORICO =
  "/control-dsh/registro-pesaje/calculo/historico";

// ======================================================
// CONFIGURACIÓN TEMPORAL
// ======================================================
//
// true:
// Consulta el último par de lecturas almacenadas
// mediante el servicio histórico del backend.
//
// false:
// Utiliza el módulo de peso físico.
//
// Restaurar después de la defensa.
// ======================================================

const DEMO_PESO_HISTORICO = false;

// ======================================================
// ESTADOS
// ======================================================

const ESTADO_UI = Object.freeze({
  ESPERANDO: "ESPERANDO",
  PROCESANDO: "PROCESANDO",
  RESULTADO: "RESULTADO",
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

// ======================================================
// VALIDAR RESULTADO DEL MÓDULO FÍSICO
// ======================================================

const respuestaCalculoValida = (data) => {
  if (
    !data ||
    typeof data !== "object" ||
    data.estado_medicion !==
      ESTADO_MEDICION.COMPLETADO ||
    data.etapa !== "RECOLECCION"
  ) {
    return false;
  }

  const peso = Number(
    data.total_en_libras
  );

  const costo = Number(
    data.total_costo_q
  );

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

// ======================================================
// VALIDAR CONSULTA HISTÓRICA
// ======================================================

const respuestaHistoricaValida = (data) => {
  if (
    !data ||
    data.estado_medicion !== "HISTORICO" ||
    data.origen !== "historial_calculo_costos" ||
    data.demostracion !== true ||
    data.permite_registrar_recoleccion !== false ||
    ![1, 2].includes(
      Number(data?.contenedor?.id_tipo_residuo)
    )
  ) {
    return false;
  }

  const valores = [
    data.total_en_libras,
    data.porcentaje_llenado,
    data.costo_por_libra_aplicado,
    data.total_costo_q,
  ];

  return (
    valores.every(
      (valor) =>
        valor !== null &&
        valor !== undefined &&
        valor !== "" &&
        Number.isFinite(Number(valor)) &&
        Number(valor) >= 0
    ) &&
    Number(data.porcentaje_llenado) <= 100
  );
};

// ======================================================
// COMPONENTE PRINCIPAL
// ======================================================

const ModalTotales = ({
  show,
  handleClose,
  handleShowRecoleccion,
  onCancel,
}) => {

  // ====================================================
  // ESTADOS
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
  // DETENER POLLING
  // ====================================================

  const detenerPolling = () => {
    pollingActivoRef.current = false;

    generacionPollingRef.current += 1;

    if (pollingTimerRef.current !== null) {
      clearTimeout(
        pollingTimerRef.current
      );

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
        clearTimeout(
          pollingTimerRef.current
        );
      }
    };
  }, []);

  // ====================================================
  // REINICIAR AL ABRIR O CERRAR
  // ====================================================

  useEffect(() => {
    if (!show) {
      detenerPolling();

      generacionCalculoRef.current += 1;

      return;
    }

    detenerPolling();

    solicitudEnCursoRef.current = false;

    generacionCalculoRef.current += 1;

    setEstadoUI(
      ESTADO_UI.ESPERANDO
    );

    setResultadoVisual(null);

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

      aplicarEstadoBackend(
        res?.data
      );

    } catch (error) {
      // El POST /calculo controla
      // los errores finales del módulo.
    }
  };

  // ====================================================
  // INICIAR POLLING DEL MÓDULO
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

      await consultarEstadoMedicion(
        generacion
      );

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
  // CALCULAR PESO
  // ====================================================

  const handleCalcular = async () => {
    if (solicitudEnCursoRef.current) {
      return;
    }

    solicitudEnCursoRef.current = true;

    const generacionCalculo =
      ++generacionCalculoRef.current;

    setResultadoVisual(null);

    setEstadoMedicion(
      ESTADO_MEDICION.OBTENIENDO_LECTURA
    );

    setMensajeMedicion(
      DEMO_PESO_HISTORICO
        ? "Procesando información del contenedor..."
        : "Preparando medición de peso..."
    );

    setEstadoUI(
      ESTADO_UI.PROCESANDO
    );

    try {
      // El backend obtiene y valida:
      // peso, nivel, costo y contenedor.
      //
      // El frontend no envía esos valores.

      if (!DEMO_PESO_HISTORICO) {
        iniciarPolling();
      }

      const res = DEMO_PESO_HISTORICO
        ? await apiClient.get(
            URL_CALCULO_HISTORICO,
            {
              timeout: 10000,
            }
          )
        : await apiClient.post(
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

      const respuestaValida =
        DEMO_PESO_HISTORICO
          ? respuestaHistoricaValida(data)
          : respuestaCalculoValida(data);

      if (!respuestaValida) {
        throw new Error(
          "RESPUESTA_INVALIDA"
        );
      }

      if (!DEMO_PESO_HISTORICO) {
        aplicarEstadoBackend(data);
      }

      // ==================================================
      // GUARDAR RESULTADO PARA MOSTRARLO EN PANTALLA
      // ==================================================

      setResultadoVisual(data);

      // ==================================================
      // HABILITAR FOTO 3:
      // - Total en libras
      // - Porcentaje
      // - Tipo
      // - Costo aplicado
      // - Total de costos
      // - Botón Continuar
      // ==================================================

      setEstadoUI(
        ESTADO_UI.RESULTADO
      );

    } catch (err) {
      if (
        generacionCalculo !==
        generacionCalculoRef.current
      ) {
        return;
      }

      detenerPolling();

      setEstadoUI(
        ESTADO_UI.ESPERANDO
      );

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
        status:
          err?.response?.status || 500,

        data:
          err?.response?.data || {
            message:
              "No fue posible obtener los resultados de peso.",
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
  // CONTINUAR A REGISTRO DE RECOLECCIÓN
  // ====================================================
  //
  // Se restaura la llamada original que abre la
  // siguiente ventana mediante NuevoRegistro.jsx.
  //
  // No se modifica el resultado de PostgreSQL.
  // No se confirma una recolección aquí.
  // ====================================================

  const handleContinuar = () => {
    // Solo permitir recolección con un cálculo oficial confirmado.
    if (
      resultadoVisual?.estado_medicion !== ESTADO_MEDICION.COMPLETADO ||
      resultadoVisual?.etapa !== "RECOLECCION" ||
      resultadoVisual?.demostracion === true ||
      resultadoVisual?.permite_registrar_recoleccion === false
    ) {
      showBackendAlert({
        status: 409,
        data: { message: "Para registrar la recolección debe completar el pesaje oficial del módulo." },
      });
      return;
    }

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
  // DATOS DEL RESULTADO
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
  // MENSAJES DURANTE MEDICIÓN
  // ====================================================

  const obtenerMensajePrincipal = () => {
    if (DEMO_PESO_HISTORICO) {
      return "PROCESANDO DATOS DE PESO";
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
      return "Consultando registros de peso...";
    }

    if (movimientoDetectado) {
      return (
        mensajeMedicion ||
        "Mantenga el contenedor inmóvil para continuar con la medición."
      );
    }

    if (estabilizando) {
      return (
        mensajeMedicion ||
        "Espere mientras se obtiene una lectura estable."
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
        calculando
          ? "static"
          : true
      }
      keyboard={!calculando}
      centered
      size="lg"
    >
      {/* ==========================================
          ENCABEZADO
      ========================================== */}

      <Modal.Header
        className="modal-costo-header"
      >
        <Modal.Title>
          Total en libras y Costos
        </Modal.Title>
      </Modal.Header>

      <Modal.Body>

        {/* ==========================================
            ESTADO INICIAL
        ========================================== */}

        {estadoUI ===
          ESTADO_UI.ESPERANDO && (
          <Alert variant="info">
            {DEMO_PESO_HISTORICO
              ? (
                <>
                  Presione{" "}
                  <strong>
                    Calcular peso
                  </strong>
                  {" "}para consultar los
                  resultados almacenados.
                </>
              )
              : (
                <>
                  Presione{" "}
                  <strong>
                    Calcular peso
                  </strong>
                  {" "}para iniciar la
                  medición del contenedor.
                </>
              )
            }
          </Alert>
        )}

        {/* ==========================================
            PROCESANDO
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
                  movimientoDetectado &&
                  !DEMO_PESO_HISTORICO
                    ? "warning"
                    : undefined
                }
              >
                <span className="visually-hidden">
                  Procesando información
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

        {/* ==========================================
            RESULTADOS - CINCO CAMPOS ORIGINALES
        ========================================== */}

        {hayResultado && (
          <Form>
            <Row>
              {/* COLUMNA IZQUIERDA */}

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Total en libras
                  </Form.Label>

                  <Form.Control
                    type="text"
                    value={
                      `${totalLb.toFixed(2)} lb`
                    }
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

              {/* COLUMNA DERECHA */}

              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Tipo de desecho
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
                    value={
                      costoAplicado.toFixed(4)
                    }
                    disabled
                  />
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    Total de costos (Q)
                  </Form.Label>

                  <Form.Control
                    type="text"
                    value={
                      totalCosto.toFixed(2)
                    }
                    disabled
                  />
                </Form.Group>
              </Col>
            </Row>
          </Form>
        )}

      </Modal.Body>

      {/* ==========================================
          FOOTER ORIGINAL
      ========================================== */}

      <Modal.Footer>

        {/* CALCULAR PESO */}

        {!hayResultado && (
          <Button
            variant="success"
            onClick={handleCalcular}
            disabled={calculando}
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

        {/* CONTINUAR A REGISTRO DE RECOLECCIÓN */}

        {hayResultado && (
          <Button
            variant="success"
            onClick={handleContinuar}
            disabled={
              calculando ||
              solicitudEnCursoRef.current
            }
          >
            Continuar
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
