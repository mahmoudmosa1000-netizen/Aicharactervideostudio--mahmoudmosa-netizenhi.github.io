// ============================================================
//  apps/backend/src/modules/voice/voice.module.ts
// ============================================================

import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { MulterModule } from '@nestjs/platform-express'
import { VoiceController } from './voice.controller'
import { VoiceService } from './voice.service'

@Module({
  imports: [
    HttpModule,
    MulterModule.register({ dest: process.env.UPLOAD_PATH || './storage/uploads' }),
  ],
  controllers: [VoiceController],
  providers: [VoiceService],
  exports: [VoiceService],
})
export class VoiceModule {}

// ============================================================
//  apps/backend/src/modules/voice/voice.controller.ts
// ============================================================

import {
  Controller, Post, Get, Body, Param,
  UseGuards, Request, UseInterceptors, UploadedFile,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { VoiceService } from './voice.service'
import { CloneVoiceDto } from './dto/clone-voice.dto'
import { SynthesizeDto } from './dto/synthesize.dto'

@ApiTags('Voice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('voice')
export class VoiceController {
  constructor(private readonly service: VoiceService) {}

  // GET /voice/profiles
  @Get('profiles')
  getProfiles(@Request() req) {
    return this.service.getProfiles(req.user.id)
  }

  // POST /voice/clone — Stimme aus Audio klonen
  @Post('clone')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio'))
  cloneVoice(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CloneVoiceDto,
    @Request() req,
  ) {
    return this.service.cloneVoice(file, dto, req.user.id)
  }

  // POST /voice/synthesize — Text zu Sprache
  @Post('synthesize')
  synthesize(@Body() dto: SynthesizeDto, @Request() req) {
    return this.service.synthesize(dto, req.user.id)
  }

  // DELETE /voice/profiles/:id
  @Post('profiles/:id/delete')
  deleteProfile(@Param('id') id: string, @Request() req) {
    return this.service.deleteProfile(id, req.user.id)
  }
}

// ============================================================
//  apps/backend/src/modules/voice/voice.service.ts
// ============================================================

import { Injectable, NotFoundException } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import { CloneVoiceDto } from './dto/clone-voice.dto'
import { SynthesizeDto } from './dto/synthesize.dto'

@Injectable()
export class VoiceService {
  private readonly aiWorkerUrl: string

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.aiWorkerUrl = this.config.get('AI_WORKER_URL', 'http://localhost:8000')
  }

  async getProfiles(userId: string) {
    return this.prisma.voiceProfile.findMany({
      where: { userId },
      include: { character: { select: { name: true, thumbnailUrl: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async cloneVoice(file: Express.Multer.File, dto: CloneVoiceDto, userId: string) {
    // AI Worker klont die Stimme und gibt Speaker-Embedding zurück
    const { data: cloneResult } = await firstValueFrom(
      this.http.post(`${this.aiWorkerUrl}/clone-voice`, {
        audioPath: file.path,
        language: dto.language || 'de',
        model: dto.model || 'xtts-v2',
        characterId: dto.characterId,
      }),
    )

    const profile = await this.prisma.voiceProfile.create({
      data: {
        userId,
        characterId: dto.characterId,
        name: dto.name,
        language: dto.language || 'de',
        model: dto.model || 'xtts-v2',
        referencePath: file.path,
        speakerEmbeddingId: cloneResult.speakerEmbeddingId,
        emotions: cloneResult.supportedEmotions || ['neutral'],
      },
    })

    return { profile, message: '🎙 Stimme erfolgreich geklont' }
  }

  async synthesize(dto: SynthesizeDto, userId: string) {
    const profile = await this.prisma.voiceProfile.findFirst({
      where: { id: dto.voiceProfileId, userId },
    })
    if (!profile) throw new NotFoundException('Voice Profile nicht gefunden')

    const { data: result } = await firstValueFrom(
      this.http.post(`${this.aiWorkerUrl}/synthesize-voice`, {
        text: dto.text,
        speakerEmbeddingId: profile.speakerEmbeddingId,
        language: profile.language,
        emotion: dto.emotion || 'neutral',
        speed: dto.speed || profile.speed,
      }),
    )

    return { audioPath: result.outputPath, duration: result.duration }
  }

  async deleteProfile(id: string, userId: string) {
    const profile = await this.prisma.voiceProfile.findFirst({ where: { id, userId } })
    if (!profile) throw new NotFoundException('Profil nicht gefunden')
    await this.prisma.voiceProfile.delete({ where: { id } })
    return { message: 'Voice Profile gelöscht' }
  }
}

// ============================================================
//  apps/backend/src/modules/voice/dto/clone-voice.dto.ts
// ============================================================

import { IsString, IsOptional, IsIn } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CloneVoiceDto {
  @ApiProperty({ example: 'Mikas Stimme' })
  @IsString() name: string

  @ApiPropertyOptional() @IsOptional() @IsString() characterId?: string
  @ApiPropertyOptional({ example: 'de' }) @IsOptional() @IsString() language?: string
  @ApiPropertyOptional({ enum: ['xtts-v2', 'kokoro', 'orpheus'] })
  @IsOptional() @IsIn(['xtts-v2', 'kokoro', 'orpheus']) model?: string
}

export class SynthesizeDto {
  @ApiProperty({ example: 'Willkommen in meiner Bäckerei!' })
  @IsString() text: string

  @ApiProperty() @IsString() voiceProfileId: string
  @ApiPropertyOptional({ example: 'freude' }) @IsOptional() @IsString() emotion?: string
  @ApiPropertyOptional({ example: 1.0 }) @IsOptional() speed?: number
}
