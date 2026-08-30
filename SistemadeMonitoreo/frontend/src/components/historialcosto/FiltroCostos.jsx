import React, {
  useRef,
} from "react";

import {
  Row,
  Col,
  Form,
  InputGroup,
} from "react-bootstrap";

import {
  FaCalendarAlt,
} from "react-icons/fa";


const AGRUPAR_OPTIONS = [
  {
    value:
      "semana",

    label:
      "Semana",
  },

  {
    value:
      "mes",

    label:
      "Mes",
  },

  {
    value:
      "anio",

    label:
      "Año",
  },
];


export default function FiltroCostos({
  value,
  onChange,
  disabled,
  catalogLoading = false,
  contenedoresLoading = false,
  distritos = [],
  empresas = [],
  contenedores = [],
}) {

  const refIni =
    useRef(null);


  const refFin =
    useRef(null);


  /* =======================================================
     CAMBIAR CAMPO
     ======================================================= */

  const setField =
    (
      name,
      fieldValue
    ) => {

      onChange(
        (prev) => ({
          ...prev,

          [name]:
            String(
              fieldValue ??
              ""
            ),
        })
      );
    };


  /* =======================================================
     ABRIR DATE PICKER
     ======================================================= */

  const openPicker =
    (ref) => {

      const element =
        ref?.current;


      if (
        !element ||
        disabled
      ) {
        return;
      }


      if (
        typeof element.showPicker ===
        "function"
      ) {
        element.showPicker();

        return;
      }


      element.focus();
      element.click();
    };


  const disableCatalogSelects =
    disabled ||
    catalogLoading;


  const disableContenedor =
    disabled ||
    contenedoresLoading;


  return (
    <Form>

      <Row className="g-3">

        {/* =============================================
            FECHA INICIO
            ============================================= */}

        <Col md={4}>
          <Form.Group>

            <Form.Label>
              Fecha inicio
            </Form.Label>


            <InputGroup>

              <Form.Control
                ref={
                  refIni
                }

                type="date"

                value={
                  value.fechaInicio ||
                  ""
                }

                onChange={
                  (e) =>
                    setField(
                      "fechaInicio",
                      e.target.value
                    )
                }

                disabled={
                  disabled
                }
              />


              <InputGroup.Text
                role="button"

                aria-label="Abrir calendario de fecha inicio"

                onClick={
                  () =>
                    openPicker(
                      refIni
                    )
                }

                style={{
                  cursor:
                    disabled
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                <FaCalendarAlt />
              </InputGroup.Text>

            </InputGroup>

          </Form.Group>
        </Col>


        {/* =============================================
            FECHA FIN
            ============================================= */}

        <Col md={4}>
          <Form.Group>

            <Form.Label>
              Fecha fin
            </Form.Label>


            <InputGroup>

              <Form.Control
                ref={
                  refFin
                }

                type="date"

                value={
                  value.fechaFin ||
                  ""
                }

                onChange={
                  (e) =>
                    setField(
                      "fechaFin",
                      e.target.value
                    )
                }

                disabled={
                  disabled
                }
              />


              <InputGroup.Text
                role="button"

                aria-label="Abrir calendario de fecha fin"

                onClick={
                  () =>
                    openPicker(
                      refFin
                    )
                }

                style={{
                  cursor:
                    disabled
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                <FaCalendarAlt />
              </InputGroup.Text>

            </InputGroup>

          </Form.Group>
        </Col>


        {/* =============================================
            AGRUPAR
            ============================================= */}

        <Col md={4}>
          <Form.Group>

            <Form.Label>
              Agrupar por
            </Form.Label>


            <Form.Select
              value={
                value.agruparPor ||
                "mes"
              }

              onChange={
                (e) =>
                  setField(
                    "agruparPor",
                    e.target.value
                  )
              }

              disabled={
                disabled
              }
            >
              {AGRUPAR_OPTIONS.map(
                (option) => (
                  <option
                    key={
                      option.value
                    }

                    value={
                      option.value
                    }
                  >
                    {option.label}
                  </option>
                )
              )}
            </Form.Select>

          </Form.Group>
        </Col>


        {/* =============================================
            DISTRITO
            ============================================= */}

        <Col md={4}>
          <Form.Group>

            <Form.Label>
              Distrito
            </Form.Label>


            <Form.Select
              value={
                value.distritoId ||
                ""
              }

              onChange={
                (e) =>
                  setField(
                    "distritoId",
                    e.target.value
                  )
              }

              disabled={
                disableCatalogSelects
              }
            >

              <option value="">
                {catalogLoading
                  ? "Cargando..."
                  : "Seleccione un distrito"}
              </option>


              {distritos.map(
                (distrito) => (
                  <option
                    key={
                      distrito.id
                    }

                    value={
                      String(
                        distrito.id
                      )
                    }
                  >
                    {distrito.nombre}
                  </option>
                )
              )}

            </Form.Select>

          </Form.Group>
        </Col>


        {/* =============================================
            EMPRESA
            ============================================= */}

        <Col md={4}>
          <Form.Group>

            <Form.Label>
              Empresa
            </Form.Label>


            <Form.Select
              value={
                value.empresaId ||
                ""
              }

              onChange={
                (e) =>
                  setField(
                    "empresaId",
                    e.target.value
                  )
              }

              disabled={
                disableCatalogSelects
              }
            >

              <option value="">
                {catalogLoading
                  ? "Cargando..."
                  : "Seleccione una empresa"}
              </option>


              {empresas.map(
                (empresa) => (
                  <option
                    key={
                      empresa.id
                    }

                    value={
                      String(
                        empresa.id
                      )
                    }
                  >
                    {empresa.nombre}
                  </option>
                )
              )}

            </Form.Select>

          </Form.Group>
        </Col>


        {/* =============================================
            CONTENEDOR
            ============================================= */}

        <Col md={4}>
          <Form.Group>

            <Form.Label>
              Contenedor
            </Form.Label>


            <Form.Select
              value={
                value.contenedorId ||
                ""
              }

              onChange={
                (e) =>
                  setField(
                    "contenedorId",
                    e.target.value
                  )
              }

              disabled={
                disableContenedor
              }
            >

              <option value="">
                {contenedoresLoading
                  ? "Cargando..."
                  : "Seleccione un contenedor"}
              </option>


              {contenedores.map(
                (contenedor) => (
                  <option
                    key={
                      contenedor.id
                    }

                    value={
                      String(
                        contenedor.id
                      )
                    }
                  >
                    {contenedor.codigo}
                  </option>
                )
              )}

            </Form.Select>

          </Form.Group>
        </Col>

      </Row>

    </Form>
  );
}