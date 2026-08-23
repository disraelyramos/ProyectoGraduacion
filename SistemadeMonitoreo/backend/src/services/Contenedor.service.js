const pool = require("../config/db");

const medicionesService = require(
  "./controlDSH/mediciones/Mediciones.service"
);

// ======================================================
// LISTAR CONTENEDORES
// ======================================================

async function listarContenedores() {
  /*
   * Aquí obtenemos únicamente la información
   * estructural/configurada del contenedor.
   *
   * El nivel actual NO se toma directamente
   * desde esta consulta.
   */
  const { rows } = await pool.query(`
    SELECT
      c.id_contenedor,
      c.codigo,
      c.id_tipo_residuo,
      c.estado_id,
      c.capacidad_max_litros,
      c.capacidad_max_lb,
      c.estado_actual_lb,

      u.id_ubicacion,
      u.nombre AS ubicacion,

      tr.nombre AS tipo_residuo,

      TO_CHAR(
        c.fecha_registro,
        'YYYY-MM-DD'
      ) AS fecha_registro,

      ec.nombre AS estado

    FROM contenedores c

    JOIN ubicaciones u
      ON c.id_ubicacion =
         u.id_ubicacion

    JOIN tipos_residuo tr
      ON c.id_tipo_residuo =
         tr.id

    JOIN estados_contenedor ec
      ON c.estado_id =
         ec.id

    ORDER BY
      c.id_contenedor DESC
  `);

  /*
   * Cada contenedor obtiene su nivel mediante
   * la capa intercambiable.
   *
   * HOY:
   * BaseDatosMediciones.service
   *
   * FUTURO:
   * ModuloMediciones.service
   */
  const contenedores =
    await Promise.all(
      rows.map(
        async (contenedor) => {
          const medicionNivel =
            await medicionesService.obtenerNivelActual({
              contenedorId:
                contenedor.id_contenedor,
            });

          const porcentaje =
            Number(
              medicionNivel?.valor
            );

          const nivelActual =
            Number.isFinite(
              porcentaje
            )
              ? Math.min(
                  100,
                  Math.max(
                    0,
                    porcentaje
                  )
                )
              : 0;

          return {
            ...contenedor,

            /*
             * COMPATIBILIDAD:
             *
             * Conservamos este nombre porque
             * otras pantallas actualmente
             * podrían utilizarlo.
             *
             * Pero su valor ya viene del
             * proveedor de mediciones.
             */
            estado_actual_litros:
              nivelActual,

            /*
             * También devolvemos el nombre
             * semánticamente correcto.
             *
             * Podemos migrar el frontend
             * posteriormente sin urgencia.
             */
            porcentaje_llenado:
              nivelActual,
          };
        }
      )
    );

  return contenedores;
}

// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  listarContenedores,
};