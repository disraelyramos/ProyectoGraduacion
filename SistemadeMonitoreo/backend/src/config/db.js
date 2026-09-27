const {
  Pool,
} = require("pg");

require("dotenv").config();


// ======================================================
// CONFIGURACIÓN SSL
// ======================================================
//
// DB_SSL=true  → conexión con SSL.
// DB_SSL=false → conexión sin SSL.
//
// Si DB_SSL no existe, se conserva
// el comportamiento anterior:
// SSL en producción y sin SSL en desarrollo.
// ======================================================

const sslConfigurado = String(
  process.env.DB_SSL ?? ""
)
  .trim()
  .toLowerCase();


if (
  sslConfigurado &&
  !["true", "false"].includes(
    sslConfigurado
  )
) {

  throw new Error(
    "DB_SSL debe configurarse como true o false."
  );

}


const usarSSL =
  sslConfigurado === "true" ||
  (
    !sslConfigurado &&
    process.env.NODE_ENV === "production"
  );


// ======================================================
// CERTIFICADO SSL OPCIONAL
// ======================================================
//
// Para proveedores que requieren un
// certificado CA específico.
//
// No desactivamos la validación
// de certificados.
// ======================================================

const certificadoCA =
  process.env.DB_SSL_CA
    ?.replace(/\\n/g, "\n")
    .trim();


// ======================================================
// CONFIGURACIÓN POSTGRESQL
// ======================================================

const pool = new Pool({

  user:
    process.env.DB_USER,

  host:
    process.env.DB_HOST,

  database:
    process.env.DB_NAME,

  password:
    process.env.DB_PASSWORD,

  port:
    Number(
      process.env.DB_PORT || 5432
    ),

  ssl: usarSSL

    ? {

        rejectUnauthorized: true,

        ...(certificadoCA
          ? {
              ca: certificadoCA,
            }
          : {}),

      }

    : false,

});


// ======================================================
// CONEXIÓN ESTABLECIDA
// ======================================================

pool.on(
  "connect",
  () => {

    console.log(
      "✅ Conectado a PostgreSQL"
    );

  }
);


// ======================================================
// ERROR EN CONEXIONES INACTIVAS
// ======================================================

pool.on(
  "error",
  (error) => {

    console.error(
      "❌ Error en la conexión a PostgreSQL:",
      error.message
    );

    process.exit(1);

  }
);


// ======================================================
// EXPORTACIÓN
// ======================================================

module.exports = pool;