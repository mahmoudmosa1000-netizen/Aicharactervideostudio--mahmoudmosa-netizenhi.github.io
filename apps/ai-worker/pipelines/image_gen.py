# ============================================================
#  apps/ai-worker/pipelines/image_gen.py
#  Bildgenerierung — FLUX.1 Dev + IP-Adapter (Character Lock)
# ============================================================

import os
import uuid
import logging
from pathlib import Path
from PIL import Image
import torch

from providers import is_cloud_mode, is_lite_mode

logger = logging.getLogger("image_gen")

OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./storage/outputs")


class ImageGenerationPipeline:
    """
    Generiert Bilder mit FLUX.1 Dev.
    Wenn ein Charakter gesperrt ist, wird IP-Adapter
    verwendet um die Konsistenz zu erzwingen.
    """

    def __init__(self, model_manager):
        self.mm = model_manager

    # ── Hauptmethode ─────────────────────────────────────────

    async def generate(
        self,
        character_prompt: str,
        scene_prompt: str,
        camera_prompt: str = "",
        lighting_prompt: str = "",
        environment_prompt: str = "",
        motion_prompt: str = "",
        negative_prompt: str = "",
        character_id: str | None = None,
        reference_image_paths: list[str] | None = None,
        ip_adapter_weight: float = 0.8,
        is_character_locked: bool = False,
        preferred_lock_method: str = "auto",
        width: int = 1024,
        height: int = 576,
        steps: int = 30,
        guidance_scale: float = 3.5,
        seed: int | None = None,
    ) -> dict:

        # Vollständigen Prompt zusammenbauen
        full_prompt = self._build_prompt(
            character_prompt, scene_prompt, camera_prompt,
            lighting_prompt, environment_prompt, motion_prompt,
        )
        logger.info(f"🎨 Generiere Bild: {full_prompt[:80]}...")

        # ── CLOUD-MODUS: gehostete API statt lokaler GPU-Inferenz ──
        if is_cloud_mode():
            return await self._generate_cloud(
                full_prompt, negative_prompt, reference_image_paths, character_id,
            )

        # ── LITE-MODUS: FLUX.1-schnell statt FLUX.1-Dev (8GB+ VRAM) ──
        if is_lite_mode():
            return await self._generate_lite(
                full_prompt, negative_prompt, reference_image_paths, character_id, seed,
            )

        generator = torch.Generator().manual_seed(seed) if seed else None

        # Phase 3: Character Lock Engine — wenn der Charakter gesperrt ist,
        # MUSS die Lock Engine verwendet werden (höchste Priorität des Systems)
        if is_character_locked and character_id and reference_image_paths:
            from pipelines.character_lock import CharacterLockEngine, LockMethod
            engine = CharacterLockEngine(self.mm)
            result = await engine.apply_lock(
                prompt=full_prompt,
                negative_prompt=negative_prompt,
                reference_image_paths=reference_image_paths,
                method=LockMethod(preferred_lock_method),
                identity_weight=ip_adapter_weight,
                width=width, height=height,
                steps=steps, guidance_scale=guidance_scale,
                seed=seed,
            )
            image = result.image
            logger.info(f"🔒 Lock Engine genutzt: {result.method_used.value} (Score: {result.identity_score})")

        # Charakter hat Referenzbilder aber ist nicht gesperrt → einfacher IP-Adapter
        elif character_id and reference_image_paths:
            image = await self._generate_with_ip_adapter(
                prompt=full_prompt,
                negative_prompt=negative_prompt,
                reference_paths=reference_image_paths,
                ip_weight=ip_adapter_weight,
                width=width, height=height,
                steps=steps, guidance_scale=guidance_scale,
                generator=generator,
            )
        else:
            # Kein Charakter beteiligt — normaler FLUX-Lauf
            image = await self._generate_flux(
                prompt=full_prompt,
                negative_prompt=negative_prompt,
                width=width, height=height,
                steps=steps, guidance_scale=guidance_scale,
                generator=generator,
            )

        # Bild speichern
        output_path = self._save_image(image, character_id)
        logger.info(f"✅ Bild gespeichert: {output_path}")
        return {"imagePath": output_path, "width": width, "height": height, "prompt": full_prompt}

    # ── CLOUD-MODUS: FLUX über Replicate ──────────────────────

    async def _generate_cloud(
        self, prompt: str, negative_prompt: str,
        reference_image_paths: list[str] | None, character_id: str | None,
    ) -> dict:
        from providers.replicate_client import get_replicate_client, MODELS
        import base64

        client = get_replicate_client()
        payload = {"prompt": prompt, "num_outputs": 1, "output_format": "png"}
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt

        # Referenzbild mitschicken, damit Charakter-Konsistenz auch
        # im Cloud-Modus funktioniert (kein lokales PuLID/InstantID
        # verfügbar, aber das Modell kann per Bild-Input konditioniert
        # werden, sofern es das unterstützt — z.B. flux-dev-lora oder
        # ein dediziertes IP-Adapter-Replicate-Modell).
        if reference_image_paths:
            with open(reference_image_paths[0], "rb") as f:
                ref_b64 = base64.b64encode(f.read()).decode()
            payload["image"] = f"data:image/png;base64,{ref_b64}"
            model_slug = MODELS["image_with_character"]
            logger.info("☁️  Cloud-Generierung MIT Referenzbild (Charakter-Konsistenz)")
        else:
            model_slug = MODELS["image"]
            logger.info("☁️  Cloud-Generierung ohne Referenzbild")

        logger.info(f"☁️  Replicate-Modell: {model_slug}")
        prediction = await client.run(model_slug, payload)

        output_url = prediction["output"]
        if isinstance(output_url, list):
            output_url = output_url[0]

        output_path = self._build_output_path(character_id)
        await client.download_output(output_url, output_path)

        logger.info(f"✅ Cloud-Bild gespeichert: {output_path}")
        return {"imagePath": output_path, "width": 1024, "height": 576, "prompt": prompt}

    def _build_output_path(self, character_id: str | None) -> str:
        folder = Path(OUTPUT_DIR) / "images" / (character_id or "general")
        folder.mkdir(parents=True, exist_ok=True)
        return str(folder / f"{uuid.uuid4()}.png")

    # ── LITE-MODUS: FLUX.1-schnell, läuft auf normaler Gaming-GPU ──

    async def _generate_lite(
        self, prompt: str, negative_prompt: str,
        reference_image_paths: list[str] | None, character_id: str | None,
        seed: int | None,
    ) -> dict:
        generator = torch.Generator().manual_seed(seed) if seed else None

        if reference_image_paths:
            # Konsistenz im Lite-Modus: img2img mit dem Referenzbild als Start
            # statt echtem IP-Adapter/PuLID (die brauchen mehr VRAM). Niedrige
            # strength = mehr Ähnlichkeit zum Original, aber weniger Prompt-Treue.
            pipe = self.mm.get_flux_schnell_img2img()
            if pipe is None:
                raise RuntimeError("FLUX.1-schnell (img2img) nicht verfügbar")

            ref_image = Image.open(reference_image_paths[0]).convert("RGB").resize((768, 768))
            logger.info("🪶 Lite-Generierung MIT Referenzbild (img2img-Konsistenz, strength=0.6)")

            with torch.inference_mode():
                result = pipe(
                    prompt=prompt,
                    image=ref_image,
                    strength=0.6,
                    num_inference_steps=4,   # FLUX-schnell ist für 1-4 Schritte gebaut
                    guidance_scale=0.0,       # schnell nutzt kein klassisches CFG
                    generator=generator,
                )
        else:
            pipe = self.mm.get_flux_schnell()
            if pipe is None:
                raise RuntimeError("FLUX.1-schnell nicht verfügbar")

            logger.info("🪶 Lite-Generierung ohne Referenzbild")
            with torch.inference_mode():
                result = pipe(
                    prompt=prompt,
                    width=1024, height=576,
                    num_inference_steps=4,
                    guidance_scale=0.0,
                    generator=generator,
                )

        image = result.images[0]
        output_path = self._build_output_path(character_id)
        image.save(output_path, "PNG")
        logger.info(f"✅ Lite-Bild gespeichert: {output_path}")
        return {"imagePath": output_path, "width": 1024, "height": 576, "prompt": prompt}

    # ── FLUX ohne Character Lock ──────────────────────────────

    async def _generate_flux(
        self, prompt, negative_prompt, width, height, steps, guidance_scale, generator
    ) -> Image.Image:
        pipe = self.mm.get_flux()
        if pipe is None:
            raise RuntimeError("FLUX.1 nicht verfügbar")

        with torch.inference_mode():
            result = pipe(
                prompt=prompt,
                negative_prompt=negative_prompt or None,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=guidance_scale,
                generator=generator,
            )
        return result.images[0]

    # ── FLUX + IP-Adapter (Character Lock) ───────────────────

    async def _generate_with_ip_adapter(
        self, prompt, negative_prompt, reference_paths,
        ip_weight, width, height, steps, guidance_scale, generator
    ) -> Image.Image:
        ip_adapter = self.mm.get_ip_adapter()
        if ip_adapter is None:
            logger.warning("⚠ IP-Adapter nicht verfügbar — verwende FLUX ohne Lock")
            return await self._generate_flux(
                prompt, negative_prompt, width, height, steps, guidance_scale, generator
            )

        # Referenzbilder laden
        ref_images = [Image.open(p).convert("RGB").resize((224, 224)) for p in reference_paths]

        with torch.inference_mode():
            result = ip_adapter.generate(
                prompt=prompt,
                negative_prompt=negative_prompt or "",
                pil_image=ref_images,
                scale=ip_weight,
                width=width,
                height=height,
                num_inference_steps=steps,
                guidance_scale=guidance_scale,
                generator=generator,
            )
        return result.images[0]

    # ── Prompt Builder ────────────────────────────────────────

    def _build_prompt(
        self, character, scene, camera, lighting, environment, motion
    ) -> str:
        parts = []
        if character:    parts.append(f"Character: {character}")
        if scene:        parts.append(f"Scene: {scene}")
        if environment:  parts.append(f"Environment: {environment}")
        if lighting:     parts.append(f"Lighting: {lighting}")
        if camera:       parts.append(f"Camera: {camera}")
        if motion:       parts.append(f"Motion: {motion}")
        parts.append("cinematic quality, high detail, professional")
        return ". ".join(parts)

    # ── Speichern ─────────────────────────────────────────────

    def _save_image(self, image: Image.Image, character_id: str | None) -> str:
        folder = Path(OUTPUT_DIR) / "images" / (character_id or "general")
        folder.mkdir(parents=True, exist_ok=True)
        filename = f"{uuid.uuid4()}.png"
        path = folder / filename
        image.save(path, "PNG")
        return str(path)
