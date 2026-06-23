# ============================================================
#  apps/ai-worker/pipelines/image_analysis.py
#  Erweiterte Bildanalyse — Qwen2.5-VL + InternVL
#  NUR im lokalen Modus (AI_PROVIDER=local) relevant.
#  Im Cloud-Modus übernimmt character_dna.py._analyze_cloud()
#  dieselbe Aufgabe über Claude Vision (siehe providers/anthropic_client.py).
#
#  Florence-2 (character_dna.py) liefert eine schnelle Basis-
#  beschreibung. Dieses Modul liefert strukturierte, tiefere
#  Analyse für das vollständige Character DNA Profile:
#  Persönlichkeit, Stil-Klassifikation, Pose-Muster usw.
# ============================================================

import os
import json
import logging
from PIL import Image
import torch

logger = logging.getLogger("image_analysis")

CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "./storage/models")


class DeepImageAnalysisPipeline:
    """
    Nutzt Vision-Language-Modelle für strukturierte,
    JSON-formatierte Charakteranalyse — präziser als
    reine Caption-Modelle wie Florence-2.
    """

    def __init__(self, model_manager):
        self.mm = model_manager

    ANALYSIS_SCHEMA_PROMPT = """Analysiere dieses Charakterbild im Detail und antworte NUR mit validem JSON:
{
  "species": "Mensch|Tier|Fantasiewesen|Roboter",
  "gender": "männlich|weiblich|neutral",
  "estimatedAge": <Zahl>,
  "skinColor": "Beschreibung",
  "hairColor": "Beschreibung oder null",
  "eyeColor": "Beschreibung",
  "furColor": "Beschreibung oder null (nur bei Tieren)",
  "bodyType": "Beschreibung der Körperform",
  "distinctiveFeatures": ["Merkmal1", "Merkmal2"],
  "clothing": {
    "top": "Beschreibung oder null",
    "bottom": "Beschreibung oder null",
    "shoes": "Beschreibung oder null",
    "colors": ["Farbe1", "Farbe2"]
  },
  "accessories": ["Accessoire1"],
  "clothingStyle": "z.B. Casual, Traditionell, Futuristisch",
  "expression": "z.B. fröhlich, neugierig, ernst",
  "pose": "Beschreibung der Körperhaltung",
  "artStyle": "z.B. Realistisch, Anime, 3D-Cartoon, Pixar-Style",
  "suggestedPersonalityTraits": ["Eigenschaft1", "Eigenschaft2", "Eigenschaft3"]
}"""

    # ── Hauptmethode ─────────────────────────────────────────

    async def analyze(self, image_path: str, model: str = "qwen2.5-vl") -> dict:
        image = Image.open(image_path).convert("RGB")
        logger.info(f"🔍 Tiefe Bildanalyse gestartet ({model}): {image_path}")

        if model == "qwen2.5-vl":
            raw = await self._analyze_with_qwen_vl(image)
        elif model == "internvl":
            raw = await self._analyze_with_internvl(image)
        else:
            raise ValueError(f"Unbekanntes Analyse-Modell: {model}")

        parsed = self._parse_json_response(raw)
        logger.info(f"✅ Analyse abgeschlossen: {parsed.get('species', '?')} / {parsed.get('artStyle', '?')}")
        return parsed

    # ── Qwen2.5-VL ────────────────────────────────────────────

    async def _analyze_with_qwen_vl(self, image: Image.Image) -> str:
        qwen = self._get_qwen_vl()
        if qwen is None:
            return "{}"

        model, processor = qwen["model"], qwen["processor"]
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "image", "image": image},
                    {"type": "text", "text": self.ANALYSIS_SCHEMA_PROMPT},
                ],
            }
        ]
        text = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = processor(text=[text], images=[image], return_tensors="pt").to(model.device)

        with torch.no_grad():
            output_ids = model.generate(**inputs, max_new_tokens=1024, do_sample=False)

        generated = output_ids[:, inputs["input_ids"].shape[1]:]
        return processor.batch_decode(generated, skip_special_tokens=True)[0]

    def _get_qwen_vl(self):
        if not hasattr(self.mm, "_qwen_vl_cache"):
            try:
                from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
                model_id = "Qwen/Qwen2.5-VL-7B-Instruct"
                processor = AutoProcessor.from_pretrained(
                    model_id, cache_dir=os.path.join(CACHE_DIR, "qwen-vl")
                )
                model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                    model_id, torch_dtype=torch.bfloat16, device_map="auto",
                    cache_dir=os.path.join(CACHE_DIR, "qwen-vl"),
                )
                self.mm._qwen_vl_cache = {"model": model, "processor": processor}
                logger.info("✅ Qwen2.5-VL geladen")
            except Exception as e:
                logger.error(f"Qwen2.5-VL Fehler: {e}")
                self.mm._qwen_vl_cache = None
        return self.mm._qwen_vl_cache

    # ── InternVL (Fallback / Alternative) ────────────────────

    async def _analyze_with_internvl(self, image: Image.Image) -> str:
        internvl = self._get_internvl()
        if internvl is None:
            return "{}"

        model, tokenizer, transform = internvl["model"], internvl["tokenizer"], internvl["transform"]
        pixel_values = transform(image).unsqueeze(0).to(torch.bfloat16).to(model.device)

        with torch.no_grad():
            response = model.chat(
                tokenizer, pixel_values, self.ANALYSIS_SCHEMA_PROMPT,
                generation_config={"max_new_tokens": 1024, "do_sample": False},
            )
        return response

    def _get_internvl(self):
        if not hasattr(self.mm, "_internvl_cache"):
            try:
                from transformers import AutoModel, AutoTokenizer
                import torchvision.transforms as T
                model_id = "OpenGVLab/InternVL2_5-8B"
                model = AutoModel.from_pretrained(
                    model_id, torch_dtype=torch.bfloat16, trust_remote_code=True,
                    device_map="auto", cache_dir=os.path.join(CACHE_DIR, "internvl"),
                ).eval()
                tokenizer = AutoTokenizer.from_pretrained(
                    model_id, trust_remote_code=True, cache_dir=os.path.join(CACHE_DIR, "internvl")
                )
                transform = T.Compose([
                    T.Resize((448, 448)),
                    T.ToTensor(),
                    T.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
                ])
                self.mm._internvl_cache = {"model": model, "tokenizer": tokenizer, "transform": transform}
                logger.info("✅ InternVL geladen")
            except Exception as e:
                logger.error(f"InternVL Fehler: {e}")
                self.mm._internvl_cache = None
        return self.mm._internvl_cache

    # ── JSON Parsing mit Fallback ─────────────────────────────

    def _parse_json_response(self, raw: str) -> dict:
        # Markdown-Codeblocks entfernen, falls vom Modell hinzugefügt
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.split("```")[1]
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        cleaned = cleaned.strip()

        try:
            return json.loads(cleaned)
        except json.JSONDecodeError:
            logger.warning("⚠ JSON-Parsing fehlgeschlagen — verwende leeres Profil")
            return {
                "species": "Unbekannt",
                "distinctiveFeatures": [],
                "accessories": [],
                "suggestedPersonalityTraits": [],
                "rawResponse": raw,
            }

    # ── Profil-Mapping (für CharacterProfile-Tabelle) ────────

    def to_character_profile(self, analysis: dict) -> dict:
        """Wandelt die VLM-Analyse in das Prisma CharacterProfile-Format um."""
        clothing = analysis.get("clothing", {})
        return {
            "skinColor": analysis.get("skinColor"),
            "hairColor": analysis.get("hairColor"),
            "eyeColor": analysis.get("eyeColor"),
            "furColor": analysis.get("furColor"),
            "bodyType": analysis.get("bodyType"),
            "distinctiveFeatures": analysis.get("distinctiveFeatures", []),
            "primaryOutfit": {
                "top": clothing.get("top"),
                "bottom": clothing.get("bottom"),
                "shoes": clothing.get("shoes"),
                "colors": clothing.get("colors", []),
            },
            "accessories": analysis.get("accessories", []),
            "clothingStyle": analysis.get("clothingStyle"),
            "personality": analysis.get("suggestedPersonalityTraits", []),
            "rawAnalysis": analysis,
        }
