# 🎬 AI Character Video Studio

Erstelle KI-Videos mit konsistenten Charakteren — immer dieselbe Figur in jeder Szene.

## Verwendete Sprachen

| Datei/Ordner | Sprache | Zweck |
|---|---|---|
| `*.html` | HTML | Struktur der Webseite |
| `src/styles/*.css` | CSS | Design, Farben, Animationen |
| `src/types/index.ts` | TypeScript | Typdefinitionen |
| `src/components/*.jsx` | JSX (React) | UI-Komponenten |
| `src/lib/*.js` | JavaScript | API-Client, Hilfsfunktionen |
| `backend/server.js` | JavaScript (Node.js) | Webserver |
| `backend/routes/*.js` | JavaScript (Express) | API-Endpunkte |
| `backend/db/schema.sql` | SQL | Datenbankstruktur |
| `package.json` | JSON | Abhängigkeiten & Skripte |
| `.env.example` | ENV | Umgebungsvariablen |

---

## Projektstruktur

```
ai-character-video-studio/
├── frontend/
│   ├── public/
│   │   └── index.html              ← HTML
│   ├── src/
│   │   ├── styles/
│   │   │   ├── variables.css       ← CSS (Design-Tokens)
│   │   │   ├── global.css          ← CSS (Reset & Basis)
│   │   │   └── animations.css      ← CSS (Animationen)
│   │   ├── types/
│   │   │   └── index.ts            ← TypeScript
│   │   ├── lib/
│   │   │   ├── constants.js        ← JavaScript
│   │   │   └── api.js              ← JavaScript (API-Client)
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   │   ├── Button.jsx      ← JSX
│   │   │   │   ├── Card.jsx        ← JSX
│   │   │   │   ├── Input.jsx       ← JSX
│   │   │   │   └── StatusPill.jsx  ← JSX
│   │   │   ├── Sidebar.jsx         ← JSX
│   │   │   ├── Dashboard.jsx       ← JSX
│   │   │   ├── CharacterManager.jsx← JSX
│   │   │   ├── VideoCreator.jsx    ← JSX
│   │   │   ├── StoryCreator.jsx    ← JSX
│   │   │   ├── History.jsx         ← JSX
│   │   │   └── Settings.jsx        ← JSX
│   │   ├── App.jsx                 ← JSX (Routing)
│   │   └── index.js                ← JavaScript (Einstiegspunkt)
│   └── package.json                ← JSON
│
├── backend/
│   ├── db/
│   │   ├── schema.sql              ← SQL
│   │   └── client.js               ← JavaScript (Datenbankverbindung)
│   ├── routes/
│   │   ├── characters.js           ← JavaScript (Express-Route)
│   │   ├── videos.js               ← JavaScript (Express-Route)
│   │   ├── story.js                ← JavaScript (Express-Route)
│   │   └── ai.js                   ← JavaScript (Express-Route)
│   ├── middleware/
│   │   └── auth.js                 ← JavaScript (Middleware)
│   ├── server.js                   ← JavaScript (Node.js Server)
│   └── package.json                ← JSON
│
├── .env.example                    ← ENV
├── .gitignore                      ← Config
└── README.md                       ← Markdown
```

---

## Installation & Start

### Voraussetzungen
- [Node.js](https://nodejs.org/) v18 oder neuer
- [PostgreSQL](https://postgresql.org/) v14+ (für Backend)
- Git

---

### 1. Repository klonen

```bash
git clone https://github.com/DEIN-USERNAME/ai-character-video-studio.git
cd ai-character-video-studio
```

---

### 2. Umgebungsvariablen einrichten

```bash
# Im Hauptordner
cp .env.example .env
# Dann .env öffnen und API-Keys eintragen
```

---

### 3. Frontend starten

```bash
cd frontend
npm install
npm start
# Öffnet sich unter http://localhost:3000
```

---

### 4. Backend starten (optional, für volle Funktionalität)

```bash
# Datenbank anlegen (PostgreSQL muss laufen)
psql -U postgres -c "CREATE DATABASE ai_video_studio;"
psql -U postgres -d ai_video_studio -f backend/db/schema.sql

# Backend-Abhängigkeiten installieren
cd backend
npm install
npm run dev
# Läuft unter http://localhost:5000
```

---

## Auf GitHub Pages / Vercel veröffentlichen

### Option A — Vercel (empfohlen, kostenlos)

```bash
cd frontend
npm run build
npx vercel --prod
```

### Option B — GitHub Pages

```bash
cd frontend
npm install gh-pages --save-dev
# In package.json "homepage": "https://USERNAME.github.io/REPO" eintragen
npm run deploy
```

---

## API-Keys

Alle Keys werden in der `.env`-Datei gespeichert (niemals in Git!):

| Variable | Dienst | Holen unter |
|---|---|---|
| `ANTHROPIC_API_KEY` | Claude KI | console.anthropic.com |
| `KLING_API_KEY` | Kling Video | kling.kuaishou.com |
| `RUNWAY_API_KEY` | Runway Gen-3 | app.runwayml.com |
| `LUMA_API_KEY` | Luma Dream | lumalabs.ai |
| `DATABASE_URL` | PostgreSQL | Lokal oder Neon/Supabase |

---

## Features

- **Character Lock** — Charakter wird in alle Prompts eingebettet
- **Story Generator** — 1 Idee → 5 Szenen (Claude KI)
- **Character Analysis** — KI extrahiert automatisch visuelle Merkmale
- **Multi-Model** — Kling, Runway, Luma unterstützt
- **Export** — MP4, TikTok, Reels, YouTube Shorts
