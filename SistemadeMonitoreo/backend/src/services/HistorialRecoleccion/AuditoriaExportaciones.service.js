const pool = require("../../config/db");


/* =========================================================
   CONSTANTES
   ========================================================= */

const FORMATOS_PERMITIDOS = new Set([
  "PDF",
  "EXCEL",
]);

const ESTADOS_PERMITIDOS = new Set([
  "GENERADO",
  "FALLIDO",
]);

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


/* =========================================================
   ERROR DE VALIDACIÓN
   ========================================================= */

function crearErrorValidacion(message) {
  const error = new Error(message);

  error.statusCode = 400;
  error.type = "validation";

  return error;
}


/* =========================================================
   USUARIO
   ========================================================= */

function normalizarUsuarioId(valor) {
  const usuarioId = Number(valor);

  if (
    !Number.isSafeInteger(usuarioId) ||
    usuarioId <= 0
  ) {
    throw crearErrorValidacion(
      "El usuario de auditoría es inválido."
    );
  }

  return usuarioId;
}


/* =========================================================
   TEXTO REQUERIDO
   ========================================================= */

function normalizarTextoRequerido(
  valor,
  nombreCampo
) {
  const texto = String(valor || "").trim();

  if (!texto) {
    throw crearErrorValidacion(
      `${nombreCampo} es requerido para la auditoría.`
    );
  }

  return texto;
}


/* =========================================================
   TEXTO OPCIONAL
   ========================================================= */

function normalizarTextoOpcional(valor) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return null;
  }

  const texto = String(valor).trim();

  return texto || null;
}


/* =========================================================
   FORMATO
   ========================================================= */

function normalizarFormato(valor) {
  const formato = String(valor || "")
    .trim()
    .toUpperCase();

  if (!FORMATOS_PERMITIDOS.has(formato)) {
    throw crearErrorValidacion(
      "El formato de exportación debe ser PDF o EXCEL."
    );
  }

  return formato;
}


/* =========================================================
   ESTADO
   ========================================================= */

function normalizarEstado(valor) {
  const estado = String(valor || "")
    .trim()
    .toUpperCase();

  if (!ESTADOS_PERMITIDOS.has(estado)) {
    throw crearErrorValidacion(
      "El estado de exportación debe ser GENERADO o FALLIDO."
    );
  }

  return estado;
}


/* =========================================================
   EXPORT ID
   ========================================================= */

function normalizarExportId(valor) {
  const exportId = String(valor || "")
    .trim()
    .toLowerCase();

  if (!UUID_REGEX.test(exportId)) {
    throw crearErrorValidacion(
      "El identificador de exportación es inválido."
    );
  }

  return exportId;
}


/* =========================================================
   TOTAL DE REGISTROS
   ========================================================= */

function normalizarTotalRegistros(valor) {
  const total = Number(valor);

  if (
    !Number.isSafeInteger(total) ||
    total < 0
  ) {
    throw crearErrorValidacion(
      "El total de registros de auditoría es inválido."
    );
  }

  return total;
}


/* =========================================================
   SERIALIZAR JSON REQUERIDO
   ========================================================= */

function serializarJsonRequerido(
  valor,
  nombreCampo
) {
  if (
    !valor ||
    typeof valor !== "object" ||
    Array.isArray(valor)
  ) {
    throw crearErrorValidacion(
      `${nombreCampo} debe ser un objeto válido.`
    );
  }

  try {
    return JSON.stringify(valor);
  } catch {
    throw crearErrorValidacion(
      `${nombreCampo} no pudo convertirse a JSON.`
    );
  }
}


/* =========================================================
   SERIALIZAR JSON OPCIONAL
   ========================================================= */

function serializarJsonOpcional(
  valor,
  nombreCampo
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return null;
  }

  if (
    typeof valor !== "object" ||
    Array.isArray(valor)
  ) {
    throw crearErrorValidacion(
      `${nombreCampo} debe ser un objeto válido.`
    );
  }

  try {
    return JSON.stringify(valor);
  } catch {
    throw crearErrorValidacion(
      `${nombreCampo} no pudo convertirse a JSON.`
    );
  }
}


/* =========================================================
   NORMALIZAR PAYLOAD

   Punto único antes de tocar la base de datos.
   ========================================================= */

function normalizarPayload(payload = {}) {
  const estado = normalizarEstado(
    payload.estado
  );

  return {
    usuario_id:
      normalizarUsuarioId(
        payload.usuario_id
      ),

    usuario:
      normalizarTextoRequerido(
        payload.usuario,
        "usuario"
      ),

    rol:
      normalizarTextoRequerido(
        payload.rol,
        "rol"
      ),

    modulo:
      normalizarTextoRequerido(
        payload.modulo,
        "modulo"
      ).toUpperCase(),

    reporte:
      normalizarTextoRequerido(
        payload.reporte,
        "reporte"
      ),

    formato:
      normalizarFormato(
        payload.formato
      ),

    export_id:
      normalizarExportId(
        payload.export_id
      ),

    filtros_json:
      serializarJsonRequerido(
        payload.filtros_json,
        "filtros_json"
      ),

    total_registros:
      normalizarTotalRegistros(
        payload.total_registros
      ),

    resumen_json:
      serializarJsonOpcional(
        payload.resumen_json,
        "resumen_json"
      ),

    estado,

    error_mensaje:
      estado === "FALLIDO"
        ? normalizarTextoOpcional(
            payload.error_mensaje
          )
        : null,

    ip_origen:
      normalizarTextoOpcional(
        payload.ip_origen
      ),

    user_agent:
      normalizarTextoOpcional(
        payload.user_agent
      ),
  };
}


/* =========================================================
   REGISTRAR AUDITORÍA
   ========================================================= */

async function registrarAuditoriaExportacion(
  payload
) {
  /*
    Aunque el payload venga desde Controller,
    se vuelve a validar completamente.
  */

  const datos =
    normalizarPayload(payload);


  const sql = `
    INSERT INTO auditoria_exportaciones (
      usuario_id,
      usuario,
      rol,
      modulo,
      reporte,
      formato,
      export_id,
      filtros_json,
      total_registros,
      resumen_json,
      estado,
      error_mensaje,
      ip_origen,
      user_agent
    )
    VALUES (
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8::jsonb,
      $9,
      $10::jsonb,
      $11,
      $12,
      $13,
      $14
    )
  `;


  const params = [
    datos.usuario_id,
    datos.usuario,
    datos.rol,
    datos.modulo,
    datos.reporte,
    datos.formato,
    datos.export_id,
    datos.filtros_json,
    datos.total_registros,
    datos.resumen_json,
    datos.estado,
    datos.error_mensaje,
    datos.ip_origen,
    datos.user_agent,
  ];


  await pool.query(
    sql,
    params
  );
}


/* =========================================================
   EXPORTACIÓN PÚBLICA
   ========================================================= */

module.exports = {
  registrarAuditoriaExportacion,
};