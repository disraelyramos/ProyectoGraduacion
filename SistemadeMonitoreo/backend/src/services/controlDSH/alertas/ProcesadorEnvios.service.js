const pool = require(
  "../../../config/db"
);


// ======================================================
// CONFIGURACIÓN
// ======================================================

const CANAL_WHATSAPP =
  "WHATSAPP";

const ESTADO_PENDIENTE =
  "PENDIENTE";

const MAX_INTENTOS_WHATSAPP =
  3;

const LIMITE_MAXIMO_CONSULTA =
  100;


// ======================================================
// VALIDAR IDENTIFICADORES
// ======================================================

function validarEnteroPositivo(
  valor,
  nombre
) {

  const numero =
    Number(valor);


  if (
    !Number.isSafeInteger(numero) ||
    numero <= 0
  ) {

    throw new Error(
      `${nombre} inválido.`
    );

  }


  return numero;
}


// ======================================================
// VALIDAR LÍMITE DE CONSULTA
// ======================================================

function validarLimite(
  valor
) {

  const limite =
    validarEnteroPositivo(
      valor,
      "Límite"
    );


  return Math.min(
    limite,
    LIMITE_MAXIMO_CONSULTA
  );
}


// ======================================================
// OBTENER ENVÍOS PENDIENTES
// ======================================================
//
// Esta función solamente CONSULTA.
//
// No reserva registros.
// No cambia estados.
// No llama a Meta.
//
// El bloqueo transaccional se incorporará
// cuando implementemos el envío real.
// ======================================================

async function obtenerEnviosPendientes({
  limite = 20,
} = {}) {

  const limiteValidado =
    validarLimite(
      limite
    );


  const { rows } =
    await pool.query(
      `
        SELECT
          ae.id,
          ae.alerta_id,
          ae.secuencia_notificacion,
          ae.canal,
          ae.intento,

          ae.usuario_destinatario_id,
          ae.destinatario,

          ae.estado,
          ae.plantilla_meta,
          ae.contenido_enviado,

          ae.fecha_programada_intento,
          ae.fecha_intento,

          a.tipo AS tipo_alerta,
          a.motivo AS motivo_alerta

        FROM alertas_envios ae

        JOIN alertas a
          ON a.id = ae.alerta_id

        WHERE ae.canal = $1

          AND ae.estado = $2

          AND ae.fecha_programada_intento
            <= CURRENT_TIMESTAMP

        ORDER BY
          ae.fecha_programada_intento ASC,
          ae.id ASC

        LIMIT $3
      `,
      [
        CANAL_WHATSAPP,
        ESTADO_PENDIENTE,
        limiteValidado,
      ]
    );


  return rows;
}


// ======================================================
// CONSULTAR INTENTOS DE UNA ALERTA
// ======================================================
//
// Permite conocer si ya existe:
//
// - intento 1;
// - intento 2;
// - intento 3.
//
// No modifica ningún registro.
// ======================================================

async function obtenerIntentosWhatsApp({
  alertaId,
  secuenciaNotificacion = 1,
}) {

  const alertaIdValidado =
    validarEnteroPositivo(
      alertaId,
      "Alerta"
    );


  const secuenciaValidada =
    validarEnteroPositivo(
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
          estado,

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

        ORDER BY
          intento ASC,
          id ASC
      `,
      [
        alertaIdValidado,
        secuenciaValidada,
        CANAL_WHATSAPP,
      ]
    );


  return {

    alertaId:
      alertaIdValidado,

    secuenciaNotificacion:
      secuenciaValidada,

    maxIntentos:
      MAX_INTENTOS_WHATSAPP,

    intentosRegistrados:
      rows.length,

    intentos:
      rows,

  };
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  obtenerEnviosPendientes,

  obtenerIntentosWhatsApp,

};