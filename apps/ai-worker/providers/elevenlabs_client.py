# ============================================================
#  apps/ai-worker/providers/elevenlabs_client.py
#  Cloud-Modus: Voice Cloning & TTS über ElevenLabs statt
#  lokal gehostetem XTTS-v2 (spart ~2GB Modell + GPU-Inferenz).
#
#  Voraussetzung: ELEVENLABS_API_KEY in .env
# ============================================================

import os
import logging
import httpx

logger = logging.getLogger("elevenlabs_client")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY", "")
ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1"


class ElevenLabsClient:
    def __init__(self):
        if not ELEVENLABS_API_KEY:
            logger.warning("⚠ ELEVENLABS_API_KEY nicht gesetzt — Cloud-Voice wird fehlschlagen")
        self.headers = {"xi-api-key": ELEVENLABS_API_KEY}

    async def clone_voice(self, name: str, audio_path: str) -> str:
        """Erstellt ein Instant-Voice-Clone-Profil, gibt die voice_id zurück."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            with open(audio_path, "rb") as f:
                res = await client.post(
                    f"{ELEVENLABS_API_URL}/voices/add",
                    headers=self.headers,
                    data={"name": name},
                    files={"files": (os.path.basename(audio_path), f, "audio/wav")},
                )
            if res.status_code != 200:
                raise RuntimeError(f"ElevenLabs Clone-Fehler ({res.status_code}): {res.text}")
            return res.json()["voice_id"]

    async def synthesize(self, voice_id: str, text: str, output_path: str) -> str:
        async with httpx.AsyncClient(timeout=60.0) as client:
            res = await client.post(
                f"{ELEVENLABS_API_URL}/text-to-speech/{voice_id}",
                headers={**self.headers, "Content-Type": "application/json"},
                json={
                    "text": text,
                    "model_id": "eleven_multilingual_v2",
                    "voice_settings": {"stability": 0.5, "similarity_boost": 0.8},
                },
            )
            if res.status_code != 200:
                raise RuntimeError(f"ElevenLabs TTS-Fehler ({res.status_code}): {res.text}")
            with open(output_path, "wb") as f:
                f.write(res.content)
            return output_path


_client: ElevenLabsClient | None = None

def get_elevenlabs_client() -> ElevenLabsClient:
    global _client
    if _client is None:
        _client = ElevenLabsClient()
    return _client
