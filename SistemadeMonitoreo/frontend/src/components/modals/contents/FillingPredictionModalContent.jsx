import React from "react";

import "../../../styles/dashboard-modals.css";


// ======================================================
// HELPERS
// ======================================================

function nombreContenedor(
  contenedorId
) {

  const id =
    Number(
      contenedorId
    );


  if (id === 1) {
    return "Bioinfeccioso";
  }


  if (id === 2) {
    return "Punzocortante";
  }


  return `Contenedor ${id}`;
}


function formatearNumero(
  valor,
  decimales = 2
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

    return "--";
  }


  return numero.toLocaleString(
    "es-GT",
    {
      minimumFractionDigits:
        0,

      maximumFractionDigits:
        decimales,
    }
  );
}


function formatearTiempo(
  dias
) {

  const numero =
    Number(
      dias
    );


  if (
    !Number.isFinite(
      numero
    )
  ) {

    return "No disponible";
  }


  if (
    numero <= 0
  ) {

    return "Ahora";
  }


  if (
    numero < 1
  ) {

    const horas =
      Math.max(
        1,
        Math.round(
          numero * 24
        )
      );


    return `${horas} h`;
  }


  return `${formatearNumero(
    numero,
    2
  )} días`;
}


function claseRiesgo(
  riesgo
) {

  const valor =
    String(
      riesgo || ""
    )
      .trim()
      .toUpperCase();


  if (
    valor === "ALTO"
  ) {

    return "red";
  }


  if (
    valor === "MEDIO"
  ) {

    return "orange";
  }


  if (
    valor === "BAJO"
  ) {

    return "green";
  }


  return "gray";
}


// ======================================================
// COMPONENTE
// ======================================================

const FillingPredictionModalContent = ({
  predictions = [],
  loading = false,
  error = false,
}) => {

  // ====================================================
  // CARGANDO
  // ====================================================

  if (loading) {

    return (
      <div className="prediction-modal-empty">

        Consultando predicciones...

      </div>
    );
  }


  // ====================================================
  // ERROR
  // ====================================================

  if (error) {

    return (
      <div className="prediction-modal-empty">

        No fue posible consultar las predicciones.

      </div>
    );
  }


  // ====================================================
  // SIN DATOS
  // ====================================================

  if (
    !Array.isArray(
      predictions
    ) ||
    predictions.length === 0
  ) {

    return (
      <div className="prediction-modal-empty">

        Recopilando datos para generar predicciones...

      </div>
    );
  }


  // ====================================================
  // RENDER
  // ====================================================

  return (
    <div className="prediction-modal-content">

      <div className="prediction-table-wrapper">

        <table className="prediction-table">

          <thead>

            <tr>

              <th>
                Contenedor
              </th>

              <th>
                Nivel actual
              </th>

              <th>
                Crecimiento estimado
              </th>

              <th>
                Tiempo para nivel alto
              </th>

              <th>
                Umbral alto
              </th>

              <th>
                Riesgo previsto
              </th>

            </tr>

          </thead>


          <tbody>

            {predictions.map(
              (
                prediction
              ) => {

                const riesgo =
                  String(
                    prediction
                      ?.riesgo ||
                    "SIN_DATOS"
                  )
                    .trim()
                    .toUpperCase();


                const estado =
                  String(
                    prediction
                      ?.estado ||
                    ""
                  )
                    .trim()
                    .toUpperCase();


                const key =
                  prediction
                    ?.contenedor_id;


                if (
                  estado !== "OK"
                ) {

                  return (

                    <tr
                      key={
                        key
                      }
                    >

                      <td className="prediction-container-name">

                        {nombreContenedor(
                          prediction
                            ?.contenedor_id
                        )}

                      </td>


                      <td
                        colSpan="5"
                        className="prediction-action"
                      >

                        Predicción no disponible:{" "}

                        {estado ||
                          "SIN_DATOS"}

                      </td>

                    </tr>
                  );
                }


                return (

                  <tr
                    key={
                      key
                    }
                  >

                    <td className="prediction-container-name">

                      {nombreContenedor(
                        prediction
                          .contenedor_id
                      )}

                    </td>


                    <td>

                      <strong>

                        {formatearNumero(
                          prediction
                            .nivel_actual,
                          2
                        )}

                        %

                      </strong>

                    </td>


                    <td>

                      {formatearNumero(
                        prediction
                          .crecimiento_estimado_dia,
                        2
                      )}

                      % / día

                    </td>


                    <td>

                      {formatearTiempo(
                        prediction
                          .dias_para_alto
                      )}

                    </td>


                    <td>

                      {formatearNumero(
                        prediction
                          .umbral_alto,
                        2
                      )}

                      %

                    </td>


                    <td>

                      <span
                        className={
                          `prediction-risk prediction-risk--${claseRiesgo(
                            riesgo
                          )}`
                        }
                      >

                        {riesgo}

                      </span>

                    </td>

                  </tr>
                );
              }
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
};


export default FillingPredictionModalContent;