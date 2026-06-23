// ============================================================
//  apps/backend/src/app.module.ts — Root Module
// ============================================================

import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { ServeStaticModule } from '@nestjs/serve-static'
import { join } from 'path'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { CharactersModule } from './modules/characters/characters.module'
import { StoriesModule } from './modules/stories/stories.module'
import { VideosModule } from './modules/videos/videos.module'
import { RenderModule } from './modules/render/render.module'
import { VoiceModule } from './modules/voice/voice.module'
import { ExportModule } from './common/export/export.module'

@Module({
  imports: [
    // ── Konfiguration ─────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ── Statische Dateien — Referenzbilder & generierte Medien ──
    // Macht die von AI-Worker erzeugten Bilder/Videos im Browser
    // abrufbar unter /media/uploads/... bzw. /media/outputs/...
    // WICHTIG: Diese Pfade müssen mit UPLOAD_PATH / OUTPUT_PATH
    // aus .env übereinstimmen (im Docker-Setup: /uploads, /outputs).
    ServeStaticModule.forRoot(
      {
        rootPath: process.env.UPLOAD_PATH || join(__dirname, '..', 'storage', 'uploads'),
        serveRoot: '/media/uploads',
      },
      {
        rootPath: process.env.OUTPUT_PATH || join(__dirname, '..', 'storage', 'outputs'),
        serveRoot: '/media/outputs',
      },
    ),

    // ── BullMQ — Job Queue über Redis ─────────────────────────
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          url: config.get('REDIS_URL'),
        },
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
        },
      }),
    }),

    // ── Datenbank ─────────────────────────────────────────────
    PrismaModule,

    // ── Feature Module ────────────────────────────────────────
    // RenderModule registriert auch den RenderGateway (WebSocket) —
    // bewusst NUR dort, damit es genau eine Gateway-Instanz im
    // gesamten Prozess gibt (sonst landen Events im falschen Socket-Server).
    AuthModule,
    CharactersModule,
    StoriesModule,
    VideosModule,
    RenderModule,
    VoiceModule,
    ExportModule,
  ],
})
export class AppModule {}
