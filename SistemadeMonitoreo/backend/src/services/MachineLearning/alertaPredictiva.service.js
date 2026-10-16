const pool = require(
  "../../config/db"
);

const PrediccionService = require(
  "./prediccion.service"
);

const AlertaEnviosService = require(
  "../controlDSH/alertas/AlertaEnvios.service"
);


// ======================================================
// CONSTANTES
// ======================================================

const TIPO_ALERTA = {
  PREDICTIVA:
    "PREDICTIVA",
};


const ESTADO_ALERTA = {
  ACTIVA:
    "ACTIVA",
};


const RIESGOS_ALERTA =
  new Set([
    "MEDIO",
    "ALTO",
  ]);


const ESTADOS_WHATSAPP_OK =
  new Set([
    "ACEPTADO",
    "ENVIADO",
    "ENTREGADO",
    "LEIDO",
  ]);


const MAX_SECUENCIA_NOTIFICACION =
  4;


// ======================================================
// HELPERS
// ======================================================

function toInt(value) {

  const numero =
    Number.parseInt(
      String(value),
      10
    );


  return Number.isSafeInteger(
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


function redondear2(value) {

  return Number(
    Number(value)
      .toFixed(2)
  );
}


// ======================================================
// CONFIGURACIÓN DE RECORDATORIOS ML
// ======================================================
//
// Independiente de configuracion_alertas.
//
// Por defecto:
//
// secuencia 1 = aviso inicial
//
// <= 3 días
// secuencia 2 = recordatorio 1
//
// <= 2 días
// secuencia 3 = recordatorio 2
//
// <= 1 día
// secuencia 4 = recordatorio 3
//
// Si la predicción cambia rápidamente y se salta
// un rango, NO se envían recordatorios atrasados.
// Se crea únicamente el recordatorio correspondiente
// al rango actual.
// ======================================================

function obtenerUmbralesRecordatorios() {

  const recordatorio1 =
    Number(
      process.env
        .ML_RECORDATORIO_1_DIAS ??
      3
    );

  const recordatorio2 =
    Number(
      process.env
        .ML_RECORDATORIO_2_DIAS ??
      2
    );

  const recordatorio3 =
    Number(
      process.env
        .ML_RECORDATORIO_3_DIAS ??
      1
    );


  if (
    !Number.isFinite(
      recordatorio1
    ) ||
    !Number.isFinite(
      recordatorio2
    ) ||
    !Number.isFinite(
      recordatorio3
    ) ||
    recordatorio1 <=
      recordatorio2 ||
    recordatorio2 <=
      recordatorio3 ||
    recordatorio3 < 0
  ) {

    throw new Error(
      "Los umbrales de recordatorios ML no están configurados correctamente."
    );
  }


  return {
    recordatorio1,
    recordatorio2,
    recordatorio3,
  };
}


// ======================================================
// OBTENER SECUENCIA SEGÚN TIEMPO RESTANTE
// ======================================================

function obtenerSecuenciaPorTiempo(
  diasParaAlto
) {

  const dias =
    toNumber(
      diasParaAlto
    );


  if (
    dias === null ||
    dias < 0
  ) {

    return null;
  }


  const {
    recordatorio1,
    recordatorio2,
    recordatorio3,
  } =
    obtenerUmbralesRecordatorios();


  // ====================================================
  // MÁS CERCA
  // ====================================================

  if (
    dias <=
    recordatorio3
  ) {

    return 4;
  }


  if (
    dias <=
    recordatorio2
  ) {

    return 3;
  }


  if (
    dias <=
    recordatorio1
  ) {

    return 2;
  }


  return null;
}


// ======================================================
// OBTENER PLANTILLA META PREDICTIVA
// ======================================================

function obtenerPlantillaMetaPrediccion() {

  const plantilla =
    String(
      process.env
        .WHATSAPP_TEMPLATE_PREDICCION ??
      ""
    ).trim();


  if (!plantilla) {

    throw new Error(
      "WHATSAPP_TEMPLATE_PREDICCION no está configurado."
    );
  }


  return plantilla;
}


// ======================================================
// FORMATEAR TIEMPO ESTIMADO
// ======================================================
//
// 0 días    -> Ahora
// 0.25 días -> 6 horas
// 1 día     -> 1 día
// 2.4 días  -> 2.4 días
//
// Corresponde a {{2}} de:
// prediccion_llenado_cc
// ======================================================

function formatearTiempoEstimado(
  dias
) {

  const numero =
    toNumber(
      dias
    );


  if (
    numero === null ||
    numero < 0
  ) {

    throw new Error(
      "El tiempo estimado de la predicción no es válido."
    );
  }


  if (
    numero === 0
  ) {

    return "Ahora";
  }


  if (
    numero < 1
  ) {

    const horas =
      Math.max(
        1,
        Math.round(
          numero * 24
        )
      );


    return horas === 1
      ? "1 hora"
      : `${horas} horas`;
  }


  const diasRedondeados =
    redondear2(
      numero
    );


  return diasRedondeados === 1
    ? "1 día"
    : `${diasRedondeados} días`;
}


// ======================================================
// VALIDAR PREDICCIÓN
// ======================================================
//
// IMPORTANTE:
//
// Solo usa resultado de Machine Learning.
//
// NO usa configuracion_alertas.
// ======================================================

function validarPrediccion(
  prediccion
) {

  if (
    !prediccion ||
    typeof prediccion !==
      "object" ||
    Array.isArray(
      prediccion
    )
  ) {

    throw new Error(
      "La predicción recibida no es válida."
    );
  }


  const contenedorId =
    toInt(
      prediccion
        .contenedor_id
    );


  if (
    !contenedorId ||
    contenedorId <= 0
  ) {

    throw new Error(
      "La predicción contiene un contenedor inválido."
    );
  }


  if (
    typeof prediccion.estado !==
      "string" ||
    !prediccion.estado.trim()
  ) {

    throw new Error(
      "La predicción contiene un estado inválido."
    );
  }


  // ====================================================
  // PREDICCIÓN NO UTILIZABLE
  // ====================================================

  if (
    prediccion.estado !==
    "OK"
  ) {

    return {
      contenedorId,

      estado:
        prediccion.estado,

      prediccion,
    };
  }


  const nivelActual =
    toNumber(
      prediccion
        .nivel_actual
    );


  const crecimiento =
    toNumber(
      prediccion
        .crecimiento_estimado_dia
    );


  const diasParaAlto =
    toNumber(
      prediccion
        .dias_para_alto
    );


  const umbralAlto =
    toNumber(
      prediccion
        .umbral_alto
    );


  const riesgo =
    String(
      prediccion
        .riesgo ??
      ""
    )
      .trim()
      .toUpperCase();


  if (
    nivelActual === null ||
    nivelActual < 0 ||
    nivelActual > 100
  ) {

    throw new Error(
      "La predicción contiene un nivel actual inválido."
    );
  }


  if (
    crecimiento === null ||
    crecimiento < 0
  ) {

    throw new Error(
      "La predicción contiene un crecimiento inválido."
    );
  }


  if (
    diasParaAlto === null ||
    diasParaAlto < 0
  ) {

    throw new Error(
      "La predicción contiene días para nivel alto inválidos."
    );
  }


  if (
    umbralAlto === null ||
    umbralAlto <= 0 ||
    umbralAlto > 100
  ) {

    throw new Error(
      "La predicción contiene un umbral alto inválido."
    );
  }


  if (!riesgo) {

    throw new Error(
      "La predicción contiene un riesgo inválido."
    );
  }


  return {
    contenedorId,

    estado:
      "OK",

    nivelActual,

    crecimiento,

    diasParaAlto,

    umbralAlto,

    riesgo,

    prediccion,
  };
}


// ======================================================
// ASEGURAR ESTADO DEL CONTENEDOR
// ======================================================

async function asegurarEstadoContenedor(
  client,
  contenedorId
) {

  await client.query(
    `
      INSERT INTO estado_alertas_contenedor
      (
        contenedor_id
      )
      VALUES
      (
        $1
      )

      ON CONFLICT (
        contenedor_id
      )
      DO NOTHING
    `,
    [
      contenedorId,
    ]
  );
}


// ======================================================
// BLOQUEAR ESTADO DEL CONTENEDOR
// ======================================================
//
// FOR UPDATE evita dos evaluaciones simultáneas
// del mismo ciclo.
// ======================================================

async function obtenerEstadoContenedor(
  client,
  contenedorId
) {

  const { rows } =
    await client.query(
      `
        SELECT
          contenedor_id,
          ultima_recoleccion_id,
          fecha_reinicio,
          fecha_actualizacion

        FROM estado_alertas_contenedor

        WHERE contenedor_id = $1

        FOR UPDATE
      `,
      [
        contenedorId,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// OBTENER CONTENEDOR
// ======================================================

async function obtenerContenedor(
  client,
  contenedorId
) {

  const { rows } =
    await client.query(
      `
        SELECT
          c.id_contenedor,
          c.codigo,
          c.id_tipo_residuo,

          tr.nombre
            AS tipo_residuo

        FROM contenedores c

        JOIN tipos_residuo tr
          ON tr.id =
             c.id_tipo_residuo

        WHERE c.id_contenedor = $1

        LIMIT 1
      `,
      [
        contenedorId,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// BUSCAR ALERTA PREDICTIVA DEL CICLO ACTUAL
// ======================================================

async function obtenerAlertaPredictivaExistente(
  client,
  contenedorId,
  fechaReinicio
) {

  const { rows } =
    await client.query(
      `
        SELECT
          id,
          tipo,
          contenedor_id,
          motivo,
          nivel_porcentaje,
          umbral_configurado,
          mensaje,
          estado,
          fecha_creacion,
          fecha_activacion

        FROM alertas

        WHERE tipo = $1

          AND contenedor_id = $2

          AND (
            $3::timestamptz
              IS NULL

            OR fecha_creacion >=
               $3::timestamptz
          )

        ORDER BY
          fecha_creacion DESC,
          id DESC

        LIMIT 1
      `,
      [
        TIPO_ALERTA
          .PREDICTIVA,

        contenedorId,

        fechaReinicio ||
        null,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// CREAR ALERTA PREDICTIVA
// ======================================================

async function crearAlertaPredictiva(
  client,
  {
    contenedorId,
    nivelActual,
    umbralAlto,
    riesgo,
    diasParaAlto,
    crecimiento,
    mensaje,
  }
) {

  const motivo =
    `RIESGO_${riesgo}`;


  const { rows } =
    await client.query(
      `
        INSERT INTO alertas
        (
          tipo,
          contenedor_id,
          lectura_id,

          motivo,

          nivel_porcentaje,
          umbral_configurado,

          fecha_programada_original,
          proxima_ejecucion,
          cantidad_posposiciones,

          mensaje,
          estado,
          creado_por,

          fecha_creacion,
          fecha_activacion
        )
        VALUES
        (
          $1,
          $2,
          NULL,

          $3,

          $4,
          $5,

          NULL,
          NULL,
          0,

          $6,
          $7,
          NULL,

          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )

        RETURNING
          id,
          tipo,
          contenedor_id,
          motivo,
          nivel_porcentaje,
          umbral_configurado,
          mensaje,
          estado,
          fecha_creacion,
          fecha_activacion
      `,
      [
        TIPO_ALERTA
          .PREDICTIVA,

        contenedorId,

        motivo,

        redondear2(
          nivelActual
        ),

        redondear2(
          umbralAlto
        ),

        mensaje,

        ESTADO_ALERTA
          .ACTIVA,
      ]
    );


  return {
    ...rows[0],

    riesgo,

    dias_para_alto:
      redondear2(
        diasParaAlto
      ),

    crecimiento_estimado_dia:
      redondear2(
        crecimiento
      ),
  };
}


// ======================================================
// CREAR MENSAJE DE TRAZABILIDAD
// ======================================================

function crearMensajeTrazabilidad(
  contenedor,
  datos
) {

  const tiempoEstimado =
    formatearTiempoEstimado(
      datos.diasParaAlto
    );


  return (
    `El contenedor ${contenedor.codigo} ` +
    `(${contenedor.tipo_residuo}) ` +
    `presenta riesgo predictivo ${datos.riesgo}. ` +
    `El modelo estima que alcanzará su nivel alto ` +
    `en aproximadamente ${tiempoEstimado}. ` +
    `Nivel actual: ${redondear2(
      datos.nivelActual
    )}%.`
  );
}


// ======================================================
// CREAR ENVÍO WHATSAPP PREDICTIVO
// ======================================================
//
// Sirve tanto para:
//
// secuencia 1 = inicial
// secuencia 2 = recordatorio 1
// secuencia 3 = recordatorio 2
// secuencia 4 = recordatorio 3
//
// Cada secuencia comienza:
//
// intento = 1
//
// Los intentos 2 y 3 los maneja
// ResultadoEnvios.service.js.
// ======================================================

async function crearEnvioWhatsAppPredictivo(
  client,
  {
    alerta,
    contenedor,
    diasParaAlto,
    secuenciaNotificacion,
    mensaje,
  }
) {

  if (
    !alerta ||
    !alerta.id
  ) {

    throw new Error(
      "No existe una alerta predictiva válida para crear el envío de WhatsApp."
    );
  }


  if (
    !contenedor ||
    !contenedor.codigo ||
    !contenedor.tipo_residuo
  ) {

    throw new Error(
      "No existen datos válidos del contenedor para crear el envío predictivo."
    );
  }


  const secuencia =
    Number(
      secuenciaNotificacion
    );


  if (
    !Number.isSafeInteger(
      secuencia
    ) ||
    secuencia < 1 ||
    secuencia >
      MAX_SECUENCIA_NOTIFICACION
  ) {

    throw new Error(
      "La secuencia predictiva de WhatsApp no es válida."
    );
  }


  const identificacionContenedor =
    `${contenedor.codigo} (${contenedor.tipo_residuo})`;


  const tiempoEstimado =
    formatearTiempoEstimado(
      diasParaAlto
    );


  return AlertaEnviosService
    .crearEnvioWhatsAppPendiente(
      client,
      {
        alertaId:
          alerta.id,

        mensaje,

        plantillaMeta:
          obtenerPlantillaMetaPrediccion(),

        parametrosPlantilla: [
          identificacionContenedor,
          tiempoEstimado,
        ],

        secuenciaNotificacion:
          secuencia,

        intento:
          1,

        fechaProgramadaIntento:
          null,
      }
    );
}


// ======================================================
// OBTENER ENVÍOS DE UNA ALERTA
// ======================================================

async function obtenerEnviosAlerta(
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
          intento,
          estado,
          plantilla_meta,
          contenido_enviado,
          fecha_programada_intento,
          fecha_intento,
          fecha_actualizacion

        FROM alertas_envios

        WHERE alerta_id = $1

        ORDER BY
          secuencia_notificacion ASC,
          canal ASC,
          intento ASC,
          id ASC
      `,
      [
        alertaId,
      ]
    );


  return rows;
}


// ======================================================
// COMPROBAR SI EXISTE UNA SECUENCIA WHATSAPP
// ======================================================

function existeSecuenciaWhatsApp(
  envios,
  secuencia
) {

  return envios.some(
    (
      envio
    ) =>
      envio.canal ===
        "WHATSAPP" &&
      Number(
        envio.secuencia_notificacion
      ) ===
        Number(
          secuencia
        )
  );
}


// ======================================================
// COMPROBAR ENVÍO INICIAL VÁLIDO
// ======================================================

function existeEnvioInicialValido(
  envios
) {

  return envios.some(
    (
      envio
    ) =>
      envio.canal ===
        "WHATSAPP" &&

      Number(
        envio.secuencia_notificacion
      ) === 1 &&

      String(
        envio.plantilla_meta ??
        ""
      ).trim()
  );
}


// ======================================================
// OBTENER ÚLTIMA SECUENCIA WHATSAPP EXISTENTE
// ======================================================

function obtenerUltimaSecuenciaWhatsApp(
  envios
) {

  let ultima =
    null;


  for (
    const envio
    of envios
  ) {

    if (
      envio.canal !==
      "WHATSAPP"
    ) {

      continue;
    }


    const secuencia =
      Number(
        envio
          .secuencia_notificacion
      );


    if (
      !Number.isSafeInteger(
        secuencia
      )
    ) {

      continue;
    }


    if (
      ultima === null ||
      secuencia > ultima
    ) {

      ultima =
        secuencia;
    }
  }


  return ultima;
}


// ======================================================
// SABER SI UNA SECUENCIA LÓGICA YA TERMINÓ
// ======================================================
//
// Terminó si:
//
// 1. Algún intento WhatsApp fue:
//    ACEPTADO / ENVIADO / ENTREGADO / LEIDO
//
// O
//
// 2. El intento 3 terminó FALLIDO.
//
// Después del tercer fallo, el procesador evalúa
// el correo de respaldo.
//
// El correo NO cambia el número de recordatorio.
// ======================================================

function secuenciaFinalizada(
  envios,
  secuencia
) {

  const whatsapp =
    envios.filter(
      (
        envio
      ) =>
        envio.canal ===
          "WHATSAPP" &&
        Number(
          envio
            .secuencia_notificacion
        ) ===
          Number(
            secuencia
          )
    );


  if (!whatsapp.length) {

    return false;
  }


  const aceptado =
    whatsapp.some(
      (
        envio
      ) =>
        ESTADOS_WHATSAPP_OK
          .has(
            String(
              envio.estado
            )
          )
    );


  if (aceptado) {

    return true;
  }


  const tercerIntentoFallido =
    whatsapp.some(
      (
        envio
      ) =>
        Number(
          envio.intento
        ) === 3 &&

        envio.estado ===
          "FALLIDO"
    );


  return tercerIntentoFallido;
}


// ======================================================
// ASEGURAR AVISO INICIAL
// ======================================================
//
// Si la alerta predictiva ya existe pero por alguna
// razón todavía no posee secuencia 1, se intenta crear.
//
// Esto evita que quede una alerta sin WhatsApp porque
// en ese momento no había Inspector configurado.
// ======================================================

async function asegurarEnvioInicial(
  client,
  {
    alerta,
    contenedor,
    datos,
    envios,
  }
) {

  if (
    existeEnvioInicialValido(
      envios
    )
  ) {

    return {
      accion:
        "ENVIO_INICIAL_YA_EXISTE",
    };
  }


  // ====================================================
  // EXISTE SECUENCIA 1 ANTIGUA PERO SIN PLANTILLA
  // ====================================================
  //
  // No insertamos otra porque la BD tiene UNIQUE:
  //
  // alerta_id
  // secuencia_notificacion
  // canal
  // intento
  // ====================================================

  if (
    existeSecuenciaWhatsApp(
      envios,
      1
    )
  ) {

    return {
      accion:
        "ENVIO_INICIAL_NO_COMPATIBLE",

      motivo:
        "EXISTE_SECUENCIA_1_SIN_PLANTILLA",
    };
  }


  const mensaje =
    crearMensajeTrazabilidad(
      contenedor,
      datos
    );


  const resultado =
    await crearEnvioWhatsAppPredictivo(
      client,
      {
        alerta,
        contenedor,

        diasParaAlto:
          datos.diasParaAlto,

        secuenciaNotificacion:
          1,

        mensaje,
      }
    );


  return {
    accion:
      "ENVIO_INICIAL_CREADO",

    resultado,
  };
}


// ======================================================
// CREAR RECORDATORIO PREDICTIVO SI CORRESPONDE
// ======================================================

async function crearRecordatorioPredictivoSiCorresponde(
  client,
  {
    alerta,
    contenedor,
    datos,
  }
) {

  if (
    alerta.estado !==
    ESTADO_ALERTA.ACTIVA
  ) {

    return {
      accion:
        "ALERTA_PREDICTIVA_NO_ACTIVA",
    };
  }


  // ====================================================
  // DETERMINAR RANGO ACTUAL
  // ====================================================

  const secuenciaObjetivo =
    obtenerSecuenciaPorTiempo(
      datos.diasParaAlto
    );


  if (!secuenciaObjetivo) {

    return {
      accion:
        "SIN_RECORDATORIO_PREDICTIVO",

      motivo:
        "TIEMPO_AUN_LEJANO",
    };
  }


  const envios =
    await obtenerEnviosAlerta(
      client,
      alerta.id
    );


  // ====================================================
  // ASEGURAR INICIAL
  // ====================================================

  const inicial =
    await asegurarEnvioInicial(
      client,
      {
        alerta,
        contenedor,
        datos,
        envios,
      }
    );


  if (
    inicial.accion ===
    "ENVIO_INICIAL_CREADO"
  ) {

    return {
      accion:
        "ENVIO_INICIAL_PREDICTIVO_CREADO",

      envio:
        inicial.resultado,
    };
  }


  if (
    inicial.accion ===
    "ENVIO_INICIAL_NO_COMPATIBLE"
  ) {

    return inicial;
  }


  // ====================================================
  // REFRESCAR ENVÍOS
  // ====================================================

  const enviosActualizados =
    await obtenerEnviosAlerta(
      client,
      alerta.id
    );


  // ====================================================
  // EL RECORDATORIO YA EXISTE
  // ====================================================

  if (
    existeSecuenciaWhatsApp(
      enviosActualizados,
      secuenciaObjetivo
    )
  ) {

    return {
      accion:
        "RECORDATORIO_PREDICTIVO_YA_EXISTE",

      secuencia:
        secuenciaObjetivo,

      numero_recordatorio:
        secuenciaObjetivo - 1,
    };
  }


  // ====================================================
  // OBTENER ÚLTIMA SECUENCIA EXISTENTE
  // ====================================================

  const ultimaSecuencia =
    obtenerUltimaSecuenciaWhatsApp(
      enviosActualizados
    );


  if (
    ultimaSecuencia === null
  ) {

    return {
      accion:
        "SIN_ENVIO_PREDICTIVO_PREVIO",
    };
  }


  // ====================================================
  // NO REGRESAR A UN RECORDATORIO ANTERIOR
  // ====================================================
  //
  // Ejemplo:
  //
  // ya se generó secuencia 3.
  //
  // Si ML posteriormente vuelve a 2.5 días,
  // NO se genera secuencia 2.
  // ====================================================

  if (
    secuenciaObjetivo <=
    ultimaSecuencia
  ) {

    return {
      accion:
        "SIN_NUEVO_RECORDATORIO",

      secuencia_actual:
        ultimaSecuencia,

      secuencia_objetivo:
        secuenciaObjetivo,
    };
  }


  // ====================================================
  // ESPERAR A QUE TERMINE LA NOTIFICACIÓN ANTERIOR
  // ====================================================

  if (
    !secuenciaFinalizada(
      enviosActualizados,
      ultimaSecuencia
    )
  ) {

    return {
      accion:
        "ESPERANDO_ENVIO_PREDICTIVO_ANTERIOR",

      secuencia:
        ultimaSecuencia,
    };
  }


  // ====================================================
  // CREAR RECORDATORIO
  // ====================================================

  const mensaje =
    crearMensajeTrazabilidad(
      contenedor,
      datos
    );


  const resultado =
    await crearEnvioWhatsAppPredictivo(
      client,
      {
        alerta,
        contenedor,

        diasParaAlto:
          datos.diasParaAlto,

        secuenciaNotificacion:
          secuenciaObjetivo,

        mensaje,
      }
    );


  return {
    accion:
      "RECORDATORIO_PREDICTIVO_CREADO",

    secuencia:
      secuenciaObjetivo,

    numero_recordatorio:
      secuenciaObjetivo - 1,

    dias_para_alto:
      redondear2(
        datos.diasParaAlto
      ),

    envio:
      resultado,
  };
}


// ======================================================
// EVALUAR UNA PREDICCIÓN
// ======================================================

async function evaluarPrediccion(
  prediccion
) {

  const datos =
    validarPrediccion(
      prediccion
    );


  // ====================================================
  // PREDICCIÓN NO DISPONIBLE
  // ====================================================

  if (
    datos.estado !==
    "OK"
  ) {

    return {
      contenedor_id:
        datos.contenedorId,

      accion:
        "PREDICCION_NO_DISPONIBLE",

      estado_prediccion:
        datos.estado,

      alerta:
        null,

      envio_whatsapp:
        null,
    };
  }


  // ====================================================
  // RIESGO QUE NO REQUIERE ALERTA
  // ====================================================

  if (
    !RIESGOS_ALERTA.has(
      datos.riesgo
    )
  ) {

    return {
      contenedor_id:
        datos.contenedorId,

      accion:
        "SIN_ALERTA_PREDICTIVA",

      riesgo:
        datos.riesgo,

      dias_para_alto:
        datos.diasParaAlto,

      alerta:
        null,

      envio_whatsapp:
        null,
    };
  }


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
    // ESTADO DEL CICLO
    // ==================================================
    //
    // Machine Learning continúa independiente de
    // configuracion_alertas.
    // ==================================================

    await asegurarEstadoContenedor(
      client,
      datos.contenedorId
    );


    const estado =
      await obtenerEstadoContenedor(
        client,
        datos.contenedorId
      );


    if (!estado) {

      throw new Error(
        "No fue posible obtener el estado del ciclo del contenedor."
      );
    }


    // ==================================================
    // CONTENEDOR
    // ==================================================

    const contenedor =
      await obtenerContenedor(
        client,
        datos.contenedorId
      );


    if (!contenedor) {

      throw new Error(
        "No existe el contenedor evaluado."
      );
    }


    // ==================================================
    // BUSCAR ALERTA DEL CICLO
    // ==================================================

    const alertaExistente =
      await obtenerAlertaPredictivaExistente(
        client,
        datos.contenedorId,
        estado.fecha_reinicio
      );


    // ==================================================
    // ALERTA YA EXISTE
    // ==================================================
    //
    // Antes simplemente se devolvía:
    //
    // ALERTA_PREDICTIVA_YA_EXISTE
    //
    // Ahora aquí es donde evaluamos si corresponde
    // recordatorio 1, 2 o 3.
    // ==================================================

    if (alertaExistente) {

      const recordatorio =
        await crearRecordatorioPredictivoSiCorresponde(
          client,
          {
            alerta:
              alertaExistente,

            contenedor,

            datos,
          }
        );


      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      if (
        recordatorio.accion ===
        "RECORDATORIO_PREDICTIVO_CREADO"
      ) {

        console.log(
          `ML: recordatorio ${recordatorio.numero_recordatorio}/3 creado para ${contenedor.codigo} | ${recordatorio.dias_para_alto} días para nivel alto.`
        );
      }


      return {
        contenedor_id:
          datos.contenedorId,

        accion:
          recordatorio.accion,

        riesgo:
          datos.riesgo,

        dias_para_alto:
          datos.diasParaAlto,

        alerta:
          alertaExistente,

        recordatorio,

        envio_whatsapp:
          recordatorio.envio ||
          null,
      };
    }


    // ==================================================
    // CREAR MENSAJE
    // ==================================================

    const mensaje =
      crearMensajeTrazabilidad(
        contenedor,
        datos
      );


    // ==================================================
    // 1. CREAR ALERTA PREDICTIVA
    // ==================================================

    const alerta =
      await crearAlertaPredictiva(
        client,
        {
          contenedorId:
            datos.contenedorId,

          nivelActual:
            datos.nivelActual,

          umbralAlto:
            datos.umbralAlto,

          riesgo:
            datos.riesgo,

          diasParaAlto:
            datos.diasParaAlto,

          crecimiento:
            datos.crecimiento,

          mensaje,
        }
      );


    // ==================================================
    // 2. CREAR AVISO INICIAL
    // ==================================================
    //
    // Siempre secuencia 1.
    //
    // Aunque ML ya indique 2 días o 1 día,
    // en esta primera evaluación NO enviamos además
    // los recordatorios.
    //
    // Primero sale el aviso inicial.
    // ==================================================

    const envioWhatsApp =
      await crearEnvioWhatsAppPredictivo(
        client,
        {
          alerta,
          contenedor,

          diasParaAlto:
            datos.diasParaAlto,

          secuenciaNotificacion:
            1,

          mensaje,
        }
      );


    // ==================================================
    // 3. COMMIT
    // ==================================================

    await client.query(
      "COMMIT"
    );


    transaccionActiva =
      false;


    return {
      contenedor_id:
        datos.contenedorId,

      accion:
        "ALERTA_PREDICTIVA_CREADA",

      riesgo:
        datos.riesgo,

      dias_para_alto:
        datos.diasParaAlto,

      alerta,

      envio_whatsapp:
        envioWhatsApp,
    };


  } catch (error) {

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
          "Error haciendo rollback de alerta predictiva:",
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
// EJECUTAR ML Y EVALUAR TODAS LAS PREDICCIONES
// ======================================================

async function evaluarPredicciones() {

  const predicciones =
    await PrediccionService
      .ejecutarPrediccion();


  const resultados =
    [];


  // ====================================================
  // PROCESAMIENTO SECUENCIAL
  // ====================================================

  for (
    const prediccion
    of predicciones
  ) {

    const resultado =
      await evaluarPrediccion(
        prediccion
      );


    resultados.push(
      resultado
    );
  }


  return {
    total:
      resultados.length,

    resultados,
  };
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  evaluarPrediccion,

  evaluarPredicciones,

  formatearTiempoEstimado,

  obtenerSecuenciaPorTiempo,
};