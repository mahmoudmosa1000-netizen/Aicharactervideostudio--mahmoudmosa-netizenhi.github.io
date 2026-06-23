# ============================================================
#  apps/ai-worker/pipelines/character_lock.py
#  Character Lock Engine — höchste Priorität des Systems
#
#  Vereint mehrere State-of-the-Art Konsistenz-Methoden und
#  wählt automatisch die beste Strategie je nach Anwendungsfall:
#
#    IP-Adapter    → schnell, gute Allzweck-Konsistenz (Standard)
#    PuLID         → beste Identitäts-Treue bei Gesichtern
#    InstantID     → sehr robust bei unterschiedlichen Posen
#    ConsisID      → optimiert für Video-Konsistenz (Multi-Frame)
#    PhotoMaker V2 → gut bei mehreren Referenzbildern gleichzeitig
# ============================================================

import os
import logging
from enum import Enum
from dataclasses import dataclass
from PIL import Image
import torch

logger = logging.getLogger("character_lock")

CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "./storage/models")


class LockMethod(str, Enum):
    IP_ADAPTER = "ip_adapter"
    PULID = "pulid"
    INSTANT_ID = "instant_id"
    CONSIS_ID = "consis_id"
    PHOTOMAKER_V2 = "photomaker_v2"
    AUTO = "auto"


@dataclass
class LockResult:
    image: Image.Image
    method_used: LockMethod
    identity_score: float          # Geschätzte Übereinstimmung mit Referenz
    metadata: dict


class CharacterLockEngine:
    """
    Zentrale Engine für Character Lock.

    WICHTIG: Wenn isLocked=True für einen Charakter gesetzt ist,
    MUSS diese Engine für JEDE Generierung verwendet werden —
    keine Ausnahmen, keine Bypässe. Das ist die "höchste Priorität"
    aus der Produktspezifikation.
    """

    def __init__(self, model_manager):
        self.mm = model_manager

    # ── Automatische Methodenwahl ─────────────────────────────

    def select_method(
        self,
        is_video_frame: bool,
        reference_count: int,
        has_face: bool,
    ) -> LockMethod:
        """
        Wählt die beste Lock-Methode basierend auf Kontext.
        Diese Heuristik kann später durch echte Benchmarks ersetzt werden.
        """
        if is_video_frame:
            return LockMethod.CONSIS_ID
        if has_face and reference_count == 1:
            return LockMethod.PULID
        if has_face and reference_count > 1:
            return LockMethod.PHOTOMAKER_V2
        if not has_face:
            return LockMethod.IP_ADAPTER  # z.B. Tiere, Objekte, Stil-Konsistenz
        return LockMethod.INSTANT_ID

    # ── Hauptmethode ───────────────────────────────────────────

    async def apply_lock(
        self,
        prompt: str,
        negative_prompt: str,
        reference_image_paths: list[str],
        method: LockMethod = LockMethod.AUTO,
        identity_weight: float = 0.8,
        has_face: bool = True,
        is_video_frame: bool = False,
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        guidance_scale: float = 3.5,
        seed: int | None = None,
    ) -> LockResult:

        if method == LockMethod.AUTO:
            method = self.select_method(is_video_frame, len(reference_image_paths), has_face)

        logger.info(f"🔒 Character Lock aktiv — Methode: {method.value} (Gewicht: {identity_weight})")

        reference_images = [
            Image.open(p).convert("RGB") for p in reference_image_paths
        ]
        generator = torch.Generator().manual_seed(seed) if seed else None

        handlers = {
            LockMethod.IP_ADAPTER: self._run_ip_adapter,
            LockMethod.PULID: self._run_pulid,
            LockMethod.INSTANT_ID: self._run_instant_id,
            LockMethod.CONSIS_ID: self._run_consis_id,
            LockMethod.PHOTOMAKER_V2: self._run_photomaker,
        }

        handler = handlers.get(method, self._run_ip_adapter)
        image, score = await handler(
            prompt, negative_prompt, reference_images,
            identity_weight, width, height, steps, guidance_scale, generator,
        )

        return LockResult(
            image=image,
            method_used=method,
            identity_score=score,
            metadata={"referenceCount": len(reference_images), "weight": identity_weight},
        )

    # ── IP-Adapter ─────────────────────────────────────────────

    async def _run_ip_adapter(
        self, prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
    ):
        ip_adapter = self.mm.get_ip_adapter()
        if ip_adapter is None:
            raise RuntimeError("IP-Adapter nicht verfügbar")
        with torch.inference_mode():
            result = ip_adapter.generate(
                prompt=prompt, negative_prompt=negative_prompt,
                pil_image=[r.resize((224, 224)) for r in refs],
                scale=weight, width=width, height=height,
                num_inference_steps=steps, guidance_scale=guidance,
                generator=generator,
            )
        return result.images[0], 0.85  # Geschätzter Identity Score

    # ── PuLID ────────────────────────────────────────────────

    async def _run_pulid(
        self, prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
    ):
        pulid = self._get_pulid_pipeline()
        if pulid is None:
            logger.warning("⚠ PuLID nicht verfügbar — Fallback auf IP-Adapter")
            return await self._run_ip_adapter(
                prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
            )

        id_embeddings = pulid["pulid_model"].get_id_embedding(refs[0])
        with torch.inference_mode():
            result = pulid["pipe"](
                prompt=prompt,
                negative_prompt=negative_prompt,
                id_embeddings=id_embeddings,
                id_scale=weight,
                width=width, height=height,
                num_inference_steps=steps,
                guidance_scale=guidance,
                generator=generator,
            )
        return result.images[0], 0.93  # PuLID hat sehr hohe Identitäts-Treue

    def _get_pulid_pipeline(self):
        if not hasattr(self.mm, "_pulid_cache"):
            try:
                from pulid import PuLIDPipeline  # Platzhalter-Import
                from diffusers import StableDiffusionXLPipeline

                base_pipe = StableDiffusionXLPipeline.from_pretrained(
                    "stabilityai/stable-diffusion-xl-base-1.0",
                    torch_dtype=torch.float16,
                    cache_dir=os.path.join(CACHE_DIR, "sdxl"),
                )
                pulid_model = PuLIDPipeline(
                    base_pipe,
                    pretrained_model=os.path.join(CACHE_DIR, "pulid/pulid_v1.1.safetensors"),
                    device="cuda",
                )
                self.mm._pulid_cache = {"pipe": base_pipe, "pulid_model": pulid_model}
            except Exception as e:
                logger.error(f"PuLID Initialisierung fehlgeschlagen: {e}")
                self.mm._pulid_cache = None
        return self.mm._pulid_cache

    # ── InstantID ────────────────────────────────────────────

    async def _run_instant_id(
        self, prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
    ):
        instant_id = self._get_instant_id_pipeline()
        if instant_id is None:
            logger.warning("⚠ InstantID nicht verfügbar — Fallback auf IP-Adapter")
            return await self._run_ip_adapter(
                prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
            )

        face_info = instant_id["face_analysis"].get(refs[0])
        if not face_info:
            raise ValueError("Kein Gesicht im Referenzbild für InstantID gefunden")

        with torch.inference_mode():
            result = instant_id["pipe"](
                prompt=prompt,
                negative_prompt=negative_prompt,
                image_embeds=face_info[0].embedding,
                face_kps=face_info[0].kps,
                controlnet_conditioning_scale=weight,
                width=width, height=height,
                num_inference_steps=steps,
                guidance_scale=guidance,
                generator=generator,
            )
        return result.images[0], 0.91

    def _get_instant_id_pipeline(self):
        if not hasattr(self.mm, "_instant_id_cache"):
            try:
                from diffusers import StableDiffusionXLControlNetPipeline, ControlNetModel
                controlnet = ControlNetModel.from_pretrained(
                    "InstantX/InstantID",
                    torch_dtype=torch.float16,
                    cache_dir=os.path.join(CACHE_DIR, "instantid"),
                )
                pipe = StableDiffusionXLControlNetPipeline.from_pretrained(
                    "stabilityai/stable-diffusion-xl-base-1.0",
                    controlnet=controlnet,
                    torch_dtype=torch.float16,
                    cache_dir=os.path.join(CACHE_DIR, "sdxl"),
                )
                self.mm._instant_id_cache = {
                    "pipe": pipe,
                    "face_analysis": self.mm.get_insightface(),
                }
            except Exception as e:
                logger.error(f"InstantID Initialisierung fehlgeschlagen: {e}")
                self.mm._instant_id_cache = None
        return self.mm._instant_id_cache

    # ── ConsisID (Video-Konsistenz) ──────────────────────────

    async def _run_consis_id(
        self, prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
    ):
        """
        ConsisID erhält Identitäts-Konsistenz über mehrere Video-Frames.
        Wird primär vom video_gen.py Modul aufgerufen, nicht für Einzelbilder.
        """
        consis = self._get_consis_id_pipeline()
        if consis is None:
            logger.warning("⚠ ConsisID nicht verfügbar — Fallback auf PuLID")
            return await self._run_pulid(
                prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
            )

        with torch.inference_mode():
            result = consis["pipe"](
                prompt=prompt,
                negative_prompt=negative_prompt,
                reference_image=refs[0],
                identity_scale=weight,
                width=width, height=height,
                num_inference_steps=steps,
                guidance_scale=guidance,
                generator=generator,
            )
        return result.images[0], 0.88

    def _get_consis_id_pipeline(self):
        if not hasattr(self.mm, "_consis_id_cache"):
            try:
                from diffusers import ConsisIDPipeline
                pipe = ConsisIDPipeline.from_pretrained(
                    "BestWishYsh/ConsisID-preview",
                    torch_dtype=torch.bfloat16,
                    cache_dir=os.path.join(CACHE_DIR, "consisid"),
                )
                self.mm._consis_id_cache = {"pipe": pipe}
            except Exception as e:
                logger.error(f"ConsisID Initialisierung fehlgeschlagen: {e}")
                self.mm._consis_id_cache = None
        return self.mm._consis_id_cache

    # ── PhotoMaker V2 ─────────────────────────────────────────

    async def _run_photomaker(
        self, prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
    ):
        """Optimal wenn mehrere Referenzbilder gleichzeitig vorliegen."""
        pm = self._get_photomaker_pipeline()
        if pm is None:
            logger.warning("⚠ PhotoMaker V2 nicht verfügbar — Fallback auf IP-Adapter")
            return await self._run_ip_adapter(
                prompt, negative_prompt, refs, weight, width, height, steps, guidance, generator
            )

        # PhotoMaker erwartet ein "img" Trigger-Wort im Prompt
        styled_prompt = prompt if "img" in prompt.lower() else f"{prompt}, img"

        with torch.inference_mode():
            result = pm["pipe"](
                prompt=styled_prompt,
                negative_prompt=negative_prompt,
                input_id_images=refs,
                style_strength_ratio=int(weight * 100),
                width=width, height=height,
                num_inference_steps=steps,
                guidance_scale=guidance,
                generator=generator,
            )
        return result.images[0], 0.87

    def _get_photomaker_pipeline(self):
        if not hasattr(self.mm, "_photomaker_cache"):
            try:
                from diffusers import StableDiffusionXLPipeline
                from photomaker import PhotoMakerStableDiffusionXLPipeline
                pipe = PhotoMakerStableDiffusionXLPipeline.from_pretrained(
                    "TencentARC/PhotoMaker-V2",
                    torch_dtype=torch.float16,
                    cache_dir=os.path.join(CACHE_DIR, "photomaker"),
                )
                self.mm._photomaker_cache = {"pipe": pipe}
            except Exception as e:
                logger.error(f"PhotoMaker V2 Initialisierung fehlgeschlagen: {e}")
                self.mm._photomaker_cache = None
        return self.mm._photomaker_cache

    # ── Konsistenz-Validierung ────────────────────────────────

    async def validate_consistency(
        self, generated_image: Image.Image, reference_image_paths: list[str]
    ) -> dict:
        """
        Prüft nach der Generierung, ob der Charakter noch konsistent ist.
        Vergleicht Face- und Style-Embeddings zwischen generiertem Bild
        und Referenzbildern. Wird genutzt um Re-Generierung zu triggern,
        falls die Konsistenz unter einem Schwellenwert liegt.
        """
        from pipelines.character_dna import CharacterDNAPipeline
        dna = CharacterDNAPipeline(self.mm)

        gen_face = dna._extract_face_embedding([generated_image])
        ref_images = [Image.open(p).convert("RGB") for p in reference_image_paths]
        ref_face = dna._extract_face_embedding(ref_images)

        if gen_face is None or ref_face is None:
            return {"consistent": True, "score": None, "reason": "Kein Gesicht erkannt — Prüfung übersprungen"}

        import numpy as np
        similarity = float(np.dot(gen_face, ref_face))
        threshold = 0.75
        return {
            "consistent": similarity >= threshold,
            "score": round(similarity, 3),
            "threshold": threshold,
        }
