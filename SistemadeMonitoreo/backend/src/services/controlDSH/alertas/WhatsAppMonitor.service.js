const {
  procesarEnviosPendientes,
} = require(
  "./ProcesadorEnvios.service"
);


// ======================================================
// ESTADO DEL MONITOR
// ======================================================

let intervalo = null;

let ejecutando = false;


// ======================================================
// LEER BOOLEANO
// ======================================================

function obtenerBooleano(
  nombre,
  valorDefecto = false
) {

  const valor =
    process.env[nombre];


  if (
    valor === undefined ||
    valor === null ||
    valor === ""
  ) {

    return valorDefecto;
  }


  return String(
    valor
  )
    .trim()
    .toLowerCase() ===
    "true";
}


// ======================================================
// INTERVALO DEL MONITOR
// ======================================================

function obtenerIntervaloMs() {

  const valor =
    Number(
      process.env
        .WHATSAPP_MONITOR_INTERVAL_MS
    );


  if (
    Number.isSafeInteger(
      valor
    ) &&
    valor >= 1000 &&
    valor <= 3600000
  ) {

    return valor;
  }


  return 5000;
}


// ======================================================
// LÍMITE POR CICLO
// ======================================================

function obtenerLimite() {

  const valor =
    Number(
      process.env
        .WHATSAPP_MONITOR_LIMIT
    );


  if (
    Number.isSafeInteger(
      valor
    ) &&
    valor >= 1 &&
    valor <= 100
  ) {

    return valor;
  }


  return 20;
}


// ======================================================
// EJECUTAR CICLO
// ======================================================
//
// ejecutando evita superponer dos ciclos.
//
// Ejemplo:
//
// ciclo anterior todavía enviando a Meta
//          ↓
// llega siguiente intervalo
//          ↓
// se omite hasta terminar el anterior
// ======================================================

async function ejecutarCiclo() {

  if (
    ejecutando
  ) {

    return {
      accion:
        "CICLO_ANTERIOR_EN_PROCESO",
    };
  }


  ejecutando =
    true;


  try {

    const resultado =
      await procesarEnviosPendientes({
        limite:
          obtenerLimite(),
      });


    if (
      resultado
        .totalPendientes > 0
    ) {

      console.log(
        `WhatsApp: ${resultado.totalProcesados} envío(s) procesado(s).`
      );
    }


    return resultado;


  } catch (
    error
  ) {

    console.error(
      "Error en monitor de WhatsApp:",
      error.message
    );


    return {
      accion:
        "ERROR_MONITOR_WHATSAPP",

      error:
        error.message,
    };


  } finally {

    ejecutando =
      false;
  }
}


// ======================================================
// INICIAR MONITOR
// ======================================================

async function iniciarMonitor() {

  // ====================================================
  // CONTROL POR .ENV
  // ====================================================

  const habilitado =
    obtenerBooleano(
      "WHATSAPP_MONITOR_ENABLED",
      false
    );


  if (
    !habilitado
  ) {

    console.log(
      "Monitor de WhatsApp deshabilitado por configuración."
    );


    return {
      iniciado:
        false,

      motivo:
        "MONITOR_DESHABILITADO",
    };
  }


  // ====================================================
  // EVITAR DUPLICAR MONITOR
  // ====================================================

  if (
    intervalo
  ) {

    return {
      iniciado:
        false,

      motivo:
        "MONITOR_YA_INICIADO",
    };
  }


  const intervaloMs =
    obtenerIntervaloMs();


  console.log(
    `Monitor de WhatsApp activo cada ${intervaloMs} ms.`
  );


  // Primer ciclo al iniciar.
  await ejecutarCiclo();


  intervalo =
    setInterval(
      () => {

        ejecutarCiclo()
          .catch(
            (error) => {

              console.error(
                "Error inesperado en monitor WhatsApp:",
                error.message
              );
            }
          );

      },
      intervaloMs
    );


  return {
    iniciado:
      true,

    intervaloMs,

    limite:
      obtenerLimite(),
  };
}


// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitor() {

  if (
    intervalo
  ) {

    clearInterval(
      intervalo
    );


    intervalo =
      null;
  }


  ejecutando =
    false;


  return {
    detenido:
      true,
  };
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  iniciarMonitor,

  detenerMonitor,

  ejecutarCiclo,
};