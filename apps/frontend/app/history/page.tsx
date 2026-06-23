// ============================================================
//  apps/frontend/app/history/page.tsx
//  Video History — alle Renderings, Versionen, Social Export
// ============================================================

'use client'

import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { TopBar } from '@/components/layout/TopBar'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { videosApi, exportApi } from '@/lib/api-client'
import { Film, Download, Share2, Loader2 } from 'lucide-react'

const STATUS_FILTERS = ['ALLE', 'COMPLETED', 'RENDERING', 'FAILED'] as const

export default function HistoryPage() {
  const [statusFilter, setStatusFilter] = useState<typeof STATUS_FILTERS[number]>('ALLE')
  const [exportVideoId, setExportVideoId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['videos', 'history', page, statusFilter],
    queryFn: () =>
      videosApi
        .history({ page, limit: 20, status: statusFilter === 'ALLE' ? undefined : statusFilter })
        .then((r) => r.data),
  })

  const { data: presets } = useQuery({
    queryKey: ['export', 'presets'],
    queryFn: () => exportApi.presets().then((r) => r.data),
    enabled: !!exportVideoId,
  })

  const exportVideo = useMutation({
    mutationFn: (preset: string) => exportApi.export(exportVideoId!, preset),
    onSuccess: (res: any) => {
      toast.success(res.data.message)
      setExportVideoId(null)
    },
    onError: () => toast.error('Export fehlgeschlagen'),
  })

  return (
    <>
      <TopBar title="Verlauf" />

      <div className="p-6 max-w-6xl">
        {/* ── Filter ─────────────────────────────────────────── */}
        <div className="flex gap-2 mb-5">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-full text-[12px] border transition-colors ${
                statusFilter === s
                  ? 'bg-accent-soft text-accent border-accent/30'
                  : 'bg-surface text-text-muted border-border hover:border-border-strong'
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {/* ── Tabelle ────────────────────────────────────────── */}
        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 bg-surface rounded-md animate-pulse" />
            ))}
          </div>
        ) : data?.data.length === 0 ? (
          <div className="border border-dashed border-border rounded-lg p-12 text-center">
            <Film size={22} className="mx-auto text-text-faint mb-3" />
            <p className="text-[13px] text-text-muted">Keine Videos in dieser Kategorie</p>
          </div>
        ) : (
          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] text-text-faint uppercase tracking-wide">
                  <th className="px-4 py-3 font-medium">Video</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Auflösung</th>
                  <th className="px-4 py-3 font-medium">Dauer</th>
                  <th className="px-4 py-3 font-medium">Erstellt</th>
                  <th className="px-4 py-3 font-medium text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {data?.data.map((video) => (
                  <tr key={video.id} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded bg-surface-2 flex items-center justify-center flex-shrink-0">
                          <Film size={14} className="text-text-faint" />
                        </div>
                        <span className="font-medium text-text truncate max-w-xs">{video.title}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill status={video.status} />
                    </td>
                    <td className="px-4 py-3 font-mono text-text-muted">{video.resolution}</td>
                    <td className="px-4 py-3 font-mono text-text-muted">
                      {video.duration ? `${video.duration.toFixed(1)}s` : '—'}
                    </td>
                    <td className="px-4 py-3 text-text-faint font-mono text-[11px]">
                      {new Date(video.createdAt).toLocaleDateString('de-DE')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {video.filePath && (
                          <a
                            href={`${process.env.NEXT_PUBLIC_API_URL}/media/outputs/${video.filePath.split('/').pop()}`}
                            download
                            className="p-1.5 rounded hover:bg-surface-2 text-text-faint hover:text-text transition-colors"
                          >
                            <Download size={14} />
                          </a>
                        )}
                        {video.status === 'COMPLETED' && (
                          <button
                            onClick={() => setExportVideoId(video.id)}
                            className="p-1.5 rounded hover:bg-surface-2 text-text-faint hover:text-text transition-colors"
                          >
                            <Share2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Pagination ─────────────────────────────────────── */}
        {data?.meta && data.meta.totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-5">
            {Array.from({ length: data.meta.totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i + 1)}
                className={`w-8 h-8 rounded-md text-[12px] font-mono transition-colors ${
                  page === i + 1 ? 'bg-accent text-bg' : 'bg-surface text-text-muted hover:bg-surface-2'
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Export-Modal ─────────────────────────────────────── */}
      <Modal open={!!exportVideoId} onClose={() => setExportVideoId(null)} title="Für Social Media exportieren">
        <div className="space-y-2">
          {presets?.map((preset: any) => (
            <button
              key={preset.key}
              onClick={() => exportVideo.mutate(preset.key)}
              disabled={exportVideo.isPending}
              className="w-full flex items-center justify-between px-4 py-3 rounded-md bg-surface-2 hover:bg-surface-3 border border-border transition-colors text-left disabled:opacity-50"
            >
              <div>
                <div className="text-[13px] font-medium text-text">{preset.label}</div>
                <div className="text-[11px] text-text-faint font-mono">
                  {preset.aspectRatio} · {preset.resolution.width}×{preset.resolution.height}
                </div>
              </div>
              {exportVideo.isPending ? (
                <Loader2 size={15} className="animate-spin text-accent" />
              ) : (
                <Download size={15} className="text-text-faint" />
              )}
            </button>
          ))}
        </div>
      </Modal>
    </>
  )
}

function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    COMPLETED: 'bg-success-soft text-success',
    FAILED: 'bg-danger-soft text-danger',
    RENDERING: 'bg-live-soft text-live',
    QUEUED: 'bg-warning-soft text-warning',
    PENDING: 'bg-surface-2 text-text-faint',
  }
  return (
    <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${styles[status] || styles.PENDING}`}>
      {status}
    </span>
  )
}
