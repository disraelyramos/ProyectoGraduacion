const {
  PDF_COLORS,
  PDF_STYLES,
  PDF_TABLE_LAYOUT,
  crearPdfBuffer,
} = require("./pdfmake.config");


/* =========================================================
   CONSTANTES
   ========================================================= */

const MAX_TEXT_LENGTH = 500;


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
    ? `${texto.slice(0, maxLength)}…`
    : texto;
}


/* =========================================================
   PORCENTAJE
   ========================================================= */

function porcentaje(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }

  const numero =
    Number(valor);

  if (!Number.isFinite(numero)) {
    return textoSeguro(valor);
  }

  return `${numero}%`;
}


/* =========================================================
   FECHA PARA MOSTRAR EN PDF

   El backend continúa trabajando con YYYY-MM-DD.
   Aquí únicamente cambiamos su presentación visual:

   2026-08-01
        ↓
   01/08/2026
   ========================================================= */

function fechaParaPdf(valor) {
  const fecha =
    String(valor || "").trim();

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      fecha
    );

  if (!match) {
    return textoSeguro(valor);
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

  const numero =
    Number(valor);

  if (!Number.isFinite(numero)) {
    return textoSeguro(valor);
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
    ).format(numero);

  return `Q${monto}`;
}


/* =========================================================
   FECHA/HORA DE GENERACIÓN

   Se fuerza Guatemala porque el servidor puede estar
   desplegado en otra zona horaria.
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
   TIPO DE BÚSQUEDA
   ========================================================= */

function descripcionBuscarPor(
  buscarPor
) {
  switch (
    String(buscarPor || "")
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

function descripcionOrden(order) {
  return (
    String(order || "")
      .trim()
      .toLowerCase() === "asc"
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
      textoSeguro(valor),

    style,
  };
}


function celdaPorcentaje(valor) {
  return {
    text:
      porcentaje(valor),

    style:
      "tableCellCenter",
  };
}


/* =========================================================
   CABECERA DE TABLA
   ========================================================= */

function crearHeader(columnas) {
  return columnas.map(
    (texto) => ({
      text: texto,

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
   FILAS DE RECOLECCIÓN
   ========================================================= */

function crearFilasDetalle(
  detalle = []
) {
  if (!detalle.length) {
    return [
      [
        {
          text:
            "Sin registros para mostrar.",

          colSpan: 10,

          style:
            "empty",

          margin: [
            0,
            6,
            0,
            6,
          ],
        },

        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
        {},
      ],
    ];
  }


  return detalle.map(
    (registro) => [
      celda(
        registro.codigo
      ),

      celda(
        registro.fecha,
        "tableCellCenter"
      ),

      celda(
        registro.distrito
      ),

      celda(
        registro.tipo_residuo
      ),

      celda(
        registro.numero_recibo,
        "tableCellCenter"
      ),

      celda(
        registro.responsable
      ),

      celda(
        registro.empresa_recolectora
      ),

      celdaPorcentaje(
        registro.porcentaje_pendiente
      ),

      celda(
        registro.cantidad_libras_pendientes,
        "tableCellRight"
      ),

      celda(
        registro.observaciones
      ),
    ]
  );
}


/* =========================================================
   FILAS DE PESAJE
   ========================================================= */

function crearFilasPesaje(
  pesaje = []
) {
  if (!pesaje.length) {
    return [
      [
        {
          text:
            "Sin registros para mostrar.",

          colSpan: 5,

          style:
            "empty",

          margin: [
            0,
            6,
            0,
            6,
          ],
        },

        {},
        {},
        {},
        {},
      ],
    ];
  }


  return pesaje.map(
    (registro) => [
      celda(
        registro.total_en_libras,
        "tableCellRight"
      ),

      celdaPorcentaje(
        registro.porcentaje_recolectado
      ),

      celdaPorcentaje(
        registro.porcentaje_llenado
      ),

      /*
        El costo por libra conserva 4 decimales,
        porque el valor puede necesitar precisión.
      */
      celda(
        monedaQuetzales(
          registro.costo_por_libra_aplicado,
          4
        ),
        "tableCellRight"
      ),

      /*
        El costo total se muestra con 2 decimales.
      */
      celda(
        monedaQuetzales(
          registro.total_costo_q,
          2
        ),
        "tableCellRight"
      ),
    ]
  );
}


/* =========================================================
   BLOQUE DE FILTROS
   ========================================================= */

function crearBloqueFiltros({
  filtros,
  total,
}) {
  return {
    margin: [
      0,
      0,
      0,
      7,
    ],

    table: {
      widths: [
        90,
        "*",
        90,
        "*",
      ],

      body: [

        /* FILA 1 */

        [
          {
            text:
              "Buscar por:",

            style:
              "filterLabel",
          },

          textoSeguro(
            descripcionBuscarPor(
              filtros?.buscarPor
            )
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


        /* FILA 2 */

        [
          {
            text:
              "Búsqueda:",

            style:
              "filterLabel",
          },

          textoSeguro(
            filtros?.valorBusqueda
          ),

          {
            text:
              "Registros:",

            style:
              "filterLabel",
          },

          textoSeguro(
            total
          ),
        ],


        /* FILA 3 */

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

            colSpan: 3,
          },

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
   CONSTRUIR DOCUMENTO
   ========================================================= */

function construirDocumento({
  filtros = {},
  detalle = [],
  pesaje = [],
  generadoPor = {},
  total = 0,
}) {
  const generadoPorTexto =
    generadoPor?.nombre ||
    generadoPor?.usuario ||
    "N/A";


  return {

    /* =====================================================
       INFORMACIÓN
       ===================================================== */

    info: {
      title:
        "Historial de Recolección",

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
          "Historial de Recolección",

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
         USUARIO Y FECHA
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
        total,
      }),


      /* =========================
         TABLA RECOLECCIÓN
         ========================= */

      {
        text:
          "Datos de Registro de Recolección",

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
            50,
            62,
            52,
            70,
            55,
            75,
            75,
            48,
            55,
            "*",
          ],

          body: [

            crearHeader([
              "Código",
              "Fecha",
              "Distrito",
              "Tipo de residuo",
              "No. recibo",
              "Responsable",
              "Empresa",
              "% Pend.",
              "Lbs Pend.",
              "Observaciones",
            ]),

            ...crearFilasDetalle(
              detalle
            ),
          ],
        },

        layout:
          PDF_TABLE_LAYOUT,
      },


      /* =========================
         CONTROL DE PESAJE
         ========================= */

      {
        text:
          "Control de Pesaje",

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
            "*",
            "*",
            "*",
            "*",
          ],

          body: [

            crearHeader([
              "Total (lb)",
              "% Recolectado",
              "% Llenado Actual",
              "Costo por Libra",
              "Costo Total",
            ]),

            ...crearFilasPesaje(
              pesaje
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
   ========================================================= */

async function buildHistorialRecoleccionPdfBuffer({
  filtros,
  detalle,
  pesaje,
  generadoPor,
  total,
}) {
  const documentDefinition =
    construirDocumento({

      filtros:
        filtros &&
        typeof filtros === "object"
          ? filtros
          : {},

      detalle:
        Array.isArray(detalle)
          ? detalle
          : [],

      pesaje:
        Array.isArray(pesaje)
          ? pesaje
          : [],

      generadoPor:
        generadoPor &&
        typeof generadoPor === "object"
          ? generadoPor
          : {},

      total:
        Number.isFinite(
          Number(total)
        )
          ? Number(total)
          : 0,
    });


  return crearPdfBuffer(
    documentDefinition
  );
}


/* =========================================================
   EXPORTACIÓN PÚBLICA
   ========================================================= */

module.exports = {
  buildHistorialRecoleccionPdfBuffer,
};