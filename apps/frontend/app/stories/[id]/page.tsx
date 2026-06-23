// ============================================================
//  apps/frontend/app/stories/[id]/page.tsx
//  Szenen-Editor + Story-zu-Video Rendern (Phase 4 Orchestrator)
// ============================================================

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { FilmstripProgress } from '@/components/ui/FilmstripProgress'
import { toast } from '@/components/ui/Toast'
import { storiesApi, renderApi } from '@/lib/api-client'
import { Clapperboard, Loader2, Clock, CheckCircle2, XCircle } from 'lucide-react'

export default function StoryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null)
  const [isRendering, setIsRendering] = useState(false)

  const { data: story, isLoading } = useQuery({
    queryKey: ['story', id],
    queryFn: () => storiesApi.get(id).then((r) => r.data),
  })

  const { data: progress } = useQuery({
    queryKey: ['story', id, 'progress'],
    queryFn: () => renderApi.storyProgress(id).then((r) => r.data as any),
    enabled: isRendering || story?.status === 'IN_PRODUCTION',
    refetchInterval: 4000,
  })

  useEffect(() => {
    if (story?.status === 'IN_PRODUCTION') setIsRendering(true)
    if (story?.status === 'COMPLETED') setIsRendering(false)
  }, [story?.status])

  const startRender = useMutation({
    mutationFn: () => renderApi.startStory(id, { resolution: '1080p', fps: 24, format: 'mp4' }),
    onSuccess: (res) => {
      toast.success(res.data.message)
      setIsRendering(true)
      queryClient.invalidateQueries({ queryKey: ['story', id] })
    },
    onError: () => toast.error('Render-Start fehlgeschlagen'),
  })

  if (isLoading || !story) {
    return (
      <>
        <TopBar title="Lädt..." />
        <div className="p-6 animate-pulse h-64 bg-surface rounded-lg max-w-4xl" />
      </>
    )
  }

  const activeScene = story.scenes?.find((s) => s.id === activeSceneId) || story.scenes?.[0]

  return (
    <>
      <TopBar title={story.title} />

      <div className="flex max-w-6xl">
        {/* ── Szenen-Liste ───────────────────────────────────── */}
        <div className="w-72 border-r border-border p-4 space-y-1.5 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">
              {story.scenes?.length || 0} Szenen
            </span>
            <StatusBadge status={story.status} />
          </div>

          {story.scenes?.map((scene) => {
            const sceneProgress = progress?.scenes?.find((s: any) => s.sceneId === scene.id)
            return (
              <button
                key={scene.id}
                onClick={() => setActiveSceneId(scene.id)}
                className={`w-full text-left px-3 py-2.5 rounded-md transition-colors ${
                  (activeScene?.id === scene.id)
                    ? 'bg-accent-soft border border-accent/30'
                    : 'hover:bg-surface border border-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] font-mono text-text-faint">#{scene.order}</span>
                  {sceneProgress && <SceneStatusIcon status={sceneProgress.status} />}
                </div>
                <div className="text-[13px] text-text font-medium truncate">{scene.title}</div>
                <div className="text-[11px] text-text-faint">{scene.duration}s</div>
              </button>
            )
          })}

          <button
            onClick={() => startRender.mutate()}
            disabled={startRender.isPending || isRendering}
            className="w-full mt-4 flex items-center justify-center gap-2 px-3 py-2.5 rounded-md bg-accent text-bg text-[13px] font-medium hover:bg-accent-strong disabled:opacity-50 transition-colors"
          >
            {isRendering ? (
              <><Loader2 size={14} className="animate-spin" /> Rendert...</>
            ) : (
              <><Clapperboard size={14} /> Komplette Story rendern</>
            )}
          </button>
        </div>

        {/* ── Story-Render-Fortschritt ───────────────────────── */}
        <div className="flex-1 p-6">
          {isRendering && progress && (
            <div className="bg-surface border border-border rounded-lg p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide">
                  Story-Render-Fortschritt
                </h3>
                <span className="text-[12px] font-mono text-text-faint">
                  {progress.completedScenes}/{progress.totalScenes} Szenen
                </span>
              </div>
              <FilmstripProgress progress={progress.overallProgress} live frameCount={story.scenes?.length || 10} />
            </div>
          )}

          {/* ── Szenen-Detail ──────────────────────────────────── */}
          {activeScene && (
            <div className="bg-surface border border-border rounded-lg p-5 space-y-4">
              <div>
                <h3 className="font-display text-lg font-semibold text-text mb-1">
                  #{activeScene.order} — {activeScene.title}
                </h3>
                <p className="text-[13px] text-text-muted">{activeScene.description}</p>
              </div>

              {activeScene.voiceOverText && (
                <div className="px-3 py-2.5 bg-surface-2 rounded-md">
                  <div className="text-[10px] text-text-faint uppercase tracking-wide mb-1">Voice-Over</div>
                  <p className="text-[13px] text-text italic">"{activeScene.voiceOverText}"</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <PromptField label="Character" value={activeScene.characterPrompt} />
                <PromptField label="Scene" value={activeScene.scenePrompt} />
                <PromptField label="Camera" value={activeScene.cameraPrompt} />
                <PromptField label="Motion" value={activeScene.motionPrompt} />
                <PromptField label="Environment" value={activeScene.environmentPrompt} />
                <PromptField label="Lighting" value={activeScene.lightingPrompt} />
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

function PromptField({ label, value }: { label: string; value?: string }) {
  return (
    <div className="px-3 py-2 bg-surface-2 rounded-md">
      <div className="text-[9px] text-text-faint uppercase tracking-wide mb-0.5">{label}</div>
      <div className="text-[11px] text-text-muted font-mono leading-relaxed">{value || '—'}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    DRAFT: 'bg-surface-2 text-text-faint',
    GENERATING: 'bg-live-soft text-live',
    READY: 'bg-warning-soft text-warning',
    IN_PRODUCTION: 'bg-live-soft text-live',
    COMPLETED: 'bg-success-soft text-success',
  }
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${styles[status] || styles.DRAFT}`}>
      {status}
    </span>
  )
}

function SceneStatusIcon({ status }: { status: string }) {
  if (status === 'COMPLETED') return <CheckCircle2 size={13} className="text-success" />
  if (status === 'FAILED') return <XCircle size={13} className="text-danger" />
  if (status === 'RENDERING' || status === 'ACTIVE') return <Loader2 size={13} className="text-live animate-spin" />
  return <Clock size={13} className="text-text-faint" />
}
