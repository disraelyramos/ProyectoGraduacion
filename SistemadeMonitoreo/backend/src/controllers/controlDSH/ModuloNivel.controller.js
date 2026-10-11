const moduloNivelService = require(
  "../../services/controlDSH/mediciones/ModuloNivelComunicacion.service"
);


// ======================================================
// REGISTRAR NIVEL DESDE EL ESP8266
// ======================================================

exports.registrarNivel = async (
  req,
  res,
  next
) => {

  try {

    const moduloCodigo =
      String(
        req.modulo?.codigo ||
        req.moduloCodigo ||
        req.headers[
          "x-modulo-codigo"
        ] ||
        ""
      )
        .trim();


    const porcentaje =
      Number(
        req.body?.porcentaje
      );


    const resultado =
      await moduloNivelService
        .registrarNivel({

          moduloCodigo,

          porcentaje,

        });


    return res
      .status(200)
      .json(resultado);


  } catch (error) {

    next(error);
  }
};