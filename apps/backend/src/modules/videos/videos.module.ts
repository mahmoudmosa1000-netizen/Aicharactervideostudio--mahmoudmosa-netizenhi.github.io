// ============================================================
//  apps/backend/src/modules/videos/videos.module.ts
// ============================================================

import { Module } from '@nestjs/common'
import { VideosController } from './videos.controller'
import { VideosService } from './videos.service'

@Module({
  controllers: [VideosController],
  providers: [VideosService],
  exports: [VideosService],
})
export class VideosModule {}

// ============================================================
//  apps/backend/src/modules/videos/videos.controller.ts
// ============================================================

import { Controller, Get, Delete, Param, Query, UseGuards, Request } from '@nestjs/common'
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard'
import { VideosService } from './videos.service'

@ApiTags('Videos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('videos')
export class VideosController {
  constructor(private readonly service: VideosService) {}

  // GET /videos/history
  @Get('history')
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'status', required: false })
  getHistory(@Request() req, @Query() query: any) {
    return this.service.getHistory(req.user.id, query)
  }

  // GET /videos/:id
  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    return this.service.findOne(id, req.user.id)
  }

  // GET /videos/:id/versions
  @Get(':id/versions')
  getVersions(@Param('id') id: string, @Request() req) {
    return this.service.getVersions(id, req.user.id)
  }

  // DELETE /videos/:id
  @Delete(':id')
  remove(@Param('id') id: string, @Request() req) {
    return this.service.remove(id, req.user.id)
  }
}

// ============================================================
//  apps/backend/src/modules/videos/videos.service.ts
// ============================================================

import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

@Injectable()
export class VideosService {
  constructor(private prisma: PrismaService) {}

  async getHistory(userId: string, query: { page?: number; limit?: number; status?: string }) {
    const page = Number(query.page) || 1
    const limit = Number(query.limit) || 20
    const skip = (page - 1) * limit

    const where: any = { userId }
    if (query.status) where.status = query.status

    const [videos, total] = await Promise.all([
      this.prisma.video.findMany({
        where,
        include: {
          scene: { select: { title: true, order: true } },
          story: { select: { title: true } },
          renderJobs: { orderBy: { createdAt: 'desc' }, take: 1 },
          _count: { select: { versions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.video.count({ where }),
    ])

    return {
      data: videos,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    }
  }

  async findOne(id: string, userId: string) {
    const video = await this.prisma.video.findFirst({
      where: { id, userId },
      include: {
        versions: { orderBy: { version: 'desc' } },
        renderJobs: { orderBy: { createdAt: 'desc' } },
        scene: true,
        story: true,
      },
    })
    if (!video) throw new NotFoundException('Video nicht gefunden')
    return video
  }

  async getVersions(id: string, userId: string) {
    await this.findOne(id, userId)
    return this.prisma.videoVersion.findMany({
      where: { videoId: id },
      orderBy: { version: 'desc' },
    })
  }

  async remove(id: string, userId: string) {
    await this.findOne(id, userId)
    await this.prisma.video.delete({ where: { id } })
    return { message: 'Video gelöscht' }
  }
}
