import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  FaFilePdf,
  FaFileExcel,
  FaChartLine,
} from "react-icons/fa";

import FiltrosGraficasRecoleccion
  from "../../components/controlDSH/graficasrecoleccion/FiltrosGraficasRecoleccion";

import TarjetaGraficaRecoleccion
  from "../../components/controlDSH/graficasrecoleccion/TarjetaGraficaRecoleccion";

import {
  showBackendAlert,
  showWarningAlert,
} from "../../utils/alerts";

import {
  obtenerGraficasCuatrimestrales,
  obtenerPdfCuatrimestral,
  obtenerExcelCuatrimestral,
  normalizarErrorApi,
} from "../../services/graficasderecoleccion/GraficasRecoleccion.service";

import "../../styles/graficas-recoleccion.css";


/* =========================================================
   ESTADO INICIAL DE EXPORTACIÓN
   ========================================================= */

const INITIAL_EXPORT_STATE = {
  exportId: null,
  exportExpiresAt: null,
  exportExpiresInSeconds: null,
  exportDeadlineMs: null,
  exportExpired: false,
};


/* =========================================================
   DESCARGAR ARCHIVO
   ========================================================= */

function downloadBlob(
  blob,
  filename
) {

  const url =
    window.URL.createObjectURL(
      blob
    );


  const anchor =
    document.createElement(
      "a"
    );


  anchor.href = url;

  anchor.download =
    filename;


  document.body.appendChild(
    anchor
  );


  anchor.click();

  anchor.remove();


  window.setTimeout(
    () => {

      window.URL.revokeObjectURL(
        url
      );

    },
    5_000
  );
}


/* =========================================================
   ABRIR PDF
   ========================================================= */

function openPdfBlob(
  blob
) {

  const url =
    window.URL.createObjectURL(
      blob
    );


  const nuevaVentana =
    window.open(
      url,
      "_blank",
      "noopener,noreferrer"
    );


  if (
    !nuevaVentana
  ) {

    const anchor =
      document.createElement(
        "a"
      );


    anchor.href = url;

    anchor.target =
      "_blank";

    anchor.rel =
      "noopener noreferrer";


    document.body.appendChild(
      anchor
    );


    anchor.click();

    anchor.remove();
  }


  /*
   * No se revoca inmediatamente.
   * Chrome necesita mantener disponible
   * el blob mientras el visor PDF esté abierto.
   */
}


/* =========================================================
   ERROR DE SNAPSHOT
   ========================================================= */

function esErrorSnapshot(
  data
) {

  const codigo =
    data?.code ||
    data?.codigo ||
    null;


  return [
    "EXPORT_SNAPSHOT_EXPIRADO",
    "EXPORT_SNAPSHOT_INVALIDO",
    "EXPORT_ID_REQUIRED",
    "EXPORT_DATA_NOT_FOUND",
  ].includes(
    codigo
  );
}


/* =========================================================
   COMPONENTE
   ========================================================= */

const HistorialGrafica = () => {

  const [
    anio,
    setAnio,
  ] =
    useState("");


  const [
    cuatrimestre,
    setCuatrimestre,
  ] =
    useState("");


  const [
    graficas,
    setGraficas,
  ] =
    useState([]);


  const [
    filtrosAplicados,
    setFiltrosAplicados,
  ] =
    useState(null);


  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    loaded,
    setLoaded,
  ] =
    useState(false);


  const [
    sinDatos,
    setSinDatos,
  ] =
    useState(false);


  const [
    pdfLoading,
    setPdfLoading,
  ] =
    useState(false);


  const [
    excelLoading,
    setExcelLoading,
  ] =
    useState(false);


  const [
    exportState,
    setExportState,
  ] =
    useState(
      INITIAL_EXPORT_STATE
    );


  const pdfEnCursoRef =
    useRef(false);


  const excelEnCursoRef =
    useRef(false);


  const bloqueado =
    loading ||
    pdfLoading ||
    excelLoading;


  const filtrosCompletos =
    useMemo(
      () =>
        anio !== "" &&
        cuatrimestre !== "",
      [
        anio,
        cuatrimestre,
      ]
    );


  /* =======================================================
     LIMPIAR EXPORTACIÓN
     ======================================================= */

  const limpiarExportacion =
    useCallback(
      (
        {
          expired = false,
        } = {}
      ) => {

        setExportState({
          ...INITIAL_EXPORT_STATE,

          exportExpired:
            expired,
        });

      },
      []
    );


  /* =======================================================
     LIMPIAR RESULTADOS
     ======================================================= */

  const limpiarResultados =
    useCallback(
      () => {

        setGraficas([]);

        setFiltrosAplicados(
          null
        );

        setLoaded(false);

        setSinDatos(false);


        setExportState({
          ...INITIAL_EXPORT_STATE,
        });

      },
      []
    );


  /* =======================================================
     DETECTAR CAMBIO DE FILTROS
     ======================================================= */

  const filtrosKey =
    useMemo(
      () =>
        JSON.stringify({
          anio,
          cuatrimestre,
        }),
      [
        anio,
        cuatrimestre,
      ]
    );


  const prevFiltrosKeyRef =
    useRef(
      filtrosKey
    );


  useEffect(
    () => {

      if (
        prevFiltrosKeyRef.current ===
        filtrosKey
      ) {
        return;
      }


      prevFiltrosKeyRef.current =
        filtrosKey;


      limpiarResultados();

    },
    [
      filtrosKey,
      limpiarResultados,
    ]
  );


  /* =======================================================
     EXPORTACIÓN EXPIRADA
     ======================================================= */

  const notificarExportacionExpirada =
    useCallback(
      async () => {

        limpiarExportacion({
          expired: true,
        });


        await showWarningAlert(
          "El tiempo disponible para exportar venció. Presione 'Filtrar' nuevamente para habilitar PDF y Excel.",
          "Tiempo de exportación vencido"
        );

      },
      [
        limpiarExportacion,
      ]
    );


  /* =======================================================
     TEMPORIZADOR DE EXPORTACIÓN
     ======================================================= */

  useEffect(
    () => {

      if (
        !exportState.exportId ||
        !exportState.exportDeadlineMs
      ) {

        return undefined;
      }


      const tiempoRestante =
        exportState.exportDeadlineMs -
        Date.now();


      if (
        tiempoRestante <= 0
      ) {

        notificarExportacionExpirada();

        return undefined;
      }


      const timer =
        window.setTimeout(
          () => {

            notificarExportacionExpirada();

          },
          tiempoRestante
        );


      return () => {

        window.clearTimeout(
          timer
        );
      };

    },
    [
      exportState.exportId,
      exportState.exportDeadlineMs,
      notificarExportacionExpirada,
    ]
  );


  /* =======================================================
     CONFIGURAR REPORTE
     ======================================================= */

  const configurarReporte =
    useCallback(
      (
        response
      ) => {

        const exportId =
          response?.export_id ||
          null;


        const expiresAt =
          response?.export_expires_at ||
          null;


        const expiresInSeconds =
          Number(
            response
              ?.export_expires_in_seconds
          );


        let deadlineMs =
          null;


        if (
          Number.isFinite(
            expiresInSeconds
          ) &&
          expiresInSeconds > 0
        ) {

          deadlineMs =
            Date.now() +
            (
              expiresInSeconds *
              1000
            );

        } else if (
          expiresAt
        ) {

          const parsed =
            Date.parse(
              expiresAt
            );


          if (
            Number.isFinite(
              parsed
            )
          ) {

            deadlineMs =
              parsed;
          }
        }


        setExportState({

          exportId,

          exportExpiresAt:
            expiresAt,

          exportExpiresInSeconds:
            Number.isFinite(
              expiresInSeconds
            )
              ? expiresInSeconds
              : null,

          exportDeadlineMs:
            deadlineMs,

          exportExpired:
            false,
        });


        setGraficas(
          Array.isArray(
            response?.data
          )
            ? response.data
            : []
        );


        setFiltrosAplicados(
          response?.filtros ||
          null
        );


        setSinDatos(false);

        setLoaded(true);

      },
      []
    );


  /* =======================================================
     CONSULTAR GRÁFICAS
     ======================================================= */

  const obtenerGraficas =
    useCallback(
      async () => {

        if (
          !filtrosCompletos
        ) {

          await showWarningAlert(
            "Seleccione un año y un cuatrimestre antes de realizar la consulta.",
            "Campos obligatorios"
          );

          return;
        }


        if (
          loading
        ) {
          return;
        }


        setLoading(true);

        setGraficas([]);

        setFiltrosAplicados(
          null
        );

        setLoaded(false);

        setSinDatos(false);

        limpiarExportacion();


        try {

          const response =
            await obtenerGraficasCuatrimestrales({
              anio,
              cuatrimestre,
            });


          if (
            response?.success !==
            true
          ) {

            await showBackendAlert({

              status: 400,

              data:
                response || {
                  message:
                    "No fue posible consultar las gráficas.",
                },
            });


            return;
          }


          if (
            response?.hay_datos ===
            false
          ) {

            setGraficas([]);


            setFiltrosAplicados(
              response?.filtros ||
              null
            );


            setSinDatos(true);

            setLoaded(true);

            limpiarExportacion();


            await showWarningAlert(
              response?.message ||
                "No se encontraron registros de recolección para los filtros seleccionados.",
              "Sin registros"
            );


            return;
          }


          configurarReporte(
            response
          );


        } catch (
          error
        ) {

          console.error(
            "Error obteniendo gráficas de recolección:",
            error
          );


          const errorHttp =
            await normalizarErrorApi(
              error
            );


          await showBackendAlert({

            status:
              errorHttp.status,

            data:
              errorHttp.data,
          });


        } finally {

          setLoading(false);
        }

      },
      [
        anio,
        cuatrimestre,
        filtrosCompletos,
        loading,
        limpiarExportacion,
        configurarReporte,
      ]
    );


  /* =======================================================
     FILTRAR
     ======================================================= */

  const handleFiltrar =
    useCallback(
      () => {

        obtenerGraficas();

      },
      [
        obtenerGraficas,
      ]
    );


  /* =======================================================
     PDF
     ======================================================= */

  const onExportPdf =
    useCallback(
      async () => {

        if (
          pdfEnCursoRef.current
        ) {
          return;
        }


        if (
          !loaded ||
          !exportState.exportId
        ) {

          if (
            exportState.exportExpired
          ) {

            await showWarningAlert(
              "El tiempo disponible para exportar venció. Presione 'Filtrar' nuevamente.",
              "Tiempo de exportación vencido"
            );

          } else {

            await showWarningAlert(
              "Realice una consulta con resultados antes de exportar.",
              "Exportación no disponible"
            );
          }


          return;
        }


        pdfEnCursoRef.current =
          true;


        setPdfLoading(true);


        try {

          const blob =
            await obtenerPdfCuatrimestral(
              exportState.exportId
            );


          openPdfBlob(
            blob
          );


        } catch (
          error
        ) {

          console.error(
            "Error exportando PDF cuatrimestral:",
            error
          );


          const errorHttp =
            await normalizarErrorApi(
              error
            );


          if (
            esErrorSnapshot(
              errorHttp.data
            )
          ) {

            limpiarExportacion({

              expired:
                errorHttp
                  ?.data
                  ?.code ===
                "EXPORT_SNAPSHOT_EXPIRADO",
            });
          }


          await showBackendAlert({

            status:
              errorHttp.status,

            data:
              errorHttp.data,
          });


        } finally {

          pdfEnCursoRef.current =
            false;


          setPdfLoading(false);
        }

      },
      [
        loaded,
        exportState.exportId,
        exportState.exportExpired,
        limpiarExportacion,
      ]
    );


  /* =======================================================
     EXCEL
     ======================================================= */

  const onExportExcel =
    useCallback(
      async () => {

        if (
          excelEnCursoRef.current
        ) {
          return;
        }


        if (
          !loaded ||
          !exportState.exportId
        ) {

          if (
            exportState.exportExpired
          ) {

            await showWarningAlert(
              "El tiempo disponible para exportar venció. Presione 'Filtrar' nuevamente.",
              "Tiempo de exportación vencido"
            );

          } else {

            await showWarningAlert(
              "Realice una consulta con resultados antes de exportar.",
              "Exportación no disponible"
            );
          }


          return;
        }


        excelEnCursoRef.current =
          true;


        setExcelLoading(true);


        try {

          const blob =
            await obtenerExcelCuatrimestral(
              exportState.exportId
            );


          const anioArchivo =
            filtrosAplicados?.anio ||
            "reporte";


          const cuatrimestreArchivo =
            filtrosAplicados?.cuatrimestre ||
            "";


          downloadBlob(
            blob,
            `recoleccion_${anioArchivo}_cuatrimestre_${cuatrimestreArchivo}.xlsx`
          );


        } catch (
          error
        ) {

          console.error(
            "Error exportando Excel cuatrimestral:",
            error
          );


          const errorHttp =
            await normalizarErrorApi(
              error
            );


          if (
            esErrorSnapshot(
              errorHttp.data
            )
          ) {

            limpiarExportacion({

              expired:
                errorHttp
                  ?.data
                  ?.code ===
                "EXPORT_SNAPSHOT_EXPIRADO",
            });
          }


          await showBackendAlert({

            status:
              errorHttp.status,

            data:
              errorHttp.data,
          });


        } finally {

          excelEnCursoRef.current =
            false;


          setExcelLoading(false);
        }

      },
      [
        loaded,
        exportState.exportId,
        exportState.exportExpired,
        filtrosAplicados,
        limpiarExportacion,
      ]
    );


  /* =======================================================
     EXPORTACIÓN DISPONIBLE
     ======================================================= */

  const exportDisponible =
    loaded &&
    !sinDatos &&
    Boolean(
      exportState.exportId
    ) &&
    !exportState.exportExpired;


  /* =======================================================
     RENDER
     ======================================================= */

  return (

    <main className="system-page graficas-recoleccion-page">

      <div className="system-container">

        {/* =================================================
            CABECERA
        ================================================= */}

        <header className="graficas-page-header">

          <div className="graficas-page-title">

            <FaChartLine />

            <div>

              <h1 className="system-title">
                Historial Gráfico de Recolección
              </h1>

              <p className="system-subtitle">
                Consulte el comportamiento de la
                recolección por año y cuatrimestre.
              </p>

            </div>

          </div>


          {/* ===============================================
              EXPORTACIONES
          =============================================== */}

          {exportDisponible && (

            <div className="graficas-export-actions">

              <button
                type="button"
                className="app-btn app-btn-danger"
                onClick={
                  onExportPdf
                }
                disabled={
                  bloqueado
                }
              >

                {pdfLoading ? (

                  <>

                    <span
                      className="system-spinner system-spinner-small"
                      aria-hidden="true"
                    />

                    <span>
                      PDF...
                    </span>

                  </>

                ) : (

                  <>

                    <FaFilePdf />

                    <span>
                      PDF
                    </span>

                  </>

                )}

              </button>


              <button
                type="button"
                className="app-btn app-btn-success"
                onClick={
                  onExportExcel
                }
                disabled={
                  bloqueado
                }
              >

                {excelLoading ? (

                  <>

                    <span
                      className="system-spinner system-spinner-small"
                      aria-hidden="true"
                    />

                    <span>
                      Excel...
                    </span>

                  </>

                ) : (

                  <>

                    <FaFileExcel />

                    <span>
                      Excel
                    </span>

                  </>

                )}

              </button>

            </div>

          )}

        </header>


        {/* =================================================
            FILTROS
        ================================================= */}

        <FiltrosGraficasRecoleccion

          anio={
            anio
          }

          cuatrimestre={
            cuatrimestre
          }

          setAnio={
            setAnio
          }

          setCuatrimestre={
            setCuatrimestre
          }

          onFiltrar={
            handleFiltrar
          }

          loading={
            bloqueado
          }
        />


        {/* =================================================
            CARGANDO
        ================================================= */}

        {loading && (

          <div className="graficas-loading">

            <span
              className="system-spinner"
              aria-hidden="true"
            />

            <p>
              Consultando información...
            </p>

          </div>

        )}


        {/* =================================================
            RESULTADOS
        ================================================= */}

        {!loading &&
        loaded &&
        !sinDatos &&
        graficas.length > 0 && (

          <section className="graficas-results-grid">

            {graficas.map(
              (item) => (

                <TarjetaGraficaRecoleccion
                  key={
                    item.mes
                  }
                  data={
                    item
                  }
                />

              )
            )}

          </section>

        )}

      </div>

    </main>
  );
};


export default HistorialGrafica;