const db = require(
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
   OBTENER MENÚ DEL USUARIO AUTENTICADO

   IMPORTANTE:

   - NO recibe rol desde frontend.
   - La identidad viene del JWT.
   - El rol real se consulta en PostgreSQL.
   - Solo devuelve permisos activos.
   ========================================================= */

exports.obtenerMenuUsuario =
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


    /* =====================================================
       CONSULTAR MENÚ SEGÚN ROL REAL DEL USUARIO
       ===================================================== */

    const result =
      await db.query(
        `
          SELECT
            m.id
              AS modulo_id,

            m.nombre
              AS modulo_nombre,

            m.icono
              AS modulo_icono,

            m.ruta
              AS modulo_ruta,

            s.id
              AS submodulo_id,

            s.nombre
              AS submodulo_nombre,

            s.ruta
              AS submodulo_ruta,

            s.icono
              AS submodulo_icono


          FROM usuarios u


          INNER JOIN permisos p
            ON p.rol_id =
              u.rol_id

           AND p.active =
              TRUE


          INNER JOIN modulo m
            ON m.id =
              p.modulo_id


          LEFT JOIN submodulo s
            ON s.id =
              p.submodulo_id

           AND s.modulo_id =
              m.id


          WHERE u.id_usuario =
            $1


          ORDER BY
            m.id ASC,
            s.id ASC
        `,
        [
          usuarioId,
        ]
      );


    /* =====================================================
       ARMAR ESTRUCTURA DEL MENÚ
       ===================================================== */

    const menu =
      [];

    const modulosMap =
      new Map();


    for (
      const row
      of result.rows
    ) {

      let modulo =
        modulosMap.get(
          row.modulo_id
        );


      if (!modulo) {

        modulo = {
          id:
            row.modulo_id,

          nombre:
            row.modulo_nombre,

          icono:
            row.modulo_icono,

          ruta:
            row.modulo_ruta,

          submodulos:
            [],
        };


        modulosMap.set(
          row.modulo_id,
          modulo
        );


        menu.push(
          modulo
        );
      }


      if (
        row.submodulo_id &&
        !modulo.submodulos.some(
          (submodulo) =>
            submodulo.id ===
            row.submodulo_id
        )
      ) {

        modulo.submodulos.push({
          id:
            row.submodulo_id,

          nombre:
            row.submodulo_nombre,

          icono:
            row.submodulo_icono,

          ruta:
            row.submodulo_ruta,
        });
      }
    }


    return menu;
  };