const pool = require(
  "../../../config/db"
);

const medicionesService = require(
  "./Mediciones.service"
);

const nivelCache = require(
  "./NivelActualCache.service"
);

const nivelAlertasService = require(
  "../alertas/NivelAlertas.service"
);


// ======================================================
// CONFIGURACIÓN
// ======================================================

const INTERVALO_MONITOR_MS =
  Number(
    process.env
      .NIVEL_MONITOR_INTERVAL_MS
  ) > 0

    ? Number(
        process.env
          .NIVEL_MONITOR_INTERVAL_MS
      )

    : 5000;


const TIPOS_DSH = [
  1,
  2,
];


// ======================================================
// ESTADO INTERNO DEL MONITOR
// ======================================================

let timerMonitor =
  null;

let ejecucionEnCurso =
  false;


// ======================================================
// OBTENER PROVEEDOR CONFIGURADO
// ======================================================

function obtenerProveedorConfigurado() {

  return String(
    process.env
      .MEDICION_NIVEL_PROVIDER ||
    ""
  )
    .trim()
    .toLowerCase();
}


// ======================================================
// OBTENER CONTENEDORES DSH
// ======================================================

async function obtenerContenedoresDSH() {

  const { rows } =
    await pool.query(
      `
        SELECT
          id_contenedor,
          id_tipo_residuo

        FROM contenedores

        WHERE id_tipo_residuo =
          ANY($1::int[])

        ORDER BY
          id_contenedor ASC
      `,
      [
        TIPOS_DSH,
      ]
    );


  return rows;
}


// ======================================================
// REFRESCAR NIVEL DE UN CONTENEDOR
// ======================================================
//
// Flujo:
//
// proveedor
//    ↓
// validar nivel
//    ↓
// actualizar cache
//    ↓
// evaluar alertas
//
// IMPORTANTE:
//
// Las alertas NO dependen del frontend.
// ======================================================

async function refrescarNivelContenedor(
  contenedorId
) {

  const medicion =
    await medicionesService
      .obtenerNivelActual({
        contenedorId,
      });


  if (!medicion) {

    return null;
  }


  const porcentaje =
    Number(
      medicion.valor
    );


  if (
    !Number.isFinite(
      porcentaje
    ) ||
    porcentaje < 0 ||
    porcentaje > 100
  ) {

    return null;
  }


  // ====================================================
  // 1. ACTUALIZAR CACHE
  // ====================================================
  //
  // Se actualiza aunque el porcentaje
  // sea exactamente igual al anterior.
  //
  // Esto permite saber que la fuente
  // continúa enviando información.
  // ====================================================

  const nivelActualizado =
    nivelCache
      .actualizarNivel({

        contenedorId,

        porcentaje,

        proveedor:
          medicion.proveedor,

        fechaActualizacion:
          new Date(),
      });


  // ====================================================
  // 2. EVALUAR ALERTAS
  // ====================================================
  //
  // NivelAlertas.service controla:
  //
  // - primer aviso una sola vez;
  // - segundo aviso una sola vez;
  // - prioridad del segundo umbral;
  // - estado independiente por contenedor.
  // ====================================================

  const resultadoAlerta =
    await nivelAlertasService
      .evaluarNivel({

        contenedorId,

        porcentaje,
      });


  /*
   * No imprimimos cada ciclo normal.
   *
   * Solo dejamos registro en consola
   * cuando realmente se creó una alerta.
   */
  if (
    resultadoAlerta
      ?.alerta
      ?.id
  ) {

    console.log(
      `Alerta de nivel creada: ${resultadoAlerta.alerta.tipo} | contenedor ${contenedorId} | ${porcentaje}%`
    );
  }


  return {

    nivel:
      nivelActualizado,

    alerta:
      resultadoAlerta,
  };
}


// ======================================================
// EJECUTAR CICLO DEL MONITOR
// ======================================================

async function ejecutarCiclo() {

  /*
   * Evita que una ejecución se monte
   * sobre la siguiente.
   */
  if (ejecucionEnCurso) {

    return;
  }


  ejecucionEnCurso =
    true;


  try {

    const contenedores =
      await obtenerContenedoresDSH();


    for (
      const contenedor
      of contenedores
    ) {

      try {

        await refrescarNivelContenedor(
          contenedor
            .id_contenedor
        );


      } catch (error) {

        /*
         * Si falla un contenedor,
         * el otro continúa siendo evaluado.
         */
        console.error(
          `Error procesando nivel del contenedor ${contenedor.id_contenedor}:`,
          error.message
        );
      }
    }


  } catch (error) {

    console.error(
      "Error ejecutando monitor de niveles:",
      error.message
    );


  } finally {

    ejecucionEnCurso =
      false;
  }
}


// ======================================================
// INICIAR MONITOR
// ======================================================

async function iniciarMonitor() {

  if (timerMonitor) {

    return;
  }


  const proveedor =
    obtenerProveedorConfigurado();


  if (!proveedor) {

    throw new Error(
      "Falta configurar MEDICION_NIVEL_PROVIDER."
    );
  }


  // ====================================================
  // DESARROLLO
  // ====================================================

  if (
    proveedor ===
    "base_datos"
  ) {

    /*
     * Primera ejecución inmediata.
     */
    await ejecutarCiclo();


    timerMonitor =
      setInterval(
        () => {

          ejecutarCiclo()
            .catch(
              (error) => {

                console.error(
                  "Error inesperado en monitor de niveles:",
                  error.message
                );
              }
            );

        },

        INTERVALO_MONITOR_MS
      );


    return;
  }


  // ====================================================
  // PRODUCCIÓN
  // ====================================================
  //
  // Cuando MEDICION_NIVEL_PROVIDER=modulo:
  //
  // NO hacemos polling desde Railway hacia el ESP8266.
  //
  // El ESP8266 enviará el nivel al backend.
  //
  // En ese endpoint de recepción utilizaremos:
  //
  // NivelActualCache.service
  // NivelAlertas.service
  //
  // exactamente igual que aquí.
  // ====================================================

  if (
    proveedor ===
    "modulo"
  ) {

    return;
  }


  throw new Error(
    `Proveedor de nivel no válido: ${proveedor}`
  );
}


// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitor() {

  if (!timerMonitor) {

    return;
  }


  clearInterval(
    timerMonitor
  );


  timerMonitor =
    null;
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  iniciarMonitor,

  detenerMonitor,

  ejecutarCiclo,
};