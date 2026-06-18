// ============================================================
//  apps/backend/src/modules/characters/characters.module.ts
// ============================================================

import { Module } from '@nestjs/common'
import { HttpModule } from '@nestjs/axios'
import { MulterModule } from '@nestjs/platform-express'
import { CharactersController } from './characters.controller'
import { CharactersService } from './characters.service'

@Module({
  imports: [
    HttpModule,                         // für AI-Worker-Kommunikation
    MulterModule.register({
      dest: process.env.UPLOAD_PATH || './storage/uploads',
      limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
    }),
  ],
  controllers: [CharactersController],
  providers: [CharactersService],
  exports: [CharactersService],
})
export class CharactersModule {}

// ============================================================
//  apps/backend/src/modules/characters/characters.controller.ts
// ============================================================

import {
  Controller, Get, Post, Put, Delete, Patch,
  Body, Param, UseGuards, Request,
  UseInterceptors, UploadedFiles,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { CharactersService } from './characters.service'
import { CreateCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'

@ApiTags('Characters')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('characters')
export class CharactersController {
  constructor(private readonly service: CharactersService) {}

  // GET /characters — Alle Charaktere des Users
  @Get()
  findAll(@Request() req) {
    return this.service.findAll(req.user.id)
  }

  // GET /characters/:id — Einzelner Charakter mit Profil
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user.id)
  }

  // POST /characters — Neuen Charakter erstellen
  @Post()
  create(@Body() dto: CreateCharacterDto, @Request() req) {
    return this.service.create(dto, req.user.id)
  }

  // POST /characters/upload — Bilder hochladen & DNA analysieren
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FilesInterceptor('images', 10))
  async uploadAndAnalyze(
    @UploadedFiles() files: Express.Multer.File[],
    @Body() dto: CreateCharacterDto,
    @Request() req,
  ) {
    return this.service.uploadAndAnalyze(files, dto, req.user.id)
  }

  // PUT /characters/:id — Charakter aktualisieren
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCharacterDto, @Request() req) {
    return this.service.update(id, dto, req.user.id)
  }

  // PATCH /characters/:id/lock — Character Lock umschalten
  @Patch(':id/lock')
  toggleLock(@Param('id') id: string, @Request() req) {
    return this.service.toggleLock(id, req.user.id)
  }

  // DELETE /characters/:id
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user.id)
  }

  // GET /characters/:id/embeddings — Embedding-Übersicht
  @Get(':id/embeddings')
  getEmbeddings(@Param('id') id: string, @Request() req) {
    return this.service.getEmbeddings(id, req.user.id)
  }
}

// ============================================================
//  apps/backend/src/modules/characters/characters.service.ts
// ============================================================

import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common'
import { HttpService } from '@nestjs/axios'
import { ConfigService } from '@nestjs/config'
import { firstValueFrom } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateCharacterDto } from './dto/create-character.dto'
import { UpdateCharacterDto } from './dto/update-character.dto'

@Injectable()
export class CharactersService {
  private readonly aiWorkerUrl: string

  constructor(
    private prisma: PrismaService,
    private http: HttpService,
    private config: ConfigService,
  ) {
    this.aiWorkerUrl = this.config.get('AI_WORKER_URL', 'http://localhost:8000')
  }

  async findAll(userId: string) {
    return this.prisma.character.findMany({
      where: { userId },
      include: { profile: true, _count: { select: { generations: true } } },
      orderBy: { updatedAt: 'desc' },
    })
  }

  async findOne(id: string, userId: string) {
    const character = await this.prisma.character.findFirst({
      where: { id, userId },
      include: {
        profile: true,
        embeddings: true,
        voiceProfile: true,
      },
    })
    if (!character) throw new NotFoundException('Charakter nicht gefunden')
    return character
  }

  async create(dto: CreateCharacterDto, userId: string) {
    return this.prisma.character.create({
      data: { ...dto, userId },
      include: { profile: true },
    })
  }

  async uploadAndAnalyze(
    files: Express.Multer.File[],
    dto: CreateCharacterDto,
    userId: string,
  ) {
    // 1. Charakter in DB anlegen
    const character = await this.create(dto, userId)

    // 2. Bilder-Pfade speichern
    const imagePaths = files.map((f) => f.path)
    await this.prisma.character.update({
      where: { id: character.id },
      data: { referenceImages: imagePaths },
    })

    // 3. AI Worker: Character DNA analysieren
    const { data: dnaResult } = await firstValueFrom(
      this.http.post(`${this.aiWorkerUrl}/analyze-character`, {
        characterId: character.id,
        imagePaths,
      }),
    )

    // 4. Profil in DB speichern
    await this.prisma.characterProfile.create({
      data: {
        characterId: character.id,
        ...dnaResult.profile,
      },
    })

    // 5. Embeddings in DB registrieren (Vektoren liegen in Qdrant)
    if (dnaResult.embeddings?.length) {
      await this.prisma.characterEmbedding.createMany({
        data: dnaResult.embeddings.map((e: any) => ({
          characterId: character.id,
          type: e.type,
          qdrantId: e.qdrantId,
          qdrantCollection: e.collection,
          dimensions: e.dimensions,
          modelUsed: e.model,
          score: e.score,
        })),
      })
    }

    return this.findOne(character.id, userId)
  }

  async update(id: string, dto: UpdateCharacterDto, userId: string) {
    await this.findOne(id, userId)
    return this.prisma.character.update({
      where: { id },
      data: dto,
      include: { profile: true },
    })
  }

  async toggleLock(id: string, userId: string) {
    const character = await this.findOne(id, userId)
    const updated = await this.prisma.character.update({
      where: { id },
      data: { isLocked: !character.isLocked },
    })
    return {
      id: updated.id,
      isLocked: updated.isLocked,
      message: updated.isLocked
        ? '🔒 Character Lock aktiviert — Konsistenz wird erzwungen'
        : '🔓 Character Lock deaktiviert',
    }
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId)
    await this.prisma.character.delete({ where: { id } })
    return { message: 'Charakter gelöscht' }
  }

  async getEmbeddings(id: string, userId: string) {
    await this.findOne(id, userId)
    return this.prisma.characterEmbedding.findMany({ where: { characterId: id } })
  }
}

// ============================================================
//  apps/backend/src/modules/characters/dto/create-character.dto.ts
// ============================================================

import { IsString, IsOptional, IsInt, IsArray, IsBoolean, Min, Max } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateCharacterDto {
  @ApiProperty({ example: 'Mika' })
  @IsString()
  name: string

  @ApiPropertyOptional({ example: 'Eine orange-weiße Katze mit Blumenschal' })
  @IsOptional()
  @IsString()
  description?: string

  @ApiPropertyOptional({ example: 'Katze' })
  @IsOptional()
  @IsString()
  species?: string

  @ApiPropertyOptional({ example: 'weiblich' })
  @IsOptional()
  @IsString()
  gender?: string

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1000)
  age?: number

  @ApiPropertyOptional({ example: 'Realistisch-animiert' })
  @IsOptional()
  @IsString()
  style?: string

  @ApiPropertyOptional({ example: ['katze', 'bäckerei'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[]
}

export class UpdateCharacterDto extends CreateCharacterDto {
  @IsOptional()
  @IsBoolean()
  isPublic?: boolean
}
