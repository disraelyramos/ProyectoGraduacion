const pool = require(
  "../../../config/db"
);

const AlertaEnviosService = require(
  "./AlertaEnvios.service"
);


// ======================================================
// CONSTANTES
// ======================================================

const TIPOS_PERMITIDOS = [
  "NIVEL_AVISO",
  "NIVEL_ALTO",
  "PROGRAMADA",
];


const CANAL_WHATSAPP =
  "WHATSAPP";

const CANAL_EMAIL =
  "EMAIL";

const ESTADO_ALERTA_ACTIVA =
  "ACTIVA";

const ESTADO_ENVIO_ACEPTADO =
  "ACEPTADO";


// Aviso inicial:
//
// secuencia 1
//
// Recordatorios:
//
// secuencia 2 = recordatorio 1
// secuencia 3 = recordatorio 2
// secuencia 4 = recordatorio 3

const MAX_SECUENCIA_NOTIFICACION =
  4;

const MAX_RECORDATORIOS =
  3;


// ======================================================
// CONFIGURACIÓN
// ======================================================

function obtenerIntervaloRecordatorioMin() {

  const valor =
    Number(
      process.env
        .WHATSAPP_RECORDATORIO_INTERVAL_MIN
    );


  if (
    Number.isSafeInteger(
      valor
    ) &&
    valor >= 1 &&
    valor <= 1440
  ) {

    return valor;
  }


  return 5;
}


function obtenerIntervaloMonitorMs() {

  const valor =
    Number(
      process.env
        .WHATSAPP_RECORDATORIOS_MONITOR_INTERVAL_MS
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


function obtenerLimitePorCiclo() {

  const valor =
    Number(
      process.env
        .WHATSAPP_RECORDATORIOS_LIMIT
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
// ESTADO INTERNO
// ======================================================

let timerMonitor =
  null;

let ejecucionEnCurso =
  false;


// ======================================================
// LEER CONTENIDO ESTRUCTURADO
// ======================================================
//
// AlertaEnvios.service guarda:
//
// {
//   version: 1,
//   mensaje: "...",
//   parametros: [...]
// }
// ======================================================

function leerContenidoEstructurado(
  contenidoEnviado
) {

  const contenido =
    String(
      contenidoEnviado ??
      ""
    ).trim();


  if (!contenido) {

    throw new Error(
      "El envío inicial no contiene información."
    );
  }


  let datos;


  try {

    datos =
      JSON.parse(
        contenido
      );

  } catch (
    error
  ) {

    throw new Error(
      "El contenido del envío inicial no tiene formato estructurado."
    );
  }


  if (
    !datos ||
    typeof datos !==
      "object" ||
    Array.isArray(
      datos
    )
  ) {

    throw new Error(
      "El contenido estructurado del envío inicial es inválido."
    );
  }


  if (
    Number(
      datos.version
    ) !== 1
  ) {

    throw new Error(
      "La versión del envío inicial no es compatible."
    );
  }


  if (
    !Array.isArray(
      datos.parametros
    ) ||
    datos.parametros.length ===
      0
  ) {

    throw new Error(
      "El envío inicial no contiene parámetros de plantilla."
    );
  }


  const parametros =
    datos.parametros.map(
      (
        parametro,
        index
      ) => {

        const texto =
          String(
            parametro ??
            ""
          ).trim();


        if (!texto) {

          throw new Error(
            `El parámetro ${
              index + 1
            } del envío inicial está vacío.`
          );
        }


        return texto;
      }
    );


  return {
    mensaje:
      String(
        datos.mensaje ??
        ""
      ).trim(),

    parametros,
  };
}


// ======================================================
// OBTENER ENVÍO BASE
// ======================================================
//
// Siempre utilizamos la plantilla y los parámetros
// del AVISO INICIAL.
//
// De esta forma:
//
// NIVEL -> alerta_nivel_contenedor
// PROGRAMADA -> recordatorio_programado
//
// No inventamos plantillas.
// ======================================================

async function obtenerEnvioBase(
  client,
  alertaId
) {

  const { rows } =
    await client.query(
      `
        SELECT
          id,
          alerta_id,
          secuencia_notificacion,
          canal,

          plantilla_meta,
          contenido_enviado

        FROM alertas_envios

        WHERE alerta_id = $1

          AND secuencia_notificacion = 1

          AND canal = $2

          AND plantilla_meta
            IS NOT NULL

          AND TRIM(
            plantilla_meta
          ) <> ''

          AND contenido_enviado
            IS NOT NULL

          AND TRIM(
            contenido_enviado
          ) <> ''

        ORDER BY
          id ASC

        LIMIT 1
      `,
      [
        alertaId,
        CANAL_WHATSAPP,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// BUSCAR SIGUIENTE ALERTA QUE REQUIERE RECORDATORIO
// ======================================================
//
// Solo:
//
// NIVEL_AVISO
// NIVEL_ALTO
// PROGRAMADA
//
// NO PREDICTIVA.
//
// Una nueva secuencia solamente puede crearse cuando
// la secuencia anterior fue completada.
//
// Se considera completada cuando:
//
// WhatsApp fue ACEPTADO
//
// O:
//
// WhatsApp falló 3 veces y el EMAIL de respaldo
// fue ACEPTADO.
//
// Esto evita crear recordatorios mientras todavía
// se están ejecutando los reintentos técnicos.
// ======================================================

async function obtenerSiguienteAlerta(
  client
) {

  const intervaloMin =
    obtenerIntervaloRecordatorioMin();


  const { rows } =
    await client.query(
      `
        WITH ultima_secuencia AS
        (
          SELECT
            ae.alerta_id,

            MAX(
              ae.secuencia_notificacion
            )::integer
              AS ultima_secuencia

          FROM alertas_envios ae

          WHERE ae.canal = $1

          GROUP BY
            ae.alerta_id
        )

        SELECT
          a.id,
          a.tipo,
          a.contenedor_id,
          a.motivo,
          a.mensaje,
          a.estado,
          a.fecha_creacion,
          a.fecha_activacion,

          us.ultima_secuencia,

          completada.fecha_completada

        FROM alertas a

        JOIN ultima_secuencia us
          ON us.alerta_id =
             a.id

        JOIN LATERAL
        (
          SELECT
            MAX(
              ae2.fecha_intento
            ) AS fecha_completada

          FROM alertas_envios ae2

          WHERE ae2.alerta_id =
                a.id

            AND ae2.secuencia_notificacion =
                us.ultima_secuencia

            AND ae2.estado =
                $2

            AND ae2.canal IN
            (
              $1,
              $3
            )
        )
          AS completada
          ON TRUE

        WHERE a.estado = $4

          AND a.tipo =
              ANY(
                $5::text[]
              )

          AND us.ultima_secuencia
              >= 1

          AND us.ultima_secuencia
              < $6

          AND completada.fecha_completada
              IS NOT NULL

          AND completada.fecha_completada
              + (
                  $7::integer *
                  INTERVAL '1 minute'
                )
              <= CURRENT_TIMESTAMP


          -- ============================================
          -- SI YA EXISTE NIVEL_ALTO,
          -- NO SEGUIR RECORDANDO NIVEL_AVISO
          -- ============================================

          AND NOT
          (
            a.tipo =
              'NIVEL_AVISO'

            AND EXISTS
            (
              SELECT
                1

              FROM alertas alta

              WHERE alta.tipo =
                    'NIVEL_ALTO'

                AND alta.contenedor_id =
                    a.contenedor_id

                AND alta.estado =
                    'ACTIVA'

                AND alta.fecha_creacion
                    >= a.fecha_creacion
            )
          )


          -- ============================================
          -- SOLO REGISTROS NUEVOS CON PLANTILLA META
          -- ============================================

          AND EXISTS
          (
            SELECT
              1

            FROM alertas_envios inicial

            WHERE inicial.alerta_id =
                  a.id

              AND inicial.secuencia_notificacion =
                  1

              AND inicial.canal =
                  $1

              AND inicial.plantilla_meta
                  IS NOT NULL

              AND TRIM(
                inicial.plantilla_meta
              ) <> ''
          )

        ORDER BY
          completada.fecha_completada ASC,
          a.id ASC

        LIMIT 1

        FOR UPDATE OF a
        SKIP LOCKED
      `,
      [
        CANAL_WHATSAPP,

        ESTADO_ENVIO_ACEPTADO,

        CANAL_EMAIL,

        ESTADO_ALERTA_ACTIVA,

        TIPOS_PERMITIDOS,

        MAX_SECUENCIA_NOTIFICACION,

        intervaloMin,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// CREAR SIGUIENTE RECORDATORIO
// ======================================================

async function crearSiguienteRecordatorio() {

  const client =
    await pool.connect();


  let transaccionActiva =
    false;


  try {

    await client.query(
      "BEGIN"
    );


    transaccionActiva =
      true;


    // ==================================================
    // 1. BUSCAR ALERTA
    // ==================================================

    const alerta =
      await obtenerSiguienteAlerta(
        client
      );


    if (!alerta) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "SIN_RECORDATORIOS_PENDIENTES",
      };
    }


    // ==================================================
    // 2. DETERMINAR SIGUIENTE SECUENCIA
    // ==================================================

    const ultimaSecuencia =
      Number(
        alerta
          .ultima_secuencia
      );


    if (
      !Number.isSafeInteger(
        ultimaSecuencia
      ) ||
      ultimaSecuencia < 1 ||
      ultimaSecuencia >=
        MAX_SECUENCIA_NOTIFICACION
    ) {

      throw new Error(
        "La secuencia actual de la alerta no es válida."
      );
    }


    const siguienteSecuencia =
      ultimaSecuencia + 1;


    // ==================================================
    // 3. OBTENER PLANTILLA ORIGINAL
    // ==================================================

    const envioBase =
      await obtenerEnvioBase(
        client,
        alerta.id
      );


    if (!envioBase) {

      throw new Error(
        "No existe un envío inicial válido para generar el recordatorio."
      );
    }


    const plantilla =
      String(
        envioBase
          .plantilla_meta ??
        ""
      ).trim();


    if (!plantilla) {

      throw new Error(
        "El envío inicial no contiene plantilla Meta."
      );
    }


    const contenido =
      leerContenidoEstructurado(
        envioBase
          .contenido_enviado
      );


    // ==================================================
    // 4. MENSAJE
    // ==================================================

    const mensaje =
      contenido.mensaje ||
      String(
        alerta.mensaje ??
        ""
      ).trim();


    if (!mensaje) {

      throw new Error(
        "La alerta no contiene mensaje para el recordatorio."
      );
    }


    // ==================================================
    // 5. CREAR PENDIENTE
    // ==================================================
    //
    // Recordatorio 1:
    // secuencia = 2
    //
    // Recordatorio 2:
    // secuencia = 3
    //
    // Recordatorio 3:
    // secuencia = 4
    //
    // Cada uno comienza con:
    //
    // intento = 1
    // ==================================================

    const resultadoEnvio =
      await AlertaEnviosService
        .crearEnvioWhatsAppPendiente(
          client,
          {
            alertaId:
              alerta.id,

            mensaje,

            plantillaMeta:
              plantilla,

            parametrosPlantilla:
              contenido.parametros,

            secuenciaNotificacion:
              siguienteSecuencia,

            intento:
              1,

            fechaProgramadaIntento:
              null,
          }
        );


    // ==================================================
    // SIN INSPECTOR
    // ==================================================

    if (
      resultadoEnvio.motivo ===
      "SIN_DESTINATARIO_WHATSAPP"
    ) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "SIN_DESTINATARIO",

        alertaId:
          alerta.id,

        siguienteSecuencia,
      };
    }


    if (
      !resultadoEnvio
        .envio
        ?.id
    ) {

      throw new Error(
        "No fue posible crear el recordatorio de WhatsApp."
      );
    }


    // ==================================================
    // 6. CONFIRMAR
    // ==================================================

    await client.query(
      "COMMIT"
    );


    transaccionActiva =
      false;


    return {
      accion:
        "RECORDATORIO_CREADO",

      alertaId:
        alerta.id,

      tipo:
        alerta.tipo,

      secuencia:
        siguienteSecuencia,

      numeroRecordatorio:
        siguienteSecuencia - 1,

      envioId:
        resultadoEnvio
          .envio
          .id,

      plantilla,
    };


  } catch (
    error
  ) {

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
          "Error revirtiendo recordatorio WhatsApp:",
          rollbackError.message
        );
      }
    }


    throw error;


  } finally {

    client.release();
  }
}


// ======================================================
// EJECUTAR CICLO
// ======================================================

async function ejecutarCiclo() {

  if (
    ejecucionEnCurso
  ) {

    return {
      accion:
        "CICLO_EN_PROCESO",
    };
  }


  ejecucionEnCurso =
    true;


  const resultados =
    [];


  try {

    const limite =
      obtenerLimitePorCiclo();


    for (
      let i = 0;
      i < limite;
      i++
    ) {

      const resultado =
        await crearSiguienteRecordatorio();


      if (
        resultado.accion ===
        "SIN_RECORDATORIOS_PENDIENTES"
      ) {

        break;
      }


      resultados.push(
        resultado
      );


      // ================================================
      // SIN DESTINATARIO
      // ================================================
      //
      // No repetimos inmediatamente el mismo registro
      // dentro del mismo ciclo.
      // ================================================

      if (
        resultado.accion ===
        "SIN_DESTINATARIO"
      ) {

        break;
      }


      if (
        resultado.accion ===
        "RECORDATORIO_CREADO"
      ) {

        console.log(
          `Recordatorio WhatsApp ${resultado.numeroRecordatorio}/3 creado | alerta ${resultado.alertaId} | envío ${resultado.envioId}`
        );
      }
    }


    return {
      accion:
        "CICLO_COMPLETADO",

      total:
        resultados.length,

      resultados,
    };


  } catch (
    error
  ) {

    console.error(
      "Error ejecutando recordatorios WhatsApp:",
      error.message
    );


    return {
      accion:
        "ERROR_RECORDATORIOS_WHATSAPP",

      error:
        error.message,

      resultados,
    };


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

    return {
      iniciado:
        false,

      motivo:
        "MONITOR_YA_INICIADO",
    };
  }


  const intervaloMs =
    obtenerIntervaloMonitorMs();


  // ====================================================
  // PRIMER CICLO
  // ====================================================

  await ejecutarCiclo();


  // ====================================================
  // CICLOS POSTERIORES
  // ====================================================

  timerMonitor =
    setInterval(
      () => {

        ejecutarCiclo()
          .catch(
            (
              error
            ) => {

              console.error(
                "Error inesperado en monitor de recordatorios WhatsApp:",
                error.message
              );
            }
          );

      },
      intervaloMs
    );


  console.log(
    `Monitor de recordatorios WhatsApp activo cada ${intervaloMs} ms.`
  );


  return {
    iniciado:
      true,

    intervaloMs,

    intervaloRecordatorioMin:
      obtenerIntervaloRecordatorioMin(),

    maxRecordatorios:
      MAX_RECORDATORIOS,
  };
}


// ======================================================
// DETENER MONITOR
// ======================================================

function detenerMonitor() {

  if (
    timerMonitor
  ) {

    clearInterval(
      timerMonitor
    );


    timerMonitor =
      null;
  }


  ejecucionEnCurso =
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

  crearSiguienteRecordatorio,
};