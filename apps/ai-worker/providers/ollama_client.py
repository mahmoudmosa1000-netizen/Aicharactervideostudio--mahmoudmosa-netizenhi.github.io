# ============================================================
#  apps/ai-worker/providers/ollama_client.py
#  Lite-Modus: Story-Generierung über Ollama (lokales LLM)
#  statt riesigem Qwen3-8B oder bezahlter Claude-API.
#
#  Läuft auf jeder Hardware — sogar CPU-only, aber spürbar
#  schneller mit einer normalen Gaming-GPU (8GB+).
#
#  Voraussetzung: Ollama-Service läuft (siehe docker-compose.lite.yml)
#  Modell vorher ziehen: docker exec -it studio-ollama ollama pull llama3.2
# ============================================================

import os
import json
import logging
import httpx

logger = logging.getLogger("ollama_client")

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2")


class OllamaClient:
    """
    Schlanker Wrapper um Ollamas /api/chat Endpunkt.
    Nutzt Ollamas natives format='json', das die meisten
    Modelle (Llama 3.2, Qwen2.5, Phi-3) zuverlässig zu validem
    JSON zwingt — ähnlich robust wie die Cloud-Variante.
    """

    def __init__(self):
        self.base_url = OLLAMA_URL
        self.model = OLLAMA_MODEL

    async def generate_json(self, system_prompt: str, user_prompt: str) -> dict:
        async with httpx.AsyncClient(timeout=180.0) as client:
            try:
                res = await client.post(
                    f"{self.base_url}/api/chat",
                    json={
                        "model": self.model,
                        "messages": [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                        ],
                        "format": "json",   # erzwingt JSON-Output (ab Ollama 0.3+)
                        "stream": False,
                        "options": {"temperature": 0.7},
                    },
                )
            except httpx.ConnectError:
                raise RuntimeError(
                    f"Ollama nicht erreichbar unter {self.base_url}. "
                    "Läuft der Ollama-Container? (docker compose -f docker-compose.lite.yml up -d ollama)"
                )

            if res.status_code != 200:
                raise RuntimeError(f"Ollama-Fehler ({res.status_code}): {res.text}")

            data = res.json()
            content = data["message"]["content"]
            return self._parse_json(content)

    def _parse_json(self, text: str) -> dict:
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        try:
            return json.loads(cleaned.strip())
        except json.JSONDecodeError:
            logger.error(f"Ollama-JSON-Parsing fehlgeschlagen: {text[:200]}...")
            raise

    async def is_model_available(self) -> bool:
        """Prüft ob das konfigurierte Modell tatsächlich gezogen wurde."""
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                res = await client.get(f"{self.base_url}/api/tags")
                tags = [m["name"] for m in res.json().get("models", [])]
                return any(self.model in t for t in tags)
            except Exception:
                return False


_client: OllamaClient | None = None

def get_ollama_client() -> OllamaClient:
    global _client
    if _client is None:
        _client = OllamaClient()
    return _client
