
"use strict";

const { spawn } = require("child_process");
const path = require("path");

// ======================================================
// CONFIGURACIÓN
// ======================================================

const PYTHON_BIN =
  process.env.ML_PYTHON_BIN ||
  (process.platform === "win32" ? "python" : "python3");

const ML_TIMEOUT_MS = Number(
  process.env.ML_TIMEOUT_MS || 15000
);

const ML_MIN_CRECIMIENTO_DIA = Number(
  process.env.ML_MIN_CRECIMIENTO_DIA || 0.1
);

const ML_MAX_DIAS_PREDICCION = Number(
  process.env.ML_MAX_DIAS_PREDICCION || 3650
);

if (
  !Number.isFinite(ML_TIMEOUT_MS) ||
  ML_TIMEOUT_MS <= 0 ||
  !Number.isFinite(ML_MIN_CRECIMIENTO_DIA) ||
  ML_MIN_CRECIMIENTO_DIA <= 0 ||
  ML_MIN_CRECIMIENTO_DIA > 100 ||
  !Number.isFinite(ML_MAX_DIAS_PREDICCION) ||
  ML_MAX_DIAS_PREDICCION <= 0
) {
  throw new Error(
    "Configuración de Machine Learning inválida."
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
    typeof dias !== "number" ||
    !Number.isFinite(dias) ||
    dias < 0 ||
    dias > ML_MAX_DIAS_PREDICCION
  ) {
    return null;
  }

  if (dias === 0) {
    return "Nivel alto alcanzado";
  }

  const minutosTotales = Math.round(dias * 24 * 60);

  if (minutosTotales < 60) {
    return `${Math.max(minutosTotales, 1)} min`;
  }

  const horasTotales = Math.round(minutosTotales / 60);
  const diasEnteros = Math.floor(horasTotales / 24);
  const horasRestantes = horasTotales % 24;

  if (diasEnteros === 0) {
    return horasRestantes === 1
      ? "1 hora"
      : `${horasRestantes} horas`;
  }

  const textoDias =
    diasEnteros === 1
      ? "1 día"
      : `${diasEnteros} días`;

  if (horasRestantes === 0) {
    return textoDias;
  }

  const textoHoras =
    horasRestantes === 1
      ? "1 hora"
      : `${horasRestantes} horas`;

  return `${textoDias} y ${textoHoras}`;
}

// ======================================================
// CONSTRUIR PREDICCIÓN NO CONFIABLE
// ======================================================

function prediccionNoConfiable(prediccion) {
  return {
    ...prediccion,
    estado: "PREDICCION_NO_CONFIABLE",
    dias_para_aviso: null,
    dias_para_alto: null,
    riesgo: "SIN_DATOS",
    tiempo_para_aviso_texto: null,
    tiempo_para_alto_texto: null,
  };
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
    !Number.isInteger(prediccion.contenedor_id) ||
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

  if (prediccion.estado !== "OK") {
    return {
      ...prediccion,
      tiempo_para_aviso_texto: null,
      tiempo_para_alto_texto: null,
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

  // ====================================================
  // VALIDAR NIVEL ACTUAL
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
  // VALIDAR UMBRALES
  // ====================================================

  if (
    prediccion.umbral_aviso <= 0 ||
    prediccion.umbral_aviso > 100 ||
    prediccion.umbral_alto <= prediccion.umbral_aviso ||
    prediccion.umbral_alto > 100
  ) {
    throw new Error(
      "Machine Learning devolvió umbrales inconsistentes."
    );
  }

  // ====================================================
  // ESTADO DE ALERTAS
  // ====================================================

  if (typeof prediccion.alertas_activas !== "boolean") {
    throw new Error(
      "Machine Learning devolvió alertas_activas inválido."
    );
  }

  // ====================================================
  // VALIDAR CICLOS UTILIZADOS
  // ====================================================

  if (
    !Number.isInteger(prediccion.ciclos_utilizados) ||
    prediccion.ciclos_utilizados < 1
  ) {
    throw new Error(
      "Machine Learning devolvió ciclos_utilizados inválido."
    );
  }

  // ====================================================
  // VALIDAR RIESGO
  // ====================================================

  const riesgosPermitidos = [
    "BAJO",
    "MEDIO",
    "ALTO",
    "SIN_DATOS",
  ];

  if (!riesgosPermitidos.includes(prediccion.riesgo)) {
    throw new Error(
      "Machine Learning devolvió un riesgo no permitido."
    );
  }

  // ====================================================
  // VALIDAR TIEMPOS
  // ====================================================

  for (const campo of [
    "dias_para_aviso",
    "dias_para_alto",
  ]) {
    const valor = prediccion[campo];

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
  // RECHAZAR CRECIMIENTO INSIGNIFICANTE
  // ====================================================

  if (
    prediccion.nivel_actual < prediccion.umbral_alto &&
    prediccion.crecimiento_estimado_dia <
      ML_MIN_CRECIMIENTO_DIA
  ) {
    return prediccionNoConfiable(prediccion);
  }

  // ====================================================
  // RECHAZAR PREDICCIONES EXCESIVAS O SIN TIEMPO
  // ====================================================

  if (
    prediccion.dias_para_alto === null ||
    prediccion.dias_para_alto >
      ML_MAX_DIAS_PREDICCION ||
    (
      prediccion.dias_para_aviso !== null &&
      prediccion.dias_para_aviso >
        ML_MAX_DIAS_PREDICCION
    )
  ) {
    return prediccionNoConfiable(prediccion);
  }

  // ====================================================
  // RESPUESTA ENRIQUECIDA
  // ====================================================

  return {
    ...prediccion,

    tiempo_para_aviso_texto:
      formatearTiempoDias(prediccion.dias_para_aviso),

    tiempo_para_alto_texto:
      formatearTiempoDias(prediccion.dias_para_alto),
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

  return resultado.map(validarPrediccion);
}

// ======================================================
// EJECUTAR MACHINE LEARNING
// ======================================================

function ejecutarPrediccion() {
  return new Promise((resolve, reject) => {
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

    // ==================================================
    // TIMEOUT
    // ==================================================

    const timeout = setTimeout(() => {
      if (finalizado) return;

      finalizado = true;
      proceso.kill();

      reject(
        new Error(
          `El proceso de Machine Learning superó ${ML_TIMEOUT_MS} ms.`
        )
      );
    }, ML_TIMEOUT_MS);

    // ==================================================
    // STDOUT
    // ==================================================

    proceso.stdout.on("data", (data) => {
      salida += data.toString();
    });

    // ==================================================
    // STDERR
    // ==================================================

    proceso.stderr.on("data", (data) => {
      errorSalida += data.toString();
    });

    // ==================================================
    // ERROR AL EJECUTAR PYTHON
    // ==================================================

    proceso.on("error", (error) => {
      if (finalizado) return;

      finalizado = true;
      clearTimeout(timeout);

      reject(
        new Error(
          `No fue posible ejecutar Machine Learning: ${error.message}`
        )
      );
    });

    // ==================================================
    // PROCESO FINALIZADO
    // ==================================================

    proceso.on("close", (codigo) => {
      if (finalizado) return;

      finalizado = true;
      clearTimeout(timeout);

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

      // ================================================
      // PROCESAR JSON
      // ================================================

      try {
        const resultado = JSON.parse(salida.trim());

        const resultadoValidado =
          validarResultado(resultado);

        resolve(resultadoValidado);
      } catch (error) {
        reject(
          new Error(
            `Respuesta inválida de Machine Learning: ${error.message}`
          )
        );
      }
    });
  });
}

// ======================================================
// EXPORTAR
// ======================================================

module.exports = {
  ejecutarPrediccion,
};
