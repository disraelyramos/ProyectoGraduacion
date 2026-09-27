// ======================================================
// CONFIGURACIÓN
// ======================================================

const CACHE_MAX_AGE_MS =
  Number(
    process.env
      .NIVEL_CACHE_MAX_AGE_MS
  ) > 0

    ? Number(
        process.env
          .NIVEL_CACHE_MAX_AGE_MS
      )

    : 15000;


// ======================================================
// CACHE EN MEMORIA
// ======================================================
//
// Estructura:
//
// contenedorId => {
//   porcentaje,
//   proveedor,
//   fechaActualizacion
// }
//
// NO es historial.
// Solo conserva el último nivel conocido.
// ======================================================

const nivelesCache =
  new Map();


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
// ACTUALIZAR NIVEL
// ======================================================

function actualizarNivel({
  contenedorId,
  porcentaje,
  proveedor,
  fechaActualizacion =
    new Date(),
}) {

  const contenedorIdNumero =
    toInt(
      contenedorId
    );


  const porcentajeNumero =
    toNumber(
      porcentaje
    );


  if (!contenedorIdNumero) {

    throw new Error(
      "El contenedor del nivel no es válido."
    );
  }


  if (
    porcentajeNumero === null ||
    porcentajeNumero < 0 ||
    porcentajeNumero > 100
  ) {

    throw new Error(
      "El porcentaje de llenado debe estar entre 0 y 100."
    );
  }


  const fecha =
    fechaActualizacion
      instanceof Date
        ? fechaActualizacion
        : new Date(
            fechaActualizacion
          );


  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {

    throw new Error(
      "La fecha de actualización del nivel no es válida."
    );
  }


  const registro = {

    contenedorId:
      contenedorIdNumero,

    porcentaje:
      porcentajeNumero,

    proveedor:
      String(
        proveedor ||
        ""
      ).trim() ||
      null,

    fechaActualizacion:
      fecha,
  };


  nivelesCache.set(
    contenedorIdNumero,
    registro
  );


  return {
    ...registro,
  };
}


// ======================================================
// OBTENER NIVEL
// ======================================================

function obtenerNivel(
  contenedorId
) {

  const contenedorIdNumero =
    toInt(
      contenedorId
    );


  if (!contenedorIdNumero) {

    return null;
  }


  const registro =
    nivelesCache.get(
      contenedorIdNumero
    );


  if (!registro) {

    return null;
  }


  const antiguedadMs =
    Date.now() -
    registro
      .fechaActualizacion
      .getTime();


  const vigente =
    antiguedadMs >= 0 &&
    antiguedadMs <=
      CACHE_MAX_AGE_MS;


  return {

    ...registro,

    vigente,

    antiguedadMs,
  };
}


// ======================================================
// OBTENER NIVEL VIGENTE
// ======================================================
//
// Devuelve null cuando:
//
// - no existe nivel;
// - el nivel está vencido.
// ======================================================

function obtenerNivelVigente(
  contenedorId
) {

  const registro =
    obtenerNivel(
      contenedorId
    );


  if (
    !registro ||
    !registro.vigente
  ) {

    return null;
  }


  return registro;
}


// ======================================================
// ELIMINAR NIVEL
// ======================================================

function eliminarNivel(
  contenedorId
) {

  const contenedorIdNumero =
    toInt(
      contenedorId
    );


  if (!contenedorIdNumero) {

    return false;
  }


  return nivelesCache.delete(
    contenedorIdNumero
  );
}


// ======================================================
// LIMPIAR CACHE
// ======================================================

function limpiarCache() {

  nivelesCache.clear();
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  actualizarNivel,

  obtenerNivel,

  obtenerNivelVigente,

  eliminarNivel,

  limpiarCache,
};