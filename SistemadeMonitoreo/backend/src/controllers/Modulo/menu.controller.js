const menuService = require(
  "../../services/Modulo/menu.service"
);


// ======================================================
// OBTENER MENÚ DEL USUARIO AUTENTICADO
// ======================================================

exports.getMenu = async (
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


    const menu =
      await menuService.obtenerMenuUsuario({
        idUsuario:
          req.user.id_usuario,
      });


    return res
      .status(200)
      .json(menu);

  } catch (error) {

    next(error);
  }
};