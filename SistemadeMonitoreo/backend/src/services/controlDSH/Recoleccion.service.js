
"use strict";

const pool = require("../../config/db");

// ======================================================
// CONSTANTES
// ======================================================

const ESTADO_PROCESO = {
  EN_PROCESO: "EN_PROCESO",
  FINALIZADO: "FINALIZADO",
  CANCELADO: "CANCELADO",
};

const ESTADO_CONTENEDOR = {
  ACTIVO: 1,
  INACTIVO: 2,
};

const ESTADO_ALERTA = {
  ACTIVA: "ACTIVA",
  RESUELTA: "RESUELTA",
};

// CORRECCIÓN:
// La recolección cierra también las alertas predictivas
// del contenedor, sin afectar otros contenedores.
const TIPOS_ALERTA_REINICIO = [
  "NIVEL_AVISO",
  "NIVEL_ALTO",
  "PREDICTIVA",
];

const ADVISORY_LOCK_RECIBO = 32004;

// ======================================================
// ERROR CONTROLADO
// ======================================================

class RecoleccionError extends Error {
  constructor(statusCode, message, details = {}) {
    super(message);
    this.name = "RecoleccionError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

// ======================================================
// HELPERS
// ======================================================

function toInt(value) {
  const numero = Number.parseInt(String(value), 10);
  return Number.isFinite(numero) ? numero : null;
}

function toNumber(value) {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : null;
}

function redondear2(value) {
  return Number(Number(value).toFixed(2));
}

function tieneMaximoDosDecimales(numero) {
  const multiplicado = numero * 100;

  return Math.abs(
    multiplicado - Math.round(multiplicado)
  ) < 0.0000001;
}

// ======================================================
// VERIFICAR CÁLCULO DEL PROCESO
// ======================================================

function procesoTieneCalculo(proceso) {
  if (!proceso) return false;

  const totalLb = toNumber(proceso.total_en_libras);
  const porcentajeLlenado = toNumber(
    proceso.porcentaje_llenado
  );
  const costoPorLibra = toNumber(
    proceso.costo_por_libra_aplicado
  );
  const totalCosto = toNumber(proceso.total_costo_q);
  const costoId = toInt(proceso.costo_vigente_id);
  const lecturaId = toInt(proceso.lectura_id);

  return (
    totalLb !== null &&
    totalLb >= 0 &&
    porcentajeLlenado !== null &&
    porcentajeLlenado >= 0 &&
    porcentajeLlenado <= 100 &&
    costoPorLibra !== null &&
    costoPorLibra >= 0 &&
    totalCosto !== null &&
    totalCosto >= 0 &&
    Boolean(costoId) &&
    Boolean(lecturaId)
  );
}

// ======================================================
// OBTENER PROCESO ACTIVO
// ======================================================

async function obtenerProcesoActivo(
  client,
  { usuarioId, bloquear = false }
) {
  const bloqueoSQL = bloquear
    ? "FOR UPDATE OF h"
    : "";

  const { rows } = await client.query(
    `
      SELECT
        h.id,
        h.contenedor_id,
        h.id_tipo_residuo,
        h.calculado_por,
        h.recoleccion_id,
        h.total_en_libras,
        h.porcentaje_recolectado,
        h.porcentaje_llenado,
        h.costo_por_libra_aplicado,
        h.total_costo_q,
        h.fuente_costo,
        h.costo_vigente_id,
        h.lectura_id,
        h.calculado_en,
        h.estado_proceso,
        h.observaciones,
        c.codigo AS codigo_contenedor,
        c.estado_id AS contenedor_estado_id

      FROM historial_calculo_costos h

      JOIN contenedores c
        ON c.id_contenedor = h.contenedor_id

      WHERE h.calculado_por = $1
        AND h.estado_proceso = $2

      ORDER BY h.id DESC
      LIMIT 1

      ${bloqueoSQL}
    `,
    [
      usuarioId,
      ESTADO_PROCESO.EN_PROCESO,
    ]
  );

  return rows[0] || null;
}

// ======================================================
// REQUERIR PROCESO ACTIVO
// ======================================================

async function requerirProcesoActivo(
  client,
  { usuarioId, bloquear = false }
) {
  const proceso = await obtenerProcesoActivo(
    client,
    { usuarioId, bloquear }
  );

  if (!proceso) {
    throw new RecoleccionError(
      409,
      "No existe un proceso de pesaje activo.",
      { codigo: "PROCESO_NO_ACTIVO" }
    );
  }

  return proceso;
}

// ======================================================
// VALIDAR PROCESO PARA RECOLECCIÓN
// ======================================================

function validarProcesoFoto4(proceso) {
  if (
    proceso.estado_proceso !==
    ESTADO_PROCESO.EN_PROCESO
  ) {
    throw new RecoleccionError(
      409,
      "El proceso ya fue finalizado o cancelado.",
      { codigo: "PROCESO_NO_ACTIVO" }
    );
  }

  if (!procesoTieneCalculo(proceso)) {
    throw new RecoleccionError(
      409,
      "Debe calcular el peso antes de registrar la recolección.",
      { codigo: "CALCULO_PENDIENTE" }
    );
  }

  if (
    Number(proceso.contenedor_estado_id) ===
    ESTADO_CONTENEDOR.INACTIVO
  ) {
    throw new RecoleccionError(
      409,
      "El contenedor está inactivo. No se puede registrar la recolección.",
      { codigo: "CONTENEDOR_INACTIVO" }
    );
  }
}

// ======================================================
// VALIDAR LIBRAS PENDIENTES
// ======================================================

function validarLibrasPendientes(value) {
  const cantidad = toNumber(value);

  if (cantidad === null || cantidad < 0) {
    throw new RecoleccionError(
      400,
      "Cantidad en libras pendientes inválida.",
      { codigo: "LIBRAS_PENDIENTES_INVALIDAS" }
    );
  }

  if (!tieneMaximoDosDecimales(cantidad)) {
    throw new RecoleccionError(
      400,
      "La cantidad pendiente en libras puede tener máximo 2 decimales.",
      { codigo: "LIBRAS_PENDIENTES_DECIMALES" }
    );
  }

  return cantidad;
}

// ======================================================
// CALCULAR PORCENTAJES EN BACKEND
// ======================================================

function calcularPorcentajes({
  totalLb,
  pendientesLb,
}) {
  if (pendientesLb > totalLb) {
    throw new RecoleccionError(
      400,
      "La cantidad pendiente no puede superar el total en libras del proceso.",
      {
        codigo: "PENDIENTE_SUPERA_TOTAL",
        total_en_libras: redondear2(totalLb),
      }
    );
  }

  if (totalLb === 0) {
    return {
      porcentajePendiente: 0,
      porcentajeRecolectado: 0,
    };
  }

  const porcentajePendiente = redondear2(
    (pendientesLb / totalLb) * 100
  );

  const porcentajeRecolectado = redondear2(
    100 - porcentajePendiente
  );

  return {
    porcentajePendiente,
    porcentajeRecolectado,
  };
}

// ======================================================
// VALIDAR LECTURA DEL PROCESO
// ======================================================

async function validarLecturaProceso(client, proceso) {
  const lecturaId = toInt(proceso.lectura_id);
  const contenedorId = toInt(proceso.contenedor_id);

  if (!lecturaId || !contenedorId) {
    throw new RecoleccionError(
      409,
      "El proceso no contiene una lectura de peso válida.",
      { codigo: "LECTURA_NO_VALIDA" }
    );
  }

  const { rows } = await client.query(
    `
      SELECT id
      FROM lecturas
      WHERE id = $1
        AND contenedor_id = $2
      LIMIT 1
    `,
    [lecturaId, contenedorId]
  );

  if (rows.length === 0) {
    throw new RecoleccionError(
      409,
      "La lectura de peso del proceso ya no es válida.",
      { codigo: "LECTURA_NO_ENCONTRADA" }
    );
  }
}

// ======================================================
// REINICIAR ALERTAS POR RECOLECCIÓN
// ======================================================
//
// CORRECCIÓN PRINCIPAL:
//
// 1. Resuelve NIVEL_AVISO.
// 2. Resuelve NIVEL_ALTO.
// 3. Resuelve PREDICTIVA.
// 4. Reinicia las banderas del ciclo.
// 5. Registra la recolección responsable.
// 6. Mantiene el historial de alertas y envíos.
//
// No elimina registros.
// No modifica el otro contenedor.
// No modifica alertas PROGRAMADA.
//
// Se ejecuta dentro de la misma transacción
// de guardarRecoleccion().
//
// ======================================================

async function reiniciarAlertasPorRecoleccion(
  client,
  { contenedorId, recoleccionId }
) {
  const contenedorIdNumero = toInt(contenedorId);
  const recoleccionIdNumero = toInt(recoleccionId);

  if (
    !contenedorIdNumero ||
    !recoleccionIdNumero
  ) {
    throw new RecoleccionError(
      500,
      "No fue posible reiniciar el ciclo de alertas de la recolección.",
      { codigo: "REINICIO_ALERTAS_INVALIDO" }
    );
  }

  // ==================================================
  // 1. CERRAR ALERTAS ACTIVAS DEL CONTENEDOR
  // ==================================================
  //
  // Incluye las predictivas.
  // No se borran alertas ni envíos.
  //
  // El procesador WhatsApp debe comprobar
  // a.estado = 'ACTIVA' antes de enviar.
  // ==================================================

  await client.query(
    `
      UPDATE alertas
      SET
        estado = $1,
        fecha_resuelta = CURRENT_TIMESTAMP,
        fecha_cierre = CURRENT_TIMESTAMP

      WHERE contenedor_id = $2
        AND tipo = ANY($3::varchar[])
        AND estado = $4
    `,
    [
      ESTADO_ALERTA.RESUELTA,
      contenedorIdNumero,
      TIPOS_ALERTA_REINICIO,
      ESTADO_ALERTA.ACTIVA,
    ]
  );

  // ==================================================
  // 2. REINICIAR ESTADO DEL CONTENEDOR
  // ==================================================
  //
  // Después de la recolección podrá emitir
  // nuevamente primer y segundo aviso
  // durante el nuevo ciclo.
  // ==================================================

  await client.query(
    `
      INSERT INTO estado_alertas_contenedor
      (
        contenedor_id,
        primer_aviso_emitido,
        segundo_aviso_emitido,
        fecha_primer_aviso,
        fecha_segundo_aviso,
        ultima_recoleccion_id,
        fecha_reinicio,
        fecha_actualizacion
      )
      VALUES
      (
        $1,
        FALSE,
        FALSE,
        NULL,
        NULL,
        $2,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
      )

      ON CONFLICT (contenedor_id)
      DO UPDATE SET
        primer_aviso_emitido = FALSE,
        segundo_aviso_emitido = FALSE,
        fecha_primer_aviso = NULL,
        fecha_segundo_aviso = NULL,

        ultima_recoleccion_id =
          EXCLUDED.ultima_recoleccion_id,

        fecha_reinicio = CURRENT_TIMESTAMP,
        fecha_actualizacion = CURRENT_TIMESTAMP
    `,
    [
      contenedorIdNumero,
      recoleccionIdNumero,
    ]
  );
}

// ======================================================
// FOTO 4 - OBTENER DATOS INICIALES
// ======================================================

async function obtenerDatosRecoleccion({
  idUsuario,
  nombreUsuario,
  usuario,
}) {
  const usuarioId = toInt(idUsuario);

  if (!usuarioId) {
    throw new RecoleccionError(
      401,
      "Usuario no autenticado"
    );
  }

  const proceso = await requerirProcesoActivo(
    pool,
    { usuarioId }
  );

  validarProcesoFoto4(proceso);

  const responsable = String(
    nombreUsuario ||
    usuario ||
    "Responsable"
  ).trim() || "Responsable";

  const { rows } = await pool.query(
    `
      SELECT NOW() AS fecha_servidor
    `
  );

  return {
    codigo_contenedor:
      proceso.codigo_contenedor,

    responsable,

    fecha_servidor:
      rows[0]?.fecha_servidor || null,
  };
}

// ======================================================
// FOTO 4 - PREVIEW
// ======================================================
//
// No guarda datos.
// No modifica el proceso.
// Solo calcula porcentajes en backend.
//
// ======================================================

async function previewPendiente({
  idUsuario,
  cantidadLibrasPendientes,
}) {
  const usuarioId = toInt(idUsuario);

  if (!usuarioId) {
    throw new RecoleccionError(
      401,
      "Usuario no autenticado"
    );
  }

  const pendientesLb = validarLibrasPendientes(
    cantidadLibrasPendientes
  );

  const proceso = await requerirProcesoActivo(
    pool,
    { usuarioId }
  );

  validarProcesoFoto4(proceso);

  const totalLb = toNumber(
    proceso.total_en_libras
  );

  if (totalLb === null || totalLb < 0) {
    throw new RecoleccionError(
      409,
      "El peso total del proceso no es válido.",
      { codigo: "PESO_PROCESO_INVALIDO" }
    );
  }

  const {
    porcentajePendiente,
    porcentajeRecolectado,
  } = calcularPorcentajes({
    totalLb,
    pendientesLb,
  });

  return {
    porcentaje_pendiente:
      porcentajePendiente,

    porcentaje_recolectado:
      porcentajeRecolectado,
  };
}

// ======================================================
// VALIDAR DATOS DE RECOLECCIÓN
// ======================================================

function validarDatosRecoleccion({
  empresaId,
  distritoId,
  numeroRecibo,
  cantidadLibrasPendientes,
  observaciones,
}) {
  const empresaIdNumero = toInt(empresaId);
  const distritoIdNumero = toInt(distritoId);

  if (!empresaIdNumero) {
    throw new RecoleccionError(
      400,
      "Debe seleccionar una empresa recolectora válida.",
      { codigo: "EMPRESA_INVALIDA" }
    );
  }

  if (!distritoIdNumero) {
    throw new RecoleccionError(
      400,
      "Debe seleccionar un distrito válido.",
      { codigo: "DISTRITO_INVALIDO" }
    );
  }

  const recibo = String(
    numeroRecibo ?? ""
  ).trim();

  if (!recibo) {
    throw new RecoleccionError(
      400,
      "Número de recibo es obligatorio.",
      { codigo: "RECIBO_REQUERIDO" }
    );
  }

  if (!/^[a-zA-Z0-9-]+$/.test(recibo)) {
    throw new RecoleccionError(
      400,
      "El número de recibo solo puede contener letras, números y guiones.",
      { codigo: "RECIBO_INVALIDO" }
    );
  }

  const pendientesLb = validarLibrasPendientes(
    cantidadLibrasPendientes
  );

  const observacionesLimpias = String(
    observaciones ?? ""
  ).trim();

  return {
    empresaId: empresaIdNumero,
    distritoId: distritoIdNumero,
    numeroRecibo: recibo,
    pendientesLb,
    observaciones:
      observacionesLimpias || null,
  };
}

// ======================================================
// BLOQUEAR NÚMERO DE RECIBO
// ======================================================
//
// Evita guardar simultáneamente el mismo recibo.
// El bloqueo termina con COMMIT o ROLLBACK.
//
// ======================================================

async function bloquearNumeroRecibo(
  client,
  numeroRecibo
) {
  await client.query(
    `
      SELECT pg_advisory_xact_lock(
        $1::int,
        hashtext($2)
      )
    `,
    [
      ADVISORY_LOCK_RECIBO,
      numeroRecibo.toLowerCase(),
    ]
  );
}

// ======================================================
// VALIDAR NÚMERO DE RECIBO ÚNICO
// ======================================================

async function validarNumeroReciboDisponible(
  client,
  numeroRecibo
) {
  const { rows } = await client.query(
    `
      SELECT id
      FROM recolecciones
      WHERE LOWER(numero_recibo) = LOWER($1)
      LIMIT 1
    `,
    [numeroRecibo]
  );

  if (rows.length > 0) {
    throw new RecoleccionError(
      409,
      "El número de recibo ya existe.",
      { codigo: "RECIBO_DUPLICADO" }
    );
  }
}

// ======================================================
// FOTO 4 - GUARDAR RECOLECCIÓN
// ======================================================
//
// Flujo original conservado:
//
// 1. Validar usuario.
// 2. Validar campos.
// 3. Abrir transacción.
// 4. Obtener proceso activo y bloquearlo.
// 5. Validar lectura de peso.
// 6. Calcular porcentajes.
// 7. Validar recibo.
// 8. Insertar recolección.
// 9. Finalizar historial existente.
// 10. Resolver alertas del ciclo.
// 11. Reiniciar indicadores.
// 12. Confirmar transacción.
//
// No crea otro historial de cálculo.
// No confía en valores calculados por React.
//
// ======================================================

async function guardarRecoleccion({
  idUsuario,
  nombreUsuario,
  usuario,

  empresaId,
  distritoId,
  numeroRecibo,
  cantidadLibrasPendientes,
  observaciones,
}) {
  const usuarioId = toInt(idUsuario);

  if (!usuarioId) {
    throw new RecoleccionError(
      401,
      "Usuario no autenticado"
    );
  }

  // ==================================================
  // 1. VALIDAR ENTRADA
  // ==================================================

  const datos = validarDatosRecoleccion({
    empresaId,
    distritoId,
    numeroRecibo,
    cantidadLibrasPendientes,
    observaciones,
  });

  const responsable = String(
    nombreUsuario ||
    usuario ||
    "Responsable"
  ).trim() || "Responsable";

  const client = await pool.connect();
  let transaccionActiva = false;

  try {
    // ================================================
    // 2. INICIAR TRANSACCIÓN
    // ================================================

    await client.query("BEGIN");
    transaccionActiva = true;

    // ================================================
    // 3. OBTENER Y BLOQUEAR PROCESO
    // ================================================

    const proceso = await requerirProcesoActivo(
      client,
      {
        usuarioId,
        bloquear: true,
      }
    );

    validarProcesoFoto4(proceso);

    if (
      proceso.recoleccion_id !== null &&
      proceso.recoleccion_id !== undefined
    ) {
      throw new RecoleccionError(
        409,
        "Este proceso ya tiene una recolección registrada.",
        {
          codigo: "RECOLECCION_YA_REGISTRADA",
        }
      );
    }

    // ================================================
    // 4. VALIDAR LECTURA
    // ================================================

    await validarLecturaProceso(
      client,
      proceso
    );

    // ================================================
    // 5. OBTENER PESO OFICIAL
    // ================================================

    const totalLb = toNumber(
      proceso.total_en_libras
    );

    if (totalLb === null || totalLb < 0) {
      throw new RecoleccionError(
        409,
        "El peso total del proceso no es válido.",
        {
          codigo: "PESO_PROCESO_INVALIDO",
        }
      );
    }

    // ================================================
    // 6. CALCULAR PORCENTAJES
    // ================================================

    const {
      porcentajePendiente,
      porcentajeRecolectado,
    } = calcularPorcentajes({
      totalLb,
      pendientesLb: datos.pendientesLb,
    });

    // ================================================
    // 7. BLOQUEAR Y VALIDAR RECIBO
    // ================================================

    await bloquearNumeroRecibo(
      client,
      datos.numeroRecibo
    );

    await validarNumeroReciboDisponible(
      client,
      datos.numeroRecibo
    );

    // ================================================
    // 8. REGISTRAR RECOLECCIÓN
    // ================================================

    const {
      rows: recoleccionRows,
    } = await client.query(
      `
        INSERT INTO recolecciones
        (
          contenedor_id,
          usuario_id,
          empresa_id,
          distrito_id,
          fecha_recoleccion,
          numero_recibo,
          responsable,
          porcentaje_pendiente,
          cantidad_libras_pendientes,
          observaciones
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,
          NOW(),
          $5,
          $6,
          $7,
          $8,
          $9
        )
        RETURNING
          id,
          fecha_recoleccion
      `,
      [
        proceso.contenedor_id,
        usuarioId,
        datos.empresaId,
        datos.distritoId,
        datos.numeroRecibo,
        responsable,
        porcentajePendiente,
        datos.pendientesLb,
        datos.observaciones,
      ]
    );

    if (recoleccionRows.length === 0) {
      throw new RecoleccionError(
        500,
        "No fue posible registrar la recolección."
      );
    }

    const recoleccion = recoleccionRows[0];

    // ================================================
    // 9. FINALIZAR EL MISMO HISTORIAL
    // ================================================

    const {
      rows: procesoRows,
    } = await client.query(
      `
        UPDATE historial_calculo_costos

        SET
          recoleccion_id = $1,
          porcentaje_recolectado = $2,
          observaciones = $3,
          estado_proceso = $4

        WHERE id = $5
          AND calculado_por = $6
          AND estado_proceso = $7
          AND recoleccion_id IS NULL

        RETURNING
          id,
          estado_proceso,
          porcentaje_recolectado
      `,
      [
        recoleccion.id,
        porcentajeRecolectado,
        datos.observaciones,
        ESTADO_PROCESO.FINALIZADO,
        proceso.id,
        usuarioId,
        ESTADO_PROCESO.EN_PROCESO,
      ]
    );

    if (procesoRows.length === 0) {
      throw new RecoleccionError(
        409,
        "El proceso cambió de estado antes de finalizar.",
        {
          codigo: "PROCESO_MODIFICADO",
        }
      );
    }

    // ================================================
    // 10. CERRAR ALERTAS Y REINICIAR CICLO
    // ================================================
    //
    // CORRECCIÓN:
    //
    // Resuelve NIVEL_AVISO, NIVEL_ALTO
    // y PREDICTIVA.
    //
    // Solamente del contenedor recolectado.
    //
    // Si falla, se revierte también
    // el registro de la recolección.
    // ================================================

    await reiniciarAlertasPorRecoleccion(
      client,
      {
        contenedorId: proceso.contenedor_id,
        recoleccionId: recoleccion.id,
      }
    );

    // ================================================
    // 11. CONFIRMAR TRANSACCIÓN
    // ================================================

    await client.query("COMMIT");
    transaccionActiva = false;

    // ================================================
    // 12. RESPUESTA
    // ================================================

    return {
      message:
        "Recolección guardada. Proceso finalizado.",

      estado_proceso:
        ESTADO_PROCESO.FINALIZADO,

      porcentaje_pendiente:
        porcentajePendiente,

      porcentaje_recolectado:
        porcentajeRecolectado,

      fecha_recoleccion:
        recoleccion.fecha_recoleccion,
    };

  } catch (error) {
    // ================================================
    // REVERTIR TODA LA OPERACIÓN
    // ================================================

    if (transaccionActiva) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error(
          "Error haciendo rollback de recolección:",
          rollbackError.message
        );
      }
    }

    throw error;

  } finally {
    client.release();
  }
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerDatosRecoleccion,
  previewPendiente,
  guardarRecoleccion,
  RecoleccionError,
};
