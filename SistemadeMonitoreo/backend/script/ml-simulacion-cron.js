
"use strict";

require("dotenv").config();

const pool = require("../src/config/db");

const INICIO = Date.parse("2026-10-26T09:00:00-06:00");

async function ejecutar() {
  if (process.env.ML_SIMULATION_ENABLED !== "true") {
    console.log("Simulación ML deshabilitada.");
    return;
  }

  if (Date.now() < INICIO) {
    console.log("Aún no corresponde iniciar la simulación.");
    return;
  }

  const requeridas = [
    "DB_HOST",
    "DB_PORT",
    "DB_NAME",
    "DB_USER",
    "DB_PASSWORD"
  ];

  for (const variable of requeridas) {
    if (!process.env[variable]) {
      throw new Error(`Falta la variable ${variable}`);
    }
  }

  try {
    console.log("Conectando a PostgreSQL...");

    await pool.query("SELECT 1");

    console.log("Conexión PostgreSQL establecida.");

    await pool.query(
      "CALL public.generar_lecturas_ml()"
    );

    console.log(
      "Procedimiento ejecutado correctamente."
    );
  } finally {
    await pool.end();
  }
}

ejecutar().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
