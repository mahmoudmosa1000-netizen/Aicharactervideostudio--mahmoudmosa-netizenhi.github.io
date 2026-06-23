// ============================================================
//  apps/frontend/components/ui/FilmstripProgress.tsx
//  Signature-Fortschrittsanzeige: einzelne Frames leuchten
//  sequenziell auf, statt eines generischen Fortschrittsbalkens.
// ============================================================

interface FilmstripProgressProps {
  progress: number          // 0–100
  frameCount?: number
  live?: boolean            // teal statt amber (für aktive KI-Schritte)
  label?: string
}

export function FilmstripProgress({
  progress,
  frameCount = 24,
  live = false,
  label,
}: FilmstripProgressProps) {
  const litFrames = Math.round((progress / 100) * frameCount)

  return (
    <div className="w-full">
      {label && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-text-muted font-medium">{label}</span>
          <span className="text-[11px] font-mono text-text-faint">{Math.round(progress)}%</span>
        </div>
      )}
      <div className="filmstrip-progress">
        {Array.from({ length: frameCount }).map((_, i) => (
          <div
            key={i}
            className={`frame ${i < litFrames ? 'lit' : ''} ${live ? 'live' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}
