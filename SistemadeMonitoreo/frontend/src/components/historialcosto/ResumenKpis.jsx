import React from "react";

import {
  Card,
  Col,
  Row,
} from "react-bootstrap";

import {
  FaCoins,
  FaWeight,
  FaDollarSign,
  FaClipboardList,
} from "react-icons/fa";


const fmtQ =
  (value) =>
    `Q ${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          2,

        maximumFractionDigits:
          2,
      }
    )}`;


const fmtLb =
  (value) =>
    `${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          0,

        maximumFractionDigits:
          2,
      }
    )} lbs`;


const fmtQlb =
  (value) =>
    `Q ${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits:
          4,

        maximumFractionDigits:
          4,
      }
    )}/lb`;


/* =========================================================
   KPI
   ========================================================= */

const KpiCard =
  ({
    icon,
    value,
    label,
  }) => (

    <Card className="shadow-sm border-0 h-100">

      <Card.Body className="d-flex align-items-center gap-3">

        <div
          style={{
            width:
              44,

            height:
              44,

            borderRadius:
              10,

            background:
              "#f1f5f9",

            display:
              "flex",

            alignItems:
              "center",

            justifyContent:
              "center",

            fontSize:
              18,
          }}
        >
          {icon}
        </div>


        <div>

          <div
            style={{
              fontSize:
                18,

              fontWeight:
                700,
            }}
          >
            {value}
          </div>


          <div
            className="text-muted"

            style={{
              fontSize:
                13,
            }}
          >
            {label}
          </div>

        </div>

      </Card.Body>

    </Card>
  );


/* =========================================================
   COMPONENTE
   ========================================================= */

export default function ResumenKpis({
  kpis,
}) {

  if (!kpis) {
    return null;
  }


  return (
    <Row className="g-3 mt-3">

      <Col md={3}>
        <KpiCard
          icon={
            <FaCoins className="text-primary" />
          }

          value={
            fmtQ(
              kpis.total_q
            )
          }

          label="Total Gastado (Q)"
        />
      </Col>


      <Col md={3}>
        <KpiCard
          icon={
            <FaWeight className="text-warning" />
          }

          value={
            fmtLb(
              kpis.total_lbs
            )
          }

          label="Total Libras Recolectadas"
        />
      </Col>


      <Col md={3}>
        <KpiCard
          icon={
            <FaDollarSign className="text-success" />
          }

          value={
            fmtQlb(
              kpis.q_por_lb
            )
          }

          label="Costo Promedio por Libra"
        />
      </Col>


      <Col md={3}>
        <KpiCard
          icon={
            <FaClipboardList className="text-danger" />
          }

          value={
            Number(
              kpis.recolecciones ||
              0
            ).toLocaleString(
              "es-GT"
            )
          }

          label="Recolecciones Contadas"
        />
      </Col>

    </Row>
  );
}