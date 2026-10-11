const { spawn } = require("child_process");
const path = require("path");


// ======================================================
// CONFIGURACIÓN
// ======================================================

const PYTHON_BIN =
  process.env.ML_PYTHON_BIN || "python";

const ML_TIMEOUT_MS = Number(
  process.env.ML_TIMEOUT_MS || 15000
);

if (
  !Number.isFinite(ML_TIMEOUT_MS) ||
  ML_TIMEOUT_MS <= 0
) {
  throw new Error(
    "ML_TIMEOUT_MS no está configurado correctamente."
  );
}


const BACKEND_ROOT = path.resolve(
  __dirname,
  "../../.."
);

const PREDICTOR_PATH = path.resolve(
  BACKEND_ROOT,
  "ml",
  "predictor.py"
);


// ======================================================
// VALIDAR RESULTADO INDIVIDUAL
// ======================================================

function validarPrediccion(prediccion) {
  if (
    !prediccion ||
    typeof prediccion !== "object" ||
    Array.isArray(prediccion)
  ) {
    throw new Error(
      "Machine Learning devolvió una predicción inválida."
    );
  }


  if (
    !Number.isInteger(
      prediccion.contenedor_id
    ) ||
    prediccion.contenedor_id <= 0
  ) {
    throw new Error(
      "Machine Learning devolvió un contenedor_id inválido."
    );
  }


  if (
    typeof prediccion.estado !== "string" ||
    !prediccion.estado.trim()
  ) {
    throw new Error(
      "Machine Learning devolvió un estado inválido."
    );
  }


  /*
   * Los siguientes estados pueden no contener
   * datos numéricos de predicción.
   */
  if (prediccion.estado !== "OK") {
    return prediccion;
  }


  const camposNumericos = [
    "nivel_actual",
    "crecimiento_estimado_dia",
    "umbral_aviso",
    "umbral_alto",
    "ciclos_utilizados",
  ];


  for (const campo of camposNumericos) {
    if (
      typeof prediccion[campo] !== "number" ||
      !Number.isFinite(prediccion[campo])
    ) {
      throw new Error(
        `Machine Learning devolvió ${campo} inválido.`
      );
    }
  }


  if (
    prediccion.nivel_actual < 0 ||
    prediccion.nivel_actual > 100
  ) {
    throw new Error(
      "Machine Learning devolvió nivel_actual fuera de rango."
    );
  }


  if (
    prediccion.umbral_aviso <= 0 ||
    prediccion.umbral_aviso > 100
  ) {
    throw new Error(
      "Machine Learning devolvió umbral_aviso fuera de rango."
    );
  }


  if (
    prediccion.umbral_alto <=
      prediccion.umbral_aviso ||
    prediccion.umbral_alto > 100
  ) {
    throw new Error(
      "Machine Learning devolvió umbrales inconsistentes."
    );
  }


  if (
    typeof prediccion.alertas_activas !==
    "boolean"
  ) {
    throw new Error(
      "Machine Learning devolvió alertas_activas inválido."
    );
  }


  const riesgosPermitidos = [
    "BAJO",
    "MEDIO",
    "ALTO",
    "SIN_DATOS",
  ];


  if (
    !riesgosPermitidos.includes(
      prediccion.riesgo
    )
  ) {
    throw new Error(
      "Machine Learning devolvió un riesgo no permitido."
    );
  }


  for (const campo of [
    "dias_para_aviso",
    "dias_para_alto",
  ]) {
    const valor =
      prediccion[campo];

    if (
      valor !== null &&
      (
        typeof valor !== "number" ||
        !Number.isFinite(valor) ||
        valor < 0
      )
    ) {
      throw new Error(
        `Machine Learning devolvió ${campo} inválido.`
      );
    }
  }


  return prediccion;
}


// ======================================================
// VALIDAR RESPUESTA COMPLETA
// ======================================================

function validarResultado(resultado) {
  if (!Array.isArray(resultado)) {
    throw new Error(
      "La respuesta de Machine Learning no es un arreglo."
    );
  }


  return resultado.map(
    validarPrediccion
  );
}


// ======================================================
// EJECUTAR MACHINE LEARNING
// ======================================================

function ejecutarPrediccion() {
  return new Promise(
    (resolve, reject) => {

      const proceso = spawn(
        PYTHON_BIN,
        [PREDICTOR_PATH],
        {
          cwd: BACKEND_ROOT,
          windowsHide: true,
        }
      );


      let salida = "";
      let errorSalida = "";
      let finalizado = false;


      const timeout = setTimeout(
        () => {

          if (finalizado) {
            return;
          }

          finalizado = true;

          proceso.kill();

          reject(
            new Error(
              `El proceso de Machine Learning superó ${ML_TIMEOUT_MS} ms.`
            )
          );

        },
        ML_TIMEOUT_MS
      );


      proceso.stdout.on(
        "data",
        (data) => {
          salida +=
            data.toString();
        }
      );


      proceso.stderr.on(
        "data",
        (data) => {
          errorSalida +=
            data.toString();
        }
      );


      proceso.on(
        "error",
        (error) => {

          if (finalizado) {
            return;
          }

          finalizado = true;

          clearTimeout(
            timeout
          );

          reject(
            new Error(
              `No fue posible ejecutar Machine Learning: ${error.message}`
            )
          );
        }
      );


      proceso.on(
        "close",
        (codigo) => {

          if (finalizado) {
            return;
          }

          finalizado = true;

          clearTimeout(
            timeout
          );


          if (codigo !== 0) {
            return reject(
              new Error(
                errorSalida.trim() ||
                `Machine Learning terminó con código ${codigo}.`
              )
            );
          }


          if (!salida.trim()) {
            return reject(
              new Error(
                "Machine Learning no devolvió resultados."
              )
            );
          }


          try {
            const resultado =
              JSON.parse(
                salida.trim()
              );

            const resultadoValidado =
              validarResultado(
                resultado
              );

            resolve(
              resultadoValidado
            );

          } catch (error) {

            reject(
              new Error(
                `Respuesta inválida de Machine Learning: ${error.message}`
              )
            );
          }
        }
      );
    }
  );
}


// ======================================================
// EXPORTAR
// ======================================================

module.exports = {
  ejecutarPrediccion,
};