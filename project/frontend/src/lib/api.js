// ─── lib/api.js ──────────────────────────────────────────────────────────────
// Zentraler API-Client für alle Backend-Anfragen und KI-Aufrufe.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:5000";
const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY;

// ─── Hilfsfunktionen ──────────────────────────────────────────────────────────

async function request(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Anfrage fehlgeschlagen");
  return data;
}

// ─── Anthropic API (direkt vom Browser) ──────────────────────────────────────

async function claudeMessage(prompt, maxTokens = 1000) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
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
  if (!res.ok) throw new Error(data.error?.message || "Anthropic API Fehler");
  return data.content?.[0]?.text || "";
}

function parseJSON(text) {
  const clean = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(clean);
}

// ─── Character API ────────────────────────────────────────────────────────────

export const charactersApi = {
  /** Alle Charaktere laden */
  getAll: () => request("/api/characters"),

  /** Einen Charakter anlegen */
  create: (data) =>
    request("/api/characters", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /** Charakter aktualisieren (z.B. Lock-Status) */
  update: (id, data) =>
    request(`/api/characters/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  /** Charakter löschen */
  delete: (id) => request(`/api/characters/${id}`, { method: "DELETE" }),

  /** KI-Analyse eines Charakters (Anthropic API direkt) */
  analyze: async (name, description) => {
    const prompt = `Analyze this character for AI video generation consistency.
Character: ${name}
Description: ${description}
Respond ONLY with valid JSON (no markdown, no preamble):
{"coloring":"...","eyes":"...","clothing":"...","accessories":"...","build":"...","style":"...","traits":["trait1","trait2","trait3"],"consistencyNote":"One sentence for consistent video generation"}`;

    const text = await claudeMessage(prompt);
    return parseJSON(text);
  },
};

// ─── Video API ────────────────────────────────────────────────────────────────

export const videosApi = {
  /** Alle Videos laden */
  getAll: () => request("/api/videos"),

  /** Video erstellen / generieren */
  create: (params) =>
    request("/api/videos", {
      method: "POST",
      body: JSON.stringify(params),
    }),

  /** Video-Status abfragen */
  getStatus: (id) => request(`/api/videos/${id}/status`),

  /** Video löschen */
  delete: (id) => request(`/api/videos/${id}`, { method: "DELETE" }),

  /** Prompt automatisch aufbauen */
  buildPrompt: (character, scene, camera, style, duration, ratio) => {
    const base = `[Character Consistency: ${character.name} — ${character.description}. `
      + `Coloring: ${character.coloring}. Eyes: ${character.eyes}. `
      + `Clothing: ${character.clothing}, ${character.accessories}. `
      + `Build: ${character.build}. Style: ${character.style}.]`;
    const sceneText = ` Scene: ${scene}`;
    const cameraText = camera ? ` Camera: ${camera}.` : "";
    return `${base}${sceneText}${cameraText} Visual style: ${style}. Duration: ${duration}s. Ratio: ${ratio}.`;
  },
};

// ─── Story API ────────────────────────────────────────────────────────────────

export const storyApi = {
  /** Story-Szenen via KI generieren */
  generate: async (character, idea) => {
    const prompt = `You are an AI video story writer for animated short-form content.
Character: ${character.name}
Description: ${character.description}
Story idea: "${idea}"

${character.name} must appear identically in ALL 5 scenes.

Respond ONLY with a raw JSON array (no markdown, no preamble):
[{"scene":1,"title":"Short title","description":"2-3 vivid visual sentences","camera":"Camera instruction","mood":"One word","duration":"5s"}]`;

    const text = await claudeMessage(prompt, 1200);
    return parseJSON(text);
  },

  /** Story im Backend speichern */
  save: (story) =>
    request("/api/story", {
      method: "POST",
      body: JSON.stringify(story),
    }),

  /** Alle gespeicherten Stories laden */
  getAll: () => request("/api/story"),
};

// ─── Export API ───────────────────────────────────────────────────────────────

export const exportApi = {
  exportVideo: (videoId, format) =>
    request(`/api/videos/${videoId}/export`, {
      method: "POST",
      body: JSON.stringify({ format }),
    }),
};
