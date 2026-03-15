import React from "react";
import { Card, Row, Col } from "react-bootstrap";
import GraficaLineaRecoleccion from "../../charts/GraficaLineaRecoleccion";

const TarjetaGraficaRecoleccion = ({ data }) => {
  return (
    <Card className="shadow-sm h-100">
      <Card.Header className="bg-dark text-white fw-semibold">
        Desechos Sólidos generados en el mes de {data.nombreMes}
      </Card.Header>

      <Card.Body>
        <GraficaLineaRecoleccion
          categorias={data.categorias}
          series={data.series}
        />

        <Row className="mt-3">
          <Col md={4}>
            <div className="border rounded p-2 text-center">
              <div className="small text-muted">Total Bioinfeccioso</div>
              <div className="fw-bold">{data.totales.bioinfeccioso} lb</div>
            </div>
          </Col>

          <Col md={4}>
            <div className="border rounded p-2 text-center">
              <div className="small text-muted">Total Punzocortante</div>
              <div className="fw-bold">{data.totales.punzocortante} lb</div>
            </div>
          </Col>

          <Col md={4}>
            <div className="border rounded p-2 text-center">
              <div className="small text-muted">Promedio General</div>
              <div className="fw-bold">{data.promedioSemanal.general} lb</div>
            </div>
          </Col>
        </Row>
      </Card.Body>
    </Card>
  );
};

export default TarjetaGraficaRecoleccion;