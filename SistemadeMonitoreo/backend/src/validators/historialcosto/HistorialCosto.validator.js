// backend/src/validators/historialcosto/HistorialCosto.validator.js


/* =========================================================
   CONSTANTES
   ========================================================= */

const AGRUPACIONES_PERMITIDAS =
  new Set([
    "semana",
    "mes",
    "anio",
  ]);


const ORDENES_PERMITIDOS =
  new Set([
    "asc",
    "desc",
  ]);


const PAGE_DEFAULT = 1;
const PAGE_MAX = 1_000_000;

const LIMIT_DEFAULT = 10;
const LIMIT_MAX = 100;


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
   ENTERO POSITIVO ESTRICTO

   Válidos:
   "1"
   "25"
   25

   Inválidos:
   "12abc"
   "1.5"
   "-5"
   "0"
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
   ENTERO EN RANGO
   ========================================================= */

function enteroEnRango(
  valor,
  {
    defaultValue,
    min,
    max,
  }
) {
  const texto =
    textoLimpio(
      valor
    );


  /*
    Si no fue enviado, usamos el valor por defecto.
  */

  if (!texto) {
    return {
      ok: true,
      value: defaultValue,
    };
  }


  const numero =
    enteroPositivoEstricto(
      texto
    );


  if (
    numero === null ||
    numero < min ||
    numero > max
  ) {
    return {
      ok: false,
      value: null,
    };
  }


  return {
    ok: true,
    value: numero,
  };
}


/* =========================================================
   AGRUPACIÓN
   ========================================================= */

function normalizarAgrupacion(
  valor
) {
  const texto =
    textoLimpio(
      valor
    )
      .toLowerCase();


  /*
    Por compatibilidad:
    si no viene, mantenemos mes como valor por defecto.
  */

  if (!texto) {
    return {
      ok: true,
      value: "mes",
    };
  }


  const normalizado =
    texto === "año"
      ? "anio"
      : texto;


  if (
    !AGRUPACIONES_PERMITIDAS.has(
      normalizado
    )
  ) {
    return {
      ok: false,

      error:
        errorValidacion(
          "La opción de agrupación seleccionada no es válida. Seleccione Semana, Mes o Año.",
          {
            field:
              "agruparPor",
          }
        ),
    };
  }


  return {
    ok: true,
    value: normalizado,
  };
}


/* =========================================================
   ORDEN
   ========================================================= */

function normalizarOrden(
  valor
) {
  const texto =
    textoLimpio(
      valor
    )
      .toLowerCase();


  if (!texto) {
    return {
      ok: true,
      value: "DESC",
    };
  }


  if (
    !ORDENES_PERMITIDOS.has(
      texto
    )
  ) {
    return {
      ok: false,

      error:
        errorValidacion(
          "El orden seleccionado no es válido.",
          {
            field:
              "order",
          }
        ),
    };
  }


  return {
    ok: true,

    value:
      texto === "asc"
        ? "ASC"
        : "DESC",
  };
}


/* =========================================================
   VALIDAR FECHA ISO YYYY-MM-DD
   ========================================================= */

function isValidISODate(
  valor
) {
  const texto =
    textoLimpio(
      valor
    );


  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/
      .exec(
        texto
      );


  if (!match) {
    return false;
  }


  const year =
    Number(
      match[1]
    );

  const month =
    Number(
      match[2]
    );

  const day =
    Number(
      match[3]
    );


  const fecha =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );


  return (
    fecha.getUTCFullYear() === year &&
    fecha.getUTCMonth() === month - 1 &&
    fecha.getUTCDate() === day
  );
}


/* =========================================================
   PARSEAR FECHA ISO

   Trabajamos con UTC únicamente para reglas de calendario.
   Así la zona horaria del servidor no altera lunes,
   domingo, fin de mes, etc.
   ========================================================= */

function parseISODate(
  valor
) {
  const [
    year,
    month,
    day,
  ] =
    String(
      valor
    )
      .split("-")
      .map(Number);


  return new Date(
    Date.UTC(
      year,
      month - 1,
      day
    )
  );
}


/* =========================================================
   FORMATEAR DD/MM/YYYY
   ========================================================= */

function formatoUsuario(
  fecha
) {
  const day =
    String(
      fecha.getUTCDate()
    ).padStart(
      2,
      "0"
    );


  const month =
    String(
      fecha.getUTCMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const year =
    fecha.getUTCFullYear();


  return `${day}/${month}/${year}`;
}


/* =========================================================
   DIFERENCIA INCLUSIVA EN DÍAS
   ========================================================= */

function diferenciaDiasInclusiva(
  inicio,
  fin
) {
  const MS_PER_DAY =
    24 *
    60 *
    60 *
    1000;


  return (
    Math.floor(
      (
        fin.getTime() -
        inicio.getTime()
      ) /
      MS_PER_DAY
    ) + 1
  );
}


/* =========================================================
   SUMAR DÍAS UTC
   ========================================================= */

function sumarDias(
  fecha,
  dias
) {
  const copia =
    new Date(
      fecha.getTime()
    );


  copia.setUTCDate(
    copia.getUTCDate() +
    dias
  );


  return copia;
}


/* =========================================================
   PROPONER SEMANA COMPLETA

   Si la fecha seleccionada no es lunes, buscamos el
   siguiente lunes y mostramos lunes-domingo.

   Ejemplo:

   01/08/2026 sábado
       ↓
   03/08/2026 lunes
       ↓
   09/08/2026 domingo
   ========================================================= */

function ejemploSemana(
  fechaInicio
) {
  /*
    JS:
    domingo = 0
    lunes   = 1
    ...
    sábado  = 6
  */

  const diaSemana =
    fechaInicio.getUTCDay();


  let diasHastaLunes =
    0;


  if (
    diaSemana !== 1
  ) {
    diasHastaLunes =
      diaSemana === 0
        ? 1
        : 8 - diaSemana;
  }


  const lunes =
    sumarDias(
      fechaInicio,
      diasHastaLunes
    );


  const domingo =
    sumarDias(
      lunes,
      6
    );


  return {
    lunes,
    domingo,
  };
}


/* =========================================================
   PROPONER MES COMPLETO
   ========================================================= */

function ejemploMes(
  fechaInicio
) {
  const year =
    fechaInicio.getUTCFullYear();


  const month =
    fechaInicio.getUTCMonth();


  const primero =
    new Date(
      Date.UTC(
        year,
        month,
        1
      )
    );


  /*
    Día 0 del mes siguiente = último día del mes actual.
  */

  const ultimo =
    new Date(
      Date.UTC(
        year,
        month + 1,
        0
      )
    );


  return {
    primero,
    ultimo,
  };
}


/* =========================================================
   PROPONER AÑO COMPLETO
   ========================================================= */

function ejemploAnio(
  fechaInicio
) {
  const year =
    fechaInicio.getUTCFullYear();


  return {
    primero:
      new Date(
        Date.UTC(
          year,
          0,
          1
        )
      ),

    ultimo:
      new Date(
        Date.UTC(
          year,
          11,
          31
        )
      ),

    year,
  };
}


/* =========================================================
   VALIDAR RANGO SEGÚN AGRUPACIÓN
   ========================================================= */

function validateDateRangeByGroup({
  fechaInicio,
  fechaFin,
  agruparPor,
}) {

  /* =======================================================
     FECHAS REQUERIDAS
     ======================================================= */

  if (
    !fechaInicio &&
    !fechaFin
  ) {
    return errorValidacion(
      "Seleccione la fecha de inicio y la fecha de fin del reporte.",
      {
        field:
          "fechaInicio",
      }
    );
  }


  if (!fechaInicio) {
    return errorValidacion(
      "Seleccione la fecha de inicio del reporte.",
      {
        field:
          "fechaInicio",
      }
    );
  }


  if (!fechaFin) {
    return errorValidacion(
      "Seleccione la fecha de fin del reporte.",
      {
        field:
          "fechaFin",
      }
    );
  }


  /* =======================================================
     FORMATO DE FECHAS
     ======================================================= */

  if (
    !isValidISODate(
      fechaInicio
    )
  ) {
    return errorValidacion(
      "La fecha de inicio no es válida. Seleccione una fecha correcta.",
      {
        field:
          "fechaInicio",
      }
    );
  }


  if (
    !isValidISODate(
      fechaFin
    )
  ) {
    return errorValidacion(
      "La fecha de fin no es válida. Seleccione una fecha correcta.",
      {
        field:
          "fechaFin",
      }
    );
  }


  const inicio =
    parseISODate(
      fechaInicio
    );


  const fin =
    parseISODate(
      fechaFin
    );


  /* =======================================================
     INICIO NO PUEDE SER MAYOR QUE FIN
     ======================================================= */

  if (
    inicio.getTime() >
    fin.getTime()
  ) {
    return errorValidacion(
      "La fecha de inicio no puede ser posterior a la fecha de fin. Revise el rango seleccionado.",
      {
        field:
          "fechaInicio",
      }
    );
  }


  /* =======================================================
     SEMANA

     Debe ser:
     lunes → domingo
     exactamente 7 días
     ======================================================= */

  if (
    agruparPor ===
    "semana"
  ) {
    const ejemplo =
      ejemploSemana(
        inicio
      );


    const mensajeSemana =
      `Para consultar por semana, seleccione una semana completa de lunes a domingo. ` +
      `Por ejemplo: del ${formatoUsuario(
        ejemplo.lunes
      )} al ${formatoUsuario(
        ejemplo.domingo
      )}.`;


    /*
      Inicio debe ser lunes.
    */

    if (
      inicio.getUTCDay() !==
      1
    ) {
      return errorValidacion(
        mensajeSemana,
        {
          field:
            "fechaInicio",
        }
      );
    }


    /*
      Fin debe ser domingo.
    */

    if (
      fin.getUTCDay() !==
      0
    ) {
      return errorValidacion(
        mensajeSemana,
        {
          field:
            "fechaFin",
        }
      );
    }


    /*
      Debe abarcar exactamente 7 días.
    */

    if (
      diferenciaDiasInclusiva(
        inicio,
        fin
      ) !== 7
    ) {
      return errorValidacion(
        mensajeSemana,
        {
          field:
            "fechaFin",
        }
      );
    }


    return {
      ok: true,
    };
  }


  /* =======================================================
     MES

     Debe ser:
     primer día → último día
     del mismo mes
     ======================================================= */

  if (
    agruparPor ===
    "mes"
  ) {
    const ejemplo =
      ejemploMes(
        inicio
      );


    const mensajeMes =
      `Para consultar por mes, seleccione un mes completo desde el primer hasta el último día del mismo mes. ` +
      `Para el mes seleccionado, utilice del ${formatoUsuario(
        ejemplo.primero
      )} al ${formatoUsuario(
        ejemplo.ultimo
      )}.`;


    /*
      Deben pertenecer al mismo año y mes.
    */

    const mismoMes =
      inicio.getUTCFullYear() ===
        fin.getUTCFullYear() &&
      inicio.getUTCMonth() ===
        fin.getUTCMonth();


    if (!mismoMes) {
      return errorValidacion(
        mensajeMes,
        {
          field:
            "fechaFin",
        }
      );
    }


    /*
      Inicio debe ser día 1.
    */

    if (
      inicio.getUTCDate() !==
      1
    ) {
      return errorValidacion(
        mensajeMes,
        {
          field:
            "fechaInicio",
        }
      );
    }


    /*
      Fin debe ser último día del mes.
    */

    if (
      fin.getUTCDate() !==
      ejemplo.ultimo.getUTCDate()
    ) {
      return errorValidacion(
        mensajeMes,
        {
          field:
            "fechaFin",
        }
      );
    }


    return {
      ok: true,
    };
  }


  /* =======================================================
     AÑO

     Debe ser:
     1 de enero → 31 de diciembre
     del mismo año
     ======================================================= */

  if (
    agruparPor ===
    "anio"
  ) {
    const ejemplo =
      ejemploAnio(
        inicio
      );


    const mensajeAnio =
      `Para consultar por año, seleccione el año completo. ` +
      `Para ${ejemplo.year}, el rango debe ser del ${formatoUsuario(
        ejemplo.primero
      )} al ${formatoUsuario(
        ejemplo.ultimo
      )}.`;


    /*
      Ambas fechas deben pertenecer al mismo año.
    */

    if (
      inicio.getUTCFullYear() !==
      fin.getUTCFullYear()
    ) {
      return errorValidacion(
        mensajeAnio,
        {
          field:
            "fechaFin",
        }
      );
    }


    /*
      Debe iniciar el 1 de enero.
    */

    if (
      inicio.getUTCMonth() !== 0 ||
      inicio.getUTCDate() !== 1
    ) {
      return errorValidacion(
        mensajeAnio,
        {
          field:
            "fechaInicio",
        }
      );
    }


    /*
      Debe finalizar el 31 de diciembre.
    */

    if (
      fin.getUTCMonth() !== 11 ||
      fin.getUTCDate() !== 31
    ) {
      return errorValidacion(
        mensajeAnio,
        {
          field:
            "fechaFin",
        }
      );
    }


    return {
      ok: true,
    };
  }


  return {
    ok: true,
  };
}


/* =========================================================
   CONSTRUIR Y VALIDAR FILTROS
   ========================================================= */

function buildValidatedFilters({
  source,
  requireSelections = true,
  includePagination = true,
}) {

  /* =======================================================
     SOURCE
     ======================================================= */

  if (
    !source ||
    typeof source !== "object" ||
    Array.isArray(source)
  ) {
    return errorValidacion(
      "Los datos enviados para generar el reporte no son válidos."
    );
  }


  /* =======================================================
     AGRUPACIÓN
     ======================================================= */

  const agrupacion =
    normalizarAgrupacion(
      source.agruparPor
    );


  if (
    !agrupacion.ok
  ) {
    return agrupacion.error;
  }


  /* =======================================================
     ORDEN
     ======================================================= */

  const orden =
    normalizarOrden(
      source.order
    );


  if (
    !orden.ok
  ) {
    return orden.error;
  }


  /* =======================================================
     FECHAS
     ======================================================= */

  const fechaInicio =
    textoLimpio(
      source.fechaInicio
    );


  const fechaFin =
    textoLimpio(
      source.fechaFin
    );


  const validacionFechas =
    validateDateRangeByGroup({
      fechaInicio,
      fechaFin,

      agruparPor:
        agrupacion.value,
    });


  if (
    !validacionFechas.ok
  ) {
    return validacionFechas;
  }


  /* =======================================================
     IDS
     ======================================================= */

  const distritoTexto =
    textoLimpio(
      source.distritoId
    );


  const empresaTexto =
    textoLimpio(
      source.empresaId
    );


  const contenedorTexto =
    textoLimpio(
      source.contenedorId
    );


  if (
    requireSelections &&
    !distritoTexto
  ) {
    return errorValidacion(
      "Seleccione un distrito para consultar el reporte.",
      {
        field:
          "distritoId",
      }
    );
  }


  if (
    requireSelections &&
    !empresaTexto
  ) {
    return errorValidacion(
      "Seleccione una empresa recolectora para consultar el reporte.",
      {
        field:
          "empresaId",
      }
    );
  }


  if (
    requireSelections &&
    !contenedorTexto
  ) {
    return errorValidacion(
      "Seleccione un contenedor para consultar el reporte.",
      {
        field:
          "contenedorId",
      }
    );
  }


  const distritoId =
    distritoTexto
      ? enteroPositivoEstricto(
          distritoTexto
        )
      : null;


  const empresaId =
    empresaTexto
      ? enteroPositivoEstricto(
          empresaTexto
        )
      : null;


  const contenedorId =
    contenedorTexto
      ? enteroPositivoEstricto(
          contenedorTexto
        )
      : null;


  if (
    distritoTexto &&
    distritoId === null
  ) {
    return errorValidacion(
      "El distrito seleccionado no es válido. Seleccione nuevamente un distrito de la lista.",
      {
        field:
          "distritoId",
      }
    );
  }


  if (
    empresaTexto &&
    empresaId === null
  ) {
    return errorValidacion(
      "La empresa seleccionada no es válida. Seleccione nuevamente una empresa de la lista.",
      {
        field:
          "empresaId",
      }
    );
  }


  if (
    contenedorTexto &&
    contenedorId === null
  ) {
    return errorValidacion(
      "El contenedor seleccionado no es válido. Seleccione nuevamente un contenedor de la lista.",
      {
        field:
          "contenedorId",
      }
    );
  }


  /* =======================================================
     FILTROS NORMALIZADOS
     ======================================================= */

  const filters = {
    fechaInicio,
    fechaFin,

    agruparPor:
      agrupacion.value,

    distritoId,
    empresaId,
    contenedorId,

    order:
      orden.value,
  };


  /* =======================================================
     SIN PAGINACIÓN

     Utilizado por PDF / Excel.
     ======================================================= */

  if (
    !includePagination
  ) {
    return {
      ok: true,
      filters,
    };
  }


  /* =======================================================
     PAGE
     ======================================================= */

  const pageResult =
    enteroEnRango(
      source.page,
      {
        defaultValue:
          PAGE_DEFAULT,

        min:
          1,

        max:
          PAGE_MAX,
      }
    );


  if (
    !pageResult.ok
  ) {
    return errorValidacion(
      `La página solicitada no es válida. Debe ser un número entre 1 y ${PAGE_MAX.toLocaleString(
        "es-GT"
      )}.`,
      {
        field:
          "page",
      }
    );
  }


  /* =======================================================
     LIMIT
     ======================================================= */

  const limitResult =
    enteroEnRango(
      source.limit,
      {
        defaultValue:
          LIMIT_DEFAULT,

        min:
          1,

        max:
          LIMIT_MAX,
      }
    );


  if (
    !limitResult.ok
  ) {
    return errorValidacion(
      `La cantidad de registros por página debe estar entre 1 y ${LIMIT_MAX}.`,
      {
        field:
          "limit",
      }
    );
  }


  const page =
    pageResult.value;


  const limit =
    limitResult.value;


  const offset =
    (
      page -
      1
    ) *
    limit;


  /* =======================================================
     RESPUESTA
     ======================================================= */

  return {
    ok: true,

    filters,

    pagination: {
      page,
      limit,
      offset,
    },
  };
}


/* =========================================================
   EXPORTACIÓN
   ========================================================= */

module.exports = {
  buildValidatedFilters,
};