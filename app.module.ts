// ============================================================
//  apps/backend/src/app.module.ts — Root Module
// ============================================================

import { Module } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { BullModule } from '@nestjs/bullmq'
import { PrismaModule } from './prisma/prisma.module'
import { AuthModule } from './modules/auth/auth.module'
import { CharactersModule } from './modules/characters/characters.module'
import { StoriesModule } from './modules/stories/stories.module'
import { VideosModule } from './modules/videos/videos.module'
import { RenderModule } from './modules/render/render.module'
import { VoiceModule } from './modules/voice/voice.module'
import { RenderGateway } from './gateways/render.gateway'

@Module({
  imports: [
    // ── Konfiguration ─────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

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
    AuthModule,
    CharactersModule,
    StoriesModule,
    VideosModule,
    RenderModule,
    VoiceModule,
  ],
  providers: [
    // WebSocket Gateway für Render-Live-Status
    RenderGateway,
  ],
})
export class AppModule {}
