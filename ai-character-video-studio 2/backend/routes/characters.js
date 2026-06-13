// ─── backend/routes/characters.js ────────────────────────────────────────────
// REST-API-Endpunkte für Charakter-Verwaltung.
// Base-URL: /api/characters
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const router  = express.Router();
const { query } = require("../db/client");

// GET /api/characters — alle Charaktere abrufen
router.get("/", async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM characters ORDER BY created_at DESC"
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/characters/:id — einen Charakter abrufen
router.get("/:id", async (req, res) => {
  try {
    const result = await query(
      "SELECT * FROM characters WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Charakter nicht gefunden" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/characters — neuen Charakter anlegen
router.post("/", async (req, res) => {
  const { name, description, locked = false, color = "#a78bfa",
          coloring, eyes, clothing, accessories, build, style,
          traits = [], consistencyNote } = req.body;

  if (!name || !description) {
    return res.status(400).json({ success: false, error: "Name und Beschreibung sind Pflichtfelder" });
  }

  try {
    const result = await query(
      `INSERT INTO characters
         (name, description, locked, color, coloring, eyes, clothing, accessories, build, style, traits, consistency_note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [name, description, locked, color, coloring, eyes, clothing, accessories, build, style, traits, consistencyNote]
    );
    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/characters/:id — Charakter aktualisieren (z. B. Lock-Status)
router.patch("/:id", async (req, res) => {
  const { locked, name, description, traits } = req.body;
  try {
    const result = await query(
      `UPDATE characters
       SET locked = COALESCE($1, locked),
           name   = COALESCE($2, name),
           description = COALESCE($3, description),
           traits = COALESCE($4, traits),
           updated_at  = NOW()
       WHERE id = $5
       RETURNING *`,
      [locked, name, description, traits, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Charakter nicht gefunden" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/characters/:id — Charakter löschen
router.delete("/:id", async (req, res) => {
  try {
    const result = await query(
      "DELETE FROM characters WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Charakter nicht gefunden" });
    }
    res.json({ success: true, message: "Charakter gelöscht" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
