# ============================================================
#  infrastructure/vllm/llm_client.py
#  Dünner Client für die OpenAI-kompatible vLLM/SGLang-API.
#
#  Ersetzt bei Bedarf model_manager.get_llm() in story_gen.py
#  und prompt_builder.py — gleiche Methode, andere Quelle:
#
#    # Vorher (direktes Modell im Prozess):
#    llm_data = self.mm.get_llm(model_name)
#    ... tokenizer.apply_chat_template(...) ...
#
#    # Nachher (vLLM-Server, hoher Durchsatz):
#    from infrastructure.vllm.llm_client import VLLMClient
#    client = VLLMClient()
#    text = await client.chat(system_prompt, user_prompt)
#
#  Beide Pfade bleiben im Code verfügbar — für kleine Setups
#  (1 GPU) reicht model_manager.get_llm(), für Produktion mit
#  mehreren AI-Workern lohnt sich der zentrale vLLM-Server,
#  da das Modell dann nur EINMAL im Speicher liegt statt
#  einmal pro Worker-Replica.
# ============================================================

import os
import httpx

VLLM_URL = os.getenv("VLLM_URL", "http://localhost:8001/v1")


class VLLMClient:
    def __init__(self, base_url: str = VLLM_URL, model: str = "qwen3"):
        self.base_url = base_url
        self.model = model
        self.client = httpx.AsyncClient(timeout=120.0)

    async def chat(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2048,
        temperature: float = 0.7,
        json_mode: bool = False,
    ) -> str:
        payload = {
            "model": self.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "max_tokens": max_tokens,
            "temperature": temperature,
        }
        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        response = await self.client.post(f"{self.base_url}/chat/completions", json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"]

    async def health(self) -> bool:
        try:
            response = await self.client.get(f"{self.base_url.replace('/v1', '')}/health")
            return response.status_code == 200
        except Exception:
            return False

    async def close(self):
        await self.client.aclose()
