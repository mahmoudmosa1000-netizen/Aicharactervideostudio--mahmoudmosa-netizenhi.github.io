// ============================================================
//  apps/backend/src/modules/stories/stories.module.ts
// ============================================================

import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { StoriesController } from './stories.controller'
import { StoriesService } from './stories.service'

@Module({
  imports: [HttpModule],
  controllers: [StoriesController],
  providers: [StoriesService],
  exports: [StoriesService],
})
export class StoriesModule {}

// ============================================================
//  apps/backend/src/modules/stories/stories.controller.ts
// ============================================================

import {
  Controller, Get, Post, Put, Delete,
  Body, Param, UseGuards, Request,
} from '@nestjs/common'
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { StoriesService } from './stories.service'
import { GenerateStoryDto } from './dto/generate-story.dto'
import { UpdateSceneDto } from './dto/update-scene.dto'

@ApiTags('Stories')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('stories')
export class StoriesController {
  constructor(private readonly service: StoriesService) {}

  // GET /stories
  @Get()
  findAll(@Request() req) {
    return this.service.findAll(req.user.id)
  }

  // GET /stories/:id
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user.id)
  }

  // POST /stories/generate — KI generiert Story aus Idee
  @Post('generate')
  generate(@Body() dto: GenerateStoryDto, @Request() req) {
    return this.service.generateStory(dto, req.user.id)
  }

  // GET /stories/:id/scenes — Alle Szenen einer Story
  @Get(':id/scenes')
  getScenes(@Param('id') id: string, @Request() req) {
    return this.service.getScenes(id, req.user.id)
  }

  // PUT /stories/:storyId/scenes/:sceneId — Szene bearbeiten
  @Put(':storyId/scenes/:sceneId')
  updateScene(
    @Param('storyId') storyId: string,
    @Param('sceneId') sceneId: string,
    @Body() dto: UpdateSceneDto,
    @Request() req,
  ) {
    return this.service.updateScene(storyId, sceneId, dto, req.user.id)
  }

  // DELETE /stories/:id
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user.id)
  }
}

// ============================================================
//  apps/backend/src/modules/stories/stories.service.ts
// ============================================================

import { Injectable, NotFoundException } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import { GenerateStoryDto } from './dto/generate-story.dto'
import { UpdateSceneDto } from './dto/update-scene.dto'

@Injectable()
export class StoriesService {
  private readonly aiWorkerUrl: string

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.aiWorkerUrl = this.config.get('AI_WORKER_URL', 'http://localhost:8000')
  }

  async findAll(userId: string) {
    return this.prisma.story.findMany({
      where: { userId },
      include: { _count: { select: { scenes: true, videos: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findOne(id: string, userId: string) {
    const story = await this.prisma.story.findFirst({
      where: { id, userId },
      include: {
        scenes: {
          include: { sceneCharacters: { include: { character: true } } },
          orderBy: { order: 'asc' },
        },
      },
    })
    if (!story) throw new NotFoundException('Story nicht gefunden')
    return story
  }

  async generateStory(dto: GenerateStoryDto, userId: string) {
    // 1. Story-Eintrag mit Status GENERATING anlegen
    const story = await this.prisma.story.create({
      data: {
        userId,
        title: dto.title || 'Neue Story',
        generationPrompt: dto.idea,
        genre: dto.genre,
        targetLength: dto.sceneCount || 10,
        status: 'GENERATING',
        llmModel: dto.llmModel || 'qwen3',
      },
    })

    // 2. AI Worker: Story generieren lassen
    const { data: generated } = await firstValueFrom(
      this.http.post(`${this.aiWorkerUrl}/generate-story`, {
        idea: dto.idea,
        characterIds: dto.characterIds,
        sceneCount: dto.sceneCount || 10,
        genre: dto.genre,
        language: dto.language || 'de',
        llmModel: dto.llmModel || 'qwen3',
      }),
    )

    // 3. Story + Szenen aus KI-Antwort speichern
    const updated = await this.prisma.story.update({
      where: { id: story.id },
      data: {
        title: generated.title || dto.title || 'Story',
        outline: generated.outline,
        status: 'READY',
        scenes: {
          create: generated.scenes.map((s: any, i: number) => ({
            order: i + 1,
            title: s.title,
            description: s.description,
            dialogue: s.dialogue,
            voiceOverText: s.voiceOver,
            characterPrompt: s.prompts?.character,
            scenePrompt: s.prompts?.scene,
            cameraPrompt: s.prompts?.camera,
            motionPrompt: s.prompts?.motion,
            environmentPrompt: s.prompts?.environment,
            lightingPrompt: s.prompts?.lighting,
            cameraType: s.camera?.type,
            duration: s.duration || 5,
          })),
        },
      },
      include: { scenes: { orderBy: { order: 'asc' } } },
    })

    // 4. Charaktere mit Szenen verknüpfen
    if (dto.characterIds?.length) {
      for (const scene of updated.scenes) {
        await this.prisma.sceneCharacter.createMany({
          data: dto.characterIds.map((charId) => ({
            sceneId: scene.id,
            characterId: charId,
            role: 'Protagonist',
          })),
          skipDuplicates: true,
        })
      }
    }

    return updated
  }

  async getScenes(storyId: string, userId: string) {
    await this.findOne(storyId, userId)
    return this.prisma.scene.findMany({
      where: { storyId },
      include: { sceneCharacters: { include: { character: true } } },
      orderBy: { order: 'asc' },
    })
  }

  async updateScene(storyId: string, sceneId: string, dto: UpdateSceneDto, userId: string) {
    await this.findOne(storyId, userId)
    return this.prisma.scene.update({
      where: { id: sceneId },
      data: dto,
    })
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId)
    await this.prisma.story.delete({ where: { id } })
    return { message: 'Story gelöscht' }
  }
}

// ============================================================
//  apps/backend/src/modules/stories/dto/generate-story.dto.ts
// ============================================================

import { IsString, IsOptional, IsInt, IsArray, IsIn, Min, Max } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class GenerateStoryDto {
  @ApiProperty({ example: 'Eine orange-weiße Katze eröffnet eine Bäckerei' })
  @IsString()
  idea: string

  @ApiPropertyOptional({ example: 'Mikas Bäckerei' })
  @IsOptional() @IsString()
  title?: string

  @ApiPropertyOptional({ example: 'Abenteuer' })
  @IsOptional() @IsString()
  genre?: string

  @ApiPropertyOptional({ example: ['char-id-1'] })
  @IsOptional() @IsArray() @IsString({ each: true })
  characterIds?: string[]

  @ApiPropertyOptional({ enum: [5, 10, 20], example: 10 })
  @IsOptional() @IsInt() @IsIn([5, 10, 20])
  sceneCount?: number

  @ApiPropertyOptional({ example: 'de' })
  @IsOptional() @IsString()
  language?: string

  @ApiPropertyOptional({ enum: ['qwen3', 'deepseek', 'llama4'] })
  @IsOptional() @IsIn(['qwen3', 'deepseek', 'llama4'])
  llmModel?: string
}

// ============================================================
//  apps/backend/src/modules/stories/dto/update-scene.dto.ts
// ============================================================

import { IsString, IsOptional, IsInt, Min } from 'class-validator'

export class UpdateSceneDto {
  @IsOptional() @IsString() title?: string
  @IsOptional() @IsString() description?: string
  @IsOptional() @IsString() dialogue?: string
  @IsOptional() @IsString() voiceOverText?: string
  @IsOptional() @IsString() characterPrompt?: string
  @IsOptional() @IsString() scenePrompt?: string
  @IsOptional() @IsString() cameraPrompt?: string
  @IsOptional() @IsString() motionPrompt?: string
  @IsOptional() @IsString() environmentPrompt?: string
  @IsOptional() @IsString() lightingPrompt?: string
  @IsOptional() @IsString() negativePrompt?: string
  @IsOptional() @IsString() cameraType?: string
  @IsOptional() @IsInt() @Min(1) duration?: number
}
