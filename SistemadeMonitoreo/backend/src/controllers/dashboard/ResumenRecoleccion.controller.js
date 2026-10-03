const {
  consultarResumenRecoleccion,
} = require(
  "../../services/dashboard/ResumenRecoleccion.service"
);

exports.obtenerResumen = async (req, res) => {
  try {
    const idUsuario = Number(
      req.user?.id_usuario
    );

    if (
      !Number.isSafeInteger(idUsuario) ||
      idUsuario <= 0
    ) {
      return res.status(401).json({
        message: "Su sesión no es válida.",
      });
    }

    const data =
      await consultarResumenRecoleccion();

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    console.error(
      "Error consultando resumen de recolección:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        "No fue posible consultar el resumen de recolección.",
    });
  }
};