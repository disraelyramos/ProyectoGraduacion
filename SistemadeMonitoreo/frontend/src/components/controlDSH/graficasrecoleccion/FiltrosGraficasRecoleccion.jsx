import React, {
  useMemo,
} from "react";

import {
  Card,
  Row,
  Col,
  Form,
  Button,
  Spinner,
} from "react-bootstrap";


const FiltrosGraficasRecoleccion = ({
  anio,
  cuatrimestre,
  setAnio,
  setCuatrimestre,
  onFiltrar,
  loading,
}) => {

  /* =========================================================
     AÑOS DISPONIBLES

     Esto solamente controla las opciones visibles.

     Backend sigue validando realmente el año recibido.
     ========================================================= */

  const currentYear =
    new Date()
      .getFullYear();


  const years =
    useMemo(
      () => [
        currentYear,
        currentYear - 1,
        currentYear - 2,
        currentYear - 3,
      ],
      [
        currentYear,
      ]
    );


  /* =========================================================
     FILTROS COMPLETOS

     Solo UX.

     Backend mantiene la validación real.
     ========================================================= */

  const filtrosCompletos =
    anio !== "" &&
    cuatrimestre !== "";


  /* =========================================================
     CAMBIAR AÑO
     ========================================================= */

  const handleAnioChange =
    (
      event
    ) => {

      const valor =
        event.target.value;


      if (
        valor === ""
      ) {
        setAnio(
          ""
        );

        return;
      }


      setAnio(
        Number(
          valor
        )
      );

    };


  /* =========================================================
     CAMBIAR CUATRIMESTRE
     ========================================================= */

  const handleCuatrimestreChange =
    (
      event
    ) => {

      const valor =
        event.target.value;


      if (
        valor === ""
      ) {
        setCuatrimestre(
          ""
        );

        return;
      }


      setCuatrimestre(
        Number(
          valor
        )
      );

    };


  /* =========================================================
     RENDER
     ========================================================= */

  return (
    <Card className="shadow-sm">

      <Card.Body>

        <Row className="align-items-end g-3">

          {/* =================================================
              AÑO
              ================================================= */}

          <Col
            xs={12}
            md={4}
          >

            <Form.Group>

              <Form.Label>
                Año

                <span className="text-danger ms-1">
                  *
                </span>
              </Form.Label>


              <Form.Select
                value={
                  anio
                }

                onChange={
                  handleAnioChange
                }

                disabled={
                  loading
                }
              >

                <option value="">
                  Seleccione un año
                </option>


                {years.map(
                  (
                    year
                  ) => (

                    <option
                      key={
                        year
                      }

                      value={
                        year
                      }
                    >
                      {year}
                    </option>

                  )
                )}

              </Form.Select>

            </Form.Group>

          </Col>


          {/* =================================================
              CUATRIMESTRE
              ================================================= */}

          <Col
            xs={12}
            md={4}
          >

            <Form.Group>

              <Form.Label>
                Cuatrimestre

                <span className="text-danger ms-1">
                  *
                </span>
              </Form.Label>


              <Form.Select
                value={
                  cuatrimestre
                }

                onChange={
                  handleCuatrimestreChange
                }

                disabled={
                  loading
                }
              >

                <option value="">
                  Seleccione un cuatrimestre
                </option>


                <option value="1">
                  Primer cuatrimestre — Enero a Abril
                </option>


                <option value="2">
                  Segundo cuatrimestre — Mayo a Agosto
                </option>


                <option value="3">
                  Tercer cuatrimestre — Septiembre a Diciembre
                </option>

              </Form.Select>

            </Form.Group>

          </Col>


          {/* =================================================
              FILTRAR
              ================================================= */}

          <Col
            xs={12}
            md={4}
          >

            <Button
              type="button"

              variant="primary"

              className="w-100"

              onClick={
                onFiltrar
              }

              disabled={
                loading ||
                !filtrosCompletos
              }
            >

              {loading ? (
                <>
                  <Spinner
                    animation="border"
                    size="sm"
                    className="me-2"
                  />

                  Consultando...
                </>
              ) : (
                <>
                  <i className="bi bi-search me-2" />

                  Filtrar
                </>
              )}

            </Button>

          </Col>

        </Row>


        <div className="small text-muted mt-2">

          <span className="text-danger">
            *
          </span>

          {" "}Campos obligatorios.

        </div>

      </Card.Body>

    </Card>
  );
};


export default FiltrosGraficasRecoleccion;