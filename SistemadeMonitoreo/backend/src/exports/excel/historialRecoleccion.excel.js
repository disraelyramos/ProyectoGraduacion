const ExcelJS = require("exceljs");

function safe(v) {
  return v ?? "";
}

function fmtDateTimeGT() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

async function buildHistorialRecoleccionExcelBuffer({
  filtros,
  detalle = [],
  pesaje = [],
  generadoPor,
  total,
}) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Historial");

  // Column widths fijos (evita corrupción)
  ws.columns = [
    { width: 14 }, // Código
    { width: 16 }, // Fecha
    { width: 14 }, // Distrito
    { width: 16 }, // Tipo
    { width: 14 }, // Recibo
    { width: 18 }, // Responsable
    { width: 14 }, // Empresa
    { width: 12 }, // %
    { width: 12 }, // Lbs
    { width: 28 }, // Observaciones
  ];

  let row = 1;

  // ===== ENCABEZADO =====
  ws.getCell(`A${row}`).value = "Historial de Recolección";
  ws.getCell(`A${row}`).font = { bold: true, size: 16 };
  row++;

  ws.getCell(`A${row}`).value = "Control DSH";
  ws.getCell(`A${row}`).font = { italic: true };
  row++;

  row++;

  ws.getCell(`A${row}`).value =
    `Generado por: ${safe(generadoPor?.nombre)} (${safe(generadoPor?.usuario)})`;
  row++;

  ws.getCell(`A${row}`).value = `Fecha/Hora: ${fmtDateTimeGT()}`;
  row += 2;

  // ===== FILTROS =====
  ws.getCell(`A${row}`).value = "Cómo se hizo la búsqueda";
  ws.getCell(`A${row}`).font = { bold: true };
  row++;

  ws.getCell(`A${row++}`).value = `Buscar por: tipo residuo`;
  ws.getCell(`A${row++}`).value = `Búsqueda: ${safe(filtros?.valorBusqueda)}`;
  ws.getCell(`A${row++}`).value =
    `Rango: ${safe(filtros?.fechaInicio)} — ${safe(filtros?.fechaFin)}`;
  ws.getCell(`A${row++}`).value = `Registros encontrados: ${safe(total)}`;

  row++;

  // ===== TABLA 1 =====
  ws.getCell(`A${row}`).value = "Datos de Registro de Recolección";
  ws.getCell(`A${row}`).font = { bold: true };
  row++;

  const headers1 = [
    "Código",
    "Fecha",
    "Distrito",
    "Tipo residuo",
    "No. recibo",
    "Responsable",
    "Empresa",
    "% Pend.",
    "Lbs Pend.",
    "Observaciones",
  ];

  ws.addRow(headers1);
  ws.getRow(row).font = { bold: true };
  row++;

  for (const r of detalle) {
    ws.addRow([
      safe(r.codigo),
      safe(r.fecha),
      safe(r.distrito),
      safe(r.tipo_residuo),
      safe(r.numero_recibo),
      safe(r.responsable),
      safe(r.empresa_recolectora),
      safe(r.porcentaje_pendiente),
      safe(r.cantidad_libras_pendientes),
      safe(r.observaciones),
    ]);
    row++;
  }

  row++;

  // ===== TABLA 2 =====
  ws.getCell(`A${row}`).value = "Control de Pesaje";
  ws.getCell(`A${row}`).font = { bold: true };
  row++;

  const headers2 = [
    "ID Recolección",
    "Total lbs",
    "% Recolectado",
    "% Llenado",
    "Costo/lb",
    "Total Q",
  ];

  ws.addRow(headers2);
  ws.getRow(row).font = { bold: true };
  row++;

  for (const p of pesaje) {
    ws.addRow([
      safe(p.recoleccion_id),
      safe(p.total_en_libras),
      safe(p.porcentaje_recolectado),
      safe(p.porcentaje_llenado),
      safe(p.costo_por_libra_aplicado),
      safe(p.total_costo_q),
    ]);
    row++;
  }

  return wb.xlsx.writeBuffer();
}

module.exports = { buildHistorialRecoleccionExcelBuffer };
