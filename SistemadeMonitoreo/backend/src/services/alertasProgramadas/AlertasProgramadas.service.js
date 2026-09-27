const pool = require(
  "../../config/db"
);


// ======================================================
// CONFIGURACIÓN
// ======================================================

const ZONA_HORARIA =
  "America/Guatemala";

const LONGITUD_MAXIMA_MOTIVO =
  500;


// ======================================================
// ERROR CONTROLADO
// ======================================================

class AlertaProgramadaError extends Error {

  constructor(
    statusCode,
    message,
    codigo
  ) {

    super(message);

    this.statusCode = statusCode;

    this.codigo = codigo;
  }

}


// ======================================================
// VALIDAR MOTIVO
// ======================================================

function validarMotivo(valor) {

  if (
    typeof valor !== "string" ||
    !valor.trim()
  ) {

    throw new AlertaProgramadaError(
      400,
      "Debe ingresar el motivo del recordatorio.",
      "MOTIVO_REQUERIDO"
    );
  }


  const motivo = valor.trim();


  if (
    motivo.length >
    LONGITUD_MAXIMA_MOTIVO
  ) {

    throw new AlertaProgramadaError(
      400,
      "El motivo no puede superar los 500 caracteres.",
      "MOTIVO_DEMASIADO_LARGO"
    );
  }


  return motivo;

}


// ======================================================
// VALIDAR FECHA
// ======================================================

function validarFecha(valor) {

  if (
    typeof valor !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(valor)
  ) {

    throw new AlertaProgramadaError(
      400,
      "Debe seleccionar una fecha válida.",
      "FECHA_INVALIDA"
    );
  }


  const fecha = new Date(
    `${valor}T00:00:00.000Z`
  );


  if (
    Number.isNaN(fecha.getTime()) ||
    fecha.toISOString().slice(0, 10) !==
      valor
  ) {

    throw new AlertaProgramadaError(
      400,
      "La fecha seleccionada no existe.",
      "FECHA_INVALIDA"
    );
  }


  return valor;

}


// ======================================================
// VALIDAR HORA
// ======================================================

function validarHora(valor) {

  if (
    typeof valor !== "string" ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      valor
    )
  ) {

    throw new AlertaProgramadaError(
      400,
      "Debe seleccionar una hora válida.",
      "HORA_INVALIDA"
    );
  }


  return valor;

}


// ======================================================
// VALIDAR USUARIO
// ======================================================

async function verificarUsuarioAutorizado(
  client,
  usuarioId
) {

  const { rows } = await client.query(
    `
      SELECT
        u.id_usuario

      FROM usuarios u

      JOIN roles r
        ON r.id = u.rol_id

      JOIN estados_usuario eu
        ON eu.id = u.estado_id

      WHERE u.id_usuario = $1

        AND LOWER(
          TRIM(eu.nombre)
        ) = 'activo'

        AND LOWER(
          TRIM(r.nombre)
        ) IN (
          'administrador',
          'inspector'
        )

      LIMIT 1
    `,
    [
      usuarioId,
    ]
  );


  if (!rows.length) {

    throw new AlertaProgramadaError(
      403,
      "No tiene permisos para programar alertas.",
      "ACCESO_DENEGADO"
    );
  }

}


// ======================================================
// CREAR ALERTA PROGRAMADA
// ======================================================

async function crearAlertaProgramada({
  motivo,
  fecha,
  hora,
  usuarioId,
}) {

  // ====================================================
  // 1. VALIDAR ENTRADAS
  // ====================================================

  const motivoValidado =
    validarMotivo(motivo);

  const fechaValidada =
    validarFecha(fecha);

  const horaValidada =
    validarHora(hora);

  const idUsuario =
    Number(usuarioId);


  if (
    !Number.isSafeInteger(idUsuario) ||
    idUsuario <= 0
  ) {

    throw new AlertaProgramadaError(
      401,
      "Usuario no autenticado.",
      "USUARIO_NO_AUTENTICADO"
    );
  }


  // ====================================================
  // 2. INICIAR TRANSACCIÓN
  // ====================================================

  const client =
    await pool.connect();

  let transaccionActiva =
    false;


  try {

    await client.query(
      "BEGIN"
    );

    transaccionActiva = true;


    // ==================================================
    // 3. VERIFICAR PERMISOS ACTUALES
    // ==================================================

    await verificarUsuarioAutorizado(
      client,
      idUsuario
    );


    // ==================================================
    // 4. INTERPRETAR FECHA Y HORA DE GUATEMALA
    // ==================================================
    //
    // El frontend enviará:
    //
    // fecha: "2026-09-30"
    // hora:  "08:00"
    //
    // PostgreSQL construye el instante real
    // utilizando America/Guatemala.
    //
    // No dependemos de la zona horaria
    // configurada en Railway.
    // ==================================================

    const horarioResult =
      await client.query(
        `
          SELECT

            (
              $1::date +
              $2::time
            ) AT TIME ZONE $3
              AS fecha_programada,

            CURRENT_TIMESTAMP
              AS fecha_actual

        `,
        [
          fechaValidada,
          horaValidada,
          ZONA_HORARIA,
        ]
      );


    const {
      fecha_programada,
      fecha_actual,
    } = horarioResult.rows[0];


    // ==================================================
    // 5. VALIDAR QUE SEA UNA FECHA FUTURA
    // ==================================================

    if (
      new Date(
        fecha_programada
      ).getTime() <=
      new Date(
        fecha_actual
      ).getTime()
    ) {

      throw new AlertaProgramadaError(
        400,
        "La fecha y hora del recordatorio deben ser futuras.",
        "FECHA_HORA_NO_FUTURA"
      );
    }


    // ==================================================
    // 6. CONSTRUIR MENSAJE
    // ==================================================

    const mensaje =
      `Recordatorio programado: ${motivoValidado}`;


    // ==================================================
    // 7. REGISTRAR ALERTA
    // ==================================================
    //
    // Los campos exclusivos de las alertas
    // por nivel permanecen en NULL.
    //
    // PENDIENTE significa que todavía
    // no ha llegado el momento de ejecutarla.
    // ==================================================

    const { rows } = await client.query(
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

          fecha_activacion,
          fecha_resuelta,
          fecha_cierre
        )

        VALUES
        (
          'PROGRAMADA',

          NULL,
          NULL,

          $1,

          NULL,
          NULL,

          $2,
          $2,

          0,

          $3,
          'PENDIENTE',
          $4,

          CURRENT_TIMESTAMP,

          NULL,
          NULL,
          NULL
        )

        RETURNING

          id,
          tipo,

          motivo,

          fecha_programada_original,
          proxima_ejecucion,

          cantidad_posposiciones,

          mensaje,
          estado,
          creado_por,

          fecha_creacion
      `,
      [
        motivoValidado,
        fecha_programada,
        mensaje,
        idUsuario,
      ]
    );


    // ==================================================
    // 8. CONFIRMAR TRANSACCIÓN
    // ==================================================

    await client.query(
      "COMMIT"
    );

    transaccionActiva = false;


    return rows[0];


  } catch (error) {

    if (transaccionActiva) {

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (rollbackError) {

        console.error(
          "Error revirtiendo alerta programada:",
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
  crearAlertaProgramada,
  AlertaProgramadaError,
};