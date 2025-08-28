import React from "react";
import { Table, Card } from "react-bootstrap";
import { FaPrint } from "react-icons/fa";
import "../../styles/historial-recoleccion.css";

const HistorialEnTablas = () => {
  // 🔹 Datos simulados (mock) → luego serán reemplazados por datos reales
  const registrosRecoleccion = [
    {
      codigoContenedor: "CNT-001",
      fechaRecoleccion: "2025-08-20",
      distrito: "Distrito 1",
      tipoDesecho: "Bioinfeccioso",
      numeroRecibo: "12345",
      responsable: "Juan Pérez",
      empresaRecolectora: "EcoRecolecta",
      DSHPendientes: "20%",
      CantidadenLibrasPendientes: "15",
      observacion: "Recolección completada sin incidentes",
    },
    {
      codigoContenedor: "CNT-002",
      fechaRecoleccion: "2025-08-21",
      distrito: "Distrito 2",
      tipoDesecho: "Punzocortante",
      numeroRecibo: "67890",
      responsable: "María López",
      empresaRecolectora: "Salud Limpia",
      DSHPendientes: "10%",
      CantidadenLibrasPendientes: "8",
      observacion: "Recolección retrasada",
    },
  ];

  const registrosPesaje = [
    {
      totalLibras: "100",
      porcentajeRecolectado: "80%",
      porcentajeLlenado: "75%",
      costoporlibra: "20",
      costototal: "2000",
    },
    {
      totalLibras: "80",
      porcentajeRecolectado: "90%",
      porcentajeLlenado: "60%",
      costoporlibra: "20",
      costototal: "1600",
    },
  ];

  return (
    <div className="historial-recoleccion-container p-4">
      <h4 className="mb-4 fw-bold">Historial de Recolección</h4>

      {/* 🔹 Tabla de Datos de Registro de Recolección */}
      <Card className="shadow-sm border-0 mb-5">
        <Card.Body>
          <h5 className="fw-semibold mb-3">
            Datos de Registro de Recolección
          </h5>
          <hr />
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Código</th>
                <th>Fecha</th>
                <th>Distrito</th>
                <th>Tipo de Residuo</th>
                <th>Número de Recibo</th>
                <th>Responsable</th>
                <th>Empresa Recolectora</th>
                <th>% DSH Pendientes</th>
                <th>Cantidad en Libras Pendientes</th>
                <th>Observación</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {registrosRecoleccion.map((registro, idx) => (
                <tr key={idx}>
                  <td>{registro.codigoContenedor}</td>
                  <td>{registro.fechaRecoleccion}</td>
                  <td>{registro.distrito}</td>
                  <td>{registro.tipoDesecho}</td>
                  <td>{registro.numeroRecibo}</td>
                  <td>{registro.responsable}</td>
                  <td>{registro.empresaRecolectora}</td>
                  <td>{registro.DSHPendientes}</td>
                  <td>{registro.CantidadenLibrasPendientes}</td>
                  <td>{registro.observacion}</td>
                  <td className="text-center">
                    <FaPrint
                      className="text-primary print-icon"
                      title="Imprimir Registro"
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      {/* 🔹 Tabla de Control de Pesaje */}
      <Card className="shadow-sm border-0">
        <Card.Body>
          <h5 className="fw-semibold mb-3">Control de Pesaje</h5>
          <hr />
          <Table striped bordered hover responsive>
            <thead>
              <tr>
                <th>Total (lb)</th>
                <th>% Recolectado</th>
                <th>% Llenado Actual</th>
                <th>Costo por Libra</th>
                <th>Costo Total</th>
                <th>Acción</th>
              </tr>
            </thead>
            <tbody>
              {registrosPesaje.map((registro, idx) => (
                <tr key={idx}>
                  <td>{registro.totalLibras}</td>
                  <td>{registro.porcentajeRecolectado}</td>
                  <td>{registro.porcentajeLlenado}</td>
                  <td>{registro.costoporlibra}</td>
                  <td>{registro.costototal}</td>
                  <td className="text-center">
                    <FaPrint
                      className="text-success print-icon"
                      title="Imprimir Pesaje"
                      style={{ cursor: "pointer" }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </div>
  );
};

export default HistorialEnTablas;
