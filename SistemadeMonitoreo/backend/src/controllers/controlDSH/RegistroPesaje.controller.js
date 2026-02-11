// backend/controllers/controlDSH/RegistroPesaje.controller.js
const pool = require("../../config/db");
const xss = require("xss");
const jwt = require("jsonwebtoken");

// ===============================
// Constantes
// ===============================
const ESTADO_PROCESO = {
  EN_PROCESO: "EN_PROCESO",
  FINALIZADO: "FINALIZADO",
  CANCELADO: "CANCELADO",
};

// estados_contenedor (según tu BD)
const ESTADO_CONTENEDOR = {
  ACTIVO: 1,
  INACTIVO: 2,
};

// Lecturas válidas
const FUENTE_SENSOR = "sensor";
const LECTURA_OK = "normal";

// Tipos DSH (según tu regla: solo 1 de cada tipo)
const TIPOS_DSH = [1, 2];

const PROCESO_SECRET = process.env.PROCESO_JWT_SECRET || process.env.JWT_SECRET;

// ===============================
// Helpers
// ===============================
function requireAuth(req, res) {
  if (!req.user || !req.user.id_usuario) {
    res.status(401).json({ message: "Usuario no autenticado" });
    return false;
  }
  return true;
}

function toInt(v) {
  const n = Number.parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function toNumber(v) {
  const n = Number(String(v));
  return Number.isFinite(n) ? n : null;
}

function clamp0to100(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  if (x < 0) return 0;
  if (x > 100) return 100;
  return x;
}

function isInactiveById(estado_id) {
  return Number(estado_id) === ESTADO_CONTENEDOR.INACTIVO;
}

// ===============================
// Queries reutilizables (solo lo necesario)
// ===============================
async function getProcesoActivo(client, id_usuario) {
  const { rows } = await client.query(
    `SELECT id, contenedor_id, id_tipo_residuo
       FROM historial_calculo_costos
      WHERE calculado_por = $1
        AND estado_proceso = $2
      ORDER BY id DESC
      LIMIT 1`,
    [id_usuario, ESTADO_PROCESO.EN_PROCESO]
  );
  return rows[0] || null;
}

async function getContenedorPorTipo(client, id_tipo_residuo) {
  const { rows } = await client.query(
    `SELECT
        c.id_contenedor,
        c.codigo,
        c.id_tipo_residuo,
        c.estado_id,
        ec.nombre AS estado_nombre,
        c.estado_actual_litros,
        c.capacidad_max_litros,
        c.estado_actual_lb,
        c.capacidad_max_lb
     FROM contenedores c
     JOIN estados_contenedor ec ON ec.id = c.estado_id
    WHERE c.id_tipo_residuo = $1
    LIMIT 1`,
    [id_tipo_residuo]
  );
  return rows[0] || null;
}

async function getUltimaLecturaSensorOK(client, contenedor_id) {
  const { rows } = await client.query(
    `SELECT id, valor, fecha_hora
       FROM lecturas
      WHERE contenedor_id = $1
        AND fuente_lectura = $2
        AND estado_lectura = $3
      ORDER BY fecha_hora DESC
      LIMIT 1`,
    [contenedor_id, FUENTE_SENSOR, LECTURA_OK]
  );
  return rows[0] || null;
}

// ===============================
// COSTO GLOBAL (sin nuevas tablas)
// ===============================
async function getContenedoresGlobalDSH(client) {
  const { rows } = await client.query(
    `SELECT id_contenedor, id_tipo_residuo
       FROM contenedores
      WHERE id_tipo_residuo = ANY($1::int[])
      ORDER BY id_tipo_residuo ASC, id_contenedor ASC`,
    [TIPOS_DSH]
  );

  const tipo1 = rows.find((r) => Number(r.id_tipo_residuo) === TIPOS_DSH[0]);
  const tipo2 = rows.find((r) => Number(r.id_tipo_residuo) === TIPOS_DSH[1]);

  return {
    tipo1: tipo1 ? Number(tipo1.id_contenedor) : null,
    tipo2: tipo2 ? Number(tipo2.id_contenedor) : null,
  };
}

async function getCostoVigenteGlobal(client) {
  // Solo considera contenedores tipo 1/2
  const { rows } = await client.query(
    `SELECT cc.id, cc.contenedor_id, cc.costo_por_libra, cc.vigente_desde
       FROM costos_contenedor cc
       JOIN contenedores c ON c.id_contenedor = cc.contenedor_id
      WHERE cc.activo = TRUE
        AND c.id_tipo_residuo = ANY($1::int[])
      ORDER BY cc.vigente_desde DESC
      LIMIT 1`,
    [TIPOS_DSH]
  );
  return rows[0] || null;
}

async function getCostoVigentePorContenedor(client, contenedor_id) {
  const { rows } = await client.query(
    `SELECT id, costo_por_libra
       FROM costos_contenedor
      WHERE contenedor_id = $1
        AND activo = TRUE
      LIMIT 1`,
    [contenedor_id]
  );
  return rows[0] || null;
}

// ===============================
// Foto 1: Iniciar proceso
// ===============================
exports.iniciarProceso = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const id_tipo_residuo = toInt(req.body?.id_tipo_residuo);
  if (!id_tipo_residuo) {
    return res.status(400).json({ message: "id_tipo_residuo es requerido" });
  }

  const client = await pool.connect();
  try {
    const id_usuario = req.user.id_usuario;

    const activo = await getProcesoActivo(client, id_usuario);
    if (activo) {
      return res.status(409).json({
        message: "Tenés un proceso en curso. Finalizalo o cancelalo para iniciar otro.",
        proceso_activo_id: activo.id,
      });
    }

    const contenedor = await getContenedorPorTipo(client, id_tipo_residuo);
    if (!contenedor) {
      return res.status(404).json({ message: "No existe contenedor para el tipo seleccionado" });
    }

    if (isInactiveById(contenedor.estado_id)) {
      return res.status(409).json({
        message: "Contenedor inactivo. No se puede iniciar el proceso.",
        contenedor: { codigo: contenedor.codigo },
      });
    }

    // % llenado SOLO por LITROS (tu regla)
    const litros = toNumber(contenedor.estado_actual_litros) ?? 0;
    const capLitros = toNumber(contenedor.capacidad_max_litros) ?? 0;
    const porcentaje_llenado =
      capLitros > 0 ? clamp0to100((litros / capLitros) * 100) : 0;

    return res.json({
      id_tipo_residuo,
      contenedor: {
        id_contenedor: contenedor.id_contenedor,
        codigo: contenedor.codigo,
        estado_id: contenedor.estado_id,
        estado: contenedor.estado_nombre,

        estado_actual_litros: litros,
        capacidad_max_litros: capLitros,
        porcentaje_llenado: Number(porcentaje_llenado.toFixed(2)),

        // útil para costos (Foto 3)
        estado_actual_lb: toNumber(contenedor.estado_actual_lb) ?? 0,
        capacidad_max_lb: toNumber(contenedor.capacidad_max_lb) ?? 0,
      },
    });
  } catch (err) {
    console.error("Error iniciarProceso:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

// ===============================
// Foto 2: GET costo global (último vigente)
// ===============================
exports.obtenerCostoGlobal = async (req, res) => {
  if (!requireAuth(req, res)) return;

  try {
    const costo = await getCostoVigenteGlobal(pool);
    if (!costo) {
      return res.status(404).json({ message: "No hay costo global vigente" });
    }

    return res.json({
      costo_vigente_id: costo.id,
      costo_por_libra: costo.costo_por_libra,
      vigente_desde: costo.vigente_desde,
    });
  } catch (err) {
    console.error("Error obtenerCostoGlobal:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ===============================
// Foto 2: POST costo global (guardar y aplicar a ambos tipos 1/2)
// ===============================
exports.guardarCostoGlobal = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const costoNuevo = toNumber(req.body?.costo_por_libra);
  if (costoNuevo === null || costoNuevo < 0) {
    return res.status(400).json({ message: "Costo inválido" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const id_usuario = req.user.id_usuario;

    const { tipo1, tipo2 } = await getContenedoresGlobalDSH(client);
    if (!tipo1 || !tipo2) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "Debe existir 1 contenedor tipo 1 y 1 contenedor tipo 2 para aplicar costo global",
      });
    }

    const contenedores = [tipo1, tipo2];

    // Para historial: tomamos el costo global vigente anterior
    const vigenteAnterior = await getCostoVigenteGlobal(client);
    const costoAnterior = vigenteAnterior ? Number(vigenteAnterior.costo_por_libra) : null;

    for (const contenedor_id of contenedores) {
      // Cerrar vigente anterior del contenedor (si existe)
      await client.query(
        `UPDATE costos_contenedor
            SET activo = FALSE,
                vigente_hasta = NOW(),
                actualizado_por = $1,
                actualizado_en = NOW()
          WHERE contenedor_id = $2
            AND activo = TRUE`,
        [id_usuario, contenedor_id]
      );

      // Insertar nuevo vigente
      await client.query(
        `INSERT INTO costos_contenedor
           (contenedor_id, costo_por_libra, activo, vigente_desde, vigente_hasta, actualizado_por, actualizado_en)
         VALUES
           ($1, $2, TRUE, NOW(), NULL, $3, NOW())`,
        [contenedor_id, costoNuevo, id_usuario]
      );

      // Historial por contenedor
      await client.query(
        `INSERT INTO historial_costos_contenedor
           (contenedor_id, costo_anterior, costo_nuevo, cambiado_por, origen, motivo, cambiado_en)
         VALUES
           ($1, $2, $3, $4, 'manual', 'Costo global (tipos 1 y 2)', NOW())`,
        [contenedor_id, costoAnterior, costoNuevo, id_usuario]
      );
    }

    await client.query("COMMIT");

    return res.json({
      message: "Costo global guardado y aplicado a ambos contenedores",
      costo_por_libra: costoNuevo,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error guardarCostoGlobal:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

// ===============================
// Foto 3: Guardar cálculo (inicia proceso) - SOLO lee costo vigente
// ===============================

exports.guardarCalculo = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const id_tipo_residuo = toInt(req.body?.id_tipo_residuo);
  const contenedor_id = toInt(req.body?.contenedor_id);

  if (!id_tipo_residuo || !contenedor_id) {
    return res.status(400).json({ message: "id_tipo_residuo y contenedor_id son requeridos" });
  }

  if (!PROCESO_SECRET) {
    return res.status(500).json({ message: "Falta configurar PROCESO_JWT_SECRET (o JWT_SECRET)" });
  }

  const client = await pool.connect();
  try {
    const id_usuario = req.user.id_usuario;

    // 1) validar contenedor por tipo y activo
    const contenedor = await getContenedorPorTipo(client, id_tipo_residuo);
    if (!contenedor || Number(contenedor.id_contenedor) !== contenedor_id) {
      return res.status(400).json({ message: "Contenedor no corresponde al tipo seleccionado" });
    }

    if (isInactiveById(contenedor.estado_id)) {
      return res.status(409).json({ message: "Contenedor inactivo. Proceso bloqueado." });
    }

    // 2) costo vigente (debe existir por Foto 2)
    const costoVigente = await getCostoVigentePorContenedor(client, contenedor_id);
    if (!costoVigente) {
      return res.status(400).json({
        message: "No existe costo vigente. Debe registrarlo en el modal de costo antes de calcular.",
      });
    }

    const costo_por_libra_aplicado = Number(costoVigente.costo_por_libra) || 0;
    const costo_vigente_id = Number(costoVigente.id);

    // 3) lectura sensor OK (OBLIGATORIA)
    const ultimaLectura = await getUltimaLecturaSensorOK(client, contenedor_id);
    if (!ultimaLectura) {
      return res.status(400).json({
        message: "No hay lectura del sensor registrada para este contenedor",
      });
    }
    const lectura_id = Number(ultimaLectura.id);
    const lectura_valor = Number(ultimaLectura.valor);
    const lectura_fecha_hora = ultimaLectura.fecha_hora;

    // 4) totales (base del proceso)
    const total_en_libras = toNumber(contenedor.estado_actual_lb) ?? 0;
    const total_costo_q = Number((total_en_libras * costo_por_libra_aplicado).toFixed(2));

    // 5) % llenado (litros)
    const litros = toNumber(contenedor.estado_actual_litros) ?? 0;
    const capLitros = toNumber(contenedor.capacidad_max_litros) ?? 0;
    const porcentaje_llenado = capLitros > 0 ? clamp0to100((litros / capLitros) * 100) : 0;

    // 6) token de proceso (expira rápido) — incluye lectura_id obligatoria
    const procesoPayload = {
      // amarrado al usuario
      uid: id_usuario,

      // identidad del proceso
      contenedor_id,
      id_tipo_residuo,

      // base inmutable del cálculo
      total_en_libras,
      porcentaje_llenado: Number(porcentaje_llenado.toFixed(2)),

      // costo aplicado en el momento del cálculo
      costo_vigente_id,
      costo_por_libra_aplicado,
      total_costo_q,
      fuente_costo: "vigente",

      //  referencia obligatoria del sensor
      lectura_id,
      lectura_sensor_lb: lectura_valor,
      lectura_sensor_fecha_hora: lectura_fecha_hora,
    };

    const proceso_token = jwt.sign(procesoPayload, PROCESO_SECRET, { expiresIn: "15m" });

    return res.json({
      message: "Preview calculado (no se guardó nada).",
      proceso_token,

      // lo que muestra la UI
      contenedor: {
        codigo: contenedor.codigo,
        total_en_libras,
        estado_actual_litros: litros,
        capacidad_max_litros: capLitros,
        porcentaje_llenado: Number(porcentaje_llenado.toFixed(2)),
      },
      costo_por_libra_aplicado,
      total_costo_q,

      // transparencia / auditoría
      lectura_referencia: {
        lectura_id,
        valor: lectura_valor,
        fecha_hora: lectura_fecha_hora,
      },
    });
  } catch (err) {
    console.error("Error guardarCalculo (preview):", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};

// ===============================
// Foto 4: Guardar recolección (finaliza proceso)

exports.guardarRecoleccion = async (req, res) => {
  if (!requireAuth(req, res)) return;

  if (!PROCESO_SECRET) {
    return res.status(500).json({ message: "Falta configurar PROCESO_JWT_SECRET (o JWT_SECRET)" });
  }

  const proceso_token = String(req.body?.proceso_token || "").trim();
  const empresa_id = toInt(req.body?.empresa_id);
  const distrito_id = toInt(req.body?.distrito_id);

  const numero_recibo = req.body?.numero_recibo ? xss(String(req.body.numero_recibo).trim()) : "";
  const cantidad_libras_pendientes = toNumber(req.body?.cantidad_libras_pendientes);

  
  const observaciones_raw = req.body?.observaciones ? xss(String(req.body.observaciones).trim()) : "";
  const observaciones = observaciones_raw; // siempre string (no null)

  if (!proceso_token) return res.status(400).json({ message: "proceso_token es requerido" });
  if (!empresa_id || !distrito_id)
    return res.status(400).json({ message: "empresa_id y distrito_id son requeridos" });
  if (!numero_recibo) return res.status(400).json({ message: "Número de recibo es obligatorio" });
  if (cantidad_libras_pendientes === null || cantidad_libras_pendientes < 0) {
    return res.status(400).json({ message: "Cantidad en libras inválida" });
  }

  // 1) validar token + amarrar a usuario
  let proceso;
  try {
    proceso = jwt.verify(proceso_token, PROCESO_SECRET);
  } catch {
    return res
      .status(401)
      .json({ message: "Token de proceso inválido o expirado. Recalcule el proceso." });
  }

  const id_usuario = req.user.id_usuario;
  if (Number(proceso?.uid) !== Number(id_usuario)) {
    return res.status(403).json({ message: "Token de proceso no corresponde al usuario autenticado" });
  }

  // 2) extraer datos del token (base inmutable)
  const contenedor_id = toInt(proceso?.contenedor_id);
  const id_tipo_residuo = toInt(proceso?.id_tipo_residuo);

  const base_total_lb = toNumber(proceso?.total_en_libras);
  const porcentaje_llenado = toNumber(proceso?.porcentaje_llenado);

  const costo_por_libra_aplicado = toNumber(proceso?.costo_por_libra_aplicado);
  const total_costo_q = toNumber(proceso?.total_costo_q);
  const costo_vigente_id = toInt(proceso?.costo_vigente_id);

  // lectura_id OBLIGATORIA (ya la exigís en guardarCalculo)
  const lectura_id = toInt(proceso?.lectura_id);

  const fuente_costo = String(proceso?.fuente_costo || "vigente");

  // 3) validar token completo
  if (!contenedor_id || !id_tipo_residuo) {
    return res.status(400).json({ message: "Token de proceso incompleto. Recalcule el proceso." });
  }
  if (base_total_lb === null || base_total_lb < 0) {
    return res.status(400).json({ message: "Token inválido: total_en_libras inválido. Recalcule." });
  }
  if (porcentaje_llenado === null || porcentaje_llenado < 0) {
    return res.status(400).json({ message: "Token inválido: porcentaje_llenado inválido. Recalcule." });
  }
  if (costo_por_libra_aplicado === null || costo_por_libra_aplicado < 0) {
    return res.status(400).json({ message: "Token inválido: costo_por_libra inválido. Recalcule." });
  }
  if (total_costo_q === null || total_costo_q < 0) {
    return res.status(400).json({ message: "Token inválido: total_costo inválido. Recalcule." });
  }
  if (!costo_vigente_id) {
    return res.status(400).json({ message: "Token inválido: costo_vigente_id faltante. Recalcule." });
  }
  if (!lectura_id) {
    return res.status(400).json({ message: "No hay lectura del sensor en el proceso. Recalcule." });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 4) validar contenedor activo y obtener código
    const { rows: contRows } = await client.query(
      `SELECT c.codigo, c.estado_id
         FROM contenedores c
        WHERE c.id_contenedor = $1
        LIMIT 1`,
      [contenedor_id]
    );

    if (contRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "Contenedor no encontrado" });
    }
    if (isInactiveById(contRows[0].estado_id)) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Contenedor inactivo. No se puede guardar recolección." });
    }

    // 5) validar que lectura_id existe y corresponde al contenedor (no dejar lectura_id huérfano)
    const { rows: lecturaRows } = await client.query(
      `SELECT id
         FROM lecturas
        WHERE id = $1
          AND contenedor_id = $2
        LIMIT 1`,
      [lectura_id, contenedor_id]
    );
    if (lecturaRows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La lectura del sensor referenciada no existe o no corresponde al contenedor. Recalcule.",
      });
    }

    // 6) recibo único
    const { rows: reciboRows } = await client.query(
      `SELECT id
         FROM recolecciones
        WHERE numero_recibo = $1
        LIMIT 1`,
      [numero_recibo]
    );
    if (reciboRows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(409).json({ message: "Número de recibo ya existe" });
    }

    // 7) validación base: pendiente <= total proceso
    if (base_total_lb > 0 && cantidad_libras_pendientes > base_total_lb) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        message: "La cantidad pendiente no puede superar el total en libras del proceso",
        base_total_lb,
      });
    }

    // 8) % pendiente y recolectado (base = total_en_libras del proceso)
    let porcentaje_pendiente = 0;
    if (base_total_lb > 0) {
      porcentaje_pendiente = clamp0to100((cantidad_libras_pendientes / base_total_lb) * 100);
      porcentaje_pendiente = Number(porcentaje_pendiente.toFixed(2));
    }
    const porcentaje_recolectado = Number((100 - porcentaje_pendiente).toFixed(2));

    // 9) INSERT recolección (observaciones SIEMPRE string)
    const responsable = String(req.user.nombre || req.user.usuario || "Responsable").trim() || "Responsable";

    const insertRec = await client.query(
      `INSERT INTO recolecciones
        (contenedor_id, usuario_id, empresa_id, distrito_id, fecha_recoleccion,
         numero_recibo, responsable, porcentaje_pendiente, cantidad_libras_pendientes, observaciones)
       VALUES
        ($1, $2, $3, $4, NOW(),
         $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        contenedor_id,
        id_usuario,
        empresa_id,
        distrito_id,
        numero_recibo,
        responsable,
        porcentaje_pendiente,
        cantidad_libras_pendientes,
        observaciones, // "" si no escribió nada
      ]
    );

    const recoleccion_id = insertRec.rows[0].id;

    // 10) INSERT historial COMPLETO (FINALIZADO, sin NULLs clave)
    const insertHist = await client.query(
      `INSERT INTO historial_calculo_costos
        (contenedor_id, id_tipo_residuo, calculado_por, recoleccion_id,
         total_en_libras, porcentaje_recolectado, porcentaje_llenado,
         costo_por_libra_aplicado, total_costo_q, fuente_costo,
         costo_vigente_id, lectura_id, calculado_en, observaciones, estado_proceso)
       VALUES
        ($1, $2, $3, $4,
         $5, $6, $7,
         $8, $9, $10,
         $11, $12, NOW(), $13, $14)
       RETURNING id, calculado_en`,
      [
        contenedor_id,
        id_tipo_residuo,
        id_usuario,
        recoleccion_id,

        base_total_lb,
        porcentaje_recolectado,
        Number(clamp0to100(porcentaje_llenado).toFixed(2)),

        costo_por_libra_aplicado,
        Number(total_costo_q.toFixed(2)),
        fuente_costo,

        costo_vigente_id,
        lectura_id,
        observaciones, // "" si no escribió nada
        ESTADO_PROCESO.FINALIZADO,
      ]
    );

    await client.query("COMMIT");

    return res.json({
      message: "Recolección guardada. Proceso finalizado.",
      recoleccion_id,
      historial_calculo_id: insertHist.rows[0].id,
      calculado_en: insertHist.rows[0].calculado_en,
      contenedor: { codigo: contRows[0].codigo },
      base_total_lb,
      porcentaje_pendiente,
      porcentaje_recolectado,
      lectura_id,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Error guardarRecoleccion (final):", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};


// ===============================
// Cancelar proceso
// ===============================
exports.cancelarProceso = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const historial_calculo_id = toInt(req.body?.historial_calculo_id);
  if (!historial_calculo_id) {
    return res.status(400).json({ message: "historial_calculo_id es requerido" });
  }

  try {
    const id_usuario = req.user.id_usuario;

    const result = await pool.query(
      `UPDATE historial_calculo_costos
          SET estado_proceso = $1
        WHERE id = $2
          AND calculado_por = $3
          AND estado_proceso = $4
       RETURNING id`,
      [ESTADO_PROCESO.CANCELADO, historial_calculo_id, id_usuario, ESTADO_PROCESO.EN_PROCESO]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ message: "No hay proceso activo para cancelar" });
    }

    return res.json({ message: "Proceso cancelado", historial_calculo_id });
  } catch (err) {
    console.error("Error cancelarProceso:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  }
};

// ===============================
// Preview % pendiente (NO guarda, solo calcula en tiempo real)
// ===============================
exports.previewPendiente = async (req, res) => {
  if (!requireAuth(req, res)) return;

  const historial_calculo_id = toInt(req.body?.historial_calculo_id);
  const cantidad_libras_pendientes = toNumber(req.body?.cantidad_libras_pendientes);

  if (!historial_calculo_id) {
    return res.status(400).json({ message: "historial_calculo_id es requerido" });
  }
  if (cantidad_libras_pendientes === null || cantidad_libras_pendientes < 0) {
    return res.status(400).json({ message: "Cantidad en libras inválida" });
  }

  const client = await pool.connect();
  try {
    const id_usuario = req.user.id_usuario;

    // 1) Validar proceso EN_PROCESO y dueño + traer base total_en_libras
    const { rows: calcRows } = await client.query(
      `SELECT id, contenedor_id, estado_proceso, total_en_libras
         FROM historial_calculo_costos
        WHERE id = $1
          AND calculado_por = $2
        LIMIT 1`,
      [historial_calculo_id, id_usuario]
    );

    if (calcRows.length === 0) {
      return res.status(404).json({ message: "Proceso no encontrado" });
    }
    if (calcRows[0].estado_proceso !== ESTADO_PROCESO.EN_PROCESO) {
      return res.status(409).json({ message: "Este proceso ya fue finalizado o cancelado" });
    }

    const contenedor_id = Number(calcRows[0].contenedor_id);
    const base_total_lb = toNumber(calcRows[0].total_en_libras) ?? 0;

    // 2) Validar contenedor activo (regla de negocio)
    const { rows: contRows } = await client.query(
      `SELECT c.estado_id
         FROM contenedores c
        WHERE c.id_contenedor = $1
        LIMIT 1`,
      [contenedor_id]
    );

    if (contRows.length === 0) {
      return res.status(404).json({ message: "Contenedor no encontrado" });
    }
    if (isInactiveById(contRows[0].estado_id)) {
      return res.status(409).json({ message: "Contenedor inactivo. No se puede calcular pendiente." });
    }

    // 3) Validación: pendiente no puede exceder el total del proceso
    if (base_total_lb > 0 && cantidad_libras_pendientes > base_total_lb) {
      return res.status(400).json({
        message: "La cantidad pendiente no puede superar el total en libras del proceso",
        base_total_lb,
      });
    }

    // 4) % pendiente (si base 0 => 0)
    let porcentaje_pendiente = 0;
    if (base_total_lb > 0) {
      porcentaje_pendiente = clamp0to100((cantidad_libras_pendientes / base_total_lb) * 100);
      porcentaje_pendiente = Number(porcentaje_pendiente.toFixed(2));
    }

    return res.json({
      porcentaje_pendiente,
      base_total_lb,
    });
  } catch (err) {
    console.error("Error previewPendiente:", err);
    return res.status(500).json({ message: "Error interno del servidor" });
  } finally {
    client.release();
  }
};