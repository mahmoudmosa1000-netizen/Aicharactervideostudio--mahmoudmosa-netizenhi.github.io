// ============================================================
//  apps/frontend/components/character/CharacterUploadModal.tsx
//  Upload-Flow: Referenzbilder + Basis-Infos → Character DNA
// ============================================================

'use client'

import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/Modal'
import { toast } from '@/components/ui/Toast'
import { charactersApi } from '@/lib/api-client'
import { Upload, X, Loader2 } from 'lucide-react'

export function CharacterUploadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<File[]>([])
  const [name, setName] = useState('')
  const [species, setSpecies] = useState('')
  const [description, setDescription] = useState('')

  const upload = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      files.forEach((f) => formData.append('images', f))
      formData.append('name', name)
      if (species) formData.append('species', species)
      if (description) formData.append('description', description)
      return charactersApi.upload(formData)
    },
    onSuccess: () => {
      toast.success(`🧬 "${name}" — Character DNA wird analysiert`)
      queryClient.invalidateQueries({ queryKey: ['characters'] })
      reset()
      onClose()
    },
    onError: () => toast.error('Upload fehlgeschlagen — bitte erneut versuchen'),
  })

  const reset = () => {
    setFiles([])
    setName('')
    setSpecies('')
    setDescription('')
  }

  const handleFiles = (incoming: FileList | null) => {
    if (!incoming) return
    setFiles((prev) => [...prev, ...Array.from(incoming)].slice(0, 10))
  }

  return (
    <Modal open={open} onClose={onClose} title="Neuen Charakter erstellen">
      <div className="space-y-4">
        {/* Bild-Upload-Zone */}
        <div>
          <label className="text-[12px] font-medium text-text-muted block mb-1.5">
            Referenzbilder (1–10, je mehr desto präziser)
          </label>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-border rounded-md p-6 text-center cursor-pointer hover:border-accent/50 transition-colors"
          >
            <Upload size={20} className="mx-auto text-text-faint mb-2" />
            <p className="text-[12px] text-text-muted">Klicken oder Bilder hierher ziehen</p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </div>

          {files.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {files.map((file, i) => (
                <div key={i} className="relative w-14 h-14 rounded-md overflow-hidden border border-border group">
                  <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute top-0.5 right-0.5 bg-black/70 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Basis-Infos */}
        <div>
          <label className="text-[12px] font-medium text-text-muted block mb-1.5">Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z.B. Mika"
            className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-[13px] text-text placeholder:text-text-faint focus:border-accent/50 outline-none"
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-text-muted block mb-1.5">Spezies</label>
          <input
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
            placeholder="z.B. Katze, Mensch, Roboter"
            className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-[13px] text-text placeholder:text-text-faint focus:border-accent/50 outline-none"
          />
        </div>

        <div>
          <label className="text-[12px] font-medium text-text-muted block mb-1.5">Beschreibung</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Kurze Beschreibung des Charakters..."
            rows={2}
            className="w-full px-3 py-2 rounded-md bg-surface-2 border border-border text-[13px] text-text placeholder:text-text-faint focus:border-accent/50 outline-none resize-none"
          />
        </div>

        <button
          onClick={() => upload.mutate()}
          disabled={!name || files.length === 0 || upload.isPending}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-accent text-bg text-[13px] font-medium hover:bg-accent-strong disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {upload.isPending ? (
            <><Loader2 size={15} className="animate-spin" /> Character DNA wird erstellt...</>
          ) : (
            'Charakter erstellen & analysieren'
          )}
        </button>
        <p className="text-[11px] text-text-faint text-center">
          Florence-2, InsightFace, CLIP und DINOv2 analysieren die Bilder automatisch
        </p>
      </div>
    </Modal>
  )
}
