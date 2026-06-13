// ─── frontend/src/lib/api.js ─────────────────────────────────────────────────
// Centralized API client for all backend and AI calls.
// ─────────────────────────────────────────────────────────────────────────────

const BACKEND_URL  = process.env.REACT_APP_BACKEND_URL  || "http://localhost:5000";
const ANTHROPIC_KEY = process.env.REACT_APP_ANTHROPIC_API_KEY || "";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function request(path, options = {}) {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

/** Smart JSON extractor — handles models that wrap JSON in text or markdown */
function extractJSON(text) {
  if (!text) throw new Error("Empty response from AI model");
  try { return JSON.parse(text.trim()); } catch {}
  const clean = text.replace(/```json\n?|```\n?/g, "").trim();
  try { return JSON.parse(clean); } catch {}
  const obj = text.match(/\{[\s\S]*\}/);
  if (obj) { try { return JSON.parse(obj[0]); } catch {} }
  const arr = text.match(/\[[\s\S]*\]/);
  if (arr) { try { return JSON.parse(arr[0]); } catch {} }
  throw new Error("Could not parse JSON from AI response. Try model: llama3.2 or mistral");
}

// ─── Anthropic Cloud API ──────────────────────────────────────────────────────

async function claudeMessage(prompt, maxTokens = 1000) {
  const key = ANTHROPIC_KEY || localStorage.getItem("anthropic_key") || "";
  if (!key) throw new Error("No Anthropic API key — add it in Settings.");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error?.message || "Anthropic API error");
  return data.content?.[0]?.text || "";
}

// ─── Ollama Local API ─────────────────────────────────────────────────────────

async function callOllama(prompt) {
  const ollamaUrl = localStorage.getItem("ollama_url") || "http://localhost:11434";
  const ollamaModel = localStorage.getItem("ollama_model") || "llama3.2";

  if (location.protocol === "https:") {
    throw new Error(
      "HTTPS blocks localhost connections. Download index.html and run:\n" +
      "python -m http.server 8080\n" +
      "Then open http://localhost:8080"
    );
  }

  // Try Chat API first (works with all models)
  try {
    const r = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: ollamaModel,
        messages: [{ role: "user", content: prompt }],
        stream: false,
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const d = await r.json();
    return d.message?.content || "";
  } catch {
    // Fallback: generate API
    const r = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: ollamaModel, prompt, stream: false }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok) {
      throw new Error(
        `Ollama not reachable at ${ollamaUrl}.\n` +
        `Start it with: OLLAMA_ORIGINS=* ollama serve`
      );
    }
    const d = await r.json();
    return d.response || "";
  }
}

export async function testOllamaConnection() {
  const ollamaUrl = localStorage.getItem("ollama_url") || "http://localhost:11434";
  if (location.protocol === "https:") return { ok: false, error: "https_blocked" };
  try {
    const r = await fetch(`${ollamaUrl}/api/tags`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const d = await r.json();
    return { ok: true, models: (d.models || []).map((m) => m.name) };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

export async function testComfyUIConnection(port = "8188") {
  if (location.protocol === "https:") return { ok: false, error: "https_blocked" };
  try {
    const r = await fetch(`http://localhost:${port}/system_stats`, { signal: AbortSignal.timeout(4000) });
    if (!r.ok) return { ok: false, error: `HTTP ${r.status}` };
    const d = await r.json();
    return { ok: true, gpu: d.system?.gpus?.[0]?.name || "GPU detected" };
  } catch {
    return { ok: false, error: "unreachable" };
  }
}

// ─── AI Mode Dispatcher ───────────────────────────────────────────────────────

async function callAI(prompt, maxTokens = 1000) {
  const mode = localStorage.getItem("ai_mode") || "demo";
  if (mode === "local") return callOllama(prompt);
  return claudeMessage(prompt, maxTokens);
}

function parseResponse(text, isLocal = false) {
  return isLocal ? extractJSON(text) : extractJSON(text);
}

// ─── Characters API ───────────────────────────────────────────────────────────

export const charactersApi = {
  getAll:   ()     => request("/api/characters"),
  create:   (data) => request("/api/characters", { method: "POST", body: JSON.stringify(data) }),
  update:   (id, data) => request(`/api/characters/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  delete:   (id)   => request(`/api/characters/${id}`, { method: "DELETE" }),

  analyze: async (name, description) => {
    const mode = localStorage.getItem("ai_mode") || "demo";
    if (mode === "demo") {
      // Return realistic demo analysis
      return {
        coloring: "Rich fur with distinctive color pattern",
        eyes: "Expressive, characteristic eyes",
        clothing: "Distinctive outfit matching description",
        accessories: "Key accessories as described",
        build: "Characteristic body proportions",
        style: "Animated illustration style",
        traits: ["Curious", "Warm", "Creative"],
        consistencyNote: `Always show ${name} with consistent visual traits in warm, well-lit scenes`,
      };
    }
    const prompt = `Analyze this character for AI video generation consistency.
Character: ${name}
Description: ${description}
Respond ONLY with valid JSON (no markdown):
{"coloring":"...","eyes":"...","clothing":"...","accessories":"...","build":"...","style":"...","traits":["t1","t2","t3"],"consistencyNote":"..."}`;
    const text = await callAI(prompt);
    return extractJSON(text);
  },
};

// ─── Videos API ───────────────────────────────────────────────────────────────

const MODEL_ESTIMATED_SECS = {
  "Kling AI": 180, "Runway Gen-3": 150, "Luma Dream": 240,
  "AnimateDiff": 480, "Stable Video Diffusion": 600,
  "CogVideoX (5B)": 900, "LTX-Video": 300, "Wan2.1": 1200,
};

const SAMPLE_VIDEOS = [
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4",
];

export const videosApi = {
  getAll:    ()     => request("/api/videos"),
  create:    (params) => request("/api/videos", { method: "POST", body: JSON.stringify(params) }),
  getStatus: (id)   => request(`/api/videos/${id}/status`),
  delete:    (id)   => request(`/api/videos/${id}`, { method: "DELETE" }),

  buildPrompt: (character, scene, camera, style, duration, ratio) => {
    return (
      `[Character Consistency: ${character.name} — ${character.description}. ` +
      `Coloring: ${character.coloring}. Eyes: ${character.eyes}. ` +
      `Clothing: ${character.clothing}, ${character.accessories}. ` +
      `Build: ${character.build}. Style: ${character.style}.] ` +
      `Scene: ${scene}` +
      (camera ? ` Camera: ${camera}.` : "") +
      ` Visual style: ${style}. Duration: ${duration}s. Ratio: ${ratio}.`
    );
  },

  getEstimatedSecs: (modelName) => MODEL_ESTIMATED_SECS[modelName] || 180,
  getRandomSampleUrl: () => SAMPLE_VIDEOS[Math.floor(Math.random() * SAMPLE_VIDEOS.length)],
};

// ─── Story API ────────────────────────────────────────────────────────────────

const DEMO_STORIES = [
  [
    { title: "The First Morning", description: "The character wakes early, full of excitement. The kitchen smells of fresh dough as they tie their apron and prepare the first ingredients.", camera: "Wide shot, warm morning sunlight", mood: "Hopeful", duration: "5s" },
    { title: "The First Challenge", description: "The first attempt goes wrong. They frown in concentration but refuse to give up, studying the recipe carefully.", camera: "Medium close-up, soft light", mood: "Determined", duration: "5s" },
    { title: "An Unexpected Helper", description: "A neighbor arrives with a family recipe. The character listens attentively, eyes glowing with gratitude and curiosity.", camera: "Over-shoulder shot, warm candlelight", mood: "Grateful", duration: "5s" },
    { title: "The Breakthrough", description: "The oven opens to reveal perfect golden results. The character beams with joy, arms raised in triumph.", camera: "Low angle, steam rising, amber light", mood: "Triumphant", duration: "5s" },
    { title: "Celebrating Together", description: "The whole neighborhood gathers around the table. The character shares their creation and smiles warmly at everyone.", camera: "Wide pull-back, golden hour", mood: "Joyful", duration: "6s" },
  ],
  [
    { title: "Setting Out", description: "At the harbor with a small pack, the character gazes at the open sea. The wind sweeps back as the horizon calls.", camera: "Wide establishing shot, dramatic sky", mood: "Adventurous", duration: "5s" },
    { title: "Storm at Sea", description: "Dark clouds roll in. The character grips the helm and navigates crashing waves with calm, steady eyes.", camera: "Dynamic tracking shot", mood: "Tense", duration: "5s" },
    { title: "The Mysterious Island", description: "Fog lifts to reveal a lush unknown island. They leap ashore, eyes wide with wonder.", camera: "Slow push-in, morning mist", mood: "Awed", duration: "6s" },
    { title: "The Hidden Treasure", description: "Digging under an ancient tree, they strike a rusted chest that glows with golden light.", camera: "Close-up reveal shot", mood: "Excited", duration: "5s" },
    { title: "Return as Hero", description: "They return with the treasure to cheering friends in the warm evening light.", camera: "Wide pull-back, golden sunset", mood: "Triumphant", duration: "6s" },
  ],
];

export const storyApi = {
  generate: async (character, idea) => {
    const mode = localStorage.getItem("ai_mode") || "demo";
    if (mode === "demo") {
      const kw = idea.toLowerCase();
      const idx = kw.includes("bak") || kw.includes("cook") ? 0
        : kw.includes("sea") || kw.includes("adventure") ? 1
        : Math.floor(Math.random() * DEMO_STORIES.length);
      return DEMO_STORIES[idx].map((s, i) => ({ scene: i + 1, ...s }));
    }
    const prompt = `You are an AI video story writer for animated short-form content.
Character: ${character.name} — ${character.description}
Story idea: "${idea}"
${character.name} must appear identically in ALL 5 scenes.
Respond ONLY with a raw JSON array (no markdown):
[{"scene":1,"title":"...","description":"2-3 vivid sentences","camera":"...","mood":"...","duration":"5s"}]`;
    const text = await callAI(prompt, 1400);
    return extractJSON(text);
  },

  save: (story) => request("/api/story", { method: "POST", body: JSON.stringify(story) }),
  getAll: () => request("/api/story"),
};

// ─── Export API ───────────────────────────────────────────────────────────────

export const exportApi = {
  downloadVideo: (videoUrl, filename) => {
    const a = document.createElement("a");
    a.href = videoUrl;
    a.download = filename || "video.mp4";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
};
