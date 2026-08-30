const ExcelJS = require("exceljs");


/* =========================================================
   CONFIGURACIÓN VISUAL
   ========================================================= */

const COLORS = {
  primary: "0D6EFD",
  dark: "111827",
  white: "FFFFFF",
  text: "212529",
  muted: "6C757D",
  border: "DDE2E6",
};


/* =========================================================
   TEXTO SEGURO
   ========================================================= */

function textoSeguro(valor, maxLength = 500) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }

  const texto = String(valor).trim();

  if (!texto) {
    return "-";
  }

  return texto.length > maxLength
    ? `${texto.slice(0, maxLength)}…`
    : texto;
}


/* =========================================================
   NÚMERO SEGURO

   PostgreSQL puede devolver NUMERIC como string.
   Para Excel lo convertimos a número real.
   ========================================================= */

function numeroSeguro(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero)
    ? numero
    : null;
}


/* =========================================================
   FECHA PARA MOSTRAR
   ========================================================= */

function fechaParaExcel(valor) {
  const fecha =
    String(valor || "").trim();

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      fecha
    );

  if (!match) {
    return textoSeguro(valor);
  }

  const [, year, month, day] =
    match;

  return `${day}/${month}/${year}`;
}


/* =========================================================
   FECHA/HORA GUATEMALA
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
  ).format(new Date());
}


/* =========================================================
   TIPO DE BÚSQUEDA
   ========================================================= */

function descripcionBuscarPor(valor) {
  switch (
    String(valor || "")
      .trim()
      .toLowerCase()
  ) {
    case "codigo":
      return "Código";

    case "tipo":
      return "Tipo de residuo";

    default:
      return "-";
  }
}


/* =========================================================
   ORDEN
   ========================================================= */

function descripcionOrden(valor) {
  return (
    String(valor || "")
      .trim()
      .toLowerCase() === "asc"
  )
    ? "Más antigua"
    : "Más reciente";
}


/* =========================================================
   BORDES
   ========================================================= */

function aplicarBordes(row) {
  row.eachCell(
    {
      includeEmpty: true,
    },
    (cell) => {
      cell.border = {
        top: {
          style: "thin",
          color: {
            argb: COLORS.border,
          },
        },

        left: {
          style: "thin",
          color: {
            argb: COLORS.border,
          },
        },

        bottom: {
          style: "thin",
          color: {
            argb: COLORS.border,
          },
        },

        right: {
          style: "thin",
          color: {
            argb: COLORS.border,
          },
        },
      };
    }
  );
}


/* =========================================================
   CABECERA DE TABLA
   ========================================================= */

function estilizarCabecera(row) {
  row.height = 28;

  row.eachCell(
    {
      includeEmpty: true,
    },
    (cell) => {
      cell.font = {
        bold: true,

        color: {
          argb: COLORS.white,
        },
      };

      cell.fill = {
        type: "pattern",
        pattern: "solid",

        fgColor: {
          argb: COLORS.dark,
        },
      };

      cell.alignment = {
        horizontal: "center",
        vertical: "middle",
        wrapText: true,
      };
    }
  );

  aplicarBordes(row);
}


/* =========================================================
   FILA DE DATOS
   ========================================================= */

function estilizarFilaDatos(row) {
  row.eachCell(
    {
      includeEmpty: true,
    },
    (cell) => {
      cell.alignment = {
        vertical: "middle",
        wrapText: true,
      };
    }
  );

  aplicarBordes(row);
}


/* =========================================================
   TÍTULO DE SECCIÓN
   ========================================================= */

function agregarTituloSeccion(
  ws,
  texto,
  desde,
  hasta
) {
  const row =
    ws.addRow([]);

  const numeroFila =
    row.number;

  ws.mergeCells(
    `${desde}${numeroFila}:${hasta}${numeroFila}`
  );

  const cell =
    ws.getCell(
      `${desde}${numeroFila}`
    );

  cell.value =
    texto;

  cell.font = {
    bold: true,
    size: 12,

    color: {
      argb: COLORS.text,
    },
  };

  cell.alignment = {
    vertical: "middle",
  };

  row.height = 24;

  return row;
}


/* =========================================================
   GENERAR EXCEL
   ========================================================= */

async function buildHistorialRecoleccionExcelBuffer({
  filtros = {},
  detalle = [],
  pesaje = [],
  generadoPor = {},
  total = 0,
}) {

  /* =======================================================
     ENTRADAS SEGURAS
     ======================================================= */

  const detalleSeguro =
    Array.isArray(detalle)
      ? detalle
      : [];

  const pesajeSeguro =
    Array.isArray(pesaje)
      ? pesaje
      : [];

  const filtrosSeguros =
    filtros &&
    typeof filtros === "object" &&
    !Array.isArray(filtros)
      ? filtros
      : {};

  const totalSeguro =
    Number.isFinite(
      Number(total)
    )
      ? Number(total)
      : 0;


  /* =======================================================
     WORKBOOK
     ======================================================= */

  const wb =
    new ExcelJS.Workbook();

  wb.creator =
    "Sistema de Monitoreo";

  wb.subject =
    "Historial de Recolección DSH";

  wb.title =
    "Historial de Recolección";


  /* =======================================================
     HOJA
     ======================================================= */

  const ws =
    wb.addWorksheet(
      "Historial",
      {
        properties: {
          defaultRowHeight: 18,
        },

        pageSetup: {
          paperSize: 9,

          orientation:
            "landscape",

          fitToPage:
            true,

          fitToWidth:
            1,

          fitToHeight:
            0,

          margins: {
            left: 0.3,
            right: 0.3,
            top: 0.5,
            bottom: 0.5,
            header: 0.2,
            footer: 0.2,
          },
        },
      }
    );


  /* =======================================================
     COLUMNAS
     ======================================================= */

  ws.columns = [
    { width: 15 }, // A Código
    { width: 18 }, // B Fecha
    { width: 16 }, // C Distrito
    { width: 20 }, // D Tipo
    { width: 16 }, // E Recibo
    { width: 22 }, // F Responsable
    { width: 22 }, // G Empresa
    { width: 14 }, // H %
    { width: 18 }, // I Libras
    { width: 34 }, // J Observación
  ];


  /* =======================================================
     TÍTULO
     ======================================================= */

  ws.mergeCells(
    "A1:J1"
  );

  const titulo =
    ws.getCell("A1");

  titulo.value =
    "Historial de Recolección";

  titulo.font = {
    bold: true,
    size: 18,

    color: {
      argb: COLORS.text,
    },
  };

  titulo.alignment = {
    horizontal: "center",
    vertical: "middle",
  };

  ws.getRow(1).height =
    30;


  /* =======================================================
     SUBTÍTULO
     ======================================================= */

  ws.mergeCells(
    "A2:J2"
  );

  const subtitulo =
    ws.getCell("A2");

  subtitulo.value =
    "Control DSH";

  subtitulo.font = {
    size: 11,
    italic: true,

    color: {
      argb: COLORS.muted,
    },
  };

  subtitulo.alignment = {
    horizontal: "center",
  };


  /* =======================================================
     INFORMACIÓN DE GENERACIÓN
     ======================================================= */

  const usuario =
    generadoPor?.nombre ||
    generadoPor?.usuario ||
    "N/A";


  let generadoPorTexto =
    `Generado por: ${textoSeguro(
      usuario
    )}`;


  if (generadoPor?.usuario) {
    generadoPorTexto +=
      ` (${textoSeguro(
        generadoPor.usuario
      )})`;
  }


  ws.getCell("A4").value =
    generadoPorTexto;


  ws.getCell("H4").value =
    `Fecha/Hora: ${fechaHoraGuatemala()}`;

  ws.mergeCells(
    "H4:J4"
  );

  ws.getCell("H4").alignment = {
    horizontal: "right",
  };


  /* =======================================================
     LÍNEA VISUAL

     La línea problemática ws.getRange?. fue eliminada.
     ======================================================= */

  for (
    let columna = 1;
    columna <= 10;
    columna++
  ) {
    const cell =
      ws
        .getRow(5)
        .getCell(columna);

    cell.border = {
      bottom: {
        style: "medium",

        color: {
          argb: COLORS.primary,
        },
      },
    };
  }


  /* =======================================================
     FILTROS
     ======================================================= */

  agregarTituloSeccion(
    ws,
    "Cómo se hizo la búsqueda",
    "A",
    "J"
  );


  const filtro1 =
    ws.addRow([
      "Buscar por:",

      descripcionBuscarPor(
        filtrosSeguros.buscarPor
      ),

      "",
      "",
      "",

      "Orden:",

      descripcionOrden(
        filtrosSeguros.order
      ),
    ]);


  filtro1.getCell(1).font = {
    bold: true,
  };

  filtro1.getCell(6).font = {
    bold: true,
  };


  const filtro2 =
    ws.addRow([
      "Búsqueda:",

      textoSeguro(
        filtrosSeguros.valorBusqueda
      ),

      "",
      "",
      "",

      "Registros:",

      totalSeguro,
    ]);


  filtro2.getCell(1).font = {
    bold: true,
  };

  filtro2.getCell(6).font = {
    bold: true,
  };


  const filtro3 =
    ws.addRow([
      "Rango:",

      `${fechaParaExcel(
        filtrosSeguros.fechaInicio
      )} — ${fechaParaExcel(
        filtrosSeguros.fechaFin
      )}`,
    ]);


  filtro3.getCell(1).font = {
    bold: true,
  };


  ws.addRow([]);


  /* =======================================================
     TABLA 1
     ======================================================= */

  agregarTituloSeccion(
    ws,
    "Datos de Registro de Recolección",
    "A",
    "J"
  );


  const headerDetalle =
    ws.addRow([
      "Código",
      "Fecha",
      "Distrito",
      "Tipo de Residuo",
      "Número de Recibo",
      "Responsable",
      "Empresa Recolectora",
      "% DSH Pendientes",
      "Cantidad en Libras Pendientes",
      "Observación",
    ]);


  estilizarCabecera(
    headerDetalle
  );


  /* =======================================================
     DATOS TABLA 1
     ======================================================= */

  if (!detalleSeguro.length) {

    const row =
      ws.addRow([
        "Sin registros para mostrar.",
      ]);


    ws.mergeCells(
      `A${row.number}:J${row.number}`
    );


    row.getCell(1).alignment = {
      horizontal: "center",
    };


    row.getCell(1).font = {
      italic: true,

      color: {
        argb: COLORS.muted,
      },
    };

  } else {

    for (
      const registro
      of detalleSeguro
    ) {

      const row =
        ws.addRow([
          textoSeguro(
            registro.codigo
          ),

          textoSeguro(
            registro.fecha
          ),

          textoSeguro(
            registro.distrito
          ),

          textoSeguro(
            registro.tipo_residuo
          ),

          textoSeguro(
            registro.numero_recibo
          ),

          textoSeguro(
            registro.responsable
          ),

          textoSeguro(
            registro.empresa_recolectora
          ),

          numeroSeguro(
            registro.porcentaje_pendiente
          ),

          numeroSeguro(
            registro.cantidad_libras_pendientes
          ),

          textoSeguro(
            registro.observaciones
          ),
        ]);


      /*
        H = porcentaje
      */

      row.getCell(8).numFmt =
        '0.##"%"';


      /*
        I = libras
      */

      row.getCell(9).numFmt =
        "#,##0.00";


      row.getCell(8).alignment = {
        horizontal: "right",
        vertical: "middle",
      };


      row.getCell(9).alignment = {
        horizontal: "right",
        vertical: "middle",
      };


      estilizarFilaDatos(
        row
      );
    }
  }


  ws.addRow([]);


  /* =======================================================
     TABLA 2 - CONTROL DE PESAJE
     ======================================================= */

  agregarTituloSeccion(
    ws,
    "Control de Pesaje",
    "A",
    "E"
  );


  const headerPesaje =
    ws.addRow([
      "Total (lb)",
      "% Recolectado",
      "% Llenado Actual",
      "Costo por Libra",
      "Costo Total",
    ]);


  estilizarCabecera(
    headerPesaje
  );


  /* =======================================================
     DATOS TABLA 2
     ======================================================= */

  if (!pesajeSeguro.length) {

    const row =
      ws.addRow([
        "Sin registros para mostrar.",
      ]);


    ws.mergeCells(
      `A${row.number}:E${row.number}`
    );


    row.getCell(1).alignment = {
      horizontal: "center",
    };


    row.getCell(1).font = {
      italic: true,

      color: {
        argb: COLORS.muted,
      },
    };

  } else {

    for (
      const registro
      of pesajeSeguro
    ) {

      const row =
        ws.addRow([
          numeroSeguro(
            registro.total_en_libras
          ),

          numeroSeguro(
            registro.porcentaje_recolectado
          ),

          numeroSeguro(
            registro.porcentaje_llenado
          ),

          numeroSeguro(
            registro.costo_por_libra_aplicado
          ),

          numeroSeguro(
            registro.total_costo_q
          ),
        ]);


      /* Total libras */

      row.getCell(1).numFmt =
        "#,##0.00";


      /* Porcentajes */

      row.getCell(2).numFmt =
        '0.##"%"';

      row.getCell(3).numFmt =
        '0.##"%"';


      /* Costo por libra */

      row.getCell(4).numFmt =
        '"Q"#,##0.0000';


      /* Costo total */

      row.getCell(5).numFmt =
        '"Q"#,##0.00';


      for (
        let columna = 1;
        columna <= 5;
        columna++
      ) {
        row
          .getCell(columna)
          .alignment = {
            horizontal: "right",
            vertical: "middle",
          };
      }


      estilizarFilaDatos(
        row
      );
    }
  }


  /* =======================================================
     CONFIGURACIÓN DE IMPRESIÓN
     ======================================================= */

  const ultimaFila =
    ws.lastRow?.number || 1;


  ws.pageSetup.printArea =
    `A1:J${ultimaFila}`;


  ws.pageSetup.horizontalCentered =
    true;


  /* =======================================================
     ALTURA DE FILAS
     ======================================================= */

  ws.eachRow((row) => {
    if (!row.height) {
      row.height = 20;
    }
  });


  /* =======================================================
     BUFFER
     ======================================================= */

  return wb.xlsx.writeBuffer();
}


/* =========================================================
   EXPORTACIÓN
   ========================================================= */

module.exports = {
  buildHistorialRecoleccionExcelBuffer,
};