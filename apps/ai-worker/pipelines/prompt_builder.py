# ============================================================
#  apps/ai-worker/pipelines/prompt_builder.py
#  Advanced Prompt Builder — Kernfunktion 5 der Spezifikation
#
#  Wandelt eine grobe Szenenbeschreibung + Character-DNA-Profil
#  in 6 professionelle, getrennte Prompts um:
#  Character / Scene / Camera / Motion / Environment / Lighting
# ============================================================

import json
import logging
import torch

from providers import is_cloud_mode, is_lite_mode

logger = logging.getLogger("prompt_builder")


class PromptBuilderPipeline:
    """
    Zwei Modi:
    1. template() — schnell, deterministisch, kombiniert Character-DNA-
       Felder direkt zu Prompts. Kein LLM nötig, < 1ms.
    2. refine()   — nutzt ein LLM um aus einer rohen Szenenbeschreibung
       hochwertige, kinoreife Prompts zu generieren. Wird verwendet wenn
       die Story noch keine fertigen Prompts hat (z.B. manuell angelegte
       Szenen) oder wenn der Nutzer eine Qualitätsverbesserung anfordert.
    """

    def __init__(self, model_manager):
        self.mm = model_manager

    # ── Schnelle Template-basierte Erstellung ─────────────────

    def build_from_template(self, character_profile: dict, scene_draft: dict) -> dict:
        char_parts = []
        if character_profile.get("name"):
            char_parts.append(character_profile["name"])
        if character_profile.get("furColor"):
            char_parts.append(f"{character_profile['furColor']} fur")
        elif character_profile.get("skinColor"):
            char_parts.append(f"{character_profile['skinColor']} skin")
        if character_profile.get("eyeColor"):
            char_parts.append(f"{character_profile['eyeColor']} eyes")
        outfit = character_profile.get("primaryOutfit", {}) or {}
        if outfit.get("top"):
            char_parts.append(f"wearing {outfit['top']}")
        for acc in character_profile.get("accessories", []) or []:
            char_parts.append(f"with {acc}")

        character_prompt = ", ".join(char_parts) if char_parts else scene_draft.get("characterHint", "")

        return {
            "character": character_prompt,
            "scene": scene_draft.get("description", ""),
            "camera": scene_draft.get("cameraHint", "medium shot, eye level"),
            "motion": scene_draft.get("motionHint", "natural subtle movement"),
            "environment": scene_draft.get("environmentHint", scene_draft.get("description", "")),
            "lighting": scene_draft.get("lightingHint", "soft natural daylight"),
            "negative": "blurry, distorted, extra limbs, low quality, watermark, text",
        }

    # ── LLM-basierte Veredelung ────────────────────────────────

    SYSTEM_PROMPT = """Du bist ein professioneller Prompt-Engineer für KI-Bild- und Videogenerierung.
Antworte NUR mit validem JSON, ohne Markdown-Backticks, ohne Erklärungen."""

    async def refine_with_llm(
        self, character_profile: dict, scene_draft: dict, llm_model: str = "qwen3"
    ) -> dict:
        logger.info(f"✍️  Veredle Prompts für Szene: {scene_draft.get('title', '?')}")

        user_prompt = self._build_refinement_prompt(character_profile, scene_draft)

        if is_cloud_mode():
            from providers.anthropic_client import get_anthropic_client
            client = get_anthropic_client()
            try:
                return await client.generate_json(self.SYSTEM_PROMPT, user_prompt, max_tokens=800)
            except Exception:
                logger.warning("⚠ Cloud-Veredelung fehlgeschlagen — Fallback auf Template")
                return self.build_from_template(character_profile, scene_draft)

        if is_lite_mode():
            from providers.ollama_client import get_ollama_client
            client = get_ollama_client()
            try:
                return await client.generate_json(self.SYSTEM_PROMPT, user_prompt)
            except Exception:
                logger.warning("⚠ Lite-Veredelung (Ollama) fehlgeschlagen — Fallback auf Template")
                return self.build_from_template(character_profile, scene_draft)

        raw = await self._call_llm(user_prompt, llm_model)

        try:
            result = json.loads(self._strip_markdown(raw))
            logger.info("✅ Prompts veredelt")
            return result
        except json.JSONDecodeError:
            logger.warning("⚠ LLM-JSON ungültig — Fallback auf Template")
            return self.build_from_template(character_profile, scene_draft)

    def _build_refinement_prompt(self, character_profile: dict, scene_draft: dict) -> str:
        return f"""Erstelle professionelle KI-Generierungs-Prompts für diese Szene.

CHARAKTER-DNA-PROFIL:
{json.dumps(character_profile, ensure_ascii=False, indent=2)}

SZENEN-ENTWURF:
Titel: {scene_draft.get('title', '')}
Beschreibung: {scene_draft.get('description', '')}
Dialog: {scene_draft.get('dialogue', '')}

Gib exakt dieses JSON zurück (Englisch, da Bildmodelle auf Englisch trainiert sind):
{{
  "character": "Präzise visuelle Charakterbeschreibung für Bildgenerierung",
  "scene": "Was in der Szene passiert, visuell beschrieben",
  "camera": "Kamerawinkel und Bewegung, z.B. 'slow dolly-in, eye level'",
  "motion": "Bewegungsbeschreibung für Video-Generierung",
  "environment": "Umgebungs- und Hintergrunddetails",
  "lighting": "Beleuchtungsstimmung, z.B. 'warm golden hour backlight'",
  "negative": "Was vermieden werden soll (Standardliste + szenenspezifisch)"
}}"""

    async def _call_llm(self, prompt: str, model_name: str) -> str:
        llm_data = self.mm.get_llm(model_name)
        if llm_data is None:
            return "{}"
        model, tokenizer = llm_data["model"], llm_data["tokenizer"]
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(text, return_tensors="pt").to(model.device)
        with torch.no_grad():
            output_ids = model.generate(
                **inputs, max_new_tokens=800, temperature=0.6, top_p=0.9,
                do_sample=True, pad_token_id=tokenizer.eos_token_id,
            )
        new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
        return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    def _strip_markdown(self, text: str) -> str:
        text = text.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        return text.strip()
