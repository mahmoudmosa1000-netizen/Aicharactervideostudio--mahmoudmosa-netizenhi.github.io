// ─── backend/server.js ────────────────────────────────────────────────────────
// Haupt-Einstiegspunkt des Node.js/Express-Servers.
// Startet mit: npm run dev (nodemon) oder node server.js
// ─────────────────────────────────────────────────────────────────────────────
require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const morgan     = require("morgan");
const path       = require("path");

const charactersRouter           = require("./routes/characters");
const { videosRouter, storyRouter } = require("./routes/videos");
const aiRouter                   = require("./routes/ai");

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.FRONTEND_URL
    : "http://localhost:3000",
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

// ─── API-Routen ───────────────────────────────────────────────────────────────
app.use("/api/characters", charactersRouter);
app.use("/api/videos",     videosRouter);
app.use("/api/story",      storyRouter);
app.use("/api/ai",         aiRouter);

// ─── Health-Check ─────────────────────────────────────────────────────────────
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── Frontend ausliefern (Produktion) ─────────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  app.use(express.static(path.join(__dirname, "../frontend/build")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "../frontend/build", "index.html"));
  });
}

// ─── Fehlerbehandlung ─────────────────────────────────────────────────────────
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, error: "Interner Serverfehler" });
});

// ─── Server starten ───────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🎬 AI Character Video Studio`);
  console.log(`   Backend läuft auf http://localhost:${PORT}`);
  console.log(`   Umgebung: ${process.env.NODE_ENV || "development"}\n`);
});
