// ============================================================
//  apps/backend/src/modules/render/render.module.ts
// ============================================================

import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { HttpModule } from '@nestjs/axios'
import { JwtModule } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { RenderController } from './render.controller'
import { RenderService } from './render.service'
import { RenderProcessor } from './processors/render.processor'
import { RenderGateway } from '../../gateways/render.gateway'
import { StoryRenderService } from './story-render.service'

@Module({
  imports: [
    HttpModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET'),
        signOptions: { expiresIn: config.get('JWT_EXPIRY', '7d') },
      }),
    }),
    BullModule.registerQueue({
      name: 'render',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  controllers: [RenderController],
  providers: [RenderService, RenderProcessor, RenderGateway, StoryRenderService],
  exports: [RenderService, StoryRenderService],
})
export class RenderModule {}

// ============================================================
//  apps/backend/src/modules/render/render.controller.ts
// ============================================================

import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { RenderService } from './render.service'
import { StartRenderDto } from './dto/start-render.dto'
import { StoryRenderService } from './story-render.service'
import { StartStoryRenderDto } from './dto/start-story-render.dto'

@ApiTags('Render')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('render')
export class RenderController {
  constructor(
    private readonly service: RenderService,
    private readonly storyRenderService: StoryRenderService,
  ) {}

  // POST /render/start — Render-Job für eine einzelne Szene starten
  @Post('start')
  start(@Body() dto: StartRenderDto, @Request() req) {
    return this.service.startRender(dto, req.user.id)
  }

  // GET /render/status/:jobId — Live-Status abfragen
  @Get('status/:jobId')
  getStatus(@Param('jobId') jobId: string, @Request() req) {
    return this.service.getJobStatus(jobId, req.user.id)
  }

  // GET /render/queue — Alle Jobs des Users
  @Get('queue')
  getQueue(@Request() req) {
    return this.service.getUserJobs(req.user.id)
  }

  // POST /render/cancel/:jobId — Job abbrechen
  @Post('cancel/:jobId')
  cancel(@Param('jobId') jobId: string, @Request() req) {
    return this.service.cancelJob(jobId, req.user.id)
  }

  // ── Phase 4: Story-zu-Video Orchestrierung ─────────────────

  // POST /render/story/:storyId/start — Komplette Story rendern
  @Post('story/:storyId/start')
  startStoryRender(
    @Param('storyId') storyId: string,
    @Body() dto: StartStoryRenderDto,
    @Request() req,
  ) {
    return this.storyRenderService.startStoryRender(storyId, dto, req.user.id)
  }

  // GET /render/story/:storyId/progress — Fortschritt aller Szenen
  @Get('story/:storyId/progress')
  getStoryProgress(@Param('storyId') storyId: string, @Request() req) {
    return this.storyRenderService.getStoryRenderProgress(storyId, req.user.id)
  }
}

// ============================================================
//  apps/backend/src/modules/render/render.service.ts
// ============================================================

import { Injectable, NotFoundException } from '@nestjs/common'
import { InjectQueue } from '@nestjs/bullmq'
import { Queue } from 'bullmq'
import { PrismaService } from '../../prisma/prisma.service'
import { StartRenderDto } from './dto/start-render.dto'

@Injectable()
export class RenderService {
  constructor(
    @InjectQueue('render') private renderQueue: Queue,
    private prisma: PrismaService,
  ) {}

  async startRender(dto: StartRenderDto, userId: string) {
    // 1. Video-Eintrag anlegen
    const video = await this.prisma.video.create({
      data: {
        userId,
        sceneId: dto.sceneId,
        storyId: dto.storyId,
        title: dto.title || `Render ${new Date().toISOString()}`,
        resolution: dto.resolution || '1080p',
        fps: dto.fps || 24,
        fileFormat: dto.format || 'mp4',
        status: 'QUEUED',
      },
    })

    // 2. BullMQ Job erstellen
    const job = await this.renderQueue.add(
      'render-video',
      {
        videoId: video.id,
        userId,
        ...dto,
      },
      {
        priority: dto.priority || 0,
      },
    )

    // 3. RenderJob in DB tracken
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

    return {
      videoId: video.id,
      jobId: job.id,
      status: 'QUEUED',
      message: '🎬 Render-Job gestartet',
    }
  }

  async getJobStatus(jobId: string, userId: string) {
    const job = await this.prisma.renderJob.findFirst({
      where: { jobId, userId },
      include: { video: true },
    })
    if (!job) throw new NotFoundException('Job nicht gefunden')

    const bullJob = await this.renderQueue.getJob(jobId)
    return {
      ...job,
      bullmqState: bullJob ? await bullJob.getState() : 'unknown',
      bullmqProgress: bullJob?.progress || 0,
    }
  }

  async getUserJobs(userId: string) {
    return this.prisma.renderJob.findMany({
      where: { userId },
      include: { video: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
  }

  async cancelJob(jobId: string, userId: string) {
    const job = await this.prisma.renderJob.findFirst({ where: { jobId, userId } })
    if (!job) throw new NotFoundException('Job nicht gefunden')

    const bullJob = await this.renderQueue.getJob(jobId)
    if (bullJob) await bullJob.remove()

    await this.prisma.renderJob.update({
      where: { id: job.id },
      data: { status: 'CANCELLED' },
    })

    return { message: 'Job abgebrochen' }
  }
}

// ============================================================
//  apps/backend/src/modules/render/processors/render.processor.ts
//  Phase 4: Vollständig verdrahtet — echte DB-Daten,
//  Character Lock Engine, WebSocket Live-Updates
// ============================================================

import { Processor, WorkerHost } from '@nestjs/bullmq'
import { InjectQueue } from '@nestjs/bullmq'
import { Job, Queue } from 'bullmq'
import { Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../../prisma/prisma.service'
import { RenderGateway } from '../../../gateways/render.gateway'
import { StoryRenderService } from '../story-render.service'

const STEP_LABELS: Record<string, string> = {
  prompt_building: 'Prompts erstellen',
  image_gen: 'Bild generieren',
  video_gen: 'Video generieren',
  voice_gen: 'Stimme generieren',
  assembly: 'Zusammenfügen',
}

// WICHTIG: Es darf nur EINEN @Processor('render') in der ganzen App geben.
// Mehrere Worker auf derselben Queue würden sich Jobs gegenseitig
// "stegehlen" — ein Job landet dann ggf. beim falschen Handler und
// wird fälschlich als erledigt markiert. Deshalb wird hier nach
// job.name unterschieden statt eine zweite Processor-Klasse anzulegen.
@Processor('render')
export class RenderProcessor extends WorkerHost {
  private readonly logger = new Logger(RenderProcessor.name)
  private readonly aiWorkerUrl: string

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
    private gateway: RenderGateway,
    private storyRenderService: StoryRenderService,
    @InjectQueue('render') private renderQueue: Queue,
  ) {
    super()
    this.aiWorkerUrl = this.config.get('AI_WORKER_URL', 'http://localhost:8000')
  }

  async process(job: Job) {
    if (job.name === 'story-assembly-watch') {
      return this.processStoryWatch(job)
    }
    return this.processSceneRender(job)
  }

  // ── Job-Typ 1: Einzelne Szene rendern ───────────────────────

  async processSceneRender(job: Job) {
    const { videoId, userId, sceneId, characterId } = job.data
    const jobId = job.id!.toString()
    this.logger.log(`▶ Verarbeite Job ${jobId} für Video ${videoId}`)

    try {
      // ── Echte Daten aus der DB laden ──────────────────────
      const scene = sceneId
        ? await this.prisma.scene.findUnique({ where: { id: sceneId } })
        : null
      const character = characterId
        ? await this.prisma.character.findUnique({
            where: { id: characterId },
            include: { profile: true },
          })
        : null

      // ── Schritt 1: Prompts ─────────────────────────────────
      await this.updateStep(jobId, userId, videoId, 'prompt_building', 10)

      let prompts: any
      const hasFinishedPrompts = scene?.characterPrompt && scene?.scenePrompt
      if (hasFinishedPrompts) {
        // Story Generator hat bereits fertige Prompts erzeugt
        prompts = {
          character: scene.characterPrompt,
          scene: scene.scenePrompt,
          camera: scene.cameraPrompt,
          motion: scene.motionPrompt,
          environment: scene.environmentPrompt,
          lighting: scene.lightingPrompt,
          negative: scene.negativePrompt || '',
        }
      } else {
        // Prompts müssen erst veredelt werden (Phase 4 Prompt Builder)
        const { data } = await firstValueFrom(
          this.http.post(`${this.aiWorkerUrl}/build-prompts`, {
            characterProfile: character?.profile
              ? { name: character.name, ...character.profile }
              : {},
            sceneDraft: {
              title: scene?.title,
              description: scene?.description,
              dialogue: scene?.dialogue,
            },
            mode: 'refine',
          }),
        )
        prompts = data.prompts
      }
      await job.updateProgress(20)

      // ── Schritt 2: Bild generieren (mit Lock Engine wenn gesperrt) ──
      await this.updateStep(jobId, userId, videoId, 'image_gen', 30)
      const { data: imageResult } = await firstValueFrom(
        this.http.post(`${this.aiWorkerUrl}/generate-image`, {
          characterPrompt: prompts.character,
          scenePrompt: prompts.scene,
          cameraPrompt: prompts.camera,
          lightingPrompt: prompts.lighting,
          environmentPrompt: prompts.environment,
          motionPrompt: prompts.motion,
          negativePrompt: prompts.negative,
          characterId: character?.id,
          referenceImagePaths: character?.referenceImages || [],
          ipAdapterWeight: character?.profile?.ipAdapterWeight || 0.8,
          isCharacterLocked: character?.isLocked || false,
          preferredLockMethod: 'auto',
        }),
      )
      await job.updateProgress(50)

      // ── Schritt 3: Video generieren (Wan 2.2) ──────────────
      await this.updateStep(jobId, userId, videoId, 'video_gen', 55)
      const video = await this.prisma.video.findUnique({ where: { id: videoId } })
      const { data: videoResult } = await firstValueFrom(
        this.http.post(`${this.aiWorkerUrl}/generate-video`, {
          imagePath: imageResult.imagePath,
          prompt: prompts.scene,
          motionPrompt: prompts.motion,
          cameraPrompt: prompts.camera,
          negativePrompt: prompts.negative,
          durationSeconds: scene?.duration || 5,
          fps: video?.fps || 24,
        }),
      )
      await job.updateProgress(80)

      // ── Schritt 4: Stimme generieren (XTTS-v2) ─────────────
      await this.updateStep(jobId, userId, videoId, 'voice_gen', 85)
      let audioPath: string | null = null
      if (scene?.voiceOverText && character?.id) {
        const voiceProfile = await this.prisma.voiceProfile.findFirst({
          where: { characterId: character.id },
        })
        if (voiceProfile?.speakerEmbeddingId) {
          const { data: voiceResult } = await firstValueFrom(
            this.http.post(`${this.aiWorkerUrl}/voice/synthesize-voice`, {
              text: scene.voiceOverText,
              speakerEmbeddingId: voiceProfile.speakerEmbeddingId,
              language: voiceProfile.language,
            }),
          )
          audioPath = voiceResult.outputPath
        }
      }
      await job.updateProgress(90)

      // ── Schritt 5: FFmpeg Assembly ──────────────────────────
      await this.updateStep(jobId, userId, videoId, 'assembly', 92)
      const { data: finalResult } = await firstValueFrom(
        this.http.post(`${this.aiWorkerUrl}/assemble`, {
          videoId,
          videoPaths: [videoResult.videoPath],
          audioPath,
          outputFormat: video?.fileFormat || 'mp4',
        }),
      )
      await job.updateProgress(100)

      // ── Video als fertig markieren ───────────────────────────
      await this.prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'COMPLETED',
          filePath: finalResult.outputPath,
          fileSize: BigInt(finalResult.fileSize || 0),
          duration: scene?.duration || 5,
          renderTime: Math.floor((Date.now() - job.timestamp) / 1000),
          videoModel: process.env.VIDEO_MODEL || 'wan2.2',
          imageModel: process.env.IMAGE_MODEL || 'flux-dev',
        },
      })

      await this.prisma.renderJob.updateMany({
        where: { jobId, userId },
        data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
      })

      // ── WebSocket: Fertig-Meldung an Client ─────────────────
      this.gateway.emitJobCompleted(jobId, userId, finalResult.outputPath)

      this.logger.log(`✅ Job ${jobId} abgeschlossen`)
      return { success: true, videoId, outputPath: finalResult.outputPath }

    } catch (error) {
      this.logger.error(`❌ Job ${jobId} fehlgeschlagen:`, error.message)
      await this.prisma.video.update({ where: { id: videoId }, data: { status: 'FAILED' } })
      await this.prisma.renderJob.updateMany({
        where: { jobId, userId },
        data: { status: 'FAILED', errorMessage: error.message },
      })
      this.gateway.emitJobFailed(jobId, userId, error.message)
      throw error
    }
  }

  // ── Job-Typ 2: Story-Fortschritt prüfen & ggf. zusammenführen ──

  async processStoryWatch(job: Job) {
    const { storyId, userId, format } = job.data
    this.logger.log(`👀 Prüfe Story-Fortschritt: ${storyId}`)

    const done = await this.storyRenderService.tryAssembleFullStory(storyId, userId, format)

    if (!done) {
      await this.renderQueue.add(
        'story-assembly-watch',
        { storyId, userId, format },
        { delay: 5000, attempts: 1 },
      )
      this.logger.log(`⏳ Story ${storyId} noch nicht fertig — erneute Prüfung in 5s`)
    }
  }

  // ── Hilfsmethode: DB-Update + WebSocket-Emit in einem Schritt ──
  private async updateStep(
    jobId: string,
    userId: string,
    videoId: string,
    step: string,
    progress: number,
  ) {
    await this.prisma.renderJob.updateMany({
      where: { jobId, userId },
      data: { currentStep: step, progress, status: 'ACTIVE' },
    })

    this.gateway.emitJobProgress(jobId, userId, {
      jobId,
      videoId,
      status: 'ACTIVE',
      progress,
      currentStep: step,
      stepLabel: STEP_LABELS[step] || step,
    })
  }
}

// ============================================================
//  apps/backend/src/modules/render/dto/start-render.dto.ts
// ============================================================

import { IsString, IsOptional, IsInt, IsIn, Min, Max } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class StartRenderDto {
  @ApiPropertyOptional() @IsOptional() @IsString() title?: string
  @ApiPropertyOptional() @IsOptional() @IsString() sceneId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() storyId?: string
  @ApiPropertyOptional() @IsOptional() @IsString() characterId?: string
  @ApiPropertyOptional({ enum: ['720p', '1080p', '2K', '4K'] })
  @IsOptional() @IsIn(['720p', '1080p', '2K', '4K']) resolution?: string
  @ApiPropertyOptional() @IsOptional() @IsInt() @IsIn([24, 30, 60]) fps?: number
  @ApiPropertyOptional({ enum: ['mp4', 'mov', 'webm'] })
  @IsOptional() @IsIn(['mp4', 'mov', 'webm']) format?: string
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(10) priority?: number
}
