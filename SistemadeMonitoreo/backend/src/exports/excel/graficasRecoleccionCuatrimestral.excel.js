const ExcelJS = require("exceljs");


const NOMBRES_CUATRIMESTRES = Object.freeze({
  1: "Primer cuatrimestre",
  2: "Segundo cuatrimestre",
  3: "Tercer cuatrimestre",
});


const COLORS = Object.freeze({
  primary: "FF0D6EFD",
  text: "FF212529",
  muted: "FF6C757D",
  border: "FFDDE2E6",
  tableHeader: "FF111827",
  tableHeaderText: "FFFFFFFF",
  alternate: "FFF6F8FA",
  bio: "FF0D6EFD",
  punzo: "FFDC3545",
});


function textoSeguro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }


  const texto =
    String(valor).trim();


  return texto || "-";
}


function numeroSeguro(valor) {
  const numero =
    Number(valor);


  return Number.isFinite(numero)
    ? numero
    : 0;
}


function fechaHoraGuatemala() {
  return new Intl.DateTimeFormat(
    "es-GT",
    {
      timeZone: "America/Guatemala",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }
  ).format(new Date());
}


function borderComun() {
  const borde = {
    style: "thin",
    color: {
      argb: COLORS.border,
    },
  };


  return {
    top: borde,
    left: borde,
    bottom: borde,
    right: borde,
  };
}


function aplicarHeaderTabla(row) {
  row.height = 24;


  row.eachCell(
    {
      includeEmpty: true,
    },
    (cell) => {
      cell.font = {
        bold: true,
        size: 9,
        color: {
          argb: COLORS.tableHeaderText,
        },
      };


      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: {
          argb: COLORS.tableHeader,
        },
      };


      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };


      cell.border =
        borderComun();
    }
  );
}


function aplicarEstiloFila(
  row,
  alterna = false
) {
  row.eachCell(
    {
      includeEmpty: true,
    },
    (cell) => {
      cell.font = {
        size: 9,
        color: {
          argb: COLORS.text,
        },
      };


      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };


      cell.border =
        borderComun();


      if (alterna) {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: {
            argb: COLORS.alternate,
          },
        };
      }
    }
  );
}


function crearTituloSeccion(
  worksheet,
  texto
) {
  const row =
    worksheet.addRow([
      texto,
    ]);


  worksheet.mergeCells(
    `A${row.number}:F${row.number}`
  );


  const cell =
    worksheet.getCell(
      `A${row.number}`
    );


  cell.font = {
    bold: true,
    size: 11,
    color: {
      argb: COLORS.text,
    },
  };


  cell.alignment = {
    vertical: "middle",
  };


  row.height = 22;


  return row.number;
}


function crearTituloMes(
  worksheet,
  nombreMes
) {
  const row =
    worksheet.addRow([
      `Desechos Sólidos generados en el mes de ${nombreMes}`,
    ]);


  worksheet.mergeCells(
    `A${row.number}:F${row.number}`
  );


  const cell =
    worksheet.getCell(
      `A${row.number}`
    );


  cell.font = {
    bold: true,
    size: 11,
    color: {
      argb: COLORS.tableHeaderText,
    },
  };


  cell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: {
      argb: COLORS.tableHeader,
    },
  };


  cell.alignment = {
    vertical: "middle",
  };


  row.height = 25;
}


function obtenerSerie(
  mes,
  nombre
) {
  if (
    !Array.isArray(
      mes?.series
    )
  ) {
    return [
      0,
      0,
      0,
      0,
      0,
    ];
  }


  const serie =
    mes.series.find(
      (item) =>
        item?.name === nombre
    );


  if (
    !Array.isArray(
      serie?.data
    )
  ) {
    return [
      0,
      0,
      0,
      0,
      0,
    ];
  }


  return Array.from(
    {
      length: 5,
    },
    (_, index) =>
      numeroSeguro(
        serie.data[index]
      )
  );
}


function crearResumenCuatrimestral(
  worksheet,
  data
) {
  crearTituloSeccion(
    worksheet,
    "Resumen Cuatrimestral"
  );


  const header =
    worksheet.addRow([
      "Mes",
      "Bioinfeccioso (lb)",
      "Punzocortante (lb)",
      "Total (lb)",
      "Promedio semanal (lb)",
    ]);


  aplicarHeaderTabla(
    header
  );


  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {
    const row =
      worksheet.addRow([
        "Sin registros para mostrar.",
      ]);


    worksheet.mergeCells(
      `A${row.number}:E${row.number}`
    );


    const cell =
      worksheet.getCell(
        `A${row.number}`
      );


    cell.alignment = {
      horizontal: "center",
    };


    cell.font = {
      italic: true,
      color: {
        argb: COLORS.muted,
      },
    };


    cell.border =
      borderComun();


    worksheet.addRow([]);

    return;
  }


  data.forEach(
    (
      mes,
      index
    ) => {

      const row =
        worksheet.addRow([
          textoSeguro(
            mes?.nombreMes
          ),

          numeroSeguro(
            mes
              ?.totales
              ?.bioinfeccioso
          ),

          numeroSeguro(
            mes
              ?.totales
              ?.punzocortante
          ),

          numeroSeguro(
            mes
              ?.totales
              ?.general
          ),

          numeroSeguro(
            mes
              ?.promedioSemanal
              ?.general
          ),
        ]);


      for (
        let columna = 2;
        columna <= 5;
        columna += 1
      ) {
        row.getCell(
          columna
        ).numFmt =
          '#,##0.00" lb"';


        row.getCell(
          columna
        ).alignment = {
          horizontal: "right",
          vertical: "middle",
        };
      }


      aplicarEstiloFila(
        row,
        index % 2 !== 0
      );
    }
  );


  worksheet.addRow([]);
}


function crearKpisMes(
  worksheet,
  mes
) {
  const row =
    worksheet.addRow([
      "",
      "",
      "",
      "",
      "",
      "",
    ]);


  worksheet.mergeCells(
    `A${row.number}:B${row.number}`
  );

  worksheet.mergeCells(
    `C${row.number}:D${row.number}`
  );

  worksheet.mergeCells(
    `E${row.number}:F${row.number}`
  );


  const kpis = [
    {
      cell:
        `A${row.number}`,

      titulo:
        "Total Bioinfeccioso",

      valor:
        mes
          ?.totales
          ?.bioinfeccioso,

      color:
        COLORS.bio,
    },

    {
      cell:
        `C${row.number}`,

      titulo:
        "Total Punzocortante",

      valor:
        mes
          ?.totales
          ?.punzocortante,

      color:
        COLORS.punzo,
    },

    {
      cell:
        `E${row.number}`,

      titulo:
        "Promedio semanal general",

      valor:
        mes
          ?.promedioSemanal
          ?.general,

      color:
        COLORS.text,
    },
  ];


  for (
    const kpi of kpis
  ) {
    const cell =
      worksheet.getCell(
        kpi.cell
      );


    cell.value = {
      richText: [
        {
          text:
            `${kpi.titulo}\n`,

          font: {
            size: 9,
            color: {
              argb: COLORS.muted,
            },
          },
        },

        {
          text:
            `${numeroSeguro(
              kpi.valor
            ).toFixed(2)} lb`,

          font: {
            bold: true,
            size: 11,
            color: {
              argb: kpi.color,
            },
          },
        },
      ],
    };


    cell.alignment = {
      horizontal: "center",
      vertical: "middle",
      wrapText: true,
    };


    cell.border =
      borderComun();
  }


  row.height = 42;
}


function crearTablaMes(
  worksheet,
  mes
) {
  const nombreMes =
    textoSeguro(
      mes?.nombreMes
    );


  crearTituloSeccion(
    worksheet,
    `Detalle de ${nombreMes}`
  );


  const header =
    worksheet.addRow([
      "Periodo",
      "Bioinfeccioso (lb)",
      "Punzocortante (lb)",
      "Total (lb)",
    ]);


  aplicarHeaderTabla(
    header
  );


  const categorias =
    Array.isArray(
      mes?.categorias
    )
      ? mes.categorias
      : [
          "Semana 1",
          "Semana 2",
          "Semana 3",
          "Semana 4",
          "Semana 5",
        ];


  const bio =
    obtenerSerie(
      mes,
      "Bioinfeccioso"
    );


  const punzo =
    obtenerSerie(
      mes,
      "Punzocortante"
    );


  for (
    let index = 0;
    index < 5;
    index += 1
  ) {
    const row =
      worksheet.addRow([
        textoSeguro(
          categorias[index] ||
          `Semana ${index + 1}`
        ),

        bio[index],

        punzo[index],

        bio[index] +
        punzo[index],
      ]);


    for (
      let columna = 2;
      columna <= 4;
      columna += 1
    ) {
      row.getCell(
        columna
      ).numFmt =
        '#,##0.00" lb"';


      row.getCell(
        columna
      ).alignment = {
        horizontal: "right",
        vertical: "middle",
      };
    }


    aplicarEstiloFila(
      row,
      index % 2 !== 0
    );
  }
}


function crearDatosGrafica(
  worksheet,
  mes
) {
  const nombreMes =
    textoSeguro(
      mes?.nombreMes
    );


  crearTituloSeccion(
    worksheet,
    `Gráfica de ${nombreMes}`
  );


  const bio =
    obtenerSerie(
      mes,
      "Bioinfeccioso"
    );


  const punzo =
    obtenerSerie(
      mes,
      "Punzocortante"
    );


  const categorias =
    Array.isArray(
      mes?.categorias
    )
      ? mes.categorias
      : [
          "Semana 1",
          "Semana 2",
          "Semana 3",
          "Semana 4",
          "Semana 5",
        ];


  const header =
    worksheet.addRow([
      "Semana",
      "Bioinfeccioso",
      "Punzocortante",
    ]);


  aplicarHeaderTabla(
    header
  );


  for (
    let index = 0;
    index < 5;
    index += 1
  ) {
    const row =
      worksheet.addRow([
        categorias[index] ||
          `Semana ${index + 1}`,

        bio[index],

        punzo[index],
      ]);


    row.getCell(2).numFmt =
      '#,##0.00" lb"';

    row.getCell(3).numFmt =
      '#,##0.00" lb"';


    aplicarEstiloFila(
      row,
      index % 2 !== 0
    );
  }


  const nota =
    worksheet.addRow([
      "Los valores anteriores corresponden a los mismos datos utilizados para generar la gráfica del PDF.",
    ]);


  worksheet.mergeCells(
    `A${nota.number}:F${nota.number}`
  );


  worksheet.getCell(
    `A${nota.number}`
  ).font = {
    italic: true,
    size: 8,
    color: {
      argb: COLORS.muted,
    },
  };


  worksheet.addRow([]);
}


function crearSeccionMes(
  worksheet,
  mes
) {
  const nombreMes =
    textoSeguro(
      mes?.nombreMes
    );


  crearTituloMes(
    worksheet,
    nombreMes
  );


  worksheet.addRow([]);


  crearTituloSeccion(
    worksheet,
    `Resumen de ${nombreMes}`
  );


  crearKpisMes(
    worksheet,
    mes
  );


  worksheet.addRow([]);


  crearTablaMes(
    worksheet,
    mes
  );


  worksheet.addRow([]);


  crearDatosGrafica(
    worksheet,
    mes
  );
}


function ajustarColumnas(
  worksheet
) {
  const anchos = [
    28,
    24,
    24,
    22,
    24,
    18,
  ];


  worksheet.columns.forEach(
    (
      column,
      index
    ) => {
      column.width =
        anchos[index] ||
        18;
    }
  );
}


async function buildGraficasRecoleccionCuatrimestralExcelBuffer({
  filtros = {},
  generadoPor = {},
  data = [],
}) {
  const workbook =
    new ExcelJS.Workbook();


  workbook.creator =
    "Sistema de Monitoreo";

  workbook.lastModifiedBy =
    "Sistema de Monitoreo";

  workbook.created =
    new Date();

  workbook.modified =
    new Date();


  const worksheet =
    workbook.addWorksheet(
      "Recolección Cuatrimestral",
      {
        properties: {
          defaultRowHeight: 18,
        },
      }
    );


  worksheet.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,

    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.5,
      bottom: 0.5,
      header: 0.2,
      footer: 0.2,
    },
  };


  worksheet.headerFooter = {
    oddFooter:
      "&LControl DSH&R Página &P de &N",

    evenFooter:
      "&LControl DSH&R Página &P de &N",
  };


  worksheet.mergeCells(
    "A1:F1"
  );


  const titulo =
    worksheet.getCell(
      "A1"
    );


  titulo.value =
    "Historial Gráfico de Recolección";


  titulo.font = {
    bold: true,
    size: 17,
    color: {
      argb: COLORS.text,
    },
  };


  titulo.alignment = {
    horizontal: "center",
    vertical: "middle",
  };


  worksheet.getRow(
    1
  ).height = 26;


  worksheet.mergeCells(
    "A2:F2"
  );


  const subtitulo =
    worksheet.getCell(
      "A2"
    );


  subtitulo.value =
    "Control DSH";


  subtitulo.font = {
    size: 10,
    color: {
      argb: COLORS.muted,
    },
  };


  subtitulo.alignment = {
    horizontal: "center",
  };


  worksheet.mergeCells(
    "A4:C4"
  );


  worksheet.mergeCells(
    "D4:F4"
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


  worksheet.getCell(
    "A4"
  ).value =
    `Generado por: ${textoSeguro(
      generadoPorTexto
    )}${usuarioTexto}`;


  worksheet.getCell(
    "D4"
  ).value =
    `Fecha/Hora: ${fechaHoraGuatemala()}`;


  worksheet.getCell(
    "A4"
  ).font = {
    size: 9,
    color: {
      argb: COLORS.muted,
    },
  };


  worksheet.getCell(
    "D4"
  ).font = {
    size: 9,
    color: {
      argb: COLORS.muted,
    },
  };


  worksheet.getCell(
    "D4"
  ).alignment = {
    horizontal: "right",
  };


  worksheet.addRow([]);


  crearTituloSeccion(
    worksheet,
    "Filtros de consulta"
  );


  const anio =
    Number(
      filtros?.anio
    ) || 0;


  const cuatrimestre =
    Number(
      filtros?.cuatrimestre
    ) || 0;


  const cuatrimestreTexto =
    NOMBRES_CUATRIMESTRES[
      cuatrimestre
    ] || "-";


  const rowFiltros =
    worksheet.addRow([
      "Año",
      anio || "-",
      "",
      "Cuatrimestre",
      cuatrimestreTexto,
    ]);


  rowFiltros.getCell(
    1
  ).font = {
    bold: true,
  };


  rowFiltros.getCell(
    4
  ).font = {
    bold: true,
  };


  worksheet.addRow([]);


  const datos =
    Array.isArray(data)
      ? data
      : [];


  crearResumenCuatrimestral(
    worksheet,
    datos
  );


  if (
    datos.length > 0
  ) {
    for (
      const mes of datos
    ) {
      crearSeccionMes(
        worksheet,
        mes
      );
    }

  } else {
    crearTituloSeccion(
      worksheet,
      "Detalle por Mes"
    );


    const row =
      worksheet.addRow([
        "Sin información para mostrar.",
      ]);


    worksheet.mergeCells(
      `A${row.number}:F${row.number}`
    );


    const cell =
      worksheet.getCell(
        `A${row.number}`
      );


    cell.alignment = {
      horizontal: "center",
    };


    cell.font = {
      italic: true,
      color: {
        argb: COLORS.muted,
      },
    };
  }


  ajustarColumnas(
    worksheet
  );


  worksheet.views = [
    {
      state: "frozen",
      ySplit: 4,
    },
  ];


  return workbook.xlsx.writeBuffer();
}


module.exports = {
  buildGraficasRecoleccionCuatrimestralExcelBuffer,
};