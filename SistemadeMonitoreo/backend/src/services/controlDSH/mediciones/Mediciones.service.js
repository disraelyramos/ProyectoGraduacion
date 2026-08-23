// ======================================================
// PROVEEDORES DISPONIBLES
// ======================================================

function obtenerProveedor(nombre) {

  switch (nombre) {

    case "base_datos":

      return require(
        "./fuentes/BaseDatosMediciones.service"
      );


    case "modulo":

      return require(
        "./fuentes/ModuloMediciones.service"
      );


    default:

      throw new Error(
        `Proveedor de medición no válido: ${nombre}`
      );
  }
}


// ======================================================
// OBTENER CONFIGURACIÓN
// ======================================================

function obtenerNombreProveedor(
  variableEnv
) {

  const nombre =
    String(
      process.env[
        variableEnv
      ] || ""
    )
      .trim()
      .toLowerCase();


  if (!nombre) {

    throw new Error(
      `Falta configurar ${variableEnv} en el archivo .env`
    );
  }


  return nombre;
}


// ======================================================
// NIVEL
// ======================================================

async function obtenerNivelActual({
  contenedorId,
  db,
}) {

  const proveedorNombre =
    obtenerNombreProveedor(
      "MEDICION_NIVEL_PROVIDER"
    );


  const proveedor =
    obtenerProveedor(
      proveedorNombre
    );


  return proveedor
    .obtenerNivelActual({
      contenedorId,
      db,
    });
}


// ======================================================
// PESO
// ======================================================

async function obtenerPesoActual({
  contenedorId,
  db,
}) {

  const proveedorNombre =
    obtenerNombreProveedor(
      "MEDICION_PESO_PROVIDER"
    );


  const proveedor =
    obtenerProveedor(
      proveedorNombre
    );


  return proveedor
    .obtenerPesoActual({
      contenedorId,
      db,
    });
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  obtenerNivelActual,
  obtenerPesoActual,
};