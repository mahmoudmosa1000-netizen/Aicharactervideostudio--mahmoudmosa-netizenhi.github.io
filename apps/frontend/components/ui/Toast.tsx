// ============================================================
//  apps/frontend/components/ui/Toast.tsx
//  Leichtgewichtiges Toast-System (kein externes Paket nötig)
// ============================================================

'use client'

import { create } from 'zustand'
import { CheckCircle2, XCircle, Info } from 'lucide-react'
import { useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: string; message: string; type: ToastType }

interface ToastStore {
  toasts: ToastItem[]
  show: (message: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  show: (message, type = 'info') => {
    const id = Math.random().toString(36).slice(2)
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

export const toast = {
  success: (msg: string) => useToastStore.getState().show(msg, 'success'),
  error: (msg: string) => useToastStore.getState().show(msg, 'error'),
  info: (msg: string) => useToastStore.getState().show(msg, 'info'),
}

const ICONS = { success: CheckCircle2, error: XCircle, info: Info }
const COLORS = {
  success: 'text-success border-success/30 bg-success-soft',
  error: 'text-danger border-danger/30 bg-danger-soft',
  info: 'text-live border-live/30 bg-live-soft',
}

export function ToastContainer() {
  const { toasts, dismiss } = useToastStore()

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((t) => {
        const Icon = ICONS[t.type]
        return (
          <div
            key={t.id}
            onClick={() => dismiss(t.id)}
            className={`flex items-start gap-2.5 px-4 py-3 rounded-md border text-[13px] cursor-pointer shadow-lg bg-surface ${COLORS[t.type]}`}
          >
            <Icon size={16} className="flex-shrink-0 mt-0.5" />
            <span className="text-text">{t.message}</span>
          </div>
        )
      })}
    </div>
  )
}
