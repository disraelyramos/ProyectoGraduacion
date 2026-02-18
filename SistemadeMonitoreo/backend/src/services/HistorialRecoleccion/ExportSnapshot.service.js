const pool = require("../../config/db");
const crypto = require("crypto");

function getSnapshotTtlMin() {
  const raw = process.env.EXPORT_SNAPSHOT_TTL_MIN;
  const n = parseInt(String(raw || "30"), 10);
  return Number.isFinite(n) && n > 0 ? n : 30;
}

async function crearSnapshot({ usuarioId, modulo, filtros }) {
  const exportId = crypto.randomUUID();
  const ttlMin = getSnapshotTtlMin();

  const sql = `
    INSERT INTO export_snapshots (export_id, usuario_id, modulo, filtros_json, expires_at)
    VALUES ($1, $2, $3, $4::jsonb, NOW() + ($5 || ' minutes')::interval)
    RETURNING export_id
  `;

  const { rows } = await pool.query(sql, [exportId, usuarioId, modulo, JSON.stringify(filtros), ttlMin]);
  return rows[0]?.export_id;
}

async function obtenerSnapshotValido({ exportId, usuarioId, modulo }) {
  const sql = `
    SELECT export_id, filtros_json
      FROM export_snapshots
     WHERE export_id = $1
       AND usuario_id = $2
       AND modulo = $3
       AND expires_at > NOW()
     LIMIT 1
  `;
  const { rows } = await pool.query(sql, [exportId, usuarioId, modulo]);
  return rows[0] || null;
}

module.exports = { crearSnapshot, obtenerSnapshotValido };
