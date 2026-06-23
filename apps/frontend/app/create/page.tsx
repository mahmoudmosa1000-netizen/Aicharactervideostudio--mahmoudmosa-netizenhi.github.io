// ============================================================
//  apps/frontend/app/create/page.tsx
//  Video Creator — manuelle Einzelszene + Prompt Builder + Vorschau
// ============================================================

'use client'

import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { FilmstripProgress } from '@/components/ui/FilmstripProgress'
import { toast } from '@/components/ui/Toast'
import { charactersApi, renderApi } from '@/lib/api-client'
import { useRenderSocket } from '@/hooks/use-render-socket'
import { Clapperboard, Loader2, CheckCircle2 } from 'lucide-react'

const RESOLUTIONS = ['720p', '1080p', '2K', '4K'] as const
const FORMATS = ['mp4', 'mov', 'webm'] as const

export default function VideoCreatorPage() {
  const [characterId, setCharacterId] = useState<string>('')
  const [scenePrompt, setScenePrompt] = useState('')
  const [cameraPrompt, setCameraPrompt] = useState('slow cinematic dolly shot')
  const [lightingPrompt, setLightingPrompt] = useState('warm golden hour light')
  const [resolution, setResolution] = useState<typeof RESOLUTIONS[number]>('1080p')
  const [format, setFormat] = useState<typeof FORMATS[number]>('mp4')
  const [activeJobId, setActiveJobId] = useState<string | null>(null)

  const { data: characters } = useQuery({
    queryKey: ['characters'],
    queryFn: () => charactersApi.list().then((r) => r.data),
  })

  const { jobs, subscribe } = useRenderSocket()

  const startRender = useMutation({
    mutationFn: () =>
      renderApi.start({
        characterId: characterId || undefined,
        resolution,
      }),
    onSuccess: (res: any) => {
      toast.success('🎬 Render-Job gestartet')
      setActiveJobId(res.data.jobId)
      subscribe(res.data.jobId)
    },
    onError: () => toast.error('Render-Start fehlgeschlagen'),
  })

  const selectedCharacter = characters?.find((c) => c.id === characterId)
  const liveJob = activeJobId ? jobs[activeJobId] : null

  return (
    <>
      <TopBar title="Video Creator" />

      <div className="p-6 max-w-3xl space-y-6">
        {/* ── Charakter ──────────────────────────────────────── */}
        <div>
          <label className="text-[12px] font-medium text-text-muted block mb-1.5">Charakter (optional)</label>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setCharacterId('')}
              className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                !characterId ? 'bg-accent-soft text-accent border-accent/30' : 'bg-surface text-text-muted border-border'
              }`}
            >
              Kein Charakter
            </button>
            {characters?.map((c) => (
              <button
                key={c.id}
                onClick={() => setCharacterId(c.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                  characterId === c.id ? 'bg-accent-soft text-accent border-accent/30' : 'bg-surface text-text-muted border-border'
                }`}
              >
                {c.name}
                {c.isLocked && <span>🔒</span>}
              </button>
            ))}
          </div>
          {selectedCharacter?.isLocked && (
            <p className="text-[11px] text-accent mt-2">
              🔒 Character Lock aktiv — Konsistenz wird über die Lock Engine erzwungen.
            </p>
          )}
        </div>

        {/* ── Prompt Builder (manuell) ──────────────────────── */}
        <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
            Advanced Prompt Builder
          </h3>

          <div>
            <label className="text-[11px] text-text-faint block mb-1">Scene</label>
            <textarea
              value={scenePrompt}
              onChange={(e) => setScenePrompt(e.target.value)}
              placeholder="Village bakery at sunrise, warm atmosphere..."
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-[13px] text-text placeholder:text-text-faint focus:border-accent/50 outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] text-text-faint block mb-1">Camera</label>
              <input
                value={cameraPrompt}
                onChange={(e) => setCameraPrompt(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-[13px] text-text focus:border-accent/50 outline-none"
              />
            </div>
            <div>
              <label className="text-[11px] text-text-faint block mb-1">Lighting</label>
              <input
                value={lightingPrompt}
                onChange={(e) => setLightingPrompt(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-[13px] text-text focus:border-accent/50 outline-none"
              />
            </div>
          </div>
        </div>

        {/* ── Render-Parameter ───────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[12px] font-medium text-text-muted block mb-1.5">Auflösung</label>
            <div className="flex gap-2">
              {RESOLUTIONS.map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`flex-1 py-2 rounded-md text-[12px] font-mono border transition-colors ${
                    resolution === r ? 'bg-accent-soft text-accent border-accent/30' : 'bg-surface text-text-muted border-border'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[12px] font-medium text-text-muted block mb-1.5">Format</label>
            <div className="flex gap-2">
              {FORMATS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`flex-1 py-2 rounded-md text-[12px] font-mono uppercase border transition-colors ${
                    format === f ? 'bg-accent-soft text-accent border-accent/30' : 'bg-surface text-text-muted border-border'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Render starten ─────────────────────────────────── */}
        <button
          onClick={() => startRender.mutate()}
          disabled={!scenePrompt || startRender.isPending || liveJob?.status === 'ACTIVE'}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-accent text-bg text-[14px] font-medium hover:bg-accent-strong disabled:opacity-40 transition-colors"
        >
          {startRender.isPending || liveJob?.status === 'ACTIVE' ? (
            <><Loader2 size={16} className="animate-spin" /> Wird gerendert...</>
          ) : (
            <><Clapperboard size={16} /> Video generieren</>
          )}
        </button>

        {/* ── Live-Fortschritt ───────────────────────────────── */}
        {liveJob && (
          <div className="bg-surface border border-border rounded-lg p-5">
            {liveJob.status === 'COMPLETED' ? (
              <div className="flex items-center gap-2 text-success text-[13px]">
                <CheckCircle2 size={16} /> Video erfolgreich gerendert
              </div>
            ) : (
              <FilmstripProgress progress={liveJob.progress} live label={liveJob.stepLabel} />
            )}
          </div>
        )}
      </div>
    </>
  )
}
