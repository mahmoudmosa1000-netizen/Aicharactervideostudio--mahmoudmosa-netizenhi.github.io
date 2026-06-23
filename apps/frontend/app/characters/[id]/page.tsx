// ============================================================
//  apps/frontend/app/characters/[id]/page.tsx
//  Character-Detail — DNA-Profil, Character Lock Engine,
//  Embeddings-Übersicht, Lock-Vorschau testen
// ============================================================

'use client'

import { useState } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { charactersApi } from '@/lib/api-client'
import { toast } from '@/components/ui/Toast'
import { Lock, Unlock, Sparkles, Loader2, ImageIcon } from 'lucide-react'

export default function CharacterDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [previewPrompt, setPreviewPrompt] = useState('')
  const [previewResult, setPreviewResult] = useState<{ imagePath: string; methodUsed: string; identityScore: number } | null>(null)

  const { data: character, isLoading } = useQuery({
    queryKey: ['character', id],
    queryFn: () => charactersApi.get(id).then((r) => r.data),
  })

  const { data: embeddings } = useQuery({
    queryKey: ['character', id, 'embeddings'],
    queryFn: () => charactersApi.getEmbeddings(id).then((r) => r.data),
    enabled: !!character,
  })

  const toggleLock = useMutation({
    mutationFn: () => charactersApi.toggleLock(id),
    onSuccess: (res) => {
      toast.success(res.data.message)
      queryClient.invalidateQueries({ queryKey: ['character', id] })
    },
  })

  const lockPreview = useMutation({
    mutationFn: () => charactersApi.lockPreview(id, previewPrompt),
    onSuccess: (res) => {
      setPreviewResult(res.data)
      toast.success(`🔒 Vorschau erstellt mit ${res.data.methodUsed}`)
    },
    onError: () => toast.error('Vorschau fehlgeschlagen — läuft der AI Worker?'),
  })

  if (isLoading) {
    return (
      <>
        <TopBar title="Lädt..." />
        <div className="p-6 max-w-4xl animate-pulse space-y-4">
          <div className="h-32 bg-surface rounded-lg" />
          <div className="h-48 bg-surface rounded-lg" />
        </div>
      </>
    )
  }

  if (!character) return null

  return (
    <>
      <TopBar title={character.name} />

      <div className="p-6 max-w-4xl space-y-6">
        {/* ── Header-Karte ───────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-lg p-5 flex items-start gap-5">
          <div className="w-20 h-20 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0 overflow-hidden">
            {character.referenceImages?.[0] ? (
              <img
                src={`${process.env.NEXT_PUBLIC_API_URL}/media/uploads/${character.referenceImages[0].split('/').pop()}`}
                className="w-full h-full object-cover"
                alt={character.name}
              />
            ) : (
              <span className="font-display text-2xl text-text-faint">{character.name.charAt(0)}</span>
            )}
          </div>

          <div className="flex-1">
            <h2 className="font-display text-xl font-semibold text-text mb-1">{character.name}</h2>
            <p className="text-[13px] text-text-muted mb-3">{character.description || 'Keine Beschreibung'}</p>
            <div className="flex gap-2 text-[11px] text-text-faint font-mono">
              {character.species && <span className="px-2 py-0.5 bg-surface-2 rounded-full">{character.species}</span>}
              {character.gender && <span className="px-2 py-0.5 bg-surface-2 rounded-full">{character.gender}</span>}
              {character.style && <span className="px-2 py-0.5 bg-surface-2 rounded-full">{character.style}</span>}
            </div>
          </div>

          {/* ── Character Lock Toggle — höchste Priorität ────── */}
          <button
            onClick={() => toggleLock.mutate()}
            disabled={toggleLock.isPending}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-[13px] font-medium transition-colors flex-shrink-0 ${
              character.isLocked
                ? 'bg-accent text-bg hover:bg-accent-strong'
                : 'bg-surface-2 text-text-muted border border-border hover:border-border-strong'
            }`}
          >
            {character.isLocked ? <Lock size={15} /> : <Unlock size={15} />}
            {character.isLocked ? 'Gesperrt' : 'Entsperrt'}
          </button>
        </div>

        {character.isLocked && (
          <div className="bg-accent-soft border border-accent/20 rounded-md px-4 py-2.5 text-[12px] text-accent">
            🔒 Character Lock aktiv — alle Generierungen erzwingen identisches Gesicht, Farben, Kleidung und Proportionen über die Lock Engine (Auto-Wahl: PuLID, InstantID, IP-Adapter).
          </div>
        )}

        {/* ── DNA-Profil ─────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-4">
            Character DNA Profile
          </h3>

          {character.profile ? (
            <div className="grid grid-cols-2 gap-4">
              <ProfileField label="Hautfarbe" value={character.profile.skinColor} />
              <ProfileField label="Fellfarbe" value={character.profile.furColor} />
              <ProfileField label="Haarfarbe" value={character.profile.hairColor} />
              <ProfileField label="Augenfarbe" value={character.profile.eyeColor} />
              <ProfileField label="Körperform" value={character.profile.bodyType} />
              <ProfileField label="Kleidungsstil" value={character.profile.clothingStyle} />
              <ProfileField
                label="Accessoires"
                value={character.profile.accessories?.join(', ')}
              />
              <ProfileField
                label="Persönlichkeit"
                value={character.profile.personality?.join(', ')}
              />
              <div className="col-span-2">
                <ProfileField
                  label="IP-Adapter-Gewicht (Konsistenz-Stärke)"
                  value={`${character.profile.ipAdapterWeight}`}
                  mono
                />
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-text-faint">Noch kein DNA-Profil — Analyse läuft oder fehlgeschlagen.</p>
          )}
        </div>

        {/* ── Embeddings ─────────────────────────────────────── */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-4">
            Embeddings (Qdrant Vektor-Datenbank)
          </h3>
          {embeddings && embeddings.length > 0 ? (
            <div className="space-y-2">
              {embeddings.map((emb: any) => (
                <div key={emb.id} className="flex items-center justify-between px-3 py-2 bg-surface-2 rounded-md">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-live-soft text-live">
                      {emb.type}
                    </span>
                    <span className="text-[12px] text-text-muted">{emb.modelUsed}</span>
                  </div>
                  <span className="text-[11px] font-mono text-text-faint">
                    {emb.dimensions}d · Score {emb.score?.toFixed(2) ?? '—'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-text-faint">Keine Embeddings vorhanden.</p>
          )}
        </div>

        {/* ── Lock Engine Vorschau testen ────────────────────── */}
        <div className="bg-surface border border-border rounded-lg p-5">
          <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-4 flex items-center gap-2">
            <Sparkles size={13} /> Character Lock Vorschau testen
          </h3>
          <div className="flex gap-2 mb-4">
            <input
              value={previewPrompt}
              onChange={(e) => setPreviewPrompt(e.target.value)}
              placeholder={`${character.name} sitzt in einem sonnigen Garten...`}
              className="flex-1 px-3 py-2 rounded-md bg-surface-2 border border-border text-[13px] text-text placeholder:text-text-faint focus:border-accent/50 outline-none"
            />
            <button
              onClick={() => lockPreview.mutate()}
              disabled={!previewPrompt || lockPreview.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-bg text-[13px] font-medium hover:bg-accent-strong disabled:opacity-40 transition-colors"
            >
              {lockPreview.isPending ? <Loader2 size={14} className="animate-spin" /> : <ImageIcon size={14} />}
              Generieren
            </button>
          </div>

          {previewResult && (
            <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 rounded-md text-[12px]">
              <span className="text-text-muted">Methode:</span>
              <span className="font-mono text-live">{previewResult.methodUsed}</span>
              <span className="text-text-muted ml-2">Identity Score:</span>
              <span className="font-mono text-success">{previewResult.identityScore}</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function ProfileField({ label, value, mono }: { label: string; value?: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] text-text-faint uppercase tracking-wide mb-0.5">{label}</div>
      <div className={`text-[13px] text-text ${mono ? 'font-mono' : ''}`}>{value || '—'}</div>
    </div>
  )
}
