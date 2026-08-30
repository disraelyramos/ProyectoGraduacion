const path = require("path");
const pdfmake = require("pdfmake");


/* =========================================================
   FUENTES ROBOTO

   Obtenemos las rutas reales instaladas por npm.

   Estas mismas rutas serán las ÚNICAS rutas locales
   autorizadas para pdfmake.
   ========================================================= */

const ROBOTO_REGULAR =
  require.resolve(
    "pdfmake/build/fonts/Roboto/Roboto-Regular.ttf"
  );

const ROBOTO_MEDIUM =
  require.resolve(
    "pdfmake/build/fonts/Roboto/Roboto-Medium.ttf"
  );

const ROBOTO_ITALIC =
  require.resolve(
    "pdfmake/build/fonts/Roboto/Roboto-Italic.ttf"
  );

const ROBOTO_MEDIUM_ITALIC =
  require.resolve(
    "pdfmake/build/fonts/Roboto/Roboto-MediumItalic.ttf"
  );


/* =========================================================
   POLÍTICA DE ACCESO A URL

   Los reportes del sistema NO necesitan descargar:

   - imágenes externas
   - fuentes externas
   - archivos externos

   Por seguridad se bloquea TODO acceso HTTP/HTTPS.

   Esto también evita que una definición de PDF manipulada
   provoque solicitudes externas desde el servidor.
   ========================================================= */

pdfmake.setUrlAccessPolicy(
  () => false
);


/* =========================================================
   POLÍTICA DE ACCESO LOCAL

   pdfmake necesita leer las fuentes Roboto desde node_modules.

   No damos acceso general al sistema de archivos.

   Únicamente permitimos exactamente las cuatro fuentes
   utilizadas por nuestros reportes.
   ========================================================= */

const ARCHIVOS_LOCALES_PERMITIDOS =
  new Set(
    [
      ROBOTO_REGULAR,
      ROBOTO_MEDIUM,
      ROBOTO_ITALIC,
      ROBOTO_MEDIUM_ITALIC,
    ].map(
      (archivo) =>
        path.resolve(
          archivo
        )
    )
  );


pdfmake.setLocalAccessPolicy(
  (archivoSolicitado) => {
    if (
      typeof archivoSolicitado !==
      "string"
    ) {
      return false;
    }


    let rutaNormalizada;


    try {
      rutaNormalizada =
        path.resolve(
          archivoSolicitado
        );
    } catch {
      return false;
    }


    return (
      ARCHIVOS_LOCALES_PERMITIDOS.has(
        rutaNormalizada
      )
    );
  }
);


/* =========================================================
   REGISTRAR FUENTES

   Se utilizan únicamente las rutas que acabamos de incluir
   en la política local.
   ========================================================= */

pdfmake.addFonts({
  Roboto: {
    normal:
      ROBOTO_REGULAR,

    bold:
      ROBOTO_MEDIUM,

    italics:
      ROBOTO_ITALIC,

    bolditalics:
      ROBOTO_MEDIUM_ITALIC,
  },
});


/* =========================================================
   COLORES GENERALES DE PDF

   Equivalente a estilos globales reutilizables para todos
   los reportes.
   ========================================================= */

const PDF_COLORS =
  Object.freeze({
    primary:
      "#0D6EFD",

    text:
      "#212529",

    muted:
      "#6C757D",

    border:
      "#DDE2E6",

    tableHeader:
      "#111827",

    tableHeaderText:
      "#FFFFFF",

    tableAlternate:
      "#F6F8FA",
  });


/* =========================================================
   ESTILOS GENERALES
   ========================================================= */

const PDF_STYLES =
  Object.freeze({
    title: {
      fontSize:
        17,

      bold:
        true,

      color:
        PDF_COLORS.text,

      alignment:
        "center",
    },


    subtitle: {
      fontSize:
        10,

      color:
        PDF_COLORS.muted,

      alignment:
        "center",
    },


    metadata: {
      fontSize:
        8,

      color:
        PDF_COLORS.muted,
    },


    sectionTitle: {
      fontSize:
        11,

      bold:
        true,

      color:
        PDF_COLORS.text,

      margin: [
        0,
        8,
        0,
        5,
      ],
    },


    filterLabel: {
      bold:
        true,
    },


    tableHeader: {
      fontSize:
        7.5,

      bold:
        true,

      color:
        PDF_COLORS.tableHeaderText,

      alignment:
        "center",
    },


    tableCell: {
      fontSize:
        7.2,

      color:
        PDF_COLORS.text,
    },


    tableCellCenter: {
      fontSize:
        7.2,

      color:
        PDF_COLORS.text,

      alignment:
        "center",
    },


    tableCellRight: {
      fontSize:
        7.2,

      color:
        PDF_COLORS.text,

      alignment:
        "right",
    },


    empty: {
      fontSize:
        8,

      color:
        PDF_COLORS.muted,

      alignment:
        "center",

      italics:
        true,
    },


    footer: {
      fontSize:
        7,

      color:
        PDF_COLORS.muted,
    },
  });


/* =========================================================
   DISEÑO GENERAL DE TABLAS
   ========================================================= */

const PDF_TABLE_LAYOUT = {
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
    return 4;
  },


  paddingRight() {
    return 4;
  },


  paddingTop() {
    return 4;
  },


  paddingBottom() {
    return 4;
  },
};


/* =========================================================
   CREAR BUFFER PDF

   Todos los reportes utilizan este único punto de entrada
   para convertir documentDefinition en Buffer.
   ========================================================= */

async function crearPdfBuffer(
  documentDefinition
) {
  if (
    !documentDefinition ||
    typeof documentDefinition !==
      "object" ||
    Array.isArray(
      documentDefinition
    )
  ) {
    throw new Error(
      "La definición del PDF es inválida."
    );
  }


  const pdf =
    pdfmake.createPdf(
      documentDefinition
    );


  const buffer =
    await pdf.getBuffer();


  return Buffer.isBuffer(
    buffer
  )
    ? buffer
    : Buffer.from(
        buffer
      );
}


/* =========================================================
   EXPORTACIONES
   ========================================================= */

module.exports = {
  PDF_COLORS,
  PDF_STYLES,
  PDF_TABLE_LAYOUT,
  crearPdfBuffer,
};