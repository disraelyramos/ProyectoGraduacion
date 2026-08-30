const ExcelJS = require("exceljs");


/* =========================================================
   CONSTANTES
   ========================================================= */

const MAX_TEXT_LENGTH = 500;


/*
  ExcelJS utiliza colores ARGB.
*/
const COLORS = Object.freeze({
  primary: "FF0D6EFD",

  text: "FF212529",

  muted: "FF6C757D",

  border: "FFDDE2E6",

  tableHeader: "FF111827",

  tableHeaderText: "FFFFFFFF",

  alternate: "FFF6F8FA",

  white: "FFFFFFFF",
});


/* =========================================================
   TEXTO SEGURO
   ========================================================= */

function textoSeguro(
  valor,
  maxLength = MAX_TEXT_LENGTH
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }


  const texto =
    String(valor).trim();


  if (!texto) {
    return "-";
  }


  return texto.length > maxLength
    ? `${texto.slice(
        0,
        maxLength
      )}…`
    : texto;
}


/* =========================================================
   NÚMERO SEGURO

   Convierte valores provenientes de PostgreSQL a números
   reales de Excel.

   Esto permite:
   - sumar
   - ordenar
   - filtrar
   - aplicar fórmulas
   ========================================================= */

function numeroSeguro(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }


  const numero =
    Number(valor);


  return Number.isFinite(numero)
    ? numero
    : null;
}


/* =========================================================
   FECHA YYYY-MM-DD PARA MOSTRAR
   ========================================================= */

function fechaParaExcel(
  valor
) {
  const fecha =
    String(
      valor || ""
    ).trim();


  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/
      .exec(
        fecha
      );


  if (!match) {
    return textoSeguro(
      valor
    );
  }


  const [
    ,
    year,
    month,
    day,
  ] = match;


  return `${day}/${month}/${year}`;
}


/* =========================================================
   FECHA/HORA GUATEMALA

   No dependemos de la zona horaria donde esté desplegado
   Node.js.
   ========================================================= */

function fechaHoraGuatemala() {
  return new Intl.DateTimeFormat(
    "es-GT",
    {
      timeZone:
        "America/Guatemala",

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false,
    }
  ).format(
    new Date()
  );
}


/* =========================================================
   AGRUPACIÓN
   ========================================================= */

function descripcionAgrupacion(
  valor
) {
  switch (
    String(
      valor || ""
    )
      .trim()
      .toLowerCase()
  ) {
    case "semana":
      return "Semana";

    case "mes":
      return "Mes";

    case "anio":
    case "año":
      return "Año";

    default:
      return "-";
  }
}


/* =========================================================
   ORDEN
   ========================================================= */

function descripcionOrden(
  valor
) {
  return (
    String(
      valor || ""
    )
      .trim()
      .toLowerCase() === "asc"
  )
    ? "Más antigua"
    : "Más reciente";
}


/* =========================================================
   BORDES
   ========================================================= */

function borderComun() {
  return {
    top: {
      style:
        "thin",

      color: {
        argb:
          COLORS.border,
      },
    },

    left: {
      style:
        "thin",

      color: {
        argb:
          COLORS.border,
      },
    },

    bottom: {
      style:
        "thin",

      color: {
        argb:
          COLORS.border,
      },
    },

    right: {
      style:
        "thin",

      color: {
        argb:
          COLORS.border,
      },
    },
  };
}


/* =========================================================
   TÍTULO DE SECCIÓN
   ========================================================= */

function crearTituloSeccion(
  ws,
  texto
) {
  const fila =
    ws.addRow([
      texto,
    ]);


  const rowNumber =
    fila.number;


  ws.mergeCells(
    `A${rowNumber}:H${rowNumber}`
  );


  const cell =
    ws.getCell(
      `A${rowNumber}`
    );


  cell.font = {
    bold:
      true,

    size:
      11,

    color: {
      argb:
        COLORS.text,
    },
  };


  cell.alignment = {
    vertical:
      "middle",
  };


  fila.height =
    22;


  return rowNumber;
}


/* =========================================================
   ENCABEZADO DE TABLA
   ========================================================= */

function aplicarHeaderTabla(
  row
) {
  row.height =
    24;


  row.eachCell(
    {
      includeEmpty:
        true,
    },
    (cell) => {
      cell.font = {
        bold:
          true,

        size:
          9,

        color: {
          argb:
            COLORS.tableHeaderText,
        },
      };


      cell.fill = {
        type:
          "pattern",

        pattern:
          "solid",

        fgColor: {
          argb:
            COLORS.tableHeader,
        },
      };


      cell.alignment = {
        horizontal:
          "center",

        vertical:
          "middle",

        wrapText:
          true,
      };


      cell.border =
        borderComun();
    }
  );
}


/* =========================================================
   FILA DE DATOS
   ========================================================= */

function aplicarEstiloFilaDatos(
  row,
  alterna = false
) {
  row.eachCell(
    {
      includeEmpty:
        true,
    },
    (cell) => {
      cell.font = {
        size:
          9,

        color: {
          argb:
            COLORS.text,
        },
      };


      cell.alignment = {
        vertical:
          "middle",

        wrapText:
          true,
      };


      cell.border =
        borderComun();


      if (alterna) {
        cell.fill = {
          type:
            "pattern",

          pattern:
            "solid",

          fgColor: {
            argb:
              COLORS.alternate,
          },
        };
      }
    }
  );
}


/* =========================================================
   CELDA NUMÉRICA

   Si el valor no puede convertirse a número, se muestra "-"
   y no se fuerza un dato inválido dentro de Excel.
   ========================================================= */

function establecerNumero(
  cell,
  valor,
  formato
) {
  const numero =
    numeroSeguro(
      valor
    );


  if (
    numero === null
  ) {
    cell.value =
      "-";

    return;
  }


  cell.value =
    numero;


  if (formato) {
    cell.numFmt =
      formato;
  }
}


/* =========================================================
   AUTO AJUSTAR COLUMNAS

   Se aplican límites para evitar columnas absurdamente
   grandes por observaciones o nombres largos.
   ========================================================= */

function autoFitColumns(
  ws,
  {
    minWidth = 10,
    maxWidth = 35,
  } = {}
) {
  ws.columns.forEach(
    (column) => {
      let maxLength =
        minWidth;


      column.eachCell(
        {
          includeEmpty:
            true,
        },
        (cell) => {
          let valor =
            cell.value;


          if (
            valor &&
            typeof valor === "object"
          ) {
            /*
              Una celda puede contener rich text u otro
              objeto especial de ExcelJS.
            */

            valor =
              valor.text ||
              valor.result ||
              "";
          }


          const texto =
            valor === null ||
            valor === undefined
              ? ""
              : String(valor);


          maxLength =
            Math.max(
              maxLength,

              Math.min(
                texto.length + 2,
                maxWidth
              )
            );
        }
      );


      column.width =
        maxLength;
    }
  );
}


/* =========================================================
   CREAR FILTROS
   ========================================================= */

function crearBloqueFiltros(
  ws,
  {
    filtros,
    total,
  }
) {
  crearTituloSeccion(
    ws,
    "Cómo se hizo la búsqueda"
  );


  const filas = [
    [
      "Rango:",
      `${fechaParaExcel(
        filtros?.fechaInicio
      )} — ${fechaParaExcel(
        filtros?.fechaFin
      )}`,

      "Agrupar por:",
      descripcionAgrupacion(
        filtros?.agruparPor
      ),
    ],

    [
      "Distrito:",
      textoSeguro(
        filtros?.distritoNombre
      ),

      "Empresa:",
      textoSeguro(
        filtros?.empresaNombre
      ),
    ],

    [
      "Contenedor:",
      textoSeguro(
        filtros?.contenedorCodigo
      ),

      "Orden:",
      descripcionOrden(
        filtros?.order
      ),
    ],

    [
      "Registros:",
      textoSeguro(
        total
      ),

      "",
      "",
    ],
  ];


  for (
    const datos of filas
  ) {
    const fila =
      ws.addRow([
        datos[0],
        datos[1],
        "",
        "",
        datos[2],
        datos[3],
        "",
        "",
      ]);


    const numeroFila =
      fila.number;


    ws.mergeCells(
      `B${numeroFila}:D${numeroFila}`
    );


    ws.mergeCells(
      `F${numeroFila}:H${numeroFila}`
    );


    const label1 =
      ws.getCell(
        `A${numeroFila}`
      );


    const value1 =
      ws.getCell(
        `B${numeroFila}`
      );


    const label2 =
      ws.getCell(
        `E${numeroFila}`
      );


    const value2 =
      ws.getCell(
        `F${numeroFila}`
      );


    label1.font = {
      bold:
        true,

      color: {
        argb:
          COLORS.text,
      },
    };


    label2.font = {
      bold:
        true,

      color: {
        argb:
          COLORS.text,
      },
    };


    for (
      const cell of [
        label1,
        value1,
        label2,
        value2,
      ]
    ) {
      cell.alignment = {
        vertical:
          "middle",

        wrapText:
          true,
      };
    }


    fila.height =
      20;
  }


  ws.addRow([]);
}


/* =========================================================
   CREAR KPIS
   ========================================================= */

function crearKpis(
  ws,
  kpis
) {
  crearTituloSeccion(
    ws,
    "Resultados"
  );


  /*
    4 bloques:

    A:B
    C:D
    E:F
    G:H
  */

  const valueRow =
    ws.addRow([]);


  const labelRow =
    ws.addRow([]);


  const bloques = [
    {
      inicio:
        "A",

      fin:
        "B",

      label:
        "Total Gastado (Q)",

      valor:
        kpis?.total_q,

      formato:
        '"Q"#,##0.00',
    },

    {
      inicio:
        "C",

      fin:
        "D",

      label:
        "Total Libras",

      valor:
        kpis?.total_lbs,

      formato:
        '#,##0.00" lb"',
    },

    {
      inicio:
        "E",

      fin:
        "F",

      label:
        "Promedio Q/lb",

      valor:
        kpis?.q_por_lb,

      formato:
        '"Q"#,##0.0000"/lb"',
    },

    {
      inicio:
        "G",

      fin:
        "H",

      label:
        "Recolecciones",

      valor:
        kpis?.recolecciones,

      formato:
        "0",
    },
  ];


  for (
    const bloque of bloques
  ) {
    ws.mergeCells(
      `${bloque.inicio}${valueRow.number}:${bloque.fin}${valueRow.number}`
    );


    ws.mergeCells(
      `${bloque.inicio}${labelRow.number}:${bloque.fin}${labelRow.number}`
    );


    const valueCell =
      ws.getCell(
        `${bloque.inicio}${valueRow.number}`
      );


    const labelCell =
      ws.getCell(
        `${bloque.inicio}${labelRow.number}`
      );


    establecerNumero(
      valueCell,
      bloque.valor,
      bloque.formato
    );


    valueCell.font = {
      bold:
        true,

      size:
        12,

      color: {
        argb:
          COLORS.text,
      },
    };


    valueCell.alignment = {
      horizontal:
        "center",

      vertical:
        "middle",
    };


    labelCell.value =
      bloque.label;


    labelCell.font = {
      size:
        9,

      color: {
        argb:
          COLORS.muted,
      },
    };


    labelCell.alignment = {
      horizontal:
        "center",

      vertical:
        "middle",
    };


    valueCell.border =
      borderComun();

    labelCell.border =
      borderComun();


    valueCell.fill = {
      type:
        "pattern",

      pattern:
        "solid",

      fgColor: {
        argb:
          COLORS.alternate,
      },
    };


    labelCell.fill = {
      type:
        "pattern",

      pattern:
        "solid",

      fgColor: {
        argb:
          COLORS.alternate,
      },
    };
  }


  valueRow.height =
    25;

  labelRow.height =
    22;


  ws.addRow([]);
}


/* =========================================================
   RESUMEN DE COSTOS
   ========================================================= */

function crearResumen(
  ws,
  resumen
) {
  crearTituloSeccion(
    ws,
    "Resumen de Costos"
  );


  const header =
    ws.addRow([
      "Periodo",
      "Total (Q)",
      "Total lb",
      "Promedio Q/lb",
      "# Recolecciones",
    ]);


  aplicarHeaderTabla(
    header
  );


  if (
    !Array.isArray(
      resumen
    ) ||
    !resumen.length
  ) {
    const fila =
      ws.addRow([
        "Sin registros para mostrar.",
      ]);


    ws.mergeCells(
      `A${fila.number}:E${fila.number}`
    );


    const cell =
      ws.getCell(
        `A${fila.number}`
      );


    cell.alignment = {
      horizontal:
        "center",
    };


    cell.font = {
      italic:
        true,

      color: {
        argb:
          COLORS.muted,
      },
    };


    cell.border =
      borderComun();


    ws.addRow([]);

    return;
  }


  resumen.forEach(
    (
      registro,
      index
    ) => {
      const fila =
        ws.addRow([
          textoSeguro(
            registro.periodo
          ),
          null,
          null,
          null,
          null,
        ]);


      establecerNumero(
        fila.getCell(2),
        registro.total_q,
        '"Q"#,##0.00'
      );


      establecerNumero(
        fila.getCell(3),
        registro.total_lbs,
        '#,##0.00" lb"'
      );


      establecerNumero(
        fila.getCell(4),
        registro.q_por_lb,
        '"Q"#,##0.0000"/lb"'
      );


      establecerNumero(
        fila.getCell(5),
        registro.recolecciones,
        "0"
      );


      fila.getCell(2).alignment = {
        horizontal:
          "right",
      };

      fila.getCell(3).alignment = {
        horizontal:
          "right",
      };

      fila.getCell(4).alignment = {
        horizontal:
          "right",
      };

      fila.getCell(5).alignment = {
        horizontal:
          "center",
      };


      aplicarEstiloFilaDatos(
        fila,
        index % 2 !== 0
      );
    }
  );


  ws.addRow([]);
}


/* =========================================================
   TOP 5 CONTENEDORES
   ========================================================= */

function crearTopContenedores(
  ws,
  topContenedores
) {
  crearTituloSeccion(
    ws,
    "Top 5 Contenedores por Costo"
  );


  const header =
    ws.addRow([
      "Contenedor",
      "Total (Q)",
    ]);


  aplicarHeaderTabla(
    header
  );


  if (
    !Array.isArray(
      topContenedores
    ) ||
    !topContenedores.length
  ) {
    const fila =
      ws.addRow([
        "Sin registros para mostrar.",
      ]);


    ws.mergeCells(
      `A${fila.number}:B${fila.number}`
    );


    const cell =
      ws.getCell(
        `A${fila.number}`
      );


    cell.alignment = {
      horizontal:
        "center",
    };


    cell.font = {
      italic:
        true,

      color: {
        argb:
          COLORS.muted,
      },
    };


    cell.border =
      borderComun();


    ws.addRow([]);

    return;
  }


  topContenedores.forEach(
    (
      registro,
      index
    ) => {
      const fila =
        ws.addRow([
          textoSeguro(
            registro.contenedor_codigo
          ),
          null,
        ]);


      establecerNumero(
        fila.getCell(2),
        registro.total_q,
        '"Q"#,##0.00'
      );


      fila.getCell(2).alignment = {
        horizontal:
          "right",
      };


      aplicarEstiloFilaDatos(
        fila,
        index % 2 !== 0
      );
    }
  );


  ws.addRow([]);
}


/* =========================================================
   DETALLE
   ========================================================= */

function crearDetalle(
  ws,
  detalle
) {
  crearTituloSeccion(
    ws,
    "Detalle de Recolecciones"
  );


  const header =
    ws.addRow([
      "Fecha",
      "Código",
      "Distrito",
      "Empresa",
      "Total lb",
      "% Llenado",
      "Costo/lb",
      "Total (Q)",
    ]);


  aplicarHeaderTabla(
    header
  );


  const headerRowNumber =
    header.number;


  if (
    !Array.isArray(
      detalle
    ) ||
    !detalle.length
  ) {
    const fila =
      ws.addRow([
        "Sin registros para mostrar.",
      ]);


    ws.mergeCells(
      `A${fila.number}:H${fila.number}`
    );


    const cell =
      ws.getCell(
        `A${fila.number}`
      );


    cell.font = {
      italic:
        true,

      color: {
        argb:
          COLORS.muted,
      },
    };


    cell.alignment = {
      horizontal:
        "center",
    };


    cell.border =
      borderComun();


    return {
      headerRowNumber,

      lastRowNumber:
        fila.number,
    };
  }


  detalle.forEach(
    (
      registro,
      index
    ) => {
      const fila =
        ws.addRow([
          textoSeguro(
            registro.fecha
          ),

          textoSeguro(
            registro.codigo_contenedor
          ),

          textoSeguro(
            registro.distrito
          ),

          textoSeguro(
            registro.empresa_recolectora
          ),

          null,
          null,
          null,
          null,
        ]);


      /*
        Total libras
      */
      establecerNumero(
        fila.getCell(5),
        registro.total_en_libras,
        '#,##0.00" lb"'
      );


      /*
        El backend entrega porcentaje como 0-100,
        por eso NO utilizamos el formato porcentual nativo
        de Excel que esperaría valores 0-1.

        75 se visualizará como 75.00%.
      */
      establecerNumero(
        fila.getCell(6),
        registro.porcentaje_llenado,
        '0.00"%"'
      );


      /*
        Costo por libra:
        conservamos 4 decimales.
      */
      establecerNumero(
        fila.getCell(7),
        registro.costo_por_libra_aplicado,
        '"Q"#,##0.0000"/lb"'
      );


      /*
        Total:
        2 decimales.
      */
      establecerNumero(
        fila.getCell(8),
        registro.total_costo_q,
        '"Q"#,##0.00'
      );


      fila.getCell(1).alignment = {
        horizontal:
          "center",

        vertical:
          "middle",
      };


      fila.getCell(2).alignment = {
        horizontal:
          "center",

        vertical:
          "middle",
      };


      for (
        let columna = 5;
        columna <= 8;
        columna += 1
      ) {
        fila.getCell(
          columna
        ).alignment = {
          horizontal:
            "right",

          vertical:
            "middle",
        };
      }


      aplicarEstiloFilaDatos(
        fila,
        index % 2 !== 0
      );
    }
  );


  return {
    headerRowNumber,

    lastRowNumber:
      ws.lastRow.number,
  };
}


/* =========================================================
   GENERAR EXCEL
   ========================================================= */

async function buildHistorialCostoExcelBuffer({
  filtros = {},
  generadoPor = {},
  kpis = {},
  resumen = [],
  topContenedores = [],
  detalle = [],
  total = 0,
}) {

  /* =======================================================
     WORKBOOK
     ======================================================= */

  const wb =
    new ExcelJS.Workbook();


  wb.creator =
    "Sistema de Monitoreo";

  wb.lastModifiedBy =
    "Sistema de Monitoreo";

  wb.created =
    new Date();

  wb.modified =
    new Date();


  /* =======================================================
     WORKSHEET
     ======================================================= */

  const ws =
    wb.addWorksheet(
      "Reporte de Costos",
      {
        properties: {
          defaultRowHeight:
            18,
        },
      }
    );


  /* =======================================================
     COLUMNAS

     Los anchos iniciales se ajustan nuevamente al final.
     ======================================================= */

  ws.columns = [
    {
      key:
        "fecha",

      width:
        18,
    },

    {
      key:
        "codigo",

      width:
        16,
    },

    {
      key:
        "distrito",

      width:
        20,
    },

    {
      key:
        "empresa",

      width:
        28,
    },

    {
      key:
        "libras",

      width:
        15,
    },

    {
      key:
        "porcentaje",

      width:
        15,
    },

    {
      key:
        "costo",

      width:
        16,
    },

    {
      key:
        "total",

      width:
        16,
    },
  ];


  /* =======================================================
     CONFIGURACIÓN DE IMPRESIÓN
     ======================================================= */

  ws.pageSetup = {
    paperSize:
      9,

    orientation:
      "landscape",

    fitToPage:
      true,

    fitToWidth:
      1,

    fitToHeight:
      0,

    horizontalCentered:
      true,

    margins: {
      left:
        0.25,

      right:
        0.25,

      top:
        0.5,

      bottom:
        0.5,

      header:
        0.2,

      footer:
        0.2,
    },
  };


  ws.headerFooter = {
    oddFooter:
      "&LControl DSH&R Página &P de &N",

    evenFooter:
      "&LControl DSH&R Página &P de &N",
  };


  /*
    Mantiene visibles las primeras filas cuando el usuario
    se desplaza por el documento.
  */

  ws.views = [
    {
      state:
        "frozen",

      ySplit:
        4,
    },
  ];


  /* =======================================================
     TÍTULO
     ======================================================= */

  ws.mergeCells(
    "A1:H1"
  );


  const titulo =
    ws.getCell(
      "A1"
    );


  titulo.value =
    "Reporte de Costos";


  titulo.font = {
    bold:
      true,

    size:
      17,

    color: {
      argb:
        COLORS.text,
    },
  };


  titulo.alignment = {
    horizontal:
      "center",

    vertical:
      "middle",
  };


  ws.getRow(1).height =
    26;


  /* =======================================================
     SUBTÍTULO
     ======================================================= */

  ws.mergeCells(
    "A2:H2"
  );


  const subtitulo =
    ws.getCell(
      "A2"
    );


  subtitulo.value =
    "Control DSH";


  subtitulo.font = {
    size:
      10,

    color: {
      argb:
        COLORS.muted,
    },
  };


  subtitulo.alignment = {
    horizontal:
      "center",
  };


  ws.addRow([]);


  /* =======================================================
     METADATOS
     ======================================================= */

  ws.mergeCells(
    "A4:D4"
  );


  ws.mergeCells(
    "E4:H4"
  );


  const generadoPorTexto =
    generadoPor?.nombre ||
    generadoPor?.usuario ||
    "N/A";


  const usuarioTexto =
    generadoPor?.usuario
      ? ` (${textoSeguro(
          generadoPor.usuario
        )})`
      : "";


  ws.getCell(
    "A4"
  ).value =
    `Generado por: ${textoSeguro(
      generadoPorTexto
    )}${usuarioTexto}`;


  ws.getCell(
    "E4"
  ).value =
    `Fecha/Hora: ${fechaHoraGuatemala()}`;


  ws.getCell(
    "A4"
  ).font = {
    size:
      9,

    color: {
      argb:
        COLORS.muted,
    },
  };


  ws.getCell(
    "E4"
  ).font = {
    size:
      9,

    color: {
      argb:
        COLORS.muted,
    },
  };


  ws.getCell(
    "E4"
  ).alignment = {
    horizontal:
      "right",
  };


  ws.addRow([]);


  /* =======================================================
     FILTROS
     ======================================================= */

  crearBloqueFiltros(
    ws,
    {
      filtros,
      total,
    }
  );


  /* =======================================================
     KPIS
     ======================================================= */

  crearKpis(
    ws,
    kpis
  );


  /* =======================================================
     RESUMEN
     ======================================================= */

  crearResumen(
    ws,
    resumen
  );


  /* =======================================================
     TOP 5
     ======================================================= */

  crearTopContenedores(
    ws,
    topContenedores
  );


  /* =======================================================
     DETALLE
     ======================================================= */

  const detalleInfo =
    crearDetalle(
      ws,
      detalle
    );


  /* =======================================================
     AUTOFILTRO DEL DETALLE
     ======================================================= */

  ws.autoFilter =
    `A${detalleInfo.headerRowNumber}:H${detalleInfo.lastRowNumber}`;


  /* =======================================================
     AJUSTE DE COLUMNAS
     ======================================================= */

  autoFitColumns(
    ws,
    {
      minWidth:
        12,

      maxWidth:
        32,
    }
  );


  /*
    Ajustes específicos posteriores al auto-fit.

    Empresa necesita más espacio.
  */

  ws.getColumn(1).width =
    Math.max(
      ws.getColumn(1).width,
      18
    );


  ws.getColumn(4).width =
    Math.max(
      ws.getColumn(4).width,
      26
    );


  ws.getColumn(5).width =
    Math.max(
      ws.getColumn(5).width,
      14
    );


  ws.getColumn(6).width =
    Math.max(
      ws.getColumn(6).width,
      14
    );


  ws.getColumn(7).width =
    Math.max(
      ws.getColumn(7).width,
      16
    );


  ws.getColumn(8).width =
    Math.max(
      ws.getColumn(8).width,
      15
    );


  /* =======================================================
     GENERAR BUFFER
     ======================================================= */

  return wb.xlsx.writeBuffer();
}


/* =========================================================
   EXPORTACIÓN PÚBLICA
   ========================================================= */

module.exports = {
  buildHistorialCostoExcelBuffer,
};