
"use strict";

const crypto = require("crypto");
const xss = require("xss");
const pool = require("../config/db");

const {
  generarPasswordHash,
} = require("./Auth/Password.service");

const {
  enviarCorreo,
} = require("./email.service");

const {
  tieneSesionActiva,
} = require("./Auth/Sesion.service");

// ======================================================
// CONFIGURACIÓN
// ======================================================

const RUTA_ADMINISTRACION =
  "/administracion/nuevo-usuario";

// ======================================================
// ERROR CONTROLADO
// ======================================================

function crearError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

// ======================================================
// NORMALIZAR ID
// ======================================================

function normalizarId(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === "" ||
    typeof valor === "boolean"
  ) {
    return null;
  }

  const id = Number(valor);

  return Number.isSafeInteger(id) && id > 0
    ? id
    : null;
}

// ======================================================
// NORMALIZAR TEXTO
// ======================================================

function normalizarTexto(valor) {
  if (typeof valor !== "string") return "";

  return xss(valor.trim());
}

function normalizarCorreo(valor) {
  return normalizarTexto(valor).toLowerCase();
}

function normalizarUsuario(valor) {
  return normalizarTexto(valor).toLowerCase();
}

// ======================================================
// VALIDAR CORREO
// ======================================================

function correoValido(correo) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
}

// ======================================================
// NORMALIZAR CELULAR WHATSAPP
// ======================================================
//
// FRONTEND:
// 37068088
//
// POSTGRESQL:
// +50237068088
//
// META WHATSAPP:
// 50237068088
//
// El frontend envía exactamente 8 dígitos.
// El backend agrega el prefijo +502.
//
// ======================================================

function normalizarTelefono(valor) {
  if (typeof valor !== "string") {
    return null;
  }

  const numero = valor.trim();

  if (!/^[345]\d{7}$/.test(numero)) {
    return null;
  }

  return `+502${numero}`;
}

// ======================================================
// VALIDAR IDENTIDAD
// ======================================================

function validarIdentidad(valor) {
  const id = normalizarId(valor);

  if (!id) {
    throw crearError(
      401,
      "Usuario no autenticado."
    );
  }

  return id;
}

// ======================================================
// GENERAR CONTRASEÑA TEMPORAL
// ======================================================

function generarPasswordTemporal() {
  const grupos = [
    "ABCDEFGHJKLMNPQRSTUVWXYZ",
    "abcdefghijkmnopqrstuvwxyz",
    "23456789",
    "!@#$%&*",
  ];

  const obtenerCaracter = (caracteres) =>
    caracteres[crypto.randomInt(caracteres.length)];

  const caracteres = grupos.map(obtenerCaracter);
  const todos = grupos.join("");

  while (caracteres.length < 14) {
    caracteres.push(obtenerCaracter(todos));
  }

  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);

    [caracteres[i], caracteres[j]] =
      [caracteres[j], caracteres[i]];
  }

  return caracteres.join("");
}

// ======================================================
// VALIDAR ACCESO A ADMINISTRACIÓN
// ======================================================
//
// Los permisos se consultan en PostgreSQL.
// No se utiliza un rol_id fijo.
//
// ======================================================

async function validarAccesoAdministracion(
  idUsuario,
  db = pool
) {
  const resultado = await db.query(
    `
      SELECT 1

      FROM usuarios u

      INNER JOIN permisos p
        ON p.rol_id = u.rol_id
       AND p.active = TRUE

      INNER JOIN submodulo s
        ON s.id = p.submodulo_id
       AND s.modulo_id = p.modulo_id

      WHERE u.id_usuario = $1
        AND s.ruta = $2

      LIMIT 1
    `,
    [
      idUsuario,
      RUTA_ADMINISTRACION,
    ]
  );

  if (resultado.rows.length === 0) {
    throw crearError(
      403,
      "No tiene permisos para acceder a esta sección."
    );
  }
}

// ======================================================
// VALIDAR CATÁLOGOS
// ======================================================

async function validarCatalogo(
  db,
  tabla,
  id,
  mensaje
) {
  if (
    !["roles", "estados_usuario"].includes(tabla)
  ) {
    throw crearError(
      500,
      "Catálogo no permitido."
    );
  }

  const resultado = await db.query(
    `
      SELECT 1
      FROM ${tabla}
      WHERE id = $1
      LIMIT 1
    `,
    [id]
  );

  if (resultado.rows.length === 0) {
    throw crearError(400, mensaje);
  }
}

// ======================================================
// VALIDAR CORREO Y USUARIO DUPLICADOS
// ======================================================

async function validarDuplicados(
  db,
  correo,
  usuario,
  idExcluir = null
) {
  const correoExiste = await db.query(
    `
      SELECT 1

      FROM usuarios

      WHERE LOWER(correo) = LOWER($1)

        AND (
          $2::integer IS NULL
          OR id_usuario <> $2
        )

      LIMIT 1
    `,
    [
      correo,
      idExcluir,
    ]
  );

  if (correoExiste.rows.length > 0) {
    throw crearError(
      409,
      "Ya existe un usuario registrado con ese correo electrónico."
    );
  }

  const usuarioExiste = await db.query(
    `
      SELECT 1

      FROM usuarios

      WHERE LOWER(usuario) = LOWER($1)

        AND (
          $2::integer IS NULL
          OR id_usuario <> $2
        )

      LIMIT 1
    `,
    [
      usuario,
      idExcluir,
    ]
  );

  if (usuarioExiste.rows.length > 0) {
    throw crearError(
      409,
      "El nombre de usuario ya está en uso."
    );
  }
}

// ======================================================
// CONTROL DE ERRORES DE DUPLICADOS
// ======================================================

function manejarErrorDuplicado(error) {
  if (error?.code !== "23505") {
    throw error;
  }

  const constraint = String(
    error.constraint || ""
  ).toLowerCase();

  if (constraint.includes("correo")) {
    throw crearError(
      409,
      "Ya existe un usuario registrado con ese correo electrónico."
    );
  }

  if (
    constraint.includes("usuario") ||
    constraint.includes("username")
  ) {
    throw crearError(
      409,
      "El nombre de usuario ya está en uso."
    );
  }

  if (
    constraint.includes("telefono") ||
    constraint.includes("whatsapp")
  ) {
    throw crearError(
      409,
      "El número de celular ya está registrado."
    );
  }

  throw crearError(
    409,
    "Ya existe un usuario con la información proporcionada."
  );
}

// ======================================================
// OBTENER CATÁLOGOS
// ======================================================

exports.obtenerCatalogos = async ({
  idUsuario,
}) => {
  const id = validarIdentidad(idUsuario);

  await validarAccesoAdministracion(id);

  const [roles, estados] = await Promise.all([
    pool.query(
      `
        SELECT
          id,
          nombre

        FROM roles

        ORDER BY nombre ASC
      `
    ),

    pool.query(
      `
        SELECT
          id,
          nombre

        FROM estados_usuario

        ORDER BY id ASC
      `
    ),
  ]);

  return {
    roles: roles.rows,
    estadosUsuario: estados.rows,
  };
};

// ======================================================
// OBTENER USUARIOS
// ======================================================

exports.obtenerUsuarios = async ({
  idUsuario,
}) => {
  const id = validarIdentidad(idUsuario);

  await validarAccesoAdministracion(id);

  const resultado = await pool.query(
    `
      SELECT
        u.id_usuario,
        u.nombre,
        u.correo,

        u.telefono_whatsapp AS telefono,

        u.usuario,
        u.fecha_creacion,

        r.id AS rol_id,
        r.nombre AS rol,

        e.id AS estado_id,
        e.nombre AS estado,

        EXISTS (
          SELECT 1
          FROM recolecciones re
          WHERE re.usuario_id = u.id_usuario
        ) AS tiene_procesos

      FROM usuarios u

      INNER JOIN roles r
        ON r.id = u.rol_id

      INNER JOIN estados_usuario e
        ON e.id = u.estado_id

      ORDER BY
        u.nombre ASC,
        u.id_usuario ASC
    `
  );

  const usuarios = await Promise.all(
    resultado.rows.map(async (registro) => {
      const tieneProcesos =
        registro.tiene_procesos === true;

      const sesionActiva =
        await tieneSesionActiva({
          usuarioId: registro.id_usuario,
        });

      const estadoActual = String(
        registro.estado || ""
      ).trim().toLowerCase();

      const puedeCambiarEstado =
        tieneProcesos &&
        (
          estadoActual === "inactivo" ||
          (
            estadoActual === "activo" &&
            !sesionActiva
          )
        );

      return {
        id_usuario: registro.id_usuario,
        nombre: registro.nombre,
        correo: registro.correo,
        telefono: registro.telefono,
        usuario: registro.usuario,

        rol_id: registro.rol_id,
        rol: registro.rol,

        estado_id: registro.estado_id,
        estado: registro.estado,

        fecha_creacion: registro.fecha_creacion,

        tieneProcesos,
        tieneSesionActiva: sesionActiva,

        acciones: {
          puedeEditarCompleto: !tieneProcesos,
          puedeEditarCelular: tieneProcesos,
          puedeCambiarEstado,
          puedeEliminar: !tieneProcesos,
        },
      };
    })
  );

  return {
    usuarios,
  };
};

// ======================================================
// EDITAR USUARIO
// ======================================================

exports.editarUsuario = async ({
  idUsuarioAutenticado,
  idUsuarioObjetivo,
  nombre,
  correo,
  usuario,
  rolId,
  telefono,
}) => {
  const administradorId =
    validarIdentidad(idUsuarioAutenticado);

  const objetivoId =
    normalizarId(idUsuarioObjetivo);

  if (!objetivoId) {
    throw crearError(
      400,
      "El usuario seleccionado no es válido."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await validarAccesoAdministracion(
      administradorId,
      client
    );

    // ==================================================
    // OBTENER USUARIO Y BLOQUEAR REGISTRO
    // ==================================================

    const usuarioResult = await client.query(
      `
        SELECT
          id_usuario,
          nombre,
          correo,
          telefono_whatsapp AS telefono,
          usuario,
          rol_id

        FROM usuarios

        WHERE id_usuario = $1

        FOR UPDATE
      `,
      [objetivoId]
    );

    if (usuarioResult.rows.length === 0) {
      throw crearError(
        404,
        "El usuario no existe."
      );
    }

    // ==================================================
    // VERIFICAR PROCESOS REGISTRADOS
    // ==================================================

    const procesosResult = await client.query(
      `
        SELECT EXISTS (
          SELECT 1

          FROM recolecciones

          WHERE usuario_id = $1
        ) AS tiene_procesos
      `,
      [objetivoId]
    );

    const tieneProcesos =
      procesosResult.rows[0].tiene_procesos === true;

    // ==================================================
    // USUARIO CON PROCESOS: SOLO EDITAR CELULAR
    // ==================================================

    if (tieneProcesos) {
      if (
        nombre !== undefined ||
        correo !== undefined ||
        usuario !== undefined ||
        rolId !== undefined
      ) {
        throw crearError(
          400,
          "Solo se permite actualizar el celular de usuarios con procesos registrados."
        );
      }

      // El frontend envía únicamente 8 dígitos.
      // El backend agrega automáticamente +502.

      const telefonoSeguro =
        normalizarTelefono(telefono);

      if (!telefonoSeguro) {
        throw crearError(
          400,
          "Ingrese un celular guatemalteco válido de 8 dígitos."
        );
      }

      const actualizado = await client.query(
        `
          UPDATE usuarios

          SET telefono_whatsapp = $1

          WHERE id_usuario = $2

          RETURNING
            id_usuario,
            nombre,
            correo,
            telefono_whatsapp AS telefono,
            usuario,
            rol_id,
            estado_id,
            fecha_creacion
        `,
        [
          telefonoSeguro,
          objetivoId,
        ]
      );

      await client.query("COMMIT");

      return {
        message: "Celular actualizado correctamente.",
        usuario: actualizado.rows[0],
      };
    }

    // ==================================================
    // USUARIO SIN PROCESOS: EDICIÓN COMPLETA
    // ==================================================

    const nombreSeguro =
      normalizarTexto(nombre);

    const correoSeguro =
      normalizarCorreo(correo);

    const usuarioSeguro =
      normalizarUsuario(usuario);

    const rolSeguro =
      normalizarId(rolId);

    if (!nombreSeguro) {
      throw crearError(
        400,
        "El nombre completo es obligatorio."
      );
    }

    if (!correoValido(correoSeguro)) {
      throw crearError(
        400,
        "El correo electrónico no es válido."
      );
    }

    if (!usuarioSeguro) {
      throw crearError(
        400,
        "El nombre de usuario es obligatorio."
      );
    }

    if (!rolSeguro) {
      throw crearError(
        400,
        "Debe seleccionar un rol válido."
      );
    }

    // El teléfono es opcional en la edición completa.
    // Si se proporciona, debe contener 8 dígitos.

    const telefonoSeguro =
      telefono === undefined
        ? undefined
        : normalizarTelefono(telefono);

    if (
      telefono !== undefined &&
      !telefonoSeguro
    ) {
      throw crearError(
        400,
        "Ingrese un celular guatemalteco válido de 8 dígitos."
      );
    }

    await validarCatalogo(
      client,
      "roles",
      rolSeguro,
      "El rol seleccionado no es válido."
    );

    await validarDuplicados(
      client,
      correoSeguro,
      usuarioSeguro,
      objetivoId
    );

    // ==================================================
    // ACTUALIZAR USUARIO
    // ==================================================

    const actualizado = await client.query(
      `
        UPDATE usuarios

        SET
          nombre = $1,
          correo = $2,
          usuario = $3,
          rol_id = $4,

          telefono_whatsapp =
            COALESCE($5, telefono_whatsapp)

        WHERE id_usuario = $6

        RETURNING
          id_usuario,
          nombre,
          correo,
          telefono_whatsapp AS telefono,
          usuario,
          rol_id,
          estado_id,
          fecha_creacion
      `,
      [
        nombreSeguro,
        correoSeguro,
        usuarioSeguro,
        rolSeguro,
        telefonoSeguro ?? null,
        objetivoId,
      ]
    );

    await client.query("COMMIT");

    return {
      message: "Usuario actualizado correctamente.",
      usuario: actualizado.rows[0],
    };

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Error al revertir edición:",
        rollbackError.message
      );
    }

    manejarErrorDuplicado(error);

  } finally {
    client.release();
  }
};

// ======================================================
// CAMBIAR ESTADO DE USUARIO
// ======================================================

exports.cambiarEstadoUsuario = async ({
  idUsuarioAutenticado,
  idUsuarioObjetivo,
}) => {
  const administradorId =
    validarIdentidad(idUsuarioAutenticado);

  const objetivoId =
    normalizarId(idUsuarioObjetivo);

  if (!objetivoId) {
    throw crearError(
      400,
      "El usuario seleccionado no es válido."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await validarAccesoAdministracion(
      administradorId,
      client
    );

    // ==================================================
    // OBTENER USUARIO
    // ==================================================

    const usuarioResult = await client.query(
      `
        SELECT
          u.id_usuario,
          u.nombre,
          u.estado_id,
          e.nombre AS estado

        FROM usuarios u

        INNER JOIN estados_usuario e
          ON e.id = u.estado_id

        WHERE u.id_usuario = $1

        FOR UPDATE OF u
      `,
      [objetivoId]
    );

    if (usuarioResult.rows.length === 0) {
      throw crearError(
        404,
        "El usuario no existe."
      );
    }

    // ==================================================
    // VERIFICAR PROCESOS
    // ==================================================

    const procesos = await client.query(
      `
        SELECT EXISTS (
          SELECT 1

          FROM recolecciones

          WHERE usuario_id = $1
        ) AS tiene_procesos
      `,
      [objetivoId]
    );

    if (!procesos.rows[0].tiene_procesos) {
      throw crearError(
        409,
        "El estado de este usuario no puede modificarse mediante esta acción porque no tiene procesos registrados."
      );
    }

    // ==================================================
    // IDENTIFICAR ESTADO ACTUAL
    // ==================================================

    const estadoActual = String(
      usuarioResult.rows[0].estado
    ).trim().toLowerCase();

    let nuevoEstadoNombre;

    if (estadoActual === "activo") {
      const sesionActiva =
        await tieneSesionActiva({
          client,
          usuarioId: objetivoId,
        });

      if (sesionActiva) {
        throw crearError(
          409,
          "No es posible desactivar al usuario porque tiene una sesión activa."
        );
      }

      nuevoEstadoNombre = "Inactivo";

    } else if (estadoActual === "inactivo") {
      nuevoEstadoNombre = "Activo";

    } else {
      throw crearError(
        409,
        "El estado actual no permite realizar esta operación."
      );
    }

    // ==================================================
    // OBTENER ID DEL ESTADO DESDE POSTGRESQL
    // ==================================================

    const estadoDestino = await client.query(
      `
        SELECT
          id,
          nombre

        FROM estados_usuario

        WHERE LOWER(nombre) = LOWER($1)

        LIMIT 1
      `,
      [nuevoEstadoNombre]
    );

    if (estadoDestino.rows.length === 0) {
      throw crearError(
        500,
        `No existe el estado ${nuevoEstadoNombre}.`
      );
    }

    // ==================================================
    // ACTUALIZAR ESTADO
    // ==================================================

    const actualizado = await client.query(
      `
        UPDATE usuarios

        SET estado_id = $1

        WHERE id_usuario = $2

        RETURNING
          id_usuario,
          nombre,
          correo,
          usuario,
          rol_id,
          estado_id,
          fecha_creacion
      `,
      [
        estadoDestino.rows[0].id,
        objetivoId,
      ]
    );

    await client.query("COMMIT");

    return {
      message:
        nuevoEstadoNombre === "Activo"
          ? "Usuario activado correctamente."
          : "Usuario desactivado correctamente.",

      usuario: {
        ...actualizado.rows[0],
        estado: estadoDestino.rows[0].nombre,
      },
    };

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Error al revertir estado:",
        rollbackError.message
      );
    }

    throw error;

  } finally {
    client.release();
  }
};

// ======================================================
// ELIMINAR USUARIO
// ======================================================

exports.eliminarUsuario = async ({
  idUsuarioAutenticado,
  idUsuarioObjetivo,
}) => {
  const administradorId =
    validarIdentidad(idUsuarioAutenticado);

  const objetivoId =
    normalizarId(idUsuarioObjetivo);

  if (!objetivoId) {
    throw crearError(
      400,
      "El usuario seleccionado no es válido."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await validarAccesoAdministracion(
      administradorId,
      client
    );

    // ==================================================
    // BUSCAR USUARIO
    // ==================================================

    const usuario = await client.query(
      `
        SELECT id_usuario

        FROM usuarios

        WHERE id_usuario = $1

        FOR UPDATE
      `,
      [objetivoId]
    );

    if (usuario.rows.length === 0) {
      throw crearError(
        404,
        "El usuario no existe."
      );
    }

    if (administradorId === objetivoId) {
      throw crearError(
        409,
        "No puede eliminar su propio usuario."
      );
    }

    // ==================================================
    // VERIFICAR RECOLECCIONES
    // ==================================================

    const procesos = await client.query(
      `
        SELECT EXISTS (
          SELECT 1

          FROM recolecciones

          WHERE usuario_id = $1
        ) AS tiene_procesos
      `,
      [objetivoId]
    );

    if (procesos.rows[0].tiene_procesos) {
      throw crearError(
        409,
        "No es posible eliminar este usuario porque tiene procesos registrados."
      );
    }

    // ==================================================
    // ELIMINAR
    // ==================================================

    const eliminado = await client.query(
      `
        DELETE FROM usuarios

        WHERE id_usuario = $1

        RETURNING
          id_usuario,
          nombre,
          correo,
          usuario
      `,
      [objetivoId]
    );

    await client.query("COMMIT");

    return {
      message: "Usuario eliminado correctamente.",
      usuario: eliminado.rows[0],
    };

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Error al revertir eliminación:",
        rollbackError.message
      );
    }

    if (error?.code === "23503") {
      throw crearError(
        409,
        "No es posible eliminar este usuario porque tiene información relacionada en el sistema."
      );
    }

    throw error;

  } finally {
    client.release();
  }
};

// ======================================================
// CREAR NUEVO USUARIO
// ======================================================
//
// No solicita número de celular.
// La columna telefono_whatsapp permanece en NULL.
//
// ======================================================

exports.crearUsuario = async ({
  idUsuarioAutenticado,
  nombre,
  correo,
  usuario,
  rolId,
  estadoId,
}) => {
  const administradorId =
    validarIdentidad(idUsuarioAutenticado);

  const nombreSeguro =
    normalizarTexto(nombre);

  const correoSeguro =
    normalizarCorreo(correo);

  const usuarioSeguro =
    normalizarUsuario(usuario);

  const rolSeguro =
    normalizarId(rolId);

  const estadoSeguro =
    normalizarId(estadoId);

  // ====================================================
  // VALIDACIONES
  // ====================================================

  if (!nombreSeguro) {
    throw crearError(
      400,
      "El nombre completo es obligatorio."
    );
  }

  if (!correoValido(correoSeguro)) {
    throw crearError(
      400,
      "El correo electrónico no es válido."
    );
  }

  if (!usuarioSeguro) {
    throw crearError(
      400,
      "El nombre de usuario es obligatorio."
    );
  }

  if (!rolSeguro) {
    throw crearError(
      400,
      "Debe seleccionar un rol válido."
    );
  }

  if (!estadoSeguro) {
    throw crearError(
      400,
      "Debe seleccionar un estado válido."
    );
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // ==================================================
    // VALIDAR PERMISOS
    // ==================================================

    await validarAccesoAdministracion(
      administradorId,
      client
    );

    // ==================================================
    // VALIDAR ROL Y ESTADO
    // ==================================================

    await validarCatalogo(
      client,
      "roles",
      rolSeguro,
      "El rol seleccionado no es válido."
    );

    await validarCatalogo(
      client,
      "estados_usuario",
      estadoSeguro,
      "El estado seleccionado no es válido."
    );

    // ==================================================
    // VALIDAR DUPLICADOS
    // ==================================================

    await validarDuplicados(
      client,
      correoSeguro,
      usuarioSeguro
    );

    // ==================================================
    // GENERAR CONTRASEÑA TEMPORAL
    // ==================================================

    const passwordTemporal =
      generarPasswordTemporal();

    const passwordHash =
      await generarPasswordHash(
        passwordTemporal
      );

    // ==================================================
    // INSERTAR USUARIO SIN TELÉFONO
    // ==================================================

    const nuevoUsuarioResult = await client.query(
      `
        INSERT INTO usuarios (
          nombre,
          correo,
          usuario,
          password_hash,
          rol_id,
          estado_id,
          intentos_fallidos,
          bloqueado_hasta,
          ultimo_login,
          debe_cambiar_password,
          fecha_ultimo_cambio
        )

        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          0,
          NULL,
          NULL,
          TRUE,
          NULL
        )

        RETURNING
          id_usuario,
          nombre,
          correo,
          usuario,
          rol_id,
          estado_id
      `,
      [
        nombreSeguro,
        correoSeguro,
        usuarioSeguro,
        passwordHash,
        rolSeguro,
        estadoSeguro,
      ]
    );

    const nuevoUsuario =
      nuevoUsuarioResult.rows[0];

    // ==================================================
    // PREPARAR CORREO
    // ==================================================

    const asunto =
      "Acceso al Sistema de Monitoreo Bioinfeccioso";

    const html = `
      <div style="
        font-family: Arial, sans-serif;
        max-width: 620px;
        margin: 0 auto;
        color: #24313d;
      ">

        <h2>
          Sistema de Monitoreo Bioinfeccioso
        </h2>

        <p>
          Hola <strong>${nombreSeguro}</strong>,
        </p>

        <p>
          Se ha creado una cuenta para usted
          en el Sistema de Monitoreo Bioinfeccioso.
        </p>

        <p>
          Utilice las siguientes credenciales:
        </p>

        <div style="
          padding: 16px;
          margin: 20px 0;
          background: #f5f7fa;
          border: 1px solid #d9e0e6;
          border-radius: 8px;
        ">

          <p>
            <strong>Usuario:</strong>
            ${usuarioSeguro}
          </p>

          <p>
            <strong>Contraseña temporal:</strong>
            ${passwordTemporal}
          </p>

        </div>

        <p>
          Por seguridad, al iniciar sesión por
          primera vez deberá establecer una
          nueva contraseña.
        </p>

        <p>
          No comparta sus credenciales
          de acceso con otras personas.
        </p>

      </div>
    `;

    // ==================================================
    // ENVIAR CREDENCIALES POR CORREO
    // ==================================================

    try {
      await enviarCorreo(
        correoSeguro,
        asunto,
        html
      );

    } catch (error) {
      throw crearError(
        502,
        "No fue posible enviar el correo de acceso. El usuario no fue creado."
      );
    }

    // ==================================================
    // CONFIRMAR TRANSACCIÓN
    // ==================================================

    await client.query("COMMIT");

    return {
      message:
        "Usuario creado correctamente. Las credenciales temporales fueron enviadas por correo.",

      usuario: nuevoUsuario,
    };

  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      console.error(
        "Error al revertir creación:",
        rollbackError.message
      );
    }

    manejarErrorDuplicado(error);

  } finally {
    client.release();
  }
};
