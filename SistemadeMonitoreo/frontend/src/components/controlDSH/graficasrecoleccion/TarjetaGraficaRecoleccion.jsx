import React from "react";

import {
  Card,
  Row,
  Col,
} from "react-bootstrap";

import GraficaLineaRecoleccion
  from "../../charts/GraficaLineaRecoleccion";


/* =========================================================
   FORMATO VISUAL DE LIBRAS

   IMPORTANTE:
   Esto NO calcula valores de negocio.

   Solamente formatea visualmente lo que backend ya calculó.
   ========================================================= */

function formatearLibras(
  valor
) {
  const numero =
    Number(
      valor
    );


  if (
    !Number.isFinite(
      numero
    )
  ) {
    return "0.00 lb";
  }


  return `${numero.toLocaleString(
    "es-GT",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  )} lb`;
}


/* =========================================================
   COMPONENTE
   ========================================================= */

const TarjetaGraficaRecoleccion = ({
  data,
}) => {

  /*
    data viene del backend.

    Este componente:
    - NO calcula totales
    - NO calcula promedios
    - NO modifica series
    - NO determina meses
  */

  const nombreMes =
    data?.nombreMes ||
    "-";


  return (
    <Card className="shadow-sm h-100">

      {/* ===================================================
          ENCABEZADO
          =================================================== */}

      <Card.Header className="bg-dark text-white fw-semibold">

        Desechos Sólidos generados en el mes de{" "}
        {nombreMes}

      </Card.Header>


      <Card.Body>

        {/* =================================================
            GRÁFICA

            Las categorías y series fueron construidas por
            el backend.
            ================================================= */}

        <GraficaLineaRecoleccion
          categorias={
            data?.categorias
          }

          series={
            data?.series
          }
        />


        {/* =================================================
            RESUMEN

            Únicamente mostramos los valores recibidos desde
            backend.
            ================================================= */}

        <Row className="mt-3 g-3">

          <Col
            xs={12}
            md={4}
          >

            <div className="border rounded p-2 text-center h-100">

              <div className="small text-muted">
                Total Bioinfeccioso
              </div>

              <div className="fw-bold">
                {formatearLibras(
                  data
                    ?.totales
                    ?.bioinfeccioso
                )}
              </div>

            </div>

          </Col>


          <Col
            xs={12}
            md={4}
          >

            <div className="border rounded p-2 text-center h-100">

              <div className="small text-muted">
                Total Punzocortante
              </div>

              <div className="fw-bold">
                {formatearLibras(
                  data
                    ?.totales
                    ?.punzocortante
                )}
              </div>

            </div>

          </Col>


          <Col
            xs={12}
            md={4}
          >

            <div className="border rounded p-2 text-center h-100">

              <div className="small text-muted">
                Promedio General
              </div>

              <div className="fw-bold">
                {formatearLibras(
                  data
                    ?.promedioSemanal
                    ?.general
                )}
              </div>

            </div>

          </Col>

        </Row>

      </Card.Body>

    </Card>
  );
};


export default TarjetaGraficaRecoleccion;