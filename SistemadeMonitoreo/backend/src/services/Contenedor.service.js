const pool = require(
  "../config/db"
);

const nivelCache = require(
  "./controlDSH/mediciones/NivelActualCache.service"
);


// ======================================================
// LISTAR CONTENEDORES
// ======================================================

async function listarContenedores() {

  /*
   * Aquí obtenemos únicamente la información
   * estructural/configurada del contenedor.
   *
   * IMPORTANTE:
   *
   * El nivel actual NO se obtiene aquí desde:
   *
   * - BaseDatosMediciones.service
   * - ModuloMediciones.service
   * - Mediciones.service
   *
   * El nivel actual ya debe encontrarse en el
   * caché administrado por:
   *
   * NivelMonitor.service
   *          ↓
   * NivelActualCache.service
   *
   * De esta forma, consultar /contenedores
   * NO provoca una nueva medición.
   */
  const { rows } =
    await pool.query(
      `
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
      `
    );


  /*
   * El listado estructural ya viene de BD.
   *
   * Aquí únicamente agregamos el último
   * nivel conocido de cada contenedor.
   */
  const contenedores =
    rows.map(
      (contenedor) => {

        const nivel =
          nivelCache.obtenerNivel(
            contenedor
              .id_contenedor
          );


        /*
         * Un valor puede existir en caché,
         * pero estar vencido.
         *
         * Ejemplo:
         *
         * porcentaje = 52
         * vigente = false
         *
         * En ese caso NO lo mostramos
         * como si fuera una medición actual.
         */
        const nivelVigente =
          nivel?.vigente ===
          true;


        const porcentaje =
          nivelVigente
            ? Number(
                nivel
                  .porcentaje
              )
            : null;


        return {

          ...contenedor,


          // ==============================================
          // COMPATIBILIDAD CON FRONTEND ACTUAL
          // ==============================================
          //
          // NuevoRegistro.jsx actualmente utiliza:
          //
          // estado_actual_litros
          //
          // Por eso conservamos temporalmente
          // este nombre.
          // ==============================================

          estado_actual_litros:
            porcentaje,


          // ==============================================
          // NOMBRE SEMÁNTICO CORRECTO
          // ==============================================

          porcentaje_llenado:
            porcentaje,


          // ==============================================
          // ESTADO DEL NIVEL
          // ==============================================

          nivel_disponible:
            nivelVigente,


          /*
           * Fecha de la última actualización
           * recibida por el caché.
           */
          nivel_actualizado_en:
            nivel
              ?.fechaActualizacion ||
            null,


          /*
           * Permite conocer si actualmente
           * la medición provino de:
           *
           * base_datos
           * modulo
           */
          nivel_proveedor:
            nivel
              ?.proveedor ||
            null,
        };
      }
    );


  return contenedores;
}


// ======================================================
// EXPORTACIONES
// ======================================================

module.exports = {
  listarContenedores,
};