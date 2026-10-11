const pool = require(
  "../../../config/db"
);


// ======================================================
// CONFIGURACION
// ======================================================

const HISTORIAL_INTERVAL_MS =
  Number(
    process.env
      .NIVEL_HISTORIAL_INTERVAL_MS
  ) > 0

    ? Number(
        process.env
          .NIVEL_HISTORIAL_INTERVAL_MS
      )

    : 300000;


// ======================================================
// CACHE
// ======================================================
//
// contenedorId => {
//
//   contenedorId,
//   porcentaje,
//   proveedor,
//   fechaActualizacion
//
// }
//
// ======================================================

const nivelesCache =
  new Map();


// ======================================================
// CONTROL DE HISTORIAL
// ======================================================

const ultimoHistorialPorContenedor =
  new Map();


// ======================================================
// HELPERS
// ======================================================

function toInt(
  value
) {

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
// SABER SI CORRESPONDE HISTORIAL
// ======================================================

function debeGuardarHistorial(
  contenedorId
) {

  const ultimo =
    ultimoHistorialPorContenedor
      .get(
        contenedorId
      );


  if (!ultimo) {

    return true;
  }


  return (
    Date.now() -
      ultimo >=
    HISTORIAL_INTERVAL_MS
  );
}


// ======================================================
// GUARDAR HISTORIAL
// ======================================================

async function guardarHistorialNivel({
  contenedorId,
  porcentaje,
  db = pool,
}) {

  const contenedorIdNumero =
    toInt(
      contenedorId
    );


  const porcentajeNumero =
    toNumber(
      porcentaje
    );


  if (
    !contenedorIdNumero ||
    porcentajeNumero === null ||
    porcentajeNumero < 0 ||
    porcentajeNumero > 100
  ) {

    return null;
  }


  const { rows } =
    await db.query(
      `
        INSERT INTO lecturas (
          contenedor_id,
          tipo_lectura_id,
          unidad_id,
          valor,
          fuente_lectura,
          estado_lectura,
          fecha_hora
        )

        SELECT
          $1,
          tl.id,
          um.id,
          $2,
          $3,
          $4,
          NOW()

        FROM tipos_lectura tl

        CROSS JOIN unidad_medida um

        WHERE tl.nombre = $5
          AND um.nombre = $6

        RETURNING
          id,
          contenedor_id,
          valor,
          fuente_lectura,
          estado_lectura,
          fecha_hora
      `,
      [
        contenedorIdNumero,

        Number(
          porcentajeNumero
            .toFixed(2)
        ),

        "sensor",

        "normal",

        "nivel_porcentaje",

        "%",
      ]
    );


  if (
    rows.length === 0
  ) {

    throw new Error(
      "No fue posible guardar el historial del nivel."
    );
  }


  ultimoHistorialPorContenedor
    .set(
      contenedorIdNumero,
      Date.now()
    );


  return rows[0];
}


// ======================================================
// ACTUALIZAR NIVEL
// ======================================================

async function actualizarNivel({
  contenedorId,
  porcentaje,
  proveedor,
  fechaActualizacion =
    new Date(),
  db = pool,
}) {

  const contenedorIdNumero =
    toInt(
      contenedorId
    );


  const porcentajeNumero =
    toNumber(
      porcentaje
    );


  if (
    !contenedorIdNumero
  ) {

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
      )
        .trim() ||
      null,

    fechaActualizacion:
      fecha,

  };


  // ====================================================
  // CACHE
  // ====================================================

  nivelesCache.set(
    contenedorIdNumero,
    registro
  );


  // ====================================================
  // PRIMER HISTORIAL / HISTORIAL VENCIDO
  // ====================================================

  if (
    debeGuardarHistorial(
      contenedorIdNumero
    )
  ) {

    try {

      await guardarHistorialNivel({

        contenedorId:
          contenedorIdNumero,

        porcentaje:
          porcentajeNumero,

        db,

      });


    } catch (error) {

      console.error(

        "Error guardando historial de nivel:",

        error.message

      );
    }
  }


  return {
    ...registro,
  };
}


// ======================================================
// OBTENER NIVEL
// ======================================================
//
// Ya NO expira a los 15 segundos.
//
// El último nivel confirmado continúa siendo
// el nivel actual hasta recibir uno nuevo.
//
// ======================================================

function obtenerNivel(
  contenedorId
) {

  const contenedorIdNumero =
    toInt(
      contenedorId
    );


  if (
    !contenedorIdNumero
  ) {

    return null;
  }


  const registro =
    nivelesCache.get(
      contenedorIdNumero
    );


  if (
    !registro
  ) {

    return null;
  }


  const antiguedadMs =
    Date.now() -
    registro
      .fechaActualizacion
      .getTime();


  return {

    ...registro,

    vigente:
      true,

    antiguedadMs,

  };
}


// ======================================================
// OBTENER NIVEL VIGENTE
// ======================================================

function obtenerNivelVigente(
  contenedorId
) {

  return obtenerNivel(
    contenedorId
  );
}


// ======================================================
// GUARDAR HISTORIAL DESDE CACHE
// ======================================================
//
// Utilizado por NivelMonitor.
//
// El ESP NO necesita reenviar el mismo nivel.
//
// ======================================================

async function guardarHistorialCache() {

  for (
    const [
      contenedorId,
      registro,
    ]
    of nivelesCache.entries()
  ) {

    if (
      !debeGuardarHistorial(
        contenedorId
      )
    ) {

      continue;
    }


    try {

      await guardarHistorialNivel({

        contenedorId,

        porcentaje:
          registro.porcentaje,

      });


    } catch (error) {

      console.error(

        `Error guardando historial del nivel del contenedor ${contenedorId}:`,

        error.message

      );
    }
  }
}


// ======================================================
// RECUPERAR ULTIMOS NIVELES DE LA BD
// ======================================================
//
// Si Railway reinicia:
// - la memoria queda vacía;
// - recuperamos la última lectura
//   nivel_porcentaje existente.
//
// NO modifica la BD.
//
// ======================================================

async function cargarUltimosNivelesDesdeHistorial() {

  const { rows } =
    await pool.query(
      `
        SELECT DISTINCT ON (
          l.contenedor_id
        )

          l.contenedor_id,

          l.valor,

          l.fecha_hora

        FROM lecturas l

        JOIN tipos_lectura tl
          ON tl.id =
             l.tipo_lectura_id

        JOIN unidad_medida um
          ON um.id =
             l.unidad_id

        WHERE tl.nombre =
          'nivel_porcentaje'

          AND um.nombre =
          '%'

          AND l.estado_lectura =
          'normal'

        ORDER BY
          l.contenedor_id ASC,
          l.fecha_hora DESC,
          l.id DESC
      `
    );


  for (
    const fila
    of rows
  ) {

    const contenedorId =
      Number(
        fila.contenedor_id
      );


    const porcentaje =
      Number(
        fila.valor
      );


    if (
      !Number.isFinite(
        porcentaje
      )
    ) {

      continue;
    }


    nivelesCache.set(
      contenedorId,
      {

        contenedorId,

        porcentaje,

        proveedor:
          "historial",

        fechaActualizacion:
          new Date(
            fila.fecha_hora
          ),

      }
    );


    ultimoHistorialPorContenedor
      .set(
        contenedorId,
        new Date(
          fila.fecha_hora
        )
          .getTime()
      );
  }


  return rows.length;
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


  if (
    !contenedorIdNumero
  ) {

    return false;
  }


  ultimoHistorialPorContenedor
    .delete(
      contenedorIdNumero
    );


  return nivelesCache
    .delete(
      contenedorIdNumero
    );
}


// ======================================================
// LIMPIAR CACHE
// ======================================================

function limpiarCache() {

  nivelesCache.clear();

  ultimoHistorialPorContenedor
    .clear();
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

  guardarHistorialNivel,

  guardarHistorialCache,

  cargarUltimosNivelesDesdeHistorial,

};