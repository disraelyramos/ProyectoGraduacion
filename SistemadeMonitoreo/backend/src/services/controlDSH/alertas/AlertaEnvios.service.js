const pool = require(
  "../../../config/db"
);


// ======================================================
// CONSTANTES
// ======================================================

const CANAL = {
  WHATSAPP:
    "WHATSAPP",

  EMAIL:
    "EMAIL",
};


const ESTADO_ENVIO = {
  PENDIENTE:
    "PENDIENTE",
};


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


// ======================================================
// OBTENER DESTINATARIO ACTIVO
// ======================================================
//
// No se utiliza:
//
// id_usuario = 5
// usuario = juanito
// número hardcodeado
//
// Durante las pruebas encontrará al usuario actual.
//
// Cuando cambie el encargado, solamente se actualiza
// el usuario correspondiente en la base de datos.
// ======================================================

async function obtenerDestinatarioWhatsApp(
  client
) {

  const { rows } =
    await client.query(
      `
        SELECT
          u.id_usuario,
          u.nombre,
          u.usuario,
          u.correo,
          u.telefono_whatsapp,

          r.nombre
            AS rol,

          eu.nombre
            AS estado

        FROM usuarios u

        JOIN roles r
          ON r.id =
             u.rol_id

        JOIN estados_usuario eu
          ON eu.id =
             u.estado_id

        WHERE LOWER(
          TRIM(
            eu.nombre
          )
        ) = 'activo'

          AND LOWER(
            TRIM(
              r.nombre
            )
          ) IN (
            'administrador',
            'inspector'
          )

          AND u.telefono_whatsapp
            IS NOT NULL

          AND TRIM(
            u.telefono_whatsapp
          ) <> ''

        ORDER BY
          u.id_usuario

        LIMIT 2
      `
    );


  if (
    rows.length === 0
  ) {

    return null;
  }


  /*
   * El diseño actual contempla un único
   * encargado receptor de las alertas.
   *
   * Evitamos elegir silenciosamente entre
   * dos personas distintas.
   */
  if (
    rows.length > 1
  ) {

    throw new Error(
      "Existe más de un Administrador/Inspector activo con WhatsApp configurado."
    );
  }


  return rows[0];
}


// ======================================================
// CREAR ENVÍO WHATSAPP PENDIENTE
// ======================================================
//
// IMPORTANTE:
//
// Esto TODAVÍA NO llama a Meta.
//
// Únicamente registra que la alerta debe
// enviarse posteriormente.
//
// Ejemplo:
//
// alerta_id = 10
// secuencia = 1
// canal = WHATSAPP
// intento = 1
// estado = PENDIENTE
// ======================================================

async function crearEnvioWhatsAppPendiente(
  client,
  {
    alertaId,
    mensaje,
    secuenciaNotificacion = 1,
    intento = 1,
  }
) {

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


  const contenido =
    String(
      mensaje ??
      ""
    ).trim();


  if (!alertaIdNumero) {

    throw new Error(
      "Alerta inválida al crear el envío."
    );
  }


  if (
    !secuenciaNumero ||
    secuenciaNumero < 1
  ) {

    throw new Error(
      "Secuencia de notificación inválida."
    );
  }


  if (
    !intentoNumero ||
    intentoNumero < 1 ||
    intentoNumero > 3
  ) {

    throw new Error(
      "Intento de WhatsApp inválido."
    );
  }


  if (!contenido) {

    throw new Error(
      "El contenido de la notificación está vacío."
    );
  }


  // ====================================================
  // DESTINATARIO
  // ====================================================

  const destinatario =
    await obtenerDestinatarioWhatsApp(
      client
    );


  /*
   * La alerta del sistema NO debe desaparecer
   * porque temporalmente no exista un número
   * configurado.
   *
   * Por eso no lanzamos error en este caso.
   */
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

          NULL,
          $8,
          NULL,

          NULL,
          NULL,
          NULL,

          CURRENT_TIMESTAMP,
          NULL,
          CURRENT_TIMESTAMP,
          NULL,
          NULL
        )

        ON CONFLICT DO NOTHING

        RETURNING
          id,
          alerta_id,
          secuencia_notificacion,
          canal,
          intento,
          usuario_destinatario_id,
          destinatario,
          estado,
          contenido_enviado,
          fecha_programada_intento,
          fecha_actualizacion
      `,
      [
        alertaIdNumero,

        secuenciaNumero,

        CANAL
          .WHATSAPP,

        intentoNumero,

        destinatario
          .id_usuario,

        destinatario
          .telefono_whatsapp,

        ESTADO_ENVIO
          .PENDIENTE,

        contenido,
      ]
    );


  // ====================================================
  // INSERT REALIZADO
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
  // YA EXISTÍA
  // ====================================================
  //
  // Protege contra ejecuciones duplicadas.
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
          contenido_enviado,
          fecha_programada_intento,
          fecha_actualizacion

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

        CANAL
          .WHATSAPP,

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

  obtenerDestinatarioWhatsApp,

  crearEnvioWhatsAppPendiente,
};