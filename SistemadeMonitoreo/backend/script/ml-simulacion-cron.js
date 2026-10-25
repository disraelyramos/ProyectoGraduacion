
"use strict";

require("dotenv").config();

const { Client } = require("pg");

const INICIO = Date.parse("2026-10-26T09:00:00-06:00");

async function ejecutar() {
  if (process.env.ML_SIMULATION_ENABLED !== "true") {
    console.log("Simulación ML deshabilitada.");
    return;
  }

  if (Date.now() < INICIO) {
    console.log(
      "La simulación inicia el 26/10/2026 a las 09:00, hora de Guatemala."
    );
    return;
  }

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Falta configurar DATABASE_URL."
    );
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
    query_timeout: 30000
  });

  try {
    await client.connect();

    console.log("Conectado a PostgreSQL.");
    console.log("Ejecutando simulación de lecturas...");

    await client.query(
      "CALL public.generar_lecturas_ml();"
    );

    console.log(
      "Simulación ejecutada correctamente."
    );

  } finally {
    await client.end();
  }
}

ejecutar().catch((error) => {
  console.error(
    "Error ejecutando simulación ML:",
    error.message
  );

  process.exitCode = 1;
});
