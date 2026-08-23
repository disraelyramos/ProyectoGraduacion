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


// =====================================================
// CONSTANTES DE INTERFAZ
// =====================================================
//
// Estas constantes únicamente sirven para decidir
// qué pantalla mostrar.
//
// El estado real sigue perteneciendo al backend.
// =====================================================

const ESTADO_PROCESO = {
  EN_PROCESO: "EN_PROCESO",
};


const ETAPA_PROCESO = {
  COSTO: "COSTO",
  CALCULO: "CALCULO",
  RECOLECCION: "RECOLECCION",
};


// =====================================================
// TIPOS PARA PRESENTACIÓN
// =====================================================

const TIPOS = [
  {
    id: 2,
    label: "Punzocortante",
    Icon: FaSyringe,
    iconClass: "text-danger",
    barClass: "bg-danger",
    barTextClass: "",
  },

  {
    id: 1,
    label: "Bioinfeccioso",
    Icon: FaBiohazard,
    iconClass: "text-warning",
    barClass: "bg-warning",
    barTextClass: "text-dark",
  },
];


// =====================================================
// HELPERS DE PRESENTACIÓN
// =====================================================

const clamp0to100 = (
  value
) => {

  const numero =
    Number(value);


  if (
    !Number.isFinite(
      numero
    )
  ) {
    return 0;
  }


  return Math.min(
    100,
    Math.max(
      0,
      numero
    )
  );
};


// =====================================================
// COMPONENTE
// =====================================================

const NuevoRegistro = () => {

  // ===================================================
  // DATOS SOLO PARA PRESENTACIÓN
  // ===================================================

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


  // ===================================================
  // ESTADO DE VISTAS
  // ===================================================
  //
  // Estos estados solamente controlan
  // qué componente se muestra.
  //
  // NO contienen datos de negocio.
  // ===================================================

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


  // ===================================================
  // PROTECCIONES DE INTERFAZ
  // ===================================================

  const recuperacionConsultadaRef =
    useRef(false);


  const inicioProcesoEnCursoRef =
    useRef(false);


  const recuperandoProcesoRef =
    useRef(false);


  // ===================================================
  // ¿HAY FLUJO ABIERTO?
  // ===================================================

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


  // ===================================================
  // RESET VISUAL
  // ===================================================

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


  // ===================================================
  // ABRIR ETAPA
  // ===================================================
  //
  // Esta función NO decide cuál es la etapa.
  //
  // Solo recibe la etapa que previamente
  // confirmó el backend.
  // ===================================================

  const abrirEtapa =
    useCallback(
      async (
        etapaServidor
      ) => {

        const etapa =
          String(
            etapaServidor ||
            ""
          )
            .trim()
            .toUpperCase();


        // =============================================
        // FOTO 2
        // =============================================

        if (
          etapa ===
          ETAPA_PROCESO.COSTO
        ) {

          setShowCosto(true);

          setShowTotales(false);

          setShowRecoleccion(false);

          return true;
        }


        // =============================================
        // FOTO 3
        // =============================================

        if (
          etapa ===
          ETAPA_PROCESO.CALCULO
        ) {

          setShowCosto(false);

          setShowTotales(true);

          setShowRecoleccion(false);

          return true;
        }


        // =============================================
        // FOTO 4
        // =============================================

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


  // ===================================================
  // CERRAR FOTO 2
  // ===================================================

  const closeCosto =
    useCallback(() => {

      /*
       * Cerrar el modal
       * NO cancela el proceso.
       */
      setShowCosto(false);

    }, []);


  // ===================================================
  // CERRAR FOTO 3
  // ===================================================

  const closeTotales =
    useCallback(() => {

      /*
       * Cerrar el modal
       * NO cancela el proceso.
       */
      setShowTotales(false);

    }, []);


  // ===================================================
  // CARGAR NIVELES
  // ===================================================
  //
  // Únicamente para pintar las barras.
  //
  // Estos valores NO participan en Foto 3.
  // ===================================================

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


  // ===================================================
  // CONSULTAR PROCESO ACTIVO
  // ===================================================
  //
  // Esta es la fuente real de verdad.
  // ===================================================

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
        res.data
          ?.proceso;


      if (!proceso) {

        return null;
      }


      return proceso;

    }, []);


  // ===================================================
  // CONTINUAR PROCESO
  // ===================================================
  //
  // IMPORTANTE:
  //
  // NO confiamos simplemente en el objeto recibido
  // por el modal.
  //
  // Cuando el usuario pulsa "Continuar proceso",
  // consultamos NUEVAMENTE al backend.
  //
  // Así sabemos la etapa actual en ese instante.
  // ===================================================

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

        // =============================================
        // 1. CONSULTA NUEVA AL BACKEND
        // =============================================

        const proceso =
          await obtenerProcesoActivo();


        if (!proceso) {

          await showInfoAlert(
            "No existe un proceso activo para continuar."
          );

          return;
        }


        // =============================================
        // 2. VALIDAR ESTADO
        // =============================================

        if (
          proceso
            .estado_proceso !==
          ESTADO_PROCESO
            .EN_PROCESO
        ) {

          await showInfoAlert(
            "El proceso ya no se encuentra activo."
          );

          return;
        }


        // =============================================
        // 3. EL BACKEND INDICA LA ETAPA
        // =============================================

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


  // ===================================================
  // CANCELAR PROCESO
  // ===================================================
  //
  // TEMPORAL:
  //
  // El endpoint actual todavía recibe
  // historial_calculo_id.
  //
  // No lo almacenamos en React.
  //
  // Se obtiene inmediatamente desde backend.
  //
  // Cuando migremos cancelar:
  //
  // POST /cancelar {}
  // ===================================================

  const cancelarProcesoActual =
    useCallback(async () => {

      try {

        // =============================================
        // 1. CONSULTAR PROCESO ACTUAL
        // =============================================

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


        // =============================================
        // 2. CANCELAR
        // =============================================

        await apiClient.post(
          "/control-dsh/registro-pesaje/cancelar",

          {
            /*
             * Compatibilidad temporal.
             *
             * No se guarda como estado React.
             */
            historial_calculo_id:
              procesoId,
          }
        );


        // =============================================
        // 3. LIMPIAR INTERFAZ
        // =============================================

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


  // ===================================================
  // MOSTRAR MODAL "PROCESO EN CURSO"
  // ===================================================

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


            /*
             * Se utiliza únicamente para
             * mostrar la advertencia.
             *
             * Al pulsar Continuar,
             * consultamos el backend otra vez.
             */
            proceso,
          },


          // =========================================
          // CONTINUAR
          // =========================================

          onContinueProcess:
            async () => {

              await continuarProceso();
            },


          // =========================================
          // CANCELAR
          // =========================================

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


  // ===================================================
  // RECUPERAR PROCESO AL ENTRAR
  // ===================================================

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


  // ===================================================
  // INICIALIZACIÓN
  // ===================================================

  useEffect(() => {

    /*
     * Evita doble ejecución por StrictMode
     * durante desarrollo.
     */
    if (
      recuperacionConsultadaRef.current
    ) {
      return;
    }


    recuperacionConsultadaRef.current =
      true;


    const inicializar =
      async () => {

        // =============================================
        // DATOS VISUALES
        // =============================================

        await cargarNiveles();


        // =============================================
        // PROCESO REAL
        // =============================================

        await recuperarProcesoActivo();
      };


    inicializar();


  }, [
    cargarNiveles,
    recuperarProcesoActivo,
  ]);


  // ===================================================
  // INICIAR NUEVO PROCESO
  // ===================================================

  const handleSelectTipo =
    useCallback(
      async (
        idTipoResiduo
      ) => {

        // =============================================
        // BLOQUEO DEL FRONTEND
        // =============================================

        if (
          hayProcesoUIActivo ||
          inicioProcesoEnCursoRef.current
        ) {
          return;
        }


        inicioProcesoEnCursoRef.current =
          true;


        try {

          // ===========================================
          // El único dato de negocio introducido
          // aquí es la selección del usuario.
          //
          // El backend vuelve a validarlo.
          // ===========================================

          await apiClient.post(
            "/control-dsh/registro-pesaje/iniciar",

            {
              id_tipo_residuo:
                idTipoResiduo,
            }
          );


          // ===========================================
          // PROCESO NUEVO
          //
          // El backend acaba de crearlo,
          // por lo tanto comienza en COSTO.
          // ===========================================

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

                /*
                 * No usamos los datos de
                 * la respuesta anterior.
                 *
                 * Consultamos nuevamente.
                 */
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


  // ===================================================
  // FOTO 2 → FOTO 3
  // ===================================================

  const handleOpenTotales =
    useCallback(() => {

      /*
       * ModalCosto solamente llega aquí
       * después de que el BACKEND confirmó
       * correctamente el costo.
       */

      setShowCosto(false);

      setShowTotales(true);

      setShowRecoleccion(false);

    }, []);


  // ===================================================
  // FOTO 3 → FOTO 4
  // ===================================================

  const handleShowRecoleccion =
    useCallback(() => {

      /*
       * Foto 3 llega aquí únicamente después
       * de que el backend guardó el cálculo.
       */

      setShowCosto(false);

      setShowTotales(false);

      setShowRecoleccion(true);

    }, []);


  // ===================================================
  // CANCELAR DESDE CUALQUIER FOTO
  // ===================================================

  const handleCancel =
    useCallback(async () => {

      await cancelarProcesoActual();

    }, [
      cancelarProcesoActual,
    ]);


  // ===================================================
  // FINALIZAR
  // ===================================================

  const handleFinish =
    useCallback(async () => {

      /*
       * Solo se ejecutará cuando Foto 4
       * confirme que backend finalizó.
       */

      resetFlujoUI();


      await showSuccessAlert(
        "Recolección guardada. Proceso finalizado."
      );


      await cargarNiveles();


    }, [
      cargarNiveles,
      resetFlujoUI,
    ]);


  // ===================================================
  // TARJETAS
  // ===================================================

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
                  nivel
                    .porcentaje
                ).toFixed(0)
              )

            : 0;


        const disabled =
          loading ||
          inicioProcesoEnCursoRef.current;


        return (

          <div
            key={
              tipo.id
            }

            className={
              `mb-4 residuo-card ${
                disabled
                  ? "opacity-75"
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

            onKeyDown={(
              event
            ) => {

              if (disabled) {
                return;
              }


              if (
                event.key ===
                  "Enter" ||
                event.key ===
                  " "
              ) {

                event.preventDefault();


                handleSelectTipo(
                  tipo.id
                );
              }
            }}

            role="button"

            tabIndex={
              disabled
                ? -1
                : 0
            }

            aria-disabled={
              disabled
            }
          >

            <div
              className="
                d-flex
                align-items-center
                mb-2
              "
            >

              <tipo.Icon
                className={
                  `${tipo.iconClass} me-2`
                }
              />


              <span
                className="fw-semibold"
              >

                {tipo.label}

              </span>

            </div>


            <div
              className="
                progress
                custom-progress
              "
            >

              <div
                className={
                  `progress-bar ${tipo.barClass} ${tipo.barTextClass}`
                }

                role="progressbar"

                style={{
                  width:
                    `${porcentaje}%`,
                }}

                aria-valuenow={
                  porcentaje
                }

                aria-valuemin="0"

                aria-valuemax="100"
              >

                {porcentaje}%

              </div>

            </div>


            {!nivel &&
              !loading && (

                <small
                  className="
                    text-muted
                    d-block
                    mt-2
                  "
                >

                  Sin datos
                  (contenedor no disponible o inactivo).

                </small>
              )}

          </div>
        );
      },

      [
        nivelesPorTipo,
        loading,
        handleSelectTipo,
      ]
    );


  // ===================================================
  // RENDER
  // ===================================================

  return (

    <div
      className="
        d-flex
        justify-content-start
        align-items-start
        p-4
        gap-5
      "
    >

      <div
        className="
          card
          shadow-sm
          border-0
          nuevo-registro-card
        "
      >

        <div
          className="
            card-body
            p-4
          "
        >

          <h4
            className="
              card-title
              d-flex
              align-items-center
              mb-4
            "
          >

            <FaChartLine
              className="
                text-primary
                me-2
              "
              size={24}
            />


            <span
              className="fw-bold"
            >

              Niveles de Residuos

            </span>

          </h4>


          {TIPOS.map(
            renderCard
          )}


          <div
            className="
              alert
              alert-info
              d-flex
              align-items-start
              mb-0
            "
          >

            <FaInfoCircle
              className="
                me-2
                mt-1
              "
            />


            <div>

              <strong>
                Información:
              </strong>{" "}

              Debe seleccionar uno de los desechos para el cálculo del pesaje.

            </div>

          </div>

        </div>

      </div>


      {/* ============================================= */}
      {/* FOTO 4                                      */}
      {/* ============================================= */}

      {showRecoleccion && (

        <div
          className="flex-grow-1"
        >

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


      {/* ============================================= */}
      {/* FOTO 2                                      */}
      {/* ============================================= */}

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


      {/* ============================================= */}
      {/* FOTO 3                                      */}
      {/* ============================================= */}

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
  );
};


export default NuevoRegistro;