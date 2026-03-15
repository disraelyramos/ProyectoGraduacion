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

  const [paginaActual, setPaginaActual] = useState(1);
  const [itemsPorPagina] = useState(8);

  const fetchContenedores = async (termino = "") => {
    try {
      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const url = termino.trim()
        ? `/api/contenedores/buscar?termino=${encodeURIComponent(termino)}`
        : `/api/contenedores`;

      const res = await axios.get(url, { headers });
      setContenedores(res.data);
      setPaginaActual(1);
    } catch (error) {
      console.error("Error cargando contenedores:", error);
      showErrorAlert("No se pudieron cargar los contenedores.");
    }
  };

  useEffect(() => {
    fetchContenedores();
  }, []);

  useEffect(() => {
    fetchContenedores(busqueda);
  }, [busqueda]);

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

      <table className="table table-bordered align-middle">
        <thead className="table-dark">
          <tr>
            <th>Código</th>
            <th>Ubicación</th>
            <th>Tipo de Residuo</th>
            <th>Cap. Máx. Litros</th>
            <th>Cap. Máx. Libras</th>
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
                <td>{c.capacidad_max_litros ?? 0}</td>
                <td>{c.capacidad_max_lb ?? 0}</td>
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
                      setContenedorEditar({
                        ...c,
                        id_estado_contenedor:
                          c.id_estado_contenedor || c.estado_id || "",
                        id_tipo_residuo: c.id_tipo_residuo || "",
                        id_ubicacion: c.id_ubicacion || "",
                        capacidad_max_litros: c.capacidad_max_litros || "",
                        capacidad_max_lb: c.capacidad_max_lb || "",
                      });
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
              <td colSpan="8" className="text-center">
                No se encontraron resultados
              </td>
            </tr>
          )}
        </tbody>
      </table>

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

      <RegistrarNuevoContenedor
        show={showModal}
        handleClose={() => {
          setShowModal(false);
          fetchContenedores();
        }}
        handleSave={() => fetchContenedores(busqueda)}
        modoEdicion={modoEdicion}
        contenedorEditar={contenedorEditar}
      />
    </div>
  );
};

export default AgregarContenedor;