const ExcelJS = require("exceljs");

function fmtDateTimeGT() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function safe(v) {
  return v === null || v === undefined ? "" : v;
}

function autoFitColumns(ws, maxCap = 50) {
  ws.columns.forEach((col) => {
    let max = 10;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const v = cell.value ? String(cell.value) : "";
      max = Math.max(max, Math.min(v.length + 2, maxCap));
    });
    col.width = max;
  });
}

async function buildHistorialCostoExcelBuffer({
  filtros,
  generadoPor,
  kpis,
  resumen,
  topContenedores,
  detalle,
  total,
}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Reporte");

  // ===== Encabezado =====
  ws.addRow(["Reporte de Costos"]);
  ws.getRow(1).font = { bold: true, size: 14 };

  ws.addRow(["Control DSH"]);
  ws.getRow(2).font = { italic: true };

  ws.addRow([]);
  ws.addRow([`Generado por: ${safe(generadoPor?.nombre)} (${safe(generadoPor?.usuario)})`]);
  ws.addRow([`Fecha/Hora: ${fmtDateTimeGT()}`]);
  ws.addRow([]);

  // ===== Cómo se hizo la búsqueda =====
  ws.addRow(["Cómo se hizo la búsqueda"]);
  ws.getRow(ws.lastRow.number).font = { bold: true };

  ws.addRow([`Rango: ${safe(filtros?.fechaInicio)} — ${safe(filtros?.fechaFin)}`]);
  ws.addRow([`Agrupar por: ${safe(filtros?.agruparPor)}`]);
  ws.addRow([`Distrito ID: ${safe(filtros?.distritoId)}`]);
  ws.addRow([`Empresa ID: ${safe(filtros?.empresaId)}`]);
  ws.addRow([`Contenedor ID: ${safe(filtros?.contenedorId)}`]);
  ws.addRow([`Registros (detalle): ${safe(total)}`]);

  ws.addRow([]);

  // ===== KPIs =====
  ws.addRow(["Resultados (KPIs)"]);
  ws.getRow(ws.lastRow.number).font = { bold: true };

  ws.addRow(["Total Gastado (Q)", safe(kpis?.total_q)]);
  ws.addRow(["Total Libras", safe(kpis?.total_lbs)]);
  ws.addRow(["Promedio Q/lb", safe(kpis?.q_por_lb)]);
  ws.addRow(["Recolecciones", safe(kpis?.recolecciones)]);

  ws.addRow([]);

  // ===== Resumen =====
  ws.addRow(["Resumen de Costos"]);
  ws.getRow(ws.lastRow.number).font = { bold: true };

  const resumenHeader = ["Periodo", "Total (Q)", "Total lbs", "Promedio Q/lb", "# Recolecciones"];
  ws.addRow(resumenHeader);
  ws.getRow(ws.lastRow.number).font = { bold: true };

  for (const r of resumen || []) {
    ws.addRow([safe(r.periodo), safe(r.total_q), safe(r.total_lbs), safe(r.q_por_lb), safe(r.recolecciones)]);
  }

  ws.addRow([]);

  // ===== Top contenedores =====
  ws.addRow(["Top 5 Contenedores por Costo"]);
  ws.getRow(ws.lastRow.number).font = { bold: true };

  ws.addRow(["Contenedor", "Total (Q)"]);
  ws.getRow(ws.lastRow.number).font = { bold: true };

  for (const t of topContenedores || []) {
    ws.addRow([safe(t.contenedor_codigo), safe(t.total_q)]);
  }

  ws.addRow([]);

  // ===== Detalle =====
  ws.addRow(["Detalle de Recolecciones"]);
  ws.getRow(ws.lastRow.number).font = { bold: true };

  const detHeader = ["Fecha", "Código", "Distrito", "Empresa", "Total lbs", "% Llenado", "Costo/lb", "Total (Q)"];
  ws.addRow(detHeader);
  ws.getRow(ws.lastRow.number).font = { bold: true };

  for (const d of detalle || []) {
    ws.addRow([
      safe(d.fecha),
      safe(d.codigo_contenedor),
      safe(d.distrito),
      safe(d.empresa_recolectora),
      safe(d.total_en_libras),
      safe(d.porcentaje_llenado),
      safe(d.costo_por_libra_aplicado),
      safe(d.total_costo_q),
    ]);
  }

  autoFitColumns(ws);
  return wb.xlsx.writeBuffer();
}

module.exports = { buildHistorialCostoExcelBuffer };