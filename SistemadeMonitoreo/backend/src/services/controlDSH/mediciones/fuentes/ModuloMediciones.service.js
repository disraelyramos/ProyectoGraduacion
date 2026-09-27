const pool = require(
  "../../../../config/db"
);


// ======================================================
// CONSTANTES
// ======================================================

const ESTADO_SOLICITUD = {

  PENDIENTE:
    "PENDIENTE",

  MIDIENDO:
    "MIDIENDO",

  ESTABILIZANDO:
    "ESTABILIZANDO",

  MOVIMIENTO_DETECTADO:
    "MOVIMIENTO_DETECTADO",

  COMPLETADO:
    "COMPLETADO",

  ERROR:
    "ERROR",

  TIMEOUT:
    "TIMEOUT",

  CANCELADO:
    "CANCELADO",
};


const ESTADOS_ACTIVOS = [

  ESTADO_SOLICITUD
    .PENDIENTE,

  ESTADO_SOLICITUD
    .MIDIENDO,

  ESTADO_SOLICITUD
    .ESTABILIZANDO,

  ESTADO_SOLICITUD
    .MOVIMIENTO_DETECTADO,
];


// ======================================================
// CONFIGURACION
// ======================================================

const INTERVALO_CONSULTA_MS =
  500;


// Máximo por defecto: 2 minutos.
//
// Puede configurarse en .env:
//
// MEDICION_PESO_TIMEOUT_MS=120000
//
const TIMEOUT_MEDICION_MS =
  Number(
    process.env
      .MEDICION_PESO_TIMEOUT_MS
  ) > 0

    ? Number(
        process.env
          .MEDICION_PESO_TIMEOUT_MS
      )

    : 120000;


// ======================================================
// HELPERS
// ======================================================

function esperar(ms) {

  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        ms
      )
  );
}


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
// ERROR DEL PROVEEDOR
// ======================================================

class ModuloMedicionesError
  extends Error {

  constructor(
    message,
    {
      codigo =
        "ERROR_MODULO_PESO",

      estado =
        ESTADO_SOLICITUD.ERROR,
    } = {}
  ) {

    super(message);

    this.codigo =
      codigo;

    this.estado =
      estado;
  }
}


// ======================================================
// DETERMINAR MODULO DEL CONTENEDOR
// ======================================================
//
// BD REAL:
//
// tipo 1 = Infecciosos
// tipo 2 = Punzocortante
//
// ======================================================

async function obtenerModuloPorContenedor({
  contenedorId,
  db,
}) {

  const { rows } =
    await db.query(
      `
        SELECT
          id_contenedor,
          id_tipo_residuo

        FROM contenedores

        WHERE id_contenedor = $1

        LIMIT 1
      `,
      [
        contenedorId,
      ]
    );


  if (
    rows.length === 0
  ) {

    throw new ModuloMedicionesError(
      "No existe el contenedor solicitado.",
      {
        codigo:
          "CONTENEDOR_NO_ENCONTRADO",
      }
    );
  }


  const tipoResiduoId =
    toInt(
      rows[0]
        .id_tipo_residuo
    );


  if (
    tipoResiduoId === 1
  ) {

    return {
      moduloCodigo:
        "PESO_BIOINFECCIOSO",

      tipoResiduoId,
    };
  }


  if (
    tipoResiduoId === 2
  ) {

    return {
      moduloCodigo:
        "PESO_PUNZOCORTANTE",

      tipoResiduoId,
    };
  }


  throw new ModuloMedicionesError(
    "El tipo de residuo no tiene un módulo de peso configurado.",
    {
      codigo:
        "MODULO_NO_CONFIGURADO",
    }
  );
}


// ======================================================
// BUSCAR SOLICITUD ACTIVA
// ======================================================

async function buscarSolicitudActiva({
  procesoId,
  db,
}) {

  const { rows } =
    await db.query(
      `
        SELECT
          id,
          proceso_id,
          contenedor_id,
          modulo_codigo,
          estado,
          mensaje,
          peso_lb,
          lectura_id,
          creado_en,
          actualizado_en,
          completado_en

        FROM solicitudes_medicion_peso

        WHERE proceso_id = $1
          AND estado = ANY($2::varchar[])

        ORDER BY
          id DESC

        LIMIT 1
      `,
      [
        procesoId,
        ESTADOS_ACTIVOS,
      ]
    );


  return rows[0] || null;
}


// ======================================================
// CREAR SOLICITUD
// ======================================================

async function crearSolicitud({
  procesoId,
  contenedorId,
  moduloCodigo,
  db,
}) {

  try {

    const { rows } =
      await db.query(
        `
          INSERT INTO solicitudes_medicion_peso
          (
            proceso_id,
            contenedor_id,
            modulo_codigo,
            estado,
            mensaje,
            creado_en,
            actualizado_en
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            NOW(),
            NOW()
          )

          RETURNING
            id,
            proceso_id,
            contenedor_id,
            modulo_codigo,
            estado,
            mensaje,
            peso_lb,
            lectura_id,
            creado_en,
            actualizado_en,
            completado_en
        `,
        [
          procesoId,
          contenedorId,
          moduloCodigo,

          ESTADO_SOLICITUD
            .PENDIENTE,

          "Esperando módulo de peso",
        ]
      );


    return rows[0];


  } catch (error) {

    /*
     * 23505:
     * unique_violation
     *
     * Puede ocurrir si dos solicitudes intentaron
     * crearse prácticamente al mismo tiempo.
     *
     * El índice parcial de la BD impide tener
     * dos solicitudes activas para el mismo proceso.
     */
    if (
      error?.code ===
      "23505"
    ) {

      const existente =
        await buscarSolicitudActiva({
          procesoId,
          db,
        });


      if (existente) {

        return existente;
      }
    }


    throw error;
  }
}


// ======================================================
// OBTENER O CREAR SOLICITUD
// ======================================================

async function obtenerOCrearSolicitud({
  procesoId,
  contenedorId,
  moduloCodigo,
  db,
}) {

  const existente =
    await buscarSolicitudActiva({
      procesoId,
      db,
    });


  if (existente) {

    /*
     * Protección adicional:
     *
     * Si existiera una solicitud activa de ese
     * proceso pero para otro contenedor/módulo,
     * no la reutilizamos silenciosamente.
     */
    if (
      Number(
        existente
          .contenedor_id
      ) !==
      Number(
        contenedorId
      )
    ) {

      throw new ModuloMedicionesError(
        "La solicitud de medición activa pertenece a otro contenedor.",
        {
          codigo:
            "SOLICITUD_INCONSISTENTE",
        }
      );
    }


    if (
      existente
        .modulo_codigo !==
      moduloCodigo
    ) {

      throw new ModuloMedicionesError(
        "La solicitud activa pertenece a otro módulo.",
        {
          codigo:
            "MODULO_INCONSISTENTE",
        }
      );
    }


    return existente;
  }


  return crearSolicitud({
    procesoId,
    contenedorId,
    moduloCodigo,
    db,
  });
}


// ======================================================
// CONSULTAR SOLICITUD
// ======================================================

async function obtenerSolicitudPorId({
  solicitudId,
  db,
}) {

  const { rows } =
    await db.query(
      `
        SELECT
          id,
          proceso_id,
          contenedor_id,
          modulo_codigo,
          estado,
          mensaje,
          peso_lb,
          lectura_id,
          creado_en,
          actualizado_en,
          completado_en

        FROM solicitudes_medicion_peso

        WHERE id = $1

        LIMIT 1
      `,
      [
        solicitudId,
      ]
    );


  return rows[0] || null;
}


// ======================================================
// MARCAR TIMEOUT
// ======================================================

async function marcarTimeout({
  solicitudId,
  db,
}) {

  await db.query(
    `
      UPDATE solicitudes_medicion_peso

      SET
        estado = $1,
        mensaje = $2,
        actualizado_en = NOW()

      WHERE id = $3
        AND estado = ANY($4::varchar[])
    `,
    [
      ESTADO_SOLICITUD
        .TIMEOUT,

      "Se agotó el tiempo para obtener la medición.",

      solicitudId,

      ESTADOS_ACTIVOS,
    ]
  );
}


// ======================================================
// OBTENER LECTURA FINAL
// ======================================================

async function obtenerLecturaFinal({
  lecturaId,
  contenedorId,
  db,
}) {

  const { rows } =
    await db.query(
      `
        SELECT
          l.id,
          l.contenedor_id,
          l.valor,
          l.fuente_lectura,
          l.estado_lectura,
          l.fecha_hora,

          tl.nombre
            AS tipo_lectura,

          um.nombre
            AS unidad

        FROM lecturas l

        JOIN tipos_lectura tl
          ON tl.id =
             l.tipo_lectura_id

        JOIN unidad_medida um
          ON um.id =
             l.unidad_id

        WHERE l.id = $1
          AND l.contenedor_id = $2
          AND tl.nombre = $3
          AND um.nombre = $4
          AND l.estado_lectura = $5

        LIMIT 1
      `,
      [
        lecturaId,
        contenedorId,
        "peso_lb",
        "lb",
        "normal",
      ]
    );


  return rows[0] || null;
}


// ======================================================
// ESPERAR RESULTADO DEL MODULO
// ======================================================

async function esperarResultado({
  solicitudId,
  contenedorId,
  db,
}) {

  const inicio =
    Date.now();


  while (
    Date.now() - inicio <
    TIMEOUT_MEDICION_MS
  ) {

    const solicitud =
      await obtenerSolicitudPorId({
        solicitudId,
        db,
      });


    if (!solicitud) {

      throw new ModuloMedicionesError(
        "La solicitud de medición dejó de existir.",
        {
          codigo:
            "SOLICITUD_NO_ENCONTRADA",
        }
      );
    }


    // ==================================================
    // COMPLETADO
    // ==================================================

    if (
      solicitud.estado ===
      ESTADO_SOLICITUD
        .COMPLETADO
    ) {

      const lecturaId =
        toInt(
          solicitud
            .lectura_id
        );


      const pesoSolicitud =
        toNumber(
          solicitud
            .peso_lb
        );


      if (
        !lecturaId ||
        pesoSolicitud === null ||
        pesoSolicitud < 0
      ) {

        throw new ModuloMedicionesError(
          "El módulo completó la medición con datos inválidos.",
          {
            codigo:
              "RESULTADO_MODULO_INVALIDO",
          }
        );
      }


      const lectura =
        await obtenerLecturaFinal({
          lecturaId,
          contenedorId,
          db,
        });


      if (!lectura) {

        throw new ModuloMedicionesError(
          "No fue posible validar la lectura generada por el módulo.",
          {
            codigo:
              "LECTURA_MODULO_INVALIDA",
          }
        );
      }


      const valor =
        toNumber(
          lectura.valor
        );


      if (
        valor === null ||
        valor < 0
      ) {

        throw new ModuloMedicionesError(
          "La lectura final de peso contiene un valor inválido.",
          {
            codigo:
              "PESO_MODULO_INVALIDO",
          }
        );
      }


      return {
        tipo:
          "peso_lb",

        valor,

        unidad:
          "lb",

        proveedor:
          "modulo",

        lectura_id:
          lectura.id,

        fecha_hora:
          lectura.fecha_hora,

        estado_lectura:
          lectura.estado_lectura,

        fuente_lectura:
          lectura.fuente_lectura,
      };
    }


    // ==================================================
    // ERROR DEL MODULO
    // ==================================================

    if (
      solicitud.estado ===
      ESTADO_SOLICITUD
        .ERROR
    ) {

      throw new ModuloMedicionesError(
        solicitud.mensaje ||
        "El módulo reportó un error durante la medición.",
        {
          codigo:
            "MODULO_REPORTO_ERROR",
        }
      );
    }


    // ==================================================
    // CANCELADO
    // ==================================================

    if (
      solicitud.estado ===
      ESTADO_SOLICITUD
        .CANCELADO
    ) {

      throw new ModuloMedicionesError(
        "La medición fue cancelada.",
        {
          codigo:
            "MEDICION_CANCELADA",

          estado:
            ESTADO_SOLICITUD
              .CANCELADO,
        }
      );
    }


    // ==================================================
    // TIMEOUT YA REGISTRADO
    // ==================================================

    if (
      solicitud.estado ===
      ESTADO_SOLICITUD
        .TIMEOUT
    ) {

      throw new ModuloMedicionesError(
        solicitud.mensaje ||
        "Se agotó el tiempo de medición.",
        {
          codigo:
            "MEDICION_TIMEOUT",

          estado:
            ESTADO_SOLICITUD
              .TIMEOUT,
        }
      );
    }


    /*
     * PENDIENTE
     * MIDIENDO
     * ESTABILIZANDO
     * MOVIMIENTO_DETECTADO
     *
     * todavía no son resultado final.
     */
    await esperar(
      INTERVALO_CONSULTA_MS
    );
  }


  // ====================================================
  // TIMEOUT LOCAL
  // ====================================================

  await marcarTimeout({
    solicitudId,
    db,
  });


  throw new ModuloMedicionesError(
    "Se agotó el tiempo para obtener el peso del módulo.",
    {
      codigo:
        "MEDICION_TIMEOUT",

      estado:
        ESTADO_SOLICITUD
          .TIMEOUT,
    }
  );
}


// ======================================================
// PESO ACTUAL DESDE MODULO
// ======================================================

async function obtenerPesoActual({
  procesoId,
  contenedorId,
  db = pool,
}) {

  const procesoIdNumero =
    toInt(
      procesoId
    );


  const contenedorIdNumero =
    toInt(
      contenedorId
    );


  if (!procesoIdNumero) {

    throw new ModuloMedicionesError(
      "El proceso de pesaje no es válido.",
      {
        codigo:
          "PROCESO_INVALIDO",
      }
    );
  }


  if (!contenedorIdNumero) {

    throw new ModuloMedicionesError(
      "El contenedor de pesaje no es válido.",
      {
        codigo:
          "CONTENEDOR_INVALIDO",
      }
    );
  }


  // ====================================================
  // 1. DETERMINAR MODULO
  // ====================================================

  const {
    moduloCodigo,
  } =
    await obtenerModuloPorContenedor({
      contenedorId:
        contenedorIdNumero,

      db,
    });


  // ====================================================
  // 2. CREAR SOLICITUD
  // ====================================================

  const solicitud =
    await obtenerOCrearSolicitud({

      procesoId:
        procesoIdNumero,

      contenedorId:
        contenedorIdNumero,

      moduloCodigo,

      db,
    });


  // ====================================================
  // 3. ESPERAR RESULTADO
  // ====================================================

  return esperarResultado({

    solicitudId:
      solicitud.id,

    contenedorId:
      contenedorIdNumero,

    db,
  });
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerPesoActual,
  ModuloMedicionesError,
};