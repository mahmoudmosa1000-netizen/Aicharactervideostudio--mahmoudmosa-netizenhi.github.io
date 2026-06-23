# ============================================================
#  apps/ai-worker/models/model_manager.py
#  GPU-Zuweisung & VRAM-Management für alle KI-Modelle
# ============================================================

import os
import gc
import logging
from typing import Optional
import torch

logger = logging.getLogger("model_manager")

CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "./storage/models")


class ModelManager:
    """
    Verwaltet alle geladenen KI-Modelle.
    Lädt Modelle bei Bedarf (lazy loading) und entlädt sie
    bei VRAM-Engpässen automatisch.
    """

    def __init__(self):
        self._models: dict = {}
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        self._gpu_count = torch.cuda.device_count()
        logger.info(f"🖥  Device: {self._device} | GPUs: {self._gpu_count}")

    # ── Vorladung beim Start ─────────────────────────────────

    async def preload_base_models(self):
        """Lädt leichte Basismodelle beim Start vor."""
        from providers import is_cloud_mode, is_lite_mode
        if is_cloud_mode():
            logger.info("☁️  AI_PROVIDER=cloud — lokale Modelle werden NICHT geladen (API-Modus)")
            return
        if is_lite_mode():
            logger.info("🪶 AI_PROVIDER=lite — InsightFace/CLIP/DINOv2 werden NICHT geladen.")
            logger.info("   FLUX.1-schnell wird beim ersten Bild-Request lazy geladen (8GB+ VRAM empfohlen).")
            return
        logger.info("Lade InsightFace (Gesichtserkennung)...")
        self._load_insightface()
        logger.info("Lade CLIP (Style-Embeddings)...")
        self._load_clip()

    # ── InsightFace ──────────────────────────────────────────

    def _load_insightface(self):
        if "insightface" in self._models:
            return self._models["insightface"]
        try:
            import insightface
            from insightface.app import FaceAnalysis
            app = FaceAnalysis(
                name="buffalo_l",
                root=os.path.join(CACHE_DIR, "insightface"),
                providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
            )
            app.prepare(ctx_id=0, det_size=(640, 640))
            self._models["insightface"] = app
            logger.info("✅ InsightFace geladen")
        except Exception as e:
            logger.error(f"InsightFace Fehler: {e}")
        return self._models.get("insightface")

    def get_insightface(self):
        return self._models.get("insightface") or self._load_insightface()

    # ── CLIP ─────────────────────────────────────────────────

    def _load_clip(self):
        if "clip" in self._models:
            return self._models["clip"]
        try:
            import open_clip
            model, _, preprocess = open_clip.create_model_and_transforms(
                "ViT-L-14", pretrained="laion2b_s32b_b82k",
                cache_dir=os.path.join(CACHE_DIR, "clip"),
            )
            model = model.to(self._device).eval()
            self._models["clip"] = {"model": model, "preprocess": preprocess}
            logger.info("✅ CLIP geladen")
        except Exception as e:
            logger.error(f"CLIP Fehler: {e}")
        return self._models.get("clip")

    def get_clip(self):
        return self._models.get("clip") or self._load_clip()

    # ── DINOv2 ───────────────────────────────────────────────

    def get_dinov2(self):
        if "dinov2" not in self._models:
            try:
                model = torch.hub.load("facebookresearch/dinov2", "dinov2_vitl14")
                model = model.to(self._device).eval()
                self._models["dinov2"] = model
                logger.info("✅ DINOv2 geladen")
            except Exception as e:
                logger.error(f"DINOv2 Fehler: {e}")
        return self._models.get("dinov2")

    # ── Florence-2 (Bildanalyse) ─────────────────────────────

    def get_florence2(self):
        if "florence2" not in self._models:
            try:
                from transformers import AutoProcessor, AutoModelForCausalLM
                model_id = "microsoft/Florence-2-large"
                processor = AutoProcessor.from_pretrained(
                    model_id, cache_dir=os.path.join(CACHE_DIR, "florence2"), trust_remote_code=True
                )
                model = AutoModelForCausalLM.from_pretrained(
                    model_id, cache_dir=os.path.join(CACHE_DIR, "florence2"),
                    torch_dtype=torch.float16, trust_remote_code=True,
                ).to(self._device)
                self._models["florence2"] = {"model": model, "processor": processor}
                logger.info("✅ Florence-2 geladen")
            except Exception as e:
                logger.error(f"Florence-2 Fehler: {e}")
        return self._models.get("florence2")

    # ── FLUX.1 Dev (Bildgenerierung) ─────────────────────────

    def get_flux(self):
        if "flux" not in self._models:
            try:
                from diffusers import FluxPipeline
                pipe = FluxPipeline.from_pretrained(
                    "black-forest-labs/FLUX.1-dev",
                    torch_dtype=torch.bfloat16,
                    cache_dir=os.path.join(CACHE_DIR, "flux"),
                )
                pipe.enable_model_cpu_offload()
                self._models["flux"] = pipe
                logger.info("✅ FLUX.1 Dev geladen")
            except Exception as e:
                logger.error(f"FLUX Fehler: {e}")
        return self._models.get("flux")

    # ── FLUX.1-schnell (Lite-Modus — läuft auf 8GB+ VRAM) ────

    def get_flux_schnell(self):
        if "flux_schnell" not in self._models:
            try:
                from diffusers import FluxPipeline
                pipe = FluxPipeline.from_pretrained(
                    "black-forest-labs/FLUX.1-schnell",
                    torch_dtype=torch.bfloat16,
                    cache_dir=os.path.join(CACHE_DIR, "flux-schnell"),
                )
                pipe.enable_model_cpu_offload()  # hilft auch auf 8GB-Karten
                self._models["flux_schnell"] = pipe
                logger.info("✅ FLUX.1-schnell geladen (Lite-Modus)")
            except Exception as e:
                logger.error(f"FLUX.1-schnell Fehler: {e}")
        return self._models.get("flux_schnell")

    def get_flux_schnell_img2img(self):
        """Für Charakter-Konsistenz im Lite-Modus: img2img mit Referenzbild als Start."""
        if "flux_schnell_img2img" not in self._models:
            try:
                from diffusers import FluxImg2ImgPipeline
                base = self.get_flux_schnell()
                if base is None:
                    return None
                pipe = FluxImg2ImgPipeline.from_pipe(base)
                self._models["flux_schnell_img2img"] = pipe
                logger.info("✅ FLUX.1-schnell img2img geladen (Lite-Modus)")
            except Exception as e:
                logger.error(f"FLUX.1-schnell img2img Fehler: {e}")
        return self._models.get("flux_schnell_img2img")

    # ── IP-Adapter (Character Lock) ──────────────────────────

    def get_ip_adapter(self):
        if "ip_adapter" not in self._models:
            try:
                from ip_adapter import IPAdapterPlusXL
                pipe = self.get_flux()
                if pipe:
                    ip_adapter = IPAdapterPlusXL(
                        pipe,
                        image_encoder_path=os.path.join(CACHE_DIR, "ip_adapter/image_encoder"),
                        ip_ckpt=os.path.join(CACHE_DIR, "ip_adapter/ip-adapter-plus_sdxl.bin"),
                        device=self._device,
                    )
                    self._models["ip_adapter"] = ip_adapter
                    logger.info("✅ IP-Adapter geladen")
            except Exception as e:
                logger.error(f"IP-Adapter Fehler: {e}")
        return self._models.get("ip_adapter")

    # ── Wan 2.2 (Videogenerierung) ───────────────────────────

    def get_wan(self):
        if "wan" not in self._models:
            try:
                from diffusers import WanPipeline
                pipe = WanPipeline.from_pretrained(
                    "Wan-AI/Wan2.2-T2V-14B",
                    torch_dtype=torch.bfloat16,
                    cache_dir=os.path.join(CACHE_DIR, "wan"),
                )
                pipe.enable_model_cpu_offload()
                self._models["wan"] = pipe
                logger.info("✅ Wan 2.2 geladen")
            except Exception as e:
                logger.error(f"Wan 2.2 Fehler: {e}")
        return self._models.get("wan")

    # ── LLM für Story-Generierung ────────────────────────────

    def get_llm(self, model_name: str = "qwen3"):
        key = f"llm_{model_name}"
        if key not in self._models:
            try:
                from transformers import AutoTokenizer, AutoModelForCausalLM
                model_ids = {
                    "qwen3":    "Qwen/Qwen3-8B",
                    "deepseek": "deepseek-ai/DeepSeek-R1-Distill-Qwen-7B",
                    "llama4":   "meta-llama/Llama-4-Scout-17B-16E-Instruct",
                }
                model_id = model_ids.get(model_name, model_ids["qwen3"])
                tokenizer = AutoTokenizer.from_pretrained(
                    model_id, cache_dir=os.path.join(CACHE_DIR, "llm")
                )
                model = AutoModelForCausalLM.from_pretrained(
                    model_id, torch_dtype=torch.bfloat16,
                    device_map="auto",
                    cache_dir=os.path.join(CACHE_DIR, "llm"),
                )
                self._models[key] = {"model": model, "tokenizer": tokenizer}
                logger.info(f"✅ LLM geladen: {model_name}")
            except Exception as e:
                logger.error(f"LLM Fehler ({model_name}): {e}")
        return self._models.get(key)

    # ── XTTS-v2 (Voice) ─────────────────────────────────────

    def get_xtts(self):
        if "xtts" not in self._models:
            try:
                from TTS.api import TTS
                tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(self._device)
                self._models["xtts"] = tts
                logger.info("✅ XTTS-v2 geladen")
            except Exception as e:
                logger.error(f"XTTS Fehler: {e}")
        return self._models.get("xtts")

    # ── Hilfsmethoden ────────────────────────────────────────

    def unload(self, key: str):
        if key in self._models:
            del self._models[key]
            gc.collect()
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
            logger.info(f"🗑  Modell entladen: {key}")

    def get_loaded_models(self) -> list[str]:
        return list(self._models.keys())

    def get_gpu_info(self) -> dict:
        if not torch.cuda.is_available():
            return {"available": False}
        info = []
        for i in range(self._gpu_count):
            props = torch.cuda.get_device_properties(i)
            used = torch.cuda.memory_allocated(i) / 1024**3
            total = props.total_memory / 1024**3
            info.append({
                "id": i, "name": props.name,
                "vram_total_gb": round(total, 1),
                "vram_used_gb": round(used, 2),
                "vram_free_gb": round(total - used, 2),
            })
        return {"available": True, "gpus": info}

    def cleanup(self):
        self._models.clear()
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
