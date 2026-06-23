// ============================================================
//  AI Character Video Studio Pro — seed.ts
//  Demo-Daten für Entwicklung und Tests
// ============================================================

import { PrismaClient, UserRole, EmbeddingType, StoryStatus } from '@prisma/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // ── Admin User ───────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@studio.local' },
    update: {},
    create: {
      email: 'admin@studio.local',
      name: 'Studio Admin',
      passwordHash: adminPassword,
      role: UserRole.ADMIN,
      settings: {
        create: {
          defaultVideoModel: 'wan2.2',
          defaultImageModel: 'flux-dev',
          defaultLlmModel: 'qwen3',
          defaultVoiceModel: 'xtts-v2',
          gpuDevices: ['0'],
          tensorrtEnabled: false,
          language: 'de',
          theme: 'dark',
        },
      },
    },
  })

  // ── Demo Creator User ────────────────────────────────────
  const creatorPassword = await bcrypt.hash('creator123', 12)
  const creator = await prisma.user.upsert({
    where: { email: 'creator@studio.local' },
    update: {},
    create: {
      email: 'creator@studio.local',
      name: 'Demo Creator',
      passwordHash: creatorPassword,
      role: UserRole.CREATOR,
      settings: {
        create: {
          defaultResolution: '1080p',
          defaultFps: 24,
          language: 'de',
        },
      },
    },
  })

  // ── Demo Charakter: Mika die Katze ───────────────────────
  const mikaCharacter = await prisma.character.upsert({
    where: { id: 'demo-char-mika' },
    update: {},
    create: {
      id: 'demo-char-mika',
      userId: creator.id,
      name: 'Mika',
      description: 'Eine orange-weiße Katze mit einem bunten Blumenschal',
      species: 'Katze',
      gender: 'weiblich',
      age: 3,
      style: 'Realistisch-animiert',
      isLocked: true,
      tags: ['katze', 'orange', 'bäckerei', 'protagonist'],
      profile: {
        create: {
          furColor: 'Orange und Weiß',
          eyeColor: 'Bernstein',
          bodyType: 'Klein und rundlich',
          primaryOutfit: {
            accessories: 'Traditioneller Blumenschal in Rosa und Gelb',
          },
          accessories: ['Blumenschal'],
          personality: ['neugierig', 'freundlich', 'fleißig', 'kreativ'],
          backstory: 'Mika träumt davon, die beste Bäckerei im Dorf zu eröffnen.',
          catchPhrase: 'Backen mit Herz!',
          quirks: ['schnurrt beim Backen', 'liebt Zimtschnecken'],
          favoriteObjects: ['Nudelholz', 'Backblech', 'Mehlsack'],
          ipAdapterWeight: 0.85,
        },
      },
    },
  })

  // ── Demo Story ───────────────────────────────────────────
  const demoStory = await prisma.story.create({
    data: {
      userId: creator.id,
      title: 'Mikas Bäckerei',
      logline: 'Eine mutige Katze eröffnet die erste Katzenbäckerei im Dorf.',
      genre: 'Abenteuer / Komödie',
      targetLength: 5,
      status: StoryStatus.READY,
      generationPrompt: 'Eine orange-weiße Katze eröffnet eine Bäckerei',
      llmModel: 'qwen3',
      outline: {
        acts: [
          { act: 1, title: 'Die Idee', scenes: [1, 2] },
          { act: 2, title: 'Der Aufbau', scenes: [3, 4] },
          { act: 3, title: 'Die Eröffnung', scenes: [5] },
        ],
        themes: ['Mut', 'Freundschaft', 'Leidenschaft'],
      },
      scenes: {
        create: [
          {
            order: 1,
            title: 'Der Traum',
            description: 'Mika wacht auf und erzählt ihrer Freundin von ihrer Idee.',
            voiceOverText: 'Heute ist der Tag, an dem alles beginnt!',
            characterPrompt: 'Orange-white cat Mika wearing traditional floral scarf, excited expression',
            scenePrompt: 'Cozy bedroom at sunrise, sunbeams through window',
            cameraPrompt: 'Slow push-in shot, medium to close-up',
            lightingPrompt: 'Warm golden morning light',
            motionPrompt: 'Mika stretching and jumping out of bed happily',
            duration: 6,
            cameraType: 'dolly',
          },
          {
            order: 2,
            title: 'Die Planung',
            description: 'Mika skizziert ihre Bäckereidpläne auf einem großen Papier.',
            voiceOverText: 'Ich brauche Mehl, Zucker und ganz viel Liebe!',
            characterPrompt: 'Orange-white cat Mika wearing floral scarf, focused, drawing plans',
            scenePrompt: 'Cluttered kitchen table with papers and pencils',
            cameraPrompt: 'Top-down crane shot, slowly pulling back',
            lightingPrompt: 'Bright daylight, soft shadows',
            motionPrompt: 'Cat drawing and pointing at sketches',
            duration: 5,
            cameraType: 'crane',
          },
          {
            order: 3,
            title: 'Der erste Versuch',
            description: 'Mika backt ihren ersten Kuchen — mit unerwarteten Ergebnissen.',
            voiceOverText: 'Hmm, das hätte wohl anders aussehen sollen...',
            characterPrompt: 'Orange-white cat Mika with floral scarf, flour on face, surprised',
            scenePrompt: 'Messy bakery kitchen with flour everywhere',
            cameraPrompt: 'Medium shot, slight wide angle',
            lightingPrompt: 'Warm kitchen lighting, steam from oven',
            motionPrompt: 'Cat looking at flat cake, tilting head',
            duration: 7,
            cameraType: 'static',
          },
          {
            order: 4,
            title: 'Der Durchbruch',
            description: 'Nach vielen Versuchen backt Mika das perfekte Croissant.',
            voiceOverText: 'Endlich! Das ist es!',
            characterPrompt: 'Orange-white cat Mika with floral scarf, triumphant smile, holding croissant',
            scenePrompt: 'Organized bakery kitchen, sunrise light, golden croissants on rack',
            cameraPrompt: 'Close-up to medium pull-back with hero lighting',
            lightingPrompt: 'Warm golden hour light through bakery window',
            motionPrompt: 'Cat raises croissant triumphantly, happy dance',
            duration: 6,
            cameraType: 'tracking',
          },
          {
            order: 5,
            title: 'Die Eröffnung',
            description: 'Mikas Bäckerei öffnet ihre Türen — das ganze Dorf ist da.',
            voiceOverText: 'Willkommen in Mikas Bäckerei — hier backen wir mit Herz!',
            characterPrompt: 'Orange-white cat Mika with floral scarf, proud, standing at bakery entrance',
            scenePrompt: 'Charming village bakery exterior, colorful sign, crowd of animals',
            cameraPrompt: 'Wide establishing shot, slowly zooming to Mika',
            lightingPrompt: 'Festive, bright, cheerful daylight',
            motionPrompt: 'Crowd cheering, ribbons cut, door opening',
            duration: 8,
            cameraType: 'dolly',
          },
        ],
      },
    },
  })

  // SceneCharacter-Verbindungen anlegen
  const scenes = await prisma.scene.findMany({ where: { storyId: demoStory.id } })
  for (const scene of scenes) {
    await prisma.sceneCharacter.create({
      data: {
        sceneId: scene.id,
        characterId: mikaCharacter.id,
        role: 'Protagonistin',
        action: scene.description?.split('.')[0] || '',
      },
    })
  }

  // Audit Log
  await prisma.auditLog.create({
    data: {
      userId: admin.id,
      action: 'system.seed',
      entityType: 'System',
      metadata: {
        usersCreated: 2,
        charactersCreated: 1,
        storiesCreated: 1,
        scenesCreated: 5,
      },
    },
  })

  console.log('✅ Seed abgeschlossen!')
  console.log(`   👤 Admin: admin@studio.local / admin123`)
  console.log(`   👤 Creator: creator@studio.local / creator123`)
  console.log(`   🎭 Charakter: Mika (ID: demo-char-mika)`)
  console.log(`   📖 Story: "${demoStory.title}" (${scenes.length} Szenen)`)
}

main()
  .catch((e) => {
    console.error('❌ Seed fehlgeschlagen:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
