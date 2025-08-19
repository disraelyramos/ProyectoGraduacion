import React, { useState } from "react";
import { FaPlus, FaSearch, FaEdit } from "react-icons/fa";
import "bootstrap/dist/css/bootstrap.min.css";

const AgregarContenedor = () => {
  // 📌 Datos de ejemplo (reemplazar con API)
  const [contenedores, setContenedores] = useState([
    {
      id: 1,
      ubicacion: "Zona Sur - Sector B",
      numero: "CN-002",
      tipo: "Bioinfeccioso",
      fecha: "2024-01-15",
      cantidad: 30,
      estado: "Activo",
    },
  ]);

  const [busqueda, setBusqueda] = useState("");

  // 📌 Filtrar por código o ubicación
  const filtrados = contenedores.filter(
    (c) =>
      c.numero.toLowerCase().includes(busqueda.toLowerCase()) ||
      c.ubicacion.toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="container mt-4">
      {/* Encabezado */}
      <h4>
        <i className="bi bi-calendar3 me-2"></i> Nuevo Registro de Recolección
      </h4>
      <hr />

      {/* Barra de acciones */}
      <div className="d-flex justify-content-between align-items-center mb-3">
        {/* Botón Nuevo */}
        <button className="btn btn-primary">
          <FaPlus className="me-2" /> Nuevo
        </button>

        {/* Campo de búsqueda más pequeño */}
        <div className="d-flex" style={{ maxWidth: "300px" }}>
          <input
            type="text"
            className="form-control form-control-sm me-2"
            placeholder="Buscar..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
          <button className="btn btn-primary btn-sm">
            <FaSearch /> Buscar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <table className="table table-striped table-bordered align-middle">
        <thead className="table-dark">
          <tr>
            <th>Ubicación</th>
            <th>Número de Contenedor</th>
            <th>Tipo de Residuo</th>
            <th>Fecha de Registro</th>
            <th>Cantidad (lb.)</th>
            <th>Estado</th>
            <th>Opciones</th>
          </tr>
        </thead>
        <tbody>
          {filtrados.map((c) => (
            <tr key={c.id}>
              <td>{c.ubicacion}</td>
              <td>
                <span className="badge bg-info text-dark">{c.numero}</span>
              </td>
              <td>{c.tipo}</td>
              <td>{c.fecha}</td>
              <td>{c.cantidad}</td>
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
                <button className="btn btn-warning btn-sm me-2">
                  <FaEdit />
                </button>
              </td>
            </tr>
          ))}

          {filtrados.length === 0 && (
            <tr>
              <td colSpan="7" className="text-center">
                No se encontraron resultados
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default AgregarContenedor;
