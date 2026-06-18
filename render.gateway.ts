// ============================================================
//  apps/backend/src/gateways/render.gateway.ts
//  WebSocket Gateway — Live Render-Status für Frontend
// ============================================================

import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets'
import { Logger } from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { Server, Socket } from 'socket.io'

@WebSocketGateway({
  cors: { origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true },
  namespace: '/render',
})
export class RenderGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server
  private readonly logger = new Logger(RenderGateway.name)

  // userId → Set<socketId>
  private userSockets = new Map<string, Set<string>>()

  constructor(private jwtService: JwtService) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token
        || client.handshake.headers?.authorization?.replace('Bearer ', '')

      if (!token) { client.disconnect(); return }

      const payload = this.jwtService.verify(token)
      client.data.userId = payload.sub

      if (!this.userSockets.has(payload.sub)) {
        this.userSockets.set(payload.sub, new Set())
      }
      this.userSockets.get(payload.sub)!.add(client.id)

      this.logger.log(`🔌 Client verbunden: ${client.id} (User: ${payload.sub})`)
    } catch {
      client.disconnect()
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.userId
    if (userId && this.userSockets.has(userId)) {
      this.userSockets.get(userId)!.delete(client.id)
    }
    this.logger.log(`🔌 Client getrennt: ${client.id}`)
  }

  // Client abonniert einen Job
  @SubscribeMessage('subscribe-job')
  handleSubscribeJob(@ConnectedSocket() client: Socket, @MessageBody() data: { jobId: string }) {
    client.join(`job:${data.jobId}`)
    this.logger.log(`📡 Client ${client.id} abonniert Job ${data.jobId}`)
    return { event: 'subscribed', jobId: data.jobId }
  }

  @SubscribeMessage('unsubscribe-job')
  handleUnsubscribeJob(@ConnectedSocket() client: Socket, @MessageBody() data: { jobId: string }) {
    client.leave(`job:${data.jobId}`)
  }

  // ── Emit-Methoden (vom RenderProcessor aufgerufen) ──────────

  emitJobProgress(jobId: string, userId: string, payload: JobProgressPayload) {
    // An alle Clients die diesen Job abonniert haben
    this.server.to(`job:${jobId}`).emit('job:progress', payload)

    // Auch an alle Sockets des Users (Dashboard)
    const sockets = this.userSockets.get(userId)
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('job:progress', payload)
      })
    }
  }

  emitJobCompleted(jobId: string, userId: string, videoPath: string) {
    const payload = { jobId, status: 'COMPLETED', videoPath }
    this.server.to(`job:${jobId}`).emit('job:completed', payload)
    const sockets = this.userSockets.get(userId)
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('job:completed', payload)
      })
    }
    this.logger.log(`✅ Job ${jobId} abgeschlossen → ${videoPath}`)
  }

  emitJobFailed(jobId: string, userId: string, error: string) {
    const payload = { jobId, status: 'FAILED', error }
    this.server.to(`job:${jobId}`).emit('job:failed', payload)
    const sockets = this.userSockets.get(userId)
    if (sockets) {
      sockets.forEach((socketId) => {
        this.server.to(socketId).emit('job:failed', payload)
      })
    }
    this.logger.error(`❌ Job ${jobId} fehlgeschlagen: ${error}`)
  }
}

// ── Types ──────────────────────────────────────────────────

export interface JobProgressPayload {
  jobId: string
  videoId: string
  status: string
  progress: number        // 0–100
  currentStep: string
  stepLabel: string
  estimatedSeconds?: number
}
