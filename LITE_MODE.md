# Lite-Modus — $0 laufende Kosten, normale Gaming-GPU

## Voraussetzung

Eine GPU mit **mindestens 8GB VRAM** (z.B. RTX 3060, RTX 4060, RTX 4070 oder besser). Ohne jede GPU funktioniert nur die Story-Generierung (Ollama läuft auf CPU) und die Video-Erstellung (Ken-Burns-Effekt braucht nur FFmpeg) — Bildgenerierung (FLUX.1-schnell) braucht zwingend eine GPU.

## Setup

```bash
cp .env.lite.example .env
docker compose -f docker-compose.lite.yml up --build -d

# Einmalig: Modelle ziehen
docker exec -it studio-ollama ollama pull llama3.2
docker exec -it studio-ai-worker python -m piper.download_voices de_DE-thorsten-medium
```

Prüfen:
```bash
curl http://localhost:8000/health
# → {"status": "ok", "provider_mode": "lite", ...}
```

## Was du bekommst — und was nicht

| Funktion | Lite-Modus | Unterschied zu local/cloud |
|---|---|---|
| Bildgenerierung | FLUX.1-schnell, 4 Schritte | Schneller, aber etwas weniger Detail als FLUX.1-Dev |
| Charakter-Konsistenz | img2img mit Referenzbild (strength=0.6) | Schwächer als PuLID/InstantID — Ähnlichkeit, keine Pixeltreue |
| Video | **Ken-Burns-Pan/Zoom per FFmpeg** | **Keine gelernte Bewegung** — das Bild bewegt sich nicht selbst, die Kamera "fährt" nur darüber |
| Story | Ollama (Llama 3.2 3B lokal) | Etwas einfachere Sprache als Claude/Qwen3-8B, aber funktional |
| Voice | Piper TTS | **Kein Voice-Cloning** — immer eine der Standardstimmen |
| Charakter-Analyse | Farbextraktion (PIL/NumPy) | Kein "Verständnis" des Bildes — nur dominante Farben, keine Embeddings |

## Die ehrlichste Aussage zu diesem Modus

Das ist ein **echter Kompromiss**, kein Trick. Der größte Unterschied zu allem anderen: **Videos bewegen sich nicht wirklich** — es ist ein Standbild mit Kamerafahrt drüber, keine von einer KI generierte Bewegung. Das ist die Grenze dessen, was auf einer normalen Gaming-GPU für $0 laufende Kosten machbar ist.

Wenn du eine RTX 4070/4080 oder besser hast, kannst du `LITE_VIDEO_METHOD=animatediff` probieren (AnimateDiff-Lightning) für echte, aber einfache Bewegung — das ist als experimentelles Upgrade im Code vorhanden, aber nicht so getestet wie der Ken-Burns-Standardpfad.

## Modell-Größe nach VRAM anpassen

```bash
# 8GB VRAM (Minimum):
OLLAMA_MODEL=llama3.2          # 3B

# 12GB+ VRAM:
OLLAMA_MODEL=qwen2.5:7b        # bessere Sprachqualität

# Ollama-Modell wechseln:
docker exec -it studio-ollama ollama pull qwen2.5:7b
# dann OLLAMA_MODEL in .env anpassen und ai-worker neu starten
```

## Alle drei Modi im Vergleich

| | `local` | `cloud` | `lite` |
|---|---|---|---|
| Hardware | RTX 4090+ (24GB+ VRAM) | Keine GPU nötig | Gaming-GPU (8GB+) |
| Laufende Kosten | $0 (nur Strom) | ~$1,50–2,50 / Video | $0 (nur Strom) |
| Video-Qualität | Beste (Wan 2.2) | Gut (gehostete Modelle) | Eingeschränkt (Ken-Burns) |
| Charakter-Konsistenz | Beste (PuLID/InstantID) | Mittel | Schwächer (img2img) |
| Voice-Cloning | Ja (XTTS-v2) | Ja (ElevenLabs) | **Nein** (Piper) |
| Setup-Aufwand | Hoch (80-150GB Downloads) | Niedrig (nur API-Keys) | Mittel (Ollama + Piper-Stimme) |
