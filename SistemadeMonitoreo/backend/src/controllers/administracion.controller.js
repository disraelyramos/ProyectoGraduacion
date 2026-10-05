const administracionService = require(
  "../services/administracion.service"
);


// =========================================================
// GET CATÁLOGOS DE ADMINISTRACIÓN
// =========================================================

exports.getCatalogos = async (req, res, next) => {
  try {

    /*
     * La identidad proviene del token
     * validado previamente por verifyToken.
     *
     * No se confía en:
     * - usuario_id enviado por frontend
     * - rol_id enviado por frontend
     * - permisos enviados por frontend
     */

    if (
      !req.user ||
      !req.user.id_usuario
    ) {
      return res.status(401).json({
        message:
          "Usuario no autenticado.",
      });
    }


    const catalogos =
      await administracionService.obtenerCatalogos({
        idUsuario:
          req.user.id_usuario,
      });


    return res.status(200).json(
      catalogos
    );

  } catch (error) {
    next(error);
  }
};


// =========================================================
// GET USUARIOS
// =========================================================

exports.getUsuarios = async (req, res, next) => {
  try {

    /*
     * La identidad del usuario autenticado
     * proviene exclusivamente del token.
     *
     * El frontend no determina:
     * - permisos
     * - rol autorizado
     * - si un usuario tiene procesos
     * - qué acciones puede realizar
     *
     * Todas esas reglas se validan
     * nuevamente en el service.
     */

    if (
      !req.user ||
      !req.user.id_usuario
    ) {
      return res.status(401).json({
        message:
          "Usuario no autenticado.",
      });
    }


    const resultado =
      await administracionService.obtenerUsuarios({
        idUsuario:
          req.user.id_usuario,
      });


    return res.status(200).json(
      resultado
    );

  } catch (error) {
    next(error);
  }
};


// =========================================================
// POST CREAR USUARIO
// =========================================================

exports.crearUsuario = async (req, res, next) => {
  try {

    /*
     * La identidad de quien crea al usuario
     * proviene exclusivamente del token.
     *
     * Nunca se confía en un id_usuario,
     * rol o permiso enviado por React.
     */

    if (
      !req.user ||
      !req.user.id_usuario
    ) {
      return res.status(401).json({
        message:
          "Usuario no autenticado.",
      });
    }


    /*
     * Estos datos sí pertenecen
     * al nuevo usuario.
     *
     * El service vuelve a validar:
     * - datos obligatorios
     * - formato de correo
     * - rol existente
     * - estado existente
     * - correo duplicado
     * - usuario duplicado
     * - permiso real del administrador
     */

    const {
      nombre,
      correo,
      usuario,
      rol_id,
      estado_id,
    } = req.body || {};


    const resultado =
      await administracionService.crearUsuario({
        idUsuarioAutenticado:
          req.user.id_usuario,

        nombre,
        correo,
        usuario,

        rolId:
          rol_id,

        estadoId:
          estado_id,
      });


    return res.status(201).json(
      resultado
    );

  } catch (error) {
    next(error);
  }
};

// =========================================================
// PUT EDITAR USUARIO
// =========================================================

exports.editarUsuario = async (req, res, next) => {
  try {

    if (
      !req.user ||
      !req.user.id_usuario
    ) {
      return res.status(401).json({
        message:
          "Usuario no autenticado.",
      });
    }


    const {
      id,
    } = req.params || {};


    const {
      nombre,
      correo,
      usuario,
      rol_id,
    } = req.body || {};


    const resultado =
      await administracionService.editarUsuario({
        idUsuarioAutenticado:
          req.user.id_usuario,

        idUsuarioObjetivo:
          id,

        nombre,
        correo,
        usuario,

        rolId:
          rol_id,
      });


    return res.status(200).json(
      resultado
    );

  } catch (error) {
    next(error);
  }
};

// =========================================================
// PATCH CAMBIAR ESTADO DE USUARIO
// =========================================================

exports.cambiarEstadoUsuario =
  async (req, res, next) => {

    try {

      if (
        !req.user ||
        !req.user.id_usuario
      ) {
        return res.status(401).json({
          message:
            "Usuario no autenticado.",
        });
      }


      const {
        id,
      } = req.params || {};


      const resultado =
        await administracionService
          .cambiarEstadoUsuario({
            idUsuarioAutenticado:
              req.user.id_usuario,

            idUsuarioObjetivo:
              id,
          });


      return res.status(200).json(
        resultado
      );

    } catch (error) {

      next(error);
    }
  };

  // =========================================================
// DELETE USUARIO
// =========================================================

exports.eliminarUsuario =
  async (req, res, next) => {

    try {

      if (
        !req.user ||
        !req.user.id_usuario
      ) {
        return res.status(401).json({
          message:
            "Usuario no autenticado.",
        });
      }


      const {
        id,
      } = req.params || {};


      const resultado =
        await administracionService
          .eliminarUsuario({
            idUsuarioAutenticado:
              req.user.id_usuario,

            idUsuarioObjetivo:
              id,
          });


      return res.status(200).json(
        resultado
      );

    } catch (error) {

      next(error);
    }
  };