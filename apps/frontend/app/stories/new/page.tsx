// ============================================================
//  apps/frontend/app/stories/new/page.tsx
//  Story Creator — Idee eingeben, KI generiert Story + Szenen
// ============================================================

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useMutation } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { toast } from '@/components/ui/Toast'
import { storiesApi, charactersApi } from '@/lib/api-client'
import { Sparkles, Loader2, Check } from 'lucide-react'

const SCENE_COUNTS = [5, 10, 20] as const
const GENRES = ['Abenteuer', 'Komödie', 'Drama', 'Märchen', 'Sci-Fi', 'Slice of Life']

export default function StoryCreatorPage() {
  const router = useRouter()
  const [idea, setIdea] = useState('')
  const [genre, setGenre] = useState('Abenteuer')
  const [sceneCount, setSceneCount] = useState<5 | 10 | 20>(10)
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([])

  const { data: characters } = useQuery({
    queryKey: ['characters'],
    queryFn: () => charactersApi.list().then((r) => r.data),
  })

  const generate = useMutation({
    mutationFn: () =>
      storiesApi.generate({
        idea,
        genre,
        sceneCount,
        characterIds: selectedCharacters,
      }),
    onSuccess: (res) => {
      toast.success(`📖 "${res.data.title}" erstellt — ${sceneCount} Szenen`)
      router.push(`/stories/${res.data.id}`)
    },
    onError: () => toast.error('Story-Generierung fehlgeschlagen — läuft der AI Worker?'),
  })

  const toggleCharacter = (id: string) => {
    setSelectedCharacters((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
    )
  }

  return (
    <>
      <TopBar title="Story Creator" />

      <div className="p-6 max-w-2xl">
        <div className="mb-6">
          <h2 className="font-display text-lg font-semibold text-text mb-1">
            Eine Idee. Eine vollständige Story.
          </h2>
          <p className="text-[13px] text-text-muted">
            Beschreibe nur die Grundidee — die KI erstellt Outline, Kapitel, Szenen, Dialoge und Kameraanweisungen.
          </p>
        </div>

        <div className="space-y-5">
          {/* ── Idee ───────────────────────────────────────────── */}
          <div>
            <label className="text-[12px] font-medium text-text-muted block mb-1.5">Story-Idee *</label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="z.B. Eine orange-weiße Katze eröffnet eine Bäckerei"
              rows={3}
              className="w-full px-3.5 py-3 rounded-md bg-surface border border-border text-[14px] text-text placeholder:text-text-faint focus:border-accent/50 outline-none resize-none"
            />
          </div>

          {/* ── Genre ──────────────────────────────────────────── */}
          <div>
            <label className="text-[12px] font-medium text-text-muted block mb-1.5">Genre</label>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g}
                  onClick={() => setGenre(g)}
                  className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                    genre === g
                      ? 'bg-accent-soft text-accent border-accent/30'
                      : 'bg-surface text-text-muted border-border hover:border-border-strong'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* ── Szenenanzahl ───────────────────────────────────── */}
          <div>
            <label className="text-[12px] font-medium text-text-muted block mb-1.5">Anzahl Szenen</label>
            <div className="flex gap-2">
              {SCENE_COUNTS.map((count) => (
                <button
                  key={count}
                  onClick={() => setSceneCount(count)}
                  className={`flex-1 py-2.5 rounded-md text-[13px] font-medium border transition-colors ${
                    sceneCount === count
                      ? 'bg-accent-soft text-accent border-accent/30'
                      : 'bg-surface text-text-muted border-border hover:border-border-strong'
                  }`}
                >
                  {count} Szenen
                </button>
              ))}
            </div>
          </div>

          {/* ── Charakter-Auswahl ──────────────────────────────── */}
          <div>
            <label className="text-[12px] font-medium text-text-muted block mb-1.5">
              Charaktere (optional — werden in allen Szenen konsistent gehalten)
            </label>
            {characters && characters.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {characters.map((char) => {
                  const selected = selectedCharacters.includes(char.id)
                  return (
                    <button
                      key={char.id}
                      onClick={() => toggleCharacter(char.id)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-md border transition-colors ${
                        selected
                          ? 'bg-accent-soft border-accent/30'
                          : 'bg-surface border-border hover:border-border-strong'
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-accent flex items-center justify-center">
                          <Check size={10} className="text-bg" />
                        </span>
                      )}
                      <div className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-[12px] font-display font-semibold text-text-muted">
                        {char.name.charAt(0)}
                      </div>
                      <span className="text-[11px] text-text truncate w-full text-center">{char.name}</span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="text-[12px] text-text-faint">Noch keine Charaktere — Story wird ohne festen Charakter erstellt.</p>
            )}
          </div>

          <button
            onClick={() => generate.mutate()}
            disabled={!idea || generate.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-accent text-bg text-[14px] font-medium hover:bg-accent-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {generate.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Qwen3 generiert Story & Szenen...</>
            ) : (
              <><Sparkles size={16} /> Story generieren</>
            )}
          </button>
        </div>
      </div>
    </>
  )
}
