const pool = require(
  "../../config/db"
);


/* =========================================================
   ERROR CONTROLADO
   ========================================================= */

function crearError(
  status,
  message
) {
  const error =
    new Error(message);

  error.status =
    status;

  return error;
}


/* =========================================================
   NORMALIZAR ID
   ========================================================= */

function normalizarId(
  valor
) {
  const id =
    Number(valor);


  if (
    !Number.isSafeInteger(id) ||
    id <= 0
  ) {
    return null;
  }


  return id;
}


/* =========================================================
   CLAVE ÚNICA DE PERMISO
   ========================================================= */

function crearClavePermiso(
  moduloId,
  submoduloId
) {
  return `${moduloId}:${
    submoduloId === null
      ? "null"
      : submoduloId
  }`;
}


/* =========================================================
   VALIDAR ACCESO A ADMINISTRACIÓN
   ========================================================= */

async function validarAccesoAdministracion(
  idUsuario,
  db = pool
) {
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
        "/administracion/nuevo-usuario",
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
}


/* =========================================================
   OBTENER CATÁLOGO DE PERMISOS
   ========================================================= */

exports.obtenerCatalogo =
  async ({
    idUsuario,
  }) => {

    const usuarioId =
      normalizarId(
        idUsuario
      );


    if (!usuarioId) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    await validarAccesoAdministracion(
      usuarioId
    );


    const [
      rolesResult,
      modulosResult,
      submodulosResult,
    ] = await Promise.all([

      pool.query(
        `
          SELECT
            id,
            nombre

          FROM roles

          ORDER BY
            nombre ASC
        `
      ),


      pool.query(
        `
          SELECT
            id,
            nombre,
            icono,
            ruta

          FROM modulo

          ORDER BY
            id ASC
        `
      ),


      pool.query(
        `
          SELECT
            id,
            modulo_id,
            nombre,
            ruta,
            icono

          FROM submodulo

          ORDER BY
            modulo_id ASC,
            id ASC
        `
      ),
    ]);


    const modulos =
      modulosResult.rows.map(
        (modulo) => {

          return {
            id:
              modulo.id,

            nombre:
              modulo.nombre,

            icono:
              modulo.icono,

            ruta:
              modulo.ruta,

            submodulos:
              submodulosResult.rows
                .filter(
                  (submodulo) =>
                    Number(
                      submodulo.modulo_id
                    ) ===
                    Number(
                      modulo.id
                    )
                )
                .map(
                  (submodulo) => ({
                    id:
                      submodulo.id,

                    nombre:
                      submodulo.nombre,

                    ruta:
                      submodulo.ruta,

                    icono:
                      submodulo.icono,
                  })
                ),
          };
        }
      );


    return {
      roles:
        rolesResult.rows,

      modulos,
    };
  };


/* =========================================================
   OBTENER PERMISOS DE UN ROL
   ========================================================= */

exports.obtenerPermisosRol =
  async ({
    idUsuario,
    rolId,
  }) => {

    const usuarioId =
      normalizarId(
        idUsuario
      );

    const rolSeguro =
      normalizarId(
        rolId
      );


    if (!usuarioId) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    if (!rolSeguro) {
      throw crearError(
        400,
        "El rol seleccionado no es válido."
      );
    }


    await validarAccesoAdministracion(
      usuarioId
    );


    const rolResult =
      await pool.query(
        `
          SELECT
            id,
            nombre

          FROM roles

          WHERE id = $1

          LIMIT 1
        `,
        [
          rolSeguro,
        ]
      );


    if (
      rolResult.rows.length === 0
    ) {
      throw crearError(
        404,
        "El rol seleccionado no existe."
      );
    }


    const rol =
      rolResult.rows[0];


    const permisosResult =
      await pool.query(
        `
          SELECT
            id,
            rol_id,
            modulo_id,
            submodulo_id,
            active

          FROM permisos

          WHERE rol_id = $1

          ORDER BY
            modulo_id ASC,
            submodulo_id ASC NULLS FIRST
        `,
        [
          rolSeguro,
        ]
      );


    return {
      rol: {
        id:
          rol.id,

        nombre:
          rol.nombre,

        esAdministrador:
          String(
            rol.nombre ||
            ""
          )
            .trim()
            .toLowerCase() ===
          "administrador",
      },

      permisos:
        permisosResult.rows.map(
          (permiso) => ({
            id:
              permiso.id,

            modulo_id:
              permiso.modulo_id,

            submodulo_id:
              permiso.submodulo_id,

            active:
              permiso.active ===
              true,
          })
        ),
    };
  };


/* =========================================================
   NORMALIZAR PERMISOS RECIBIDOS

   FORMATO ESPERADO:

   permisos: [
     {
       modulo_id: 4,
       submodulo_id: 3
     },
     {
       modulo_id: 1,
       submodulo_id: null
     }
   ]
   ========================================================= */

function normalizarPermisos(
  permisos
) {

  if (!Array.isArray(permisos)) {
    throw crearError(
      400,
      "La lista de permisos no es válida."
    );
  }


  const permisosNormalizados =
    [];

  const claves =
    new Set();


  for (
    const permiso
    of permisos
  ) {

    if (
      !permiso ||
      typeof permiso !==
        "object"
    ) {
      throw crearError(
        400,
        "Existe un permiso con formato inválido."
      );
    }


    const moduloId =
      normalizarId(
        permiso.modulo_id
      );


    if (!moduloId) {
      throw crearError(
        400,
        "Existe un módulo inválido en la selección."
      );
    }


    let submoduloId =
      null;


    if (
      permiso.submodulo_id !==
        null &&
      permiso.submodulo_id !==
        undefined &&
      permiso.submodulo_id !==
        ""
    ) {

      submoduloId =
        normalizarId(
          permiso.submodulo_id
        );


      if (!submoduloId) {
        throw crearError(
          400,
          "Existe un submódulo inválido en la selección."
        );
      }
    }


    const clave =
      crearClavePermiso(
        moduloId,
        submoduloId
      );


    /*
     * Evitar permisos duplicados enviados
     * desde frontend.
     */

    if (
      claves.has(
        clave
      )
    ) {
      continue;
    }


    claves.add(
      clave
    );


    permisosNormalizados.push({
      modulo_id:
        moduloId,

      submodulo_id:
        submoduloId,
    });
  }


  return permisosNormalizados;
}


/* =========================================================
   ACTUALIZAR PERMISOS DE UN ROL
   ========================================================= */

exports.actualizarPermisosRol =
  async ({
    idUsuario,
    rolId,
    permisos,
  }) => {

    const usuarioId =
      normalizarId(
        idUsuario
      );

    const rolSeguro =
      normalizarId(
        rolId
      );


    if (!usuarioId) {
      throw crearError(
        401,
        "Usuario no autenticado."
      );
    }


    if (!rolSeguro) {
      throw crearError(
        400,
        "El rol seleccionado no es válido."
      );
    }


    const permisosSolicitados =
      normalizarPermisos(
        permisos
      );


    const client =
      await pool.connect();


    try {

      await client.query(
        "BEGIN"
      );


      /* ===================================================
         VALIDAR ACCESO DEL USUARIO AUTENTICADO
         =================================================== */

      await validarAccesoAdministracion(
        usuarioId,
        client
      );


      /* ===================================================
         VALIDAR ROL
         =================================================== */

      const rolResult =
        await client.query(
          `
            SELECT
              id,
              nombre

            FROM roles

            WHERE id = $1

            FOR UPDATE
          `,
          [
            rolSeguro,
          ]
        );


      if (
        rolResult.rows.length ===
        0
      ) {
        throw crearError(
          404,
          "El rol seleccionado no existe."
        );
      }


      const rol =
        rolResult.rows[0];


      const esAdministrador =
        String(
          rol.nombre ||
          ""
        )
          .trim()
          .toLowerCase() ===
        "administrador";


      /* ===================================================
         CARGAR CATÁLOGO REAL DESDE BD
         =================================================== */

      const [
        modulosResult,
        submodulosResult,
      ] = await Promise.all([

        client.query(
          `
            SELECT
              id

            FROM modulo
          `
        ),

        client.query(
          `
            SELECT
              id,
              modulo_id

            FROM submodulo
          `
        ),
      ]);


      const modulosValidos =
        new Set(
          modulosResult.rows.map(
            (modulo) =>
              Number(
                modulo.id
              )
          )
        );


      const submodulosValidos =
        new Map(
          submodulosResult.rows.map(
            (submodulo) => [
              Number(
                submodulo.id
              ),
              Number(
                submodulo.modulo_id
              ),
            ]
          )
        );


      /* ===================================================
         VALIDAR CADA PERMISO ENVIADO

         El backend NO confía en modulo_id ni submodulo_id
         enviados por frontend.
         =================================================== */

      for (
        const permiso
        of permisosSolicitados
      ) {

        if (
          !modulosValidos.has(
            permiso.modulo_id
          )
        ) {
          throw crearError(
            400,
            "Uno de los módulos seleccionados no existe."
          );
        }


        if (
          permiso.submodulo_id !==
          null
        ) {

          const moduloDelSubmodulo =
            submodulosValidos.get(
              permiso.submodulo_id
            );


          if (
            !moduloDelSubmodulo
          ) {
            throw crearError(
              400,
              "Uno de los submódulos seleccionados no existe."
            );
          }


          if (
            moduloDelSubmodulo !==
            permiso.modulo_id
          ) {
            throw crearError(
              400,
              "El submódulo seleccionado no pertenece al módulo indicado."
            );
          }
        }
      }


      /* ===================================================
         PERMISOS ACTUALES DEL ROL
         =================================================== */

      const permisosActualesResult =
        await client.query(
          `
            SELECT
              id,
              modulo_id,
              submodulo_id,
              active

            FROM permisos

            WHERE rol_id = $1

            FOR UPDATE
          `,
          [
            rolSeguro,
          ]
        );


      const permisosActuales =
        permisosActualesResult.rows;


      const clavesSolicitadas =
        new Set(
          permisosSolicitados.map(
            (permiso) =>
              crearClavePermiso(
                permiso.modulo_id,
                permiso.submodulo_id
              )
          )
        );


      /* ===================================================
         PROTEGER ADMINISTRADOR

         Un permiso ACTIVO existente del Administrador
         nunca puede desaparecer.
         =================================================== */

      if (esAdministrador) {

        for (
          const permisoActual
          of permisosActuales
        ) {

          if (
            permisoActual.active !==
            true
          ) {
            continue;
          }


          const claveActual =
            crearClavePermiso(
              Number(
                permisoActual.modulo_id
              ),

              permisoActual.submodulo_id ===
                null
                ? null
                : Number(
                    permisoActual.submodulo_id
                  )
            );


          if (
            !clavesSolicitadas.has(
              claveActual
            )
          ) {
            throw crearError(
              409,
              "Los permisos existentes del rol Administrador no pueden ser eliminados."
            );
          }
        }
      }


      /* ===================================================
         MAPA DE PERMISOS EXISTENTES
         =================================================== */

      const permisosExistentes =
        new Map();


      for (
        const permisoActual
        of permisosActuales
      ) {

        const clave =
          crearClavePermiso(
            Number(
              permisoActual.modulo_id
            ),

            permisoActual.submodulo_id ===
              null
              ? null
              : Number(
                  permisoActual.submodulo_id
                )
          );


        permisosExistentes.set(
          clave,
          permisoActual
        );
      }


      /* ===================================================
         ACTIVAR / DESACTIVAR PERMISOS EXISTENTES
         =================================================== */

      for (
        const permisoActual
        of permisosActuales
      ) {

        const clave =
          crearClavePermiso(
            Number(
              permisoActual.modulo_id
            ),

            permisoActual.submodulo_id ===
              null
              ? null
              : Number(
                  permisoActual.submodulo_id
                )
          );


        const debeEstarActivo =
          clavesSolicitadas.has(
            clave
          );


        if (
          permisoActual.active !==
          debeEstarActivo
        ) {

          await client.query(
            `
              UPDATE permisos

              SET active = $1

              WHERE id = $2
            `,
            [
              debeEstarActivo,
              permisoActual.id,
            ]
          );
        }
      }


      /* ===================================================
         INSERTAR PERMISOS NUEVOS
         =================================================== */

      for (
        const permiso
        of permisosSolicitados
      ) {

        const clave =
          crearClavePermiso(
            permiso.modulo_id,
            permiso.submodulo_id
          );


        if (
          permisosExistentes.has(
            clave
          )
        ) {
          continue;
        }


        await client.query(
          `
            INSERT INTO permisos (
              rol_id,
              modulo_id,
              submodulo_id,
              active
            )

            VALUES (
              $1,
              $2,
              $3,
              TRUE
            )
          `,
          [
            rolSeguro,
            permiso.modulo_id,
            permiso.submodulo_id,
          ]
        );
      }


      /* ===================================================
         CONSULTAR ESTADO FINAL
         =================================================== */

      const resultadoFinal =
        await client.query(
          `
            SELECT
              id,
              rol_id,
              modulo_id,
              submodulo_id,
              active

            FROM permisos

            WHERE rol_id = $1

            ORDER BY
              modulo_id ASC,
              submodulo_id ASC
              NULLS FIRST
          `,
          [
            rolSeguro,
          ]
        );


      await client.query(
        "COMMIT"
      );


      return {
        message:
          "Permisos actualizados correctamente.",

        rol: {
          id:
            rol.id,

          nombre:
            rol.nombre,

          esAdministrador,
        },

        permisos:
          resultadoFinal.rows.map(
            (permiso) => ({
              id:
                permiso.id,

              modulo_id:
                permiso.modulo_id,

              submodulo_id:
                permiso.submodulo_id,

              active:
                permiso.active ===
                true,
            })
          ),
      };


    } catch (error) {

      await client.query(
        "ROLLBACK"
      );


      throw error;


    } finally {

      client.release();
    }
  };