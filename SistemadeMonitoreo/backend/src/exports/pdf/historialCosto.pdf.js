const puppeteer = require("puppeteer");

// ===== Browser singleton (evita delay) =====
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

function fmtQ(n) {
  const x = Number(n || 0);
  return `Q ${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtLb(n) {
  const x = Number(n || 0);
  return `${x.toLocaleString()} lbs`;
}

function fmtQlb(n) {
  const x = Number(n || 0);
  return `Q ${x.toFixed(2)}/lb`;
}

function renderTableRows(rows, cols, emptyColspan) {
  if (!rows?.length) {
    return `<tr><td class="empty" colspan="${emptyColspan}">Sin registros para mostrar.</td></tr>`;
  }
  return rows
    .map((r) => {
      const tds = cols
        .map((c) => {
          const raw = typeof c.value === "function" ? c.value(r) : r?.[c.value];
          const cls = c.className ? ` class="${c.className}"` : "";
          return `<td${cls}>${escapeHtml(raw)}</td>`;
        })
        .join("");
      return `<tr>${tds}</tr>`;
    })
    .join("");
}

function buildHtml({ filtros, generadoPor, kpis, resumen, topContenedores, detalle }) {
  const nombre = escapeHtml(generadoPor?.nombre);
  const usuario = escapeHtml(generadoPor?.usuario);

  const kpiCards = [
    { label: "Total Gastado (Q)", value: fmtQ(kpis?.total_q) },
    { label: "Total Libras", value: fmtLb(kpis?.total_lbs) },
    { label: "Promedio Q/lb", value: fmtQlb(kpis?.q_por_lb) },
    { label: "Recolecciones", value: String(kpis?.recolecciones || 0) },
  ];

  const resumenCols = [
    { value: "periodo" },
    { value: (r) => fmtQ(r.total_q), className: "num" },
    { value: (r) => fmtLb(r.total_lbs), className: "num" },
    { value: (r) => fmtQlb(r.q_por_lb), className: "num" },
    { value: "recolecciones", className: "num" },
  ];

  const topCols = [
    { value: "contenedor_codigo" },
    { value: (r) => fmtQ(r.total_q), className: "num" },
  ];

  const detCols = [
    { value: "fecha" },
    { value: "codigo_contenedor" },
    { value: "distrito" },
    { value: "empresa_recolectora" },
    { value: (r) => fmtLb(r.total_en_libras), className: "num" },
    { value: (r) => safeText(r.porcentaje_llenado ?? ""), className: "num" },
    { value: (r) => safeText(r.costo_por_libra_aplicado ?? ""), className: "num" },
    { value: (r) => fmtQ(r.total_costo_q), className: "num" },
  ];

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Reporte de Costos</title>
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
  .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-top:8px}
  .kpi{border:1px solid #ddd;border-radius:8px;padding:10px}
  .kpi .v{font-weight:700;font-size:13px}
  .kpi .l{font-size:11px;color:#444;margin-top:4px}

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
    <h1>Reporte de Costos</h1>
    <div class="sub">Control DSH</div>
    <div class="meta">
      Generado por: ${nombre}${usuario ? ` (${usuario})` : ""} &nbsp;&nbsp;&nbsp;
      Fecha/Hora: ${escapeHtml(fmtDateTimeGT())}
    </div>
  </div>

  <div class="rule"></div>

  <h2>Cómo se hizo la búsqueda</h2>
  <div class="filters">
    <div>Rango: ${escapeHtml(filtros?.fechaInicio)} — ${escapeHtml(filtros?.fechaFin)}</div>
    <div>Agrupar por: ${escapeHtml(filtros?.agruparPor)}</div>
        <div>Distrito: ${escapeHtml(filtros?.distritoNombre || "")}</div>
  <div>Empresa: ${escapeHtml(filtros?.empresaNombre || "")}</div>
  <div>Contenedor: ${escapeHtml(filtros?.contenedorCodigo || "")}</div>
</div>

  <h2>Resultados</h2>
  <div class="kpis">
    ${kpiCards
      .map((k) => `<div class="kpi"><div class="v">${escapeHtml(k.value)}</div><div class="l">${escapeHtml(k.label)}</div></div>`)
      .join("")}
  </div>

  <h2>Resumen de Costos</h2>
  <table>
    <thead>
      <tr>
        <th>Periodo</th>
        <th>Total (Q)</th>
        <th>Total lbs</th>
        <th>Promedio Q/lb</th>
        <th># Recolecciones</th>
      </tr>
    </thead>
    <tbody>
      ${renderTableRows(resumen, resumenCols, 5)}
    </tbody>
  </table>

  <h2>Top 5 Contenedores por Costo</h2>
  <table>
    <thead>
      <tr>
        <th>Contenedor</th>
        <th>Total (Q)</th>
      </tr>
    </thead>
    <tbody>
      ${renderTableRows(topContenedores, topCols, 2)}
    </tbody>
  </table>

  <h2>Detalle de Recolecciones</h2>
  <table>
    <thead>
      <tr>
        <th>Fecha</th>
        <th>Código</th>
        <th>Distrito</th>
        <th>Empresa</th>
        <th>Total lbs</th>
        <th>% Llenado</th>
        <th>Costo/lb</th>
        <th>Total (Q)</th>
      </tr>
    </thead>
    <tbody>
      ${renderTableRows(detalle, detCols, 8)}
    </tbody>
  </table>
</body>
</html>`;
}

async function buildHistorialCostoPdfBuffer({ filtros, generadoPor, kpis, resumen, topContenedores, detalle }) {
  const html = buildHtml({ filtros, generadoPor, kpis, resumen, topContenedores, detalle });

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

module.exports = { buildHistorialCostoPdfBuffer };