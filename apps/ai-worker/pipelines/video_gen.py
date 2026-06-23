# ============================================================
#  apps/ai-worker/pipelines/video_gen.py
#  Videogenerierung — Wan 2.2 / LTX Video / CogVideoX
# ============================================================

import os
import uuid
import logging
import subprocess
from pathlib import Path
from PIL import Image
import torch

from providers import is_cloud_mode, is_lite_mode

logger = logging.getLogger("video_gen")

OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./storage/outputs")


class VideoGenerationPipeline:
    """
    Generiert Videos aus einem Startbild und Textprompts.
    Primär: Wan 2.2 — Fallback: LTX Video → CogVideoX
    """

    def __init__(self, model_manager):
        self.mm = model_manager
        self._video_model = os.getenv("VIDEO_MODEL", "wan2.2")

    # ── Hauptmethode ─────────────────────────────────────────

    async def generate(
        self,
        image_path: str,
        prompt: str,
        motion_prompt: str = "",
        camera_prompt: str = "",
        negative_prompt: str = "",
        duration_seconds: int = 5,
        fps: int = 24,
        width: int = 1280,
        height: int = 720,
        seed: int | None = None,
    ) -> dict:

        full_prompt = self._build_video_prompt(prompt, motion_prompt, camera_prompt)
        logger.info(f"🎬 Generiere Video ({duration_seconds}s @ {fps}fps): {full_prompt[:60]}...")

        # ── CLOUD-MODUS: gehostetes Bild→Video-Modell über Replicate ──
        if is_cloud_mode():
            return await self._generate_cloud(image_path, full_prompt, negative_prompt, duration_seconds, fps)

        # ── LITE-MODUS: Ken-Burns-Pan/Zoom per FFmpeg (kein GPU nötig) ──
        if is_lite_mode():
            return await self._generate_lite(image_path, duration_seconds, fps, width, height)

        source_image = Image.open(image_path).convert("RGB").resize((width, height))
        num_frames = duration_seconds * fps

        # Modell-Auswahl
        if self._video_model == "wan2.2":
            frames = await self._generate_wan(source_image, full_prompt, negative_prompt, num_frames, fps)
        elif self._video_model == "ltx":
            frames = await self._generate_ltx(source_image, full_prompt, negative_prompt, num_frames, fps)
        else:
            frames = await self._generate_cogvideox(full_prompt, num_frames, fps)

        # Frames → MP4 via FFmpeg
        output_path = await self._frames_to_video(frames, fps, seed)
        file_size = os.path.getsize(output_path)

        logger.info(f"✅ Video gespeichert: {output_path} ({file_size/1024/1024:.1f} MB)")
        return {
            "videoPath": output_path,
            "duration": duration_seconds,
            "fps": fps,
            "frames": len(frames),
            "fileSize": file_size,
            "model": self._video_model,
        }

    # ── CLOUD-MODUS: Bild→Video über Replicate ────────────────

    async def _generate_cloud(
        self, image_path: str, prompt: str, negative_prompt: str,
        duration_seconds: int, fps: int,
    ) -> dict:
        from providers.replicate_client import get_replicate_client, MODELS
        import base64

        client = get_replicate_client()

        # Bild als data-URI einbetten (Replicate akzeptiert das für image-Inputs)
        with open(image_path, "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode()
        image_data_uri = f"data:image/png;base64,{image_b64}"

        payload = {
            "image": image_data_uri,
            "prompt": prompt,
            "num_frames": min(duration_seconds * fps, 81),  # Hosted Modelle haben oft Frame-Limits
        }
        if negative_prompt:
            payload["negative_prompt"] = negative_prompt

        logger.info(f"☁️  Cloud-Video-Generierung über Replicate ({MODELS['video_img2vid']})")
        prediction = await client.run(MODELS["video_img2vid"], payload, timeout=600.0)

        output_url = prediction["output"]
        if isinstance(output_url, list):
            output_url = output_url[0]

        out_folder = Path(OUTPUT_DIR) / "videos"
        out_folder.mkdir(parents=True, exist_ok=True)
        output_path = str(out_folder / f"{uuid.uuid4()}.mp4")
        await client.download_output(output_url, output_path)

        file_size = os.path.getsize(output_path)
        logger.info(f"✅ Cloud-Video gespeichert: {output_path} ({file_size/1024/1024:.1f} MB)")
        return {
            "videoPath": output_path, "duration": duration_seconds, "fps": fps,
            "frames": payload["num_frames"], "fileSize": file_size, "model": "replicate-cloud",
        }

    # ── LITE-MODUS: Ken-Burns-Effekt (Standard) oder AnimateDiff-Lightning (Upgrade) ──

    async def _generate_lite(
        self, image_path: str, duration_seconds: int, fps: int, width: int, height: int,
    ) -> dict:
        method = os.getenv("LITE_VIDEO_METHOD", "kenburns")  # kenburns|animatediff

        if method == "animatediff":
            try:
                return await self._generate_lite_animatediff(image_path, duration_seconds, fps)
            except Exception as e:
                logger.warning(f"⚠ AnimateDiff-Lightning fehlgeschlagen ({e}) — Fallback auf Ken-Burns")

        return await self._generate_kenburns(image_path, duration_seconds, fps, width, height)

    async def _generate_kenburns(
        self, image_path: str, duration_seconds: int, fps: int, width: int, height: int,
    ) -> dict:
        """
        Langsamer Zoom/Pan über das Standbild — eine reale, weit verbreitete
        Technik für Bild→Video ohne KI-Modell (z.B. in vielen Slideshow- und
        Dokumentarfilm-Tools). Braucht NUR FFmpeg, läuft auf jeder Hardware,
        auch ohne GPU. Das ist die ehrliche Grenze des Lite-Modus: echte
        gelernte Bewegung (wie Wan 2.2) braucht mehr Rechenleistung als
        eine normale Gaming-GPU im Lite-Tempo leisten kann.
        """
        out_folder = Path(OUTPUT_DIR) / "videos"
        out_folder.mkdir(parents=True, exist_ok=True)
        output_path = out_folder / f"{uuid.uuid4()}.mp4"

        total_frames = duration_seconds * fps
        # zoompan: leichter Zoom von 1.0 auf 1.15, Pan zur Bildmitte
        zoom_expr = f"zoom='min(zoom+0.0015,1.15)':d={total_frames}:s={width}x{height}:fps={fps}"

        cmd = [
            "ffmpeg", "-y", "-loop", "1", "-i", image_path,
            "-vf", f"scale={width*2}:{height*2},zoompan={zoom_expr}",
            "-t", str(duration_seconds),
            "-c:v", "libx264", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(output_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg Ken-Burns-Fehler: {result.stderr}")

        file_size = os.path.getsize(output_path)
        logger.info(f"✅ Lite-Video (Ken-Burns) gespeichert: {output_path} ({file_size/1024/1024:.1f} MB)")
        return {
            "videoPath": str(output_path), "duration": duration_seconds, "fps": fps,
            "frames": total_frames, "fileSize": file_size, "model": "ffmpeg-kenburns",
        }

    async def _generate_lite_animatediff(self, image_path: str, duration_seconds: int, fps: int) -> dict:
        """
        Optionales Upgrade für Lite-Nutzer mit etwas mehr VRAM (8GB+):
        echte gelernte Bewegung statt reinem Pan/Zoom. Deutlich schwerer
        als Ken-Burns, aber leichter als Wan 2.2.
        AI_PROVIDER=lite + LITE_VIDEO_METHOD=animatediff aktiviert dies.
        """
        from diffusers import AnimateDiffPipeline, MotionAdapter
        import torch as _torch

        adapter = MotionAdapter.from_pretrained(
            "ByteDance/AnimateDiff-Lightning",
            torch_dtype=_torch.float16,
            cache_dir=os.path.join(os.getenv("MODEL_CACHE_DIR", "./storage/models"), "animatediff"),
        )
        pipe = AnimateDiffPipeline.from_pretrained(
            "emilianJR/epiCRealism", motion_adapter=adapter, torch_dtype=_torch.float16,
        )
        pipe.enable_model_cpu_offload()

        image = Image.open(image_path).convert("RGB").resize((512, 512))
        with _torch.inference_mode():
            output = pipe(image=image, num_frames=min(duration_seconds * fps, 32), num_inference_steps=4)

        return await self._frames_to_video(output.frames[0], fps)

    # ── Wan 2.2 ──────────────────────────────────────────────

    async def _generate_wan(self, image, prompt, negative_prompt, num_frames, fps):
        pipe = self.mm.get_wan()
        if pipe is None:
            raise RuntimeError("Wan 2.2 nicht verfügbar")

        with torch.inference_mode():
            output = pipe(
                image=image,
                prompt=prompt,
                negative_prompt=negative_prompt or "blurry, low quality, distorted",
                num_frames=num_frames,
                num_inference_steps=50,
                guidance_scale=7.5,
            )
        return output.frames[0]  # Liste von PIL-Images

    # ── LTX Video (Fallback) ──────────────────────────────────

    async def _generate_ltx(self, image, prompt, negative_prompt, num_frames, fps):
        try:
            from diffusers import LTXImageToVideoPipeline
            pipe = LTXImageToVideoPipeline.from_pretrained(
                "Lightricks/LTX-Video",
                torch_dtype=torch.bfloat16,
                cache_dir=os.path.join(os.getenv("MODEL_CACHE_DIR", "./storage/models"), "ltx"),
            ).to("cuda")
            with torch.inference_mode():
                output = pipe(
                    image=image, prompt=prompt,
                    negative_prompt=negative_prompt or "",
                    num_frames=num_frames,
                    num_inference_steps=40,
                )
            return output.frames[0]
        except Exception as e:
            logger.error(f"LTX Video Fehler: {e}")
            raise

    # ── CogVideoX (Fallback) ──────────────────────────────────

    async def _generate_cogvideox(self, prompt, num_frames, fps):
        try:
            from diffusers import CogVideoXPipeline
            pipe = CogVideoXPipeline.from_pretrained(
                "THUDM/CogVideoX-5b",
                torch_dtype=torch.bfloat16,
                cache_dir=os.path.join(os.getenv("MODEL_CACHE_DIR", "./storage/models"), "cogvideox"),
            ).to("cuda")
            with torch.inference_mode():
                output = pipe(
                    prompt=prompt,
                    num_frames=num_frames,
                    num_inference_steps=50,
                    guidance_scale=6.0,
                )
            return output.frames[0]
        except Exception as e:
            logger.error(f"CogVideoX Fehler: {e}")
            raise

    # ── FFmpeg: Frames → MP4 ─────────────────────────────────

    async def _frames_to_video(self, frames: list, fps: int, seed=None) -> str:
        import tempfile
        out_folder = Path(OUTPUT_DIR) / "videos"
        out_folder.mkdir(parents=True, exist_ok=True)

        tmp_dir = Path(tempfile.mkdtemp())
        for i, frame in enumerate(frames):
            if not isinstance(frame, Image.Image):
                from PIL import Image as PILImage
                frame = PILImage.fromarray(frame)
            frame.save(tmp_dir / f"frame_{i:05d}.png")

        output_path = out_folder / f"{uuid.uuid4()}.mp4"
        cmd = [
            "ffmpeg", "-y",
            "-framerate", str(fps),
            "-i", str(tmp_dir / "frame_%05d.png"),
            "-c:v", "libx264",
            "-crf", "18",
            "-preset", "slow",
            "-pix_fmt", "yuv420p",
            "-movflags", "+faststart",
            str(output_path),
        ]
        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(f"FFmpeg Fehler: {result.stderr}")

        # Temp-Dateien aufräumen
        import shutil
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return str(output_path)

    # ── Prompt Builder ────────────────────────────────────────

    def _build_video_prompt(self, base: str, motion: str, camera: str) -> str:
        parts = [base]
        if motion: parts.append(motion)
        if camera: parts.append(camera)
        parts.append("smooth motion, cinematic, high quality video")
        return ". ".join(parts)
