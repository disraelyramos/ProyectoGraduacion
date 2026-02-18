// backend/src/exports/pdf/historialRecoleccion.pdf.js
const puppeteer = require("puppeteer");

// ===== Browser singleton (evita el delay de 5s por abrir Chromium cada vez) =====
let browserPromise = null;

async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
  }
  return browserPromise;
}

// ===== Helpers =====
function safeText(v) {
  return v === null || v === undefined ? "" : String(v);
}

function escapeHtml(v) {
  return safeText(v)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fmtDateTimeGT() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function toPct(v) {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  return Number.isNaN(n) ? safeText(v) : `${n}%`;
}

function renderRows(rows, columns, emptyColspan) {
  if (!rows?.length) {
    return `<tr><td class="empty" colspan="${emptyColspan}">Sin registros para mostrar.</td></tr>`;
  }

  return rows
    .map((r) => {
      const tds = columns
        .map((c) => {
          const raw = typeof c.value === "function" ? c.value(r) : r?.[c.value];
          const val = escapeHtml(raw);
          const cls = c.className ? ` class="${c.className}"` : "";
          return `<td${cls}>${val}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
}

function buildHtml({ filtros, detalle, pesaje, generadoPor, total }) {
  const nombre = escapeHtml(generadoPor?.nombre);
  const usuario = escapeHtml(generadoPor?.usuario);

  const detalleCols = [
    { value: "codigo" },
    { value: "fecha" },
    { value: "distrito" },
    { value: "tipo_residuo" },
    { value: "numero_recibo" },
    { value: "responsable" },
    { value: "empresa_recolectora" },
    { value: (r) => toPct(r?.porcentaje_pendiente), className: "num" },
    { value: "cantidad_libras_pendientes", className: "num" },
    { value: "observaciones" },
  ];

  // ✅ Pesaje SIN "ID Recolección"
  const pesajeCols = [
    { value: "total_en_libras", className: "num" },
    { value: (p) => toPct(p?.porcentaje_recolectado), className: "num" },
    { value: (p) => toPct(p?.porcentaje_llenado), className: "num" },
    { value: "costo_por_libra_aplicado", className: "num" },
    { value: "total_costo_q", className: "num" },
  ];

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Historial de Recolección</title>
<style>
  *{box-sizing:border-box}
  body{font-family:Arial,sans-serif;color:#111;margin:0;padding:24px}
  .center{text-align:center}
  h1{margin:0;font-size:20px;font-weight:700}
  .sub{margin-top:4px;font-size:13px;color:#444}
  .meta{margin-top:10px;font-size:12px}
  .rule{margin:14px 0;border-top:1px solid #ddd}
  h2{font-size:14px;margin:18px 0 8px}
  .filters{font-size:12px;color:#222;line-height:1.35}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  th,td{border:1px solid #ddd;padding:6px;font-size:10.5px;vertical-align:top}
  th{background:#f3f3f3;font-weight:700;text-align:left}
  td.num{text-align:right;white-space:nowrap}
  td.empty{text-align:center;color:#666;padding:12px}
  thead{display:table-header-group}
  tr{page-break-inside:avoid}
  @page{size:A4;margin:20mm}
</style>
</head>
<body>
  <div class="center">
    <h1>Historial de Recolección</h1>
    <div class="sub">Control DSH</div>
    <div class="meta">
      Generado por: ${nombre}${usuario ? ` (${usuario})` : ""} &nbsp;&nbsp;&nbsp;
      Fecha/Hora: ${escapeHtml(fmtDateTimeGT())}
    </div>
  </div>

  <div class="rule"></div>

  <h2>Cómo se hizo la búsqueda</h2>
  <div class="filters">
    <div>Buscar por: tipo residuo</div>
    <div>Búsqueda: ${escapeHtml(filtros?.valorBusqueda)}</div>
    <div>Rango: ${escapeHtml(filtros?.fechaInicio)} — ${escapeHtml(filtros?.fechaFin)}</div>
    <div>Registros encontrados: ${escapeHtml(total)}</div>
  </div>

  <h2>Datos de Registro de Recolección</h2>
  <table>
    <thead>
      <tr>
        <th>Código</th>
        <th>Fecha</th>
        <th>Distrito</th>
        <th>Tipo residuo</th>
        <th>No. recibo</th>
        <th>Responsable</th>
        <th>Empresa</th>
        <th>% Pend.</th>
        <th>Lbs Pend.</th>
        <th>Observaciones</th>
      </tr>
    </thead>
    <tbody>
      ${renderRows(detalle, detalleCols, 10)}
    </tbody>
  </table>

  <h2>Control de Pesaje</h2>
  <table>
    <thead>
      <tr>
        <th>Total lbs</th>
        <th>% Recolectado</th>
        <th>% Llenado</th>
        <th>Costo/lb</th>
        <th>Total Q</th>
      </tr>
    </thead>
    <tbody>
      ${renderRows(pesaje, pesajeCols, 5)}
    </tbody>
  </table>
</body>
</html>`;
}

async function buildHistorialRecoleccionPdfBuffer({
  filtros,
  detalle,
  pesaje,
  generadoPor,
  total,
}) {
  const html = buildHtml({ filtros, detalle, pesaje, generadoPor, total });

  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await page.setContent(html, { waitUntil: "domcontentloaded" });
    return await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
    });
  } finally {
    await page.close();
  }
}

module.exports = { buildHistorialRecoleccionPdfBuffer };
