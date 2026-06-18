// ============================================================
//  apps/backend/src/modules/render/render.module.ts
// ============================================================

import { Module } from '@nestjs/common'
import { BullModule } from '@nestjs/bullmq'
import { HttpModule } from '@nestjs/axios'
import { RenderController } from './render.controller'
import { RenderService } from './render.service'
import { RenderProcessor } from './processors/render.processor'

@Module({
  imports: [
    HttpModule,
    BullModule.registerQueue({
      name: 'render',
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      },
    }),
  ],
  controllers: [RenderController],
  providers: [RenderService, RenderProcessor],
  exports: [RenderService],
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

@ApiTags('Render')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('render')
export class RenderController {
  constructor(private readonly service: RenderService) {}

  // POST /render/start — Render-Job starten
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
// ============================================================

import { Processor, WorkerHost } from '@nestjs/bullmq'
import { Job } from 'bullmq'
import { Logger } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../../prisma/prisma.service'

@Processor('render')
export class RenderProcessor extends WorkerHost {
  private readonly logger = new Logger(RenderProcessor.name)
  private readonly aiWorkerUrl: string

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
  ) {
    super()
    this.aiWorkerUrl = this.config.get('AI_WORKER_URL', 'http://localhost:8000')
  }

  async process(job: Job) {
    const { videoId, userId, sceneId, characterId } = job.data
    this.logger.log(`▶ Verarbeite Job ${job.id} für Video ${videoId}`)

    try {
      await this.updateJobStep(job.id!.toString(), userId, 'prompt_building', 10)

      // Schritt 1: Prompts aufbauen
      const { data: prompts } = await firstValueFrom(
        this.http.post(`${this.aiWorkerUrl}/build-prompts`, { sceneId, characterId }),
      )
      await job.updateProgress(20)

      // Schritt 2: Bild generieren (FLUX + IP-Adapter)
      await this.updateJobStep(job.id!.toString(), userId, 'image_gen', 30)
      const { data: imageResult } = await firstValueFrom(
        this.http.post(`${this.aiWorkerUrl}/generate-image`, {
          ...prompts,
          characterId,
        }),
      )
      await job.updateProgress(50)

      // Schritt 3: Video generieren (Wan 2.2)
      await this.updateJobStep(job.id!.toString(), userId, 'video_gen', 55)
      const { data: videoResult } = await firstValueFrom(
        this.http.post(`${this.aiWorkerUrl}/generate-video`, {
          imageUrl: imageResult.imagePath,
          ...prompts,
        }),
      )
      await job.updateProgress(80)

      // Schritt 4: Stimme generieren (XTTS-v2)
      await this.updateJobStep(job.id!.toString(), userId, 'voice_gen', 85)
      const scene = await this.prisma.scene.findUnique({ where: { id: sceneId } })
      if (scene?.voiceOverText) {
        await firstValueFrom(
          this.http.post(`${this.aiWorkerUrl}/generate-voice`, {
            text: scene.voiceOverText,
            characterId,
            videoId,
          }),
        )
      }
      await job.updateProgress(90)

      // Schritt 5: FFmpeg Assembly
      await this.updateJobStep(job.id!.toString(), userId, 'assembly', 92)
      const { data: finalResult } = await firstValueFrom(
        this.http.post(`${this.aiWorkerUrl}/assemble`, { videoId }),
      )
      await job.updateProgress(100)

      // Video als fertig markieren
      await this.prisma.video.update({
        where: { id: videoId },
        data: {
          status: 'COMPLETED',
          filePath: finalResult.outputPath,
          fileSize: BigInt(finalResult.fileSize || 0),
          duration: finalResult.duration,
          renderTime: Math.floor((Date.now() - job.timestamp) / 1000),
        },
      })

      await this.prisma.renderJob.updateMany({
        where: { jobId: job.id!.toString(), userId },
        data: { status: 'COMPLETED', progress: 100, completedAt: new Date() },
      })

      this.logger.log(`✅ Job ${job.id} abgeschlossen`)
      return { success: true, videoId, outputPath: finalResult.outputPath }

    } catch (error) {
      this.logger.error(`❌ Job ${job.id} fehlgeschlagen:`, error.message)
      await this.prisma.video.update({ where: { id: videoId }, data: { status: 'FAILED' } })
      await this.prisma.renderJob.updateMany({
        where: { jobId: job.id!.toString(), userId },
        data: { status: 'FAILED', errorMessage: error.message },
      })
      throw error
    }
  }

  private async updateJobStep(jobId: string, userId: string, step: string, progress: number) {
    await this.prisma.renderJob.updateMany({
      where: { jobId, userId },
      data: { currentStep: step, progress, status: 'ACTIVE' },
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
