import React, { useState, useEffect } from "react";
import { FaPlus, FaEdit } from "react-icons/fa";
import RegistrarNuevoContenedor from "../../components/RegistrarNuevoContenedor";
import axios from "axios";
import { showErrorAlert } from "../../utils/alerts";

const AgregarContenedor = () => {
  const [contenedores, setContenedores] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [contenedorEditar, setContenedorEditar] = useState(null);

  // 🔹 Paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina] = useState(8); // puedes hacerlo configurable

  // 🔹 Reutilizamos un único método para cargar/buscar
  const fetchContenedores = async (termino = "") => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const url = termino.trim()
        ? `/api/contenedores/buscar?termino=${encodeURIComponent(termino)}`
        : `/api/contenedores`;

      const res = await axios.get(url, { headers });
      setContenedores(res.data);
      setPaginaActual(1); // reinicia a primera página en cada búsqueda
    } catch (error) {
      console.error("Error cargando contenedores:", error);
      showErrorAlert("No se pudieron cargar los contenedores.");
    }
  };

  // 🔹 Cargar al inicio
  useEffect(() => {
    fetchContenedores();
  }, []);

  // 🔹 Buscar cada vez que cambia el input
  useEffect(() => {
    fetchContenedores(busqueda);
  }, [busqueda]);

  // 🔹 Calcular datos de paginación
  const indexOfLastItem = paginaActual * itemsPorPagina;
  const indexOfFirstItem = indexOfLastItem - itemsPorPagina;
  const contenedoresActuales = contenedores.slice(
    indexOfFirstItem,
    indexOfLastItem
  );

  const totalPaginas = Math.ceil(contenedores.length / itemsPorPagina);

  return (
    <div className="container mt-4">
      <h4>
        <i className="bi bi-calendar3 me-2"></i> Gestión de Contenedores
      </h4>
      <hr />

      {/* Barra de acciones */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        <button
          className="btn btn-primary"
          onClick={() => {
            setModoEdicion(false);
            setContenedorEditar(null);
            setShowModal(true);
          }}
        >
          <FaPlus className="me-2" /> Nuevo
        </button>

        <div className="d-flex" style={{ maxWidth: "300px" }}>
          <input
            type="text"
            className="form-control form-control-sm"
            placeholder="Buscar por código, ubicación o residuo..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Tabla */}
      <table className="table table-bordered align-middle">
        <thead className="table-dark">
          <tr>
            <th>Código</th>
            <th>Ubicación</th>
            <th>Tipo de Residuo</th>
            <th>Fecha de Registro</th>
            <th>Estado</th>
            <th>Opciones</th>
          </tr>
        </thead>
        <tbody>
          {contenedoresActuales.length > 0 ? (
            contenedoresActuales.map((c) => (
              <tr key={c.id_contenedor} className="shadow-sm">
                <td>
                  <span className="badge bg-secondary">{c.codigo}</span>
                </td>
                <td>{c.ubicacion}</td>
                <td>{c.tipo_residuo}</td>
                <td>{c.fecha_registro}</td>
                <td>
                  <span
                    className={`badge ${
                      c.estado === "Activo" ? "bg-success" : "bg-secondary"
                    }`}
                  >
                    {c.estado}
                  </span>
                </td>
                <td>
                  <button
                    className="btn btn-warning btn-sm me-2"
                    onClick={() => {
                      setModoEdicion(true);
                      setContenedorEditar(c);
                      setShowModal(true);
                    }}
                  >
                    <FaEdit />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="6" className="text-center">
                No se encontraron resultados
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Paginación */}
      {totalPaginas > 1 && (
        <nav className="d-flex justify-content-end">
          <ul className="pagination pagination-sm">
            {Array.from({ length: totalPaginas }, (_, i) => (
              <li
                key={i + 1}
                className={`page-item ${paginaActual === i + 1 ? "active" : ""}`}
              >
                <button
                  className="page-link"
                  onClick={() => setPaginaActual(i + 1)}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Modal */}
      <RegistrarNuevoContenedor
        show={showModal}
        handleClose={() => {
          setShowModal(false);
          fetchContenedores(); // refrescar después de cerrar modal
        }}
        handleSave={() => fetchContenedores()}
        modoEdicion={modoEdicion}
        contenedorEditar={contenedorEditar}
      />
    </div>
  );
};

export default AgregarContenedor;
