import React, {
  useMemo,
} from "react";

import {
  FaSearch,
  FaFilter,
} from "react-icons/fa";


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
     ========================================================= */

  const filtrosCompletos =
    anio !== "" &&
    cuatrimestre !== "";


  /* =========================================================
     CAMBIAR AÑO
     ========================================================= */

  const handleAnioChange =
    (event) => {

      const valor =
        event.target.value;


      if (
        valor === ""
      ) {

        setAnio("");

        return;
      }


      setAnio(
        Number(valor)
      );
    };


  /* =========================================================
     CAMBIAR CUATRIMESTRE
     ========================================================= */

  const handleCuatrimestreChange =
    (event) => {

      const valor =
        event.target.value;


      if (
        valor === ""
      ) {

        setCuatrimestre("");

        return;
      }


      setCuatrimestre(
        Number(valor)
      );
    };


  /* =========================================================
     RENDER
     ========================================================= */

  return (

    <section className="system-card graficas-filter-card">

      {/* =====================================================
          TÍTULO DE FILTROS
      ===================================================== */}

      <header className="graficas-filter-header">

        <FaFilter
          aria-hidden="true"
        />


        <h2 className="graficas-filter-title">
          Filtros de búsqueda
        </h2>

      </header>


      {/* =====================================================
          FILTROS
      ===================================================== */}

      <div className="graficas-filter-grid">

        {/* =================================================
            AÑO
        ================================================= */}

        <div className="system-form-group graficas-filter-group">

          <label
            htmlFor="grafica-anio"
            className="system-form-label"
          >

            Año

            <span className="system-form-required">
              *
            </span>

          </label>


          <select
            id="grafica-anio"
            className="system-form-select"
            value={anio}
            onChange={
              handleAnioChange
            }
            disabled={loading}
          >

            <option value="">
              Seleccione un año
            </option>


            {years.map(
              (year) => (

                <option
                  key={year}
                  value={year}
                >
                  {year}
                </option>

              )
            )}

          </select>

        </div>


        {/* =================================================
            CUATRIMESTRE
        ================================================= */}

        <div className="system-form-group graficas-filter-group">

          <label
            htmlFor="grafica-cuatrimestre"
            className="system-form-label"
          >

            Cuatrimestre

            <span className="system-form-required">
              *
            </span>

          </label>


          <select
            id="grafica-cuatrimestre"
            className="system-form-select"
            value={cuatrimestre}
            onChange={
              handleCuatrimestreChange
            }
            disabled={loading}
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

          </select>

        </div>


        {/* =================================================
            FILTRAR
        ================================================= */}

        <div className="graficas-filter-action">

          <button
            type="button"
            className="app-btn app-btn-primary app-btn-block"
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

                <span
                  className="system-spinner system-spinner-small"
                  aria-hidden="true"
                />

                <span>
                  Consultando...
                </span>

              </>

            ) : (

              <>

                <FaSearch
                  aria-hidden="true"
                />

                <span>
                  Filtrar
                </span>

              </>

            )}

          </button>

        </div>

      </div>


      {/* =====================================================
          CAMPOS OBLIGATORIOS
      ===================================================== */}

      <p className="graficas-required-help">

        <span className="system-form-required">
          *
        </span>

        {" "}
        Campos obligatorios.

      </p>

    </section>
  );
};


export default FiltrosGraficasRecoleccion;