const pool = require(
  "../../../config/db"
);

const {
  enviarCorreo,
} = require(
  "../../email.service"
);


// ======================================================
// CONSTANTES
// ======================================================

const CANAL_WHATSAPP =
  "WHATSAPP";

const CANAL_EMAIL =
  "EMAIL";

const ESTADO_PENDIENTE =
  "PENDIENTE";

const ESTADO_ACEPTADO =
  "ACEPTADO";

const ESTADO_FALLIDO =
  "FALLIDO";

const MAX_INTENTOS_WHATSAPP =
  3;


// ======================================================
// VALIDAR ID
// ======================================================

function validarId(
  valor,
  nombre
) {

  const numero =
    Number(
      valor
    );


  if (
    !Number.isSafeInteger(
      numero
    ) ||
    numero <= 0
  ) {

    throw new Error(
      `${nombre} inválido.`
    );
  }


  return numero;
}


// ======================================================
// ESCAPAR HTML
// ======================================================

function escaparHtml(
  valor
) {

  return String(
    valor ??
    ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}


// ======================================================
// OBTENER DATOS DEL RESPALDO
// ======================================================
//
// REGLA:
//
// Solamente aplica cuando:
//
// canal   = WHATSAPP
// intento = 3
// estado  = FALLIDO
//
// El correo se envía al MISMO usuario relacionado
// con el envío de WhatsApp.
//
// NO se quema:
//
// - id_usuario
// - rol_id
// - correo
//
// Todo se obtiene desde la base de datos.
// ======================================================

async function obtenerDatosRespaldo(
  envioWhatsAppId
) {

  const envioId =
    validarId(
      envioWhatsAppId,
      "Envío de WhatsApp"
    );


  const { rows } =
    await pool.query(
      `
        SELECT
          ae.id
            AS envio_whatsapp_id,

          ae.alerta_id,

          ae.secuencia_notificacion,

          ae.intento,

          ae.usuario_destinatario_id,

          ae.estado
            AS estado_whatsapp,

          a.tipo
            AS tipo_alerta,

          a.motivo
            AS motivo_alerta,

          a.mensaje
            AS mensaje_alerta,

          u.nombre
            AS nombre_destinatario,

          u.correo
            AS correo_destinatario,

          eu.nombre
            AS estado_usuario

        FROM alertas_envios ae

        JOIN alertas a
          ON a.id =
             ae.alerta_id

        LEFT JOIN usuarios u
          ON u.id_usuario =
             ae.usuario_destinatario_id

        LEFT JOIN estados_usuario eu
          ON eu.id =
             u.estado_id

        WHERE ae.id = $1

          AND ae.canal = $2

          AND ae.intento = $3

          AND ae.estado = $4

        LIMIT 1
      `,
      [
        envioId,

        CANAL_WHATSAPP,

        MAX_INTENTOS_WHATSAPP,

        ESTADO_FALLIDO,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// CREAR CONTENIDO DEL CORREO
// ======================================================

function crearCorreoRespaldo(
  datos
) {

  const nombre =
    escaparHtml(
      datos.nombre_destinatario ||
      "Usuario"
    );


  const tipo =
    escaparHtml(
      datos.tipo_alerta ||
      "ALERTA"
    );


  const motivo =
    escaparHtml(
      datos.motivo_alerta ||
      ""
    );


  const mensaje =
    escaparHtml(
      datos.mensaje_alerta ||
      "Se generó una alerta en el Sistema Bioinfeccioso."
    );


  const asunto =
    "Alerta del Sistema Bioinfeccioso";


  const html =
    `
      <div
        style="
          font-family: Arial, Helvetica, sans-serif;
          line-height: 1.6;
          max-width: 650px;
          margin: 0 auto;
        "
      >

        <h2>
          Sistema de Monitoreo Bioinfeccioso
        </h2>

        <p>
          Estimado(a)
          <strong>${nombre}</strong>:
        </p>

        <p>
          Se envía este correo como respaldo debido a que
          no fue posible entregar la notificación mediante
          WhatsApp después de tres intentos.
        </p>

        <p>
          <strong>Tipo de alerta:</strong>
          ${tipo}
        </p>

        ${
          motivo
            ? `
              <p>
                <strong>Motivo:</strong>
                ${motivo}
              </p>
            `
            : ""
        }

        <div
          style="
            padding: 12px;
            border: 1px solid #cccccc;
            border-radius: 6px;
          "
        >
          ${mensaje}
        </div>

        <p>
          Este mensaje fue generado automáticamente por
          el Sistema de Monitoreo Bioinfeccioso.
        </p>

      </div>
    `;


  return {
    asunto,
    html,
  };
}


// ======================================================
// BUSCAR RESPALDO EMAIL EXISTENTE
// ======================================================
//
// Cada notificación lógica puede generar máximo:
//
// 1 correo de respaldo.
//
// Ejemplo:
//
// alerta 12
// secuencia 1
// canal EMAIL
// intento 1
//
// No se generan intentos 2 o 3 de correo.
// ======================================================

async function obtenerEmailExistente(
  alertaId,
  secuenciaNotificacion
) {

  const alertaIdValidado =
    validarId(
      alertaId,
      "Alerta"
    );


  const secuenciaValidada =
    validarId(
      secuenciaNotificacion,
      "Secuencia de notificación"
    );


  const { rows } =
    await pool.query(
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

          codigo_error,

          detalle_error,

          fecha_programada_intento,

          fecha_intento,

          fecha_actualizacion

        FROM alertas_envios

        WHERE alerta_id = $1

          AND secuencia_notificacion = $2

          AND canal = $3

          AND intento = 1

        ORDER BY
          id ASC

        LIMIT 1
      `,
      [
        alertaIdValidado,

        secuenciaValidada,

        CANAL_EMAIL,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// CREAR EMAIL PENDIENTE
// ======================================================

async function crearEmailPendiente(
  datos
) {

  const correo =
    String(
      datos.correo_destinatario ??
      ""
    ).trim();


  if (!correo) {

    return {
      creado:
        false,

      motivo:
        "DESTINATARIO_SIN_CORREO",

      envio:
        null,
    };
  }


  // ====================================================
  // EVITAR DUPLICADOS
  // ====================================================

  const existente =
    await obtenerEmailExistente(
      datos.alerta_id,
      datos.secuencia_notificacion
    );


  if (existente) {

    return {
      creado:
        false,

      motivo:
        "EMAIL_YA_EXISTE",

      envio:
        existente,
    };
  }


  // ====================================================
  // CREAR CONTENIDO
  // ====================================================

  const {
    asunto,
    html,
  } =
    crearCorreoRespaldo(
      datos
    );


  const contenido =
    JSON.stringify({
      version:
        1,

      asunto,

      html,
    });


  // ====================================================
  // INSERTAR TRAZABILIDAD
  // ====================================================

  const { rows } =
    await pool.query(
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

          1,

          $4,

          $5,

          $6,

          NULL,

          $7,

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

        ON CONFLICT
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

          contenido_enviado,

          fecha_programada_intento,

          fecha_actualizacion
      `,
      [
        datos.alerta_id,

        datos.secuencia_notificacion,

        CANAL_EMAIL,

        datos.usuario_destinatario_id,

        correo,

        ESTADO_PENDIENTE,

        contenido,
      ]
    );


  // ====================================================
  // EMAIL CREADO
  // ====================================================

  if (
    rows.length > 0
  ) {

    return {
      creado:
        true,

      motivo:
        "EMAIL_PENDIENTE_CREADO",

      envio:
        rows[0],
    };
  }


  // ====================================================
  // POSIBLE CONFLICTO POR DUPLICADO
  // ====================================================

  const envio =
    await obtenerEmailExistente(
      datos.alerta_id,
      datos.secuencia_notificacion
    );


  return {
    creado:
      false,

    motivo:
      "EMAIL_YA_EXISTE",

    envio,
  };
}


// ======================================================
// MARCAR EMAIL COMO ACEPTADO
// ======================================================

async function marcarEmailAceptado(
  envioEmailId
) {

  const id =
    validarId(
      envioEmailId,
      "Envío de correo"
    );


  const { rows } =
    await pool.query(
      `
        UPDATE alertas_envios

        SET
          estado = $2,

          fecha_intento =
            CURRENT_TIMESTAMP,

          fecha_actualizacion =
            CURRENT_TIMESTAMP,

          codigo_error =
            NULL,

          detalle_error =
            NULL,

          error_reintentable =
            NULL

        WHERE id = $1

        RETURNING
          id,

          alerta_id,

          secuencia_notificacion,

          canal,

          intento,

          destinatario,

          estado,

          fecha_intento
      `,
      [
        id,

        ESTADO_ACEPTADO,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// MARCAR EMAIL COMO FALLIDO
// ======================================================

async function marcarEmailFallido(
  envioEmailId,
  error
) {

  const id =
    validarId(
      envioEmailId,
      "Envío de correo"
    );


  const detalle =
    String(
      error?.message ||
      "EMAIL_SEND_FAILED"
    )
      .trim()
      .slice(
        0,
        5000
      );


  const { rows } =
    await pool.query(
      `
        UPDATE alertas_envios

        SET
          estado = $2,

          codigo_error =
            'EMAIL_SEND_FAILED',

          detalle_error = $3,

          error_reintentable =
            FALSE,

          fecha_intento =
            CURRENT_TIMESTAMP,

          fecha_actualizacion =
            CURRENT_TIMESTAMP

        WHERE id = $1

        RETURNING
          id,

          alerta_id,

          secuencia_notificacion,

          canal,

          intento,

          destinatario,

          estado,

          codigo_error,

          detalle_error,

          fecha_intento
      `,
      [
        id,

        ESTADO_FALLIDO,

        detalle,
      ]
    );


  return rows[0] ||
    null;
}


// ======================================================
// ENVIAR RESPALDO POR CORREO
// ======================================================
//
// REGLA DEFINITIVA:
//
// NOTIFICACIÓN LÓGICA
//
// WhatsApp intento 1
//        ↓ FALLA
//
// WhatsApp intento 2
//        ↓ FALLA
//
// WhatsApp intento 3
//        ↓ FALLA
//
// EMAIL intento 1
//
//
// IMPORTANTE:
//
// - Solo 1 email.
// - Email no es recordatorio.
// - Email no tiene reintentos.
// - No depende de ningún rol.
// - Utiliza al mismo usuario del WhatsApp.
// - El usuario debe estar ACTIVO.
// - El usuario debe tener correo.
// ======================================================

async function enviarRespaldoEmail({
  envioWhatsAppId,
}) {

  // ====================================================
  // 1. VALIDAR TERCER FALLO
  // ====================================================

  const datos =
    await obtenerDatosRespaldo(
      envioWhatsAppId
    );


  if (!datos) {

    return {
      accion:
        "RESPALDO_NO_APLICA",

      motivo:
        "WHATSAPP_NO_AGOTO_TRES_INTENTOS",
    };
  }


  // ====================================================
  // 2. VALIDAR USUARIO ASOCIADO
  // ====================================================

  if (
    !datos.usuario_destinatario_id
  ) {

    return {
      accion:
        "RESPALDO_NO_ENVIADO",

      motivo:
        "ENVIO_SIN_USUARIO_DESTINATARIO",
    };
  }


  // ====================================================
  // 3. VALIDAR ESTADO DEL USUARIO
  // ====================================================

  const estadoUsuario =
    String(
      datos.estado_usuario ??
      ""
    )
      .trim()
      .toLowerCase();


  if (
    estadoUsuario !==
    "activo"
  ) {

    return {
      accion:
        "RESPALDO_NO_ENVIADO",

      motivo:
        "DESTINATARIO_INACTIVO",
    };
  }


  // ====================================================
  // 4. VALIDAR CORREO
  // ====================================================

  const correo =
    String(
      datos.correo_destinatario ??
      ""
    ).trim();


  if (!correo) {

    return {
      accion:
        "RESPALDO_NO_ENVIADO",

      motivo:
        "DESTINATARIO_SIN_CORREO",
    };
  }


  // ====================================================
  // 5. CREAR REGISTRO EMAIL
  // ====================================================

  const resultadoCreacion =
    await crearEmailPendiente(
      datos
    );


  const envioEmail =
    resultadoCreacion
      .envio;


  if (!envioEmail) {

    return {
      accion:
        "RESPALDO_NO_ENVIADO",

      motivo:
        resultadoCreacion
          .motivo,
    };
  }


  // ====================================================
  // 6. EVITAR REENVÍO
  // ====================================================
  //
  // Si EMAIL ya fue:
  //
  // ACEPTADO
  // FALLIDO
  //
  // no volvemos a enviarlo.
  // ====================================================

  if (
    envioEmail.estado !==
    ESTADO_PENDIENTE
  ) {

    return {
      accion:
        "RESPALDO_YA_PROCESADO",

      envio:
        envioEmail,
    };
  }


  // ====================================================
  // 7. LEER CONTENIDO
  // ====================================================

  let contenido;


  try {

    contenido =
      JSON.parse(
        envioEmail
          .contenido_enviado
      );

  } catch (
    error
  ) {

    await marcarEmailFallido(
      envioEmail.id,
      new Error(
        "EMAIL_CONTENIDO_INVALIDO"
      )
    );


    return {
      accion:
        "RESPALDO_EMAIL_FALLIDO",

      error:
        "EMAIL_CONTENIDO_INVALIDO",
    };
  }


  const asunto =
    String(
      contenido
        ?.asunto ??
      ""
    ).trim();


  const html =
    String(
      contenido
        ?.html ??
      ""
    ).trim();


  if (
    !asunto ||
    !html
  ) {

    const error =
      new Error(
        "EMAIL_CONTENIDO_INVALIDO"
      );


    const envioFallido =
      await marcarEmailFallido(
        envioEmail.id,
        error
      );


    return {
      accion:
        "RESPALDO_EMAIL_FALLIDO",

      envio:
        envioFallido,

      error:
        error.message,
    };
  }


  // ====================================================
  // 8. ENVIAR CON SENDGRID
  // ====================================================

  try {

    await enviarCorreo(
      correo,
      asunto,
      html
    );


    // ==================================================
    // EMAIL ACEPTADO
    // ==================================================

    const envioAceptado =
      await marcarEmailAceptado(
        envioEmail.id
      );


    return {
      accion:
        "RESPALDO_EMAIL_ENVIADO",

      envio:
        envioAceptado,
    };


  } catch (
    error
  ) {

    // ==================================================
    // EMAIL FALLIDO
    // ==================================================

    const envioFallido =
      await marcarEmailFallido(
        envioEmail.id,
        error
      );


    return {
      accion:
        "RESPALDO_EMAIL_FALLIDO",

      envio:
        envioFallido,

      error:
        error.message,
    };
  }
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  enviarRespaldoEmail,

};