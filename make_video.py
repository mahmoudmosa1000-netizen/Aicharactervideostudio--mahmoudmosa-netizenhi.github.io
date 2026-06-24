#!/usr/bin/env python3
# ============================================================
#  make_video.py
#  Ein einfaches Werkzeug: Thema eingeben → fertiges
#  TikTok/Reels-Video herauskommen. Komplett KI-generiert
#  (Bilder, Stimme, Text) — kein eigenes Material nötig.
#
#  Nutzung:
#    python make_video.py "5 Tipps für besseren Schlaf"
#
#  Braucht 2 API-Keys (siehe .env.example):
#    - ANTHROPIC_API_KEY  → schreibt das Skript
#    - REPLICATE_API_TOKEN → generiert die Bilder
#  Optional:
#    - ELEVENLABS_API_KEY → Sprachausgabe (ohne Key: stummes Video)
# ============================================================

import os
import sys
import json
import uuid
import base64
import argparse
import subprocess
import tempfile
from pathlib import Path

import httpx
from dotenv import load_dotenv

load_dotenv()

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")  # "Rachel", Standard-Stimme

VIDEO_WIDTH = 1080
VIDEO_HEIGHT = 1920  # 9:16 — TikTok/Reels/Shorts-Format


# ============================================================
#  SCHRITT 1: Claude schreibt das Skript
# ============================================================

def generate_script(topic: str, num_scenes: int) -> list[dict]:
    print(f"✍️  Schreibe Skript für: '{topic}' ({num_scenes} Szenen)...")

    system_prompt = (
        "Du bist ein erfahrener Social-Media-Texter für TikTok/Reels. "
        "Antworte NUR mit validem JSON, ohne Markdown-Backticks, ohne Erklärungen."
    )
    user_prompt = f"""Erstelle ein kurzes, einprägsames Skript für ein vertikales Social-Media-Video.

Thema: "{topic}"
Anzahl Szenen: {num_scenes}

Jede Szene braucht:
- caption: Kurzer Text, der GROSS im Video eingeblendet wird (max. 8 Wörter, knackig)
- narration: Was gesprochen wird (1-2 Sätze, natürlicher Sprachfluss)
- image_prompt: Englische Bildbeschreibung für KI-Bildgenerierung (visuell, konkret)

Antworte mit exakt diesem JSON-Format:
{{
  "title": "Video-Titel",
  "scenes": [
    {{"caption": "...", "narration": "...", "image_prompt": "..."}}
  ]
}}"""

    res = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-6",
            "max_tokens": 2048,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_prompt}],
        },
        timeout=60.0,
    )
    res.raise_for_status()
    text = "".join(b["text"] for b in res.json()["content"] if b["type"] == "text")
    text = text.strip()
    if text.startswith("```"):
        text = text.split("```")[1].removeprefix("json").strip()

    data = json.loads(text)
    print(f"✅ Skript fertig: \"{data['title']}\" ({len(data['scenes'])} Szenen)")
    return data["scenes"]


# ============================================================
#  SCHRITT 2: Bild pro Szene generieren (Replicate / FLUX)
# ============================================================

def generate_image(prompt: str, output_path: str):
    print(f"   🎨 Bild: {prompt[:60]}...")

    res = httpx.post(
        "https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions",
        headers={
            "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
            "Content-Type": "application/json",
            "Prefer": "wait=60",
        },
        json={"input": {
            "prompt": prompt,
            "aspect_ratio": "9:16",
            "output_format": "png",
        }},
        timeout=90.0,
    )
    res.raise_for_status()
    prediction = res.json()

    output_url = prediction["output"]
    if isinstance(output_url, list):
        output_url = output_url[0]

    img_res = httpx.get(output_url, timeout=60.0)
    img_res.raise_for_status()
    Path(output_path).write_bytes(img_res.content)


# ============================================================
#  SCHRITT 3: Sprachausgabe pro Szene (ElevenLabs, optional)
# ============================================================

def generate_voiceover(text: str, output_path: str) -> bool:
    if not ELEVENLABS_API_KEY:
        return False

    print(f"   🔊 Stimme: {text[:50]}...")
    res = httpx.post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}",
        headers={"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"},
        json={
            "text": text,
            "model_id": "eleven_multilingual_v2",
            "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
        },
        timeout=60.0,
    )
    res.raise_for_status()
    Path(output_path).write_bytes(res.content)
    return True


# ============================================================
#  SCHRITT 4: Alles zu einem Video zusammenfügen (FFmpeg)
# ============================================================

def get_audio_duration(audio_path: str) -> float:
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", audio_path],
        capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def build_scene_clip(image_path: str, audio_path: str | None, caption: str,
                      duration: float, output_path: str):
    """Ein Bild + Ken-Burns-Zoom + eingeblendete Caption + (optionale) Stimme → ein Szenen-Clip."""
    fps = 30
    total_frames = int(duration * fps)

    # Caption: GROSS, weiß mit schwarzem Rand, im unteren Drittel — klassischer Social-Media-Stil
    safe_caption = caption.replace("'", "\u2019").replace(":", "\\:")
    drawtext = (
        f"drawtext=text='{safe_caption}':fontcolor=white:fontsize=64:"
        f"borderw=4:bordercolor=black:font='DejaVu Sans Bold':"
        f"x=(w-text_w)/2:y=h*0.72:line_spacing=10"
    )
    zoompan = f"zoom='min(zoom+0.0012,1.12)':d={total_frames}:s={VIDEO_WIDTH}x{VIDEO_HEIGHT}:fps={fps}"

    cmd = [
        "ffmpeg", "-y", "-loop", "1", "-i", image_path,
    ]
    if audio_path:
        cmd += ["-i", audio_path]
    cmd += [
        "-vf", f"scale={VIDEO_WIDTH*2}:{VIDEO_HEIGHT*2},zoompan={zoompan},{drawtext}",
        "-t", str(duration),
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
    ]
    if audio_path:
        cmd += ["-c:a", "aac", "-shortest"]
    cmd += [output_path]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg-Fehler bei Szenen-Clip: {result.stderr[-500:]}")


def concat_clips(clip_paths: list[str], output_path: str):
    with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False) as f:
        for p in clip_paths:
            f.write(f"file '{os.path.abspath(p)}'\n")
        list_file = f.name

    cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_file,
           "-c", "copy", output_path]
    result = subprocess.run(cmd, capture_output=True, text=True)
    os.unlink(list_file)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg-Fehler beim Zusammenfügen: {result.stderr[-500:]}")


# ============================================================
#  HAUPTABLAUF
# ============================================================

def main():
    parser = argparse.ArgumentParser(description="Erstellt ein TikTok/Reels-Video aus einer Idee.")
    parser.add_argument("topic", help="Worum geht's im Video? z.B. '5 Tipps für besseren Schlaf'")
    parser.add_argument("--scenes", type=int, default=5, help="Anzahl Szenen (Standard: 5)")
    parser.add_argument("--output", default="output.mp4", help="Ausgabedatei (Standard: output.mp4)")
    args = parser.parse_args()

    if not ANTHROPIC_API_KEY or not REPLICATE_API_TOKEN:
        print("❌ Fehlende API-Keys. Kopiere .env.example zu .env und trage sie ein.")
        sys.exit(1)

    with tempfile.TemporaryDirectory() as tmp:
        scenes = generate_script(args.topic, args.scenes)

        clip_paths = []
        for i, scene in enumerate(scenes):
            print(f"\n📍 Szene {i+1}/{len(scenes)}: {scene['caption']}")

            image_path = os.path.join(tmp, f"scene_{i}.png")
            generate_image(scene["image_prompt"], image_path)

            audio_path = os.path.join(tmp, f"scene_{i}.mp3")
            has_audio = generate_voiceover(scene["narration"], audio_path)

            duration = get_audio_duration(audio_path) + 0.5 if has_audio else 3.0

            clip_path = os.path.join(tmp, f"clip_{i}.mp4")
            build_scene_clip(
                image_path, audio_path if has_audio else None,
                scene["caption"], duration, clip_path,
            )
            clip_paths.append(clip_path)

        print(f"\n🎬 Füge {len(clip_paths)} Szenen zusammen...")
        concat_clips(clip_paths, args.output)

    print(f"\n✅ Fertig! Video gespeichert: {args.output}")
    print(f"   Format: {VIDEO_WIDTH}x{VIDEO_HEIGHT} (9:16) — bereit für TikTok/Reels/Shorts")


if __name__ == "__main__":
    main()
