import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FaChartLine,
  FaSyringe,
  FaBiohazard,
  FaInfoCircle,
} from "react-icons/fa";

import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/nuevo-registro.css";

import apiClient from "../../utils/apiClient";

import {
  showBackendAlert,
  showInfoAlert,
  showSuccessAlert,
} from "../../utils/alerts";

import ModalCosto from "../../components/controlDSH/ModalCosto";
import ModalTotales from "../../components/controlDSH/ModalTotales";
import RegistroRecoleccion from "./RegistroRecoleccion";


// ======================================================
// CONFIGURACION
// ======================================================

const NIVEL_REFRESH_INTERVAL_MS =
  Number(
    import.meta.env
      .VITE_NIVEL_REFRESH_INTERVAL_MS
  ) > 0
    ? Number(
        import.meta.env
          .VITE_NIVEL_REFRESH_INTERVAL_MS
      )
    : 3000;


// ======================================================
// CONSTANTES
// ======================================================

const ESTADO_PROCESO = {
  EN_PROCESO: "EN_PROCESO",
};


const ETAPA_PROCESO = {
  COSTO: "COSTO",
  CALCULO: "CALCULO",
  RECOLECCION: "RECOLECCION",
};


const TIPOS = [
  {
    id: 2,
    label: "Punzocortante",
    Icon: FaSyringe,
    themeClass:
      "residuo-card--punzocortante",
  },
  {
    id: 1,
    label: "Bioinfeccioso",
    Icon: FaBiohazard,
    themeClass:
      "residuo-card--bioinfeccioso",
  },
];


// ======================================================
// HELPERS
// ======================================================

function clamp0to100(value) {
  const numero =
    Number(value);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(
      0,
      numero
    )
  );
}


// ======================================================
// COMPONENTE
// ======================================================

const NuevoRegistro = () => {

  // ====================================================
  // DATOS
  // ====================================================

  const [
    loading,
    setLoading,
  ] = useState(false);


  const [
    nivelesPorTipo,
    setNivelesPorTipo,
  ] = useState({
    1: null,
    2: null,
  });


  // ====================================================
  // VISTAS
  // ====================================================

  const [
    showCosto,
    setShowCosto,
  ] = useState(false);


  const [
    showTotales,
    setShowTotales,
  ] = useState(false);


  const [
    showRecoleccion,
    setShowRecoleccion,
  ] = useState(false);


  // ====================================================
  // PROTECCIONES
  // ====================================================

  const recuperacionConsultadaRef =
    useRef(false);


  const inicioProcesoEnCursoRef =
    useRef(false);


  const recuperandoProcesoRef =
    useRef(false);


  const actualizacionNivelEnCursoRef =
    useRef(false);


  // ====================================================
  // FLUJO ACTIVO EN UI
  // ====================================================

  const hayProcesoUIActivo =
    useMemo(
      () =>
        showCosto ||
        showTotales ||
        showRecoleccion,
      [
        showCosto,
        showTotales,
        showRecoleccion,
      ]
    );


  // ====================================================
  // RESET VISUAL
  // ====================================================

  const resetFlujoUI =
    useCallback(() => {

      setShowCosto(false);

      setShowTotales(false);

      setShowRecoleccion(false);

      inicioProcesoEnCursoRef.current =
        false;

      recuperandoProcesoRef.current =
        false;

    }, []);


  // ====================================================
  // ABRIR ETAPA
  // ====================================================

  const abrirEtapa =
    useCallback(
      async (
        etapaServidor
      ) => {

        const etapa =
          String(
            etapaServidor || ""
          )
            .trim()
            .toUpperCase();


        if (
          etapa ===
          ETAPA_PROCESO.COSTO
        ) {

          setShowCosto(true);

          setShowTotales(false);

          setShowRecoleccion(false);

          return true;
        }


        if (
          etapa ===
          ETAPA_PROCESO.CALCULO
        ) {

          setShowCosto(false);

          setShowTotales(true);

          setShowRecoleccion(false);

          return true;
        }


        if (
          etapa ===
          ETAPA_PROCESO
            .RECOLECCION
        ) {

          setShowCosto(false);

          setShowTotales(false);

          setShowRecoleccion(true);

          return true;
        }


        await showInfoAlert(
          "No fue posible determinar en qué etapa quedó el proceso."
        );


        return false;
      },
      []
    );


  // ====================================================
  // CERRAR MODALES
  // ====================================================

  const closeCosto =
    useCallback(() => {

      setShowCosto(false);

    }, []);


  const closeTotales =
    useCallback(() => {

      setShowTotales(false);

    }, []);


  // ====================================================
  // PROCESAR NIVELES
  // ====================================================

  const construirNiveles =
    useCallback(
      (
        data
      ) => {

        const list =
          Array.isArray(data)
            ? data
            : data?.rows ||
              data?.data ||
              [];


        const next = {
          1: null,
          2: null,
        };


        for (
          const contenedor
          of list
        ) {

          const tipoId =
            Number(
              contenedor
                ?.id_tipo_residuo
            );


          if (
            tipoId !== 1 &&
            tipoId !== 2
          ) {

            continue;
          }


          if (
            next[tipoId] !==
            null
          ) {

            continue;
          }


          if (
            contenedor
              ?.nivel_disponible ===
              false ||

            contenedor
              ?.estado_actual_litros ===
              null ||

            contenedor
              ?.estado_actual_litros ===
              undefined
          ) {

            next[tipoId] =
              null;

            continue;
          }


          const porcentaje =
            Number(
              contenedor
                .estado_actual_litros
            );


          if (
            !Number.isFinite(
              porcentaje
            )
          ) {

            next[tipoId] =
              null;

            continue;
          }


          next[tipoId] = {

            porcentaje:
              clamp0to100(
                porcentaje
              ),

            actualizadoEn:
              contenedor
                ?.nivel_actualizado_en ||
              null,

            proveedor:
              contenedor
                ?.nivel_proveedor ||
              null,
          };
        }


        return next;
      },
      []
    );


  // ====================================================
  // CARGAR NIVELES
  // ====================================================

  const cargarNiveles =
    useCallback(
      async ({
        silencioso = false,
      } = {}) => {

        if (
          silencioso &&
          actualizacionNivelEnCursoRef
            .current
        ) {

          return null;
        }


        if (silencioso) {

          actualizacionNivelEnCursoRef
            .current =
            true;

        } else {

          setLoading(true);
        }


        try {

          const res =
            await apiClient.get(
              "/contenedores"
            );


          const next =
            construirNiveles(
              res.data
            );


          setNivelesPorTipo(
            next
          );


          return next;


        } catch (err) {

          console.error(
            silencioso
              ? "Error actualizando niveles automáticamente:"
              : "Error cargando niveles:",
            err
          );


          if (silencioso) {
            return null;
          }


          setNivelesPorTipo({
            1: null,
            2: null,
          });


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
                  "No se pudieron cargar los niveles.",
              },
          });


          return null;


        } finally {

          if (silencioso) {

            actualizacionNivelEnCursoRef
              .current =
              false;

          } else {

            setLoading(false);
          }
        }
      },
      [
        construirNiveles,
      ]
    );


  // ====================================================
  // PROCESO ACTIVO
  // ====================================================

  const obtenerProcesoActivo =
    useCallback(
      async () => {

        const res =
          await apiClient.get(
            "/control-dsh/registro-pesaje/proceso-activo"
          );


        if (
          res.data
            ?.tiene_proceso_activo !==
          true
        ) {

          return null;
        }


        return (
          res.data
            ?.proceso ||
          null
        );
      },
      []
    );


  // ====================================================
  // CONTINUAR PROCESO
  // ====================================================

  const continuarProceso =
    useCallback(
      async () => {

        if (
          recuperandoProcesoRef
            .current
        ) {

          return;
        }


        recuperandoProcesoRef.current =
          true;


        try {

          const proceso =
            await obtenerProcesoActivo();


          if (!proceso) {

            await showInfoAlert(
              "No existe un proceso activo para continuar."
            );

            return;
          }


          if (
            proceso.estado_proceso !==
            ESTADO_PROCESO
              .EN_PROCESO
          ) {

            await showInfoAlert(
              "El proceso ya no se encuentra activo."
            );

            return;
          }


          await abrirEtapa(
            proceso.etapa
          );


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
                  "No fue posible recuperar el proceso.",
              },
          });


        } finally {

          recuperandoProcesoRef.current =
            false;
        }
      },
      [
        abrirEtapa,
        obtenerProcesoActivo,
      ]
    );


  // ====================================================
  // CANCELAR PROCESO
  // ====================================================

  const cancelarProcesoActual =
    useCallback(
      async () => {

        try {

          const proceso =
            await obtenerProcesoActivo();


          if (!proceso) {

            resetFlujoUI();

            await showInfoAlert(
              "No existe un proceso activo para cancelar."
            );

            return false;
          }


          const procesoId =
            Number(
              proceso
                ?.historial_calculo_id
            );


          if (!procesoId) {

            await showInfoAlert(
              "El servidor no devolvió un proceso válido."
            );

            return false;
          }


          await apiClient.post(
            "/control-dsh/registro-pesaje/cancelar",
            {
              historial_calculo_id:
                procesoId,
            }
          );


          resetFlujoUI();


          await showSuccessAlert(
            "Proceso cancelado correctamente."
          );


          await cargarNiveles();


          return true;


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
                  "No fue posible cancelar el proceso.",
              },
          });


          return false;
        }
      },
      [
        cargarNiveles,
        obtenerProcesoActivo,
        resetFlujoUI,
      ]
    );


  // ====================================================
  // DECISION PROCESO EN CURSO
  // ====================================================

  const mostrarDecisionProceso =
    useCallback(
      async (
        proceso,
        message =
          "Tiene un proceso de pesaje en curso. ¿Qué desea hacer?"
      ) => {

        if (!proceso) {
          return;
        }


        await showBackendAlert({

          status: 409,

          data: {

            codigo:
              "PROCESO_EN_CURSO",

            requiere_decision:
              true,

            message,

            proceso,
          },

          onContinueProcess:
            async () => {

              await continuarProceso();
            },

          onCancelProcess:
            async () => {

              await cancelarProcesoActual();
            },
        });
      },
      [
        cancelarProcesoActual,
        continuarProceso,
      ]
    );


  // ====================================================
  // RECUPERAR PROCESO AL ENTRAR
  // ====================================================

  const recuperarProcesoActivo =
    useCallback(
      async () => {

        try {

          const proceso =
            await obtenerProcesoActivo();


          if (!proceso) {
            return;
          }


          await mostrarDecisionProceso(
            proceso
          );


        } catch (err) {

          console.error(
            "Error consultando proceso activo:",
            err
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
                  "No fue posible consultar el proceso activo.",
              },
          });
        }
      },
      [
        mostrarDecisionProceso,
        obtenerProcesoActivo,
      ]
    );


  // ====================================================
  // INICIALIZACION
  // ====================================================

  useEffect(() => {

    if (
      recuperacionConsultadaRef
        .current
    ) {

      return;
    }


    recuperacionConsultadaRef.current =
      true;


    const inicializar =
      async () => {

        await cargarNiveles();

        await recuperarProcesoActivo();
      };


    inicializar();

  }, [
    cargarNiveles,
    recuperarProcesoActivo,
  ]);


  // ====================================================
  // ACTUALIZACION AUTOMATICA DE NIVELES
  // ====================================================

  useEffect(() => {

    const actualizar =
      () => {

        if (
          document.hidden
        ) {

          return;
        }


        cargarNiveles({
          silencioso: true,
        });
      };


    const intervalo =
      setInterval(
        actualizar,
        NIVEL_REFRESH_INTERVAL_MS
      );


    document.addEventListener(
      "visibilitychange",
      actualizar
    );


    return () => {

      clearInterval(
        intervalo
      );


      document.removeEventListener(
        "visibilitychange",
        actualizar
      );
    };

  }, [
    cargarNiveles,
  ]);


  // ====================================================
  // INICIAR PROCESO
  // ====================================================

  const handleSelectTipo =
    useCallback(
      async (
        idTipoResiduo
      ) => {

        if (
          hayProcesoUIActivo ||
          inicioProcesoEnCursoRef
            .current
        ) {

          return;
        }


        inicioProcesoEnCursoRef.current =
          true;


        try {

          await apiClient.post(
            "/control-dsh/registro-pesaje/iniciar",
            {
              id_tipo_residuo:
                idTipoResiduo,
            }
          );


          setShowCosto(true);

          setShowTotales(false);

          setShowRecoleccion(false);


        } catch (err) {

          const status =
            err?.response
              ?.status ||
            500;


          const data =
            err?.response
              ?.data ||
            {};


          await showBackendAlert({

            status,

            data,

            onContinueProcess:
              async () => {

                await continuarProceso();
              },

            onCancelProcess:
              async () => {

                await cancelarProcesoActual();
              },
          });


        } finally {

          inicioProcesoEnCursoRef.current =
            false;
        }
      },
      [
        cancelarProcesoActual,
        continuarProceso,
        hayProcesoUIActivo,
      ]
    );


  // ====================================================
  // COSTO -> CALCULO
  // ====================================================

  const handleOpenTotales =
    useCallback(() => {

      setShowCosto(false);

      setShowTotales(true);

      setShowRecoleccion(false);

    }, []);


  // ====================================================
  // CALCULO -> RECOLECCION
  // ====================================================
  //
  // El cambio de etapa ocurre cuando ModalTotales
  // confirma que el backend devolvió el cálculo como
  // COMPLETADO.
  //
  // Ya no existe una etapa visual de retiro.
  //
  // ====================================================

  const handleShowRecoleccion =
    useCallback(() => {

      setShowCosto(false);

      setShowTotales(false);

      setShowRecoleccion(true);

    }, []);


  // ====================================================
  // CANCELAR
  // ====================================================

  const handleCancel =
    useCallback(
      async () => {

        await cancelarProcesoActual();

      },
      [
        cancelarProcesoActual,
      ]
    );


  // ====================================================
  // FINALIZAR
  // ====================================================

  const handleFinish =
    useCallback(
      async () => {

        resetFlujoUI();


        await showSuccessAlert(
          "Recolección guardada. Proceso finalizado."
        );


        await cargarNiveles();

      },
      [
        cargarNiveles,
        resetFlujoUI,
      ]
    );


  // ====================================================
  // TARJETAS
  // ====================================================

  const renderCard =
    useCallback(
      (
        tipo
      ) => {

        const nivel =
          nivelesPorTipo[
            tipo.id
          ];


        const porcentaje =
          nivel
            ? Number(
                clamp0to100(
                  nivel.porcentaje
                ).toFixed(0)
              )
            : 0;


        const disabled =
          loading ||
          inicioProcesoEnCursoRef
            .current;


        return (

          <button
            key={
              tipo.id
            }
            type="button"
            className={
              `residuo-card ${tipo.themeClass} ${
                disabled
                  ? "disabled"
                  : ""
              }`
            }
            onClick={() => {

              if (disabled) {
                return;
              }


              handleSelectTipo(
                tipo.id
              );
            }}
            disabled={
              disabled
            }
            aria-label={
              `Seleccionar residuo ${tipo.label}`
            }
          >

            <div className="residuo-card-header">

              <div className="residuo-card-identity">

                <span className="residuo-card-icon">

                  <tipo.Icon />

                </span>


                <span className="residuo-card-name">

                  {tipo.label}

                </span>

              </div>


              <strong className="residuo-card-percentage">

                {nivel
                  ? `${porcentaje}%`
                  : "--"}

              </strong>

            </div>


            <div
              className="custom-progress"
              role="progressbar"
              aria-valuenow={
                nivel
                  ? porcentaje
                  : 0
              }
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label={
                nivel
                  ? `Nivel de ${tipo.label}: ${porcentaje}%`
                  : `Nivel de ${tipo.label} no disponible`
              }
            >

              <div
                className="custom-progress-bar"
                style={{
                  width:
                    nivel
                      ? `${porcentaje}%`
                      : "0%",
                }}
              />

            </div>


            {!nivel &&
              !loading && (

                <small className="residuo-card-empty">

                  Nivel no disponible actualmente.

                </small>

              )}

          </button>
        );
      },
      [
        nivelesPorTipo,
        loading,
        handleSelectTipo,
      ]
    );


  // ====================================================
  // RENDER
  // ====================================================

  return (

    <section className="system-page nuevo-registro-page">

      <div className="system-container">

        <div
          className={
            `nuevo-registro-layout ${
              showRecoleccion
                ? "with-recoleccion"
                : ""
            }`
          }
        >

          <div className="system-card nuevo-registro-card">

            <header className="nuevo-registro-header">

              <div className="nuevo-registro-title">

                <FaChartLine />


                <div>

                  <h2 className="system-card-title">

                    Niveles de Residuos

                  </h2>


                  <p className="system-card-description">

                    Seleccione el tipo de residuo
                    que desea registrar.

                  </p>

                </div>

              </div>

            </header>


            <div className="nuevo-registro-list">

              {TIPOS.map(
                renderCard
              )}

            </div>


            <div className="system-alert system-alert-info nuevo-registro-info">

              <FaInfoCircle />


              <div>

                <strong>
                  Información:
                </strong>


                <span>

                  {" "}

                  Debe seleccionar uno de los
                  desechos para iniciar el cálculo
                  del pesaje.

                </span>

              </div>

            </div>

          </div>


          {showRecoleccion && (

            <div className="nuevo-registro-recoleccion">

              <RegistroRecoleccion
                onCancel={
                  handleCancel
                }
                onFinish={
                  handleFinish
                }
              />

            </div>

          )}

        </div>


        <ModalCosto
          show={
            showCosto
          }
          handleClose={
            closeCosto
          }
          handleOpenTotales={
            handleOpenTotales
          }
        />


        <ModalTotales
          show={
            showTotales
          }
          handleClose={
            closeTotales
          }
          handleShowRecoleccion={
            handleShowRecoleccion
          }
          onCancel={
            handleCancel
          }
        />

      </div>

    </section>
  );
};


export default NuevoRegistro;
