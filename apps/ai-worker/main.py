# ============================================================
#  AI Character Video Studio Pro
#  apps/ai-worker/main.py — FastAPI Entry Point
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging

from models.model_manager import ModelManager
from routers import character, image, video, voice, story, assembly, lock, prompts

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ai-worker")

# ── Globaler Model Manager ───────────────────────────────────
model_manager = ModelManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    from providers import get_provider_mode
    mode = get_provider_mode()
    logger.info(f"🚀 AI Worker startet — Modus: {mode.upper()}")
    if mode == "cloud":
        logger.info("☁️  Cloud-Modus: Replicate (Bild/Video) + Anthropic (Story) + ElevenLabs (Voice)")
        logger.info("   Keine lokalen GPU-Modelle werden geladen.")
    else:
        logger.info("🖥  Lokaler Modus: lade Basismodelle...")
    await model_manager.preload_base_models()
    logger.info("✅ AI Worker bereit")
    yield
    logger.info("🛑 AI Worker fährt herunter...")
    model_manager.cleanup()


app = FastAPI(
    title="AI Character Video Studio — AI Worker",
    description="KI-Pipeline für Character DNA, Bildgenerierung, Video und Voice",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# State: ModelManager für alle Router zugänglich machen
app.state.model_manager = model_manager

# ── Router einbinden ─────────────────────────────────────────
app.include_router(character.router, prefix="/analyze-character", tags=["Character DNA"])
app.include_router(lock.router,      prefix="/character-lock",     tags=["Character Lock Engine"])
app.include_router(prompts.router,   prefix="/build-prompts",      tags=["Prompt Builder"])
app.include_router(image.router,     prefix="/generate-image",    tags=["Image Generation"])
app.include_router(video.router,     prefix="/generate-video",    tags=["Video Generation"])
app.include_router(voice.router,     prefix="/voice",             tags=["Voice Synthesis"])
app.include_router(story.router,     prefix="/generate-story",    tags=["Story Generation"])
app.include_router(assembly.router,  prefix="/assemble",          tags=["Assembly"])
app.include_router(assembly.export_router, prefix="/export-social", tags=["Export Center"])


@app.get("/health")
async def health():
    from providers import get_provider_mode
    return {
        "status": "ok",
        "provider_mode": get_provider_mode(),
        "models_loaded": model_manager.get_loaded_models(),
        "gpu_info": model_manager.get_gpu_info(),
    }
