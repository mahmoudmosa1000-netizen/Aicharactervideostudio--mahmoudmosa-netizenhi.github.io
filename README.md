# TikTok/Reels Video Maker

Ein einziges Skript: Thema eingeben → fertiges, vertikales Social-Media-Video mit KI-Bildern, Stimme und eingeblendeten Captions.

## Setup (einmalig, ~5 Minuten)

```bash
# 1. FFmpeg installieren (falls noch nicht vorhanden)
# macOS:   brew install ffmpeg
# Ubuntu:  sudo apt install ffmpeg
# Windows: https://ffmpeg.org/download.html

# 2. Python-Pakete installieren
pip install -r requirements.txt

# 3. API-Keys eintragen
cp .env.example .env
# .env öffnen und die 2 Pflicht-Keys eintragen (Anthropic, Replicate)
```

## Nutzung

```bash
python make_video.py "5 Tipps für besseren Schlaf"
```

Mit mehr Kontrolle:

```bash
python make_video.py "Warum Katzen schnurren" --scenes 7 --output katzen.mp4
```

Nach 1-3 Minuten liegt ein fertiges `output.mp4` im aktuellen Ordner — 1080×1920, bereit zum Hochladen.

## Was passiert dabei

1. **Claude** schreibt ein kurzes Skript: pro Szene ein Caption-Text, ein gesprochener Satz, eine Bildbeschreibung
2. **FLUX.1-schnell** (über Replicate) generiert ein Bild pro Szene
3. **ElevenLabs** (falls Key vorhanden) spricht den Text ein
4. **FFmpeg** baut daraus: Ken-Burns-Zoom-Effekt + eingeblendete Caption + Sprachausgabe, alle Szenen aneinandergehängt

## Kosten pro Video

Bei 5 Szenen: ungefähr $0,10–0,30 (Replicate-Bilder + ein bisschen Claude-API). Ohne ElevenLabs-Key: noch günstiger, dafür stumm — dann z.B. in CapCut/InShot eigene Musik drüberlegen.

## Anpassen

Alles steckt in der einen Datei `make_video.py`:
- **Caption-Stil** (Schriftgröße, Position, Farbe) → Funktion `build_scene_clip()`, Variable `drawtext`
- **Bildstil** → in `generate_script()` den Prompt anpassen, z.B. "im Comic-Stil" oder "fotorealistisch" ergänzen
- **Anderes Bildmodell** → in `generate_image()` die Modell-URL ändern (z.B. zu `black-forest-labs/flux-dev` für mehr Qualität, aber langsamer/teurer)
- **Zoom-Geschwindigkeit** → Variable `zoompan` in `build_scene_clip()`

## Wenn etwas nicht funktioniert

- **"Fehlende API-Keys"** → `.env` Datei prüfen, sind die Keys ohne Anführungszeichen eingetragen?
- **FFmpeg-Fehler mit "DejaVu Sans Bold"** → diese Schrift ist auf deinem System nicht installiert. In `build_scene_clip()` den `font=`-Teil in `drawtext` entfernen (nutzt dann die FFmpeg-Standardschrift)
- **Bild wird nicht generiert** → Replicate-Account hat eventuell kein Guthaben — auf replicate.com im Dashboard prüfen
