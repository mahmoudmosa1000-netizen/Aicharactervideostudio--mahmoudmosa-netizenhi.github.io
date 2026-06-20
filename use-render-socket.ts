// ============================================================
//  apps/frontend/hooks/use-render-socket.ts
//  Live-Status für Render-Jobs über WebSocket (render.gateway.ts)
// ============================================================

'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { io, Socket } from 'socket.io-client'

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001'

export interface JobProgressEvent {
  jobId: string
  videoId: string
  status: string
  progress: number
  currentStep: string
  stepLabel: string
}

export interface JobCompletedEvent {
  jobId: string
  status: 'COMPLETED'
  videoPath: string
}

export interface JobFailedEvent {
  jobId: string
  status: 'FAILED'
  error: string
}

type JobState = {
  progress: number
  stepLabel: string
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED'
  videoPath?: string
  error?: string
}

/**
 * Verbindet sich einmal pro Komponentenbaum mit dem /render
 * WebSocket-Namespace und hält den Live-Status aller abonnierten
 * Jobs in einer Map. Nutzung:
 *
 *   const { jobs, subscribe } = useRenderSocket()
 *   useEffect(() => subscribe(jobId), [jobId])
 *   const state = jobs[jobId]
 */
export function useRenderSocket() {
  const socketRef = useRef<Socket | null>(null)
  const [jobs, setJobs] = useState<Record<string, JobState>>({})
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) return

    const socket = io(`${WS_URL}/render`, {
      auth: { token },
      transports: ['websocket'],
    })
    socketRef.current = socket

    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    socket.on('job:progress', (data: JobProgressEvent) => {
      setJobs((prev) => ({
        ...prev,
        [data.jobId]: {
          progress: data.progress,
          stepLabel: data.stepLabel,
          status: 'ACTIVE',
        },
      }))
    })

    socket.on('job:completed', (data: JobCompletedEvent) => {
      setJobs((prev) => ({
        ...prev,
        [data.jobId]: { progress: 100, stepLabel: 'Fertig', status: 'COMPLETED', videoPath: data.videoPath },
      }))
    })

    socket.on('job:failed', (data: JobFailedEvent) => {
      setJobs((prev) => ({
        ...prev,
        [data.jobId]: { progress: 0, stepLabel: 'Fehler', status: 'FAILED', error: data.error },
      }))
    })

    return () => {
      socket.disconnect()
    }
  }, [])

  const subscribe = useCallback((jobId: string) => {
    socketRef.current?.emit('subscribe-job', { jobId })
  }, [])

  const unsubscribe = useCallback((jobId: string) => {
    socketRef.current?.emit('unsubscribe-job', { jobId })
  }, [])

  return { jobs, connected, subscribe, unsubscribe }
}
