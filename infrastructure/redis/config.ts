// ============================================================
//  infrastructure/redis/config.ts
//  Zentrale Redis- & BullMQ-Konfiguration
// ============================================================

import { ConnectionOptions } from 'bullmq'

export function getRedisConnection(): ConnectionOptions {
  return {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: null,  // Erforderlich für BullMQ
  }
}

// ── Queue-Namen (zentral, damit Backend & Worker konsistent sind) ──
export const QUEUES = {
  RENDER: 'render',
  STORY_GENERATION: 'story-generation',
  CHARACTER_ANALYSIS: 'character-analysis',
  VOICE_SYNTHESIS: 'voice-synthesis',
  EXPORT: 'export',
} as const

// ── Standard Job-Optionen pro Queue ──────────────────────────
export const QUEUE_DEFAULTS = {
  [QUEUES.RENDER]: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  [QUEUES.STORY_GENERATION]: {
    attempts: 2,
    backoff: { type: 'fixed' as const, delay: 3000 },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
  [QUEUES.CHARACTER_ANALYSIS]: {
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
    removeOnComplete: 100,
    removeOnFail: 50,
  },
  [QUEUES.VOICE_SYNTHESIS]: {
    attempts: 2,
    backoff: { type: 'fixed' as const, delay: 2000 },
    removeOnComplete: 50,
    removeOnFail: 25,
  },
  [QUEUES.EXPORT]: {
    attempts: 2,
    backoff: { type: 'fixed' as const, delay: 1000 },
    removeOnComplete: 200,
    removeOnFail: 50,
  },
}

// ── Cache-Key-Patterns (für direktes Redis-Caching außerhalb von Queues) ──
export const CACHE_KEYS = {
  characterProfile: (id: string) => `cache:character:${id}:profile`,
  userSession: (userId: string) => `cache:session:${userId}`,
  renderJobProgress: (jobId: string) => `cache:job:${jobId}:progress`,
  modelStatus: () => `cache:ai-worker:models`,
}

export const CACHE_TTL = {
  characterProfile: 60 * 10,      // 10 Minuten
  userSession: 60 * 60 * 24 * 7,  // 7 Tage
  renderJobProgress: 60 * 60,     // 1 Stunde
  modelStatus: 30,                 // 30 Sekunden
}
