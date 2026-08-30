import React, {
  useState,
  useEffect,
} from "react";

import {
  FaPlus,
  FaEdit,
  FaCalendarAlt,
} from "react-icons/fa";

import axios from "axios";

import RegistrarNuevoContenedor
  from "../../components/RegistrarNuevoContenedor";

import {
  showErrorAlert,
} from "../../utils/alerts";

import "../../styles/tables.css";


/**
 * =====================================================
 * CONFIGURACIÓN DE ENTORNO
 * =====================================================
 *
 * La URL del backend viene del .env del FRONTEND:
 *
 * VITE_API_URL
 */
const API_URL = import.meta.env.VITE_API_URL;


const AgregarContenedor = () => {

  const [
    contenedores,
    setContenedores,
  ] = useState([]);

  const [
    busqueda,
    setBusqueda,
  ] = useState("");

  const [
    showModal,
    setShowModal,
  ] = useState(false);

  const [
    modoEdicion,
    setModoEdicion,
  ] = useState(false);

  const [
    contenedorEditar,
    setContenedorEditar,
  ] = useState(null);


  const [
    paginaActual,
    setPaginaActual,
  ] = useState(1);

  const [itemsPorPagina] =
    useState(8);


  /**
   * =====================================================
   * CARGAR CONTENEDORES
   * =====================================================
   */
  const fetchContenedores = async (
    termino = ""
  ) => {

    try {

      const token =
        localStorage.getItem("token");

      const headers = {
        Authorization:
          `Bearer ${token}`,
      };


      const url =
        termino.trim()
          ? `${API_URL}/api/contenedores/buscar?termino=${encodeURIComponent(
              termino
            )}`
          : `${API_URL}/api/contenedores`;


      const res =
        await axios.get(
          url,
          {
            headers,
          }
        );


      setContenedores(
        res.data
      );

      setPaginaActual(1);

    } catch (error) {

      console.error(
        "Error cargando contenedores:",
        error
      );


      showErrorAlert(
        "No se pudieron cargar los contenedores."
      );
    }
  };


  /**
   * =====================================================
   * CARGA INICIAL
   * =====================================================
   */
  useEffect(() => {
    fetchContenedores();
  }, []);


  /**
   * =====================================================
   * BÚSQUEDA
   * =====================================================
   */
  useEffect(() => {
    fetchContenedores(
      busqueda
    );
  }, [busqueda]);


  /**
   * =====================================================
   * PAGINACIÓN
   * =====================================================
   */

  const indexOfLastItem =
    paginaActual *
    itemsPorPagina;


  const indexOfFirstItem =
    indexOfLastItem -
    itemsPorPagina;


  const contenedoresActuales =
    contenedores.slice(
      indexOfFirstItem,
      indexOfLastItem
    );


  const totalPaginas =
    Math.ceil(
      contenedores.length /
        itemsPorPagina
    );


  /**
   * =====================================================
   * ABRIR NUEVO CONTENEDOR
   * =====================================================
   */
  const handleNuevo = () => {

    setModoEdicion(false);

    setContenedorEditar(null);

    setShowModal(true);
  };


  /**
   * =====================================================
   * ABRIR EDICIÓN
   * =====================================================
   */
  const handleEditar = (contenedor) => {

    setModoEdicion(true);


    setContenedorEditar({
      ...contenedor,

      id_estado_contenedor:
        contenedor.id_estado_contenedor ||
        contenedor.estado_id ||
        "",

      id_tipo_residuo:
        contenedor.id_tipo_residuo ||
        "",

      id_ubicacion:
        contenedor.id_ubicacion ||
        "",

      capacidad_max_litros:
        contenedor.capacidad_max_litros ||
        "",

      capacidad_max_lb:
        contenedor.capacidad_max_lb ||
        "",
    });


    setShowModal(true);
  };


  /**
   * =====================================================
   * VISTA
   * =====================================================
   */
  return (

    <section className="system-page">

      <div className="system-container">

        {/* ===============================================
            CABECERA
        =============================================== */}

        <header className="system-page-header">

          <div>

            <h1 className="system-title">

              <FaCalendarAlt />

              <span>
                Gestión de Contenedores
              </span>

            </h1>


            <p className="system-subtitle">
              Administra, consulta y actualiza
              los contenedores registrados.
            </p>

          </div>

        </header>


        {/* ===============================================
            CONTENIDO
        =============================================== */}

        <div className="system-card">

          {/* =============================================
              ACCIONES / BÚSQUEDA
          ============================================= */}

          <div className="system-toolbar">

            <div className="system-toolbar-actions">

              <button
                type="button"
                className="
                  app-btn
                  app-btn-primary
                "
                onClick={handleNuevo}
              >
                <FaPlus />

                <span>
                  Nuevo
                </span>
              </button>

            </div>


            <div className="system-search">

              <input
                type="search"
                className="system-form-control"
                placeholder="Buscar por código, ubicación o residuo..."
                value={busqueda}
                onChange={(e) =>
                  setBusqueda(
                    e.target.value
                  )
                }
                aria-label="Buscar contenedor"
              />

            </div>

          </div>


          {/* =============================================
              TABLA
          ============================================= */}

          <div className="system-table-wrapper">

            <table className="system-table">

              <thead>

                <tr>
                  <th>Código</th>

                  <th>
                    Ubicación
                  </th>

                  <th>
                    Tipo de Residuo
                  </th>

                  <th>
                    Cap. Máx. Litros
                  </th>

                  <th>
                    Cap. Máx. Libras
                  </th>

                  <th>
                    Fecha de Registro
                  </th>

                  <th>
                    Estado
                  </th>

                  <th className="system-text-center">
                    Opciones
                  </th>
                </tr>

              </thead>


              <tbody>

                {contenedoresActuales.length >
                0 ? (

                  contenedoresActuales.map(
                    (c) => (

                      <tr
                        key={
                          c.id_contenedor
                        }
                      >

                        {/* Código */}

                        <td>

                          <span
                            className="
                              system-badge
                              system-badge-info
                            "
                          >
                            {c.codigo}
                          </span>

                        </td>


                        {/* Ubicación */}

                        <td>
                          {c.ubicacion}
                        </td>


                        {/* Residuo */}

                        <td>
                          {c.tipo_residuo}
                        </td>


                        {/* Litros */}

                        <td>
                          {c.capacidad_max_litros ??
                            0}
                        </td>


                        {/* Libras */}

                        <td>
                          {c.capacidad_max_lb ??
                            0}
                        </td>


                        {/* Fecha */}

                        <td>
                          {c.fecha_registro}
                        </td>


                        {/* Estado */}

                        <td>

                          <span
                            className={`system-badge ${
                              c.estado ===
                              "Activo"
                                ? "system-badge-success"
                                : "system-badge-neutral"
                            }`}
                          >
                            {c.estado}
                          </span>

                        </td>


                        {/* Opciones */}

                        <td className="system-text-center">

                          <button
                            type="button"
                            className="
                              app-btn
                              app-btn-secondary
                              app-btn-icon
                            "
                            onClick={() =>
                              handleEditar(c)
                            }
                            aria-label={`Editar contenedor ${c.codigo}`}
                            title="Editar"
                          >
                            <FaEdit />
                          </button>

                        </td>

                      </tr>

                    )
                  )

                ) : (

                  <tr>

                    <td
                      colSpan="8"
                      className="system-table-empty"
                    >
                      No se encontraron resultados
                    </td>

                  </tr>

                )}

              </tbody>

            </table>

          </div>


          {/* =============================================
              PAGINACIÓN
          ============================================= */}

          {totalPaginas > 1 && (

            <nav
              className="system-pagination-container"
              aria-label="Paginación de contenedores"
            >

              <div className="system-pagination">

                {Array.from(
                  {
                    length:
                      totalPaginas,
                  },
                  (_, i) => {

                    const pagina =
                      i + 1;

                    return (

                      <button
                        key={pagina}
                        type="button"
                        className={`system-page-button ${
                          paginaActual ===
                          pagina
                            ? "active"
                            : ""
                        }`}
                        onClick={() =>
                          setPaginaActual(
                            pagina
                          )
                        }
                        aria-label={`Ir a página ${pagina}`}
                        aria-current={
                          paginaActual ===
                          pagina
                            ? "page"
                            : undefined
                        }
                      >
                        {pagina}
                      </button>

                    );
                  }
                )}

              </div>

            </nav>

          )}

        </div>


        {/* ===============================================
            MODAL
        =============================================== */}

        <RegistrarNuevoContenedor

          show={showModal}

          handleClose={() => {

            setShowModal(false);

            fetchContenedores();
          }}

          handleSave={() =>
            fetchContenedores(
              busqueda
            )
          }

          modoEdicion={
            modoEdicion
          }

          contenedorEditar={
            contenedorEditar
          }

        />

      </div>

    </section>

  );
};


export default AgregarContenedor;