const { spawn } = require("child_process");
const path = require("path");


// ======================================================
// CONFIGURACIÓN
// ======================================================

const PYTHON_BIN =
  process.env.ML_PYTHON_BIN ||
  (
    process.platform === "win32"
      ? "python"
      : "python3"
  );

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
// FORMATEAR TIEMPO PARA EL USUARIO
// ======================================================

function formatearTiempoDias(dias) {

  if (
    dias === null ||
    typeof dias !== "number" ||
    !Number.isFinite(dias) ||
    dias < 0
  ) {
    return null;
  }


  // ====================================================
  // UMBRAL YA ALCANZADO
  // ====================================================

  if (dias === 0) {
    return "Nivel alto alcanzado";
  }


  const minutosTotales =
    Math.round(
      dias * 24 * 60
    );


  // ====================================================
  // MENOS DE UNA HORA
  // ====================================================

  if (minutosTotales < 60) {

    return `${Math.max(
      minutosTotales,
      1
    )} min`;
  }


  let horasTotales =
    Math.round(
      minutosTotales / 60
    );


  let diasEnteros =
    Math.floor(
      horasTotales / 24
    );

  let horasRestantes =
    horasTotales % 24;


  // ====================================================
  // MENOS DE UN DÍA
  // ====================================================

  if (diasEnteros === 0) {

    return horasRestantes === 1
      ? "1 hora"
      : `${horasRestantes} horas`;
  }


  // ====================================================
  // DÍAS EXACTOS
  // ====================================================

  if (horasRestantes === 0) {

    return diasEnteros === 1
      ? "1 día"
      : `${diasEnteros} días`;
  }


  // ====================================================
  // DÍAS + HORAS
  // ====================================================

  const textoDias =
    diasEnteros === 1
      ? "1 día"
      : `${diasEnteros} días`;

  const textoHoras =
    horasRestantes === 1
      ? "1 hora"
      : `${horasRestantes} horas`;


  return `${textoDias} y ${textoHoras}`;
}


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


  // ====================================================
  // ESTADOS SIN PREDICCIÓN DISPONIBLE
  // ====================================================

  if (
    prediccion.estado !== "OK"
  ) {

    return {
      ...prediccion,

      tiempo_para_aviso_texto:
        null,

      tiempo_para_alto_texto:
        null,
    };
  }


  // ====================================================
  // CAMPOS NUMÉRICOS OBLIGATORIOS
  // ====================================================

  const camposNumericos = [
    "nivel_actual",
    "crecimiento_estimado_dia",
    "umbral_aviso",
    "umbral_alto",
    "ciclos_utilizados",
  ];


  for (
    const campo
    of camposNumericos
  ) {

    if (
      typeof prediccion[campo] !==
        "number" ||
      !Number.isFinite(
        prediccion[campo]
      )
    ) {
      throw new Error(
        `Machine Learning devolvió ${campo} inválido.`
      );
    }
  }


  // ====================================================
  // NIVEL ACTUAL
  // ====================================================

  if (
    prediccion.nivel_actual < 0 ||
    prediccion.nivel_actual > 100
  ) {
    throw new Error(
      "Machine Learning devolvió nivel_actual fuera de rango."
    );
  }


  // ====================================================
  // UMBRAL DE AVISO
  // ====================================================

  if (
    prediccion.umbral_aviso <= 0 ||
    prediccion.umbral_aviso > 100
  ) {
    throw new Error(
      "Machine Learning devolvió umbral_aviso fuera de rango."
    );
  }


  // ====================================================
  // UMBRAL ALTO
  // ====================================================

  if (
    prediccion.umbral_alto <=
      prediccion.umbral_aviso ||
    prediccion.umbral_alto > 100
  ) {
    throw new Error(
      "Machine Learning devolvió umbrales inconsistentes."
    );
  }


  // ====================================================
  // ESTADO DE ALERTAS
  // ====================================================

  if (
    typeof prediccion.alertas_activas !==
    "boolean"
  ) {
    throw new Error(
      "Machine Learning devolvió alertas_activas inválido."
    );
  }


  // ====================================================
  // RIESGO
  // ====================================================

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


  // ====================================================
  // TIEMPOS
  // ====================================================

  for (
    const campo
    of [
      "dias_para_aviso",
      "dias_para_alto",
    ]
  ) {

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


  // ====================================================
  // RESPUESTA ENRIQUECIDA POR EL BACKEND
  // ====================================================

  return {

    ...prediccion,


    tiempo_para_aviso_texto:
      formatearTiempoDias(
        prediccion
          .dias_para_aviso
      ),


    tiempo_para_alto_texto:
      formatearTiempoDias(
        prediccion
          .dias_para_alto
      ),

  };
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
    (
      resolve,
      reject
    ) => {

      const proceso =
        spawn(
          PYTHON_BIN,
          [
            PREDICTOR_PATH,
          ],
          {
            cwd:
              BACKEND_ROOT,

            windowsHide:
              true,
          }
        );


      let salida = "";

      let errorSalida = "";

      let finalizado =
        false;


      // ==================================================
      // TIMEOUT
      // ==================================================

      const timeout =
        setTimeout(
          () => {

            if (
              finalizado
            ) {
              return;
            }


            finalizado =
              true;


            proceso.kill();


            reject(
              new Error(
                `El proceso de Machine Learning superó ${ML_TIMEOUT_MS} ms.`
              )
            );

          },
          ML_TIMEOUT_MS
        );


      // ==================================================
      // STDOUT
      // ==================================================

      proceso.stdout.on(
        "data",
        (data) => {

          salida +=
            data.toString();
        }
      );


      // ==================================================
      // STDERR
      // ==================================================

      proceso.stderr.on(
        "data",
        (data) => {

          errorSalida +=
            data.toString();
        }
      );


      // ==================================================
      // ERROR AL EJECUTAR PYTHON
      // ==================================================

      proceso.on(
        "error",
        (error) => {

          if (
            finalizado
          ) {
            return;
          }


          finalizado =
            true;


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


      // ==================================================
      // PROCESO FINALIZADO
      // ==================================================

      proceso.on(
        "close",
        (codigo) => {

          if (
            finalizado
          ) {
            return;
          }


          finalizado =
            true;


          clearTimeout(
            timeout
          );


          // ================================================
          // ERROR DE PYTHON
          // ================================================

          if (
            codigo !== 0
          ) {

            return reject(
              new Error(
                errorSalida.trim() ||
                `Machine Learning terminó con código ${codigo}.`
              )
            );
          }


          // ================================================
          // SIN RESPUESTA
          // ================================================

          if (
            !salida.trim()
          ) {

            return reject(
              new Error(
                "Machine Learning no devolvió resultados."
              )
            );
          }


          // ================================================
          // PROCESAR JSON
          // ================================================

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