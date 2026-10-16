const pool = require(
  "../../../config/db"
);


// ======================================================
// CONSTANTES
// ======================================================

const MAX_INTENTOS_WHATSAPP =
  3;


const ESTADOS = {
  PENDIENTE:
    "PENDIENTE",

  ACEPTADO:
    "ACEPTADO",

  FALLIDO:
    "FALLIDO",
};


// ======================================================
// CONFIGURACIÓN DE REINTENTOS
// ======================================================
//
// REGLA FUNCIONAL:
//
// intento 1
//   ↓ falla
// intento 2
//   ↓ falla
// intento 3
//   ↓ falla
// correo de respaldo
//
// El correo NO se envía desde este archivo.
//
// Este servicio únicamente indicará:
//
// requiereEvaluarRespaldoEmail: true
//
// después de que fallen los 3 intentos.
//
// Los tiempos entre intentos se controlan por .env.
//
// WHATSAPP_REINTENTO_2_MIN=1
// WHATSAPP_REINTENTO_3_MIN=5
// ======================================================

function obtenerMinutos(
  variable,
  valorDefecto
) {

  const valor =
    Number(
      process.env[
        variable
      ]
    );


  return (
    Number.isSafeInteger(
      valor
    ) &&
    valor > 0 &&
    valor <= 1440
  )
    ? valor
    : valorDefecto;
}


// ======================================================
// OBTENER ESPERA DEL SIGUIENTE INTENTO
// ======================================================

function obtenerEsperaReintento(
  siguienteIntento
) {

  if (
    siguienteIntento === 2
  ) {

    return obtenerMinutos(
      "WHATSAPP_REINTENTO_2_MIN",
      1
    );
  }


  if (
    siguienteIntento === 3
  ) {

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

  const id =
    String(
      valor ??
      ""
    ).trim();


  if (
    !/^[1-9]\d*$/.test(
      id
    )
  ) {

    throw new Error(
      "Identificador de envío inválido."
    );
  }


  return id;
}


// ======================================================
// VALIDAR INTENTO
// ======================================================

function validarIntento(
  valor
) {

  const intento =
    Number(
      valor
    );


  if (
    !Number.isSafeInteger(
      intento
    ) ||
    intento < 1 ||
    intento >
      MAX_INTENTOS_WHATSAPP
  ) {

    throw new Error(
      "El intento de WhatsApp registrado no es válido."
    );
  }


  return intento;
}


// ======================================================
// EJECUTAR TRANSACCIÓN SOBRE UN ENVÍO
// ======================================================
//
// FOR UPDATE:
//
// evita que dos procesos modifiquen simultáneamente
// el resultado del mismo intento.
//
// Únicamente se modifica un registro PENDIENTE.
// ======================================================

async function procesarResultado(
  envioId,
  operacion
) {

  const id =
    validarId(
      envioId
    );


  if (
    typeof operacion !==
    "function"
  ) {

    throw new Error(
      "La operación de procesamiento no es válida."
    );
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


    const { rows } =
      await client.query(
        `
          SELECT
            *

          FROM alertas_envios

          WHERE id = $1

          FOR UPDATE
        `,
        [
          id,
        ]
      );


    if (
      !rows.length
    ) {

      throw new Error(
        "El envío indicado no existe."
      );
    }


    const envio =
      rows[0];


    if (
      envio.canal !==
      "WHATSAPP"
    ) {

      throw new Error(
        "El envío no corresponde al canal WhatsApp."
      );
    }


    if (
      envio.estado !==
      ESTADOS.PENDIENTE
    ) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "SIN_CAMBIOS",

        motivo:
          "ENVIO_YA_PROCESADO",

        envio,
      };
    }


    validarIntento(
      envio.intento
    );


    const resultado =
      await operacion(
        client,
        envio
      );


    await client.query(
      "COMMIT"
    );


    transaccionActiva =
      false;


    return resultado;


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
          "Error revirtiendo resultado de envío:",
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
// REGISTRAR ACEPTACIÓN DE META
// ======================================================
//
// Meta aceptó la solicitud y devolvió un message ID.
//
// IMPORTANTE:
//
// ACEPTADO significa:
//
// Meta recibió la solicitud.
//
// No necesariamente:
//
// - entregado;
// - leído.
//
// Esos estados se manejarán posteriormente mediante
// webhook.
// ======================================================

async function registrarAceptacionMeta({
  envioId,
  proveedorMensajeId,
}) {

  const mensajeId =
    String(
      proveedorMensajeId ??
      ""
    ).trim();


  if (
    !mensajeId
  ) {

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

              proveedor_mensaje_id =
                $3,

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
              estado,
              proveedor_mensaje_id,
              fecha_intento,
              fecha_actualizacion
          `,
          [
            envio.id,

            ESTADOS.ACEPTADO,

            mensajeId,
          ]
        );


      return {
        accion:
          "META_ACEPTO_ENVIO",

        envio:
          rows[0],

        requiereEvaluarRespaldoEmail:
          false,
      };
    }
  );
}


// ======================================================
// REGISTRAR FALLO DE META
// ======================================================
//
// IMPORTANTE:
//
// errorReintentable:
//
// Se conserva en BD únicamente como información
// técnica proveniente de Meta.
//
// NO decide si se hará el intento 2 o 3.
//
// REGLA FUNCIONAL:
//
// Mientras intento < 3:
//
// crear siguiente intento.
//
// Cuando intento = 3 y vuelve a fallar:
//
// requiereEvaluarRespaldoEmail = true
//
// El correo todavía NO se envía aquí.
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
      "Debe indicarse si el error permite reintento técnicamente."
    );
  }


  const codigo =
    String(
      codigoError ??
      "ERROR_ENVIO"
    )
      .trim()
      .slice(
        0,
        100
      ) ||
    "ERROR_ENVIO";


  const detalle =
    String(
      detalleError ??
      "Fallo al enviar el mensaje."
    ).trim() ||
    "Fallo al enviar el mensaje.";


  return procesarResultado(
    envioId,

    async (
      client,
      envio
    ) => {

      const intentoActual =
        validarIntento(
          envio.intento
        );


      // ==================================================
      // 1. MARCAR INTENTO ACTUAL COMO FALLIDO
      // ==================================================

      const {
        rows,
      } =
        await client.query(
          `
            UPDATE alertas_envios

            SET
              estado = $2,

              codigo_error = $3,

              detalle_error = $4,

              error_reintentable =
                $5,

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

              plantilla_meta,
              contenido_enviado,

              codigo_error,
              detalle_error,
              error_reintentable,

              fecha_intento,
              fecha_actualizacion
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
      // 2. VERIFICAR SI YA FALLARON LOS 3 INTENTOS
      // ==================================================

      if (
        intentoActual >=
        MAX_INTENTOS_WHATSAPP
      ) {

        return {
          accion:
            "FALLO_SIN_REINTENTO",

          motivo:
            "MAX_INTENTOS_WHATSAPP_ALCANZADO",

          envio:
            envioFallido,

          intentosAgotados:
            true,

          requiereEvaluarRespaldoEmail:
            true,
        };
      }


      // ==================================================
      // 3. CREAR SIGUIENTE INTENTO
      // ==================================================

      const siguienteIntento =
        intentoActual + 1;


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
              'WHATSAPP',
              $3,

              $4,
              $5,

              'PENDIENTE',

              $6,
              $7,

              NULL,

              NULL,
              NULL,
              NULL,

              CURRENT_TIMESTAMP
                + (
                    $8::integer *
                    INTERVAL '1 minute'
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

              fecha_programada_intento,
              fecha_actualizacion
          `,
          [
            envio.alerta_id,

            envio
              .secuencia_notificacion,

            siguienteIntento,

            envio
              .usuario_destinatario_id,

            envio.destinatario,

            envio
              .plantilla_meta,

            envio
              .contenido_enviado,

            esperaMinutos,
          ]
        );


      // ==================================================
      // 4. REINTENTO CREADO
      // ==================================================

      if (
        reintento.rows.length >
        0
      ) {

        return {
          accion:
            "REINTENTO_PROGRAMADO",

          envioFallido,

          siguienteEnvio:
            reintento.rows[0],

          siguienteIntento,

          esperaMinutos,

          intentosAgotados:
            false,

          requiereEvaluarRespaldoEmail:
            false,
        };
      }


      // ==================================================
      // 5. REINTENTO YA EXISTÍA
      // ==================================================
      //
      // No generamos duplicados.
      //
      // Recuperamos el registro existente.
      // ==================================================

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

              fecha_programada_intento,
              fecha_actualizacion

            FROM alertas_envios

            WHERE alerta_id = $1

              AND secuencia_notificacion =
                  $2

              AND canal =
                  'WHATSAPP'

              AND intento =
                  $3

            LIMIT 1
          `,
          [
            envio.alerta_id,

            envio
              .secuencia_notificacion,

            siguienteIntento,
          ]
        );


      if (
        !existentes.length
      ) {

        throw new Error(
          "No fue posible crear ni recuperar el siguiente intento de WhatsApp."
        );
      }


      return {
        accion:
          "REINTENTO_YA_EXISTE",

        envioFallido,

        siguienteEnvio:
          existentes[0],

        siguienteIntento,

        esperaMinutos,

        intentosAgotados:
          false,

        requiereEvaluarRespaldoEmail:
          false,
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