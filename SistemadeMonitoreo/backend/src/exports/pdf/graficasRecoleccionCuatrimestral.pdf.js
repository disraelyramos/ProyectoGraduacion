// backend/src/exports/pdf/graficasRecoleccionCuatrimestral.pdf.js

const {
  PDF_COLORS,
  PDF_STYLES,
  PDF_TABLE_LAYOUT,
  crearPdfBuffer,
} = require("./pdfmake.config.js");


/* =========================================================
   CONSTANTES
   ========================================================= */

const NOMBRES_CUATRIMESTRES =
  Object.freeze({
    1: "Primer cuatrimestre",
    2: "Segundo cuatrimestre",
    3: "Tercer cuatrimestre",
  });


const CATEGORIAS_DEFECTO =
  Object.freeze([
    "Semana 1",
    "Semana 2",
    "Semana 3",
    "Semana 4",
    "Semana 5",
  ]);


/* =========================================================
   COLORES DE LAS GRÁFICAS
   ========================================================= */

const CHART_COLORS =
  Object.freeze({
    bio:
      "#0D6EFD",

    punzo:
      "#DC3545",

    grid:
      "#D9DEE3",

    axis:
      "#6C757D",

    text:
      "#343A40",

    background:
      "#FFFFFF",

    cardHeader:
      "#212529",
  });


/* =========================================================
   TEXTO SEGURO
   ========================================================= */

function textoSeguro(
  valor
) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) {
    return "-";
  }


  const texto =
    String(
      valor
    ).trim();


  return texto || "-";
}


/* =========================================================
   NÚMERO SEGURO
   ========================================================= */

function numeroSeguro(
  valor
) {
  const numero =
    Number(
      valor
    );


  return Number.isFinite(
    numero
  )
    ? numero
    : 0;
}


/* =========================================================
   ESCAPAR TEXTO PARA SVG
   ========================================================= */

function escaparSvg(
  valor
) {
  return String(
    valor ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&apos;"
    );
}


/* =========================================================
   FORMATEAR LIBRAS
   ========================================================= */

function libras(
  valor
) {
  return `${numeroSeguro(
    valor
  ).toLocaleString(
    "es-GT",
    {
      minimumFractionDigits:
        2,

      maximumFractionDigits:
        2,
    }
  )} lb`;
}


/* =========================================================
   FECHA / HORA GUATEMALA
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
   OBTENER SERIE POR NOMBRE
   ========================================================= */

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
        item?.name ===
        nombre
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
      length:
        5,
    },
    (
      _,
      index
    ) =>
      numeroSeguro(
        serie.data[
          index
        ]
      )
  );
}


/* =========================================================
   OBTENER CATEGORÍAS
   ========================================================= */

function obtenerCategorias(
  mes
) {
  if (
    !Array.isArray(
      mes?.categorias
    )
  ) {
    return [
      ...CATEGORIAS_DEFECTO,
    ];
  }


  return Array.from(
    {
      length:
        5,
    },
    (
      _,
      index
    ) =>
      textoSeguro(
        mes.categorias[
          index
        ] ||
        `Semana ${index + 1}`
      )
  );
}


/* =========================================================
   MÁXIMO DEL EJE Y
   ========================================================= */

function calcularMaximoEje(
  valores
) {
  const maximoReal =
    Math.max(
      0,
      ...valores.map(
        numeroSeguro
      )
    );


  if (
    maximoReal <= 0
  ) {
    return 4;
  }


  const objetivo =
    maximoReal *
    1.1;


  const magnitud =
    10 **
    Math.floor(
      Math.log10(
        objetivo
      )
    );


  const normalizado =
    objetivo /
    magnitud;


  let factor =
    1;


  if (
    normalizado <= 1
  ) {
    factor =
      1;

  } else if (
    normalizado <= 2
  ) {
    factor =
      2;

  } else if (
    normalizado <= 5
  ) {
    factor =
      5;

  } else {
    factor =
      10;
  }


  return factor *
    magnitud;
}


/* =========================================================
   FORMATO DEL EJE Y
   ========================================================= */

function formatearEje(
  valor
) {
  const numero =
    numeroSeguro(
      valor
    );


  if (
    Number.isInteger(
      numero
    )
  ) {
    return String(
      numero
    );
  }


  return numero.toFixed(
    1
  );
}


/* =========================================================
   CONSTRUIR PUNTOS PARA SVG
   ========================================================= */

function construirPuntos({
  valores,
  xInicial,
  anchoGrafica,
  ySuperior,
  altoGrafica,
  maximoEje,
}) {
  const distanciaX =
    anchoGrafica /
    4;


  return Array.from(
    {
      length:
        5,
    },
    (
      _,
      index
    ) => {

      const valor =
        numeroSeguro(
          valores[
            index
          ]
        );


      const x =
        xInicial +
        (
          distanciaX *
          index
        );


      const proporcion =
        maximoEje > 0
          ? valor /
            maximoEje
          : 0;


      const y =
        ySuperior +
        altoGrafica -
        (
          proporcion *
          altoGrafica
        );


      return {
        x,
        y,
        valor,
      };
    }
  );
}


/* =========================================================
   PUNTOS PARA POLYLINE
   ========================================================= */

function puntosPolyline(
  puntos
) {
  return puntos
    .map(
      (
        punto
      ) =>
        `${punto.x.toFixed(
          2
        )},${punto.y.toFixed(
          2
        )}`
    )
    .join(
      " "
    );
}


/* =========================================================
   CREAR GRÁFICA SVG DEL MES
   ========================================================= */

function crearGraficaSvg(
  mes
) {
  const width =
    760;

  const height =
    285;


  const margenIzquierdo =
    55;

  const margenDerecho =
    25;

  const margenSuperior =
    25;

  const margenInferior =
    60;


  const anchoGrafica =
    width -
    margenIzquierdo -
    margenDerecho;


  const altoGrafica =
    height -
    margenSuperior -
    margenInferior;


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
    obtenerCategorias(
      mes
    );


  const maximoEje =
    calcularMaximoEje([
      ...bio,
      ...punzo,
    ]);


  const puntosBio =
    construirPuntos({
      valores:
        bio,

      xInicial:
        margenIzquierdo,

      anchoGrafica,

      ySuperior:
        margenSuperior,

      altoGrafica,

      maximoEje,
    });


  const puntosPunzo =
    construirPuntos({
      valores:
        punzo,

      xInicial:
        margenIzquierdo,

      anchoGrafica,

      ySuperior:
        margenSuperior,

      altoGrafica,

      maximoEje,
    });


  const divisionesY =
    4;


  let svg =
    `
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="${width}"
      height="${height}"
      viewBox="0 0 ${width} ${height}"
    >

      <rect
        x="0"
        y="0"
        width="${width}"
        height="${height}"
        fill="${CHART_COLORS.background}"
      />
    `;


  /* =======================================================
     GRID HORIZONTAL
     ======================================================= */

  for (
    let i = 0;
    i <= divisionesY;
    i += 1
  ) {
    const proporcion =
      i /
      divisionesY;


    const y =
      margenSuperior +
      altoGrafica -
      (
        proporcion *
        altoGrafica
      );


    const valor =
      maximoEje *
      proporcion;


    svg += `
      <line
        x1="${margenIzquierdo}"
        y1="${y}"
        x2="${margenIzquierdo + anchoGrafica}"
        y2="${y}"
        stroke="${CHART_COLORS.grid}"
        stroke-width="1"
        stroke-dasharray="4 4"
      />

      <text
        x="${margenIzquierdo - 9}"
        y="${y + 4}"
        text-anchor="end"
        font-family="Roboto"
        font-size="11"
        fill="${CHART_COLORS.text}"
      >
        ${escaparSvg(
          formatearEje(
            valor
          )
        )}
      </text>
    `;
  }


  /* =======================================================
     GRID VERTICAL
     ======================================================= */

  const distanciaX =
    anchoGrafica /
    4;


  for (
    let index = 0;
    index < 5;
    index += 1
  ) {
    const x =
      margenIzquierdo +
      (
        distanciaX *
        index
      );


    svg += `
      <line
        x1="${x}"
        y1="${margenSuperior}"
        x2="${x}"
        y2="${margenSuperior + altoGrafica}"
        stroke="${CHART_COLORS.grid}"
        stroke-width="1"
        stroke-dasharray="4 4"
      />

      <text
        x="${x}"
        y="${margenSuperior + altoGrafica + 20}"
        text-anchor="middle"
        font-family="Roboto"
        font-size="11"
        fill="${CHART_COLORS.text}"
      >
        ${escaparSvg(
          categorias[
            index
          ]
        )}
      </text>
    `;
  }


  /* =======================================================
     EJES
     ======================================================= */

  svg += `
    <line
      x1="${margenIzquierdo}"
      y1="${margenSuperior}"
      x2="${margenIzquierdo}"
      y2="${margenSuperior + altoGrafica}"
      stroke="${CHART_COLORS.axis}"
      stroke-width="1.2"
    />

    <line
      x1="${margenIzquierdo}"
      y1="${margenSuperior + altoGrafica}"
      x2="${margenIzquierdo + anchoGrafica}"
      y2="${margenSuperior + altoGrafica}"
      stroke="${CHART_COLORS.axis}"
      stroke-width="1.2"
    />
  `;


  /* =======================================================
     LÍNEAS
     ======================================================= */

  svg += `
    <polyline
      points="${puntosPolyline(
        puntosBio
      )}"
      fill="none"
      stroke="${CHART_COLORS.bio}"
      stroke-width="2.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />

    <polyline
      points="${puntosPolyline(
        puntosPunzo
      )}"
      fill="none"
      stroke="${CHART_COLORS.punzo}"
      stroke-width="2.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />
  `;


  /* =======================================================
     PUNTOS BIOINFECCIOSO
     ======================================================= */

  for (
    const punto of puntosBio
  ) {
    svg += `
      <circle
        cx="${punto.x}"
        cy="${punto.y}"
        r="3.5"
        fill="#FFFFFF"
        stroke="${CHART_COLORS.bio}"
        stroke-width="2"
      />
    `;
  }


  /* =======================================================
     PUNTOS PUNZOCORTANTE
     ======================================================= */

  for (
    const punto of puntosPunzo
  ) {
    svg += `
      <circle
        cx="${punto.x}"
        cy="${punto.y}"
        r="3.5"
        fill="#FFFFFF"
        stroke="${CHART_COLORS.punzo}"
        stroke-width="2"
      />
    `;
  }


  /* =======================================================
     LEYENDA
     ======================================================= */

  const leyendaY =
    height -
    15;


  svg += `
    <line
      x1="250"
      y1="${leyendaY}"
      x2="275"
      y2="${leyendaY}"
      stroke="${CHART_COLORS.bio}"
      stroke-width="2.5"
    />

    <circle
      cx="262.5"
      cy="${leyendaY}"
      r="3"
      fill="#FFFFFF"
      stroke="${CHART_COLORS.bio}"
      stroke-width="2"
    />

    <text
      x="282"
      y="${leyendaY + 4}"
      font-family="Roboto"
      font-size="11"
      fill="${CHART_COLORS.bio}"
    >
      Bioinfeccioso
    </text>


    <line
      x1="400"
      y1="${leyendaY}"
      x2="425"
      y2="${leyendaY}"
      stroke="${CHART_COLORS.punzo}"
      stroke-width="2.5"
    />

    <circle
      cx="412.5"
      cy="${leyendaY}"
      r="3"
      fill="#FFFFFF"
      stroke="${CHART_COLORS.punzo}"
      stroke-width="2"
    />

    <text
      x="432"
      y="${leyendaY + 4}"
      font-family="Roboto"
      font-size="11"
      fill="${CHART_COLORS.punzo}"
    >
      Punzocortante
    </text>
  `;


  svg += `
    </svg>
  `;


  return svg;
}


/* =========================================================
   HEADER DE TABLA
   ========================================================= */

function crearHeader(
  columnas
) {
  return columnas.map(
    (
      texto
    ) => ({
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
   CELDA NORMAL
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


/* =========================================================
   CELDA LIBRAS
   ========================================================= */

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


/* =========================================================
   RESUMEN CUATRIMESTRAL
   ========================================================= */

function crearResumenCuatrimestral(
  data
) {
  if (
    !Array.isArray(
      data
    ) ||
    data.length === 0
  ) {
    return {
      text:
        "Sin datos para mostrar.",

      style:
        "empty",
    };
  }


  const body = [
    crearHeader([
      "Mes",
      "Bioinfeccioso",
      "Punzocortante",
      "Total",
      "Promedio semanal",
    ]),
  ];


  for (
    const mes of data
  ) {
    body.push([
      celda(
        mes?.nombreMes
      ),

      celdaLibras(
        mes
          ?.totales
          ?.bioinfeccioso
      ),

      celdaLibras(
        mes
          ?.totales
          ?.punzocortante
      ),

      celdaLibras(
        mes
          ?.totales
          ?.general
      ),

      celdaLibras(
        mes
          ?.promedioSemanal
          ?.general
      ),
    ]);
  }


  return {
    table: {
      headerRows:
        1,

      dontBreakRows:
        true,

      widths: [
        "*",
        120,
        120,
        120,
        120,
      ],

      body,
    },

    layout:
      PDF_TABLE_LAYOUT,
  };
}


/* =========================================================
   TABLA SEMANAL DEL MES
   ========================================================= */

function crearTablaSemanal(
  mes
) {
  const categorias =
    obtenerCategorias(
      mes
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


  const filas =
    Array.from(
      {
        length:
          5,
      },
      (
        _,
        index
      ) => [
        celda(
          categorias[
            index
          ],
          "tableCellCenter"
        ),

        celdaLibras(
          bio[
            index
          ]
        ),

        celdaLibras(
          punzo[
            index
          ]
        ),

        celdaLibras(
          bio[
            index
          ] +
          punzo[
            index
          ]
        ),
      ]
    );


  return {
    table: {
      headerRows:
        1,

      dontBreakRows:
        true,

      widths: [
        "*",
        150,
        150,
        150,
      ],

      body: [
        crearHeader([
          "Periodo",
          "Bioinfeccioso",
          "Punzocortante",
          "Total",
        ]),

        ...filas,
      ],
    },

    layout:
      PDF_TABLE_LAYOUT,
  };
}


/* =========================================================
   KPIs DEL MES
   ========================================================= */

function crearResumenMes(
  mes
) {
  return {
    margin: [
      0,
      0,
      0,
      0,
    ],

    table: {
      widths: [
        "*",
        "*",
        "*",
      ],

      body: [
        [
          {
            stack: [
              {
                text:
                  "Total Bioinfeccioso",

                fontSize:
                  7.5,

                color:
                  PDF_COLORS.muted,

                alignment:
                  "center",
              },

              {
                text:
                  libras(
                    mes
                      ?.totales
                      ?.bioinfeccioso
                  ),

                bold:
                  true,

                alignment:
                  "center",

                margin: [
                  0,
                  3,
                  0,
                  0,
                ],
              },
            ],

            margin: [
              4,
              6,
              4,
              6,
            ],
          },


          {
            stack: [
              {
                text:
                  "Total Punzocortante",

                fontSize:
                  7.5,

                color:
                  PDF_COLORS.muted,

                alignment:
                  "center",
              },

              {
                text:
                  libras(
                    mes
                      ?.totales
                      ?.punzocortante
                  ),

                bold:
                  true,

                alignment:
                  "center",

                margin: [
                  0,
                  3,
                  0,
                  0,
                ],
              },
            ],

            margin: [
              4,
              6,
              4,
              6,
            ],
          },


          {
            stack: [
              {
                text:
                  "Promedio semanal general",

                fontSize:
                  7.5,

                color:
                  PDF_COLORS.muted,

                alignment:
                  "center",
              },

              {
                text:
                  libras(
                    mes
                      ?.promedioSemanal
                      ?.general
                  ),

                bold:
                  true,

                alignment:
                  "center",

                margin: [
                  0,
                  3,
                  0,
                  0,
                ],
              },
            ],

            margin: [
              4,
              6,
              4,
              6,
            ],
          },
        ],
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
    },
  };
}


/* =========================================================
   CABECERA OSCURA DEL MES
   ========================================================= */

function crearTituloMes(
  mes
) {
  const nombreMes =
    textoSeguro(
      mes?.nombreMes
    );


  return {
    table: {
      widths: [
        "*",
      ],

      body: [
        [
          {
            text:
              `Desechos Sólidos generados en el mes de ${nombreMes}`,

            color:
              "#FFFFFF",

            bold:
              true,

            fontSize:
              11,

            fillColor:
              CHART_COLORS.cardHeader,

            margin: [
              7,
              5,
              7,
              5,
            ],
          },
        ],
      ],
    },

    layout:
      "noBorders",

    margin: [
      0,
      0,
      0,
      5,
    ],
  };
}


/* =========================================================
   SECCIÓN COMPLETA DEL MES

   ORDEN:

   1. Título
   2. KPIs
   3. Tabla
   4. Gráfica
   ========================================================= */

function crearSeccionMes(
  mes
) {
  const nombreMes =
    textoSeguro(
      mes?.nombreMes
    );


  return {
    pageBreak:
      "before",

    stack: [

      /* ===================================================
         TÍTULO DEL MES
         =================================================== */

      crearTituloMes(
        mes
      ),


      /* ===================================================
         KPIs
         =================================================== */

      {
        text:
          `Resumen de ${nombreMes}`,

        style:
          "sectionTitle",

        margin: [
          0,
          5,
          0,
          4,
        ],
      },


      crearResumenMes(
        mes
      ),


      /* ===================================================
         TABLA
         =================================================== */

      {
        text:
          `Detalle de ${nombreMes}`,

        style:
          "sectionTitle",

        margin: [
          0,
          8,
          0,
          4,
        ],
      },


      crearTablaSemanal(
        mes
      ),


      /* ===================================================
         GRÁFICA
         =================================================== */

      {
        text:
          `Gráfica de ${nombreMes}`,

        style:
          "sectionTitle",

        margin: [
          0,
          8,
          0,
          1,
        ],
      },


      {
        svg:
          crearGraficaSvg(
            mes
          ),

        fit: [
          760,
          285,
        ],

        alignment:
          "center",

        margin: [
          0,
          0,
          0,
          0,
        ],
      },
    ],
  };
}


/* =========================================================
   CONSTRUIR DOCUMENTO
   ========================================================= */

function construirDocumento({
  filtros,
  generadoPor,
  data,
}) {
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
    ] ||
    "-";


  const generadoPorTexto =
    generadoPor?.nombre ||
    generadoPor?.usuario ||
    "N/A";


  const meses =
    Array.isArray(
      data
    )
      ? data
      : [];


  const contenidoMeses =
    meses.map(
      crearSeccionMes
    );


  return {
    info: {
      title:
        "Historial Gráfico de Recolección",

      subject:
        "Reporte cuatrimestral de recolección",

      creator:
        "Sistema de Monitoreo",
    },


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


    content: [

      /* ===================================================
         TÍTULO GENERAL
         =================================================== */

      {
        text:
          "Historial Gráfico de Recolección",

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


      /* ===================================================
         METADATOS
         =================================================== */

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
          8,
        ],
      },


      /* ===================================================
         FILTROS
         =================================================== */

      {
        text:
          "Filtros de consulta",

        style:
          "sectionTitle",
      },


      {
        margin: [
          0,
          0,
          0,
          8,
        ],

        table: {
          widths: [
            80,
            "*",
            100,
            "*",
          ],

          body: [
            [
              {
                text:
                  "Año:",

                style:
                  "filterLabel",
              },

              textoSeguro(
                anio
              ),

              {
                text:
                  "Cuatrimestre:",

                style:
                  "filterLabel",
              },

              cuatrimestreTexto,
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
      },


      /* ===================================================
         RESUMEN CUATRIMESTRAL
         =================================================== */

      {
        text:
          "Resumen Cuatrimestral",

        style:
          "sectionTitle",
      },


      crearResumenCuatrimestral(
        meses
      ),


      /* ===================================================
         DETALLE MES POR MES
         =================================================== */

      ...(contenidoMeses.length > 0
        ? contenidoMeses
        : [
            {
              text:
                "Sin información para mostrar.",

              style:
                "empty",
            },
          ]),
    ],
  };
}


/* =========================================================
   GENERAR PDF
   ========================================================= */

async function buildGraficasRecoleccionCuatrimestralPdfBuffer({
  filtros,
  generadoPor,
  data,
}) {
  const documentDefinition =
    construirDocumento({
      filtros:
        filtros &&
        typeof filtros ===
          "object"
          ? filtros
          : {},

      generadoPor:
        generadoPor &&
        typeof generadoPor ===
          "object"
          ? generadoPor
          : {},

      data:
        Array.isArray(
          data
        )
          ? data
          : [],
    });


  return crearPdfBuffer(
    documentDefinition
  );
}


/* =========================================================
   EXPORTACIÓN
   ========================================================= */

module.exports = {
  buildGraficasRecoleccionCuatrimestralPdfBuffer,
};