// ============================================================
//  apps/frontend/app/characters/page.tsx
//  Character Manager — Bibliothek, Suche, Tags, Upload
// ============================================================

'use client'

import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { CharacterUploadModal } from '@/components/character/CharacterUploadModal'
import { charactersApi } from '@/lib/api-client'
import { Plus, Search, Lock, Sparkles } from 'lucide-react'

export default function CharactersPage() {
  const [uploadOpen, setUploadOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<string | null>(null)

  const { data: characters, isLoading } = useQuery({
    queryKey: ['characters'],
    queryFn: () => charactersApi.list().then((r) => r.data),
  })

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    characters?.forEach((c) => c.tags.forEach((t) => tags.add(t)))
    return Array.from(tags)
  }, [characters])

  const filtered = useMemo(() => {
    return (characters || []).filter((c) => {
      const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase())
      const matchesTag = !tagFilter || c.tags.includes(tagFilter)
      return matchesSearch && matchesTag
    })
  }, [characters, search, tagFilter])

  return (
    <>
      <TopBar title="Charakter-Bibliothek" />

      <div className="p-6 max-w-6xl">
        {/* ── Toolbar ────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Charakter suchen..."
              className="w-full pl-9 pr-3 py-2 rounded-md bg-surface border border-border text-[13px] text-text placeholder:text-text-faint focus:border-accent/50 outline-none"
            />
          </div>

          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5">
              {allTags.slice(0, 6).map((tag) => (
                <button
                  key={tag}
                  onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                  className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
                    tagFilter === tag
                      ? 'bg-accent-soft text-accent border-accent/30'
                      : 'bg-surface text-text-muted border-border hover:border-border-strong'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}

          <button
            onClick={() => setUploadOpen(true)}
            className="ml-auto flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent text-bg text-[13px] font-medium hover:bg-accent-strong transition-colors"
          >
            <Plus size={15} /> Neuer Charakter
          </button>
        </div>

        {/* ── Grid ───────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-44 rounded-lg bg-surface border border-border animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center">
            <Sparkles size={24} className="mx-auto text-text-faint mb-3" />
            <p className="text-[14px] font-medium text-text mb-1">
              {search || tagFilter ? 'Keine Treffer' : 'Noch keine Charaktere'}
            </p>
            <p className="text-[12px] text-text-muted mb-4">
              Lade Referenzbilder hoch — die KI erstellt automatisch ein Character-DNA-Profil.
            </p>
            <button
              onClick={() => setUploadOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent text-bg text-[12px] font-medium hover:bg-accent-strong transition-colors"
            >
              <Plus size={14} /> Ersten Charakter erstellen
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4">
            {filtered.map((char) => (
              <Link
                key={char.id}
                href={`/characters/${char.id}`}
                className="group rounded-lg border border-border bg-surface overflow-hidden hover:border-border-strong transition-colors"
              >
                <div className="aspect-square bg-surface-2 flex items-center justify-center relative">
                  {char.referenceImages?.[0] ? (
                    <img
                      src={`${process.env.NEXT_PUBLIC_API_URL}/media/uploads/${char.referenceImages[0].split('/').pop()}`}
                      alt={char.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="font-display text-3xl font-semibold text-text-faint">
                      {char.name.charAt(0)}
                    </span>
                  )}
                  {char.isLocked && (
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-accent/90 flex items-center justify-center">
                      <Lock size={11} className="text-bg" />
                    </div>
                  )}
                </div>
                <div className="p-3">
                  <div className="text-[13px] font-medium text-text truncate">{char.name}</div>
                  <div className="text-[11px] text-text-faint truncate mt-0.5">
                    {char.species || 'Charakter'} {char.age ? `· ${char.age} Jahre` : ''}
                  </div>
                  {char.tags.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {char.tags.slice(0, 2).map((tag) => (
                        <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-2 text-text-faint">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <CharacterUploadModal open={uploadOpen} onClose={() => setUploadOpen(false)} />
    </>
  )
}
