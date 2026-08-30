const {
  PDF_COLORS,
  PDF_STYLES,
  PDF_TABLE_LAYOUT,
  crearPdfBuffer,
} = require("./pdfmake.config");


/* =========================================================
   CONSTANTES
   ========================================================= */

const MAX_TEXT_LENGTH =
  500;


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
   NÚMERO
   ========================================================= */

function numero(
  valor,
  {
    minDecimales = 0,
    maxDecimales = 2,
  } = {}
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }


  const numeroValor =
    Number(valor);


  if (
    !Number.isFinite(
      numeroValor
    )
  ) {
    return textoSeguro(
      valor
    );
  }


  return new Intl.NumberFormat(
    "es-GT",
    {
      minimumFractionDigits:
        minDecimales,

      maximumFractionDigits:
        maxDecimales,
    }
  ).format(
    numeroValor
  );
}


/* =========================================================
   MONEDA EN QUETZALES
   ========================================================= */

function monedaQuetzales(
  valor,
  decimales = 2
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }


  const numeroValor =
    Number(valor);


  if (
    !Number.isFinite(
      numeroValor
    )
  ) {
    return textoSeguro(
      valor
    );
  }


  const monto =
    new Intl.NumberFormat(
      "es-GT",
      {
        minimumFractionDigits:
          decimales,

        maximumFractionDigits:
          decimales,
      }
    ).format(
      numeroValor
    );


  return `Q${monto}`;
}


/* =========================================================
   LIBRAS
   ========================================================= */

function libras(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }


  const numeroValor =
    Number(valor);


  if (
    !Number.isFinite(
      numeroValor
    )
  ) {
    return textoSeguro(
      valor
    );
  }


  return `${numero(
    numeroValor,
    {
      minDecimales: 0,
      maxDecimales: 2,
    }
  )} lb`;
}


/* =========================================================
   COSTO POR LIBRA

   Se conservan 4 decimales porque el backend calcula
   q_por_lb y costo_por_libra_aplicado con precisión.
   ========================================================= */

function costoPorLibra(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }


  const numeroValor =
    Number(valor);


  if (
    !Number.isFinite(
      numeroValor
    )
  ) {
    return textoSeguro(
      valor
    );
  }


  return `${monedaQuetzales(
    numeroValor,
    4
  )}/lb`;
}


/* =========================================================
   PORCENTAJE
   ========================================================= */

function porcentaje(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }


  const numeroValor =
    Number(valor);


  if (
    !Number.isFinite(
      numeroValor
    )
  ) {
    return textoSeguro(
      valor
    );
  }


  return `${numero(
    numeroValor,
    {
      minDecimales: 0,
      maxDecimales: 2,
    }
  )}%`;
}


/* =========================================================
   FECHA YYYY-MM-DD PARA PDF
   ========================================================= */

function fechaParaPdf(
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
  ] =
    match;


  return `${day}/${month}/${year}`;
}


/* =========================================================
   FECHA/HORA DE GENERACIÓN

   Se fuerza America/Guatemala porque Railway u otro
   servidor puede utilizar otra zona horaria.
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
   AGRUPACIÓN PARA MOSTRAR
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

    case "anio":
    case "año":
      return "Año";

    case "mes":
      return "Mes";

    default:
      return "-";
  }
}


/* =========================================================
   ORDEN PARA MOSTRAR
   ========================================================= */

function descripcionOrden(
  valor
) {
  return (
    String(
      valor || ""
    )
      .trim()
      .toLowerCase() ===
    "asc"
  )
    ? "Más antigua"
    : "Más reciente";
}


/* =========================================================
   CELDAS
   ========================================================= */

function celda(
  valor,
  style = "tableCell"
) {
  return {
    text:
      textoSeguro(
        valor
      ),

    style,
  };
}


function celdaMoneda(
  valor,
  decimales = 2
) {
  return {
    text:
      monedaQuetzales(
        valor,
        decimales
      ),

    style:
      "tableCellRight",
  };
}


function celdaLibras(
  valor
) {
  return {
    text:
      libras(
        valor
      ),

    style:
      "tableCellRight",
  };
}


function celdaCostoLibra(
  valor
) {
  return {
    text:
      costoPorLibra(
        valor
      ),

    style:
      "tableCellRight",
  };
}


function celdaPorcentaje(
  valor
) {
  return {
    text:
      porcentaje(
        valor
      ),

    style:
      "tableCellRight",
  };
}


/* =========================================================
   HEADER DE TABLA
   ========================================================= */

function crearHeader(
  columnas
) {
  return columnas.map(
    (texto) => ({
      text:
        texto,

      style:
        "tableHeader",

      fillColor:
        PDF_COLORS.tableHeader,

      margin: [
        0,
        2,
        0,
        2,
      ],
    })
  );
}


/* =========================================================
   FILAS VACÍAS
   ========================================================= */

function filaVacia(
  columnas
) {
  return [
    {
      text:
        "Sin registros para mostrar.",

      colSpan:
        columnas,

      style:
        "empty",

      margin: [
        0,
        6,
        0,
        6,
      ],
    },

    ...Array.from(
      {
        length:
          columnas - 1,
      },
      () => ({})
    ),
  ];
}


/* =========================================================
   FILAS RESUMEN DE COSTOS
   ========================================================= */

function crearFilasResumen(
  resumen = []
) {
  if (!resumen.length) {
    return [
      filaVacia(5),
    ];
  }


  return resumen.map(
    (registro) => [
      celda(
        registro.periodo
      ),

      celdaMoneda(
        registro.total_q,
        2
      ),

      celdaLibras(
        registro.total_lbs
      ),

      celdaCostoLibra(
        registro.q_por_lb
      ),

      celda(
        registro.recolecciones,
        "tableCellCenter"
      ),
    ]
  );
}


/* =========================================================
   FILAS TOP CONTENEDORES
   ========================================================= */

function crearFilasTopContenedores(
  topContenedores = []
) {
  if (
    !topContenedores.length
  ) {
    return [
      filaVacia(2),
    ];
  }


  return topContenedores.map(
    (registro) => [
      celda(
        registro.contenedor_codigo
      ),

      celdaMoneda(
        registro.total_q,
        2
      ),
    ]
  );
}


/* =========================================================
   FILAS DETALLE
   ========================================================= */

function crearFilasDetalle(
  detalle = []
) {
  if (!detalle.length) {
    return [
      filaVacia(8),
    ];
  }


  return detalle.map(
    (registro) => [
      celda(
        registro.fecha,
        "tableCellCenter"
      ),

      celda(
        registro.codigo_contenedor,
        "tableCellCenter"
      ),

      celda(
        registro.distrito
      ),

      celda(
        registro.empresa_recolectora
      ),

      celdaLibras(
        registro.total_en_libras
      ),

      celdaPorcentaje(
        registro.porcentaje_llenado
      ),

      celdaCostoLibra(
        registro.costo_por_libra_aplicado
      ),

      celdaMoneda(
        registro.total_costo_q,
        2
      ),
    ]
  );
}


/* =========================================================
   BLOQUE DE FILTROS
   ========================================================= */

function crearBloqueFiltros({
  filtros,
  totalRegistros,
}) {
  return {
    margin: [
      0,
      0,
      0,
      8,
    ],

    table: {
      widths: [
        70,
        "*",
        70,
        "*",
      ],

      body: [
        [
          {
            text:
              "Rango:",

            style:
              "filterLabel",
          },

          {
            text:
              `${fechaParaPdf(
                filtros?.fechaInicio
              )} — ${fechaParaPdf(
                filtros?.fechaFin
              )}`,
          },

          {
            text:
              "Agrupar por:",

            style:
              "filterLabel",
          },

          descripcionAgrupacion(
            filtros?.agruparPor
          ),
        ],

        [
          {
            text:
              "Distrito:",

            style:
              "filterLabel",
          },

          textoSeguro(
            filtros?.distritoNombre
          ),

          {
            text:
              "Empresa:",

            style:
              "filterLabel",
          },

          textoSeguro(
            filtros?.empresaNombre
          ),
        ],

        [
          {
            text:
              "Contenedor:",

            style:
              "filterLabel",
          },

          textoSeguro(
            filtros?.contenedorCodigo
          ),

          {
            text:
              "Orden:",

            style:
              "filterLabel",
          },

          descripcionOrden(
            filtros?.order
          ),
        ],

        [
          {
            text:
              "Registros:",

            style:
              "filterLabel",
          },

          textoSeguro(
            totalRegistros
          ),

          {},
          {},
        ],
      ],
    },

    layout: {
      hLineWidth() {
        return 0;
      },

      vLineWidth() {
        return 0;
      },

      paddingLeft() {
        return 2;
      },

      paddingRight() {
        return 6;
      },

      paddingTop() {
        return 2;
      },

      paddingBottom() {
        return 2;
      },
    },
  };
}


/* =========================================================
   KPIS
   ========================================================= */

function crearKpis(
  kpis = {}
) {
  const items = [
    {
      label:
        "Total Gastado",

      value:
        monedaQuetzales(
          kpis?.total_q,
          2
        ),
    },

    {
      label:
        "Total Libras",

      value:
        libras(
          kpis?.total_lbs
        ),
    },

    {
      label:
        "Promedio Q/lb",

      value:
        costoPorLibra(
          kpis?.q_por_lb
        ),
    },

    {
      label:
        "Recolecciones",

      value:
        textoSeguro(
          kpis?.recolecciones
        ),
    },
  ];


  return {
    margin: [
      0,
      0,
      0,
      8,
    ],

    table: {
      widths: [
        "*",
        "*",
        "*",
        "*",
      ],

      body: [
        items.map(
          (item) => ({
            stack: [
              {
                text:
                  item.value,

                bold:
                  true,

                fontSize:
                  10,

                alignment:
                  "center",

                color:
                  PDF_COLORS.text,

                margin: [
                  0,
                  2,
                  0,
                  3,
                ],
              },

              {
                text:
                  item.label,

                fontSize:
                  7.5,

                alignment:
                  "center",

                color:
                  PDF_COLORS.muted,
              },
            ],

            margin: [
              4,
              5,
              4,
              5,
            ],
          })
        ),
      ],
    },

    layout: {
      hLineWidth() {
        return 0.5;
      },

      vLineWidth() {
        return 0.5;
      },

      hLineColor() {
        return PDF_COLORS.border;
      },

      vLineColor() {
        return PDF_COLORS.border;
      },

      paddingLeft() {
        return 3;
      },

      paddingRight() {
        return 3;
      },

      paddingTop() {
        return 3;
      },

      paddingBottom() {
        return 3;
      },
    },
  };
}


/* =========================================================
   CONSTRUIR DOCUMENTO
   ========================================================= */

function construirDocumento({
  filtros = {},
  generadoPor = {},
  kpis = {},
  resumen = [],
  topContenedores = [],
  detalle = [],
}) {
  const generadoPorTexto =
    generadoPor?.nombre ||
    generadoPor?.usuario ||
    "N/A";


  const totalRegistros =
    Array.isArray(
      detalle
    )
      ? detalle.length
      : 0;


  return {

    /* =====================================================
       INFORMACIÓN DEL DOCUMENTO
       ===================================================== */

    info: {
      title:
        "Reporte de Costos",

      subject:
        "Control DSH",

      creator:
        "Sistema de Monitoreo",
    },


    /* =====================================================
       PÁGINA
       ===================================================== */

    pageSize:
      "A4",

    /*
      El detalle contiene 8 columnas.

      Landscape evita comprimir excesivamente empresa,
      distrito y valores numéricos.
    */
    pageOrientation:
      "landscape",

    pageMargins: [
      28,
      32,
      28,
      35,
    ],


    /* =====================================================
       ESTILO GENERAL
       ===================================================== */

    defaultStyle: {
      font:
        "Roboto",

      fontSize:
        8,

      color:
        PDF_COLORS.text,
    },


    styles:
      PDF_STYLES,


    /* =====================================================
       PIE DE PÁGINA
       ===================================================== */

    footer(
      currentPage,
      pageCount
    ) {
      return {
        columns: [
          {
            text:
              "Control DSH",

            style:
              "footer",

            margin: [
              28,
              8,
              0,
              0,
            ],
          },

          {
            text:
              `Página ${currentPage} de ${pageCount}`,

            style:
              "footer",

            alignment:
              "right",

            margin: [
              0,
              8,
              28,
              0,
            ],
          },
        ],
      };
    },


    /* =====================================================
       CONTENIDO
       ===================================================== */

    content: [

      /* =========================
         TÍTULO
         ========================= */

      {
        text:
          "Reporte de Costos",

        style:
          "title",
      },


      {
        text:
          "Control DSH",

        style:
          "subtitle",

        margin: [
          0,
          2,
          0,
          5,
        ],
      },


      /* =========================
         METADATOS
         ========================= */

      {
        columns: [
          {
            text: [
              {
                text:
                  "Generado por: ",

                bold:
                  true,
              },

              textoSeguro(
                generadoPorTexto
              ),

              generadoPor?.usuario
                ? ` (${textoSeguro(
                    generadoPor.usuario
                  )})`
                : "",
            ],

            style:
              "metadata",
          },

          {
            text: [
              {
                text:
                  "Fecha/Hora: ",

                bold:
                  true,
              },

              fechaHoraGuatemala(),
            ],

            style:
              "metadata",

            alignment:
              "right",
          },
        ],

        margin: [
          0,
          0,
          0,
          8,
        ],
      },


      /* =========================
         LÍNEA
         ========================= */

      {
        canvas: [
          {
            type:
              "line",

            x1:
              0,

            y1:
              0,

            x2:
              785,

            y2:
              0,

            lineWidth:
              1,

            lineColor:
              PDF_COLORS.primary,
          },
        ],

        margin: [
          0,
          0,
          0,
          7,
        ],
      },


      /* =========================
         FILTROS
         ========================= */

      {
        text:
          "Cómo se hizo la búsqueda",

        style:
          "sectionTitle",
      },


      crearBloqueFiltros({
        filtros,
        totalRegistros,
      }),


      /* =========================
         KPIS
         ========================= */

      {
        text:
          "Resultados",

        style:
          "sectionTitle",
      },


      crearKpis(
        kpis
      ),


      /* =========================
         RESUMEN
         ========================= */

      {
        text:
          "Resumen de Costos",

        style:
          "sectionTitle",
      },


      {
        table: {
          headerRows:
            1,

          dontBreakRows:
            true,

          widths: [
            "*",
            110,
            110,
            110,
            90,
          ],

          body: [
            crearHeader([
              "Periodo",
              "Total (Q)",
              "Total lb",
              "Promedio Q/lb",
              "# Recolecciones",
            ]),

            ...crearFilasResumen(
              resumen
            ),
          ],
        },

        layout:
          PDF_TABLE_LAYOUT,
      },


      /* =========================
         TOP 5
         ========================= */

      {
        text:
          "Top 5 Contenedores por Costo",

        style:
          "sectionTitle",

        margin: [
          0,
          13,
          0,
          5,
        ],
      },


      {
        table: {
          headerRows:
            1,

          dontBreakRows:
            true,

          widths: [
            "*",
            180,
          ],

          body: [
            crearHeader([
              "Contenedor",
              "Total (Q)",
            ]),

            ...crearFilasTopContenedores(
              topContenedores
            ),
          ],
        },

        layout:
          PDF_TABLE_LAYOUT,
      },


      /* =========================
         DETALLE
         ========================= */

      {
        text:
          "Detalle de Recolecciones",

        style:
          "sectionTitle",

        margin: [
          0,
          13,
          0,
          5,
        ],
      },


      {
        table: {
          headerRows:
            1,

          dontBreakRows:
            true,

          widths: [
            72,
            62,
            75,
            "*",
            70,
            65,
            88,
            80,
          ],

          body: [
            crearHeader([
              "Fecha",
              "Código",
              "Distrito",
              "Empresa",
              "Total lb",
              "% Llenado",
              "Costo/lb",
              "Total (Q)",
            ]),

            ...crearFilasDetalle(
              detalle
            ),
          ],
        },

        layout:
          PDF_TABLE_LAYOUT,
      },
    ],
  };
}


/* =========================================================
   GENERAR PDF

   CONTRATO PÚBLICO CONSERVADO.

   Controller no necesita saber si internamente utilizamos
   Puppeteer, pdfmake u otro motor.
   ========================================================= */

async function buildHistorialCostoPdfBuffer({
  filtros,
  generadoPor,
  kpis,
  resumen,
  topContenedores,
  detalle,
}) {
  const documentDefinition =
    construirDocumento({
      filtros:
        filtros &&
        typeof filtros === "object"
          ? filtros
          : {},

      generadoPor:
        generadoPor &&
        typeof generadoPor === "object"
          ? generadoPor
          : {},

      kpis:
        kpis &&
        typeof kpis === "object"
          ? kpis
          : {},

      resumen:
        Array.isArray(
          resumen
        )
          ? resumen
          : [],

      topContenedores:
        Array.isArray(
          topContenedores
        )
          ? topContenedores
          : [],

      detalle:
        Array.isArray(
          detalle
        )
          ? detalle
          : [],
    });


  return crearPdfBuffer(
    documentDefinition
  );
}


/* =========================================================
   EXPORTACIÓN PÚBLICA
   ========================================================= */

module.exports = {
  buildHistorialCostoPdfBuffer,
};