
"use strict";

// ======================================================
// SERVICIOS
// ======================================================

const registroPesajeService = require(
  "../../services/controlDSH/RegistroPesaje.service"
);

const recoleccionService = require(
  "../../services/controlDSH/Recoleccion.service"
);

const moduloMedicionesService = require(
  "../../services/controlDSH/mediciones/fuentes/ModuloMediciones.service"
);

// ======================================================
// MANEJO CENTRAL DE ERRORES
// ======================================================
//
// Controller:
// req -> Service -> res
//
// Las reglas de negocio, transacciones,
// validaciones y cálculos permanecen
// en los servicios correspondientes.
// ======================================================

function responderErrorService(res, error, contexto) {

  if (
    Number.isInteger(error?.statusCode)
  ) {
    return res
      .status(error.statusCode)
      .json({
        message: error.message,
        ...(error.details || {}),
      });
  }

  console.error(
    `Error ${contexto}:`,
    error
  );

  return res
    .status(500)
    .json({
      message: "Error interno del servidor",
    });
}

// ======================================================
// FOTO 1 - INICIAR PROCESO
// ======================================================

exports.iniciarProceso = async (req, res) => {
  try {
    const resultado =
      await registroPesajeService.iniciarProceso({
        idUsuario: req.user?.id_usuario,
        idTipoResiduo: req.body?.id_tipo_residuo,
      });

    return res
      .status(201)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "iniciarProceso"
    );
  }
};

// ======================================================
// FOTO 1 - CONSULTAR PROCESO ACTIVO
// ======================================================

exports.consultarProcesoActivo = async (req, res) => {
  try {
    const resultado =
      await registroPesajeService.consultarProcesoActivo({
        idUsuario: req.user?.id_usuario,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "consultarProcesoActivo"
    );
  }
};

// ======================================================
// FOTO 2 - OBTENER COSTO GLOBAL
// ======================================================

exports.obtenerCostoGlobal = async (req, res) => {
  try {
    const resultado =
      await registroPesajeService.obtenerCostoGlobal({
        idUsuario: req.user?.id_usuario,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "obtenerCostoGlobal"
    );
  }
};

// ======================================================
// FOTO 2 - CONFIRMAR COSTO GLOBAL
// ======================================================

exports.confirmarCostoGlobal = async (req, res) => {
  try {
    const resultado =
      await registroPesajeService.confirmarCostoGlobal({
        idUsuario: req.user?.id_usuario,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "confirmarCostoGlobal"
    );
  }
};

// ======================================================
// FOTO 2 - EDITAR COSTO GLOBAL
// ======================================================

exports.guardarCostoGlobal = async (req, res) => {
  try {
    const resultado =
      await registroPesajeService.guardarCostoGlobal({
        idUsuario: req.user?.id_usuario,
        costoPorLibra: req.body?.costo_por_libra,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "guardarCostoGlobal"
    );
  }
};

// ======================================================
// FOTO 3 - CALCULAR PESO REAL
// ======================================================
//
// El frontend NO envía:
// - peso
// - costo
// - porcentaje
// - contenedor
// - historial_calculo_id
//
// El backend determina todo desde
// el proceso EN_PROCESO del usuario.
//
// Esta función conserva el flujo real
// del módulo HX711.
// ======================================================

exports.guardarCalculo = async (req, res) => {
  try {
    const resultado =
      await registroPesajeService.guardarCalculo({
        idUsuario: req.user?.id_usuario,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "guardarCalculo"
    );
  }
};

// ======================================================
// FOTO 3 - CONSULTAR ESTADO DEL PESAJE
// ======================================================

exports.consultarEstadoCalculo = async (req, res) => {
  try {
    const resultado =
      await registroPesajeService.consultarEstadoCalculo({
        idUsuario: req.user?.id_usuario,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "consultarEstadoCalculo"
    );
  }
};

// ======================================================
// NUEVO - CONSULTAR ÚLTIMO PESO HISTÓRICO
// ======================================================
//
// Exclusivamente para consulta.
//
// No crea una solicitud de medición.
// No cambia PENDIENTE a COMPLETADO.
// No registra lecturas nuevas.
// No calcula costos.
// No modifica recolecciones.
//
// El resultado conserva fecha y origen,
// y se identifica como histórico.
// ======================================================

exports.consultarUltimoPesoHistorico = async (req, res) => {
  try {

    const contenedorId = Number(
      req.params?.contenedorId
    );

    if (
      !Number.isSafeInteger(contenedorId) ||
      contenedorId <= 0
    ) {
      return res.status(400).json({
        message: "Identificador de contenedor inválido.",
      });
    }

    const resultado =
      await moduloMedicionesService.obtenerUltimoPesoHistorico({
        contenedorId,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "consultarUltimoPesoHistorico"
    );
  }
};

// ======================================================
// FOTO 4 - OBTENER DATOS DE RECOLECCIÓN
// ======================================================

exports.obtenerDatosRecoleccion = async (req, res) => {
  try {
    const resultado =
      await recoleccionService.obtenerDatosRecoleccion({
        idUsuario: req.user?.id_usuario,
        nombreUsuario: req.user?.nombre,
        usuario: req.user?.usuario,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "obtenerDatosRecoleccion"
    );
  }
};

// ======================================================
// FOTO 4 - PREVISUALIZAR PESO PENDIENTE
// ======================================================

exports.previewPendiente = async (req, res) => {
  try {
    const resultado =
      await recoleccionService.previewPendiente({
        idUsuario: req.user?.id_usuario,
        cantidadLibrasPendientes:
          req.body?.cantidad_libras_pendientes,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "previewPendiente"
    );
  }
};

// ======================================================
// FOTO 4 - GUARDAR RECOLECCIÓN
// ======================================================
//
// Los datos del proceso y sus cálculos
// se obtienen desde el backend.
//
// El frontend envía únicamente los
// campos que debe ingresar el usuario.
// ======================================================

exports.guardarRecoleccion = async (req, res) => {
  try {
    const resultado =
      await recoleccionService.guardarRecoleccion({
        idUsuario: req.user?.id_usuario,
        nombreUsuario: req.user?.nombre,
        usuario: req.user?.usuario,

        empresaId:
          req.body?.empresa_id,

        distritoId:
          req.body?.distrito_id,

        numeroRecibo:
          req.body?.numero_recibo,

        cantidadLibrasPendientes:
          req.body?.cantidad_libras_pendientes,

        observaciones:
          req.body?.observaciones,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "guardarRecoleccion"
    );
  }
};

// ======================================================
// CANCELAR PROCESO ACTUAL
// ======================================================

exports.cancelarProceso = async (req, res) => {
  try {
    const resultado =
      await registroPesajeService.cancelarProceso({
        idUsuario: req.user?.id_usuario,
      });

    return res
      .status(200)
      .json(resultado);

  } catch (error) {
    return responderErrorService(
      res,
      error,
      "cancelarProceso"
    );
  }
};
