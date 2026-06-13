// ─── types/index.ts ───────────────────────────────────────────────────────────
// Alle TypeScript-Typen und Interfaces für das gesamte Projekt.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Charakter ───────────────────────────────────────────────────────────────

export interface Character {
  id: number;
  name: string;
  description: string;
  locked: boolean;
  color: string;

  // Visuelle Merkmale
  coloring: string;
  eyes: string;
  clothing: string;
  accessories: string;
  build: string;

  // Stil & Persönlichkeit
  style: string;
  traits: string[];
  consistencyNote?: string;

  // Statistiken
  videos: number;
  series: number;

  // Zeitstempel
  createdAt?: string;
  updatedAt?: string;
}

export interface CharacterAnalysis {
  coloring: string;
  eyes: string;
  clothing: string;
  accessories: string;
  build: string;
  style: string;
  traits: string[];
  consistencyNote: string;
}

// ─── Video ────────────────────────────────────────────────────────────────────

export type VideoStatus = "done" | "processing" | "queued" | "error";

export type AspectRatio = "9:16" | "16:9" | "1:1" | "4:5";

export type AIModel = "kling" | "runway" | "luma";

export type VideoStyle =
  | "studio-ghibli"
  | "pixar"
  | "anime"
  | "2d-cartoon"
  | "watercolor"
  | "realistic";

export interface Video {
  id: number;
  charId: number;
  char: string;
  charColor: string;
  scene: string;
  dur: string;
  ratio: AspectRatio;
  status: VideoStatus;
  model: string;
  ts: string;
  prompt?: string;
  url?: string;
}

export interface VideoCreateParams {
  charId: number;
  scene: string;
  camera?: string;
  style: VideoStyle;
  duration: string;
  ratio: AspectRatio;
  model: AIModel;
}

// ─── Story ────────────────────────────────────────────────────────────────────

export interface StoryScene {
  scene: number;
  title: string;
  description: string;
  camera: string;
  mood: string;
  duration: string;
}

export interface Story {
  id?: number;
  idea: string;
  charId: number;
  charName: string;
  scenes: StoryScene[];
  createdAt?: string;
}

// ─── Einstellungen ────────────────────────────────────────────────────────────

export interface ApiKeys {
  kling: string;
  runway: string;
  luma: string;
  openai: string;
}

export interface Settings {
  apiKeys: ApiKeys;
  defaultModel: AIModel;
  defaultRatio: AspectRatio;
  autoEmbedProfile: boolean;
  warnWithoutLock: boolean;
  includeStyleClause: boolean;
  autoLockAfterFirst: boolean;
  showPromptPreview: boolean;
  autoSubtitles: boolean;
  watermark: boolean;
  savePromptsOnExport: boolean;
}

// ─── API-Antworten ────────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── Navigation ───────────────────────────────────────────────────────────────

export type PageId =
  | "dashboard"
  | "characters"
  | "video"
  | "story"
  | "history"
  | "settings";

export interface NavItem {
  id: PageId;
  label: string;
  icon: string;
  badge?: string;
}
