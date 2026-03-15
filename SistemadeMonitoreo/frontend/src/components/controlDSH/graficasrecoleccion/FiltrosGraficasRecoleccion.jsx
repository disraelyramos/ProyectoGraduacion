import React from "react";
import { Card, Row, Col, Form, Button } from "react-bootstrap";

const FiltrosGraficasRecoleccion = ({
  anio,
  cuatrimestre,
  setAnio,
  setCuatrimestre,
  onFiltrar,
  loading,
}) => {
  const currentYear = new Date().getFullYear();
  const years = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

  return (
    <Card className="shadow-sm">
      <Card.Body>
        <Row className="align-items-end">
          <Col md={4}>
            <Form.Group>
              <Form.Label>Año</Form.Label>
              <Form.Select
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={4}>
            <Form.Group>
              <Form.Label>Cuatrimestre</Form.Label>
              <Form.Select
                value={cuatrimestre}
                onChange={(e) => setCuatrimestre(Number(e.target.value))}
              >
                <option value={1}>Primer cuatrimestre</option>
                <option value={2}>Segundo cuatrimestre</option>
                <option value={3}>Tercer cuatrimestre</option>
              </Form.Select>
            </Form.Group>
          </Col>

          <Col md={4}>
            <Button
              variant="primary"
              className="w-100"
              onClick={onFiltrar}
              disabled={loading}
            >
              {loading ? "Cargando..." : "Filtrar"}
            </Button>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default FiltrosGraficasRecoleccion;