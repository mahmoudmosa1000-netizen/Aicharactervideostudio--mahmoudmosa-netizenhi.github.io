// ============================================================
//  apps/frontend/lib/api-client.ts
//  Zentraler, typisierter HTTP-Client für das NestJS Backend
// ============================================================

import axios, { AxiosInstance } from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

export const api: AxiosInstance = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

// JWT automatisch an jede Anfrage anhängen
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Bei 401 → Token löschen und zur Login-Seite
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  },
)

// ── Typen ────────────────────────────────────────────────────

export interface Character {
  id: string
  name: string
  description?: string
  species?: string
  gender?: string
  age?: number
  style?: string
  isLocked: boolean
  thumbnailUrl?: string
  referenceImages: string[]
  tags: string[]
  profile?: CharacterProfile
  createdAt: string
  updatedAt: string
}

export interface CharacterProfile {
  skinColor?: string
  hairColor?: string
  eyeColor?: string
  furColor?: string
  bodyType?: string
  distinctiveFeatures: string[]
  accessories: string[]
  clothingStyle?: string
  personality: string[]
  backstory?: string
  catchPhrase?: string
  ipAdapterWeight: number
}

export interface Story {
  id: string
  title: string
  logline?: string
  genre?: string
  status: 'DRAFT' | 'GENERATING' | 'READY' | 'IN_PRODUCTION' | 'COMPLETED' | 'ARCHIVED'
  targetLength: number
  scenes?: Scene[]
  _count?: { scenes: number; videos: number }
  createdAt: string
  updatedAt: string
}

export interface Scene {
  id: string
  order: number
  title: string
  description?: string
  dialogue?: string
  voiceOverText?: string
  characterPrompt?: string
  scenePrompt?: string
  cameraPrompt?: string
  motionPrompt?: string
  environmentPrompt?: string
  lightingPrompt?: string
  duration: number
  cameraType?: string
  status: 'PENDING' | 'READY' | 'RENDERING' | 'COMPLETED' | 'FAILED'
}

export interface Video {
  id: string
  title: string
  status: 'PENDING' | 'QUEUED' | 'RENDERING' | 'POST_PROCESSING' | 'COMPLETED' | 'FAILED' | 'ARCHIVED'
  resolution: string
  fps: number
  duration?: number
  fileFormat: string
  filePath?: string
  thumbnailUrl?: string
  exportedTo: string[]
  createdAt: string
}

export interface RenderJob {
  id: string
  jobId: string
  status: string
  progress: number
  currentStep?: string
  video?: Video
}

// ── Auth ─────────────────────────────────────────────────────

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (email: string, password: string, name: string) =>
    api.post('/auth/register', { email, password, name }),
  me: () => api.get('/auth/me'),
}

// ── Characters ───────────────────────────────────────────────

export const charactersApi = {
  list: () => api.get<Character[]>('/characters'),
  get: (id: string) => api.get<Character>(`/characters/${id}`),
  create: (data: Partial<Character>) => api.post<Character>('/characters', data),
  upload: (formData: FormData) =>
    api.post<Character>('/characters/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  update: (id: string, data: Partial<Character>) => api.put<Character>(`/characters/${id}`, data),
  toggleLock: (id: string) => api.patch(`/characters/${id}/lock`),
  remove: (id: string) => api.delete(`/characters/${id}`),
  getEmbeddings: (id: string) => api.get(`/characters/${id}/embeddings`),
  lockPreview: (id: string, prompt: string) =>
    api.post(`/characters/${id}/lock-preview`, { prompt }),
}

// ── Stories ──────────────────────────────────────────────────

export const storiesApi = {
  list: () => api.get<Story[]>('/stories'),
  get: (id: string) => api.get<Story>(`/stories/${id}`),
  generate: (data: {
    idea: string
    title?: string
    genre?: string
    characterIds?: string[]
    sceneCount?: 5 | 10 | 20
  }) => api.post<Story>('/stories/generate', data),
  getScenes: (id: string) => api.get<Scene[]>(`/stories/${id}/scenes`),
  updateScene: (storyId: string, sceneId: string, data: Partial<Scene>) =>
    api.put(`/stories/${storyId}/scenes/${sceneId}`, data),
  remove: (id: string) => api.delete(`/stories/${id}`),
}

// ── Render ───────────────────────────────────────────────────

export const renderApi = {
  start: (data: { sceneId?: string; storyId?: string; characterId?: string; resolution?: string }) =>
    api.post('/render/start', data),
  status: (jobId: string) => api.get<RenderJob>(`/render/status/${jobId}`),
  queue: () => api.get<RenderJob[]>('/render/queue'),
  cancel: (jobId: string) => api.post(`/render/cancel/${jobId}`),
  startStory: (storyId: string, data: { resolution?: string; fps?: number; format?: string }) =>
    api.post(`/render/story/${storyId}/start`, data),
  storyProgress: (storyId: string) => api.get(`/render/story/${storyId}/progress`),
}

// ── Videos ───────────────────────────────────────────────────

export const videosApi = {
  history: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<{ data: Video[]; meta: any }>('/videos/history', { params }),
  get: (id: string) => api.get<Video>(`/videos/${id}`),
  versions: (id: string) => api.get(`/videos/${id}/versions`),
  remove: (id: string) => api.delete(`/videos/${id}`),
}

// ── Voice ────────────────────────────────────────────────────

export const voiceApi = {
  profiles: () => api.get('/voice/profiles'),
  clone: (formData: FormData) =>
    api.post('/voice/clone', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  synthesize: (data: { text: string; voiceProfileId: string; emotion?: string }) =>
    api.post('/voice/synthesize', data),
}

// ── Export ───────────────────────────────────────────────────

export const exportApi = {
  presets: () => api.get('/export/presets'),
  export: (videoId: string, preset: string) => api.post(`/export/${videoId}`, { preset }),
}
