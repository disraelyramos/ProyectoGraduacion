// backend/src/controllers/Codigocontenedor/CodigoContenedor.controller.js
const pool = require("../../config/db");

// ===============================
// Helpers (limpios y reutilizables)
// ===============================
function requireAuth(req, res) {
  if (!req.user || !req.user.id_usuario) {
    res.status(401).json({ message: "Usuario no autenticado" });
    return false;
  }
  return true;
}

function toInt(v, fallback = null) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

function normSearch(v) {
  const s = String(v || "").trim();
  if (!s) return "";
  return s.length > 50 ? s.slice(0, 50) : s; // evita abusos
}

// ===============================
// GET /api/codigo-contenedor?search=CNT&page=1&limit=20
// Devuelve lista para select (id + codigo)
// ===============================
exports.listar = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const search = normSearch(req.query?.search);
  const page = clamp(toInt(req.query?.page, 1), 1, 999999);
  const limit = clamp(toInt(req.query?.limit, 20), 1, 100);
  const offset = (page - 1) * limit;

  // WHERE seguro (parametrizado)
  const where = search ? `WHERE c.codigo ILIKE '%' || $1 || '%'` : "";
  const paramsBase = search ? [search] : [];

  try {
    const client = await pool.connect();
    try {
      // total
      const countSql = `
        SELECT COUNT(*)::int AS total
        FROM contenedores c
        ${where}
      `;
      const countRes = await client.query(countSql, paramsBase);
      const total = countRes.rows?.[0]?.total || 0;

      // data
      const dataSql = `
        SELECT
          c.id_contenedor AS id,
          c.codigo
        FROM contenedores c
        ${where}
        ORDER BY c.codigo ASC
        LIMIT $${paramsBase.length + 1}
        OFFSET $${paramsBase.length + 2}
      `;
      const dataParams = [...paramsBase, limit, offset];
      const dataRes = await client.query(dataSql, dataParams);

      const rows = (dataRes.rows || []).map((r) => ({
        id: Number(r.id),
        codigo: r.codigo,
      }));

      return res.json({
        message: "Contenedores obtenidos correctamente.",
        page,
        limit,
        total,
        data: rows,
      });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Error listar contenedores:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};
