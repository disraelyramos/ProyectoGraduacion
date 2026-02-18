const pool = require("../../config/db");

async function registrarAuditoriaExportacion(payload) {
  const sql = `
    INSERT INTO auditoria_exportaciones
      (usuario_id, usuario, rol, modulo, reporte, formato, export_id,
       filtros_json, total_registros, resumen_json, estado, error_mensaje,
       ip_origen, user_agent)
    VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10::jsonb,$11,$12,$13,$14)
  `;

  const params = [
    payload.usuario_id,
    payload.usuario,
    payload.rol,
    payload.modulo,
    payload.reporte,
    payload.formato,
    payload.export_id,
    JSON.stringify(payload.filtros_json),
    payload.total_registros,
    payload.resumen_json ? JSON.stringify(payload.resumen_json) : null,
    payload.estado,
    payload.error_mensaje || null,
    payload.ip_origen || null,
    payload.user_agent || null,
  ];

  await pool.query(sql, params);
}

module.exports = { registrarAuditoriaExportacion };
