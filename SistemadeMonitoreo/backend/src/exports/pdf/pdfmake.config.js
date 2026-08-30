const pdfmake = require("pdfmake");


/* =========================================================
   FUENTES

   Se utilizan las fuentes Roboto incluidas dentro del
   paquete pdfmake.

   require.resolve obtiene la ruta real instalada por npm,
   evitando rutas absolutas o dependientes del equipo.
   ========================================================= */

pdfmake.addFonts({
  Roboto: {
    normal: require.resolve(
      "pdfmake/build/fonts/Roboto/Roboto-Regular.ttf"
    ),

    bold: require.resolve(
      "pdfmake/build/fonts/Roboto/Roboto-Medium.ttf"
    ),

    italics: require.resolve(
      "pdfmake/build/fonts/Roboto/Roboto-Italic.ttf"
    ),

    bolditalics: require.resolve(
      "pdfmake/build/fonts/Roboto/Roboto-MediumItalic.ttf"
    ),
  },
});


/* =========================================================
   COLORES GENERALES DE PDF

   Este será el equivalente al CSS general del frontend.
   Los demás reportes podrán reutilizar estos colores.
   ========================================================= */

const PDF_COLORS = Object.freeze({
  primary: "#0D6EFD",

  text: "#212529",

  muted: "#6C757D",

  border: "#DDE2E6",

  tableHeader: "#111827",

  tableHeaderText: "#FFFFFF",

  tableAlternate: "#F6F8FA",
});


/* =========================================================
   ESTILOS GENERALES
   ========================================================= */

const PDF_STYLES = Object.freeze({
  title: {
    fontSize: 17,
    bold: true,
    color: PDF_COLORS.text,
    alignment: "center",
  },

  subtitle: {
    fontSize: 10,
    color: PDF_COLORS.muted,
    alignment: "center",
  },

  metadata: {
    fontSize: 8,
    color: PDF_COLORS.muted,
  },

  sectionTitle: {
    fontSize: 11,
    bold: true,
    color: PDF_COLORS.text,
    margin: [0, 8, 0, 5],
  },

  filterLabel: {
    bold: true,
  },

  tableHeader: {
    fontSize: 7.5,
    bold: true,
    color: PDF_COLORS.tableHeaderText,
    alignment: "center",
  },

  tableCell: {
    fontSize: 7.2,
    color: PDF_COLORS.text,
  },

  tableCellCenter: {
    fontSize: 7.2,
    color: PDF_COLORS.text,
    alignment: "center",
  },

  tableCellRight: {
    fontSize: 7.2,
    color: PDF_COLORS.text,
    alignment: "right",
  },

  empty: {
    fontSize: 8,
    color: PDF_COLORS.muted,
    alignment: "center",
    italics: true,
  },

  footer: {
    fontSize: 7,
    color: PDF_COLORS.muted,
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
   ========================================================= */

async function crearPdfBuffer(
  documentDefinition
) {
  if (
    !documentDefinition ||
    typeof documentDefinition !== "object"
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


  return Buffer.isBuffer(buffer)
    ? buffer
    : Buffer.from(buffer);
}


/* =========================================================
   EXPORTACIONES

   IMPORTANTE:
   historialRecoleccion.pdf.js obtiene estos nombres
   exactamente desde aquí.
   ========================================================= */

module.exports = {
  PDF_COLORS,
  PDF_STYLES,
  PDF_TABLE_LAYOUT,
  crearPdfBuffer,
};