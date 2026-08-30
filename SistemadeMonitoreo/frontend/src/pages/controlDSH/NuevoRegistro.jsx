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

/*
 * TEMPORAL:
 * Se mantiene Bootstrap hasta revisar:
 * - ModalCosto
 * - ModalTotales
 * - RegistroRecoleccion
 */
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


/* =========================================================
   CONSTANTES DE INTERFAZ
   ========================================================= */

const ESTADO_PROCESO = {
  EN_PROCESO: "EN_PROCESO",
};


const ETAPA_PROCESO = {
  COSTO: "COSTO",
  CALCULO: "CALCULO",
  RECOLECCION: "RECOLECCION",
};


/* =========================================================
   TIPOS PARA PRESENTACIÓN
   ========================================================= */

const TIPOS = [
  {
    id: 2,
    label: "Punzocortante",
    Icon: FaSyringe,
    themeClass: "residuo-card--punzocortante",
  },

  {
    id: 1,
    label: "Bioinfeccioso",
    Icon: FaBiohazard,
    themeClass: "residuo-card--bioinfeccioso",
  },
];


/* =========================================================
   HELPERS
   ========================================================= */

const clamp0to100 = (value) => {
  const numero = Number(value);

  if (!Number.isFinite(numero)) {
    return 0;
  }

  return Math.min(
    100,
    Math.max(0, numero)
  );
};


/* =========================================================
   COMPONENTE
   ========================================================= */

const NuevoRegistro = () => {
  /* =======================================================
     DATOS SOLO PARA PRESENTACIÓN
     ======================================================= */

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


  /* =======================================================
     ESTADO DE VISTAS
     ======================================================= */

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


  /* =======================================================
     PROTECCIONES DE INTERFAZ
     ======================================================= */

  const recuperacionConsultadaRef =
    useRef(false);


  const inicioProcesoEnCursoRef =
    useRef(false);


  const recuperandoProcesoRef =
    useRef(false);


  /* =======================================================
     ¿HAY FLUJO ABIERTO?
     ======================================================= */

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


  /* =======================================================
     RESET VISUAL
     ======================================================= */

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


  /* =======================================================
     ABRIR ETAPA
     ======================================================= */

  const abrirEtapa =
    useCallback(
      async (etapaServidor) => {
        const etapa =
          String(
            etapaServidor || ""
          )
            .trim()
            .toUpperCase();


        /* FOTO 2 */

        if (
          etapa ===
          ETAPA_PROCESO.COSTO
        ) {
          setShowCosto(true);

          setShowTotales(false);

          setShowRecoleccion(false);

          return true;
        }


        /* FOTO 3 */

        if (
          etapa ===
          ETAPA_PROCESO.CALCULO
        ) {
          setShowCosto(false);

          setShowTotales(true);

          setShowRecoleccion(false);

          return true;
        }


        /* FOTO 4 */

        if (
          etapa ===
          ETAPA_PROCESO.RECOLECCION
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


  /* =======================================================
     CERRAR FOTO 2
     ======================================================= */

  const closeCosto =
    useCallback(() => {
      /*
       * Cerrar el modal
       * NO cancela el proceso.
       */
      setShowCosto(false);
    }, []);


  /* =======================================================
     CERRAR FOTO 3
     ======================================================= */

  const closeTotales =
    useCallback(() => {
      /*
       * Cerrar el modal
       * NO cancela el proceso.
       */
      setShowTotales(false);
    }, []);


  /* =======================================================
     CARGAR NIVELES
     ======================================================= */

  const cargarNiveles =
    useCallback(async () => {
      setLoading(true);

      try {
        const res =
          await apiClient.get(
            "/contenedores"
          );


        const list =
          Array.isArray(
            res.data
          )
            ? res.data
            : res.data?.rows ||
              res.data?.data ||
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


          next[tipoId] = {
            porcentaje:
              clamp0to100(
                contenedor
                  ?.estado_actual_litros
              ),
          };
        }


        setNivelesPorTipo(
          next
        );

      } catch (err) {
        console.error(
          "Error cargando niveles:",
          err
        );


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

      } finally {
        setLoading(false);
      }
    }, []);


  /* =======================================================
     CONSULTAR PROCESO ACTIVO
     ======================================================= */

  const obtenerProcesoActivo =
    useCallback(async () => {
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


      const proceso =
        res.data?.proceso;


      if (!proceso) {
        return null;
      }


      return proceso;
    }, []);


  /* =======================================================
     CONTINUAR PROCESO
     ======================================================= */

  const continuarProceso =
    useCallback(async () => {
      if (
        recuperandoProcesoRef.current
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
          ESTADO_PROCESO.EN_PROCESO
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
    }, [
      abrirEtapa,
      obtenerProcesoActivo,
    ]);


  /* =======================================================
     CANCELAR PROCESO
     ======================================================= */

  const cancelarProcesoActual =
    useCallback(async () => {
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
            /*
             * Compatibilidad temporal.
             * No se guarda como estado React.
             */
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
    }, [
      cargarNiveles,
      obtenerProcesoActivo,
      resetFlujoUI,
    ]);


  /* =======================================================
     MOSTRAR MODAL "PROCESO EN CURSO"
     ======================================================= */

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


  /* =======================================================
     RECUPERAR PROCESO AL ENTRAR
     ======================================================= */

  const recuperarProcesoActivo =
    useCallback(async () => {
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
    }, [
      mostrarDecisionProceso,
      obtenerProcesoActivo,
    ]);


  /* =======================================================
     INICIALIZACIÓN
     ======================================================= */

  useEffect(() => {
    if (
      recuperacionConsultadaRef.current
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


  /* =======================================================
     INICIAR NUEVO PROCESO
     ======================================================= */

  const handleSelectTipo =
    useCallback(
      async (
        idTipoResiduo
      ) => {
        if (
          hayProcesoUIActivo ||
          inicioProcesoEnCursoRef.current
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


  /* =======================================================
     FOTO 2 → FOTO 3
     ======================================================= */

  const handleOpenTotales =
    useCallback(() => {
      setShowCosto(false);

      setShowTotales(true);

      setShowRecoleccion(false);
    }, []);


  /* =======================================================
     FOTO 3 → FOTO 4
     ======================================================= */

  const handleShowRecoleccion =
    useCallback(() => {
      setShowCosto(false);

      setShowTotales(false);

      setShowRecoleccion(true);
    }, []);


  /* =======================================================
     CANCELAR DESDE CUALQUIER FOTO
     ======================================================= */

  const handleCancel =
    useCallback(async () => {
      await cancelarProcesoActual();
    }, [
      cancelarProcesoActual,
    ]);


  /* =======================================================
     FINALIZAR
     ======================================================= */

  const handleFinish =
    useCallback(async () => {
      resetFlujoUI();


      await showSuccessAlert(
        "Recolección guardada. Proceso finalizado."
      );


      await cargarNiveles();

    }, [
      cargarNiveles,
      resetFlujoUI,
    ]);


  /* =======================================================
     TARJETAS
     ======================================================= */

  const renderCard =
    useCallback(
      (tipo) => {
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
          inicioProcesoEnCursoRef.current;


        return (
          <button
            key={tipo.id}
            type="button"

            className={`residuo-card ${tipo.themeClass} ${
              disabled
                ? "disabled"
                : ""
            }`}

            onClick={() => {
              if (disabled) {
                return;
              }

              handleSelectTipo(
                tipo.id
              );
            }}

            disabled={disabled}

            aria-label={`Seleccionar residuo ${tipo.label}`}
          >

            {/* ===========================================
                CABECERA DE RESIDUO
            =========================================== */}

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
                {porcentaje}%
              </strong>

            </div>


            {/* ===========================================
                BARRA DE NIVEL
            =========================================== */}

            <div
              className="custom-progress"
              role="progressbar"
              aria-valuenow={
                porcentaje
              }
              aria-valuemin="0"
              aria-valuemax="100"
              aria-label={`Nivel de ${tipo.label}: ${porcentaje}%`}
            >

              <div
                className="custom-progress-bar"
                style={{
                  width:
                    `${porcentaje}%`,
                }}
              />

            </div>


            {/* ===========================================
                SIN DATOS
            =========================================== */}

            {!nivel &&
              !loading && (

                <small className="residuo-card-empty">
                  Sin datos disponibles para
                  este tipo de residuo.
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


  /* =======================================================
     RENDER
     ======================================================= */

  return (
    <section className="system-page nuevo-registro-page">

      <div className="system-container">

        <div
          className={`nuevo-registro-layout ${
            showRecoleccion
              ? "with-recoleccion"
              : ""
          }`}
        >

          {/* =============================================
              SELECCIÓN DE RESIDUO
          ============================================= */}

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


          {/* =============================================
              FOTO 4
          ============================================= */}

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


        {/* ===============================================
            FOTO 2
        =============================================== */}

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


        {/* ===============================================
            FOTO 3
        =============================================== */}

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