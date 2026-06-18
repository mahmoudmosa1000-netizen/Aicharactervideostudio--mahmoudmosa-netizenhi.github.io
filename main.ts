// ============================================================
//  AI Character Video Studio Pro
//  apps/backend/src/main.ts — App Entry Point
// ============================================================

import { NestFactory } from '@nestjs/core'
import { ValidationPipe, Logger } from '@nestjs/common'
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger'
import { IoAdapter } from '@nestjs/platform-socket.io'
import { AppModule } from './app.module'

async function bootstrap() {
  const logger = new Logger('Bootstrap')
  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  })

  // ── CORS ───────────────────────────────────────────────────
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })

  // ── Global Validation Pipe ─────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  )

  // ── WebSocket Adapter ──────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app))

  // ── API Prefix ─────────────────────────────────────────────
  app.setGlobalPrefix('api/v1')

  // ── Swagger Dokumentation ──────────────────────────────────
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('AI Character Video Studio Pro')
      .setDescription('REST API für KI-Video-Generierung mit Character Consistency')
      .setVersion('1.0')
      .addBearerAuth()
      .build()
    const document = SwaggerModule.createDocument(app, config)
    SwaggerModule.setup('api/docs', app, document)
    logger.log('📋 Swagger verfügbar: http://localhost:3001/api/docs')
  }

  // ── Start ──────────────────────────────────────────────────
  const port = process.env.PORT || 3001
  await app.listen(port)
  logger.log(`🚀 Backend läuft auf: http://localhost:${port}/api/v1`)
}

bootstrap()
