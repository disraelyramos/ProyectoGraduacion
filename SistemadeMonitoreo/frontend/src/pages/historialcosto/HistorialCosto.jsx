import React, {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Card,
  Row,
  Col,
  Button,
  Spinner,
} from "react-bootstrap";

import {
  FaSearch,
  FaFilePdf,
  FaFileExcel,
} from "react-icons/fa";


import FiltroCostos
  from "../../components/historialcosto/FiltroCostos";

import ResumenKpis
  from "../../components/historialcosto/ResumenKpis";

import TablaResumen
  from "../../components/historialcosto/TablaResumen";

import PanelRankings
  from "../../components/historialcosto/PanelRankings";


import {
  showBackendAlert,
  showWarningAlert,
} from "../../utils/alerts";


import {
  obtenerDistritos,
  obtenerEmpresas,
  obtenerContenedores,
  obtenerReporteCostos,
  obtenerPdfCostos,
  obtenerExcelCostos,
  normalizarErrorApi,
} from "../../services/historialcosto/HistorialCosto.service";


const TablaDetalle =
  lazy(
    () =>
      import(
        "../../components/historialcosto/TablaDetalle"
      )
  );


/* =========================================================
   CONSTANTES
   ========================================================= */

const DEFAULT_DETALLE = {
  total: 0,
  page: 1,
  limit: 10,
  rows: [],
};


const INITIAL_DATA = {
  exportId:
    null,

  exportExpiresAt:
    null,

  exportExpiresInSeconds:
    null,

  exportDeadlineMs:
    null,

  exportExpired:
    false,

  filtros:
    null,

  kpis:
    null,

  resumen:
    [],

  topContenedores:
    [],

  detalle:
    DEFAULT_DETALLE,
};


/* =========================================================
   DESCARGAR BLOB
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


  anchor.href =
    url;

  anchor.download =
    filename;


  document.body.appendChild(
    anchor
  );


  anchor.click();
  anchor.remove();


  window.URL.revokeObjectURL(
    url
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


  /*
    Si el navegador bloquea la pestaña nueva,
    utilizamos un enlace como respaldo.
  */

  if (!nuevaVentana) {
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
    No se revoca inmediatamente porque el navegador necesita
    tiempo para cargar el PDF.
  */

  setTimeout(
    () => {
      window.URL.revokeObjectURL(
        url
      );
    },
    60_000
  );
}


/* =========================================================
   NORMALIZAR ARRAY
   ========================================================= */

function arraySeguro(
  valor
) {
  return Array.isArray(
    valor
  )
    ? valor
    : [];
}


/* =========================================================
   DETECTAR ERRORES QUE INVALIDAN SNAPSHOT
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
  ].includes(
    codigo
  );
}


/* =========================================================
   COMPONENTE
   ========================================================= */

const HistorialCosto =
  () => {

    /* =====================================================
       FORMULARIO
       ===================================================== */

    const [
      form,
      setForm,
    ] =
      useState({
        fechaInicio:
          "",

        fechaFin:
          "",

        agruparPor:
          "mes",

        distritoId:
          "",

        empresaId:
          "",

        contenedorId:
          "",
      });


    /* =====================================================
       ESTADOS DE CARGA
       ===================================================== */

    const [
      loading,
      setLoading,
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
      loaded,
      setLoaded,
    ] =
      useState(false);


    const [
      catalogLoading,
      setCatalogLoading,
    ] =
      useState(false);


    /* =====================================================
       CATÁLOGOS
       ===================================================== */

    const [
      catalogos,
      setCatalogos,
    ] =
      useState({
        distritos:
          [],

        empresas:
          [],

        contenedores:
          [],

        contenedoresLoading:
          false,
      });


    /* =====================================================
       DATOS DEL REPORTE
       ===================================================== */

    const [
      data,
      setData,
    ] =
      useState(
        INITIAL_DATA
      );


    /* =====================================================
       PROTECCIÓN CONTRA DOBLE EXPORTACIÓN
       ===================================================== */

    const pdfEnCursoRef =
      useRef(false);


    const excelEnCursoRef =
      useRef(false);


    /* =====================================================
       FILTROS COMPLETOS

       Validación visual únicamente.

       Backend sigue siendo quien valida:
       - semana
       - mes
       - año
       - fechas
       - IDs
       - paginación
       ===================================================== */

    const canSearch =
      useMemo(
        () =>
          Boolean(
            form.fechaInicio &&
            form.fechaFin &&
            form.distritoId &&
            form.empresaId &&
            form.contenedorId
          ),
        [
          form.fechaInicio,
          form.fechaFin,
          form.distritoId,
          form.empresaId,
          form.contenedorId,
        ]
      );


    /* =====================================================
       ESTADO GENERAL DE INTERFAZ
       ===================================================== */

    const bloqueado =
      loading ||
      pdfLoading ||
      excelLoading;


    /* =====================================================
       LIMPIAR EXPORTACIÓN
       ===================================================== */

    const limpiarExportacion =
      useCallback(
        (
          {
            expired = false,
          } = {}
        ) => {

          setData(
            (prev) => ({
              ...prev,

              exportId:
                null,

              exportExpiresAt:
                null,

              exportExpiresInSeconds:
                null,

              exportDeadlineMs:
                null,

              exportExpired:
                expired,
            })
          );

        },
        []
      );


    /* =====================================================
       ALERTA DE EXPORTACIÓN VENCIDA

       Utilizamos el mismo SweetAlert2 del sistema.

       Cuando vence:
       - eliminamos exportId
       - PDF queda deshabilitado
       - Excel queda deshabilitado
       - mostramos alerta
       ===================================================== */

    const notificarExportacionExpirada =
      useCallback(
        () => {

          limpiarExportacion({
            expired:
              true,
          });


          showWarningAlert(
            "El tiempo disponible para exportar venció. Presione 'Ver' nuevamente para habilitar PDF y Excel.",
            "Tiempo de exportación vencido"
          );

        },
        [
          limpiarExportacion,
        ]
      );


    /* =====================================================
       LIMPIAR TODO EL REPORTE
       ===================================================== */

    const limpiarResultados =
      useCallback(
        () => {

          setLoaded(
            false
          );


          setData({
            ...INITIAL_DATA,

            detalle: {
              ...DEFAULT_DETALLE,
            },
          });

        },
        []
      );


    /* =====================================================
       SI CAMBIAN FILTROS

       El resultado anterior ya no representa los filtros
       visibles.

       Por eso:
       - ocultamos tablas
       - eliminamos snapshot
       - bloqueamos PDF/Excel
       ===================================================== */

    const filtrosKey =
      useMemo(
        () =>
          JSON.stringify(
            form
          ),
        [
          form,
        ]
      );


    const prevKeyRef =
      useRef(
        filtrosKey
      );


    useEffect(
      () => {

        if (
          prevKeyRef.current ===
          filtrosKey
        ) {
          return;
        }


        prevKeyRef.current =
          filtrosKey;


        limpiarResultados();

      },
      [
        filtrosKey,
        limpiarResultados,
      ]
    );


    /* =====================================================
       VENCIMIENTO VISUAL DEL SNAPSHOT

       Backend sigue siendo la autoridad real.

       Frontend controla únicamente la experiencia visual.

       Al vencer:
       - limpia exportId
       - bloquea PDF/Excel
       - muestra SweetAlert2
       ===================================================== */

    useEffect(
      () => {

        if (
          !data.exportId ||
          !data.exportDeadlineMs
        ) {
          return undefined;
        }


        const tiempoRestante =
          data.exportDeadlineMs -
          Date.now();


        /*
          Si cuando React procesa el estado el snapshot
          ya estaba vencido.
        */

        if (
          tiempoRestante <= 0
        ) {
          notificarExportacionExpirada();

          return undefined;
        }


        /*
          Programamos exactamente el momento de vencimiento.
        */

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
        data.exportId,
        data.exportDeadlineMs,
        notificarExportacionExpirada,
      ]
    );


    /* =====================================================
       CARGAR DISTRITOS Y EMPRESAS
       ===================================================== */

    useEffect(
      () => {

        let activo =
          true;


        const cargar =
          async () => {

            setCatalogLoading(
              true
            );


            try {

              const [
                distritosResponse,
                empresasResponse,
              ] =
                await Promise.all([
                  obtenerDistritos(),
                  obtenerEmpresas(),
                ]);


              if (!activo) {
                return;
              }


              setCatalogos(
                (prev) => ({
                  ...prev,

                  distritos:
                    arraySeguro(
                      distritosResponse
                    ),

                  empresas:
                    arraySeguro(
                      empresasResponse
                    ),
                })
              );

            } catch (
              error
            ) {

              console.error(
                "Error cargando catálogos de costos:",
                error
              );


              if (!activo) {
                return;
              }


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

              if (activo) {
                setCatalogLoading(
                  false
                );
              }

            }
          };


        cargar();


        return () => {

          activo =
            false;

        };

      },
      []
    );


    /* =====================================================
       CARGAR CONTENEDORES
       ===================================================== */

    useEffect(
      () => {

        let activo =
          true;


        const cargar =
          async () => {

            setCatalogos(
              (prev) => ({
                ...prev,

                contenedoresLoading:
                  true,
              })
            );


            try {

              const response =
                await obtenerContenedores({
                  search:
                    "",

                  page:
                    1,

                  limit:
                    50,
                });


              if (!activo) {
                return;
              }


              const rows =
                response?.data ||
                response?.rows ||
                response ||
                [];


              setCatalogos(
                (prev) => ({
                  ...prev,

                  contenedores:
                    arraySeguro(
                      rows
                    ),
                })
              );

            } catch (
              error
            ) {

              console.error(
                "Error cargando contenedores:",
                error
              );


              if (!activo) {
                return;
              }


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

              if (activo) {

                setCatalogos(
                  (prev) => ({
                    ...prev,

                    contenedoresLoading:
                      false,
                  })
                );

              }

            }
          };


        cargar();


        return () => {

          activo =
            false;

        };

      },
      []
    );


    /* =====================================================
       CONSTRUIR PARÁMETROS

       Solo enviamos criterios al backend.

       No enviamos:
       - KPIs
       - totales
       - nombres
       - exportId inventado
       - datos del PDF
       - datos del Excel
       ===================================================== */

    const buildParams =
      useCallback(
        (
          {
            page = 1,
            limit,
          } = {}
        ) => ({
          fechaInicio:
            form.fechaInicio,

          fechaFin:
            form.fechaFin,

          agruparPor:
            form.agruparPor,

          distritoId:
            form.distritoId,

          empresaId:
            form.empresaId,

          contenedorId:
            form.contenedorId,

          page,

          limit:
            limit ||
            data.detalle?.limit ||
            10,

          order:
            "desc",
        }),
        [
          form,
          data.detalle?.limit,
        ]
      );


    /* =====================================================
       CONFIGURAR RESPUESTA DEL BACKEND
       ===================================================== */

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


          /*
            Para UX usamos primero el TTL relativo.

            Así no dependemos de que el reloj del equipo
            del usuario esté exactamente sincronizado.
          */

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


          setData({
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

            filtros:
              response?.filtros ||
              null,

            kpis:
              response?.kpis ||
              null,

            resumen:
              arraySeguro(
                response?.resumen
              ),

            topContenedores:
              arraySeguro(
                response?.topContenedores
              ),

            detalle: {
              total:
                Number(
                  response
                    ?.detalle
                    ?.total ||
                  0
                ),

              page:
                Number(
                  response
                    ?.detalle
                    ?.page ||
                  1
                ),

              limit:
                Number(
                  response
                    ?.detalle
                    ?.limit ||
                  10
                ),

              rows:
                arraySeguro(
                  response
                    ?.detalle
                    ?.rows
                ),
            },
          });


          setLoaded(
            true
          );

        },
        []
      );


    /* =====================================================
       CONSULTAR REPORTE
       ===================================================== */

    const fetchReporte =
      useCallback(
        async (
          {
            page = 1,
            nuevaBusqueda = false,
          } = {}
        ) => {

          if (!canSearch) {

            await showWarningAlert(
              "Complete todos los filtros antes de consultar el reporte."
            );

            return;

          }


          if (loading) {
            return;
          }


          setLoading(
            true
          );


          try {

            const params =
              buildParams({
                page,
              });


            const response =
              await obtenerReporteCostos(
                params
              );


            configurarReporte(
              response
            );

          } catch (
            error
          ) {

            console.error(
              "Error obteniendo reporte de costos:",
              error
            );


            const errorHttp =
              await normalizarErrorApi(
                error
              );


            /*
              Si era una búsqueda nueva nunca dejamos
              información de una consulta anterior visible.
            */

            if (
              nuevaBusqueda
            ) {

              limpiarResultados();

            }


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
          canSearch,
          loading,
          buildParams,
          configurarReporte,
          limpiarResultados,
        ]
      );


    /* =====================================================
       BOTÓN VER
       ===================================================== */

    const handleVer =
      useCallback(
        async () => {

          await fetchReporte({
            page:
              1,

            nuevaBusqueda:
              true,
          });

        },
        [
          fetchReporte,
        ]
      );


    /* =====================================================
       CAMBIAR PÁGINA
       ===================================================== */

    const handlePageChange =
      useCallback(
        async (
          nextPage
        ) => {

          if (
            loading
          ) {
            return;
          }


          await fetchReporte({
            page:
              nextPage,

            nuevaBusqueda:
              false,
          });

        },
        [
          fetchReporte,
          loading,
        ]
      );


    /* =====================================================
       EXPORTAR PDF
       ===================================================== */

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
            !data.exportId
          ) {

            if (
              data.exportExpired
            ) {

              await showWarningAlert(
                "El tiempo disponible para exportar venció. Presione 'Ver' nuevamente para habilitar PDF y Excel.",
                "Tiempo de exportación vencido"
              );

            } else {

              await showWarningAlert(
                "Primero presione 'Ver' para generar el reporte."
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
              await obtenerPdfCostos(
                data.exportId
              );


            openPdfBlob(
              blob
            );

          } catch (
            error
          ) {

            console.error(
              "Error exportando PDF:",
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
          data.exportId,
          data.exportExpired,
          limpiarExportacion,
        ]
      );


    /* =====================================================
       EXPORTAR EXCEL
       ===================================================== */

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
            !data.exportId
          ) {

            if (
              data.exportExpired
            ) {

              await showWarningAlert(
                "El tiempo disponible para exportar venció. Presione 'Ver' nuevamente para habilitar PDF y Excel.",
                "Tiempo de exportación vencido"
              );

            } else {

              await showWarningAlert(
                "Primero presione 'Ver' para generar el reporte."
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
              await obtenerExcelCostos(
                data.exportId
              );


            downloadBlob(
              blob,
              `reporte_costos_${data.exportId}.xlsx`
            );

          } catch (
            error
          ) {

            console.error(
              "Error exportando Excel:",
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
          data.exportId,
          data.exportExpired,
          limpiarExportacion,
        ]
      );


    /* =====================================================
       EXPORTACIÓN DISPONIBLE
       ===================================================== */

    const exportDisponible =
      loaded &&
      Boolean(
        data.exportId
      ) &&
      !data.exportExpired;


    /* =====================================================
       RENDER
       ===================================================== */

    return (
      <div className="p-3">

        <Card className="shadow-sm">

          <Card.Body>

            {/* ===========================================
                ENCABEZADO
                =========================================== */}

            <Row className="align-items-center">

              <Col>

                <h4 className="mb-0">
                  Reporte de Costos
                </h4>

                <small className="text-muted">
                  Control DSH
                </small>

              </Col>


              <Col
                xs="auto"
                className="d-flex gap-2 flex-wrap"
              >

                {/* =======================================
                    VER
                    ======================================= */}

                <Button
                  variant="success"

                  onClick={
                    handleVer
                  }

                  disabled={
                    !canSearch ||
                    bloqueado
                  }
                >

                  {loading ? (
                    <>
                      <Spinner
                        size="sm"
                        className="me-2"
                      />

                      Cargando...
                    </>
                  ) : (
                    <>
                      <FaSearch className="me-2" />

                      Ver
                    </>
                  )}

                </Button>


                {/* =======================================
                    PDF
                    ======================================= */}

                <Button
                  variant="danger"

                  onClick={
                    onExportPdf
                  }

                  disabled={
                    !exportDisponible ||
                    bloqueado
                  }
                >

                  {pdfLoading ? (
                    <>
                      <Spinner
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


                {/* =======================================
                    EXCEL
                    ======================================= */}

                <Button
                  variant="success"

                  onClick={
                    onExportExcel
                  }

                  disabled={
                    !exportDisponible ||
                    bloqueado
                  }
                >

                  {excelLoading ? (
                    <>
                      <Spinner
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

              </Col>

            </Row>


            <hr />


            {/* ===========================================
                FILTROS
                =========================================== */}

            <FiltroCostos
              value={
                form
              }

              onChange={
                setForm
              }

              disabled={
                bloqueado
              }

              distritos={
                catalogos.distritos
              }

              empresas={
                catalogos.empresas
              }

              contenedores={
                catalogos.contenedores
              }

              catalogLoading={
                catalogLoading
              }

              contenedoresLoading={
                catalogos.contenedoresLoading
              }
            />


            {/* ===========================================
                RESULTADOS
                =========================================== */}

            {!loaded ? null : (
              <>

                <ResumenKpis
                  kpis={
                    data.kpis
                  }
                />


                <Row className="mt-3 g-3">

                  <Col lg={8}>

                    <TablaResumen
                      agruparPor={
                        data
                          ?.filtros
                          ?.agruparPor ||
                        form.agruparPor
                      }

                      rows={
                        data.resumen
                      }
                    />

                  </Col>


                  <Col lg={4}>

                    <PanelRankings
                      topContenedores={
                        data.topContenedores
                      }
                    />

                  </Col>

                </Row>


                <Row className="mt-3">

                  <Col>

                    <Suspense
                      fallback={
                        <Card className="shadow-sm">

                          <Card.Body className="d-flex align-items-center gap-2">

                            <Spinner size="sm" />

                            <span>
                              Cargando tabla de detalle...
                            </span>

                          </Card.Body>

                        </Card>
                      }
                    >

                      <TablaDetalle
                        detalle={
                          data.detalle
                        }

                        loading={
                          loading
                        }

                        onPageChange={
                          handlePageChange
                        }
                      />

                    </Suspense>

                  </Col>

                </Row>

              </>
            )}

          </Card.Body>

        </Card>

      </div>
    );
  };


export default HistorialCosto;