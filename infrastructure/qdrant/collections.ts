// ============================================================
//  infrastructure/qdrant/collections.ts
//  Definiert & initialisiert alle Qdrant Vektor-Collections
//  Wird beim Start des Backends oder manuell ausgeführt:
//    npx ts-node infrastructure/qdrant/collections.ts
// ============================================================

import { QdrantClient } from '@qdrant/js-client-rest'

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333'
const QDRANT_API_KEY = process.env.QDRANT_API_KEY

const client = new QdrantClient({ url: QDRANT_URL, apiKey: QDRANT_API_KEY })

// ── Collection-Definitionen ──────────────────────────────────
// Diese Namen müssen exakt mit den Python-Pipelines übereinstimmen
// (siehe apps/ai-worker/pipelines/character_dna.py)

export const COLLECTIONS = [
  {
    name: 'character_face_embeddings',
    size: 512,               // InsightFace / ArcFace
    distance: 'Cosine' as const,
    description: 'Gesichts-Embeddings für Identitätserkennung',
  },
  {
    name: 'character_style_embeddings',
    size: 768,                // CLIP ViT-L-14
    distance: 'Cosine' as const,
    description: 'Style/Bildähnlichkeits-Embeddings',
  },
  {
    name: 'character_body_embeddings',
    size: 1024,                // DINOv2 ViT-L-14
    distance: 'Cosine' as const,
    description: 'Körper- & Proportions-Embeddings',
  },
  {
    name: 'speaker_embeddings',
    size: 512,                // XTTS-v2 Speaker Latents (gekürzt)
    distance: 'Cosine' as const,
    description: 'Stimm-Embeddings für Voice Cloning',
  },
  {
    name: 'character_identity_tokens',
    size: 1280,                // PuLID / InstantID Identity Tokens
    distance: 'Cosine' as const,
    description: 'High-Fidelity Identity Tokens (PuLID/InstantID)',
  },
] as const

// ── Setup-Funktion ────────────────────────────────────────────

export async function ensureCollections() {
  const existing = await client.getCollections()
  const existingNames = new Set(existing.collections.map((c) => c.name))

  for (const col of COLLECTIONS) {
    if (existingNames.has(col.name)) {
      console.log(`✓ Collection existiert bereits: ${col.name}`)
      continue
    }

    await client.createCollection(col.name, {
      vectors: { size: col.size, distance: col.distance },
      optimizers_config: { default_segment_number: 2 },
      replication_factor: 1,
    })

    // Payload-Index für schnelle Filterung nach characterId
    await client.createPayloadIndex(col.name, {
      field_name: 'characterId',
      field_schema: 'keyword',
    })

    console.log(`✅ Collection erstellt: ${col.name} (${col.description})`)
  }
}

// ── Direkt ausführbar ─────────────────────────────────────────
if (require.main === module) {
  ensureCollections()
    .then(() => {
      console.log('🎉 Alle Qdrant Collections bereit')
      process.exit(0)
    })
    .catch((err) => {
      console.error('❌ Fehler beim Erstellen der Collections:', err)
      process.exit(1)
    })
}
