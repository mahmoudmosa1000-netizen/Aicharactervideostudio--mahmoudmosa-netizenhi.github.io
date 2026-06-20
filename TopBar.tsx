// ============================================================
//  apps/frontend/components/layout/TopBar.tsx
//  Kopfzeile mit Breadcrumb + Live GPU/VRAM-HUD
// ============================================================

'use client'

import { useEffect, useState } from 'react'
import { Cpu } from 'lucide-react'

interface GpuInfo {
  id: number
  name: string
  vram_total_gb: number
  vram_used_gb: number
  vram_free_gb: number
}

const AI_WORKER_URL = process.env.NEXT_PUBLIC_AI_WORKER_URL || 'http://localhost:8000'

export function TopBar({ title }: { title: string }) {
  const [gpus, setGpus] = useState<GpuInfo[]>([])

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch(`${AI_WORKER_URL}/health`)
        const data = await res.json()
        setGpus(data.gpu_info?.gpus || [])
      } catch {
        // AI Worker nicht erreichbar — HUD bleibt leer
      }
    }
    fetchHealth()
    const interval = setInterval(fetchHealth, 15000)
    return () => clearInterval(interval)
  }, [])

  return (
    <header className="h-topbar border-b border-border flex items-center justify-between px-6 bg-bg/80 backdrop-blur-sm sticky top-0 z-10">
      <h1 className="font-display font-semibold text-[16px] text-text">{title}</h1>

      <div className="flex items-center gap-3">
        {gpus.map((gpu) => {
          const usedPct = Math.round((gpu.vram_used_gb / gpu.vram_total_gb) * 100)
          return (
            <div
              key={gpu.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-surface border border-border text-[11px]"
            >
              <Cpu size={13} className="text-live" />
              <span className="text-text-muted font-mono">{gpu.name}</span>
              <span className="font-mono text-text">
                {gpu.vram_free_gb.toFixed(1)}GB frei
              </span>
              <div className="w-12 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div
                  className="h-full bg-live transition-all"
                  style={{ width: `${usedPct}%` }}
                />
              </div>
            </div>
          )
        })}
        {gpus.length === 0 && (
          <span className="text-[11px] text-text-faint font-mono">AI Worker offline</span>
        )}
      </div>
    </header>
  )
}
