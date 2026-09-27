import React, {
  useEffect,
  useState,
} from "react";

import {
  Card,
  ProgressBar,
  Spinner,
  Button,
} from "react-bootstrap";

import {
  FaBiohazard,
  FaSyringe,
  FaChartBar,
  FaSyncAlt,
  FaInfoCircle,
} from "react-icons/fa";

import apiClient from "../../utils/apiClient";

import {
  showBackendAlert,
} from "../../utils/alerts";

import "bootstrap/dist/css/bootstrap.min.css";


// ======================================================
// CONFIGURACIÓN
// ======================================================

const NIVEL_REFRESH_INTERVAL_MS =
  Number(
    import.meta.env.VITE_NIVEL_REFRESH_INTERVAL_MS
  ) > 0
    ? Number(
        import.meta.env.VITE_NIVEL_REFRESH_INTERVAL_MS
      )
    : 3000;


// ======================================================
// TIPOS DE RESIDUOS
// ======================================================

const TIPOS = [
  {
    id: 1,
    nombre: "Bioinfeccioso",
    Icono: FaBiohazard,
  },
  {
    id: 2,
    nombre: "Punzocortante",
    Icono: FaSyringe,
  },
];


// ======================================================
// FORMATO DE FECHA
// ======================================================

function formatearFecha(valor) {

  if (!valor) {
    return "No disponible";
  }

  const fecha = new Date(valor);

  if (Number.isNaN(fecha.getTime())) {
    return "No disponible";
  }

  return fecha.toLocaleString(
    "es-GT",
    {
      timeZone: "America/Guatemala",
      dateStyle: "short",
      timeStyle: "medium",
    }
  );
}


// ======================================================
// CONSTRUIR DATOS DE CONSULTA
// ======================================================

function construirNiveles(contenedores) {

  if (!Array.isArray(contenedores)) {

    throw new Error(
      "El servidor devolvió información de contenedores no válida."
    );
  }

  const niveles = {
    1: null,
    2: null,
  };

  for (const contenedor of contenedores) {

    const tipoId = Number(
      contenedor?.id_tipo_residuo
    );

    if (
      tipoId !== 1 &&
      tipoId !== 2
    ) {
      continue;
    }

    // El listado del backend viene ordenado.
    // Conservamos el primer contenedor de cada tipo.
    if (niveles[tipoId] !== null) {
      continue;
    }

    niveles[tipoId] = {
      codigo:
        contenedor.codigo || "Sin código",

      disponible:
        contenedor.nivel_disponible === true,

      porcentaje:
        contenedor.porcentaje_llenado,

      actualizadoEn:
        contenedor.nivel_actualizado_en,
    };
  }

  return niveles;
}


// ======================================================
// COMPONENTE
// ======================================================

const ConsultaNiveles = () => {

  const [
    niveles,
    setNiveles,
  ] = useState({
    1: null,
    2: null,
  });

  const [
    cargando,
    setCargando,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");


  // ====================================================
  // CONSULTAR CACHÉ DEL BACKEND
  // ====================================================

  useEffect(() => {

    let activo = true;

    let consultando = false;


    const cargarNiveles = async (
      silencioso = false
    ) => {

      // Evitar peticiones simultáneas.
      if (consultando) {
        return;
      }

      consultando = true;

      if (!silencioso) {
        setCargando(true);
      }

      try {

        const response =
          await apiClient.get(
            "/contenedores"
          );

        const resultado =
          construirNiveles(
            response.data
          );

        if (!activo) {
          return;
        }

        setNiveles(resultado);

        setError("");


      } catch (err) {

        if (!activo) {
          return;
        }

        /*
         * apiClient ya muestra la alerta
         * centralizada de sesión caducada.
         *
         * No abrimos un segundo modal.
         */
        if (
          err?.response?.status === 401
        ) {
          return;
        }

        console.error(
          "Error consultando niveles:",
          err
        );

        setError(
          "No fue posible actualizar los niveles de los contenedores."
        );

        /*
         * Las actualizaciones automáticas
         * no muestran modales repetidos
         * cada tres segundos.
         */
        if (!silencioso) {

          await showBackendAlert({

            status:
              err?.response?.status || 500,

            data:
              err?.response?.data || {
                message:
                  err.message ||
                  "No fue posible consultar los niveles.",
              },

          });

        }


      } finally {

        consultando = false;

        if (
          activo &&
          !silencioso
        ) {
          setCargando(false);
        }

      }

    };


    // Carga inicial.
    cargarNiveles();


    // Actualización periódica.
    const intervalo = setInterval(
      () => {

        if (document.hidden) {
          return;
        }

        cargarNiveles(true);

      },
      NIVEL_REFRESH_INTERVAL_MS
    );


    // Actualizar al regresar a la pestaña.
    const actualizarAlVolver = () => {

      if (!document.hidden) {
        cargarNiveles(true);
      }

    };


    document.addEventListener(
      "visibilitychange",
      actualizarAlVolver
    );


    return () => {

      activo = false;

      clearInterval(intervalo);

      document.removeEventListener(
        "visibilitychange",
        actualizarAlVolver
      );

    };

  }, []);


  // ======================================================
  // RENDER
  // ======================================================

  return (

    <section className="container-fluid px-3 px-md-4 py-4">

      <div className="container-xl">


        {/* ============================================
            ENCABEZADO
        ============================================ */}

        <div className="mb-4">

          <h3 className="fw-bold d-flex align-items-center gap-2">

            <FaChartBar className="text-primary" />

            Consulta de niveles de llenado

          </h3>

          <p className="text-muted mb-0">

            Estado actual de los contenedores
            del Sistema Bioinfeccioso.

          </p>

        </div>


        {/* ============================================
            CARGA INICIAL
        ============================================ */}

        {cargando && (

          <div
            className="d-flex align-items-center gap-2 mb-4"
            role="status"
          >

            <Spinner
              animation="border"
              size="sm"
            />

            Consultando niveles...

          </div>

        )}


        {/* ============================================
            ERROR DE ACTUALIZACIÓN
        ============================================ */}

        {error && (

          <div
            className="alert alert-warning"
            role="status"
          >

            {error}

            <div className="small mt-1">

              Los datos mostrados pueden
              no estar actualizados.

            </div>

          </div>

        )}


        {/* ============================================
            TARJETAS DE CONTENEDORES
        ============================================ */}

        <div className="row g-4">

          {TIPOS.map((tipo) => {

            const nivel =
              niveles[tipo.id];

            const porcentaje =
              nivel?.disponible === true &&
              nivel.porcentaje !== null &&
              nivel.porcentaje !== undefined
                ? Number(
                    nivel.porcentaje
                  )
                : null;

            const disponible =
              Number.isFinite(
                porcentaje
              ) &&
              porcentaje >= 0 &&
              porcentaje <= 100;

            const porcentajeVisual =
              disponible
                ? porcentaje
                : 0;

            return (

              <div
                className="col-12 col-lg-6"
                key={tipo.id}
              >

                <Card className="h-100 shadow-sm border-0">

                  <Card.Body className="p-4">


                    {/* CABECERA */}

                    <div className="d-flex align-items-center gap-3 mb-4">

                      <div className="fs-2 text-primary">

                        <tipo.Icono />

                      </div>

                      <div>

                        <h4 className="fw-bold mb-1">

                          {tipo.nombre}

                        </h4>

                        <span className="text-muted">

                          {nivel?.codigo ||
                            "Contenedor"}

                        </span>

                      </div>

                    </div>


                    {/* PORCENTAJE */}

                    <div className="text-center py-3">

                      <div
                        className="fw-bold display-3"
                        aria-label={
                          disponible
                            ? `Nivel de llenado: ${porcentajeVisual.toFixed(0)} por ciento`
                            : "Nivel no disponible"
                        }
                      >

                        {disponible
                          ? `${porcentajeVisual.toFixed(0)}%`
                          : "--"}

                      </div>

                      <div className="text-muted">

                        Nivel de llenado

                      </div>

                    </div>


                    {/* BARRA */}

                    <ProgressBar

                      now={porcentajeVisual}

                      variant="info"

                      className="my-4"

                      style={{
                        height: "14px",
                      }}

                      aria-label={
                        `Llenado de ${tipo.nombre}`
                      }

                    />


                    {/* ESTADO */}

                    <div className="border-top pt-3">

                      <div className="d-flex justify-content-between flex-wrap gap-2">

                        <span className="fw-semibold">

                          Estado de lectura:

                        </span>

                        <span
                          className={
                            disponible
                              ? "text-success"
                              : "text-warning"
                          }
                        >

                          {disponible
                            ? "Disponible"
                            : "No disponible"}

                        </span>

                      </div>


                      <div className="mt-3">

                        <span className="fw-semibold">

                          Última actualización:

                        </span>

                        <div className="text-muted mt-1">

                          {formatearFecha(
                            nivel?.actualizadoEn
                          )}

                        </div>

                      </div>

                    </div>


                  </Card.Body>

                </Card>

              </div>

            );

          })}

        </div>


        {/* ============================================
            INFORMACIÓN
        ============================================ */}

        <div className="alert alert-info d-flex gap-2 mt-4 mb-0">

          <FaInfoCircle className="mt-1 flex-shrink-0" />

          <div>

            Esta pantalla es exclusivamente
            informativa. Los niveles se
            actualizan automáticamente
            cuando existen mediciones vigentes.

          </div>

        </div>


      </div>

    </section>

  );

};


export default ConsultaNiveles;