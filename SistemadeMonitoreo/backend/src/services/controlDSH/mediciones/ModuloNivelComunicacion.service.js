const pool = require(
  "../../../config/db"
);

const nivelCache = require(
  "./NivelActualCache.service"
);

const nivelAlertasService = require(
  "../alertas/NivelAlertas.service"
);


// ======================================================
// ERROR CONTROLADO
// ======================================================

class ModuloNivelError extends Error {

  constructor(
    statusCode,
    message,
    codigo
  ) {

    super(message);

    this.name =
      "ModuloNivelError";

    this.statusCode =
      statusCode;

    this.codigo =
      codigo;
  }
}


// ======================================================
// HELPERS
// ======================================================

function toNumber(
  value
) {

  const numero =
    Number(value);


  return Number.isFinite(
    numero
  )
    ? numero
    : null;
}


// ======================================================
// VALIDAR PROVEEDOR
// ======================================================
//
// Esta ruta solamente debe recibir datos
// cuando el nivel proviene del ESP8266.
//
// ======================================================

function validarProveedorNivel() {

  const proveedor =
    String(
      process.env
        .MEDICION_NIVEL_PROVIDER ||
      ""
    )
      .trim()
      .toLowerCase();


  if (
    proveedor !==
    "modulo"
  ) {

    throw new ModuloNivelError(
      409,
      "El proveedor de nivel no está configurado como módulo.",
      "PROVEEDOR_NIVEL_INVALIDO"
    );
  }
}


// ======================================================
// DETERMINAR TIPO DE RESIDUO POR MODULO
// ======================================================
//
// Se reutilizan los mismos códigos que ya
// utiliza el módulo de peso.
//
// Un mismo ESP puede:
// - medir peso;
// - medir nivel.
//
// ======================================================

function obtenerTipoResiduoPorModulo(
  moduloCodigo
) {

  const codigo =
    String(
      moduloCodigo ||
      ""
    )
      .trim()
      .toUpperCase();


  const MODULOS = {

    PESO_BIOINFECCIOSO: 1,

    PESO_PUNZOCORTANTE: 2,

  };


  return (
    MODULOS[codigo] ||
    null
  );
}


// ======================================================
// OBTENER CONTENEDOR DEL MODULO
// ======================================================
//
// El ESP NO decide el contenedor.
//
// El backend determina el contenedor
// utilizando el código autenticado
// del módulo.
//
// ======================================================

async function obtenerContenedorPorModulo({
  moduloCodigo,
  db = pool,
}) {

  const tipoResiduoId =
    obtenerTipoResiduoPorModulo(
      moduloCodigo
    );


  if (!tipoResiduoId) {

    throw new ModuloNivelError(
      403,
      "El módulo no está autorizado para registrar niveles.",
      "MODULO_NIVEL_NO_AUTORIZADO"
    );
  }


  const { rows } =
    await db.query(
      `
        SELECT
          id_contenedor,
          id_tipo_residuo,
          codigo

        FROM contenedores

        WHERE id_tipo_residuo = $1

        ORDER BY
          id_contenedor ASC

        LIMIT 1
      `,
      [
        tipoResiduoId,
      ]
    );


  if (
    rows.length === 0
  ) {

    throw new ModuloNivelError(
      404,
      "No existe un contenedor configurado para este módulo.",
      "CONTENEDOR_NO_ENCONTRADO"
    );
  }


  return {

    id_contenedor:
      Number(
        rows[0]
          .id_contenedor
      ),

    id_tipo_residuo:
      Number(
        rows[0]
          .id_tipo_residuo
      ),

    codigo:
      rows[0]
        .codigo,

  };
}


// ======================================================
// REGISTRAR NIVEL
// ======================================================
//
// FLUJO:
//
// ESP8266
//   ↓
// autenticación del módulo
//   ↓
// validar porcentaje
//   ↓
// determinar contenedor
//   ↓
// actualizar caché
//   ↓
// guardar historial cuando corresponda
//   ↓
// evaluar alertas
//
// IMPORTANTE:
//
// NivelActualCache.service controla:
//
// NIVEL_HISTORIAL_INTERVAL_MS
//
// Por lo tanto NO se genera un INSERT
// en lecturas con cada POST del ESP.
//
// ======================================================

async function registrarNivel({
  moduloCodigo,
  porcentaje,
}) {

  // ====================================================
  // 1. VALIDAR PROVEEDOR
  // ====================================================

  validarProveedorNivel();


  // ====================================================
  // 2. VALIDAR MODULO
  // ====================================================

  const codigoModulo =
    String(
      moduloCodigo ||
      ""
    )
      .trim()
      .toUpperCase();


  if (
    !codigoModulo
  ) {

    throw new ModuloNivelError(
      401,
      "No fue posible identificar el módulo.",
      "MODULO_NO_IDENTIFICADO"
    );
  }


  // ====================================================
  // 3. VALIDAR PORCENTAJE
  // ====================================================

  const porcentajeNumero =
    toNumber(
      porcentaje
    );


  if (
    porcentajeNumero === null ||
    porcentajeNumero < 0 ||
    porcentajeNumero > 100
  ) {

    throw new ModuloNivelError(
      400,
      "El porcentaje de llenado debe estar entre 0 y 100.",
      "NIVEL_INVALIDO"
    );
  }


  // ====================================================
  // 4. DETERMINAR CONTENEDOR
  // ====================================================

  const contenedor =
    await obtenerContenedorPorModulo({

      moduloCodigo:
        codigoModulo,

    });


  // ====================================================
  // 5. ACTUALIZAR CACHE + HISTORIAL
  // ====================================================
  //
  // actualizarNivel():
  //
  // - refresca el dato en memoria;
  // - mantiene vigente el frontend;
  // - cada cierto intervalo guarda
  //   nivel_porcentaje en lecturas.
  //
  // ====================================================

  const nivel =
    await nivelCache
      .actualizarNivel({

        contenedorId:
          contenedor
            .id_contenedor,

        porcentaje:
          porcentajeNumero,

        proveedor:
          "modulo",

        fechaActualizacion:
          new Date(),

      });


  // ====================================================
  // 6. EVALUAR ALERTAS
  // ====================================================

  const resultadoAlerta =
    await nivelAlertasService
      .evaluarNivel({

        contenedorId:
          contenedor
            .id_contenedor,

        porcentaje:
          porcentajeNumero,

      });


  // ====================================================
  // LOG SOLO CUANDO SE CREA ALERTA
  // ====================================================

  if (
    resultadoAlerta
      ?.alerta
      ?.id
  ) {

    console.log(
      `Alerta de nivel creada: ${resultadoAlerta.alerta.tipo} | contenedor ${contenedor.id_contenedor} | ${porcentajeNumero}%`
    );
  }


  // ====================================================
  // RESPUESTA AL ESP8266
  // ====================================================

  return {

    message:
      "Nivel recibido correctamente.",

    contenedor_id:
      contenedor
        .id_contenedor,

    id_tipo_residuo:
      contenedor
        .id_tipo_residuo,

    porcentaje:
      Number(
        porcentajeNumero
          .toFixed(2)
      ),

    proveedor:
      "modulo",

    actualizado_en:
      nivel
        .fechaActualizacion,

  };
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  registrarNivel,

  obtenerContenedorPorModulo,

  ModuloNivelError,

};