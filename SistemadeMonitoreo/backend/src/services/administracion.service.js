const crypto = require("crypto");
const xss = require("xss");

const pool = require("../config/db");

const {
  generarPasswordHash,
} = require(
  "./Auth/Password.service"
);

const {
  enviarCorreo,
} = require(
  "./email.service"
);

const {
  tieneSesionActiva,
} = require(
  "./Auth/Sesion.service"
);


// =========================================================
// CONFIGURACIÓN
// =========================================================

const RUTA_ADMINISTRACION =
  "/administracion/nuevo-usuario";


// =========================================================
// ERROR CONTROLADO
// =========================================================

const crearError = (
  status,
  message
) => {
  const error =
    new Error(message);

  error.status =
    status;

  return error;
};


// =========================================================
// NORMALIZAR ID
// =========================================================

const normalizarId = (
  valor
) => {
  const id =
    Number(valor);

  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }

  return id;
};


// =========================================================
// NORMALIZAR TEXTO
// =========================================================

const normalizarTexto = (
  valor
) => {
  if (
    typeof valor !== "string"
  ) {
    return "";
  }

  return xss(
    valor.trim()
  );
};


// =========================================================
// NORMALIZAR CORREO
// =========================================================

const normalizarCorreo = (
  valor
) => {
  return normalizarTexto(
    valor
  ).toLowerCase();
};


// =========================================================
// NORMALIZAR USUARIO
// =========================================================

const normalizarUsuario = (
  valor
) => {
  return normalizarTexto(
    valor
  ).toLowerCase();
};


// =========================================================
// VALIDAR CORREO
// =========================================================

const correoValido = (
  correo
) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    .test(correo);
};


// =========================================================
// GENERAR CONTRASEÑA TEMPORAL
// =========================================================

const generarPasswordTemporal =
  () => {
    /*
     * Se garantiza presencia de:
     * - mayúscula
     * - minúscula
     * - número
     * - carácter especial
     *
     * La parte aleatoria se genera mediante
     * crypto, no Math.random().
     */

    const mayusculas =
      "ABCDEFGHJKLMNPQRSTUVWXYZ";

    const minusculas =
      "abcdefghijkmnopqrstuvwxyz";

    const numeros =
      "23456789";

    const especiales =
      "!@#$%&*";

    const todos =
      mayusculas +
      minusculas +
      numeros +
      especiales;


    const obtenerCaracter =
      (caracteres) => {
        return caracteres[
          crypto.randomInt(
            0,
            caracteres.length
          )
        ];
      };


    const caracteres = [
      obtenerCaracter(
        mayusculas
      ),

      obtenerCaracter(
        minusculas
      ),

      obtenerCaracter(
        numeros
      ),

      obtenerCaracter(
        especiales
      ),
    ];


    while (
      caracteres.length < 14
    ) {
      caracteres.push(
        obtenerCaracter(
          todos
        )
      );
    }


    for (
      let i =
        caracteres.length - 1;

      i > 0;

      i--
    ) {
      const j =
        crypto.randomInt(
          0,
          i + 1
        );

      [
        caracteres[i],
        caracteres[j],
      ] = [
        caracteres[j],
        caracteres[i],
      ];
    }


    return caracteres.join("");
  };


// =========================================================
// VALIDAR ACCESO A ADMINISTRACIÓN
// =========================================================

const validarAccesoAdministracion =
  async (
    idUsuario,
    db = pool
  ) => {
    const result =
      await db.query(
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


    if (
      result.rows.length === 0
    ) {
      throw crearError(
        403,
        "No tiene permisos para acceder a esta sección."
      );
    }
  };


// =========================================================
// OBTENER CATÁLOGOS
// =========================================================

exports.obtenerCatalogos =
  async ({
    idUsuario,
  }) => {
    const id =
      normalizarId(
        idUsuario
      );


    if (!id) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    /*
     * La autorización se consulta nuevamente
     * contra la base de datos.
     *
     * No se utiliza un rol enviado por React.
     */

    await validarAccesoAdministracion(
      id
    );


    const [
      rolesResult,
      estadosResult,
    ] = await Promise.all([
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
      roles:
        rolesResult.rows,

      estadosUsuario:
        estadosResult.rows,
    };
  };


// =========================================================
// OBTENER USUARIOS
// =========================================================

exports.obtenerUsuarios =
  async ({
    idUsuario,
  }) => {

    // =====================================================
    // 1. VALIDAR IDENTIDAD AUTENTICADA
    // =====================================================

    const id =
      normalizarId(
        idUsuario
      );


    if (!id) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    // =====================================================
    // 2. VALIDAR ACCESO REAL EN BASE DE DATOS
    // =====================================================

    /*
     * El frontend no decide:
     *
     * - permisos
     * - rol autorizado
     * - si tiene procesos
     * - acciones disponibles
     *
     * Todo se calcula nuevamente en backend.
     */

    await validarAccesoAdministracion(
      id
    );


    // =====================================================
    // 3. CONSULTAR USUARIOS
    // =====================================================

    const result =
      await pool.query(
        `
          SELECT
            u.id_usuario,
            u.nombre,
            u.correo,
            u.usuario,
            u.fecha_creacion,

            r.id AS rol_id,
            r.nombre AS rol,

            e.id AS estado_id,
            e.nombre AS estado,

            EXISTS (
              SELECT 1

              FROM recolecciones re

              WHERE re.usuario_id =
                u.id_usuario
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


    // =====================================================
    // 4. DEFINIR ACCIONES PERMITIDAS
    // =====================================================

  const usuarios =
  await Promise.all(
    result.rows.map(
      async (
        registro
      ) => {

        const tieneProcesos =
          registro.tiene_procesos ===
          true;


        const sesionActiva =
          await tieneSesionActiva({
            usuarioId:
              registro.id_usuario,
          });


        const estadoActual =
          String(
            registro.estado ||
            ""
          )
            .trim()
            .toLowerCase();


        /*
         * REGLAS
         *
         * SIN PROCESOS:
         * - editar completo
         * - eliminar
         *
         * CON PROCESOS:
         * - editar correo
         *
         * ACTIVO + CON PROCESOS:
         * - puede desactivarse únicamente
         *   si NO tiene sesión activa.
         *
         * INACTIVO + CON PROCESOS:
         * - puede activarse.
         */

        const puedeCambiarEstado =
          tieneProcesos &&
          (
            estadoActual ===
              "inactivo" ||

            (
              estadoActual ===
                "activo" &&
              !sesionActiva
            )
          );


        return {
          id_usuario:
            registro.id_usuario,

          nombre:
            registro.nombre,

          correo:
            registro.correo,

          usuario:
            registro.usuario,

          rol_id:
            registro.rol_id,

          rol:
            registro.rol,

          estado_id:
            registro.estado_id,

          estado:
            registro.estado,

          fecha_creacion:
            registro.fecha_creacion,

          tieneProcesos,

          tieneSesionActiva:
            sesionActiva,

          acciones: {
            puedeEditarCompleto:
              !tieneProcesos,

            puedeEditarCorreo:
              tieneProcesos,

            puedeCambiarEstado,

            puedeEliminar:
              !tieneProcesos,
          },
        };
      }
    )
  );


    // =====================================================
    // 5. RESPUESTA
    // =====================================================

    return {
      usuarios,
    };
  };


  // =========================================================
// EDITAR USUARIO
// =========================================================

exports.editarUsuario =
  async ({
    idUsuarioAutenticado,
    idUsuarioObjetivo,
    nombre,
    correo,
    usuario,
    rolId,
  }) => {

    // =====================================================
    // 1. VALIDAR IDENTIDAD AUTENTICADA
    // =====================================================

    const administradorId =
      normalizarId(
        idUsuarioAutenticado
      );

    const usuarioObjetivoId =
      normalizarId(
        idUsuarioObjetivo
      );


    if (!administradorId) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    if (!usuarioObjetivoId) {
      throw crearError(
        400,
        "El usuario seleccionado no es válido."
      );
    }


    // =====================================================
    // 2. INICIAR TRANSACCIÓN
    // =====================================================

    const client =
      await pool.connect();


    try {

      await client.query(
        "BEGIN"
      );


      // ===================================================
      // 3. VALIDAR PERMISO REAL
      // ===================================================

      await validarAccesoAdministracion(
        administradorId,
        client
      );


      // ===================================================
      // 4. OBTENER USUARIO ACTUAL
      // ===================================================

      const usuarioResult =
        await client.query(
          `
            SELECT
              id_usuario,
              nombre,
              correo,
              usuario,
              rol_id

            FROM usuarios

            WHERE id_usuario = $1

            FOR UPDATE
          `,
          [
            usuarioObjetivoId,
          ]
        );


      if (
        usuarioResult.rows.length === 0
      ) {
        throw crearError(
          404,
          "El usuario no existe."
        );
      }


      // ===================================================
      // 5. COMPROBAR SI TIENE PROCESOS
      // ===================================================

      const procesosResult =
        await client.query(
          `
            SELECT EXISTS (
              SELECT 1

              FROM recolecciones

              WHERE usuario_id = $1
            ) AS tiene_procesos
          `,
          [
            usuarioObjetivoId,
          ]
        );


      const tieneProcesos =
        procesosResult.rows[0]
          ?.tiene_procesos === true;


      // ===================================================
      // 6. REGLA: USUARIO CON PROCESOS
      // ===================================================

      if (tieneProcesos) {

        const correoSeguro =
          normalizarCorreo(
            correo
          );


        if (!correoSeguro) {
          throw crearError(
            400,
            "El correo electrónico es obligatorio."
          );
        }


        if (
          !correoValido(
            correoSeguro
          )
        ) {
          throw crearError(
            400,
            "El formato del correo electrónico no es válido."
          );
        }


        const correoExiste =
          await client.query(
            `
              SELECT 1

              FROM usuarios

              WHERE LOWER(correo) =
                LOWER($1)

                AND id_usuario <> $2

              LIMIT 1
            `,
            [
              correoSeguro,
              usuarioObjetivoId,
            ]
          );


        if (
          correoExiste.rows.length > 0
        ) {
          throw crearError(
            409,
            "Ya existe un usuario registrado con ese correo electrónico."
          );
        }


        const actualizadoResult =
          await client.query(
            `
              UPDATE usuarios

              SET correo = $1

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
              correoSeguro,
              usuarioObjetivoId,
            ]
          );


        await client.query(
          "COMMIT"
        );


        return {
          message:
            "Correo actualizado correctamente.",

          usuario:
            actualizadoResult.rows[0],
        };
      }


      // ===================================================
      // 7. REGLA: USUARIO SIN PROCESOS
      // ===================================================

      const nombreSeguro =
        normalizarTexto(
          nombre
        );

      const correoSeguro =
        normalizarCorreo(
          correo
        );

      const usuarioSeguro =
        normalizarUsuario(
          usuario
        );

      const rolIdSeguro =
        normalizarId(
          rolId
        );


      if (!nombreSeguro) {
        throw crearError(
          400,
          "El nombre completo es obligatorio."
        );
      }


      if (!correoSeguro) {
        throw crearError(
          400,
          "El correo electrónico es obligatorio."
        );
      }


      if (
        !correoValido(
          correoSeguro
        )
      ) {
        throw crearError(
          400,
          "El formato del correo electrónico no es válido."
        );
      }


      if (!usuarioSeguro) {
        throw crearError(
          400,
          "El nombre de usuario es obligatorio."
        );
      }


      if (!rolIdSeguro) {
        throw crearError(
          400,
          "Debe seleccionar un rol válido."
        );
      }


      // ===================================================
      // 8. VALIDAR ROL
      // ===================================================

      const rolResult =
        await client.query(
          `
            SELECT 1

            FROM roles

            WHERE id = $1

            LIMIT 1
          `,
          [
            rolIdSeguro,
          ]
        );


      if (
        rolResult.rows.length === 0
      ) {
        throw crearError(
          400,
          "El rol seleccionado no es válido."
        );
      }


      // ===================================================
      // 9. VALIDAR CORREO DUPLICADO
      // ===================================================

      const correoExiste =
        await client.query(
          `
            SELECT 1

            FROM usuarios

            WHERE LOWER(correo) =
              LOWER($1)

              AND id_usuario <> $2

            LIMIT 1
          `,
          [
            correoSeguro,
            usuarioObjetivoId,
          ]
        );


      if (
        correoExiste.rows.length > 0
      ) {
        throw crearError(
          409,
          "Ya existe un usuario registrado con ese correo electrónico."
        );
      }


      // ===================================================
      // 10. VALIDAR USUARIO DUPLICADO
      // ===================================================

      const nombreUsuarioExiste =
        await client.query(
          `
            SELECT 1

            FROM usuarios

            WHERE LOWER(usuario) =
              LOWER($1)

              AND id_usuario <> $2

            LIMIT 1
          `,
          [
            usuarioSeguro,
            usuarioObjetivoId,
          ]
        );


      if (
        nombreUsuarioExiste.rows.length > 0
      ) {
        throw crearError(
          409,
          "El nombre de usuario ya está en uso."
        );
      }


      // ===================================================
      // 11. ACTUALIZAR
      // ===================================================

      const actualizadoResult =
        await client.query(
          `
            UPDATE usuarios

            SET
              nombre = $1,
              correo = $2,
              usuario = $3,
              rol_id = $4

            WHERE id_usuario = $5

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
            nombreSeguro,
            correoSeguro,
            usuarioSeguro,
            rolIdSeguro,
            usuarioObjetivoId,
          ]
        );


      await client.query(
        "COMMIT"
      );


      return {
        message:
          "Usuario actualizado correctamente.",

        usuario:
          actualizadoResult.rows[0],
      };


    } catch (error) {

      try {
        await client.query(
          "ROLLBACK"
        );
      } catch (
        rollbackError
      ) {
        console.error(
          "Error ejecutando rollback al editar usuario:",
          rollbackError.message
        );
      }


      if (
        error?.code === "23505"
      ) {

        const constraint =
          String(
            error.constraint ||
            ""
          ).toLowerCase();


        if (
          constraint.includes(
            "correo"
          )
        ) {
          throw crearError(
            409,
            "Ya existe un usuario registrado con ese correo electrónico."
          );
        }


        if (
          constraint.includes(
            "usuario"
          )
        ) {
          throw crearError(
            409,
            "El nombre de usuario ya está en uso."
          );
        }
      }


      throw error;


    } finally {

      client.release();
    }
  };

  // =========================================================
// CAMBIAR ESTADO DE USUARIO
// =========================================================
// =========================================================
// CAMBIAR ESTADO DE USUARIO
// =========================================================

exports.cambiarEstadoUsuario =
  async ({
    idUsuarioAutenticado,
    idUsuarioObjetivo,
  }) => {

    // =====================================================
    // 1. VALIDAR IDENTIDADES
    // =====================================================

    const administradorId =
      normalizarId(
        idUsuarioAutenticado
      );

    const usuarioObjetivoId =
      normalizarId(
        idUsuarioObjetivo
      );


    if (!administradorId) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    if (!usuarioObjetivoId) {
      throw crearError(
        400,
        "El usuario seleccionado no es válido."
      );
    }


    // =====================================================
    // 2. INICIAR TRANSACCIÓN
    // =====================================================

    const client =
      await pool.connect();


    try {

      await client.query(
        "BEGIN"
      );


      // ===================================================
      // 3. VALIDAR PERMISO REAL
      // ===================================================

      await validarAccesoAdministracion(
        administradorId,
        client
      );


      // ===================================================
      // 4. OBTENER USUARIO Y BLOQUEAR FILA
      // ===================================================

      const usuarioResult =
        await client.query(
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

            FOR UPDATE
          `,
          [
            usuarioObjetivoId,
          ]
        );


      if (
        usuarioResult.rows.length === 0
      ) {
        throw crearError(
          404,
          "El usuario no existe."
        );
      }


      const usuarioActual =
        usuarioResult.rows[0];


      // ===================================================
      // 5. VALIDAR QUE TENGA PROCESOS
      // ===================================================

      const procesosResult =
        await client.query(
          `
            SELECT EXISTS (
              SELECT 1

              FROM recolecciones

              WHERE usuario_id = $1
            ) AS tiene_procesos
          `,
          [
            usuarioObjetivoId,
          ]
        );


      const tieneProcesos =
        procesosResult.rows[0]
          ?.tiene_procesos === true;


      if (!tieneProcesos) {
        throw crearError(
          409,
          "El estado de este usuario no puede modificarse mediante esta acción porque no tiene procesos registrados."
        );
      }


      // ===================================================
      // 6. DETERMINAR ESTADO ACTUAL
      // ===================================================

      const estadoActual =
        String(
          usuarioActual.estado ||
          ""
        )
          .trim()
          .toLowerCase();


      // ===================================================
      // 7. VALIDAR SESIÓN ACTIVA ANTES DE DESACTIVAR
      // ===================================================

      if (
        estadoActual ===
        "activo"
      ) {

        const sesionActiva =
          await tieneSesionActiva({
            client,

            usuarioId:
              usuarioObjetivoId,
          });


        if (sesionActiva) {
          throw crearError(
            409,
            "No es posible desactivar al usuario porque tiene una sesión activa."
          );
        }
      }


      // ===================================================
      // 8. DETERMINAR NUEVO ESTADO
      // ===================================================

      let nuevoEstadoNombre;


      if (
        estadoActual ===
        "activo"
      ) {

        nuevoEstadoNombre =
          "Inactivo";

      } else if (
        estadoActual ===
        "inactivo"
      ) {

        nuevoEstadoNombre =
          "Activo";

      } else {

        throw crearError(
          409,
          "El estado actual del usuario no permite realizar esta operación."
        );
      }


      // ===================================================
      // 9. BUSCAR ESTADO DESTINO EN CATÁLOGO
      // ===================================================

      const estadoDestinoResult =
        await client.query(
          `
            SELECT
              id,
              nombre

            FROM estados_usuario

            WHERE LOWER(nombre) =
              LOWER($1)

            LIMIT 1
          `,
          [
            nuevoEstadoNombre,
          ]
        );


      if (
        estadoDestinoResult
          .rows.length === 0
      ) {
        throw crearError(
          500,
          `No existe el estado ${nuevoEstadoNombre} en el catálogo de estados de usuario.`
        );
      }


      const estadoDestino =
        estadoDestinoResult.rows[0];


      // ===================================================
      // 10. ACTUALIZAR ESTADO
      // ===================================================

      const actualizadoResult =
        await client.query(
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
            estadoDestino.id,
            usuarioObjetivoId,
          ]
        );


      // ===================================================
      // 11. COMMIT
      // ===================================================

      await client.query(
        "COMMIT"
      );


      // ===================================================
      // 12. RESPUESTA
      // ===================================================

      return {
        message:
          nuevoEstadoNombre ===
          "Activo"
            ? "Usuario activado correctamente."
            : "Usuario desactivado correctamente.",

        usuario: {
          ...actualizadoResult.rows[0],

          estado:
            estadoDestino.nombre,
        },
      };


    } catch (error) {

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "Error ejecutando rollback al cambiar estado de usuario:",
          rollbackError.message
        );
      }


      throw error;


    } finally {

      client.release();
    }
  };

// =========================================================
// ELIMINAR USUARIO
// =========================================================

exports.eliminarUsuario =
  async ({
    idUsuarioAutenticado,
    idUsuarioObjetivo,
  }) => {

    // =====================================================
    // 1. VALIDAR IDENTIDADES
    // =====================================================

    const administradorId =
      normalizarId(
        idUsuarioAutenticado
      );

    const usuarioObjetivoId =
      normalizarId(
        idUsuarioObjetivo
      );


    if (!administradorId) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    if (!usuarioObjetivoId) {
      throw crearError(
        400,
        "El usuario seleccionado no es válido."
      );
    }


    // =====================================================
    // 2. INICIAR TRANSACCIÓN
    // =====================================================

    const client =
      await pool.connect();


    try {

      await client.query(
        "BEGIN"
      );


      // ===================================================
      // 3. VALIDAR PERMISO REAL
      // ===================================================

      await validarAccesoAdministracion(
        administradorId,
        client
      );


      // ===================================================
      // 4. OBTENER USUARIO Y BLOQUEAR FILA
      // ===================================================

      const usuarioResult =
        await client.query(
          `
            SELECT
              id_usuario,
              nombre,
              correo,
              usuario,
              rol_id,
              estado_id

            FROM usuarios

            WHERE id_usuario = $1

            FOR UPDATE
          `,
          [
            usuarioObjetivoId,
          ]
        );


      if (
        usuarioResult.rows.length === 0
      ) {
        throw crearError(
          404,
          "El usuario no existe."
        );
      }


      // ===================================================
      // 5. EVITAR AUTOELIMINACIÓN
      // ===================================================

      if (
        administradorId ===
        usuarioObjetivoId
      ) {
        throw crearError(
          409,
          "No puede eliminar su propio usuario."
        );
      }


      // ===================================================
      // 6. VALIDAR SI TIENE PROCESOS
      // ===================================================

      const procesosResult =
        await client.query(
          `
            SELECT EXISTS (
              SELECT 1

              FROM recolecciones

              WHERE usuario_id = $1
            ) AS tiene_procesos
          `,
          [
            usuarioObjetivoId,
          ]
        );


      const tieneProcesos =
        procesosResult.rows[0]
          ?.tiene_procesos === true;


      if (tieneProcesos) {
        throw crearError(
          409,
          "No es posible eliminar este usuario porque tiene procesos registrados."
        );
      }


      // ===================================================
      // 7. ELIMINAR USUARIO
      // ===================================================

      const eliminadoResult =
        await client.query(
          `
            DELETE FROM usuarios

            WHERE id_usuario = $1

            RETURNING
              id_usuario,
              nombre,
              correo,
              usuario
          `,
          [
            usuarioObjetivoId,
          ]
        );


      if (
        eliminadoResult.rows.length === 0
      ) {
        throw crearError(
          404,
          "El usuario no existe."
        );
      }


      // ===================================================
      // 8. COMMIT
      // ===================================================

      await client.query(
        "COMMIT"
      );


      // ===================================================
      // 9. RESPUESTA
      // ===================================================

      return {
        message:
          "Usuario eliminado correctamente.",

        usuario: {
          id_usuario:
            eliminadoResult
              .rows[0]
              .id_usuario,

          nombre:
            eliminadoResult
              .rows[0]
              .nombre,

          correo:
            eliminadoResult
              .rows[0]
              .correo,

          usuario:
            eliminadoResult
              .rows[0]
              .usuario,
        },
      };


    } catch (error) {

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "Error ejecutando rollback al eliminar usuario:",
          rollbackError.message
        );
      }


      /*
       * Si existe alguna relación protegida por FK
       * que no hayamos considerado, PostgreSQL
       * también bloquea la eliminación.
       */

      if (
        error?.code === "23503"
      ) {
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
// =========================================================
// CREAR NUEVO USUARIO
// =========================================================

exports.crearUsuario =
  async ({
    idUsuarioAutenticado,
    nombre,
    correo,
    usuario,
    rolId,
    estadoId,
  }) => {

    // =====================================================
    // 1. IDENTIDAD DEL ADMINISTRADOR
    // =====================================================

    const administradorId =
      normalizarId(
        idUsuarioAutenticado
      );


    if (!administradorId) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    // =====================================================
    // 2. NORMALIZAR DATOS RECIBIDOS
    // =====================================================

    const nombreSeguro =
      normalizarTexto(
        nombre
      );

    const correoSeguro =
      normalizarCorreo(
        correo
      );

    const usuarioSeguro =
      normalizarUsuario(
        usuario
      );

    const rolIdSeguro =
      normalizarId(
        rolId
      );

    const estadoIdSeguro =
      normalizarId(
        estadoId
      );


    // =====================================================
    // 3. VALIDACIONES
    // =====================================================

    if (!nombreSeguro) {
      throw crearError(
        400,
        "El nombre completo es obligatorio."
      );
    }


    if (!correoSeguro) {
      throw crearError(
        400,
        "El correo electrónico es obligatorio."
      );
    }


    if (
      !correoValido(
        correoSeguro
      )
    ) {
      throw crearError(
        400,
        "El formato del correo electrónico no es válido."
      );
    }


    if (!usuarioSeguro) {
      throw crearError(
        400,
        "El nombre de usuario es obligatorio."
      );
    }


    if (!rolIdSeguro) {
      throw crearError(
        400,
        "Debe seleccionar un rol válido."
      );
    }


    if (!estadoIdSeguro) {
      throw crearError(
        400,
        "Debe seleccionar un estado válido."
      );
    }


    // =====================================================
    // 4. INICIAR TRANSACCIÓN
    // =====================================================

    const client =
      await pool.connect();


    try {

      await client.query(
        "BEGIN"
      );


      // ===================================================
      // 5. COMPROBAR PERMISO REAL EN BD
      // ===================================================

      await validarAccesoAdministracion(
        administradorId,
        client
      );


      // ===================================================
      // 6. VALIDAR QUE EL ROL EXISTA
      // ===================================================

      const rolResult =
        await client.query(
          `
            SELECT
              id,
              nombre

            FROM roles

            WHERE id = $1

            LIMIT 1
          `,
          [
            rolIdSeguro,
          ]
        );


      if (
        rolResult.rows.length === 0
      ) {
        throw crearError(
          400,
          "El rol seleccionado no es válido."
        );
      }


      // ===================================================
      // 7. VALIDAR QUE EL ESTADO EXISTA
      // ===================================================

      const estadoResult =
        await client.query(
          `
            SELECT
              id,
              nombre

            FROM estados_usuario

            WHERE id = $1

            LIMIT 1
          `,
          [
            estadoIdSeguro,
          ]
        );


      if (
        estadoResult.rows.length === 0
      ) {
        throw crearError(
          400,
          "El estado seleccionado no es válido."
        );
      }


      // ===================================================
      // 8. VALIDAR CORREO DUPLICADO
      // ===================================================

      const correoExiste =
        await client.query(
          `
            SELECT 1

            FROM usuarios

            WHERE LOWER(correo) =
              LOWER($1)

            LIMIT 1
          `,
          [
            correoSeguro,
          ]
        );


      if (
        correoExiste.rows.length > 0
      ) {
        throw crearError(
          409,
          "Ya existe un usuario registrado con ese correo electrónico."
        );
      }


      // ===================================================
      // 9. VALIDAR NOMBRE DE USUARIO DUPLICADO
      // ===================================================

      const usuarioExiste =
        await client.query(
          `
            SELECT 1

            FROM usuarios

            WHERE LOWER(usuario) =
              LOWER($1)

            LIMIT 1
          `,
          [
            usuarioSeguro,
          ]
        );


      if (
        usuarioExiste.rows.length > 0
      ) {
        throw crearError(
          409,
          "El nombre de usuario ya está en uso."
        );
      }


      // ===================================================
      // 10. GENERAR CONTRASEÑA TEMPORAL
      // ===================================================

      const passwordTemporal =
        generarPasswordTemporal();


      // ===================================================
      // 11. GENERAR HASH
      // ===================================================

      const passwordHash =
        await generarPasswordHash(
          passwordTemporal
        );


      // ===================================================
      // 12. CREAR USUARIO
      // ===================================================

      const nuevoUsuarioResult =
        await client.query(
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
            rolIdSeguro,
            estadoIdSeguro,
          ]
        );


      const nuevoUsuario =
        nuevoUsuarioResult.rows[0];


      // ===================================================
      // 13. PREPARAR CORREO
      // ===================================================

      const asunto =
        "Acceso al Sistema de Monitoreo Bioinfeccioso";


      const html = `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 620px;
            margin: 0 auto;
            color: #24313d;
          "
        >
          <h2>
            Sistema de Monitoreo Bioinfeccioso
          </h2>

          <p>
            Hola <strong>${nombreSeguro}</strong>,
          </p>

          <p>
            Se ha creado una cuenta para usted
            en el Sistema de Monitoreo
            Bioinfeccioso.
          </p>

          <p>
            Utilice las siguientes credenciales
            para iniciar sesión:
          </p>

          <div
            style="
              padding: 16px;
              margin: 20px 0;
              background: #f5f7fa;
              border: 1px solid #d9e0e6;
              border-radius: 8px;
            "
          >
            <p style="margin: 0 0 10px;">
              <strong>Usuario:</strong>
              ${usuarioSeguro}
            </p>

            <p style="margin: 0;">
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
            No comparta sus credenciales de
            acceso con otras personas.
          </p>
        </div>
      `;


      // ===================================================
      // 14. ENVIAR CORREO
      // ===================================================

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


      // ===================================================
      // 15. CONFIRMAR TRANSACCIÓN
      // ===================================================

      await client.query(
        "COMMIT"
      );


      // ===================================================
      // 16. RESPUESTA
      // ===================================================

      return {
        message:
          "Usuario creado correctamente. Las credenciales temporales fueron enviadas por correo.",

        usuario: {
          id_usuario:
            nuevoUsuario.id_usuario,

          nombre:
            nuevoUsuario.nombre,

          correo:
            nuevoUsuario.correo,

          usuario:
            nuevoUsuario.usuario,

          rol_id:
            nuevoUsuario.rol_id,

          estado_id:
            nuevoUsuario.estado_id,
        },
      };


    } catch (error) {

      // ===================================================
      // ROLLBACK
      // ===================================================

      try {

        await client.query(
          "ROLLBACK"
        );

      } catch (
        rollbackError
      ) {

        console.error(
          "Error ejecutando rollback al crear usuario:",
          rollbackError.message
        );
      }


      // ===================================================
      // DUPLICADO POR RESTRICCIÓN UNIQUE
      // ===================================================

      if (
        error?.code === "23505"
      ) {

        const constraint =
          String(
            error.constraint ||
            ""
          ).toLowerCase();


        if (
          constraint.includes(
            "correo"
          )
        ) {
          throw crearError(
            409,
            "Ya existe un usuario registrado con ese correo electrónico."
          );
        }


        if (
          constraint.includes(
            "usuario"
          )
        ) {
          throw crearError(
            409,
            "El nombre de usuario ya está en uso."
          );
        }


        throw crearError(
          409,
          "Ya existe un usuario con la información proporcionada."
        );
      }


      throw error;


    } finally {

      client.release();
    }
  };