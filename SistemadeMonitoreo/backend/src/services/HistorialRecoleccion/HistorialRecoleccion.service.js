const pool = require("../../config/db");

function normOrder(v) {
  const s = String(v || "DESC").toUpperCase();
  return s === "ASC" ? "ASC" : "DESC";
}

async function consultarHistorial(filtros, opciones = {}) {
  const {
    buscarPor,      // "codigo" | "tipo"
    valorBusqueda,  // string
    fechaInicio,    // YYYY-MM-DD
    fechaFin,       // YYYY-MM-DD
    order,          // "ASC" | "DESC"
  } = filtros;

  const { paginado = true, limit = 10, offset = 0 } = opciones;
  const safeOrder = normOrder(order);

  const client = await pool.connect();
  try {
    let where = `
      WHERE r.fecha_recoleccion::date BETWEEN $1::date AND $2::date
    `;
    const paramsBase = [fechaInicio, fechaFin];

    if (buscarPor === "codigo") {
      paramsBase.push(valorBusqueda);
      where += ` AND c.codigo ILIKE '%' || $3 || '%' `;
    } else {
      paramsBase.push(valorBusqueda);
      where += ` AND tr.nombre ILIKE '%' || $3 || '%' `;
    }

    const countSql = `
      SELECT COUNT(*)::int AS total
        FROM recolecciones r
        JOIN contenedores c ON c.id_contenedor = r.contenedor_id
        LEFT JOIN tipos_residuo tr ON tr.id = c.id_tipo_residuo
      ${where}
    `;
    const countRes = await client.query(countSql, paramsBase);
    const total = countRes.rows?.[0]?.total || 0;

    if (total === 0) return { total: 0, detalle: [], pesaje: [] };

    const pagSql = paginado ? ` LIMIT $4 OFFSET $5 ` : ``;

    const detalleSql = `
      SELECT
        r.id AS recoleccion_id,
        c.codigo AS codigo_contenedor,

        -- ✅ FORMATO FECHA (Guatemala): DD/MM/YY HH:MM
        to_char(r.fecha_recoleccion AT TIME ZONE 'America/Guatemala', 'DD/MM/YY HH24:MI') AS fecha_recoleccion_fmt,

        d.nombre AS distrito,
        tr.nombre AS tipo_residuo,
        r.numero_recibo,
        r.responsable,
        er.nombre AS empresa_recolectora,
        r.porcentaje_pendiente,
        r.cantidad_libras_pendientes,
        r.observaciones
      FROM recolecciones r
      JOIN contenedores c ON c.id_contenedor = r.contenedor_id
      LEFT JOIN tipos_residuo tr ON tr.id = c.id_tipo_residuo
      LEFT JOIN distritos d ON d.id = r.distrito_id
      LEFT JOIN empresas_recolectoras er ON er.id = r.empresa_id
      ${where}
      ORDER BY r.fecha_recoleccion ${safeOrder}, r.id ${safeOrder}
      ${pagSql}
    `;

    const detalleParams = paginado ? [...paramsBase, limit, offset] : paramsBase;
    const detRes = await client.query(detalleSql, detalleParams);
    const detalleRows = detRes.rows || [];

    const detalle = detalleRows.map((r) => ({
      recoleccion_id: Number(r.recoleccion_id),
      codigo: r.codigo_contenedor,
      fecha: r.fecha_recoleccion_fmt, // ✅ ya viene dd/mm/yy hh:mm
      distrito: r.distrito,
      tipo_residuo: r.tipo_residuo,
      numero_recibo: r.numero_recibo,
      responsable: r.responsable,
      empresa_recolectora: r.empresa_recolectora,
      porcentaje_pendiente: r.porcentaje_pendiente,
      cantidad_libras_pendientes: r.cantidad_libras_pendientes,
      observaciones: r.observaciones,
    }));

    const ids = detalleRows.map((r) => Number(r.recoleccion_id)).filter(Boolean);

    let pesaje = [];
    if (ids.length > 0) {
      const pesajeSql = `
        SELECT
          h.recoleccion_id,
          h.total_en_libras,
          h.porcentaje_recolectado,
          h.porcentaje_llenado,
          h.costo_por_libra_aplicado,
          h.total_costo_q
        FROM historial_calculo_costos h
        WHERE h.recoleccion_id = ANY($1::int[])
      `;
      const pesajeRes = await client.query(pesajeSql, [ids]);

      const pesajeMap = new Map();
      for (const row of pesajeRes.rows || []) pesajeMap.set(Number(row.recoleccion_id), row);

      pesaje = detalleRows.map((r) => {
        const k = Number(r.recoleccion_id);
        const p = pesajeMap.get(k);

        return {
          recoleccion_id: k,
          total_en_libras: p ? p.total_en_libras : null,
          porcentaje_recolectado: p ? p.porcentaje_recolectado : null,
          porcentaje_llenado: p ? p.porcentaje_llenado : null,
          costo_por_libra_aplicado: p ? p.costo_por_libra_aplicado : null,
          total_costo_q: p ? p.total_costo_q : null,
        };
      });
    } else {
      pesaje = detalleRows.map((r) => ({
        recoleccion_id: Number(r.recoleccion_id),
        total_en_libras: null,
        porcentaje_recolectado: null,
        porcentaje_llenado: null,
        costo_por_libra_aplicado: null,
        total_costo_q: null,
      }));
    }

    return { total, detalle, pesaje };
  } finally {
    client.release();
  }
}

module.exports = { consultarHistorial };
