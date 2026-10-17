const pool = require(
  "../../../config/db"
);


// ======================================================
// CONFIGURACION
// ======================================================

function obtenerEnteroPositivo(
  nombre,
  respaldo
) {

  const valor =
    Number(
      process.env[nombre]
    );


  return (
    Number.isSafeInteger(valor) &&
    valor > 0
  )
    ? valor
    : respaldo;
}


// ======================================================
// TIEMPO MAXIMO QUE UNA LECTURA PUEDE CONSIDERARSE ACTUAL
// ======================================================
//
// PRODUCCION:
//
// NIVEL_CACHE_MAX_AGE_MS=15000
//
// Si el ESP deja de enviar durante mas de este tiempo,
// el nivel actual pasa estrictamente a 0 %.
//
// ======================================================

const NIVEL_CACHE_MAX_AGE_MS =
  obtenerEnteroPositivo(
    "NIVEL_CACHE_MAX_AGE_MS",
    15000
  );


// ======================================================
// INTERVALO PARA HISTORIAL
// ======================================================

const HISTORIAL_INTERVAL_MS =
  obtenerEnteroPositivo(
    "NIVEL_HISTORIAL_INTERVAL_MS",
    300000
  );


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
// CALCULAR ANTIGUEDAD DE UNA LECTURA
// ======================================================

function calcularAntiguedadMs(
  registro
) {

  if (
    !registro ||
    !registro.fechaActualizacion
  ) {

    return Infinity;
  }


  const fecha =
    registro.fechaActualizacion
      instanceof Date

      ? registro.fechaActualizacion

      : new Date(
          registro.fechaActualizacion
        );


  const tiempo =
    fecha.getTime();


  if (
    Number.isNaN(
      tiempo
    )
  ) {

    return Infinity;
  }


  return Math.max(
    0,
    Date.now() - tiempo
  );
}


// ======================================================
// SABER SI UNA LECTURA SIGUE VIGENTE
// ======================================================

function esNivelVigente(
  registro
) {

  const antiguedadMs =
    calcularAntiguedadMs(
      registro
    );


  return (
    Number.isFinite(
      antiguedadMs
    ) &&
    antiguedadMs <=
      NIVEL_CACHE_MAX_AGE_MS
  );
}


// ======================================================
// CREAR RESPUESTA EN CERO
// ======================================================
//
// IMPORTANTE:
//
// 0 % aqui significa:
//
// "No existe una lectura reciente del modulo".
//
// De esta manera el frontend nunca conserva
// indefinidamente un valor antiguo.
//
// ======================================================

function crearNivelCero({
  contenedorId,
  registro = null,
}) {

  const antiguedadMs =
    registro
      ? calcularAntiguedadMs(
          registro
        )
      : null;


  return {

    contenedorId:
      Number(
        contenedorId
      ),

    porcentaje:
      0,

    proveedor:
      registro?.proveedor ||
      null,

    fechaActualizacion:
      registro
        ?.fechaActualizacion ||
      null,

    vigente:
      false,

    antiguedadMs,

  };
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
//
// Solamente una nueva lectura recibida desde
// el ESP renueva fechaActualizacion.
//
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
  // ACTUALIZAR CACHE
  // ====================================================

  nivelesCache.set(
    contenedorIdNumero,
    registro
  );


  // ====================================================
  // GUARDAR HISTORIAL SI CORRESPONDE
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

    vigente:
      true,

    antiguedadMs:
      0,

  };
}


// ======================================================
// OBTENER NIVEL
// ======================================================
//
// REGLA ESTRICTA:
//
// SIN REGISTRO
//      => 0 %
//
// <= NIVEL_CACHE_MAX_AGE_MS
//      => porcentaje real
//
// > NIVEL_CACHE_MAX_AGE_MS
//      => 0 %
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


  // ====================================================
  // NUNCA HA RECIBIDO LECTURA
  // ====================================================

  if (
    !registro
  ) {

    return crearNivelCero({

      contenedorId:
        contenedorIdNumero,

    });
  }


  const antiguedadMs =
    calcularAntiguedadMs(
      registro
    );


  // ====================================================
  // LECTURA VENCIDA
  // ====================================================

  if (
    !esNivelVigente(
      registro
    )
  ) {

    return crearNivelCero({

      contenedorId:
        contenedorIdNumero,

      registro,

    });
  }


  // ====================================================
  // LECTURA VIGENTE
  // ====================================================

  return {

    ...registro,

    porcentaje:
      Number(
        Number(
          registro.porcentaje
        ).toFixed(2)
      ),

    vigente:
      true,

    antiguedadMs,

  };
}


// ======================================================
// OBTENER NIVEL VIGENTE
// ======================================================
//
// IMPORTANTE:
//
// Aunque la lectura haya vencido,
// se devuelve un objeto con porcentaje 0.
//
// Esto evita que otro servicio:
// - recupere el ultimo valor viejo;
// - vuelva a mostrarlo;
// - mantenga un 82 %, 73 %, etc.
//
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
// MUY IMPORTANTE:
//
// Solo se guarda historial si la lectura
// SIGUE VIGENTE.
//
// Si el ESP se desconecto y pasan mas de
// NIVEL_CACHE_MAX_AGE_MS:
//
// - no vuelve a guardar el porcentaje viejo;
// - no fabrica lecturas;
// - no renueva fecha;
// - no mantiene vivo el valor.
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

    // ==================================================
    // NO GUARDAR LECTURAS VENCIDAS
    // ==================================================

    if (
      !esNivelVigente(
        registro
      )
    ) {

      continue;
    }


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
// Railway puede reiniciar y perder la memoria.
//
// Recuperamos la ultima lectura historica,
// PERO NO se considera vigente automaticamente.
//
// obtenerNivel() verificara su fecha.
//
// Si tiene mas de NIVEL_CACHE_MAX_AGE_MS,
// inmediatamente se devolvera 0 %.
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


    const fechaActualizacion =
      new Date(
        fila.fecha_hora
      );


    if (
      !Number.isFinite(
        porcentaje
      ) ||

      porcentaje < 0 ||

      porcentaje > 100 ||

      Number.isNaN(
        fechaActualizacion
          .getTime()
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

        fechaActualizacion,

      }
    );


    ultimoHistorialPorContenedor
      .set(
        contenedorId,
        fechaActualizacion
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