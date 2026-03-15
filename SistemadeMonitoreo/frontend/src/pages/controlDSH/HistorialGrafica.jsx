import React, { useEffect, useState } from "react";
import axios from "axios";
import { Row, Col, Spinner, Alert } from "react-bootstrap";
import FiltrosGraficasRecoleccion from "../../components/controlDSH/graficasrecoleccion/FiltrosGraficasRecoleccion";
import TarjetaGraficaRecoleccion from "../../components/controlDSH/graficasrecoleccion/TarjetaGraficaRecoleccion";

const HistorialGrafica = () => {
  const currentYear = new Date().getFullYear();

  const [anio, setAnio] = useState(currentYear);
  const [cuatrimestre, setCuatrimestre] = useState(1);
  const [graficas, setGraficas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const obtenerGraficas = async (anioParam = anio, cuatrimestreParam = cuatrimestre) => {
    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("token");
      const headers = { Authorization: `Bearer ${token}` };

      const response = await axios.get(
        `/api/graficas-recoleccion/cuatrimestral?anio=${anioParam}&cuatrimestre=${cuatrimestreParam}`,
        { headers }
      );

      if (response.data?.success) {
        setGraficas(response.data.data || []);
      } else {
        setGraficas([]);
        setError(response.data?.message || "No se pudieron cargar las gráficas.");
      }
    } catch (err) {
      console.error("Error obteniendo gráficas de recolección:", err);
      setGraficas([]);
      setError("Ocurrió un error al cargar las gráficas.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    obtenerGraficas();
  }, []);

  const handleFiltrar = () => {
    obtenerGraficas(anio, cuatrimestre);
  };

  return (
    <div className="container mt-4">
      <h4>
        <i className="bi bi-bar-chart-line me-2"></i>
        Historial Gráfico de Recolección
      </h4>
      <hr />

      <FiltrosGraficasRecoleccion
        anio={anio}
        cuatrimestre={cuatrimestre}
        setAnio={setAnio}
        setCuatrimestre={setCuatrimestre}
        onFiltrar={handleFiltrar}
        loading={loading}
      />

      {loading && (
        <div className="text-center my-4">
          <Spinner animation="border" />
        </div>
      )}

      {!loading && error && (
        <Alert variant="danger" className="mt-3">
          {error}
        </Alert>
      )}

      {!loading && !error && (
        <Row className="mt-3">
          {graficas.length > 0 ? (
            graficas.map((item) => (
              <Col md={12} lg={6} className="mb-4" key={item.mes}>
                <TarjetaGraficaRecoleccion data={item} />
              </Col>
            ))
          ) : (
            <Col>
              <Alert variant="secondary" className="mt-3 mb-0">
                No hay datos para los filtros seleccionados.
              </Alert>
            </Col>
          )}
        </Row>
      )}
    </div>
  );
};

export default HistorialGrafica;