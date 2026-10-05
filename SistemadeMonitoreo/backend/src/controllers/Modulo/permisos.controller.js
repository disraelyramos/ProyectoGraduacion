const permisosService = require(
  "../../services/Modulo/permisos.service"
);


// ======================================================
// OBTENER CATÁLOGO DE ROLES, MÓDULOS Y SUBMÓDULOS
// ======================================================

exports.getCatalogo = async (
  req,
  res,
  next
) => {

  try {

    if (
      !req.user ||
      !req.user.id_usuario
    ) {
      return res
        .status(401)
        .json({
          message:
            "Usuario no autenticado.",
        });
    }


    const resultado =
      await permisosService.obtenerCatalogo({
        idUsuario:
          req.user.id_usuario,
      });


    return res
      .status(200)
      .json(resultado);


  } catch (error) {

    next(error);
  }
};


// ======================================================
// OBTENER PERMISOS ACTUALES DE UN ROL
// ======================================================

exports.getPermisosRol = async (
  req,
  res,
  next
) => {

  try {

    if (
      !req.user ||
      !req.user.id_usuario
    ) {
      return res
        .status(401)
        .json({
          message:
            "Usuario no autenticado.",
        });
    }


    const {
      id,
    } = req.params || {};


    const resultado =
      await permisosService.obtenerPermisosRol({
        idUsuario:
          req.user.id_usuario,

        rolId:
          id,
      });


    return res
      .status(200)
      .json(resultado);


  } catch (error) {

    next(error);
  }
};

// ======================================================
// ACTUALIZAR PERMISOS DE UN ROL
// ======================================================

exports.updatePermisosRol = async (
  req,
  res,
  next
) => {

  try {

    if (
      !req.user ||
      !req.user.id_usuario
    ) {
      return res
        .status(401)
        .json({
          message:
            "Usuario no autenticado.",
        });
    }


    const {
      id,
    } = req.params || {};


    const {
      permisos,
    } = req.body || {};


    const resultado =
      await permisosService.actualizarPermisosRol({
        idUsuario:
          req.user.id_usuario,

        rolId:
          id,

        permisos,
      });


    return res
      .status(200)
      .json(resultado);


  } catch (error) {

    next(error);
  }
};