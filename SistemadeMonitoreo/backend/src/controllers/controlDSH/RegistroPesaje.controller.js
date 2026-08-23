// backend/src/controllers/controlDSH/RegistroPesaje.controller.js

const registroPesajeService = require(
  "../../services/controlDSH/RegistroPesaje.service"
);

const recoleccionService = require(
  "../../services/controlDSH/Recoleccion.service"
);


// ======================================================
// MANEJO CENTRAL DE ERRORES
// ======================================================
//
// El Controller no conoce reglas de negocio.
//
// Service:
// - valida
// - consulta BD
// - calcula
// - controla transacciones
//
// Controller:
// req -> Service -> res
// ======================================================

function responderErrorService(
  res,
  error,
  contexto
) {

  /*
   * Tanto RegistroPesaje.service como
   * Recoleccion.service utilizarán errores
   * controlados con:
   *
   * statusCode
   * message
   * details
   */
  if (
    Number.isInteger(
      error?.statusCode
    )
  ) {

    return res
      .status(
        error.statusCode
      )
      .json({
        message:
          error.message,

        ...(
          error.details ||
          {}
        ),
      });
  }


  /*
   * Error inesperado.
   *
   * Se registra internamente,
   * pero NO exponemos detalles técnicos
   * al frontend.
   */
  console.error(
    `Error ${contexto}:`,
    error
  );


  return res
    .status(500)
    .json({
      message:
        "Error interno del servidor",
    });
}


// ======================================================
// FOTO 1
// INICIAR PROCESO
// ======================================================
//
// El único dato que el usuario selecciona es:
//
// id_tipo_residuo
//
// Backend vuelve a validar:
//
// - usuario
// - tipo
// - contenedor
// - estado
// - nivel
// - proceso EN_PROCESO
// ======================================================

exports.iniciarProceso =
  async (req, res) => {

    try {

      const resultado =
        await registroPesajeService
          .iniciarProceso({

            idUsuario:
              req.user
                ?.id_usuario,

            idTipoResiduo:
              req.body
                ?.id_tipo_residuo,
          });


      return res
        .status(201)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "iniciarProceso"
      );
    }
  };


// ======================================================
// FOTO 1
// CONSULTAR PROCESO ACTIVO
// ======================================================

exports.consultarProcesoActivo =
  async (req, res) => {

    try {

      const resultado =
        await registroPesajeService
          .consultarProcesoActivo({

            idUsuario:
              req.user
                ?.id_usuario,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "consultarProcesoActivo"
      );
    }
  };


// ======================================================
// FOTO 2
// OBTENER COSTO
// ======================================================
//
// Frontend NO manda:
//
// contenedor_id
// proceso_id
//
// Service obtiene todo desde el
// EN_PROCESO del usuario.
// ======================================================

exports.obtenerCostoGlobal =
  async (req, res) => {

    try {

      const resultado =
        await registroPesajeService
          .obtenerCostoGlobal({

            idUsuario:
              req.user
                ?.id_usuario,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "obtenerCostoGlobal"
      );
    }
  };


// ======================================================
// FOTO 2
// CONFIRMAR COSTO VIGENTE
// ======================================================
//
// Utilizado por:
//
// Omitir
//
// Frontend manda:
//
// {}
//
// Backend obtiene el costo vigente
// directamente desde BD.
// ======================================================

exports.confirmarCostoGlobal =
  async (req, res) => {

    try {

      const resultado =
        await registroPesajeService
          .confirmarCostoGlobal({

            idUsuario:
              req.user
                ?.id_usuario,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "confirmarCostoGlobal"
      );
    }
  };


// ======================================================
// FOTO 2
// EDITAR COSTO GLOBAL
// ======================================================
//
// costo_por_libra sí es un dato ingresado
// explícitamente por el usuario.
//
// El Service vuelve a validarlo.
// ======================================================

exports.guardarCostoGlobal =
  async (req, res) => {

    try {

      const resultado =
        await registroPesajeService
          .guardarCostoGlobal({

            idUsuario:
              req.user
                ?.id_usuario,

            costoPorLibra:
              req.body
                ?.costo_por_libra,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "guardarCostoGlobal"
      );
    }
  };


// ======================================================
// FOTO 3
// CALCULAR PESO
// ======================================================
//
// MUY IMPORTANTE:
//
// Frontend manda:
//
// {}
//
// NO recibimos:
//
// historial_calculo_id
// contenedor_id
// id_tipo_residuo
// peso
// costo
// nivel
//
// Service obtiene todo mediante:
//
// req.user.id_usuario
//        ↓
// EN_PROCESO
//        ↓
// Mediciones.service
// ======================================================

exports.guardarCalculo =
  async (req, res) => {

    try {

      const resultado =
        await registroPesajeService
          .guardarCalculo({

            idUsuario:
              req.user
                ?.id_usuario,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "guardarCalculo"
      );
    }
  };


// ======================================================
// FOTO 4
// OBTENER DATOS INICIALES
// ======================================================
//
// Frontend entra a Foto 4.
//
// Backend obtiene:
//
// - proceso EN_PROCESO
// - contenedor
// - responsable
// - fecha servidor
//
// y verifica que Foto 3 ya tenga
// cálculo válido.
// ======================================================

exports.obtenerDatosRecoleccion =
  async (req, res) => {

    try {

      const resultado =
        await recoleccionService
          .obtenerDatosRecoleccion({

            idUsuario:
              req.user
                ?.id_usuario,

            nombreUsuario:
              req.user
                ?.nombre,

            usuario:
              req.user
                ?.usuario,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "obtenerDatosRecoleccion"
      );
    }
  };


// ======================================================
// FOTO 4
// PREVIEW DE RECOLECCIÓN
// ======================================================
//
// El único dato que manda frontend:
//
// cantidad_libras_pendientes
//
// Backend obtiene:
//
// total_en_libras
//
// desde el EN_PROCESO.
//
// Backend calcula:
//
// porcentaje_pendiente
// porcentaje_recolectado
// ======================================================

exports.previewPendiente =
  async (req, res) => {

    try {

      const resultado =
        await recoleccionService
          .previewPendiente({

            idUsuario:
              req.user
                ?.id_usuario,

            cantidadLibrasPendientes:
              req.body
                ?.cantidad_libras_pendientes,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "previewPendiente"
      );
    }
  };


// ======================================================
// FOTO 4
// GUARDAR RECOLECCIÓN
// ======================================================
//
// Frontend únicamente manda datos
// introducidos/seleccionados por usuario:
//
// - empresa_id
// - distrito_id
// - numero_recibo
// - cantidad_libras_pendientes
// - observaciones
//
// NO manda:
//
// proceso_token
// historial_calculo_id
// contenedor_id
// total_en_libras
// porcentaje_recolectado
// porcentaje_pendiente
// costo
// lectura_id
// responsable
// fecha
// ======================================================

exports.guardarRecoleccion =
  async (req, res) => {

    try {

      const resultado =
        await recoleccionService
          .guardarRecoleccion({

            idUsuario:
              req.user
                ?.id_usuario,

            nombreUsuario:
              req.user
                ?.nombre,

            usuario:
              req.user
                ?.usuario,

            empresaId:
              req.body
                ?.empresa_id,

            distritoId:
              req.body
                ?.distrito_id,

            numeroRecibo:
              req.body
                ?.numero_recibo,

            cantidadLibrasPendientes:
              req.body
                ?.cantidad_libras_pendientes,

            observaciones:
              req.body
                ?.observaciones,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "guardarRecoleccion"
      );
    }
  };


// ======================================================
// CANCELAR PROCESO
// ======================================================
//
// También dejamos de confiar en:
//
// historial_calculo_id
//
// Frontend:
//
// POST /cancelar
// {}
//
// Backend:
//
// req.user.id_usuario
//        ↓
// encuentra EN_PROCESO
//        ↓
// CANCELADO
// ======================================================

exports.cancelarProceso =
  async (req, res) => {

    try {

      const resultado =
        await registroPesajeService
          .cancelarProceso({

            idUsuario:
              req.user
                ?.id_usuario,
          });


      return res
        .status(200)
        .json(
          resultado
        );


    } catch (error) {

      return responderErrorService(
        res,
        error,
        "cancelarProceso"
      );
    }
  };