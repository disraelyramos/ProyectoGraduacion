// backend/src/services/controlDSH/Recoleccion.service.js

const pool = require(
  "../../config/db"
);


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


/*
 * Namespace exclusivo para bloquear
 * números de recibo durante el guardado.
 */
const ADVISORY_LOCK_RECIBO =
  32004;


// ======================================================
// ERROR CONTROLADO
// ======================================================

class RecoleccionError extends Error {

  constructor(
    statusCode,
    message,
    details = {}
  ) {

    super(message);

    this.statusCode =
      statusCode;

    this.details =
      details;
  }
}


// ======================================================
// HELPERS
// ======================================================

function toInt(value) {

  const numero =
    Number.parseInt(
      String(value),
      10
    );


  return Number.isFinite(
    numero
  )
    ? numero
    : null;
}


function toNumber(value) {

  const numero =
    Number(value);


  return Number.isFinite(
    numero
  )
    ? numero
    : null;
}


function redondear2(
  value
) {

  return Number(
    Number(
      value
    ).toFixed(2)
  );
}


function tieneMaximoDosDecimales(
  numero
) {

  const multiplicado =
    numero * 100;


  return (
    Math.abs(
      multiplicado -
      Math.round(
        multiplicado
      )
    ) <
    0.0000001
  );
}


// ======================================================
// VALIDAR CÁLCULO DE FOTO 3
// ======================================================

function procesoTieneCalculo(
  proceso
) {

  if (!proceso) {
    return false;
  }


  const totalLb =
    toNumber(
      proceso
        .total_en_libras
    );


  const porcentajeLlenado =
    toNumber(
      proceso
        .porcentaje_llenado
    );


  const costoPorLibra =
    toNumber(
      proceso
        .costo_por_libra_aplicado
    );


  const totalCosto =
    toNumber(
      proceso
        .total_costo_q
    );


  const costoId =
    toInt(
      proceso
        .costo_vigente_id
    );


  const lecturaId =
    toInt(
      proceso
        .lectura_id
    );


  return (
    totalLb !== null &&
    totalLb >= 0 &&

    porcentajeLlenado !==
      null &&
    porcentajeLlenado >= 0 &&
    porcentajeLlenado <= 100 &&

    costoPorLibra !== null &&
    costoPorLibra >= 0 &&

    totalCosto !== null &&
    totalCosto >= 0 &&

    Boolean(
      costoId
    ) &&

    Boolean(
      lecturaId
    )
  );
}


// ======================================================
// OBTENER PROCESO ACTIVO
// ======================================================
//
// El usuario autenticado determina
// completamente el proceso.
//
// Frontend NO manda:
//
// historial_calculo_id
// contenedor_id
// tipo
// peso
// ======================================================

async function obtenerProcesoActivo(
  client,
  {
    usuarioId,
    bloquear = false,
  }
) {

  const bloqueoSQL =
    bloquear
      ? "FOR UPDATE OF h"
      : "";


  const { rows } =
    await client.query(
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

          c.codigo
            AS codigo_contenedor,

          c.estado_id
            AS contenedor_estado_id

        FROM historial_calculo_costos h

        JOIN contenedores c
          ON c.id_contenedor =
             h.contenedor_id

        WHERE h.calculado_por = $1
          AND h.estado_proceso = $2

        ORDER BY
          h.id DESC

        LIMIT 1

        ${bloqueoSQL}
      `,
      [
        usuarioId,

        ESTADO_PROCESO
          .EN_PROCESO,
      ]
    );


  return rows[0] || null;
}


// ======================================================
// REQUERIR PROCESO
// ======================================================

async function requerirProcesoActivo(
  client,
  {
    usuarioId,
    bloquear = false,
  }
) {

  const proceso =
    await obtenerProcesoActivo(
      client,
      {
        usuarioId,
        bloquear,
      }
    );


  if (!proceso) {

    throw new RecoleccionError(
      409,
      "No existe un proceso de pesaje activo.",
      {
        codigo:
          "PROCESO_NO_ACTIVO",
      }
    );
  }


  return proceso;
}


// ======================================================
// VALIDAR PROCESO PARA FOTO 4
// ======================================================

function validarProcesoFoto4(
  proceso
) {

  if (
    proceso.estado_proceso !==
    ESTADO_PROCESO
      .EN_PROCESO
  ) {

    throw new RecoleccionError(
      409,
      "El proceso ya fue finalizado o cancelado.",
      {
        codigo:
          "PROCESO_NO_ACTIVO",
      }
    );
  }


  if (
    !procesoTieneCalculo(
      proceso
    )
  ) {

    throw new RecoleccionError(
      409,
      "Debe calcular el peso antes de registrar la recolección.",
      {
        codigo:
          "CALCULO_PENDIENTE",
      }
    );
  }


  if (
    Number(
      proceso
        .contenedor_estado_id
    ) ===
    ESTADO_CONTENEDOR
      .INACTIVO
  ) {

    throw new RecoleccionError(
      409,
      "El contenedor está inactivo. No se puede registrar la recolección.",
      {
        codigo:
          "CONTENEDOR_INACTIVO",
      }
    );
  }
}


// ======================================================
// VALIDAR LIBRAS PENDIENTES
// ======================================================

function validarLibrasPendientes(
  value
) {

  const cantidad =
    toNumber(
      value
    );


  if (
    cantidad === null ||
    cantidad < 0
  ) {

    throw new RecoleccionError(
      400,
      "Cantidad en libras pendientes inválida.",
      {
        codigo:
          "LIBRAS_PENDIENTES_INVALIDAS",
      }
    );
  }


  if (
    !tieneMaximoDosDecimales(
      cantidad
    )
  ) {

    throw new RecoleccionError(
      400,
      "La cantidad en libras pendientes puede tener máximo 2 decimales.",
      {
        codigo:
          "LIBRAS_PENDIENTES_DECIMALES",
      }
    );
  }


  return cantidad;
}


// ======================================================
// CALCULAR PORCENTAJES
// ======================================================
//
// IMPORTANTE:
//
// Este cálculo solamente existe
// en backend.
//
// Frontend jamás calcula el porcentaje
// oficial.
// ======================================================

function calcularPorcentajes({
  totalLb,
  pendientesLb,
}) {

  if (
    pendientesLb >
    totalLb
  ) {

    throw new RecoleccionError(
      400,
      "La cantidad pendiente no puede superar el total en libras del proceso.",
      {
        codigo:
          "PENDIENTE_SUPERA_TOTAL",

        total_en_libras:
          redondear2(
            totalLb
          ),
      }
    );
  }


  /*
   * Caso especial:
   *
   * si Foto 3 registró 0 lb,
   * no hacemos división entre cero.
   */
  if (
    totalLb === 0
  ) {

    return {
      porcentajePendiente:
        0,

      porcentajeRecolectado:
        0,
    };
  }


  const porcentajePendiente =
    redondear2(
      (
        pendientesLb /
        totalLb
      ) *
      100
    );


  const porcentajeRecolectado =
    redondear2(
      100 -
      porcentajePendiente
    );


  return {
    porcentajePendiente,
    porcentajeRecolectado,
  };
}


// ======================================================
// VALIDAR LECTURA
// ======================================================

async function validarLecturaProceso(
  client,
  proceso
) {

  const lecturaId =
    toInt(
      proceso
        .lectura_id
    );


  const contenedorId =
    toInt(
      proceso
        .contenedor_id
    );


  if (
    !lecturaId ||
    !contenedorId
  ) {

    throw new RecoleccionError(
      409,
      "El proceso no contiene una lectura de peso válida.",
      {
        codigo:
          "LECTURA_NO_VALIDA",
      }
    );
  }


  const { rows } =
    await client.query(
      `
        SELECT id

        FROM lecturas

        WHERE id = $1
          AND contenedor_id = $2

        LIMIT 1
      `,
      [
        lecturaId,
        contenedorId,
      ]
    );


  if (
    rows.length === 0
  ) {

    throw new RecoleccionError(
      409,
      "La lectura de peso del proceso ya no es válida.",
      {
        codigo:
          "LECTURA_NO_ENCONTRADA",
      }
    );
  }
}


// ======================================================
// FOTO 4
// OBTENER DATOS INICIALES
// ======================================================

async function obtenerDatosRecoleccion({
  idUsuario,
  nombreUsuario,
  usuario,
}) {

  const usuarioId =
    toInt(
      idUsuario
    );


  if (!usuarioId) {

    throw new RecoleccionError(
      401,
      "Usuario no autenticado"
    );
  }


  const proceso =
    await requerirProcesoActivo(
      pool,
      {
        usuarioId,
      }
    );


  validarProcesoFoto4(
    proceso
  );


  const responsable =
    String(
      nombreUsuario ||
      usuario ||
      "Responsable"
    ).trim() ||
    "Responsable";


  /*
   * Fecha directamente del servidor/BD.
   */
  const {
    rows:
      fechaRows,
  } =
    await pool.query(
      `
        SELECT
          NOW()
            AS fecha_servidor
      `
    );


  return {

    codigo_contenedor:
      proceso
        .codigo_contenedor,


    responsable,


    fecha_servidor:
      fechaRows[0]
        ?.fecha_servidor ||
      null,
  };
}


// ======================================================
// FOTO 4
// PREVIEW
// ======================================================
//
// NO guarda historial.
//
// NO modifica proceso.
//
// Solo calcula para mostrar.
//
// Frontend manda:
//
// cantidad_libras_pendientes
//
// Backend obtiene total_en_libras.
// ======================================================

async function previewPendiente({
  idUsuario,
  cantidadLibrasPendientes,
}) {

  const usuarioId =
    toInt(
      idUsuario
    );


  if (!usuarioId) {

    throw new RecoleccionError(
      401,
      "Usuario no autenticado"
    );
  }


  const pendientesLb =
    validarLibrasPendientes(
      cantidadLibrasPendientes
    );


  const proceso =
    await requerirProcesoActivo(
      pool,
      {
        usuarioId,
      }
    );


  validarProcesoFoto4(
    proceso
  );


  const totalLb =
    toNumber(
      proceso
        .total_en_libras
    );


  if (
    totalLb === null ||
    totalLb < 0
  ) {

    throw new RecoleccionError(
      409,
      "El peso total del proceso no es válido.",
      {
        codigo:
          "PESO_PROCESO_INVALIDO",
      }
    );
  }


  const {
    porcentajePendiente,
    porcentajeRecolectado,
  } =
    calcularPorcentajes({
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
// VALIDAR CAMPOS DE GUARDADO
// ======================================================

function validarDatosRecoleccion({
  empresaId,
  distritoId,
  numeroRecibo,
  cantidadLibrasPendientes,
  observaciones,
}) {

  const empresaIdNumero =
    toInt(
      empresaId
    );


  const distritoIdNumero =
    toInt(
      distritoId
    );


  if (!empresaIdNumero) {

    throw new RecoleccionError(
      400,
      "Debe seleccionar una empresa recolectora válida.",
      {
        codigo:
          "EMPRESA_INVALIDA",
      }
    );
  }


  if (!distritoIdNumero) {

    throw new RecoleccionError(
      400,
      "Debe seleccionar un distrito válido.",
      {
        codigo:
          "DISTRITO_INVALIDO",
      }
    );
  }


  const recibo =
    String(
      numeroRecibo ??
      ""
    ).trim();


  if (!recibo) {

    throw new RecoleccionError(
      400,
      "Número de recibo es obligatorio.",
      {
        codigo:
          "RECIBO_REQUERIDO",
      }
    );
  }


  if (
    !/^[a-zA-Z0-9-]+$/.test(
      recibo
    )
  ) {

    throw new RecoleccionError(
      400,
      "El número de recibo solo puede contener letras, números y guiones.",
      {
        codigo:
          "RECIBO_INVALIDO",
      }
    );
  }


  const pendientesLb =
    validarLibrasPendientes(
      cantidadLibrasPendientes
    );


  const observacionesLimpias =
    String(
      observaciones ??
      ""
    ).trim();


  return {

    empresaId:
      empresaIdNumero,


    distritoId:
      distritoIdNumero,


    numeroRecibo:
      recibo,


    pendientesLb,


    observaciones:
      observacionesLimpias ||
      null,
  };
}


// ======================================================
// BLOQUEAR NÚMERO DE RECIBO
// ======================================================
//
// Evita que dos solicitudes concurrentes
// intenten guardar el mismo recibo.
//
// El lock termina automáticamente
// con COMMIT o ROLLBACK.
// ======================================================

async function bloquearNumeroRecibo(
  client,
  numeroRecibo
) {

  await client.query(
    `
      SELECT
        pg_advisory_xact_lock(
          $1::int,
          hashtext($2)
        )
    `,
    [
      ADVISORY_LOCK_RECIBO,

      numeroRecibo
        .toLowerCase(),
    ]
  );
}


// ======================================================
// VALIDAR RECIBO ÚNICO
// ======================================================

async function validarNumeroReciboDisponible(
  client,
  numeroRecibo
) {

  const { rows } =
    await client.query(
      `
        SELECT id

        FROM recolecciones

        WHERE LOWER(
          numero_recibo
        ) = LOWER($1)

        LIMIT 1
      `,
      [
        numeroRecibo,
      ]
    );


  if (
    rows.length > 0
  ) {

    throw new RecoleccionError(
      409,
      "El número de recibo ya existe.",
      {
        codigo:
          "RECIBO_DUPLICADO",
      }
    );
  }
}


// ======================================================
// FOTO 4
// GUARDAR RECOLECCIÓN
// ======================================================
//
// Esta función:
// 
// 1. obtiene EN_PROCESO;
// 2. bloquea el proceso;
// 3. valida cálculo de Foto 3;
// 4. vuelve a calcular porcentajes;
// 5. crea recolección;
// 6. actualiza EL MISMO historial;
// 7. EN_PROCESO -> FINALIZADO.
//
// NO crea un segundo historial.
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

  const usuarioId =
    toInt(
      idUsuario
    );


  if (!usuarioId) {

    throw new RecoleccionError(
      401,
      "Usuario no autenticado"
    );
  }


  // ====================================================
  // 1. VALIDAR INPUT REAL DEL USUARIO
  // ====================================================

  const datos =
    validarDatosRecoleccion({

      empresaId,

      distritoId,

      numeroRecibo,

      cantidadLibrasPendientes,

      observaciones,
    });


  const responsable =
    String(
      nombreUsuario ||
      usuario ||
      "Responsable"
    ).trim() ||
    "Responsable";


  const client =
    await pool.connect();


  let transaccionActiva =
    false;


  try {

    // ==================================================
    // 2. TRANSACCIÓN
    // ==================================================

    await client.query(
      "BEGIN"
    );


    transaccionActiva =
      true;


    // ==================================================
    // 3. OBTENER Y BLOQUEAR PROCESO
    // ==================================================

    const proceso =
      await requerirProcesoActivo(
        client,
        {
          usuarioId,

          bloquear:
            true,
        }
      );


    validarProcesoFoto4(
      proceso
    );


    /*
     * Defensa adicional.
     *
     * Un EN_PROCESO no debería tener
     * recoleccion_id todavía.
     */
    if (
      proceso
        .recoleccion_id !==
        null &&
      proceso
        .recoleccion_id !==
        undefined
    ) {

      throw new RecoleccionError(
        409,
        "Este proceso ya tiene una recolección registrada.",
        {
          codigo:
            "RECOLECCION_YA_REGISTRADA",
        }
      );
    }


    // ==================================================
    // 4. VALIDAR LECTURA
    // ==================================================

    await validarLecturaProceso(
      client,
      proceso
    );


    // ==================================================
    // 5. PESO OFICIAL DE FOTO 3
    // ==================================================

    const totalLb =
      toNumber(
        proceso
          .total_en_libras
      );


    if (
      totalLb === null ||
      totalLb < 0
    ) {

      throw new RecoleccionError(
        409,
        "El peso total del proceso no es válido.",
        {
          codigo:
            "PESO_PROCESO_INVALIDO",
        }
      );
    }


    // ==================================================
    // 6. CALCULAR NUEVAMENTE PORCENTAJES
    // ==================================================
    //
    // NO confiamos en el preview mostrado
    // anteriormente en React.
    // ==================================================

    const {
      porcentajePendiente,
      porcentajeRecolectado,
    } =
      calcularPorcentajes({

        totalLb,

        pendientesLb:
          datos
            .pendientesLb,
      });


    // ==================================================
    // 7. BLOQUEAR RECIBO
    // ==================================================

    await bloquearNumeroRecibo(
      client,
      datos.numeroRecibo
    );


    // ==================================================
    // 8. VALIDAR RECIBO
    // ==================================================

    await validarNumeroReciboDisponible(
      client,
      datos.numeroRecibo
    );


    // ==================================================
    // 9. CREAR RECOLECCIÓN
    // ==================================================

    const {
      rows:
        recoleccionRows,
    } =
      await client.query(
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
          proceso
            .contenedor_id,

          usuarioId,

          datos
            .empresaId,

          datos
            .distritoId,

          datos
            .numeroRecibo,

          responsable,

          porcentajePendiente,

          datos
            .pendientesLb,

          datos
            .observaciones,
        ]
      );


    if (
      recoleccionRows.length ===
      0
    ) {

      throw new RecoleccionError(
        500,
        "No fue posible registrar la recolección."
      );
    }


    const recoleccion =
      recoleccionRows[0];


    // ==================================================
    // 10. FINALIZAR EL MISMO HISTORIAL
    // ==================================================
    //
    // NO:
    //
    // INSERT historial_calculo_costos
    //
    // SÍ:
    //
    // UPDATE del mismo EN_PROCESO
    // ==================================================

    const {
      rows:
        procesoRows,
    } =
      await client.query(
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

          datos
            .observaciones,

          ESTADO_PROCESO
            .FINALIZADO,

          proceso.id,

          usuarioId,

          ESTADO_PROCESO
            .EN_PROCESO,
        ]
      );


    if (
      procesoRows.length ===
      0
    ) {

      throw new RecoleccionError(
        409,
        "El proceso cambió de estado antes de finalizar.",
        {
          codigo:
            "PROCESO_MODIFICADO",
        }
      );
    }


    // ==================================================
    // 11. COMMIT
    // ==================================================

    await client.query(
      "COMMIT"
    );


    transaccionActiva =
      false;


    // ==================================================
    // 12. RESPUESTA
    // ==================================================
    //
    // No devolvemos IDs internos innecesarios.
    // ==================================================

    return {

      message:
        "Recolección guardada. Proceso finalizado.",


      estado_proceso:
        ESTADO_PROCESO
          .FINALIZADO,


      porcentaje_pendiente:
        porcentajePendiente,


      porcentaje_recolectado:
        porcentajeRecolectado,


      fecha_recoleccion:
        recoleccion
          .fecha_recoleccion,
    };


  } catch (error) {

    if (
      transaccionActiva
    ) {

      try {

        await client.query(
          "ROLLBACK"
        );


      } catch (
        rollbackError
      ) {

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