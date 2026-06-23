# ============================================================
#  apps/ai-worker/providers/replicate_client.py
#  Cloud-Modus: Gehostete Modelle über Replicate statt lokaler
#  GPU-Inferenz. Löst das Kern-Problem "Webseite erstellt keine
#  Videos" für Setups ohne dedizierte Enterprise-GPU.
#
#  Voraussetzung: REPLICATE_API_TOKEN in .env
#  Kosten: Pay-per-use, keine eigene GPU nötig.
# ============================================================

import os
import logging
import httpx

logger = logging.getLogger("replicate_client")

REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
REPLICATE_API_URL = "https://api.replicate.com/v1"

# ── Modell-Referenzen ─────────────────────────────────────────
# WICHTIG: Replicate-Modell-Versionen ändern sich. Diese Slugs
# sind Stand der Implementierung — bei Fehlern auf replicate.com
# nach aktueller Version des jeweiligen Modells suchen und hier
# austauschen.
MODELS = {
    "image": "black-forest-labs/flux-dev",
    "image_with_character": "black-forest-labs/flux-dev-lora",  # unterstützt Referenzbild-Konditionierung
    "video_img2vid": "wavespeedai/wan-2.1-i2v-480p",             # Bild→Video, breit verfügbar auf Replicate
    "video_img2vid_hq": "kwaivgi/kling-v1.6-standard",           # höhere Qualität, Alternative
    "voice_clone": "lucataco/xtts-v2",                            # Voice Cloning + TTS
}


class ReplicateClient:
    """Dünner Wrapper um die Replicate REST-API (async, polling-basiert)."""

    def __init__(self):
        if not REPLICATE_API_TOKEN:
            logger.warning("⚠ REPLICATE_API_TOKEN nicht gesetzt — Cloud-Modus wird fehlschlagen")
        self.headers = {
            "Authorization": f"Bearer {REPLICATE_API_TOKEN}",
            "Content-Type": "application/json",
            "Prefer": "wait=60",  # Bis zu 60s synchron warten, sonst Polling
        }

    async def run(self, model_slug: str, input_payload: dict, timeout: float = 300.0) -> dict:
        """
        Startet eine Prediction und pollt bis zum Abschluss.
        Gibt die rohe Replicate-Response zurück (output enthält i.d.R. eine URL).
        """
        async with httpx.AsyncClient(timeout=timeout) as client:
            create_res = await client.post(
                f"{REPLICATE_API_URL}/models/{model_slug}/predictions",
                headers=self.headers,
                json={"input": input_payload},
            )
            if create_res.status_code not in (200, 201):
                raise RuntimeError(f"Replicate-Fehler ({create_res.status_code}): {create_res.text}")

            prediction = create_res.json()
            prediction_id = prediction["id"]

            # Falls "Prefer: wait" nicht reichte → pollen
            status = prediction.get("status")
            poll_url = prediction["urls"]["get"]
            elapsed = 0.0
            while status not in ("succeeded", "failed", "canceled"):
                await self._sleep(2.0)
                elapsed += 2.0
                if elapsed > timeout:
                    raise TimeoutError(f"Replicate-Prediction {prediction_id} hat Timeout überschritten")
                poll_res = await client.get(poll_url, headers=self.headers)
                prediction = poll_res.json()
                status = prediction.get("status")

            if status == "failed":
                raise RuntimeError(f"Replicate-Prediction fehlgeschlagen: {prediction.get('error')}")

            return prediction

    async def _sleep(self, seconds: float):
        import asyncio
        await asyncio.sleep(seconds)

    async def download_output(self, url: str, dest_path: str) -> str:
        """Lädt die Ergebnisdatei (Bild/Video/Audio-URL) lokal herunter."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.get(url)
            res.raise_for_status()
            with open(dest_path, "wb") as f:
                f.write(res.content)
        return dest_path


# ── Singleton ────────────────────────────────────────────────
_client: ReplicateClient | None = None

def get_replicate_client() -> ReplicateClient:
    global _client
    if _client is None:
        _client = ReplicateClient()
    return _client
