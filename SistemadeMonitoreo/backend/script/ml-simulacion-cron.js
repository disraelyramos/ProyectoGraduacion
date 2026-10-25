
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

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    ssl: process.env.DB_SSL?.toLowerCase() === "true"
      ? { rejectUnauthorized: true }
      : false,
    connectionTimeoutMillis: 15000,
    query_timeout: 30000
  });

  try {
    await client.connect();

    console.log("Conexión PostgreSQL establecida.");

    await client.query(
      "CALL public.generar_lecturas_ml()"
    );

    console.log("Procedimiento ejecutado correctamente.");
  } finally {
    await client.end();
  }
}

ejecutar().catch((error) => {
  console.error("Error:", error.message);
  process.exitCode = 1;
});
