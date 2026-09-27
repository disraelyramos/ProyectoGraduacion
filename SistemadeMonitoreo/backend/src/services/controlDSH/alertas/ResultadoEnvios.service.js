const pool = require(
  "../../../config/db"
);


// ======================================================
// CONSTANTES
// ======================================================

const MAX_INTENTOS_WHATSAPP = 3;

const ESTADOS = {
  PENDIENTE: "PENDIENTE",
  ACEPTADO: "ACEPTADO",
  FALLIDO: "FALLIDO",
};


// ======================================================
// CONFIGURACIÓN DE REINTENTOS
// ======================================================
//
// Los retrasos se cuentan desde el fallo.
//
// Intento 2: 1 minuto después.
// Intento 3: 5 minutos después.
//
// Se pueden modificar mediante .env.
// ======================================================

function obtenerMinutos(
  variable,
  valorDefecto
) {

  const valor = Number(
    process.env[variable]
  );

  return (
    Number.isSafeInteger(valor) &&
    valor > 0 &&
    valor <= 1440
  )
    ? valor
    : valorDefecto;
}


function obtenerEsperaReintento(
  siguienteIntento
) {

  if (siguienteIntento === 2) {

    return obtenerMinutos(
      "WHATSAPP_REINTENTO_2_MIN",
      1
    );

  }

  if (siguienteIntento === 3) {

    return obtenerMinutos(
      "WHATSAPP_REINTENTO_3_MIN",
      5
    );

  }

  throw new Error(
    "Número de reintento inválido."
  );
}


// ======================================================
// VALIDAR ID
// ======================================================

function validarId(
  valor
) {

  const id = String(
    valor ?? ""
  ).trim();

  if (
    !/^[1-9]\d*$/.test(id)
  ) {

    throw new Error(
      "Identificador de envío inválido."
    );

  }

  return id;
}


// ======================================================
// EJECUTAR TRANSACCIÓN SOBRE UN ENVÍO
// ======================================================
//
// FOR UPDATE evita que dos procesos
// registren simultáneamente el resultado
// del mismo intento.
//
// Solo se modifica un envío PENDIENTE.
// ======================================================

async function procesarResultado(
  envioId,
  operacion
) {

  const id = validarId(
    envioId
  );

  const client = await pool.connect();

  try {

    await client.query(
      "BEGIN"
    );

    const { rows } =
      await client.query(
        `
          SELECT
            *

          FROM alertas_envios

          WHERE id = $1

          FOR UPDATE
        `,
        [id]
      );


    if (!rows.length) {

      throw new Error(
        "El envío indicado no existe."
      );

    }


    const envio = rows[0];


    if (
      envio.canal !== "WHATSAPP"
    ) {

      throw new Error(
        "El envío no corresponde al canal WhatsApp."
      );

    }


    if (
      envio.estado !== ESTADOS.PENDIENTE
    ) {

      await client.query(
        "COMMIT"
      );

      return {
        accion: "SIN_CAMBIOS",
        motivo: "ENVIO_YA_PROCESADO",
        envio,
      };

    }


    const resultado =
      await operacion(
        client,
        envio
      );


    await client.query(
      "COMMIT"
    );

    return resultado;


  } catch (error) {

    try {

      await client.query(
        "ROLLBACK"
      );

    } catch (rollbackError) {

      console.error(
        "Error revirtiendo resultado de envío:",
        rollbackError.message
      );

    }

    throw error;


  } finally {

    client.release();

  }

}


// ======================================================
// REGISTRAR ACEPTACIÓN DE META
// ======================================================
//
// Se utilizará únicamente después de que
// Meta responda satisfactoriamente y
// devuelva el identificador del mensaje.
//
// No representa entrega ni lectura.
// ======================================================

async function registrarAceptacionMeta({
  envioId,
  proveedorMensajeId,
}) {

  const mensajeId = String(
    proveedorMensajeId ?? ""
  ).trim();


  if (!mensajeId) {

    throw new Error(
      "Meta no devolvió un identificador de mensaje."
    );

  }


  return procesarResultado(
    envioId,

    async (
      client,
      envio
    ) => {

      const { rows } =
        await client.query(
          `
            UPDATE alertas_envios

            SET
              estado = $2,

              proveedor_mensaje_id = $3,

              fecha_intento =
                CURRENT_TIMESTAMP,

              fecha_actualizacion =
                CURRENT_TIMESTAMP,

              codigo_error = NULL,
              detalle_error = NULL,
              error_reintentable = NULL

            WHERE id = $1

            RETURNING
              id,
              alerta_id,
              canal,
              intento,
              estado,
              proveedor_mensaje_id,
              fecha_intento
          `,
          [
            envio.id,
            ESTADOS.ACEPTADO,
            mensajeId,
          ]
        );


      return {
        accion: "META_ACEPTO_ENVIO",
        envio: rows[0],
      };

    }
  );

}


// ======================================================
// REGISTRAR FALLO DE META
// ======================================================
//
// El error solo se registra después de
// un intento real de comunicación con Meta.
//
// Si corresponde reintentar, se crea
// otro registro PENDIENTE.
//
// El envío fallido conserva su historia.
// ======================================================

async function registrarFalloMeta({
  envioId,
  codigoError,
  detalleError,
  errorReintentable,
}) {

  if (
    typeof errorReintentable !==
    "boolean"
  ) {

    throw new Error(
      "Debe indicarse si el error permite reintento."
    );

  }


  const codigo = String(
    codigoError ?? "ERROR_ENVIO"
  ).trim() || "ERROR_ENVIO";


  const detalle = String(
    detalleError ?? "Fallo al enviar el mensaje."
  ).trim() || "Fallo al enviar el mensaje.";


  return procesarResultado(
    envioId,

    async (
      client,
      envio
    ) => {

      // ==================================================
      // MARCAR INTENTO ACTUAL COMO FALLIDO
      // ==================================================

      const { rows } =
        await client.query(
          `
            UPDATE alertas_envios

            SET
              estado = $2,

              codigo_error = $3,
              detalle_error = $4,
              error_reintentable = $5,

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
              estado,
              error_reintentable
          `,
          [
            envio.id,
            ESTADOS.FALLIDO,
            codigo,
            detalle,
            errorReintentable,
          ]
        );


      const envioFallido =
        rows[0];


      // ==================================================
      // EVALUAR SI CORRESPONDE REINTENTAR
      // ==================================================

      const siguienteIntento =
        Number(envio.intento) + 1;


      if (
        !errorReintentable ||
        siguienteIntento >
          MAX_INTENTOS_WHATSAPP
      ) {

        return {
          accion: "FALLO_SIN_REINTENTO",
          envio: envioFallido,
          requiereEvaluarRespaldoEmail: true,
        };

      }


      // ==================================================
      // PROGRAMAR SIGUIENTE INTENTO
      // ==================================================

      const esperaMinutos =
        obtenerEsperaReintento(
          siguienteIntento
        );


      const reintento =
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

              fecha_programada_intento,
              fecha_actualizacion
            )

            VALUES
            (
              $1,
              $2,
              'WHATSAPP',
              $3,

              $4,
              $5,

              'PENDIENTE',
              $6,
              $7,

              CURRENT_TIMESTAMP
                + ($8::integer * INTERVAL '1 minute'),

              CURRENT_TIMESTAMP
            )

            ON CONFLICT (
              alerta_id,
              secuencia_notificacion,
              canal,
              intento
            )
            DO NOTHING

            RETURNING
              id,
              alerta_id,
              intento,
              estado,
              fecha_programada_intento
          `,
          [
            envio.alerta_id,
            envio.secuencia_notificacion,
            siguienteIntento,

            envio.usuario_destinatario_id,
            envio.destinatario,

            envio.plantilla_meta,
            envio.contenido_enviado,

            esperaMinutos,
          ]
        );


      if (
        !reintento.rows.length
      ) {

        throw new Error(
          "Ya existe un registro para este reintento. Se revirtió la operación para revisar la inconsistencia."
        );

      }


      return {
        accion: "REINTENTO_PROGRAMADO",

        envioFallido,

        siguienteEnvio:
          reintento.rows[0],
      };

    }
  );

}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {

  registrarAceptacionMeta,

  registrarFalloMeta,

};