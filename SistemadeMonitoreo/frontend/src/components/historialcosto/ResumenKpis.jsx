import React from "react";

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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;


const fmtLb =
  (value) =>
    `${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }
    )} lbs`;


const fmtQlb =
  (value) =>
    `Q ${Number(
      value || 0
    ).toLocaleString(
      "es-GT",
      {
        minimumFractionDigits: 4,
        maximumFractionDigits: 4,
      }
    )}/lb`;


/* =========================================================
   KPI
   ========================================================= */

const KpiCard = ({
  icon,
  value,
  label,
  badgeClass,
}) => (

  <article className="system-card">

    <div className="system-card-header">

      <span
        className={`system-badge ${badgeClass}`}
        aria-hidden="true"
      >
        {icon}
      </span>

    </div>


    <div>

      <div className="system-section-title">
        {value}
      </div>


      <div className="system-text-muted">
        {label}
      </div>

    </div>

  </article>

);


/* =========================================================
   COMPONENTE
   ========================================================= */

export default function ResumenKpis({
  kpis,
}) {

  if (
    !kpis
  ) {
    return null;
  }


  return (

    <section className="system-form-grid">

      <KpiCard
        icon={
          <FaCoins />
        }
        value={
          fmtQ(
            kpis.total_q
          )
        }
        label="Total Gastado (Q)"
        badgeClass="system-badge-info"
      />


      <KpiCard
        icon={
          <FaWeight />
        }
        value={
          fmtLb(
            kpis.total_lbs
          )
        }
        label="Total Libras Recolectadas"
        badgeClass="system-badge-warning"
      />


      <KpiCard
        icon={
          <FaDollarSign />
        }
        value={
          fmtQlb(
            kpis.q_por_lb
          )
        }
        label="Costo Promedio por Libra"
        badgeClass="system-badge-success"
      />


      <KpiCard
        icon={
          <FaClipboardList />
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
        badgeClass="system-badge-danger"
      />

    </section>

  );
}