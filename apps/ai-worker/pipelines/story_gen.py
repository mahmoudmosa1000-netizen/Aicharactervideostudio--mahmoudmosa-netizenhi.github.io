# ============================================================
#  apps/ai-worker/pipelines/story_gen.py
#  Story-Generierung — Qwen3 / DeepSeek / Llama 4
# ============================================================

import json
import logging
import torch

from providers import is_cloud_mode, is_lite_mode

logger = logging.getLogger("story_gen")


class StoryGenerationPipeline:
    """
    Generiert vollständige Stories mit Szenen, Dialogen
    und KI-Prompts aus einer einfachen Benutzer-Idee.
    """

    def __init__(self, model_manager):
        self.mm = model_manager

    SYSTEM_PROMPT = """Du bist ein professioneller Drehbuchautor und Story-Designer.
Erstelle immer strukturierte JSON-Stories. Antworte NUR mit validem JSON, ohne Markdown-Backticks."""

    async def generate(
        self,
        idea: str,
        character_ids: list[str] | None = None,
        scene_count: int = 10,
        genre: str = "Abenteuer",
        language: str = "de",
        llm_model: str = "qwen3",
    ) -> dict:
        logger.info(f"📖 Generiere Story: '{idea}' ({scene_count} Szenen, {language})")

        user_prompt = self._build_user_prompt(idea, scene_count, genre, language)

        # ── CLOUD-MODUS: Claude API statt lokalem Qwen3/DeepSeek/Llama-4 ──
        if is_cloud_mode():
            from providers.anthropic_client import get_anthropic_client
            client = get_anthropic_client()
            try:
                story = await client.generate_json(self.SYSTEM_PROMPT, user_prompt)
                logger.info(f"✅ Cloud-Story generiert: '{story.get('title')}'")
                return story
            except Exception as e:
                logger.error(f"Cloud-Story-Generierung fehlgeschlagen: {e}")
                return self._fallback_story(idea, scene_count)

        # ── LITE-MODUS: Ollama mit kleinem lokalem LLM (z.B. Llama 3.2 3B) ──
        if is_lite_mode():
            from providers.ollama_client import get_ollama_client
            client = get_ollama_client()
            try:
                story = await client.generate_json(self.SYSTEM_PROMPT, user_prompt)
                logger.info(f"✅ Lite-Story generiert (Ollama): '{story.get('title')}'")
                return story
            except Exception as e:
                logger.error(f"Lite-Story-Generierung fehlgeschlagen: {e}")
                return self._fallback_story(idea, scene_count)

        raw_json = await self._call_llm(user_prompt, llm_model)

        try:
            story = json.loads(raw_json)
            logger.info(f"✅ Story generiert: '{story.get('title')}' ({len(story.get('scenes', []))} Szenen)")
            return story
        except json.JSONDecodeError as e:
            logger.error(f"JSON Parse-Fehler: {e}")
            return self._fallback_story(idea, scene_count)

    def _build_user_prompt(self, idea: str, scene_count: int, genre: str, language: str) -> str:
        lang_name = "Deutsch" if language == "de" else "English"
        return f"""Erstelle eine komplette {genre}-Story auf {lang_name}.

Idee: "{idea}"
Anzahl Szenen: {scene_count}

Gib exakt dieses JSON-Format zurück:
{{
  "title": "Story-Titel",
  "outline": {{
    "acts": [
      {{"act": 1, "title": "Einleitung", "scenes": [1, 2, 3]}},
      {{"act": 2, "title": "Konflikt", "scenes": [4, 5, 6, 7, 8]}},
      {{"act": 3, "title": "Auflösung", "scenes": [9, 10]}}
    ],
    "themes": ["Mut", "Freundschaft"]
  }},
  "scenes": [
    {{
      "title": "Szenen-Titel",
      "description": "Was passiert in dieser Szene",
      "dialogue": "Gesprochener Text der Charaktere",
      "voiceOver": "Erzähler-Text für Voice-Over",
      "duration": 6,
      "camera": {{"type": "dolly", "description": "Langsame Dolly-Fahrt"}},
      "prompts": {{
        "character": "Charakter-Beschreibung für Bildgenerierung",
        "scene": "Szenen-Beschreibung",
        "camera": "Kamera-Beschreibung",
        "motion": "Bewegungs-Beschreibung",
        "environment": "Umgebungs-Beschreibung",
        "lighting": "Beleuchtungs-Beschreibung"
      }}
    }}
  ]
}}"""

    async def _call_llm(self, user_prompt: str, model_name: str) -> str:
        llm_data = self.mm.get_llm(model_name)
        if llm_data is None:
            logger.warning(f"LLM {model_name} nicht verfügbar — nutze Fallback")
            return "{}"

        model, tokenizer = llm_data["model"], llm_data["tokenizer"]
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ]

        text = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(text, return_tensors="pt").to(model.device)

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=4096,
                temperature=0.7,
                top_p=0.9,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id,
            )

        new_tokens = output_ids[0][inputs["input_ids"].shape[1]:]
        return tokenizer.decode(new_tokens, skip_special_tokens=True).strip()

    def _fallback_story(self, idea: str, scene_count: int) -> dict:
        """Minimale Fallback-Story wenn LLM fehlschlägt."""
        return {
            "title": idea[:50],
            "outline": {"acts": [], "themes": []},
            "scenes": [
                {
                    "title": f"Szene {i+1}",
                    "description": f"Szene {i+1} der Story.",
                    "dialogue": "",
                    "voiceOver": "",
                    "duration": 5,
                    "camera": {"type": "static", "description": "Statische Kamera"},
                    "prompts": {
                        "character": idea,
                        "scene": f"Scene {i+1}",
                        "camera": "medium shot",
                        "motion": "natural movement",
                        "environment": "neutral background",
                        "lighting": "natural daylight",
                    },
                }
                for i in range(scene_count)
            ],
        }


# ============================================================
#  apps/ai-worker/pipelines/voice_gen.py
#  Sprachsynthese — XTTS-v2 / Kokoro / Orpheus
# ============================================================

import os
import uuid
import logging
from pathlib import Path

from providers import is_cloud_mode, is_lite_mode

logger = logging.getLogger("voice_gen")

OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./storage/outputs")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")


class VoiceGenerationPipeline:
    """
    Voice Cloning und Sprachsynthese.
    Klont Stimmen mit XTTS-v2 und synthetisiert Text
    mit verschiedenen Emotionen und Sprachen.
    """

    def __init__(self, model_manager):
        self.mm = model_manager
        self._voice_model = os.getenv("VOICE_MODEL", "xtts-v2")

    # ── Voice Cloning ─────────────────────────────────────────

    async def clone_voice(
        self,
        audio_path: str,
        character_id: str | None = None,
        language: str = "de",
        model: str = "xtts-v2",
    ) -> dict:
        logger.info(f"🎙 Klone Stimme aus: {audio_path}")

        # ── CLOUD-MODUS: ElevenLabs statt lokalem XTTS-v2 ────────
        if is_cloud_mode():
            return await self._clone_with_elevenlabs(audio_path, character_id, language)

        # ── LITE-MODUS: Piper TTS — KEIN echtes Cloning möglich ──
        if is_lite_mode():
            logger.warning(
                "⚠ Lite-Modus: Piper TTS unterstützt kein Voice-Cloning. "
                "Es wird eine vorinstallierte Stimme genutzt, das hochgeladene "
                "Audio wird ignoriert. Für echtes Cloning: AI_PROVIDER=local (XTTS-v2) "
                "oder AI_PROVIDER=cloud (ElevenLabs)."
            )
            return {
                "speakerEmbeddingId": f"piper-default-{language}",
                "supportedEmotions": ["neutral"],  # Piper unterstützt keine Emotionssteuerung
                "language": language,
                "warning": "Voice-Cloning im Lite-Modus nicht verfügbar — Standardstimme wird genutzt",
            }

        if model == "xtts-v2":
            return await self._clone_with_xtts(audio_path, character_id, language)
        else:
            raise ValueError(f"Voice Cloning nicht unterstützt für: {model}")

    async def _clone_with_elevenlabs(self, audio_path: str, character_id: str | None, language: str) -> dict:
        from providers.elevenlabs_client import get_elevenlabs_client
        client = get_elevenlabs_client()
        name = f"character-{character_id or uuid.uuid4().hex[:8]}"
        voice_id = await client.clone_voice(name, audio_path)
        logger.info(f"✅ Stimme über ElevenLabs geklont: {voice_id}")
        return {
            "speakerEmbeddingId": voice_id,  # hier: ElevenLabs voice_id statt lokalem Embedding
            "supportedEmotions": ["neutral", "freude", "trauer", "überraschung", "wut"],
            "language": language,
        }

    async def _clone_with_xtts(self, audio_path: str, character_id: str | None, language: str) -> dict:
        tts = self.mm.get_xtts()
        if tts is None:
            raise RuntimeError("XTTS-v2 nicht verfügbar")

        # Speaker Embedding aus Referenz-Audio
        gpt_cond_latent, speaker_embedding = tts.get_conditioning_latents(
            audio_path=[audio_path]
        )

        # Embedding in Qdrant speichern
        embedding_id = str(uuid.uuid4())
        if character_id:
            await self._store_speaker_embedding(
                embedding_id,
                speaker_embedding.cpu().float().numpy().tolist(),
                character_id,
            )

        logger.info(f"✅ Stimme geklont: {embedding_id}")
        return {
            "speakerEmbeddingId": embedding_id,
            "supportedEmotions": ["neutral", "freude", "trauer", "überraschung", "wut"],
            "language": language,
        }

    # ── Sprachsynthese ────────────────────────────────────────

    async def synthesize(
        self,
        text: str,
        speaker_embedding_id: str,
        language: str = "de",
        emotion: str = "neutral",
        speed: float = 1.0,
    ) -> dict:
        logger.info(f"🔊 Synthetisiere: '{text[:50]}...' (Emotion: {emotion})")

        # ── CLOUD-MODUS: ElevenLabs TTS ──────────────────────────
        if is_cloud_mode():
            from providers.elevenlabs_client import get_elevenlabs_client
            client = get_elevenlabs_client()
            output_path = Path(OUTPUT_DIR) / "audio" / f"{uuid.uuid4()}.mp3"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            await client.synthesize(speaker_embedding_id, text, str(output_path))
            logger.info(f"✅ Cloud-Audio gespeichert: {output_path}")
            return {"outputPath": str(output_path), "duration": None}

        # ── LITE-MODUS: Piper TTS (CPU-fähig, keine Emotionen) ───
        if is_lite_mode():
            from providers.piper_client import get_piper_client
            client = get_piper_client()
            output_path = Path(OUTPUT_DIR) / "audio" / f"{uuid.uuid4()}.wav"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            await client.synthesize(text, str(output_path), language)
            logger.info(f"✅ Lite-Audio gespeichert (Piper): {output_path}")
            return {"outputPath": str(output_path), "duration": None}

        tts = self.mm.get_xtts()
        if tts is None:
            raise RuntimeError("XTTS-v2 nicht verfügbar")

        # Embedding aus Qdrant laden
        gpt_cond_latent, speaker_embedding = await self._load_speaker_embedding(speaker_embedding_id)

        # Emotion als Prompt-Modifier
        emotion_prefix = {
            "freude": "Ha! ",
            "trauer": "Leider... ",
            "überraschung": "Oh! ",
            "wut": "",
        }.get(emotion, "")
        styled_text = emotion_prefix + text

        output_path = Path(OUTPUT_DIR) / "audio" / f"{uuid.uuid4()}.wav"
        output_path.parent.mkdir(parents=True, exist_ok=True)

        import torch
        with torch.no_grad():
            tts.tts_to_file(
                text=styled_text,
                speaker_wav=None,
                gpt_cond_latent=gpt_cond_latent,
                speaker_embedding=speaker_embedding,
                language=language,
                speed=speed,
                file_path=str(output_path),
            )

        import soundfile as sf
        info = sf.info(str(output_path))
        logger.info(f"✅ Audio gespeichert: {output_path} ({info.duration:.1f}s)")
        return {"outputPath": str(output_path), "duration": info.duration}

    # ── Qdrant: Speaker Embeddings ────────────────────────────

    async def _store_speaker_embedding(self, embedding_id: str, vector: list, character_id: str):
        from qdrant_client import QdrantClient
        from qdrant_client.models import PointStruct, VectorParams, Distance
        client = QdrantClient(url=QDRANT_URL)
        collection = "speaker_embeddings"
        try:
            client.get_collection(collection)
        except Exception:
            client.create_collection(collection, vectors_config=VectorParams(size=512, distance=Distance.COSINE))
        client.upsert(collection_name=collection, points=[
            PointStruct(id=embedding_id, vector=vector[:512], payload={"characterId": character_id})
        ])

    async def _load_speaker_embedding(self, embedding_id: str):
        """Lädt Embedding aus Qdrant und gibt XTTS-Latents zurück."""
        import torch
        from qdrant_client import QdrantClient
        client = QdrantClient(url=QDRANT_URL)
        result = client.retrieve("speaker_embeddings", ids=[embedding_id], with_vectors=True)
        if not result:
            raise ValueError(f"Speaker Embedding nicht gefunden: {embedding_id}")
        vector = torch.tensor(result[0].vector).unsqueeze(0)
        return None, vector  # gpt_cond_latent = None (vereinfacht), speaker_embedding
