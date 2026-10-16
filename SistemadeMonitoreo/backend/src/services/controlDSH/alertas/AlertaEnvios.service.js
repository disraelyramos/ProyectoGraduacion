// backend/src/services/alertas/AlertaEnvios.service.js


// ======================================================
// CONSTANTES
// ======================================================

const CANAL_WHATSAPP =
  "WHATSAPP";

const ESTADO_PENDIENTE =
  "PENDIENTE";


// Aviso inicial + 3 recordatorios.
const MAX_SECUENCIA_NOTIFICACION =
  4;


// Cada aviso o recordatorio puede intentar
// enviarse hasta 3 veces por WhatsApp.
const MAX_INTENTOS_WHATSAPP =
  3;


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


// ======================================================
// VALIDAR CLIENTE DE BD
// ======================================================

function validarCliente(
  client
) {

  if (
    !client ||
    typeof client.query !==
      "function"
  ) {

    throw new Error(
      "No existe una conexión válida a la base de datos."
    );
  }
}


// ======================================================
// NORMALIZAR PLANTILLA META
// ======================================================

function normalizarPlantillaMeta(
  value
) {

  const plantilla =
    String(
      value ?? ""
    )
      .trim()
      .toLowerCase();


  if (!plantilla) {

    throw new Error(
      "La plantilla de Meta es obligatoria."
    );
  }


  if (
    !/^[a-z0-9_]+$/.test(
      plantilla
    )
  ) {

    throw new Error(
      "El nombre de la plantilla de Meta no es válido."
    );
  }


  return plantilla;
}


// ======================================================
// NORMALIZAR PARÁMETROS DE PLANTILLA
// ======================================================

function normalizarParametrosPlantilla(
  parametros
) {

  if (
    !Array.isArray(
      parametros
    )
  ) {

    throw new Error(
      "Los parámetros de la plantilla de Meta deben enviarse como un arreglo."
    );
  }


  if (
    parametros.length === 0
  ) {

    throw new Error(
      "La plantilla de Meta requiere parámetros."
    );
  }


  if (
    parametros.length > 10
  ) {

    throw new Error(
      "La plantilla contiene demasiados parámetros."
    );
  }


  return parametros.map(
    (
      parametro,
      index
    ) => {

      const texto =
        String(
          parametro ?? ""
        ).trim();


      if (!texto) {

        throw new Error(
          `El parámetro ${
            index + 1
          } de la plantilla está vacío.`
        );
      }


      return texto;
    }
  );
}


// ======================================================
// NORMALIZAR FECHA PROGRAMADA
// ======================================================

function normalizarFechaProgramada(
  value
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return null;
  }


  const fecha =
    value instanceof Date
      ? value
      : new Date(value);


  if (
    Number.isNaN(
      fecha.getTime()
    )
  ) {

    throw new Error(
      "La fecha programada del envío no es válida."
    );
  }


  return fecha.toISOString();
}


// ======================================================
// CREAR CONTENIDO ESTRUCTURADO
// ======================================================
//
// contenido_enviado continúa siendo TEXT en la BD,
// pero guardaremos JSON.
//
// Esto permite conservar:
//
// - mensaje humano;
// - parámetros exactos enviados a Meta.
//
// Así el procesador NO tendrá que interpretar
// cadenas de texto para reconstruir variables.
// ======================================================

function crearContenidoEstructurado({
  mensaje,
  parametrosPlantilla,
}) {

  const contenido =
    String(
      mensaje ?? ""
    ).trim();


  if (!contenido) {

    throw new Error(
      "El contenido de la notificación está vacío."
    );
  }


  return JSON.stringify({
    version:
      1,

    mensaje:
      contenido,

    parametros:
      parametrosPlantilla,
  });
}


// ======================================================
// OBTENER DESTINATARIO WHATSAPP ACTIVO
// ======================================================
//
// El sistema contempla un único Inspector receptor.
//
// No se utiliza ningún número proveniente de .env.
// El teléfono siempre procede de usuarios.
// ======================================================

// ======================================================
// OBTENER DESTINATARIO WHATSAPP ACTIVO
// ======================================================
//
// NO se quema:
//
// - id_usuario
// - rol_id
// - número de teléfono
//
// El destinatario se obtiene completamente desde BD.
//
// Regla:
//
// Debe existir UN único usuario:
// - activo
// - con telefono_whatsapp configurado
//
// ======================================================

async function obtenerDestinatarioWhatsApp(
  client
) {

  validarCliente(
    client
  );


  const { rows } =
    await client.query(
      `
        SELECT
          u.id_usuario,
          u.nombre,
          u.usuario,
          u.correo,
          u.telefono_whatsapp,

          r.nombre AS rol,

          eu.nombre AS estado

        FROM usuarios u

        INNER JOIN roles r
          ON r.id =
             u.rol_id

        INNER JOIN estados_usuario eu
          ON eu.id =
             u.estado_id

        WHERE LOWER(
          TRIM(
            eu.nombre
          )
        ) = 'activo'

          AND u.telefono_whatsapp
            IS NOT NULL

          AND TRIM(
            u.telefono_whatsapp
          ) <> ''

        ORDER BY
          u.id_usuario ASC

        LIMIT 2
      `
    );


  // ====================================================
  // NINGÚN USUARIO CON WHATSAPP
  // ====================================================

  if (
    rows.length === 0
  ) {

    return null;
  }


  // ====================================================
  // MÁS DE UN DESTINATARIO
  // ====================================================
  //
  // No elegimos uno arbitrariamente.
  //
  // Debe existir solamente un usuario activo
  // con WhatsApp configurado.
  // ====================================================

  if (
    rows.length > 1
  ) {

    throw new Error(
      "Existe más de un usuario activo con WhatsApp configurado. Debe existir un único destinatario."
    );
  }


  // ====================================================
  // DESTINATARIO OBTENIDO DESDE BD
  // ====================================================

  return rows[0];
}


// ======================================================
// CREAR ENVÍO WHATSAPP PENDIENTE
// ======================================================
//
// secuenciaNotificacion:
//
// 1 = aviso inicial
// 2 = recordatorio 1
// 3 = recordatorio 2
// 4 = recordatorio 3
//
// intento:
//
// 1 = primer intento técnico
// 2 = segundo intento técnico
// 3 = tercer intento técnico
//
// IMPORTANTE:
//
// Los intentos técnicos NO son recordatorios.
//
// El correo tampoco se genera aquí.
// ======================================================

async function crearEnvioWhatsAppPendiente(
  client,
  {
    alertaId,

    mensaje,

    plantillaMeta,

    parametrosPlantilla,

    secuenciaNotificacion = 1,

    intento = 1,

    fechaProgramadaIntento = null,
  }
) {

  validarCliente(
    client
  );


  // ====================================================
  // NORMALIZAR IDENTIFICADORES
  // ====================================================

  const alertaIdNumero =
    toInt(
      alertaId
    );


  const secuenciaNumero =
    toInt(
      secuenciaNotificacion
    );


  const intentoNumero =
    toInt(
      intento
    );


  // ====================================================
  // VALIDAR ALERTA
  // ====================================================

  if (
    !alertaIdNumero ||
    alertaIdNumero <= 0
  ) {

    throw new Error(
      "Alerta inválida al crear el envío."
    );
  }


  // ====================================================
  // VALIDAR SECUENCIA
  // ====================================================

  if (
    !secuenciaNumero ||
    secuenciaNumero < 1 ||
    secuenciaNumero >
      MAX_SECUENCIA_NOTIFICACION
  ) {

    throw new Error(
      "Secuencia de notificación inválida."
    );
  }


  // ====================================================
  // VALIDAR INTENTO
  // ====================================================

  if (
    !intentoNumero ||
    intentoNumero < 1 ||
    intentoNumero >
      MAX_INTENTOS_WHATSAPP
  ) {

    throw new Error(
      "Intento de WhatsApp inválido."
    );
  }


  // ====================================================
  // NORMALIZAR PLANTILLA
  // ====================================================

  const plantilla =
    normalizarPlantillaMeta(
      plantillaMeta
    );


  // ====================================================
  // NORMALIZAR PARÁMETROS
  // ====================================================

  const parametros =
    normalizarParametrosPlantilla(
      parametrosPlantilla
    );


  // ====================================================
  // CONTENIDO ESTRUCTURADO
  // ====================================================

  const contenido =
    crearContenidoEstructurado({
      mensaje,

      parametrosPlantilla:
        parametros,
    });


  // ====================================================
  // FECHA PROGRAMADA
  // ====================================================

  const fechaProgramada =
    normalizarFechaProgramada(
      fechaProgramadaIntento
    );


  // ====================================================
  // OBTENER DESTINATARIO DESDE BD
  // ====================================================

  const destinatario =
    await obtenerDestinatarioWhatsApp(
      client
    );


  // ====================================================
  // SIN INSPECTOR CON WHATSAPP
  // ====================================================
  //
  // La alerta principal se conserva.
  //
  // No se lanza excepción porque la ausencia temporal
  // de teléfono no debe eliminar la alerta.
  // ====================================================

  if (!destinatario) {

    return {
      creado:
        false,

      motivo:
        "SIN_DESTINATARIO_WHATSAPP",

      envio:
        null,
    };
  }


  // ====================================================
  // NORMALIZAR TELÉFONO
  // ====================================================

  const telefono =
    String(
      destinatario
        .telefono_whatsapp ??
      ""
    ).trim();


  if (!telefono) {

    return {
      creado:
        false,

      motivo:
        "SIN_DESTINATARIO_WHATSAPP",

      envio:
        null,
    };
  }


  // ====================================================
  // INSERTAR TRAZABILIDAD
  // ====================================================

  const {
    rows,
  } =
    await client.query(
      `
        INSERT INTO alertas_envios
        (
          alerta_id,
          secuencia_notificacion,
          canal,
          intento,

          usuario_destinatario_id,
          destinatario,

          estado,

          plantilla_meta,
          contenido_enviado,
          proveedor_mensaje_id,

          codigo_error,
          detalle_error,
          error_reintentable,

          fecha_programada_intento,
          fecha_intento,
          fecha_actualizacion,
          fecha_entregado,
          fecha_leido
        )
        VALUES
        (
          $1,
          $2,
          $3,
          $4,

          $5,
          $6,

          $7,

          $8,
          $9,
          NULL,

          NULL,
          NULL,
          NULL,

          COALESCE(
            $10::timestamptz,
            CURRENT_TIMESTAMP
          ),

          NULL,
          CURRENT_TIMESTAMP,
          NULL,
          NULL
        )

        ON CONFLICT
        (
          alerta_id,
          secuencia_notificacion,
          canal,
          intento
        )
        DO NOTHING

        RETURNING
          id,
          alerta_id,
          secuencia_notificacion,
          canal,
          intento,

          usuario_destinatario_id,
          destinatario,

          estado,

          plantilla_meta,
          contenido_enviado,

          proveedor_mensaje_id,

          fecha_programada_intento,
          fecha_actualizacion
      `,
      [
        alertaIdNumero,

        secuenciaNumero,

        CANAL_WHATSAPP,

        intentoNumero,

        destinatario
          .id_usuario,

        telefono,

        ESTADO_PENDIENTE,

        plantilla,

        contenido,

        fechaProgramada,
      ]
    );


  // ====================================================
  // ENVÍO CREADO
  // ====================================================

  if (
    rows.length > 0
  ) {

    return {
      creado:
        true,

      motivo:
        "ENVIO_PENDIENTE_CREADO",

      envio:
        rows[0],
    };
  }


  // ====================================================
  // ENVÍO YA EXISTENTE
  // ====================================================

  const {
    rows:
      existentes,
  } =
    await client.query(
      `
        SELECT
          id,
          alerta_id,
          secuencia_notificacion,
          canal,
          intento,

          usuario_destinatario_id,
          destinatario,

          estado,

          plantilla_meta,
          contenido_enviado,

          proveedor_mensaje_id,

          codigo_error,
          detalle_error,
          error_reintentable,

          fecha_programada_intento,
          fecha_intento,
          fecha_actualizacion,
          fecha_entregado,
          fecha_leido

        FROM alertas_envios

        WHERE alerta_id = $1

          AND secuencia_notificacion = $2

          AND canal = $3

          AND intento = $4

        LIMIT 1
      `,
      [
        alertaIdNumero,

        secuenciaNumero,

        CANAL_WHATSAPP,

        intentoNumero,
      ]
    );


  return {
    creado:
      false,

    motivo:
      "ENVIO_YA_EXISTE",

    envio:
      existentes[0] ||
      null,
  };
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  MAX_SECUENCIA_NOTIFICACION,

  MAX_INTENTOS_WHATSAPP,

  obtenerDestinatarioWhatsApp,

  crearEnvioWhatsAppPendiente,
};