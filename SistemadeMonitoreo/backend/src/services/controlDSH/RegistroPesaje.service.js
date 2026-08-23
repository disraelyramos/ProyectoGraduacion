const pool = require("../../config/db");

const medicionesService = require(
  "./mediciones/Mediciones.service"
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


const ETAPA_PROCESO = {
  COSTO: "COSTO",
  CALCULO: "CALCULO",
  RECOLECCION: "RECOLECCION",
};


const ESTADO_MEDICION = {
  OBTENIENDO_LECTURA:
    "OBTENIENDO_LECTURA",

  ESTABILIZANDO:
    "ESTABILIZANDO",

  ESTABLE:
    "ESTABLE",

  ERROR:
    "ERROR",

  TIMEOUT:
    "TIMEOUT",
};


const TIPOS_DSH = [1, 2];


/*
 * Namespace propio para los advisory locks
 * de cálculo de peso.
 *
 * Evita mezclar estos locks con otros
 * posibles locks del sistema.
 */
const ADVISORY_LOCK_CALCULO =
  32003;


// ======================================================
// ERROR CONTROLADO
// ======================================================

class RegistroPesajeError extends Error {

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


// ======================================================
// ETAPA DEL PROCESO
// ======================================================

function procesoTieneCostoConfirmado(
  proceso
) {

  if (!proceso) {
    return false;
  }


  const costo =
    toNumber(
      proceso
        .costo_por_libra_aplicado
    );


  const costoId =
    toInt(
      proceso
        .costo_vigente_id
    );


  return (
    costo !== null &&
    costo >= 0 &&
    Boolean(costoId)
  );
}


function procesoTieneCalculo(
  proceso
) {

  if (!proceso) {
    return false;
  }


  const peso =
    toNumber(
      proceso
        .total_en_libras
    );


  const porcentaje =
    toNumber(
      proceso
        .porcentaje_llenado
    );


  const costo =
    toNumber(
      proceso
        .costo_por_libra_aplicado
    );


  const total =
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
    peso !== null &&
    peso >= 0 &&

    porcentaje !== null &&
    porcentaje >= 0 &&
    porcentaje <= 100 &&

    costo !== null &&
    costo >= 0 &&

    total !== null &&
    total >= 0 &&

    Boolean(costoId) &&
    Boolean(lecturaId)
  );
}


function determinarEtapaProceso(
  proceso
) {

  if (
    procesoTieneCalculo(
      proceso
    )
  ) {

    return ETAPA_PROCESO
      .RECOLECCION;
  }


  if (
    procesoTieneCostoConfirmado(
      proceso
    )
  ) {

    return ETAPA_PROCESO
      .CALCULO;
  }


  return ETAPA_PROCESO
    .COSTO;
}


// ======================================================
// BLOQUEO DEL USUARIO
// ======================================================

async function bloquearUsuario(
  client,
  idUsuario
) {

  const { rows } =
    await client.query(
      `
        SELECT
          id_usuario

        FROM usuarios

        WHERE id_usuario = $1

        FOR UPDATE
      `,
      [
        idUsuario,
      ]
    );


  if (
    rows.length === 0
  ) {

    throw new RegistroPesajeError(
      401,
      "Usuario no válido"
    );
  }
}


// ======================================================
// BLOQUEO DE FOTO 3
// ======================================================

async function adquirirBloqueoCalculo(
  client,
  procesoId
) {

  const { rows } =
    await client.query(
      `
        SELECT
          pg_try_advisory_lock(
            $1::int,
            $2::int
          ) AS adquirido
      `,
      [
        ADVISORY_LOCK_CALCULO,
        procesoId,
      ]
    );


  const adquirido =
    rows[0]
      ?.adquirido === true;


  if (!adquirido) {

    throw new RegistroPesajeError(
      409,
      "Ya existe una medición de peso en curso para este proceso.",
      {
        codigo:
          "CALCULO_EN_CURSO",

        estado_medicion:
          ESTADO_MEDICION
            .OBTENIENDO_LECTURA,
      }
    );
  }


  return true;
}


async function liberarBloqueoCalculo(
  client,
  procesoId
) {

  try {

    await client.query(
      `
        SELECT
          pg_advisory_unlock(
            $1::int,
            $2::int
          )
      `,
      [
        ADVISORY_LOCK_CALCULO,
        procesoId,
      ]
    );


  } catch (error) {

    console.error(
      "Error liberando bloqueo de cálculo:",
      error.message
    );
  }
}


// ======================================================
// CONSULTAS DE PROCESO
// ======================================================

async function buscarProcesoActivo(
  client,
  idUsuario
) {

  const { rows } =
    await client.query(
      `
        SELECT
          id,
          contenedor_id,
          id_tipo_residuo,
          calculado_por,
          recoleccion_id,

          total_en_libras,
          porcentaje_recolectado,
          porcentaje_llenado,

          costo_por_libra_aplicado,
          total_costo_q,
          fuente_costo,
          costo_vigente_id,

          lectura_id,

          calculado_en,
          estado_proceso,
          observaciones

        FROM historial_calculo_costos

        WHERE calculado_por = $1
          AND estado_proceso = $2

        ORDER BY
          id DESC

        LIMIT 1
      `,
      [
        idUsuario,

        ESTADO_PROCESO
          .EN_PROCESO,
      ]
    );


  return rows[0] || null;
}


async function requerirProcesoActivo(
  client,
  idUsuario
) {

  const proceso =
    await buscarProcesoActivo(
      client,
      idUsuario
    );


  if (!proceso) {

    throw new RegistroPesajeError(
      409,
      "No existe un proceso de pesaje en curso.",
      {
        codigo:
          "PROCESO_NO_ACTIVO",
      }
    );
  }


  return proceso;
}


async function obtenerProcesoPorId(
  client,
  {
    procesoId,
    usuarioId,
    bloquear = false,
  }
) {

  const bloqueoSQL =
    bloquear
      ? "FOR UPDATE"
      : "";


  const { rows } =
    await client.query(
      `
        SELECT
          id,
          contenedor_id,
          id_tipo_residuo,
          calculado_por,
          recoleccion_id,

          total_en_libras,
          porcentaje_recolectado,
          porcentaje_llenado,

          costo_por_libra_aplicado,
          total_costo_q,
          fuente_costo,
          costo_vigente_id,

          lectura_id,

          calculado_en,
          estado_proceso,
          observaciones

        FROM historial_calculo_costos

        WHERE id = $1
          AND calculado_por = $2

        LIMIT 1

        ${bloqueoSQL}
      `,
      [
        procesoId,
        usuarioId,
      ]
    );


  return rows[0] || null;
}


// ======================================================
// CONTENEDORES
// ======================================================

async function obtenerContenedorPorTipo(
  client,
  tipoResiduoId
) {

  const { rows } =
    await client.query(
      `
        SELECT
          c.id_contenedor,
          c.codigo,
          c.id_tipo_residuo,
          c.estado_id,

          ec.nombre
            AS estado_nombre,

          c.capacidad_max_litros,
          c.capacidad_max_lb

        FROM contenedores c

        JOIN estados_contenedor ec
          ON ec.id =
             c.estado_id

        WHERE c.id_tipo_residuo = $1

        ORDER BY
          c.id_contenedor ASC

        LIMIT 1
      `,
      [
        tipoResiduoId,
      ]
    );


  return rows[0] || null;
}


async function obtenerContenedorPorId(
  client,
  contenedorId
) {

  const { rows } =
    await client.query(
      `
        SELECT
          c.id_contenedor,
          c.codigo,
          c.id_tipo_residuo,
          c.estado_id,

          ec.nombre
            AS estado_nombre,

          c.capacidad_max_litros,
          c.capacidad_max_lb

        FROM contenedores c

        JOIN estados_contenedor ec
          ON ec.id =
             c.estado_id

        WHERE c.id_contenedor = $1

        LIMIT 1
      `,
      [
        contenedorId,
      ]
    );


  return rows[0] || null;
}


// ======================================================
// CREAR PROCESO
// ======================================================

async function crearProceso(
  client,
  {
    contenedorId,
    tipoResiduoId,
    usuarioId,
  }
) {

  const { rows } =
    await client.query(
      `
        INSERT INTO historial_calculo_costos
        (
          contenedor_id,
          id_tipo_residuo,
          calculado_por,
          calculado_en,
          estado_proceso
        )
        VALUES
        (
          $1,
          $2,
          $3,
          NOW(),
          $4
        )

        RETURNING
          id,
          contenedor_id,
          id_tipo_residuo,
          calculado_en,
          estado_proceso
      `,
      [
        contenedorId,
        tipoResiduoId,
        usuarioId,

        ESTADO_PROCESO
          .EN_PROCESO,
      ]
    );


  return rows[0];
}


// ======================================================
// COSTOS
// ======================================================

async function obtenerContenedoresGlobalDSH(
  client,
  bloquear = false
) {

  const bloqueoSQL =
    bloquear
      ? "FOR UPDATE"
      : "";


  const { rows } =
    await client.query(
      `
        SELECT
          id_contenedor,
          id_tipo_residuo

        FROM contenedores

        WHERE id_tipo_residuo =
          ANY($1::int[])

        ORDER BY
          id_tipo_residuo ASC,
          id_contenedor ASC

        ${bloqueoSQL}
      `,
      [
        TIPOS_DSH,
      ]
    );


  const tipo1 =
    rows.find(
      (fila) =>
        Number(
          fila.id_tipo_residuo
        ) === 1
    );


  const tipo2 =
    rows.find(
      (fila) =>
        Number(
          fila.id_tipo_residuo
        ) === 2
    );


  return {

    tipo1:
      tipo1?.id_contenedor
        ? Number(
            tipo1.id_contenedor
          )
        : null,


    tipo2:
      tipo2?.id_contenedor
        ? Number(
            tipo2.id_contenedor
          )
        : null,
  };
}


async function obtenerCostoVigentePorContenedor(
  client,
  contenedorId
) {

  const { rows } =
    await client.query(
      `
        SELECT
          id,
          contenedor_id,
          costo_por_libra,
          vigente_desde

        FROM costos_contenedor

        WHERE contenedor_id = $1
          AND activo = TRUE

        ORDER BY
          vigente_desde DESC,
          id DESC

        LIMIT 1
      `,
      [
        contenedorId,
      ]
    );


  return rows[0] || null;
}


async function cerrarCostoVigente(
  client,
  {
    contenedorId,
    usuarioId,
  }
) {

  await client.query(
    `
      UPDATE costos_contenedor

      SET
        activo = FALSE,
        vigente_hasta = NOW(),
        actualizado_por = $1,
        actualizado_en = NOW()

      WHERE contenedor_id = $2
        AND activo = TRUE
    `,
    [
      usuarioId,
      contenedorId,
    ]
  );
}


async function crearCostoVigente(
  client,
  {
    contenedorId,
    costoNuevo,
    usuarioId,
  }
) {

  const { rows } =
    await client.query(
      `
        INSERT INTO costos_contenedor
        (
          contenedor_id,
          costo_por_libra,
          activo,
          vigente_desde,
          vigente_hasta,
          actualizado_por,
          actualizado_en
        )
        VALUES
        (
          $1,
          $2,
          TRUE,
          NOW(),
          NULL,
          $3,
          NOW()
        )

        RETURNING
          id,
          contenedor_id,
          costo_por_libra,
          vigente_desde
      `,
      [
        contenedorId,
        costoNuevo,
        usuarioId,
      ]
    );


  return rows[0];
}


async function registrarHistorialCosto(
  client,
  {
    contenedorId,
    costoAnterior,
    costoNuevo,
    usuarioId,
  }
) {

  await client.query(
    `
      INSERT INTO historial_costos_contenedor
      (
        contenedor_id,
        costo_anterior,
        costo_nuevo,
        cambiado_por,
        origen,
        motivo,
        cambiado_en
      )
      VALUES
      (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        NOW()
      )
    `,
    [
      contenedorId,
      costoAnterior,
      costoNuevo,
      usuarioId,
      "manual",
      "Costo global (tipos 1 y 2)",
    ]
  );
}


// ======================================================
// GUARDAR COSTO CONFIRMADO EN EL PROCESO
// ======================================================
//
// Esto permite saber:
//
// COSTO
//    ↓
// CALCULO
//    ↓
// RECOLECCION
//
// sin crear una columna nueva.
// ======================================================

async function guardarCostoEnProceso(
  client,
  {
    procesoId,
    usuarioId,
    costoVigenteId,
    costoPorLibra,
  }
) {

  const { rows } =
    await client.query(
      `
        UPDATE historial_calculo_costos

        SET
          costo_por_libra_aplicado = $1,
          costo_vigente_id = $2,
          fuente_costo = $3

        WHERE id = $4
          AND calculado_por = $5
          AND estado_proceso = $6
          AND total_en_libras IS NULL
          AND lectura_id IS NULL

        RETURNING
          id,
          contenedor_id,
          id_tipo_residuo,
          calculado_por,

          costo_por_libra_aplicado,
          costo_vigente_id,
          fuente_costo,

          total_en_libras,
          porcentaje_llenado,
          total_costo_q,
          lectura_id,

          calculado_en,
          estado_proceso
      `,
      [
        costoPorLibra,
        costoVigenteId,
        "vigente",

        procesoId,
        usuarioId,

        ESTADO_PROCESO
          .EN_PROCESO,
      ]
    );


  if (
    rows.length === 0
  ) {

    throw new RegistroPesajeError(
      409,
      "No fue posible confirmar el costo porque el proceso cambió de etapa.",
      {
        codigo:
          "COSTO_NO_CONFIRMADO",
      }
    );
  }


  return rows[0];
}


// ======================================================
// RESPUESTA DE FOTO 3
// ======================================================
//
// Solo devuelve información necesaria para mostrar.
//
// lectura_id
// costo_vigente_id
// historial_calculo_id
//
// permanecen internos.
// ======================================================

function construirRespuestaCalculo({
  proceso,
  contenedor,
  yaCalculado = false,
}) {

  return {

    message:
      yaCalculado
        ? "El peso de este proceso ya fue calculado."
        : "Cálculo realizado correctamente.",


    codigo:
      yaCalculado
        ? "CALCULO_YA_REALIZADO"
        : "CALCULO_REALIZADO",


    estado_medicion:
      ESTADO_MEDICION
        .ESTABLE,


    estado_proceso:
      proceso
        .estado_proceso,


    etapa:
      ETAPA_PROCESO
        .RECOLECCION,


    total_en_libras:
      Number(
        proceso
          .total_en_libras
      ),


    porcentaje_llenado:
      Number(
        proceso
          .porcentaje_llenado
      ),


    costo_por_libra_aplicado:
      Number(
        proceso
          .costo_por_libra_aplicado
      ),


    total_costo_q:
      Number(
        proceso
          .total_costo_q
      ),


    contenedor: {

      codigo:
        contenedor
          ?.codigo || "",


      id_tipo_residuo:
        Number(
          proceso
            .id_tipo_residuo
        ),
    },
  };
}


// ======================================================
// CONSULTAR PROCESO ACTIVO
// ======================================================

async function consultarProcesoActivo({
  idUsuario,
}) {

  const usuarioId =
    toInt(idUsuario);


  if (!usuarioId) {

    throw new RegistroPesajeError(
      401,
      "Usuario no autenticado"
    );
  }


  const proceso =
    await buscarProcesoActivo(
      pool,
      usuarioId
    );


  if (!proceso) {

    return {

      tiene_proceso_activo:
        false,

      proceso:
        null,
    };
  }


  return {

    tiene_proceso_activo:
      true,


    proceso: {

      /*
       * Temporalmente se mantiene porque
       * cancelar todavía usa este identificador.
       *
       * Cuando migremos Cancelar al Service,
       * también desaparecerá del frontend.
       */
      historial_calculo_id:
        Number(
          proceso.id
        ),


      contenedor_id:
        Number(
          proceso
            .contenedor_id
        ),


      id_tipo_residuo:
        Number(
          proceso
            .id_tipo_residuo
        ),


      estado_proceso:
        proceso
          .estado_proceso,


      iniciado_en:
        proceso
          .calculado_en,


      etapa:
        determinarEtapaProceso(
          proceso
        ),


      calculo_completado:
        procesoTieneCalculo(
          proceso
        ),
    },
  };
}


// ======================================================
// FOTO 1 - INICIAR PROCESO
// ======================================================

async function iniciarProceso({
  idUsuario,
  idTipoResiduo,
}) {

  const usuarioId =
    toInt(idUsuario);


  const tipoResiduoId =
    toInt(
      idTipoResiduo
    );


  if (!usuarioId) {

    throw new RegistroPesajeError(
      401,
      "Usuario no autenticado"
    );
  }


  if (!tipoResiduoId) {

    throw new RegistroPesajeError(
      400,
      "id_tipo_residuo es requerido"
    );
  }


  if (
    !TIPOS_DSH.includes(
      tipoResiduoId
    )
  ) {

    throw new RegistroPesajeError(
      400,
      "Tipo de residuo no válido"
    );
  }


  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    // ==================================================
    // 1. Bloquear usuario
    // ==================================================

    await bloquearUsuario(
      client,
      usuarioId
    );


    // ==================================================
    // 2. Evitar otro EN_PROCESO
    // ==================================================

    const procesoActivo =
      await buscarProcesoActivo(
        client,
        usuarioId
      );


    if (procesoActivo) {

      throw new RegistroPesajeError(
        409,
        "Tiene un proceso de pesaje en curso. ¿Qué desea hacer?",
        {

          codigo:
            "PROCESO_EN_CURSO",


          requiere_decision:
            true,


          proceso: {

            historial_calculo_id:
              Number(
                procesoActivo.id
              ),


            contenedor_id:
              Number(
                procesoActivo
                  .contenedor_id
              ),


            id_tipo_residuo:
              Number(
                procesoActivo
                  .id_tipo_residuo
              ),


            estado_proceso:
              procesoActivo
                .estado_proceso,


            iniciado_en:
              procesoActivo
                .calculado_en,


            etapa:
              determinarEtapaProceso(
                procesoActivo
              ),


            calculo_completado:
              procesoTieneCalculo(
                procesoActivo
              ),
          },
        }
      );
    }


    // ==================================================
    // 3. Contenedor
    // ==================================================

    const contenedor =
      await obtenerContenedorPorTipo(
        client,
        tipoResiduoId
      );


    if (!contenedor) {

      throw new RegistroPesajeError(
        404,
        "No existe un contenedor para el tipo seleccionado"
      );
    }


    if (
      Number(
        contenedor.estado_id
      ) ===
      ESTADO_CONTENEDOR
        .INACTIVO
    ) {

      throw new RegistroPesajeError(
        409,
        "El contenedor está inactivo. No se puede iniciar el proceso."
      );
    }


    // ==================================================
    // 4. Nivel actual
    // ==================================================

    const medicionNivel =
      await medicionesService
        .obtenerNivelActual({

          contenedorId:
            contenedor
              .id_contenedor,

          db:
            client,
        });


    if (!medicionNivel) {

      throw new RegistroPesajeError(
        503,
        "No fue posible obtener el nivel actual del contenedor.",
        {
          codigo:
            "NIVEL_NO_DISPONIBLE",
        }
      );
    }


    const porcentajeLlenado =
      toNumber(
        medicionNivel
          .valor
      );


    if (
      porcentajeLlenado ===
        null ||
      porcentajeLlenado < 0 ||
      porcentajeLlenado > 100
    ) {

      throw new RegistroPesajeError(
        503,
        "La lectura actual del nivel no es válida.",
        {
          codigo:
            "NIVEL_INVALIDO",
        }
      );
    }


    // ==================================================
    // 5. Crear proceso
    // ==================================================

    const proceso =
      await crearProceso(
        client,
        {

          contenedorId:
            contenedor
              .id_contenedor,

          tipoResiduoId,

          usuarioId,
        }
      );


    await client.query(
      "COMMIT"
    );


    return {

      message:
        "Proceso iniciado correctamente",


      estado_proceso:
        proceso
          .estado_proceso,


      etapa:
        ETAPA_PROCESO
          .COSTO,


      /*
       * Estos datos se utilizan solamente
       * para presentación inmediata.
       *
       * Foto 3 no volverá a confiar en ellos.
       */
      contenedor: {

        codigo:
          contenedor
            .codigo,


        id_tipo_residuo:
          Number(
            contenedor
              .id_tipo_residuo
          ),


        porcentaje_llenado:
          porcentajeLlenado,
      },
    };


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;


  } finally {

    client.release();
  }
}


// ======================================================
// FOTO 2 - OBTENER COSTO
// ======================================================
//
// El backend determina el contenedor mediante
// el proceso EN_PROCESO.
//
// No necesitamos contenedor_id desde frontend.
// ======================================================

async function obtenerCostoGlobal({
  idUsuario,
}) {

  const usuarioId =
    toInt(idUsuario);


  if (!usuarioId) {

    throw new RegistroPesajeError(
      401,
      "Usuario no autenticado"
    );
  }


  const proceso =
    await requerirProcesoActivo(
      pool,
      usuarioId
    );


  /*
   * Si ya se confirmó un costo para
   * este proceso, devolvemos ese.
   */
  if (
    procesoTieneCostoConfirmado(
      proceso
    )
  ) {

    return {

      costo_por_libra:
        Number(
          proceso
            .costo_por_libra_aplicado
        ),


      costo_confirmado:
        true,


      etapa:
        determinarEtapaProceso(
          proceso
        ),
    };
  }


  const costo =
    await obtenerCostoVigentePorContenedor(
      pool,

      proceso
        .contenedor_id
    );


  if (!costo) {

    throw new RegistroPesajeError(
      404,
      "No hay costo vigente."
    );
  }


  return {

    costo_por_libra:
      Number(
        costo
          .costo_por_libra
      ),


    vigente_desde:
      costo
        .vigente_desde,


    costo_confirmado:
      false,


    etapa:
      ETAPA_PROCESO
        .COSTO,
  };
}


// ======================================================
// FOTO 2 - CONFIRMAR COSTO ACTUAL
// ======================================================
//
// Se utiliza cuando el usuario decide:
//
// "Continuar con el costo actual"
//
// El frontend NO manda el costo.
// ======================================================

async function confirmarCostoGlobal({
  idUsuario,
}) {

  const usuarioId =
    toInt(idUsuario);


  if (!usuarioId) {

    throw new RegistroPesajeError(
      401,
      "Usuario no autenticado"
    );
  }


  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    let proceso =
      await requerirProcesoActivo(
        client,
        usuarioId
      );


    proceso =
      await obtenerProcesoPorId(
        client,
        {

          procesoId:
            proceso.id,

          usuarioId,

          bloquear:
            true,
        }
      );


    if (!proceso) {

      throw new RegistroPesajeError(
        409,
        "No existe un proceso activo."
      );
    }


    // ==================================================
    // Ya tiene cálculo
    // ==================================================

    if (
      procesoTieneCalculo(
        proceso
      )
    ) {

      throw new RegistroPesajeError(
        409,
        "Este proceso ya tiene un cálculo realizado.",
        {
          codigo:
            "CALCULO_YA_REALIZADO",

          etapa:
            ETAPA_PROCESO
              .RECOLECCION,
        }
      );
    }


    // ==================================================
    // Ya estaba confirmado
    // ==================================================

    if (
      procesoTieneCostoConfirmado(
        proceso
      )
    ) {

      await client.query(
        "COMMIT"
      );


      return {

        message:
          "El costo ya se encontraba confirmado.",


        costo_por_libra:
          Number(
            proceso
              .costo_por_libra_aplicado
          ),


        etapa:
          ETAPA_PROCESO
            .CALCULO,
      };
    }


    // ==================================================
    // Buscar costo del contenedor real
    // ==================================================

    const costo =
      await obtenerCostoVigentePorContenedor(
        client,

        proceso
          .contenedor_id
      );


    if (!costo) {

      throw new RegistroPesajeError(
        404,
        "No existe un costo vigente para el contenedor."
      );
    }


    const costoPorLibra =
      toNumber(
        costo
          .costo_por_libra
      );


    const costoVigenteId =
      toInt(
        costo.id
      );


    if (
      costoPorLibra ===
        null ||
      costoPorLibra < 0 ||
      !costoVigenteId
    ) {

      throw new RegistroPesajeError(
        500,
        "El costo vigente contiene datos inválidos."
      );
    }


    proceso =
      await guardarCostoEnProceso(
        client,
        {

          procesoId:
            proceso.id,

          usuarioId,

          costoVigenteId,

          costoPorLibra,
        }
      );


    await client.query(
      "COMMIT"
    );


    return {

      message:
        "Costo confirmado correctamente.",


      costo_por_libra:
        Number(
          proceso
            .costo_por_libra_aplicado
        ),


      etapa:
        ETAPA_PROCESO
          .CALCULO,
    };


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;


  } finally {

    client.release();
  }
}


// ======================================================
// FOTO 2 - EDITAR COSTO GLOBAL
// ======================================================

async function guardarCostoGlobal({
  idUsuario,
  costoPorLibra,
}) {

  const usuarioId =
    toInt(idUsuario);


  const costoNuevo =
    toNumber(
      costoPorLibra
    );


  if (!usuarioId) {

    throw new RegistroPesajeError(
      401,
      "Usuario no autenticado"
    );
  }


  if (
    costoNuevo ===
      null ||
    costoNuevo < 0
  ) {

    throw new RegistroPesajeError(
      400,
      "Costo inválido"
    );
  }


  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    // ==================================================
    // 1. Proceso
    // ==================================================

    let proceso =
      await requerirProcesoActivo(
        client,
        usuarioId
      );


    proceso =
      await obtenerProcesoPorId(
        client,
        {

          procesoId:
            proceso.id,

          usuarioId,

          bloquear:
            true,
        }
      );


    if (!proceso) {

      throw new RegistroPesajeError(
        409,
        "No existe un proceso activo."
      );
    }


    if (
      procesoTieneCalculo(
        proceso
      )
    ) {

      throw new RegistroPesajeError(
        409,
        "El proceso ya tiene un cálculo de peso.",
        {
          codigo:
            "CALCULO_YA_REALIZADO",
        }
      );
    }


    /*
     * Una vez confirmado el costo de este proceso
     * no permitimos modificarlo silenciosamente.
     */
    if (
      procesoTieneCostoConfirmado(
        proceso
      )
    ) {

      const costoConfirmado =
        Number(
          proceso
            .costo_por_libra_aplicado
        );


      if (
        costoConfirmado ===
        costoNuevo
      ) {

        await client.query(
          "COMMIT"
        );


        return {

          message:
            "El costo ya se encontraba aplicado al proceso.",


          costo_por_libra:
            costoConfirmado,


          etapa:
            ETAPA_PROCESO
              .CALCULO,
        };
      }


      throw new RegistroPesajeError(
        409,
        "El costo de este proceso ya fue confirmado.",
        {
          codigo:
            "COSTO_YA_CONFIRMADO",
        }
      );
    }


    // ==================================================
    // 2. Bloquear contenedores DSH
    // ==================================================

    const {
      tipo1,
      tipo2,
    } =
      await obtenerContenedoresGlobalDSH(
        client,
        true
      );


    if (
      !tipo1 ||
      !tipo2
    ) {

      throw new RegistroPesajeError(
        400,
        "Debe existir un contenedor tipo 1 y un contenedor tipo 2 para aplicar el costo global."
      );
    }


    const contenedores = [
      tipo1,
      tipo2,
    ];


    // ==================================================
    // 3. Obtener costos actuales
    // ==================================================

    const costosActuales = [];


    for (
      const contenedorId
      of contenedores
    ) {

      const registro =
        await obtenerCostoVigentePorContenedor(
          client,
          contenedorId
        );


      costosActuales.push({

        contenedorId,

        registro,
      });
    }


    // ==================================================
    // 4. Evitar costo idéntico
    // ==================================================

    const todosIguales =
      costosActuales.every(
        ({
          registro,
        }) => {

          if (!registro) {
            return false;
          }


          return (
            Number(
              registro
                .costo_por_libra
            ) ===
            costoNuevo
          );
        }
      );


    if (todosIguales) {

      throw new RegistroPesajeError(
        409,
        "El costo ingresado ya es el costo vigente.",
        {

          codigo:
            "COSTO_SIN_CAMBIOS",

          costo_por_libra:
            costoNuevo,
        }
      );
    }


    // ==================================================
    // 5. Aplicar nuevo costo
    // ==================================================

    const costosAplicados = [];


    for (
      const {
        contenedorId,
        registro,
      }
      of costosActuales
    ) {

      const costoAnterior =
        registro
          ? Number(
              registro
                .costo_por_libra
            )
          : null;


      /*
       * Si un contenedor ya tiene
       * exactamente el costo solicitado,
       * no duplicamos.
       */
      if (
        registro &&
        costoAnterior ===
          costoNuevo
      ) {

        costosAplicados.push(
          registro
        );

        continue;
      }


      await cerrarCostoVigente(
        client,
        {
          contenedorId,
          usuarioId,
        }
      );


      const nuevoCosto =
        await crearCostoVigente(
          client,
          {
            contenedorId,
            costoNuevo,
            usuarioId,
          }
        );


      await registrarHistorialCosto(
        client,
        {
          contenedorId,
          costoAnterior,
          costoNuevo,
          usuarioId,
        }
      );


      costosAplicados.push(
        nuevoCosto
      );
    }


    // ==================================================
    // 6. Costo del proceso actual
    // ==================================================

    const costoProceso =
      costosAplicados.find(
        (costo) =>

          Number(
            costo
              .contenedor_id
          ) ===
          Number(
            proceso
              .contenedor_id
          )
      );


    if (!costoProceso) {

      throw new RegistroPesajeError(
        500,
        "No fue posible determinar el costo correspondiente al proceso."
      );
    }


    const costoProcesoId =
      toInt(
        costoProceso.id
      );


    const costoProcesoValor =
      toNumber(
        costoProceso
          .costo_por_libra
      );


    if (
      !costoProcesoId ||
      costoProcesoValor ===
        null
    ) {

      throw new RegistroPesajeError(
        500,
        "El nuevo costo contiene información inválida."
      );
    }


    // ==================================================
    // 7. Congelar costo para este proceso
    // ==================================================

    proceso =
      await guardarCostoEnProceso(
        client,
        {

          procesoId:
            proceso.id,

          usuarioId,

          costoVigenteId:
            costoProcesoId,

          costoPorLibra:
            costoProcesoValor,
        }
      );


    await client.query(
      "COMMIT"
    );


    return {

      message:
        "Costo global actualizado correctamente.",


      costo_por_libra:
        Number(
          proceso
            .costo_por_libra_aplicado
        ),


      etapa:
        ETAPA_PROCESO
          .CALCULO,
    };


  } catch (error) {

    await client.query(
      "ROLLBACK"
    );

    throw error;


  } finally {

    client.release();
  }
}


// ======================================================
// FOTO 3 - CALCULAR PESO
// ======================================================
//
// MUY IMPORTANTE:
//
// Solo recibe:
//
// idUsuario
//
// NO recibe del frontend:
//
// historial_calculo_id
// contenedor_id
// id_tipo_residuo
// peso
// costo
// porcentaje
//
// Todo sale del backend.
// ======================================================

async function guardarCalculo({
  idUsuario,
}) {

  const usuarioId =
    toInt(idUsuario);


  if (!usuarioId) {

    throw new RegistroPesajeError(
      401,
      "Usuario no autenticado"
    );
  }


  const client =
    await pool.connect();


  let procesoId =
    null;


  let bloqueoAdquirido =
    false;


  let transaccionActiva =
    false;


  try {

    // ==================================================
    // 1. Buscar proceso real del usuario
    // ==================================================

    let proceso =
      await requerirProcesoActivo(
        client,
        usuarioId
      );


    procesoId =
      toInt(
        proceso.id
      );


    if (!procesoId) {

      throw new RegistroPesajeError(
        500,
        "El proceso activo contiene un identificador inválido."
      );
    }


    // ==================================================
    // 2. Evitar varias mediciones simultáneas
    // ==================================================

    bloqueoAdquirido =
      await adquirirBloqueoCalculo(
        client,
        procesoId
      );


    // ==================================================
    // 3. Volver a consultar después del lock
    // ==================================================

    proceso =
      await obtenerProcesoPorId(
        client,
        {

          procesoId,

          usuarioId,

          bloquear:
            false,
        }
      );


    if (!proceso) {

      throw new RegistroPesajeError(
        409,
        "El proceso dejó de estar disponible."
      );
    }


    if (
      proceso
        .estado_proceso !==
      ESTADO_PROCESO
        .EN_PROCESO
    ) {

      throw new RegistroPesajeError(
        409,
        "Este proceso ya fue finalizado o cancelado.",
        {
          codigo:
            "PROCESO_NO_ACTIVO",
        }
      );
    }


    // ==================================================
    // 4. IDEMPOTENCIA
    // ==================================================
    //
    // Si ya se calculó antes:
    //
    // NO consulta sensor otra vez.
    // NO guarda otra vez.
    // ==================================================

    if (
      procesoTieneCalculo(
        proceso
      )
    ) {

      const contenedor =
        await obtenerContenedorPorId(
          client,

          proceso
            .contenedor_id
        );


      return construirRespuestaCalculo({
        proceso,
        contenedor,
        yaCalculado:
          true,
      });
    }


    // ==================================================
    // 5. Foto 2 debe estar confirmada
    // ==================================================

    if (
      !procesoTieneCostoConfirmado(
        proceso
      )
    ) {

      throw new RegistroPesajeError(
        409,
        "Debe confirmar el costo antes de calcular el peso.",
        {

          codigo:
            "COSTO_NO_CONFIRMADO",

          etapa:
            ETAPA_PROCESO
              .COSTO,
        }
      );
    }


    // ==================================================
    // 6. Datos REALES desde proceso
    // ==================================================

    const contenedorId =
      toInt(
        proceso
          .contenedor_id
      );


    const tipoResiduoId =
      toInt(
        proceso
          .id_tipo_residuo
      );


    const costoPorLibra =
      toNumber(
        proceso
          .costo_por_libra_aplicado
      );


    const costoVigenteId =
      toInt(
        proceso
          .costo_vigente_id
      );


    if (
      !contenedorId ||
      !tipoResiduoId ||
      costoPorLibra === null ||
      costoPorLibra < 0 ||
      !costoVigenteId
    ) {

      throw new RegistroPesajeError(
        500,
        "El proceso activo contiene información incompleta."
      );
    }


    // ==================================================
    // 7. Validar contenedor
    // ==================================================

    const contenedor =
      await obtenerContenedorPorId(
        client,
        contenedorId
      );


    if (!contenedor) {

      throw new RegistroPesajeError(
        404,
        "Contenedor no encontrado."
      );
    }


    if (
      Number(
        contenedor
          .id_tipo_residuo
      ) !==
      tipoResiduoId
    ) {

      throw new RegistroPesajeError(
        409,
        "El proceso contiene una relación de contenedor inválida.",
        {
          codigo:
            "PROCESO_INCONSISTENTE",
        }
      );
    }


    if (
      Number(
        contenedor
          .estado_id
      ) ===
      ESTADO_CONTENEDOR
        .INACTIVO
    ) {

      throw new RegistroPesajeError(
        409,
        "El contenedor está inactivo. No se puede realizar el cálculo.",
        {
          codigo:
            "CONTENEDOR_INACTIVO",
        }
      );
    }


    // ==================================================
    // 8. PESO
    // ==================================================
    //
    // HOY:
    // base_datos
    //
    // FUTURO:
    // modulo
    //
    // Foto 3 no necesita saber cuál.
    // ==================================================

    const medicionPeso =
      await medicionesService
        .obtenerPesoActual({

          contenedorId,

          db:
            client,
        });


    if (!medicionPeso) {

      throw new RegistroPesajeError(
        503,
        "No fue posible obtener una medición de peso.",
        {

          codigo:
            "PESO_NO_DISPONIBLE",

          estado_medicion:
            ESTADO_MEDICION
              .ERROR,
        }
      );
    }


    const totalEnLibras =
      toNumber(
        medicionPeso
          .valor
      );


    if (
      totalEnLibras ===
        null ||
      totalEnLibras < 0
    ) {

      throw new RegistroPesajeError(
        503,
        "La medición de peso recibida no es válida.",
        {

          codigo:
            "PESO_INVALIDO",

          estado_medicion:
            ESTADO_MEDICION
              .ERROR,
        }
      );
    }


    const lecturaId =
      toInt(
        medicionPeso
          .lectura_id
      );


    if (!lecturaId) {

      throw new RegistroPesajeError(
        503,
        "La medición de peso no contiene una referencia válida.",
        {

          codigo:
            "LECTURA_PESO_SIN_REFERENCIA",

          estado_medicion:
            ESTADO_MEDICION
              .ERROR,
        }
      );
    }


    // ==================================================
    // 9. NIVEL
    // ==================================================

    const medicionNivel =
      await medicionesService
        .obtenerNivelActual({

          contenedorId,

          db:
            client,
        });


    if (!medicionNivel) {

      throw new RegistroPesajeError(
        503,
        "No fue posible obtener el nivel actual del contenedor.",
        {

          codigo:
            "NIVEL_NO_DISPONIBLE",

          estado_medicion:
            ESTADO_MEDICION
              .ERROR,
        }
      );
    }


    const porcentajeLlenado =
      toNumber(
        medicionNivel
          .valor
      );


    if (
      porcentajeLlenado ===
        null ||
      porcentajeLlenado < 0 ||
      porcentajeLlenado > 100
    ) {

      throw new RegistroPesajeError(
        503,
        "La medición actual del nivel no es válida.",
        {

          codigo:
            "NIVEL_INVALIDO",

          estado_medicion:
            ESTADO_MEDICION
              .ERROR,
        }
      );
    }


    // ==================================================
    // 10. Total
    // ==================================================

    const totalCostoQ =
      Number(
        (
          totalEnLibras *
          costoPorLibra
        ).toFixed(2)
      );


    // ==================================================
    // 11. Transacción corta
    // ==================================================
    //
    // No mantenemos transacción abierta
    // mientras esperamos sensor.
    // ==================================================

    await client.query(
      "BEGIN"
    );


    transaccionActiva =
      true;


    proceso =
      await obtenerProcesoPorId(
        client,
        {

          procesoId,

          usuarioId,

          bloquear:
            true,
        }
      );


    if (!proceso) {

      throw new RegistroPesajeError(
        409,
        "El proceso dejó de estar disponible."
      );
    }


    if (
      proceso
        .estado_proceso !==
      ESTADO_PROCESO
        .EN_PROCESO
    ) {

      throw new RegistroPesajeError(
        409,
        "El proceso dejó de estar activo durante la medición.",
        {
          codigo:
            "PROCESO_NO_ACTIVO",
        }
      );
    }


    // ==================================================
    // 12. Segunda protección de idempotencia
    // ==================================================

    if (
      procesoTieneCalculo(
        proceso
      )
    ) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return construirRespuestaCalculo({
        proceso,
        contenedor,
        yaCalculado:
          true,
      });
    }


    // ==================================================
    // 13. Verificar costo congelado
    // ==================================================

    if (
      Number(
        proceso
          .costo_vigente_id
      ) !==
        costoVigenteId ||

      Number(
        proceso
          .costo_por_libra_aplicado
      ) !==
        costoPorLibra
    ) {

      throw new RegistroPesajeError(
        409,
        "El costo del proceso cambió durante la medición.",
        {
          codigo:
            "COSTO_PROCESO_MODIFICADO",
        }
      );
    }


    // ==================================================
    // 14. Guardar en MISMO proceso
    // ==================================================

    const { rows } =
      await client.query(
        `
          UPDATE historial_calculo_costos

          SET
            total_en_libras = $1,
            porcentaje_llenado = $2,
            total_costo_q = $3,
            lectura_id = $4

          WHERE id = $5
            AND calculado_por = $6
            AND estado_proceso = $7
            AND total_en_libras IS NULL
            AND lectura_id IS NULL

          RETURNING
            id,
            contenedor_id,
            id_tipo_residuo,
            calculado_por,
            recoleccion_id,

            total_en_libras,
            porcentaje_recolectado,
            porcentaje_llenado,

            costo_por_libra_aplicado,
            total_costo_q,
            fuente_costo,
            costo_vigente_id,

            lectura_id,

            calculado_en,
            estado_proceso,
            observaciones
        `,
        [
          totalEnLibras,

          Number(
            porcentajeLlenado
              .toFixed(2)
          ),

          totalCostoQ,

          lecturaId,

          procesoId,

          usuarioId,

          ESTADO_PROCESO
            .EN_PROCESO,
        ]
      );


    if (
      rows.length === 0
    ) {

      throw new RegistroPesajeError(
        409,
        "El cálculo ya fue procesado o el proceso cambió de estado.",
        {
          codigo:
            "CALCULO_NO_APLICADO",
        }
      );
    }


    const procesoActualizado =
      rows[0];


    await client.query(
      "COMMIT"
    );


    transaccionActiva =
      false;


    return construirRespuestaCalculo({
      proceso:
        procesoActualizado,

      contenedor,

      yaCalculado:
        false,
    });


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
          "Error haciendo rollback de cálculo:",
          rollbackError.message
        );
      }
    }


    throw error;


  } finally {

    if (
      bloqueoAdquirido &&
      procesoId
    ) {

      await liberarBloqueoCalculo(
        client,
        procesoId
      );
    }


    client.release();
  }
}
// ======================================================
// CANCELAR PROCESO ACTUAL
// ======================================================

async function cancelarProceso({
  idUsuario,
}) {

  const usuarioId =
    toInt(
      idUsuario
    );


  if (!usuarioId) {

    throw new RegistroPesajeError(
      401,
      "Usuario no autenticado"
    );
  }


  const client =
    await pool.connect();


  try {

    await client.query(
      "BEGIN"
    );


    // ==================================================
    // 1. Bloquear usuario
    // ==================================================

    await bloquearUsuario(
      client,
      usuarioId
    );


    // ==================================================
    // 2. Buscar proceso activo
    // ==================================================

    let proceso =
      await buscarProcesoActivo(
        client,
        usuarioId
      );


    if (!proceso) {

      throw new RegistroPesajeError(
        409,
        "No existe un proceso activo para cancelar.",
        {
          codigo:
            "PROCESO_NO_ACTIVO",
        }
      );
    }


    // ==================================================
    // 3. Bloquear ese proceso
    // ==================================================

    proceso =
      await obtenerProcesoPorId(
        client,
        {
          procesoId:
            proceso.id,

          usuarioId,

          bloquear:
            true,
        }
      );


    if (
      !proceso ||
      proceso.estado_proceso !==
        ESTADO_PROCESO
          .EN_PROCESO
    ) {

      throw new RegistroPesajeError(
        409,
        "El proceso ya fue finalizado o cancelado.",
        {
          codigo:
            "PROCESO_NO_ACTIVO",
        }
      );
    }


    // ==================================================
    // 4. CANCELAR
    // ==================================================

    const { rows } =
      await client.query(
        `
          UPDATE historial_calculo_costos

          SET
            estado_proceso = $1

          WHERE id = $2
            AND calculado_por = $3
            AND estado_proceso = $4

          RETURNING
            id,
            estado_proceso
        `,
        [
          ESTADO_PROCESO
            .CANCELADO,

          proceso.id,

          usuarioId,

          ESTADO_PROCESO
            .EN_PROCESO,
        ]
      );


    if (
      rows.length === 0
    ) {

      throw new RegistroPesajeError(
        409,
        "No fue posible cancelar el proceso.",
        {
          codigo:
            "PROCESO_MODIFICADO",
        }
      );
    }


    await client.query(
      "COMMIT"
    );


    return {

      message:
        "Proceso cancelado correctamente.",

      estado_proceso:
        ESTADO_PROCESO
          .CANCELADO,
    };


  } catch (error) {

    try {

      await client.query(
        "ROLLBACK"
      );

    } catch (
      rollbackError
    ) {

      console.error(
        "Error haciendo rollback al cancelar:",
        rollbackError.message
      );
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

  // FOTO 1
  iniciarProceso,
  consultarProcesoActivo,


  // FOTO 2
  obtenerCostoGlobal,
  confirmarCostoGlobal,
  guardarCostoGlobal,


  // FOTO 3
  guardarCalculo,

   // CANCELAR
  cancelarProceso,


  // ERROR
  RegistroPesajeError,
};