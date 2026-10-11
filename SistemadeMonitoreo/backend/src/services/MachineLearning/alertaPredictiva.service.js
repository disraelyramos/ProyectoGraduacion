const pool = require(
  "../../config/db"
);

const PrediccionService = require(
  "./prediccion.service"
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
// VALIDAR PREDICCIÓN
// ======================================================

function validarPrediccion(
  prediccion
) {

  if (
    !prediccion ||
    typeof prediccion !== "object" ||
    Array.isArray(prediccion)
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


  /*
   * SIN_DATOS,
   * DATOS_INSUFICIENTES,
   * SIN_NIVEL_ACTUAL,
   * etc.
   *
   * No deben convertirse en alertas.
   */
  if (
    prediccion.estado !== "OK"
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


  if (
    typeof prediccion.riesgo !==
    "string"
  ) {

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

    riesgo:
      prediccion.riesgo,

    prediccion,
  };
}


// ======================================================
// OBTENER CONFIGURACIÓN ACTUAL
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
// Evita que dos ejecuciones simultáneas
// creen dos alertas predictivas iguales.
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


  return rows[0] || null;
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


  return rows[0] || null;
}


// ======================================================
// BUSCAR ALERTA PREDICTIVA DEL CICLO ACTUAL
// ======================================================
//
// Una alerta predictiva por contenedor y
// ciclo de recolección.
//
// Si ya existió una alerta después del último
// reinicio, no se crea otra.
//
// Esto evita:
//
// - duplicados por refrescar;
// - duplicados por tareas automáticas;
// - duplicados por ejecuciones simultáneas.
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
            $3::timestamptz IS NULL

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


  return rows[0] || null;
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
    datos.estado !== "OK"
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
    };
  }


  // ====================================================
  // RIESGO BAJO
  // ====================================================
  //
  // Solo MEDIO y ALTO generan PREDICTIVA.
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
    // CONFIGURACIÓN REAL DE BD
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
        contenedor_id:
          datos.contenedorId,

        accion:
          "SIN_CONFIGURACION",

        alerta:
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
        contenedor_id:
          datos.contenedorId,

        accion:
          "CONFIGURACION_INACTIVA",

        alerta:
          null,
      };
    }


    // ==================================================
    // COMPROBAR QUE EL UMBRAL NO CAMBIÓ
    // ==================================================
    //
    // Python pudo calcular usando 80 % y, justo después,
    // un administrador podría cambiarlo.
    //
    // En ese caso no usamos una predicción obsoleta.
    // ==================================================

    const segundoUmbralActual =
      toNumber(
        configuracion
          .segundo_aviso_pct
      );


    if (
      segundoUmbralActual === null ||
      segundoUmbralActual <= 0 ||
      segundoUmbralActual > 100
    ) {

      throw new Error(
        "El segundo umbral configurado no es válido."
      );
    }


    if (
      Math.abs(
        segundoUmbralActual -
        datos.umbralAlto
      ) > 0.01
    ) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        contenedor_id:
          datos.contenedorId,

        accion:
          "CONFIGURACION_CAMBIO_RECALCULAR",

        alerta:
          null,
      };
    }


    // ==================================================
    // ESTADO Y BLOQUEO
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
        "No fue posible obtener el estado de alertas del contenedor."
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
    // EVITAR DUPLICADOS DEL CICLO
    // ==================================================

    const alertaExistente =
      await obtenerAlertaPredictivaExistente(
        client,
        datos.contenedorId,
        estado.fecha_reinicio
      );


    if (alertaExistente) {

      await client.query(
        "COMMIT"
      );


      transaccionActiva =
        false;


      return {
        contenedor_id:
          datos.contenedorId,

        accion:
          "ALERTA_PREDICTIVA_YA_EXISTE",

        riesgo:
          datos.riesgo,

        alerta:
          alertaExistente,
      };
    }


    // ==================================================
    // MENSAJE
    // ==================================================

    const mensaje =
      `El contenedor ${contenedor.codigo} (${contenedor.tipo_residuo}) presenta riesgo predictivo ${datos.riesgo}. ` +
      `El modelo estima que alcanzará el umbral alto de ${redondear2(
        datos.umbralAlto
      )}% en aproximadamente ${redondear2(
        datos.diasParaAlto
      )} días. ` +
      `Nivel actual: ${redondear2(
        datos.nivelActual
      )}%.`;


    // ==================================================
    // CREAR ALERTA
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
    // COMMIT
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

      alerta,
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


  /*
   * Se procesan secuencialmente.
   *
   * Así evitamos abrir muchas transacciones
   * simultáneamente innecesariamente.
   */
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

};