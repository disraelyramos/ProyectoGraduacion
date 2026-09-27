const pool = require(
  "../../../config/db"
);


const AlertaEnviosService = require(
  "./AlertaEnvios.service"
);


// ======================================================
// CONFIGURACIÓN
// ======================================================

const GRACIA_POST_RECOLECCION_MS =
  Number.isFinite(
    Number(
      process.env
        .ALERTA_POST_RECOLECCION_GRACE_MS
    )
  ) &&
  Number(
    process.env
      .ALERTA_POST_RECOLECCION_GRACE_MS
  ) >= 0

    ? Number(
        process.env
          .ALERTA_POST_RECOLECCION_GRACE_MS
      )

    : 30000;


// ======================================================
// CONSTANTES
// ======================================================

const TIPO_ALERTA = {
  NIVEL_AVISO:
    "NIVEL_AVISO",

  NIVEL_ALTO:
    "NIVEL_ALTO",
};


const ESTADO_ALERTA = {
  ACTIVA:
    "ACTIVA",
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
// OBTENER CONFIGURACIÓN
// ======================================================

async function obtenerConfiguracion(
  client
) {

  const { rows } =
    await client.query(
      `
        SELECT
          id,
          primer_aviso_pct,
          segundo_aviso_pct,
          activa

        FROM configuracion_alertas

        WHERE id = 1

        LIMIT 1
      `
    );


  return rows[0] || null;
}


// ======================================================
// ASEGURAR ESTADO DEL CONTENEDOR
// ======================================================
//
// Si en el futuro se registra un contenedor nuevo,
// esta función evita depender de un INSERT manual.
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
// OBTENER Y BLOQUEAR ESTADO
// ======================================================
//
// FOR UPDATE evita que dos evaluaciones del mismo
// contenedor creen la misma alerta simultáneamente.
//
// También calculamos dentro de PostgreSQL cuánto tiempo
// ha pasado desde fecha_reinicio.
//
// Esto evita depender del reloj del servidor Node.
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
          primer_aviso_emitido,
          segundo_aviso_emitido,
          fecha_primer_aviso,
          fecha_segundo_aviso,
          ultima_recoleccion_id,
          fecha_reinicio,
          fecha_actualizacion,

          CASE
            WHEN ultima_recoleccion_id IS NOT NULL
             AND fecha_reinicio IS NOT NULL
            THEN GREATEST(
              0,
              EXTRACT(
                EPOCH FROM (
                  CURRENT_TIMESTAMP -
                  fecha_reinicio
                )
              ) * 1000
            )
            ELSE NULL
          END AS ms_desde_reinicio

        FROM estado_alertas_contenedor

        WHERE contenedor_id = $1

        FOR UPDATE
      `,
      [
        contenedorId,
      ]
    );


  return rows[0] || null;
}


// ======================================================
// VERIFICAR GRACIA POST RECOLECCIÓN
// ======================================================

function estaEnGraciaPostRecoleccion(
  estado
) {

  if (!estado) {

    return false;
  }


  const ultimaRecoleccionId =
    toInt(
      estado
        .ultima_recoleccion_id
    );


  const msDesdeReinicio =
    toNumber(
      estado
        .ms_desde_reinicio
    );


  if (
    !ultimaRecoleccionId ||
    msDesdeReinicio === null
  ) {

    return false;
  }


  return (
    msDesdeReinicio <
    GRACIA_POST_RECOLECCION_MS
  );
}


// ======================================================
// OBTENER DATOS DEL CONTENEDOR
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
          tr.nombre AS tipo_residuo

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


  return rows[0] || null;
}


// ======================================================
// CREAR ALERTA DE NIVEL
// ======================================================

async function crearAlertaNivel(
  client,
  {
    tipo,
    contenedorId,
    porcentaje,
    umbral,
    mensaje,
  }
) {

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
          NULL,
          $3,
          $4,

          NULL,
          NULL,
          0,

          $5,
          $6,
          NULL,

          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )

        RETURNING
          id,
          tipo,
          contenedor_id,
          nivel_porcentaje,
          umbral_configurado,
          mensaje,
          estado,
          fecha_creacion,
          fecha_activacion
      `,
      [
        tipo,

        contenedorId,

        redondear2(
          porcentaje
        ),

        redondear2(
          umbral
        ),

        mensaje,

        ESTADO_ALERTA
          .ACTIVA,
      ]
    );


  return rows[0];
}


// ======================================================
// CREAR TRAZABILIDAD DEL ENVÍO WHATSAPP
// ======================================================
//
// IMPORTANTE:
//
// Todavía NO se envía nada a Meta.
//
// Únicamente se crea:
//
// alertas_envios
// canal = WHATSAPP
// intento = 1
// estado = PENDIENTE
//
// Si no existe destinatario con WhatsApp configurado,
// AlertaEnvios.service devuelve:
//
// SIN_DESTINATARIO_WHATSAPP
//
// y la alerta principal se conserva.
// ======================================================

async function crearEnvioWhatsAppInicial(
  client,
  alerta
) {

  if (
    !alerta ||
    !alerta.id
  ) {

    throw new Error(
      "No existe una alerta válida para crear el envío de WhatsApp."
    );
  }


  const resultado =
    await AlertaEnviosService
      .crearEnvioWhatsAppPendiente(
        client,
        {
          alertaId:
            alerta.id,

          mensaje:
            alerta.mensaje,

          secuenciaNotificacion:
            1,

          intento:
            1,
        }
      );


  return resultado;
}


// ======================================================
// MARCAR PRIMER AVISO
// ======================================================

async function marcarPrimerAviso(
  client,
  contenedorId
) {

  await client.query(
    `
      UPDATE estado_alertas_contenedor

      SET
        primer_aviso_emitido = TRUE,

        fecha_primer_aviso =
          CURRENT_TIMESTAMP,

        fecha_actualizacion =
          CURRENT_TIMESTAMP

      WHERE contenedor_id = $1
    `,
    [
      contenedorId,
    ]
  );
}


// ======================================================
// MARCAR SEGUNDO AVISO
// ======================================================
//
// Si el nivel saltó directamente al segundo umbral,
// también marcamos el primero como procesado.
//
// Ejemplo:
//
// 45 % -> 75 %
//
// Solo se genera NIVEL_ALTO.
// ======================================================

async function marcarSegundoAviso(
  client,
  contenedorId,
  primerAvisoYaEmitido
) {

  await client.query(
    `
      UPDATE estado_alertas_contenedor

      SET
        primer_aviso_emitido =
          TRUE,

        segundo_aviso_emitido =
          TRUE,

        fecha_primer_aviso =
          CASE
            WHEN $2::boolean = TRUE
              THEN fecha_primer_aviso
            ELSE CURRENT_TIMESTAMP
          END,

        fecha_segundo_aviso =
          CURRENT_TIMESTAMP,

        fecha_actualizacion =
          CURRENT_TIMESTAMP

      WHERE contenedor_id = $1
    `,
    [
      contenedorId,

      Boolean(
        primerAvisoYaEmitido
      ),
    ]
  );
}


// ======================================================
// EVALUAR NIVEL
// ======================================================

async function evaluarNivel({
  contenedorId,
  porcentaje,
}) {

  const contenedorIdNumero =
    toInt(
      contenedorId
    );


  const porcentajeNumero =
    toNumber(
      porcentaje
    );


  if (!contenedorIdNumero) {

    throw new Error(
      "Contenedor inválido al evaluar alertas de nivel."
    );
  }


  if (
    porcentajeNumero === null ||
    porcentajeNumero < 0 ||
    porcentajeNumero > 100
  ) {

    throw new Error(
      "Porcentaje inválido al evaluar alertas de nivel."
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


    // ==================================================
    // CONFIGURACIÓN
    // ==================================================

    const configuracion =
      await obtenerConfiguracion(
        client
      );


    if (!configuracion) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "SIN_CONFIGURACION",

        alerta:
          null,

        envio_whatsapp:
          null,
      };
    }


    if (
      configuracion.activa !==
      true
    ) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "CONFIGURACION_INACTIVA",

        alerta:
          null,

        envio_whatsapp:
          null,
      };
    }


    const primerUmbral =
      toNumber(
        configuracion
          .primer_aviso_pct
      );


    const segundoUmbral =
      toNumber(
        configuracion
          .segundo_aviso_pct
      );


    if (
      primerUmbral === null ||
      segundoUmbral === null ||
      primerUmbral < 0 ||
      segundoUmbral > 100 ||
      primerUmbral >=
        segundoUmbral
    ) {

      throw new Error(
        "La configuración de alertas contiene umbrales inválidos."
      );
    }


    // ==================================================
    // ESTADO DEL CONTENEDOR
    // ==================================================

    await asegurarEstadoContenedor(
      client,
      contenedorIdNumero
    );


    const estado =
      await obtenerEstadoContenedor(
        client,
        contenedorIdNumero
      );


    if (!estado) {

      throw new Error(
        "No fue posible obtener el estado de alertas del contenedor."
      );
    }


    // ==================================================
    // GRACIA POST RECOLECCIÓN
    // ==================================================

    if (
      estaEnGraciaPostRecoleccion(
        estado
      )
    ) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "GRACIA_POST_RECOLECCION",

        alerta:
          null,

        envio_whatsapp:
          null,

        ms_desde_reinicio:
          toNumber(
            estado
              .ms_desde_reinicio
          ),

        gracia_ms:
          GRACIA_POST_RECOLECCION_MS,
      };
    }


    // ==================================================
    // CONTENEDOR
    // ==================================================

    const contenedor =
      await obtenerContenedor(
        client,
        contenedorIdNumero
      );


    if (!contenedor) {

      throw new Error(
        "No existe el contenedor evaluado."
      );
    }


    // ==================================================
    // PRIORIDAD 1:
    // SEGUNDO UMBRAL
    // ==================================================
    //
    // Ejemplo:
    //
    // 45 % -> 75 %
    //
    // Solo NIVEL_ALTO.
    // ==================================================

    if (
      porcentajeNumero >=
        segundoUmbral
    ) {

      if (
        estado
          .segundo_aviso_emitido ===
        true
      ) {

        await client.query(
          "COMMIT"
        );


        transaccionActiva =
          false;


        return {
          accion:
            "SEGUNDO_AVISO_YA_EMITIDO",

          alerta:
            null,

          envio_whatsapp:
            null,
        };
      }


      const mensaje =
        `El contenedor ${contenedor.codigo} (${contenedor.tipo_residuo}) alcanzó un nivel alto de ${redondear2(
          porcentajeNumero
        )}%. El umbral configurado es ${redondear2(
          segundoUmbral
        )}%.`;


      // ================================================
      // 1. CREAR ALERTA PRINCIPAL
      // ================================================

      const alerta =
        await crearAlertaNivel(
          client,
          {
            tipo:
              TIPO_ALERTA
                .NIVEL_ALTO,

            contenedorId:
              contenedorIdNumero,

            porcentaje:
              porcentajeNumero,

            umbral:
              segundoUmbral,

            mensaje,
          }
        );


      // ================================================
      // 2. CREAR ENVÍO WHATSAPP PENDIENTE
      // ================================================
      //
      // Todavía NO llama a Meta.
      // ================================================

      const envioWhatsApp =
        await crearEnvioWhatsAppInicial(
          client,
          alerta
        );


      // ================================================
      // 3. MARCAR SEGUNDO AVISO
      // ================================================

      await marcarSegundoAviso(
        client,
        contenedorIdNumero,

        estado
          .primer_aviso_emitido ===
          true
      );


      // ================================================
      // 4. COMMIT
      // ================================================

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "NIVEL_ALTO_CREADO",

        alerta,

        envio_whatsapp:
          envioWhatsApp,
      };
    }


    // ==================================================
    // PRIORIDAD 2:
    // PRIMER UMBRAL
    // ==================================================

    if (
      porcentajeNumero >=
        primerUmbral
    ) {

      if (
        estado
          .primer_aviso_emitido ===
        true
      ) {

        await client.query(
          "COMMIT"
        );


        transaccionActiva =
          false;


        return {
          accion:
            "PRIMER_AVISO_YA_EMITIDO",

          alerta:
            null,

          envio_whatsapp:
            null,
        };
      }


      const mensaje =
        `El contenedor ${contenedor.codigo} (${contenedor.tipo_residuo}) alcanzó el nivel de aviso de ${redondear2(
          porcentajeNumero
        )}%. El umbral configurado es ${redondear2(
          primerUmbral
        )}%.`;


      // ================================================
      // 1. CREAR ALERTA PRINCIPAL
      // ================================================

      const alerta =
        await crearAlertaNivel(
          client,
          {
            tipo:
              TIPO_ALERTA
                .NIVEL_AVISO,

            contenedorId:
              contenedorIdNumero,

            porcentaje:
              porcentajeNumero,

            umbral:
              primerUmbral,

            mensaje,
          }
        );


      // ================================================
      // 2. CREAR ENVÍO WHATSAPP PENDIENTE
      // ================================================

      const envioWhatsApp =
        await crearEnvioWhatsAppInicial(
          client,
          alerta
        );


      // ================================================
      // 3. MARCAR PRIMER AVISO
      // ================================================

      await marcarPrimerAviso(
        client,
        contenedorIdNumero
      );


      // ================================================
      // 4. COMMIT
      // ================================================

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        accion:
          "NIVEL_AVISO_CREADO",

        alerta,

        envio_whatsapp:
          envioWhatsApp,
      };
    }


    // ==================================================
    // NIVEL POR DEBAJO DE LOS UMBRALES
    // ==================================================

    await client.query(
      "COMMIT"
    );


    transaccionActiva =
      false;


    return {
      accion:
        "SIN_ALERTA",

      alerta:
        null,

      envio_whatsapp:
        null,
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
          "Error haciendo rollback de alerta de nivel:",
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
// EXPORTACIONES
// ======================================================

module.exports = {

  evaluarNivel,
};