const pool = require("../../config/db");
const crypto = require("crypto");


/* =========================================================
   CONSTANTES
   ========================================================= */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;


/* =========================================================
   ERROR DE VALIDACIÓN

   code permite que Controller y frontend distingan:

   - validación normal
   - snapshot inválido
   - snapshot vencido
   ========================================================= */

function crearErrorValidacion(
  message,
  {
    statusCode = 400,
    code = "VALIDATION_ERROR",
  } = {}
) {
  const error =
    new Error(message);

  error.statusCode =
    statusCode;

  error.type =
    "validation";

  error.code =
    code;

  return error;
}


/* =========================================================
   TTL DEL SNAPSHOT

   La configuración viene ÚNICAMENTE del .env.

   Ejemplo:

   EXPORT_SNAPSHOT_TTL_MIN=3

   No existe fallback escondido en código.
   ========================================================= */

function obtenerSnapshotTtlMin() {
  const texto =
    String(
      process.env
        .EXPORT_SNAPSHOT_TTL_MIN ?? ""
    ).trim();


  if (!texto) {
    throw new Error(
      "[EXPORT SNAPSHOT] Falta EXPORT_SNAPSHOT_TTL_MIN en el archivo .env."
    );
  }


  const valor =
    Number(texto);


  if (
    !Number.isSafeInteger(valor) ||
    valor <= 0
  ) {
    throw new Error(
      "[EXPORT SNAPSHOT] EXPORT_SNAPSHOT_TTL_MIN debe ser un número entero mayor que 0."
    );
  }


  return valor;
}


/* =========================================================
   VALIDAR USUARIO
   ========================================================= */

function normalizarUsuarioId(
  valor
) {
  const usuarioId =
    Number(valor);


  if (
    !Number.isSafeInteger(
      usuarioId
    ) ||
    usuarioId <= 0
  ) {
    throw crearErrorValidacion(
      "Usuario inválido para la exportación."
    );
  }


  return usuarioId;
}


/* =========================================================
   VALIDAR MÓDULO
   ========================================================= */

function normalizarModulo(
  valor
) {
  const modulo =
    String(valor || "")
      .trim()
      .toUpperCase();


  if (!modulo) {
    throw crearErrorValidacion(
      "El módulo de exportación es requerido."
    );
  }


  return modulo;
}


/* =========================================================
   VALIDAR EXPORT ID
   ========================================================= */

function normalizarExportId(
  valor
) {
  const exportId =
    String(valor || "")
      .trim()
      .toLowerCase();


  if (
    !UUID_REGEX.test(
      exportId
    )
  ) {
    throw crearErrorValidacion(
      "El identificador de exportación es inválido.",
      {
        code:
          "EXPORT_SNAPSHOT_INVALIDO",
      }
    );
  }


  return exportId;
}


/* =========================================================
   VALIDAR / SERIALIZAR FILTROS

   Aunque estos filtros vienen del Service del historial,
   este Service vuelve a validar su estructura.
   ========================================================= */

function serializarFiltros(
  filtros
) {
  if (
    !filtros ||
    typeof filtros !== "object" ||
    Array.isArray(filtros)
  ) {
    throw crearErrorValidacion(
      "Los filtros de exportación son inválidos."
    );
  }


  let filtrosJson;


  try {

    filtrosJson =
      JSON.stringify(
        filtros
      );

  } catch {

    throw crearErrorValidacion(
      "No fue posible procesar los filtros de exportación."
    );
  }


  if (
    !filtrosJson ||
    filtrosJson === "{}"
  ) {
    throw crearErrorValidacion(
      "Los filtros de exportación no pueden estar vacíos."
    );
  }


  return filtrosJson;
}


/* =========================================================
   LIMPIAR SNAPSHOTS VENCIDOS

   Elimina físicamente únicamente snapshots vencidos.

   NO toca:
   - recolecciones
   - historial_calculo_costos
   - auditoria_exportaciones
   ========================================================= */

async function limpiarSnapshotsExpirados() {
  const sql = `
    DELETE FROM export_snapshots

    WHERE expires_at <= NOW()
  `;


  const resultado =
    await pool.query(
      sql
    );


  return (
    Number.isSafeInteger(
      resultado?.rowCount
    )
      ? resultado.rowCount
      : 0
  );
}


/* =========================================================
   ELIMINAR UN SNAPSHOT ESPECÍFICO

   Se utiliza cuando encontramos el snapshot solicitado
   pero confirmamos que ya venció.
   ========================================================= */

async function eliminarSnapshot({
  exportId,
  usuarioId,
  modulo,
}) {
  const sql = `
    DELETE FROM export_snapshots

    WHERE export_id = $1
      AND usuario_id = $2
      AND modulo = $3
  `;


  const resultado =
    await pool.query(
      sql,
      [
        exportId,
        usuarioId,
        modulo,
      ]
    );


  return (
    Number.isSafeInteger(
      resultado?.rowCount
    )
      ? resultado.rowCount
      : 0
  );
}


/* =========================================================
   CREAR SNAPSHOT

   Devuelve:

   {
     exportId,
     expiresAt,
     expiresInSeconds
   }

   El frontend NO conoce directamente el .env.
   Backend le informa cuánto dura el permiso temporal.
   ========================================================= */

async function crearSnapshot({
  usuarioId,
  modulo,
  filtros,
}) {
  /* =======================================================
     1. LIMPIEZA OPORTUNISTA
     ======================================================= */

  await limpiarSnapshotsExpirados();


  /* =======================================================
     2. VALIDACIONES
     ======================================================= */

  const usuarioSeguro =
    normalizarUsuarioId(
      usuarioId
    );


  const moduloSeguro =
    normalizarModulo(
      modulo
    );


  const filtrosJson =
    serializarFiltros(
      filtros
    );


  /* =======================================================
     3. CONFIGURACIÓN DESDE .env
     ======================================================= */

  const ttlMin =
    obtenerSnapshotTtlMin();


  /* =======================================================
     4. ID GENERADO EXCLUSIVAMENTE EN BACKEND
     ======================================================= */

  const exportId =
    crypto.randomUUID();


  /* =======================================================
     5. INSERT
     ======================================================= */

  const sql = `
    INSERT INTO export_snapshots (
      export_id,
      usuario_id,
      modulo,
      filtros_json,
      expires_at
    )

    VALUES (
      $1,
      $2,
      $3,
      $4::jsonb,

      NOW() + (
        $5::int *
        INTERVAL '1 minute'
      )
    )

    RETURNING
      export_id,
      expires_at
  `;


  const { rows } =
    await pool.query(
      sql,
      [
        exportId,
        usuarioSeguro,
        moduloSeguro,
        filtrosJson,
        ttlMin,
      ]
    );


  const snapshot =
    rows?.[0];


  if (
    !snapshot?.export_id ||
    !snapshot?.expires_at
  ) {
    throw new Error(
      "No fue posible crear el snapshot de exportación."
    );
  }


  /* =======================================================
     6. CONTRATO DE SALIDA

     Los segundos vienen de la misma configuración que
     utilizó backend para crear expires_at.
     ======================================================= */

  return {
    exportId:
      snapshot.export_id,

    expiresAt:
      snapshot.expires_at,

    expiresInSeconds:
      ttlMin * 60,
  };
}


/* =========================================================
   OBTENER SNAPSHOT VÁLIDO

   IMPORTANTE:

   NO limpiamos todos los vencidos antes de consultar el
   exportId solicitado.

   ¿Por qué?

   Porque necesitamos poder distinguir:

   1. El snapshot existía pero venció.
   2. El snapshot nunca existió / no pertenece al usuario.

   Si lo borráramos primero perderíamos esa información.
   ========================================================= */

async function obtenerSnapshotValido({
  exportId,
  usuarioId,
  modulo,
}) {
  /* =======================================================
     1. VALIDACIONES
     ======================================================= */

  const exportIdSeguro =
    normalizarExportId(
      exportId
    );


  const usuarioSeguro =
    normalizarUsuarioId(
      usuarioId
    );


  const moduloSeguro =
    normalizarModulo(
      modulo
    );


  /* =======================================================
     2. BUSCAR SNAPSHOT

     Todavía NO exigimos expires_at > NOW().

     Necesitamos conocer si realmente existió.
     ======================================================= */

  const sql = `
    SELECT
      export_id,
      filtros_json,
      expires_at,

      (
        expires_at > NOW()
      ) AS vigente

    FROM export_snapshots

    WHERE export_id = $1
      AND usuario_id = $2
      AND modulo = $3

    LIMIT 1
  `;


  const { rows } =
    await pool.query(
      sql,
      [
        exportIdSeguro,
        usuarioSeguro,
        moduloSeguro,
      ]
    );


  const snapshot =
    rows?.[0];


  /* =======================================================
     3. NO EXISTE

     También cubre:

     - exportId de otro usuario
     - exportId de otro módulo
     ======================================================= */

  if (!snapshot) {

    /*
      Aprovechamos la petición para limpiar otros
      registros vencidos.
    */

    await limpiarSnapshotsExpirados();


    return null;
  }


  /* =======================================================
     4. EXISTE PERO VENCIÓ
     ======================================================= */

  if (
    snapshot.vigente !== true
  ) {

    /*
      Lo eliminamos físicamente porque ya no sirve.
    */

    await eliminarSnapshot({
      exportId:
        exportIdSeguro,

      usuarioId:
        usuarioSeguro,

      modulo:
        moduloSeguro,
    });


    /*
      Y limpiamos otros vencidos que puedan existir.
    */

    await limpiarSnapshotsExpirados();


    throw crearErrorValidacion(
      "El tiempo disponible para exportar esta búsqueda venció. Presione 'Ver' nuevamente para habilitar PDF y Excel.",
      {
        statusCode: 410,

        code:
          "EXPORT_SNAPSHOT_EXPIRADO",
      }
    );
  }


  /* =======================================================
     5. SNAPSHOT VÁLIDO

     Limpiamos otros vencidos, pero nunca el actual.
     ======================================================= */

  await limpiarSnapshotsExpirados();


  /* =======================================================
     6. RESPUESTA

     Conservamos filtros_json porque Controller lo utiliza
     para reconstruir la consulta desde backend.
     ======================================================= */

  return {
    export_id:
      snapshot.export_id,

    filtros_json:
      snapshot.filtros_json,

    expires_at:
      snapshot.expires_at,
  };
}


/* =========================================================
   EXPORTACIÓN PÚBLICA
   ========================================================= */

module.exports = {
  crearSnapshot,
  obtenerSnapshotValido,
  limpiarSnapshotsExpirados,
};