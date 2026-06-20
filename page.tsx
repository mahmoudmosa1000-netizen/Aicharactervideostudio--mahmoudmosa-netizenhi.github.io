// ============================================================
//  apps/frontend/app/page.tsx
//  Dashboard — Projekte, letzte Videos, Render-Status
// ============================================================

'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { FilmstripProgress } from '@/components/ui/FilmstripProgress'
import { charactersApi, storiesApi, videosApi, renderApi } from '@/lib/api-client'
import { useRenderSocket } from '@/hooks/use-render-socket'
import { useEffect } from 'react'
import { Plus, Users, BookOpen, Film, ArrowRight } from 'lucide-react'

export default function DashboardPage() {
  const { data: characters } = useQuery({
    queryKey: ['characters'],
    queryFn: () => charactersApi.list().then((r) => r.data),
  })
  const { data: stories } = useQuery({
    queryKey: ['stories'],
    queryFn: () => storiesApi.list().then((r) => r.data),
  })
  const { data: recentVideos } = useQuery({
    queryKey: ['videos', 'recent'],
    queryFn: () => videosApi.history({ limit: 5 }).then((r) => r.data.data),
  })
  const { data: activeJobs } = useQuery({
    queryKey: ['render', 'queue'],
    queryFn: () => renderApi.queue().then((r) => r.data),
    refetchInterval: 5000,
  })

  const { jobs, subscribe } = useRenderSocket()

  // Aktive Jobs automatisch abonnieren für Live-Updates
  useEffect(() => {
    activeJobs?.forEach((job) => {
      if (job.status === 'ACTIVE' || job.status === 'WAITING') {
        subscribe(job.jobId)
      }
    })
  }, [activeJobs, subscribe])

  const runningJobs = activeJobs?.filter((j) => j.status === 'ACTIVE' || j.status === 'WAITING') || []

  return (
    <>
      <TopBar title="Dashboard" />

      <div className="p-6 space-y-8 max-w-6xl">
        {/* ── Schnellzugriff-Karten ──────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <StatCard
            icon={Users}
            label="Charaktere"
            value={characters?.length ?? '—'}
            sublabel={`${characters?.filter((c) => c.isLocked).length ?? 0} gesperrt`}
            href="/characters"
          />
          <StatCard
            icon={BookOpen}
            label="Stories"
            value={stories?.length ?? '—'}
            sublabel={`${stories?.filter((s) => s.status === 'READY').length ?? 0} bereit zum Rendern`}
            href="/stories/new"
          />
          <StatCard
            icon={Film}
            label="Aktive Render-Jobs"
            value={runningJobs.length}
            sublabel={runningJobs.length > 0 ? 'läuft gerade' : 'Warteschlange leer'}
            href="/create"
            live={runningJobs.length > 0}
          />
        </div>

        {/* ── Live Render-Status ─────────────────────────────── */}
        {runningJobs.length > 0 && (
          <section>
            <h2 className="text-[13px] font-semibold text-text-muted uppercase tracking-wide mb-3">
              Live Render-Status
            </h2>
            <div className="bg-surface border border-border rounded-lg divide-y divide-border">
              {runningJobs.map((job) => {
                const liveState = jobs[job.jobId]
                return (
                  <div key={job.jobId} className="p-4 flex items-center gap-4">
                    <span className="status-dot-live flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium text-text mb-2">
                        {job.video?.title || 'Video wird gerendert...'}
                      </div>
                      <FilmstripProgress
                        progress={liveState?.progress ?? job.progress}
                        live
                        label={liveState?.stepLabel ?? job.currentStep ?? 'Wird vorbereitet...'}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Letzte Videos ──────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-text-muted uppercase tracking-wide">
              Letzte Videos
            </h2>
            <Link href="/history" className="text-[12px] text-accent flex items-center gap-1 hover:gap-1.5 transition-all">
              Alle ansehen <ArrowRight size={12} />
            </Link>
          </div>

          {recentVideos && recentVideos.length > 0 ? (
            <div className="grid grid-cols-5 gap-3">
              {recentVideos.map((video) => (
                <Link
                  key={video.id}
                  href={`/history?video=${video.id}`}
                  className="group rounded-md border border-border bg-surface overflow-hidden hover:border-border-strong transition-colors"
                >
                  <div className="aspect-video bg-surface-2 flex items-center justify-center relative">
                    <Film size={20} className="text-text-faint" />
                    <span
                      className={`absolute top-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded-full ${
                        video.status === 'COMPLETED'
                          ? 'bg-success-soft text-success'
                          : video.status === 'FAILED'
                          ? 'bg-danger-soft text-danger'
                          : 'bg-live-soft text-live'
                      }`}
                    >
                      {video.status}
                    </span>
                  </div>
                  <div className="p-2.5">
                    <div className="text-[11px] font-medium text-text truncate">{video.title}</div>
                    <div className="text-[10px] text-text-faint font-mono mt-0.5">
                      {video.resolution} · {video.fileFormat}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Noch keine Videos"
              description="Erstelle deinen ersten Charakter und generiere ein Video."
              actionLabel="Charakter anlegen"
              actionHref="/characters"
            />
          )}
        </section>

        {/* ── Letzte Charaktere ──────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[13px] font-semibold text-text-muted uppercase tracking-wide">
              Charakter-Bibliothek
            </h2>
            <Link href="/characters" className="text-[12px] text-accent flex items-center gap-1 hover:gap-1.5 transition-all">
              Alle ansehen <ArrowRight size={12} />
            </Link>
          </div>

          {characters && characters.length > 0 ? (
            <div className="grid grid-cols-6 gap-3">
              {characters.slice(0, 6).map((char) => (
                <Link
                  key={char.id}
                  href={`/characters/${char.id}`}
                  className="group rounded-md border border-border bg-surface p-3 hover:border-border-strong transition-colors text-center"
                >
                  <div className="w-12 h-12 rounded-full bg-surface-2 mx-auto mb-2 flex items-center justify-center text-lg font-display font-semibold text-text-muted">
                    {char.name.charAt(0)}
                  </div>
                  <div className="text-[11px] font-medium text-text truncate">{char.name}</div>
                  {char.isLocked && (
                    <div className="text-[9px] text-accent mt-1 font-mono">🔒 GESPERRT</div>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState
              title="Noch keine Charaktere"
              description="Lade Referenzbilder hoch und erstelle dein erstes Character-DNA-Profil."
              actionLabel="Ersten Charakter erstellen"
              actionHref="/characters"
            />
          )}
        </section>
      </div>
    </>
  )
}

// ── Hilfskomponenten ─────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, sublabel, href, live,
}: {
  icon: any; label: string; value: string | number; sublabel: string; href: string; live?: boolean
}) {
  return (
    <Link
      href={href}
      className="bg-surface border border-border rounded-lg p-5 hover:border-border-strong transition-colors block"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-md bg-accent-soft flex items-center justify-center">
          <Icon size={16} className="text-accent" />
        </div>
        {live && <span className="status-dot-live" />}
      </div>
      <div className="font-display text-2xl font-semibold text-text mb-1">{value}</div>
      <div className="text-[12px] text-text-muted">{label}</div>
      <div className="text-[11px] text-text-faint mt-1">{sublabel}</div>
    </Link>
  )
}

function EmptyState({
  title, description, actionLabel, actionHref,
}: { title: string; description: string; actionLabel: string; actionHref: string }) {
  return (
    <div className="border border-dashed border-border rounded-lg p-10 text-center">
      <p className="text-[13px] font-medium text-text mb-1">{title}</p>
      <p className="text-[12px] text-text-muted mb-4">{description}</p>
      <Link
        href={actionHref}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-accent text-bg text-[12px] font-medium hover:bg-accent-strong transition-colors"
      >
        <Plus size={14} /> {actionLabel}
      </Link>
    </div>
  )
}
