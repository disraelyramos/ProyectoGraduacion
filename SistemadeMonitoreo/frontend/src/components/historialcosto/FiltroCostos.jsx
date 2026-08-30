import React from "react";


const AGRUPAR_OPTIONS = [
  {
    value: "semana",
    label: "Semana",
  },
  {
    value: "mes",
    label: "Mes",
  },
  {
    value: "anio",
    label: "Año",
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

  /* =======================================================
     CAMBIAR CAMPO
     ======================================================= */

  const setField = (
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
     ESTADOS
     ======================================================= */

  const disableCatalogSelects =
    disabled ||
    catalogLoading;


  const disableContenedor =
    disabled ||
    contenedoresLoading;


  /* =======================================================
     RENDER
     ======================================================= */

  return (

    <form className="system-form">

      <div className="system-form-grid-3">

        {/* =================================================
            FECHA INICIO
        ================================================= */}

        <div className="system-form-group">

          <label
            htmlFor="fechaInicio"
            className="system-form-label"
          >
            Fecha inicio
          </label>


          <input
            id="fechaInicio"
            type="date"
            className="system-form-control"
            value={
              value.fechaInicio ||
              ""
            }
            onChange={
              (event) =>
                setField(
                  "fechaInicio",
                  event.target.value
                )
            }
            disabled={
              disabled
            }
          />

        </div>


        {/* =================================================
            FECHA FIN
        ================================================= */}

        <div className="system-form-group">

          <label
            htmlFor="fechaFin"
            className="system-form-label"
          >
            Fecha fin
          </label>


          <input
            id="fechaFin"
            type="date"
            className="system-form-control"
            value={
              value.fechaFin ||
              ""
            }
            onChange={
              (event) =>
                setField(
                  "fechaFin",
                  event.target.value
                )
            }
            disabled={
              disabled
            }
          />

        </div>


        {/* =================================================
            AGRUPAR POR
        ================================================= */}

        <div className="system-form-group">

          <label
            htmlFor="agruparPor"
            className="system-form-label"
          >
            Agrupar por
          </label>


          <select
            id="agruparPor"
            className="system-form-select"
            value={
              value.agruparPor ||
              "mes"
            }
            onChange={
              (event) =>
                setField(
                  "agruparPor",
                  event.target.value
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

          </select>

        </div>


        {/* =================================================
            DISTRITO
        ================================================= */}

        <div className="system-form-group">

          <label
            htmlFor="distritoId"
            className="system-form-label"
          >
            Distrito
          </label>


          <select
            id="distritoId"
            className="system-form-select"
            value={
              value.distritoId ||
              ""
            }
            onChange={
              (event) =>
                setField(
                  "distritoId",
                  event.target.value
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

          </select>

        </div>


        {/* =================================================
            EMPRESA
        ================================================= */}

        <div className="system-form-group">

          <label
            htmlFor="empresaId"
            className="system-form-label"
          >
            Empresa
          </label>


          <select
            id="empresaId"
            className="system-form-select"
            value={
              value.empresaId ||
              ""
            }
            onChange={
              (event) =>
                setField(
                  "empresaId",
                  event.target.value
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

          </select>

        </div>


        {/* =================================================
            CONTENEDOR
        ================================================= */}

        <div className="system-form-group">

          <label
            htmlFor="contenedorId"
            className="system-form-label"
          >
            Contenedor
          </label>


          <select
            id="contenedorId"
            className="system-form-select"
            value={
              value.contenedorId ||
              ""
            }
            onChange={
              (event) =>
                setField(
                  "contenedorId",
                  event.target.value
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

          </select>

        </div>

      </div>

    </form>

  );
}