# ============================================================
#  apps/ai-worker/providers/piper_client.py
#  Lite-Modus: Sprachsynthese über Piper TTS statt XTTS-v2
#  (spart ~2GB Modell + GPU-VRAM) oder bezahlter ElevenLabs-API.
#
#  WICHTIG — ehrlicher Hinweis: Piper unterstützt KEIN
#  Voice-Cloning. Im Lite-Modus wird daher immer eine der
#  vorinstallierten Stimmen genutzt, unabhängig vom Charakter.
#  Für echtes Cloning bleibt nur 'local' (XTTS-v2) oder
#  'cloud' (ElevenLabs).
#
#  Stimmen-Download (einmalig, ~50-100MB pro Stimme):
#    python -m piper.download_voices de_DE-thorsten-medium
# ============================================================

import os
import logging
import subprocess
from pathlib import Path

logger = logging.getLogger("piper_client")

PIPER_VOICE_DIR = os.getenv("PIPER_VOICE_DIR", "/app/piper_voices")
PIPER_VOICE_DE = os.getenv("PIPER_VOICE_DE", "de_DE-thorsten-medium")
PIPER_VOICE_EN = os.getenv("PIPER_VOICE_EN", "en_US-lessac-medium")


class PiperClient:
    def __init__(self):
        Path(PIPER_VOICE_DIR).mkdir(parents=True, exist_ok=True)

    def _voice_model_path(self, language: str) -> str:
        voice_name = PIPER_VOICE_DE if language.startswith("de") else PIPER_VOICE_EN
        return os.path.join(PIPER_VOICE_DIR, f"{voice_name}.onnx")

    async def synthesize(self, text: str, output_path: str, language: str = "de") -> str:
        model_path = self._voice_model_path(language)

        if not os.path.exists(model_path):
            raise RuntimeError(
                f"Piper-Stimme nicht gefunden: {model_path}\n"
                f"Einmalig herunterladen: docker exec -it studio-ai-worker "
                f"python -m piper.download_voices {os.path.basename(model_path).replace('.onnx', '')}"
            )

        try:
            from piper import PiperVoice
            voice = PiperVoice.load(model_path)
            with open(output_path, "wb") as f:
                voice.synthesize(text, f)
            logger.info(f"✅ Piper-Audio erzeugt: {output_path}")
            return output_path
        except ImportError:
            # Fallback: Piper-CLI direkt aufrufen, falls Python-API nicht verfügbar
            cmd = ["piper", "--model", model_path, "--output_file", output_path]
            result = subprocess.run(cmd, input=text.encode("utf-8"), capture_output=True)
            if result.returncode != 0:
                raise RuntimeError(f"Piper-CLI-Fehler: {result.stderr.decode()}")
            return output_path


_client: PiperClient | None = None

def get_piper_client() -> PiperClient:
    global _client
    if _client is None:
        _client = PiperClient()
    return _client
