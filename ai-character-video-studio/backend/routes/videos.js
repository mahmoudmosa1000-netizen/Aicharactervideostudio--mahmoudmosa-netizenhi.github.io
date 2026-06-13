// ─── backend/routes/videos.js ────────────────────────────────────────────────
// REST-API für Video-Generierung und -Verwaltung.
// Base-URL: /api/videos
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const router  = express.Router();
const { query } = require("../db/client");

// GET /api/videos — alle Videos
router.get("/", async (req, res) => {
  try {
    const result = await query(`
      SELECT v.*, c.name AS char_name, c.color AS char_color
      FROM videos v
      JOIN characters c ON v.character_id = c.id
      ORDER BY v.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/videos — Video generieren
router.post("/", async (req, res) => {
  const { charId, scene, camera, style, duration, ratio, model, prompt } = req.body;
  if (!charId || !scene) {
    return res.status(400).json({ success: false, error: "charId und scene sind Pflichtfelder" });
  }
  try {
    // In DB speichern
    const result = await query(
      `INSERT INTO videos (character_id, scene, camera, style, duration, ratio, model, prompt, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'queued') RETURNING *`,
      [charId, scene, camera, style, duration || "5s", ratio || "9:16", model || "kling", prompt]
    );
    const video = result.rows[0];

    // Generierung asynchron starten (hier: Stub)
    triggerVideoGeneration(video);

    res.status(201).json({ success: true, data: video });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/videos/:id/status — Status abfragen
router.get("/:id/status", async (req, res) => {
  try {
    const result = await query(
      "SELECT id, status, video_url, error_message FROM videos WHERE id = $1",
      [req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Video nicht gefunden" });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/videos/:id
router.delete("/:id", async (req, res) => {
  try {
    await query("DELETE FROM videos WHERE id = $1", [req.params.id]);
    res.json({ success: true, message: "Video gelöscht" });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/videos/:id/export — Export-Format anfordern
router.post("/:id/export", async (req, res) => {
  const { format = "mp4" } = req.body;
  // Hier würde die Export-Logik (Transcoding, Watermark etc.) stattfinden
  res.json({
    success: true,
    data: { videoId: req.params.id, format, downloadUrl: `/exports/${req.params.id}.${format}` },
  });
});

// ─── Hilfsfunktion: Videogenerierung anstoßen ─────────────────────────────────
async function triggerVideoGeneration(video) {
  try {
    await query("UPDATE videos SET status = 'processing' WHERE id = $1", [video.id]);
    // Hier: echte API-Calls an Kling / Runway / Luma
    // z.B. await klingApi.generate(video.prompt)
    // Nach Abschluss: status auf 'done' setzen, video_url eintragen
  } catch (err) {
    await query("UPDATE videos SET status = 'error', error_message = $1 WHERE id = $2",
      [err.message, video.id]);
  }
}

module.exports = router;


// ─── backend/routes/story.js ─────────────────────────────────────────────────
// REST-API für Story-Generierung und -Verwaltung.
// In einer separaten Datei im echten Projekt — hier zur Übersicht zusammengefasst.
// ─────────────────────────────────────────────────────────────────────────────
const storyRouter = express.Router();

// GET /api/story
storyRouter.get("/", async (req, res) => {
  try {
    const result = await query(`
      SELECT s.*, c.name AS char_name,
        json_agg(ss.* ORDER BY ss.scene_number) AS scenes
      FROM stories s
      JOIN characters c ON s.character_id = c.id
      LEFT JOIN story_scenes ss ON ss.story_id = s.id
      GROUP BY s.id, c.name
      ORDER BY s.created_at DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/story — Story mit Szenen speichern
storyRouter.post("/", async (req, res) => {
  const { charId, idea, scenes } = req.body;
  if (!charId || !idea || !scenes?.length) {
    return res.status(400).json({ success: false, error: "charId, idea und scenes sind Pflichtfelder" });
  }
  try {
    // Story anlegen
    const storyResult = await query(
      "INSERT INTO stories (character_id, idea) VALUES ($1, $2) RETURNING *",
      [charId, idea]
    );
    const story = storyResult.rows[0];

    // Szenen anlegen
    for (const s of scenes) {
      await query(
        `INSERT INTO story_scenes (story_id, scene_number, title, description, camera, mood, duration)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [story.id, s.scene, s.title, s.description, s.camera, s.mood, s.duration]
      );
    }

    // Serien-Zähler erhöhen
    await query(
      "UPDATE characters SET series_count = series_count + 1 WHERE id = $1",
      [charId]
    );

    res.status(201).json({ success: true, data: { ...story, scenes } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = { videosRouter: router, storyRouter };
