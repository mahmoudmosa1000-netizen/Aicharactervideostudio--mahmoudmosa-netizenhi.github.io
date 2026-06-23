// ============================================================
//  apps/backend/src/modules/render/story-render.service.ts
//  Phase 4: Story-zu-Video Orchestrator
//
//  Nimmt eine komplette Story und:
//  1. Erstellt einen Render-Job pro Szene (parallel in der Queue)
//  2. Überwacht den Fortschritt aller Szenen-Jobs
//  3. Sobald alle fertig sind: fügt sie zu einem Gesamtvideo zusammen
// ============================================================

import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import { RenderGateway } from '../../gateways/render.gateway'
import { StartStoryRenderDto } from './dto/start-story-render.dto'

@Injectable()
export class StoryRenderService {
  private readonly logger = new Logger(StoryRenderService.name)
  private readonly aiWorkerUrl: string

  constructor(
    @InjectQueue('render') private renderQueue: Queue,
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
    private gateway: RenderGateway,
  ) {
    this.aiWorkerUrl = this.config.get('AI_WORKER_URL', 'http://localhost:8000')
  }

  // ── Komplette Story rendern ───────────────────────────────

  async startStoryRender(storyId: string, dto: StartStoryRenderDto, userId: string) {
    const story = await this.prisma.story.findFirst({
      where: { id: storyId, userId },
      include: {
        scenes: {
          orderBy: { order: 'asc' },
          include: { sceneCharacters: { include: { character: true } } },
        },
      },
    })
    if (!story) throw new NotFoundException('Story nicht gefunden')
    if (story.scenes.length === 0) throw new NotFoundException('Story hat keine Szenen')

    this.logger.log(`🎬 Starte Story-Render: "${story.title}" (${story.scenes.length} Szenen)`)

    // 1 Video-Eintrag pro Szene + 1 Job pro Szene in die Queue
    const sceneJobs = await Promise.all(
      story.scenes.map(async (scene) => {
        const primaryCharacter = scene.sceneCharacters[0]?.character

        const video = await this.prisma.video.create({
          data: {
            userId,
            storyId,
            sceneId: scene.id,
            title: `${story.title} — ${scene.title}`,
            resolution: dto.resolution || '1080p',
            fps: dto.fps || 24,
            fileFormat: dto.format || 'mp4',
            status: 'QUEUED',
          },
        })

        const job = await this.renderQueue.add(
          'render-video',
          {
            videoId: video.id,
            userId,
            sceneId: scene.id,
            characterId: primaryCharacter?.id,
          },
          { priority: scene.order }, // niedrigere Order = höhere Priorität
        )

        await this.prisma.renderJob.create({
          data: {
            userId,
            videoId: video.id,
            jobId: job.id!.toString(),
            queue: 'render',
            status: 'WAITING',
            steps: [
              { step: 'prompt_building', label: 'Prompts erstellen', status: 'pending' },
              { step: 'image_gen', label: 'Bild generieren', status: 'pending' },
              { step: 'video_gen', label: 'Video generieren', status: 'pending' },
              { step: 'voice_gen', label: 'Stimme generieren', status: 'pending' },
              { step: 'assembly', label: 'Zusammenfügen', status: 'pending' },
            ],
          },
        })

        return { sceneId: scene.id, sceneOrder: scene.order, videoId: video.id, jobId: job.id }
      }),
    )

    // Story-Status aktualisieren
    await this.prisma.story.update({ where: { id: storyId }, data: { status: 'IN_PRODUCTION' } })

    // Einen "Watcher-Job" anlegen, der nach Abschluss aller Szenen
    // automatisch die finale Zusammenführung triggert
    await this.renderQueue.add(
      'story-assembly-watch',
      { storyId, userId, sceneJobIds: sceneJobs.map((j) => j.jobId), format: dto.format || 'mp4' },
      { delay: 5000, attempts: 1 }, // Erster Check nach 5s, dann re-queued bis fertig
    )

    return {
      storyId,
      totalScenes: story.scenes.length,
      sceneJobs,
      message: `🎬 ${story.scenes.length} Szenen-Jobs gestartet`,
    }
  }

  // ── Fortschritt der gesamten Story ────────────────────────

  async getStoryRenderProgress(storyId: string, userId: string) {
    const videos = await this.prisma.video.findMany({
      where: { storyId, userId, sceneId: { not: null } },
      include: { renderJobs: { orderBy: { createdAt: 'desc' }, take: 1 }, scene: true },
      orderBy: { scene: { order: 'asc' } },
    })

    const total = videos.length
    const completed = videos.filter((v) => v.status === 'COMPLETED').length
    const failed = videos.filter((v) => v.status === 'FAILED').length

    return {
      storyId,
      totalScenes: total,
      completedScenes: completed,
      failedScenes: failed,
      overallProgress: total > 0 ? Math.round((completed / total) * 100) : 0,
      scenes: videos.map((v) => ({
        sceneId: v.sceneId,
        sceneOrder: v.scene?.order,
        sceneTitle: v.scene?.title,
        videoId: v.id,
        status: v.status,
        progress: v.renderJobs[0]?.progress || 0,
        currentStep: v.renderJobs[0]?.currentStep,
      })),
    }
  }

  // ── Watcher: Prüft ob alle Szenen fertig sind, kombiniert dann ──
  // Wird vom StoryAssemblyProcessor aufgerufen (siehe story-assembly.processor.ts)

  async tryAssembleFullStory(storyId: string, userId: string, format: string): Promise<boolean> {
    const progress = await this.getStoryRenderProgress(storyId, userId)

    if (progress.failedScenes > 0) {
      this.logger.warn(`⚠ Story ${storyId}: ${progress.failedScenes} Szene(n) fehlgeschlagen`)
      await this.prisma.story.update({ where: { id: storyId }, data: { status: 'IN_PRODUCTION' } })
      return true // Nicht erneut versuchen, Fehler wurde geloggt
    }

    if (progress.completedScenes < progress.totalScenes) {
      return false // Noch nicht alle Szenen fertig — Watcher muss erneut prüfen
    }

    // Alle Szenen fertig → Reihenfolge der fertigen Clips ermitteln
    const sortedVideos = [...progress.scenes].sort((a, b) => (a.sceneOrder || 0) - (b.sceneOrder || 0))
    const videoRecords = await this.prisma.video.findMany({
      where: { id: { in: sortedVideos.map((s) => s.videoId) } },
    })
    const orderedPaths = sortedVideos
      .map((s) => videoRecords.find((v) => v.id === s.videoId)?.filePath)
      .filter(Boolean) as string[]

    this.logger.log(`🎞 Füge ${orderedPaths.length} Szenen-Clips zur Gesamt-Story zusammen`)

    const { data: finalResult } = await firstValueFrom(
      this.http.post(`${this.aiWorkerUrl}/assemble`, {
        videoId: `story-${storyId}`,
        videoPaths: orderedPaths,
        outputFormat: format,
      }),
    )

    // Gesamt-Video-Eintrag erstellen (sceneId = null → repräsentiert die volle Story)
    const story = await this.prisma.story.findUnique({ where: { id: storyId } })
    const fullVideo = await this.prisma.video.create({
      data: {
        userId,
        storyId,
        title: `${story?.title} (Vollständig)`,
        status: 'COMPLETED',
        filePath: finalResult.outputPath,
        fileSize: BigInt(finalResult.fileSize || 0),
        fileFormat: format,
        duration: progress.scenes.length * 5, // Näherung
      },
    })

    await this.prisma.story.update({ where: { id: storyId }, data: { status: 'COMPLETED' } })

    this.gateway.emitJobCompleted(`story-${storyId}`, userId, finalResult.outputPath)
    this.logger.log(`✅ Story komplett gerendert: ${fullVideo.id}`)
    return true
  }
}
