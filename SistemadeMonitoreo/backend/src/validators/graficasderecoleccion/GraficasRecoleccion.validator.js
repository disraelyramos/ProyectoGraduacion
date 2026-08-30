// backend/src/validators/graficasderecoleccion/GraficasRecoleccion.validator.js


/* =========================================================
   CONSTANTES
   ========================================================= */

const ANIO_MINIMO = 2000;
const ANIO_MAXIMO = 3000;

const CUATRIMESTRES_PERMITIDOS =
  new Set([
    1,
    2,
    3,
  ]);


/* =========================================================
   ERROR DE VALIDACIÓN
   ========================================================= */

function errorValidacion(
  message,
  {
    field = null,
    code = "VALIDATION_ERROR",
  } = {}
) {
  return {
    ok: false,

    status: 400,

    error: {
      message,

      type:
        "validation",

      code,

      ...(field
        ? {
            field,
          }
        : {}),
    },
  };
}


/* =========================================================
   TEXTO LIMPIO
   ========================================================= */

function textoLimpio(
  valor
) {
  if (
    valor === null ||
    valor === undefined
  ) {
    return "";
  }


  return String(
    valor
  ).trim();
}


/* =========================================================
   ENTERO ESTRICTO

   Acepta:
   2026
   "2026"
   1
   "1"

   Rechaza:
   "2026abc"
   "20.26"
   "-2026"
   ""
   null
   undefined
   ========================================================= */

function enteroPositivoEstricto(
  valor
) {
  const texto =
    textoLimpio(
      valor
    );


  if (
    !/^\d+$/.test(
      texto
    )
  ) {
    return null;
  }


  const numero =
    Number(
      texto
    );


  if (
    !Number.isSafeInteger(
      numero
    ) ||
    numero <= 0
  ) {
    return null;
  }


  return numero;
}


/* =========================================================
   VALIDAR FILTROS CUATRIMESTRALES

   IMPORTANTE:

   El frontend solamente envía criterios.

   El backend valida y normaliza los valores antes de que
   puedan llegar al Service o a PostgreSQL.
   ========================================================= */

function buildValidatedFilters({
  source,
}) {

  /* =======================================================
     SOURCE
     ======================================================= */

  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(
      source
    )
  ) {
    return errorValidacion(
      "Los datos enviados para consultar las gráficas no son válidos."
    );
  }


  /* =======================================================
     AÑO REQUERIDO
     ======================================================= */

  const anioTexto =
    textoLimpio(
      source.anio
    );


  if (!anioTexto) {
    return errorValidacion(
      "Seleccione el año que desea consultar.",
      {
        field:
          "anio",

        code:
          "ANIO_REQUIRED",
      }
    );
  }


  const anio =
    enteroPositivoEstricto(
      anioTexto
    );


  if (
    anio === null ||
    anio < ANIO_MINIMO ||
    anio > ANIO_MAXIMO
  ) {
    return errorValidacion(
      `El año seleccionado no es válido. Debe estar entre ${ANIO_MINIMO} y ${ANIO_MAXIMO}.`,
      {
        field:
          "anio",

        code:
          "ANIO_INVALIDO",
      }
    );
  }


  /* =======================================================
     CUATRIMESTRE REQUERIDO
     ======================================================= */

  const cuatrimestreTexto =
    textoLimpio(
      source.cuatrimestre
    );


  if (!cuatrimestreTexto) {
    return errorValidacion(
      "Seleccione el cuatrimestre que desea consultar.",
      {
        field:
          "cuatrimestre",

        code:
          "CUATRIMESTRE_REQUIRED",
      }
    );
  }


  const cuatrimestre =
    enteroPositivoEstricto(
      cuatrimestreTexto
    );


  if (
    cuatrimestre === null ||
    !CUATRIMESTRES_PERMITIDOS.has(
      cuatrimestre
    )
  ) {
    return errorValidacion(
      "El cuatrimestre seleccionado no es válido. Seleccione Primer, Segundo o Tercer cuatrimestre.",
      {
        field:
          "cuatrimestre",

        code:
          "CUATRIMESTRE_INVALIDO",
      }
    );
  }


  /* =======================================================
     FILTROS NORMALIZADOS

     No confiamos en los valores originales de req.query.

     A partir de aquí solamente deben utilizarse estos
     valores normalizados.
     ======================================================= */

  return {
    ok: true,

    filters: {
      anio,
      cuatrimestre,
    },
  };
}


/* =========================================================
   EXPORTACIÓN
   ========================================================= */

module.exports = {
  buildValidatedFilters,
};