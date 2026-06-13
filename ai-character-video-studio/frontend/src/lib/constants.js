// ─── lib/constants.js ────────────────────────────────────────────────────────
// Zentrale Konstanten: Farben, Mock-Daten, Navigation.
// Diese Werte spiegeln die CSS-Variablen in variables.css wider.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Farb-Tokens (identisch mit CSS-Variablen) ───────────────────────────────
export const COLORS = {
  bg0: "var(--bg-0)",
  bg1: "var(--bg-1)",
  bg2: "var(--bg-2)",
  bg3: "var(--bg-3)",
  bg4: "var(--bg-4)",
  gold:       "var(--gold)",
  goldBg:     "var(--gold-bg)",
  goldBorder: "var(--gold-border)",
  blue:       "var(--blue)",
  blueBg:     "var(--blue-bg)",
  green:      "var(--green)",
  greenBg:    "var(--green-bg)",
  purple:     "var(--purple)",
  purpleBg:   "var(--purple-bg)",
  red:        "var(--red)",
  redBg:      "var(--red-bg)",
  t1: "var(--text-1)",
  t2: "var(--text-2)",
  t3: "var(--text-3)",
};

// Farben für die 5 Szenen in der Story
export const SCENE_COLORS = [
  "#f59e0b", // Gold
  "#4f9cf9", // Blau
  "#a78bfa", // Lila
  "#22d3a5", // Grün
  "#fc8888", // Rot
];

// ─── Navigation ───────────────────────────────────────────────────────────────
export const NAV_ITEMS = [
  { id: "dashboard",   label: "Dashboard",      icon: "⬡" },
  { id: "characters",  label: "Characters",     icon: "◈" },
  { id: "video",       label: "Video Creator",  icon: "▶" },
  { id: "story",       label: "Story Creator",  icon: "◇", badge: "AI" },
  { id: "history",     label: "History",        icon: "⊟" },
  { id: "settings",    label: "Settings",       icon: "◎" },
];

// ─── Dropdown-Optionen ────────────────────────────────────────────────────────
export const STYLE_OPTIONS = [
  { value: "studio-ghibli", label: "Studio Ghibli" },
  { value: "pixar",         label: "Pixar 3D" },
  { value: "anime",         label: "Anime" },
  { value: "2d-cartoon",    label: "2D Cartoon" },
  { value: "watercolor",    label: "Watercolor" },
  { value: "realistic",     label: "Realistic" },
];

export const DURATION_OPTIONS = [
  { value: "3",  label: "3 Sekunden" },
  { value: "5",  label: "5 Sekunden" },
  { value: "8",  label: "8 Sekunden" },
  { value: "10", label: "10 Sekunden" },
  { value: "15", label: "15 Sekunden" },
];

export const RATIO_OPTIONS = [
  { value: "9:16", label: "9:16 — TikTok / Reels" },
  { value: "16:9", label: "16:9 — YouTube" },
  { value: "1:1",  label: "1:1 — Square" },
  { value: "4:5",  label: "4:5 — Instagram" },
];

export const MODEL_OPTIONS = [
  { value: "kling",  label: "Kling AI" },
  { value: "runway", label: "Runway Gen-3" },
  { value: "luma",   label: "Luma Dream" },
];

export const DEFAULT_MODEL_OPTIONS = [
  { value: "kling",  label: "Kling AI" },
  { value: "runway", label: "Runway Gen-3" },
  { value: "luma",   label: "Luma Dream" },
];

// ─── Mock-Daten (werden durch echte API-Daten ersetzt) ────────────────────────
export const MOCK_CHARACTERS = [
  {
    id: 1, name: "Mochi", locked: true, color: "#f59e0b",
    description: "Orange & white cat in traditional Japanese clothing with floral headscarf and gentle round eyes",
    traits: ["Curious", "Warm", "Creative"],
    style: "Studio Ghibli–inspired animation",
    coloring: "Orange & white fur", eyes: "Large, round, amber",
    clothing: "Yukata + floral headscarf", accessories: "Wicker basket, apron",
    build: "Small, soft proportions", videos: 14, series: 3,
  },
  {
    id: 2, name: "Captain Rex", locked: false, color: "#4f9cf9",
    description: "Navy blue penguin in a captain's coat with gold buttons, peaked cap and tiny brass telescope",
    traits: ["Adventurous", "Bold", "Loyal"],
    style: "2D cartoon, flat design",
    coloring: "Navy & white plumage", eyes: "Sharp, dark, determined",
    clothing: "Captain's coat + peaked cap", accessories: "Brass telescope, map scroll",
    build: "Stocky, upright posture", videos: 6, series: 1,
  },
];

export const MOCK_VIDEOS = [
  { id: 1, charId: 1, char: "Mochi",        charColor: "#f59e0b", scene: "Baking sourdough in a cozy cottage kitchen",        dur: "5s",  ratio: "9:16", status: "done",       model: "Kling",  ts: "2h ago" },
  { id: 2, charId: 1, char: "Mochi",        charColor: "#f59e0b", scene: "Opening a flower market at golden-hour sunrise",    dur: "8s",  ratio: "16:9", status: "done",       model: "Runway", ts: "3h ago" },
  { id: 3, charId: 2, char: "Captain Rex",  charColor: "#4f9cf9", scene: "Navigating a storm with compass in hand",           dur: "6s",  ratio: "1:1",  status: "processing", model: "Luma",   ts: "1h ago" },
  { id: 4, charId: 1, char: "Mochi",        charColor: "#f59e0b", scene: "Teaching pottery class to small forest creatures",  dur: "10s", ratio: "9:16", status: "done",       model: "Kling",  ts: "1d ago" },
  { id: 5, charId: 2, char: "Captain Rex",  charColor: "#4f9cf9", scene: "Discovering a treasure map on a remote island",    dur: "7s",  ratio: "16:9", status: "done",       model: "Runway", ts: "2d ago" },
  { id: 6, charId: 1, char: "Mochi",        charColor: "#f59e0b", scene: "Writing letters at a moonlit wooden desk",          dur: "5s",  ratio: "9:16", status: "queued",     model: "Kling",  ts: "30m ago" },
];
