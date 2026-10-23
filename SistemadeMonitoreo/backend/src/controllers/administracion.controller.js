
"use strict";

const administracionService = require(
  "../services/administracion.service"
);

// ======================================================
// VALIDAR AUTENTICACIÓN
// ======================================================

function obtenerUsuarioAutenticado(req, res) {
  if (!req.user?.id_usuario) {
    res.status(401).json({
      message: "Usuario no autenticado.",
    });
    return null;
  }

  return req.user.id_usuario;
}

// ======================================================
// GET CATÁLOGOS
// ======================================================

exports.getCatalogos = async (req, res, next) => {
  try {
    const idUsuario = obtenerUsuarioAutenticado(req, res);
    if (!idUsuario) return;

    const resultado =
      await administracionService.obtenerCatalogos({
        idUsuario,
      });

    return res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

// ======================================================
// GET USUARIOS
// ======================================================

exports.getUsuarios = async (req, res, next) => {
  try {
    const idUsuario = obtenerUsuarioAutenticado(req, res);
    if (!idUsuario) return;

    const resultado =
      await administracionService.obtenerUsuarios({
        idUsuario,
      });

    return res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

// ======================================================
// POST CREAR USUARIO
// ======================================================

exports.crearUsuario = async (req, res, next) => {
  try {
    const idUsuario = obtenerUsuarioAutenticado(req, res);
    if (!idUsuario) return;

    const {
      nombre,
      correo,
      usuario,
      rol_id,
      estado_id,
    } = req.body || {};

    const resultado =
      await administracionService.crearUsuario({
        idUsuarioAutenticado: idUsuario,
        nombre,
        correo,
        usuario,
        rolId: rol_id,
        estadoId: estado_id,
      });

    return res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
};

// ======================================================
// PUT EDITAR USUARIO
// ======================================================

exports.editarUsuario = async (req, res, next) => {
  try {
    const idUsuario = obtenerUsuarioAutenticado(req, res);
    if (!idUsuario) return;

    const { id } = req.params || {};

    const {
      nombre,
      correo,
      usuario,
      rol_id,
      telefono,
    } = req.body || {};

    const resultado =
      await administracionService.editarUsuario({
        idUsuarioAutenticado: idUsuario,
        idUsuarioObjetivo: id,
        nombre,
        correo,
        usuario,
        rolId: rol_id,
        telefono,
      });

    return res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

// ======================================================
// PATCH CAMBIAR ESTADO
// ======================================================

exports.cambiarEstadoUsuario = async (req, res, next) => {
  try {
    const idUsuario = obtenerUsuarioAutenticado(req, res);
    if (!idUsuario) return;

    const { id } = req.params || {};

    const resultado =
      await administracionService.cambiarEstadoUsuario({
        idUsuarioAutenticado: idUsuario,
        idUsuarioObjetivo: id,
      });

    return res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};

// ======================================================
// DELETE USUARIO
// ======================================================

exports.eliminarUsuario = async (req, res, next) => {
  try {
    const idUsuario = obtenerUsuarioAutenticado(req, res);
    if (!idUsuario) return;

    const { id } = req.params || {};

    const resultado =
      await administracionService.eliminarUsuario({
        idUsuarioAutenticado: idUsuario,
        idUsuarioObjetivo: id,
      });

    return res.status(200).json(resultado);
  } catch (error) {
    next(error);
  }
};
