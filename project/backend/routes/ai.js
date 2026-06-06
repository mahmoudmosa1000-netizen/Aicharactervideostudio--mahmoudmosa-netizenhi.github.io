// ─── backend/routes/ai.js ─────────────────────────────────────────────────────
// Server-seitiger Proxy für KI-API-Calls.
// Hält API-Keys sicher auf dem Server — nie im Frontend sichtbar.
// Base-URL: /api/ai
// ─────────────────────────────────────────────────────────────────────────────
const express = require("express");
const router  = express.Router();

const ANTHROPIC_URL  = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_KEY  = process.env.ANTHROPIC_API_KEY;

// ─── Hilfsfunktion: Claude aufrufen ──────────────────────────────────────────
async function callClaude(prompt, maxTokens = 1000) {
  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Anthropic Fehler");
  return data.content?.[0]?.text || "";
}

function parseJSON(text) {
  return JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
}

// POST /api/ai/analyze-character
// Body: { name, description }
router.post("/analyze-character", async (req, res) => {
  const { name, description } = req.body;
  if (!name || !description) {
    return res.status(400).json({ success: false, error: "name und description sind Pflichtfelder" });
  }
  try {
    const prompt = `Analyze this character for AI video generation consistency.
Character: ${name}
Description: ${description}
Respond ONLY with valid JSON (no markdown, no preamble):
{"coloring":"...","eyes":"...","clothing":"...","accessories":"...","build":"...","style":"...","traits":["t1","t2","t3"],"consistencyNote":"One sentence"}`;

    const text   = await callClaude(prompt);
    const result = parseJSON(text);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai/generate-story
// Body: { character, idea }
router.post("/generate-story", async (req, res) => {
  const { character, idea } = req.body;
  if (!character || !idea) {
    return res.status(400).json({ success: false, error: "character und idea sind Pflichtfelder" });
  }
  try {
    const prompt = `You are an AI video story writer. Generate exactly 5 connected scenes.
Character: ${character.name} — ${character.description}
Story idea: "${idea}"
${character.name} must appear identically in ALL scenes.
Respond ONLY with a raw JSON array:
[{"scene":1,"title":"...","description":"2-3 sentences","camera":"...","mood":"...","duration":"5s"}]`;

    const text   = await callClaude(prompt, 1200);
    const scenes = parseJSON(text);
    res.json({ success: true, data: scenes });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/ai/build-prompt
// Body: { character, scene, camera, style, duration, ratio }
router.post("/build-prompt", (req, res) => {
  const { character, scene, camera, style, duration, ratio } = req.body;
  if (!character || !scene) {
    return res.status(400).json({ success: false, error: "character und scene sind Pflichtfelder" });
  }
  const prompt =
    `[Character Consistency: ${character.name} — ${character.description}. ` +
    `Coloring: ${character.coloring}. Eyes: ${character.eyes}. ` +
    `Clothing: ${character.clothing}, ${character.accessories}. Build: ${character.build}. Style: ${character.style}.]` +
    ` Scene: ${scene}` +
    (camera ? ` Camera: ${camera}.` : "") +
    ` Visual style: ${style}. Duration: ${duration}s. Ratio: ${ratio}.`;

  res.json({ success: true, data: { prompt } });
});

module.exports = router;
