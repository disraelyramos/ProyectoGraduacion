import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Row,
  Col,
  Spinner,
  Button,
} from "react-bootstrap";

import {
  FaFilePdf,
  FaFileExcel,
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


const INITIAL_EXPORT_STATE = {
  exportId: null,
  exportExpiresAt: null,
  exportExpiresInSeconds: null,
  exportDeadlineMs: null,
  exportExpired: false,
};


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


  anchor.href =
    url;

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


    anchor.href =
      url;

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
    No revocar el Object URL del PDF aquí.

    Chrome necesita conservar el blob mientras la pestaña
    del visor PDF permanezca abierta para que su botón
    interno "Descargar" pueda guardar el documento.
  */
}


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


const HistorialGrafica =
  () => {

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


    const limpiarResultados =
      useCallback(
        () => {

          setGraficas(
            []
          );


          setFiltrosAplicados(
            null
          );


          setLoaded(
            false
          );


          setSinDatos(
            false
          );


          setExportState({
            ...INITIAL_EXPORT_STATE,
          });

        },
        []
      );


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


          setSinDatos(
            false
          );


          setLoaded(
            true
          );

        },
        []
      );


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


          setLoading(
            true
          );


          setGraficas(
            []
          );


          setFiltrosAplicados(
            null
          );


          setLoaded(
            false
          );


          setSinDatos(
            false
          );


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
                status:
                  400,

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
              setGraficas(
                []
              );


              setFiltrosAplicados(
                response?.filtros ||
                null
              );


              setSinDatos(
                true
              );


              setLoaded(
                true
              );


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

            setLoading(
              false
            );

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


    const handleFiltrar =
      useCallback(
        () => {

          obtenerGraficas();

        },
        [
          obtenerGraficas,
        ]
      );


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


          setPdfLoading(
            true
          );


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


            setPdfLoading(
              false
            );

          }

        },
        [
          loaded,
          exportState.exportId,
          exportState.exportExpired,
          limpiarExportacion,
        ]
      );


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


          setExcelLoading(
            true
          );


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


            setExcelLoading(
              false
            );

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


    const exportDisponible =
      loaded &&
      !sinDatos &&
      Boolean(
        exportState.exportId
      ) &&
      !exportState.exportExpired;


    return (
      <div className="container mt-4">

        <div
          className="
            d-flex
            flex-wrap
            align-items-center
            justify-content-between
            gap-2
          "
        >

          <h4 className="mb-0">

            <i className="bi bi-bar-chart-line me-2" />

            Historial Gráfico de Recolección

          </h4>


          {exportDisponible ? (

            <div className="d-flex gap-2">

              <Button
                variant="danger"
                onClick={
                  onExportPdf
                }
                disabled={
                  bloqueado
                }
              >

                {pdfLoading ? (
                  <>
                    <Spinner
                      animation="border"
                      size="sm"
                      className="me-2"
                    />

                    PDF...
                  </>
                ) : (
                  <>
                    <FaFilePdf className="me-2" />

                    PDF
                  </>
                )}

              </Button>


              <Button
                variant="success"
                onClick={
                  onExportExcel
                }
                disabled={
                  bloqueado
                }
              >

                {excelLoading ? (
                  <>
                    <Spinner
                      animation="border"
                      size="sm"
                      className="me-2"
                    />

                    Excel...
                  </>
                ) : (
                  <>
                    <FaFileExcel className="me-2" />

                    Excel
                  </>
                )}

              </Button>

            </div>

          ) : null}

        </div>


        <hr />


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


        {loading ? (

          <div className="text-center my-4">

            <Spinner
              animation="border"
            />


            <div className="text-muted mt-2">
              Consultando información...
            </div>

          </div>

        ) : null}


        {!loading &&
        loaded &&
        !sinDatos &&
        graficas.length > 0 ? (

          <Row className="mt-3">

            {graficas.map(
              (
                item
              ) => (

                <Col
                  md={12}
                  lg={6}
                  className="mb-4"
                  key={
                    item.mes
                  }
                >

                  <TarjetaGraficaRecoleccion
                    data={
                      item
                    }
                  />

                </Col>

              )
            )}

          </Row>

        ) : null}

      </div>
    );
  };


export default HistorialGrafica;