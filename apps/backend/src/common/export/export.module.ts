// ============================================================
//  apps/backend/src/common/export/export.module.ts
//  Export Center — Kernfunktion 11 der Spezifikation
//  Social-Media-Formate: TikTok, Instagram Reels, YouTube Shorts, Facebook Reels
// ============================================================

import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { ExportController } from './export.controller'
import { ExportService } from './export.service'

@Module({
  imports: [HttpModule],
  controllers: [ExportController],
  providers: [ExportService],
  exports: [ExportService],
})
export class ExportModule {}

// ============================================================
//  apps/backend/src/common/export/export.controller.ts
// ============================================================

import { Controller, Post, Get, Param, Body, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard'
import { ExportService } from './export.service'
import { ExportRequestDto } from './dto/export-request.dto'

@ApiTags('Export')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('export')
export class ExportController {
  constructor(private readonly service: ExportService) {}

  // GET /export/presets — Verfügbare Social-Media-Presets
  @Get('presets')
  getPresets() {
    return this.service.getPresets()
  }

  // POST /export/:videoId — Video in Ziel-Format/Plattform exportieren
  @Post(':videoId')
  exportVideo(
    @Param('videoId') videoId: string,
    @Body() dto: ExportRequestDto,
    @Request() req,
  ) {
    return this.service.exportVideo(videoId, dto, req.user.id)
  }

  // GET /export/:videoId/history — Bisherige Exporte eines Videos
  @Get(':videoId/history')
  getExportHistory(@Param('videoId') videoId: string, @Request() req) {
    return this.service.getExportHistory(videoId, req.user.id)
  }
}

// ============================================================
//  apps/backend/src/common/export/export.service.ts
// ============================================================

import { Injectable, NotFoundException } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import { ExportRequestDto } from './dto/export-request.dto'

// ── Social-Media-Presets (Seitenverhältnis, Auflösung, Limits) ──
export const SOCIAL_PRESETS = {
  tiktok: {
    label: 'TikTok',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDurationSeconds: 600,
    format: 'mp4',
  },
  instagram_reels: {
    label: 'Instagram Reels',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDurationSeconds: 90,
    format: 'mp4',
  },
  youtube_shorts: {
    label: 'YouTube Shorts',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDurationSeconds: 60,
    format: 'mp4',
  },
  facebook_reels: {
    label: 'Facebook Reels',
    aspectRatio: '9:16',
    resolution: { width: 1080, height: 1920 },
    maxDurationSeconds: 90,
    format: 'mp4',
  },
  original: {
    label: 'Original (16:9)',
    aspectRatio: '16:9',
    resolution: { width: 1920, height: 1080 },
    maxDurationSeconds: null,
    format: 'mp4',
  },
} as const

export type SocialPreset = keyof typeof SOCIAL_PRESETS

@Injectable()
export class ExportService {
  private readonly aiWorkerUrl: string

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.aiWorkerUrl = this.config.get('AI_WORKER_URL', 'http://localhost:8000')
  }

  getPresets() {
    return Object.entries(SOCIAL_PRESETS).map(([key, value]) => ({ key, ...value }))
  }

  async exportVideo(videoId: string, dto: ExportRequestDto, userId: string) {
    const video = await this.prisma.video.findFirst({ where: { id: videoId, userId } })
    if (!video) throw new NotFoundException('Video nicht gefunden')
    if (!video.filePath) throw new NotFoundException('Video ist noch nicht fertig gerendert')

    const preset = SOCIAL_PRESETS[dto.preset as SocialPreset] || SOCIAL_PRESETS.original

    if (preset.maxDurationSeconds && video.duration && video.duration > preset.maxDurationSeconds) {
      // Hinweis statt Fehler — AI Worker schneidet automatisch zurecht
    }

    // AI Worker: Seitenverhältnis anpassen, neu kodieren, Format konvertieren
    const { data: result } = await firstValueFrom(
      this.http.post(`${this.aiWorkerUrl}/export-social`, {
        sourcePath: video.filePath,
        targetWidth: preset.resolution.width,
        targetHeight: preset.resolution.height,
        targetFormat: dto.format || preset.format,
        maxDurationSeconds: preset.maxDurationSeconds,
        cropMode: dto.cropMode || 'smart', // smart|center|blur-padding
      }),
    )

    // Export-Historie in DB vermerken
    const exportedTo = [...new Set([...video.exportedTo, dto.preset])]
    await this.prisma.video.update({
      where: { id: videoId },
      data: { exportedTo },
    })

    return {
      videoId,
      preset: dto.preset,
      outputPath: result.outputPath,
      fileSize: result.fileSize,
      resolution: `${preset.resolution.width}x${preset.resolution.height}`,
      message: `📤 Export für ${preset.label} abgeschlossen`,
    }
  }

  async getExportHistory(videoId: string, userId: string) {
    const video = await this.prisma.video.findFirst({
      where: { id: videoId, userId },
      select: { exportedTo: true, title: true },
    })
    if (!video) throw new NotFoundException('Video nicht gefunden')
    return video
  }
}

// ============================================================
//  apps/backend/src/common/export/dto/export-request.dto.ts
// ============================================================

import { IsString, IsOptional, IsIn } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ExportRequestDto {
  @ApiProperty({
    enum: ['tiktok', 'instagram_reels', 'youtube_shorts', 'facebook_reels', 'original'],
    example: 'tiktok',
  })
  @IsString()
  preset: string

  @ApiPropertyOptional({ enum: ['mp4', 'mov', 'webm'] })
  @IsOptional() @IsIn(['mp4', 'mov', 'webm'])
  format?: string

  @ApiPropertyOptional({ enum: ['smart', 'center', 'blur-padding'], default: 'smart' })
  @IsOptional() @IsIn(['smart', 'center', 'blur-padding'])
  cropMode?: string
}
