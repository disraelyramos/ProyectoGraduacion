import React, { useState } from "react";
import {
  FaChartLine,
  FaSyringe,
  FaBiohazard,
  FaInfoCircle,
} from "react-icons/fa";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../styles/nuevo-registro.css";

// 🔹 Importar los modales
import ModalCosto from "../../components/controlDSH/ModalCosto";
import ModalTotales from "../../components/controlDSH/ModalTotales";
// 🔹 Importar la nueva vista
import RegistroRecoleccion from "./RegistroRecoleccion";

const NuevoRegistro = () => {
  const [showCosto, setShowCosto] = useState(false);
  const [showTotales, setShowTotales] = useState(false);
  const [showRecoleccion, setShowRecoleccion] = useState(false);
  const [residuoSeleccionado, setResiduoSeleccionado] = useState(null);

  // 🔹 Abrir modal de costo según residuo
  const handleOpenCosto = (tipo) => {
    setResiduoSeleccionado(tipo);
    setShowCosto(true);
  };
  const handleCloseCosto = () => setShowCosto(false);

  // 🔹 Abrir modal de totales
  const handleOpenTotales = () => {
    setShowCosto(false); // cerrar modal costo
    setShowTotales(true); // abrir modal totales
  };
  const handleCloseTotales = () => setShowTotales(false);

  // 🔹 Mostrar vista de Registro de Recolección
  const handleShowRecoleccion = () => {
    setShowTotales(false); // cerrar modal totales
    setShowRecoleccion(true); // mostrar vista al lado derecho
  };

  return (
    <div className="d-flex justify-content-start align-items-start p-4 gap-5">
      {/* Card principal */}
      <div className="card shadow-sm border-0 nuevo-registro-card">
        <div className="card-body p-4">
          {/* Header */}
          <h4 className="card-title d-flex align-items-center mb-4">
            <FaChartLine className="text-primary me-2" size={24} />
            <span className="fw-bold">Niveles de Residuos</span>
          </h4>

          {/* Punzocortante */}
          <div
            className="mb-4 residuo-card"
            onClick={() => handleOpenCosto("Punzocortante")}
          >
            <div className="d-flex align-items-center mb-2">
              <FaSyringe className="text-danger me-2" />
              <span className="fw-semibold">Punzocortante</span>
            </div>
            <div className="progress custom-progress">
              <div
                className="progress-bar bg-danger"
                role="progressbar"
                style={{ width: "40%" }}
                aria-valuenow="40"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                40%
              </div>
            </div>
          </div>

          {/* Bioinfeccioso */}
          <div
            className="mb-4 residuo-card"
            onClick={() => handleOpenCosto("Bioinfeccioso")}
          >
            <div className="d-flex align-items-center mb-2">
              <FaBiohazard className="text-warning me-2" />
              <span className="fw-semibold">Bioinfeccioso</span>
            </div>
            <div className="progress custom-progress">
              <div
                className="progress-bar bg-warning text-dark"
                role="progressbar"
                style={{ width: "75%" }}
                aria-valuenow="75"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                75%
              </div>
            </div>
          </div>

          {/* Alerta informativa */}
          <div className="alert alert-info d-flex align-items-start mb-0">
            <FaInfoCircle className="me-2 mt-1" />
            <div>
              <strong>Información:</strong> Deve seleccionar uno de los desechos
              para el calculo del pesaje.
            </div>
          </div>
        </div>
      </div>

      {/* Vista lateral: Registro de Recolección */}
      {showRecoleccion && (
        <div className="flex-grow-1">
          <RegistroRecoleccion />
        </div>
      )}

      {/* 🔹 Modal Costo */}
      <ModalCosto
        show={showCosto}
        handleClose={handleCloseCosto}
        handleOpenTotales={handleOpenTotales}
      />

      {/* 🔹 Modal Totales */}
      <ModalTotales
        show={showTotales}
        handleClose={handleCloseTotales}
        handleShowRecoleccion={handleShowRecoleccion}
      />
    </div>
  );
};

export default NuevoRegistro;
