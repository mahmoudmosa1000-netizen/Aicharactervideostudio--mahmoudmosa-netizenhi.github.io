// ============================================================
//  apps/frontend/app/settings/page.tsx
//  Einstellungen — Modelle, GPU, Speicher, Benutzer
// ============================================================

'use client'

import { useState, useEffect } from 'react'
import { TopBar } from '@/components/layout/TopBar'
import { useAuthStore } from '@/store/use-auth-store'
import { toast } from '@/components/ui/Toast'
import { Cpu, HardDrive, User as UserIcon, Sliders } from 'lucide-react'

const MODEL_OPTIONS = {
  video: ['wan2.2', 'hunyuan', 'ltx', 'cogvideox', 'skyreels'],
  image: ['flux-dev', 'flux-kontext', 'sdxl'],
  llm: ['qwen3', 'deepseek', 'llama4'],
  voice: ['xtts-v2', 'kokoro', 'orpheus'],
}

export default function SettingsPage() {
  const { user } = useAuthStore()
  const [videoModel, setVideoModel] = useState('wan2.2')
  const [imageModel, setImageModel] = useState('flux-dev')
  const [llmModel, setLlmModel] = useState('qwen3')
  const [voiceModel, setVoiceModel] = useState('xtts-v2')
  const [resolution, setResolution] = useState('1080p')
  const [tensorrt, setTensorrt] = useState(false)
  const [gpus, setGpus] = useState<any[]>([])

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_AI_WORKER_URL || 'http://localhost:8000'
    fetch(`${url}/health`)
      .then((r) => r.json())
      .then((data) => setGpus(data.gpu_info?.gpus || []))
      .catch(() => {})
  }, [])

  const saveSettings = () => {
    // In Produktion: PUT /settings
    toast.success('Einstellungen gespeichert')
  }

  return (
    <>
      <TopBar title="Einstellungen" />

      <div className="p-6 max-w-2xl space-y-6">
        {/* ── Benutzer ───────────────────────────────────────── */}
        <Section icon={UserIcon} title="Benutzer">
          <div className="flex items-center gap-3 px-3 py-2.5 bg-surface-2 rounded-md">
            <div className="w-9 h-9 rounded-full bg-accent-soft flex items-center justify-center font-display font-semibold text-accent">
              {user?.name?.charAt(0) || user?.email?.charAt(0) || '?'}
            </div>
            <div>
              <div className="text-[13px] font-medium text-text">{user?.name || 'Unbenannt'}</div>
              <div className="text-[11px] text-text-faint">{user?.email}</div>
            </div>
            <span className="ml-auto text-[10px] font-mono px-2 py-0.5 rounded-full bg-surface-3 text-text-muted">
              {user?.role || 'CREATOR'}
            </span>
          </div>
        </Section>

        {/* ── KI-Modelle ─────────────────────────────────────── */}
        <Section icon={Sliders} title="Standard-KI-Modelle">
          <ModelSelect label="Video-Generierung" options={MODEL_OPTIONS.video} value={videoModel} onChange={setVideoModel} />
          <ModelSelect label="Bild-Generierung" options={MODEL_OPTIONS.image} value={imageModel} onChange={setImageModel} />
          <ModelSelect label="Story-Generierung (LLM)" options={MODEL_OPTIONS.llm} value={llmModel} onChange={setLlmModel} />
          <ModelSelect label="Sprachsynthese" options={MODEL_OPTIONS.voice} value={voiceModel} onChange={setVoiceModel} />
        </Section>

        {/* ── Render-Standardwerte ───────────────────────────── */}
        <Section icon={HardDrive} title="Render-Standardwerte">
          <div className="flex items-center justify-between py-1">
            <span className="text-[13px] text-text">Standard-Auflösung</span>
            <div className="flex gap-1.5">
              {['720p', '1080p', '2K', '4K'].map((r) => (
                <button
                  key={r}
                  onClick={() => setResolution(r)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-mono border transition-colors ${
                    resolution === r ? 'bg-accent-soft text-accent border-accent/30' : 'bg-surface-2 text-text-muted border-border'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          <ToggleRow
            label="TensorRT-Optimierung"
            description="Schnellere Inferenz, längere Erstkompilierung"
            value={tensorrt}
            onChange={setTensorrt}
          />
        </Section>

        {/* ── GPU-Status ─────────────────────────────────────── */}
        <Section icon={Cpu} title="GPU-Status">
          {gpus.length > 0 ? (
            <div className="space-y-2">
              {gpus.map((gpu) => (
                <div key={gpu.id} className="px-3 py-2.5 bg-surface-2 rounded-md">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[13px] font-medium text-text">{gpu.name}</span>
                    <span className="status-dot-live" />
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-text-faint">
                    <span>{gpu.vram_used_gb.toFixed(1)} / {gpu.vram_total_gb.toFixed(1)} GB</span>
                    <span>{gpu.vram_free_gb.toFixed(1)} GB frei</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden mt-2">
                    <div
                      className="h-full bg-live"
                      style={{ width: `${(gpu.vram_used_gb / gpu.vram_total_gb) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-text-faint">AI Worker nicht erreichbar — keine GPU-Daten verfügbar.</p>
          )}
        </Section>

        <button
          onClick={saveSettings}
          className="w-full px-4 py-2.5 rounded-md bg-accent text-bg text-[13px] font-medium hover:bg-accent-strong transition-colors"
        >
          Einstellungen speichern
        </button>
      </div>
    </>
  )
}

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="text-[12px] font-semibold text-text-muted uppercase tracking-wide mb-4 flex items-center gap-2">
        <Icon size={13} /> {title}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function ModelSelect({
  label, options, value, onChange,
}: { label: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[13px] text-text">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="px-2.5 py-1.5 rounded-md bg-surface-2 border border-border text-[12px] font-mono text-text outline-none focus:border-accent/50"
      >
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}

function ToggleRow({
  label, description, value, onChange,
}: { label: string; description: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-1">
      <div>
        <div className="text-[13px] text-text">{label}</div>
        <div className="text-[11px] text-text-faint">{description}</div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-10 h-5.5 rounded-full transition-colors relative flex-shrink-0 ${value ? 'bg-accent' : 'bg-surface-3'}`}
      >
        <span
          className={`absolute top-0.5 w-4.5 h-4.5 rounded-full bg-bg transition-transform ${
            value ? 'translate-x-5' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  )
}
