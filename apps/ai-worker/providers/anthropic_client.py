# ============================================================
#  apps/ai-worker/providers/anthropic_client.py
#  Cloud-Modus: Story-Generierung über die Claude API statt
#  lokal gehosteten Qwen3/DeepSeek/Llama-4-Gewichten.
#
#  Vorteil: Keine 16GB+ LLM-Downloads, kein eigener GPU-VRAM-
#  Bedarf für das LLM, zuverlässiges strukturiertes JSON.
#
#  Voraussetzung: ANTHROPIC_API_KEY in .env
# ============================================================

import os
import json
import logging
import httpx

logger = logging.getLogger("anthropic_client")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-6")


class AnthropicClient:
    """Schlanker Wrapper für strukturierte JSON-Generierung via Claude API."""

    def __init__(self):
        if not ANTHROPIC_API_KEY:
            logger.warning("⚠ ANTHROPIC_API_KEY nicht gesetzt — Cloud-Story-Generierung wird fehlschlagen")
        self.headers = {
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        }

    async def generate_json(
        self, system_prompt: str, user_prompt: str, max_tokens: int = 4096
    ) -> dict:
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(
                ANTHROPIC_API_URL,
                headers=self.headers,
                json={
                    "model": ANTHROPIC_MODEL,
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": [{"role": "user", "content": user_prompt}],
                },
            )
            if res.status_code != 200:
                raise RuntimeError(f"Anthropic-API-Fehler ({res.status_code}): {res.text}")

            data = res.json()
            text = "".join(block["text"] for block in data["content"] if block["type"] == "text")
            return self._parse_json(text)

    async def generate_json_with_image(
        self, system_prompt: str, user_prompt: str, image_base64: str,
        media_type: str = "image/png", max_tokens: int = 1024,
    ) -> dict:
        """Wie generate_json, aber mit Bild-Input — nutzt Claudes Vision-Fähigkeit
        für Character-DNA-Analyse statt lokalem Florence-2/Qwen2.5-VL."""
        async with httpx.AsyncClient(timeout=120.0) as client:
            res = await client.post(
                ANTHROPIC_API_URL,
                headers=self.headers,
                json={
                    "model": ANTHROPIC_MODEL,
                    "max_tokens": max_tokens,
                    "system": system_prompt,
                    "messages": [{
                        "role": "user",
                        "content": [
                            {"type": "image", "source": {
                                "type": "base64", "media_type": media_type, "data": image_base64,
                            }},
                            {"type": "text", "text": user_prompt},
                        ],
                    }],
                },
            )
            if res.status_code != 200:
                raise RuntimeError(f"Anthropic-API-Fehler ({res.status_code}): {res.text}")

            data = res.json()
            text = "".join(block["text"] for block in data["content"] if block["type"] == "text")
            return self._parse_json(text)

    def _parse_json(self, text: str) -> dict:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        try:
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            logger.error(f"JSON-Parsing fehlgeschlagen, Rohtext: {text[:200]}...")
            raise


_client: AnthropicClient | None = None

def get_anthropic_client() -> AnthropicClient:
    global _client
    if _client is None:
        _client = AnthropicClient()
    return _client
