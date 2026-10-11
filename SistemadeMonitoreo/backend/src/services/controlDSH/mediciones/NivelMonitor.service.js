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
// CONFIGURACION
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
// FLUJO:
//
// proveedor
//    ↓
// validar nivel
//    ↓
// actualizar cache
//    ↓
// guardar historial cuando corresponda
//    ↓
// evaluar alertas
//
// IMPORTANTE:
//
// - Las alertas NO dependen del frontend.
// - El historial NO se guarda en cada ciclo.
// - NivelActualCache.service controla
//   NIVEL_HISTORIAL_INTERVAL_MS.
// ======================================================

async function refrescarNivelContenedor(
  contenedorId
) {

  // ====================================================
  // 1. OBTENER MEDICION
  // ====================================================

  const medicion =
    await medicionesService
      .obtenerNivelActual({
        contenedorId,
      });


  if (!medicion) {

    return null;
  }


  // ====================================================
  // 2. VALIDAR PORCENTAJE
  // ====================================================

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
  // 3. ACTUALIZAR CACHE + HISTORIAL
  // ====================================================
  //
  // actualizarNivel():
  //
  // - actualiza el cache inmediatamente;
  // - conserva el ultimo nivel vigente;
  // - guarda historial en lecturas
  //   cuando ya paso el intervalo configurado;
  //
  // tipo_lectura:
  // nivel_porcentaje
  //
  // unidad:
  // %
  //
  // fuente:
  // sensor
  //
  // estado:
  // normal
  //
  // ====================================================

  const nivelActualizado =
    await nivelCache
      .actualizarNivel({

        contenedorId,

        porcentaje,

        proveedor:
          medicion.proveedor,

        fechaActualizacion:
          new Date(),

      });


  // ====================================================
  // 4. EVALUAR ALERTAS
  // ====================================================
  //
  // NivelAlertas.service controla:
  //
  // - primer aviso;
  // - segundo aviso;
  // - evitar duplicados;
  // - prioridad del nivel alto;
  // - estado independiente
  //   por contenedor.
  //
  // ====================================================

  const resultadoAlerta =
    await nivelAlertasService
      .evaluarNivel({

        contenedorId,

        porcentaje,

      });


  // ====================================================
  // 5. LOG SOLO SI SE CREO UNA ALERTA
  // ====================================================

  if (
    resultadoAlerta
      ?.alerta
      ?.id
  ) {

    console.log(
      `Alerta de nivel creada: ${resultadoAlerta.alerta.tipo} | contenedor ${contenedorId} | ${porcentaje}%`
    );
  }


  // ====================================================
  // RESPUESTA INTERNA
  // ====================================================

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

  // Evita que una ejecucion
  // se monte sobre la siguiente.

  if (
    ejecucionEnCurso
  ) {

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

        // Si falla un contenedor,
        // el otro sigue funcionando.

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

  if (
    timerMonitor
  ) {

    return;
  }


  const proveedor =
    obtenerProveedorConfigurado();


  if (
    !proveedor
  ) {

    throw new Error(
      "Falta configurar MEDICION_NIVEL_PROVIDER."
    );
  }


  // ====================================================
  // PROVEEDOR BASE DE DATOS
  // ====================================================
  //
  // Utilizado principalmente para desarrollo.
  //
  // El backend consulta el proveedor
  // cada cierto intervalo.
  //
  // ====================================================

  if (
    proveedor ===
    "base_datos"
  ) {

    // Primera ejecucion inmediata.

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
  // PROVEEDOR MODULO
  // ====================================================
  //
  // PRODUCCION:
  //
  // MEDICION_NIVEL_PROVIDER=modulo
  //
  // NO hacemos polling desde Railway
  // hacia el ESP8266.
  //
  // El ESP8266 debe enviar el nivel
  // hacia un endpoint del backend.
  //
  // Ese endpoint debe ejecutar:
  //
  // await nivelCache.actualizarNivel(...)
  //
  // y luego:
  //
  // await nivelAlertasService.evaluarNivel(...)
  //
  // De esa forma:
  //
  // ESP8266
  //   ↓
  // endpoint backend
  //   ↓
  // cache
  //   ↓
  // historial
  //   ↓
  // alertas
  //
  // ====================================================

  if (
    proveedor ===
    "modulo"
  ) {

    console.log(
      "Monitor de nivel: proveedor modulo activo. Esperando lecturas enviadas por el ESP8266."
    );


    return;
  }


  // ====================================================
  // PROVEEDOR INVALIDO
  // ====================================================

  throw new Error(
    `Proveedor de nivel no válido: ${proveedor}`
  );
}


// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitor() {

  if (
    !timerMonitor
  ) {

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