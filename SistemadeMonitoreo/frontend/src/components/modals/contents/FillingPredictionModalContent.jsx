import React from "react";

import "../../../styles/dashboard-modals.css";

const FillingPredictionModalContent = ({
  predictions = [],
}) => {
  if (predictions.length === 0) {
    return (
      <div className="prediction-modal-empty">
        Recopilando datos para generar predicciones...
      </div>
    );
  }

  return (
    <div className="prediction-modal-content">
      <div className="prediction-table-wrapper">
        <table className="prediction-table">
          <thead>
            <tr>
              <th>Contenedor</th>
              <th>Predicción ML</th>
              <th>Tiempo estimado</th>
              <th>Riesgo previsto</th>
              <th>Acción recomendada</th>
            </tr>
          </thead>

          <tbody>
            {predictions.map((prediction) => (
              <tr key={prediction.id}>
                <td className="prediction-container-name">
                  {prediction.name}
                </td>

                <td>
                  <strong>
                    {prediction.predictedLevel} %
                  </strong>
                </td>

                <td>
                  {prediction.estimatedTime}
                </td>

                <td>
                  <span
                    className={`prediction-risk prediction-risk--${prediction.riskColor}`}
                  >
                    {prediction.risk}
                  </span>
                </td>

                <td className="prediction-action">
                  {prediction.recommendedAction}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FillingPredictionModalContent;