// ─── backend/db/client.js ─────────────────────────────────────────────────────
// PostgreSQL-Verbindung über den "pg"-Pool.
// ─────────────────────────────────────────────────────────────────────────────
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false,
  max: 10,                // Maximale Verbindungen im Pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on("error", (err) => {
  console.error("Unerwarteter Datenbankfehler:", err);
});

// Hilfsfunktion für einfache Abfragen
async function query(text, params) {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (process.env.NODE_ENV !== "production") {
    console.log(`[DB] ${duration}ms — ${text.slice(0, 60)}`);
  }
  return res;
}

module.exports = { pool, query };
