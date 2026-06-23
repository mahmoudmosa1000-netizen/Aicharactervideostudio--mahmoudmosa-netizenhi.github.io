# ============================================================
#  apps/ai-worker/routers/character.py
# ============================================================

from fastapi import APIRouter, Request
from pydantic import BaseModel
from pipelines.character_dna import CharacterDNAPipeline

router = APIRouter()

class AnalyzeRequest(BaseModel):
    characterId: str
    imagePaths: list[str]

@router.post("")
async def analyze_character(req: AnalyzeRequest, request: Request):
    pipeline = CharacterDNAPipeline(request.app.state.model_manager)
    return await pipeline.analyze(req.characterId, req.imagePaths)


# ============================================================
#  apps/ai-worker/routers/image.py
# ============================================================

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from pipelines.image_gen import ImageGenerationPipeline

router = APIRouter()

class ImageRequest(BaseModel):
    characterPrompt: str
    scenePrompt: str
    cameraPrompt: str = ""
    lightingPrompt: str = ""
    environmentPrompt: str = ""
    motionPrompt: str = ""
    negativePrompt: str = ""
    characterId: Optional[str] = None
    referenceImagePaths: Optional[list[str]] = None
    ipAdapterWeight: float = 0.8
    width: int = 1024
    height: int = 576
    steps: int = 30
    seed: Optional[int] = None

@router.post("")
async def generate_image(req: ImageRequest, request: Request):
    pipeline = ImageGenerationPipeline(request.app.state.model_manager)
    return await pipeline.generate(**req.model_dump(by_alias=False))


# ============================================================
#  apps/ai-worker/routers/video.py
# ============================================================

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from pipelines.video_gen import VideoGenerationPipeline

router = APIRouter()

class VideoRequest(BaseModel):
    imagePath: str
    prompt: str
    motionPrompt: str = ""
    cameraPrompt: str = ""
    negativePrompt: str = ""
    durationSeconds: int = 5
    fps: int = 24
    width: int = 1280
    height: int = 720
    seed: Optional[int] = None

@router.post("")
async def generate_video(req: VideoRequest, request: Request):
    pipeline = VideoGenerationPipeline(request.app.state.model_manager)
    return await pipeline.generate(
        image_path=req.imagePath,
        prompt=req.prompt,
        motion_prompt=req.motionPrompt,
        camera_prompt=req.cameraPrompt,
        negative_prompt=req.negativePrompt,
        duration_seconds=req.durationSeconds,
        fps=req.fps,
        width=req.width,
        height=req.height,
        seed=req.seed,
    )


# ============================================================
#  apps/ai-worker/routers/story.py
# ============================================================

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from pipelines.story_gen import StoryGenerationPipeline

router = APIRouter()

class StoryRequest(BaseModel):
    idea: str
    characterIds: Optional[list[str]] = None
    sceneCount: int = 10
    genre: str = "Abenteuer"
    language: str = "de"
    llmModel: str = "qwen3"

@router.post("")
async def generate_story(req: StoryRequest, request: Request):
    pipeline = StoryGenerationPipeline(request.app.state.model_manager)
    return await pipeline.generate(
        idea=req.idea,
        character_ids=req.characterIds,
        scene_count=req.sceneCount,
        genre=req.genre,
        language=req.language,
        llm_model=req.llmModel,
    )


# ============================================================
#  apps/ai-worker/routers/voice.py
# ============================================================

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional
from pipelines.story_gen import VoiceGenerationPipeline  # in voice_gen.py

router = APIRouter()

class CloneRequest(BaseModel):
    audioPath: str
    characterId: Optional[str] = None
    language: str = "de"
    model: str = "xtts-v2"

class SynthesizeRequest(BaseModel):
    text: str
    speakerEmbeddingId: str
    language: str = "de"
    emotion: str = "neutral"
    speed: float = 1.0

@router.post("/clone-voice")
async def clone_voice(req: CloneRequest, request: Request):
    from pipelines.voice_gen import VoiceGenerationPipeline as VGP
    pipeline = VGP(request.app.state.model_manager)
    return await pipeline.clone_voice(req.audioPath, req.characterId, req.language, req.model)

@router.post("/synthesize-voice")
async def synthesize(req: SynthesizeRequest, request: Request):
    from pipelines.voice_gen import VoiceGenerationPipeline as VGP
    pipeline = VGP(request.app.state.model_manager)
    return await pipeline.synthesize(
        req.text, req.speakerEmbeddingId, req.language, req.emotion, req.speed
    )


# ============================================================
#  apps/ai-worker/routers/assembly.py
#  FFmpeg: Alle Clips + Audio zusammenfügen
# ============================================================

import os
import uuid
import subprocess
import logging
from pathlib import Path
from fastapi import APIRouter, Request
from pydantic import BaseModel

router = APIRouter()
logger = logging.getLogger("assembly")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "./storage/outputs")

class AssemblyRequest(BaseModel):
    videoId: str
    videoPaths: list[str] = []
    audioPath: str | None = None
    outputFormat: str = "mp4"

@router.post("")
async def assemble(req: AssemblyRequest, request: Request):
    out_folder = Path(OUTPUT_DIR) / "final"
    out_folder.mkdir(parents=True, exist_ok=True)
    output_path = out_folder / f"{req.videoId}_{uuid.uuid4().hex[:8]}.{req.outputFormat}"

    if len(req.videoPaths) == 1 and not req.audioPath:
        # Nur ein Clip, kein Audio → direkt kopieren
        import shutil
        shutil.copy(req.videoPaths[0], output_path)
    elif len(req.videoPaths) > 1:
        # Mehrere Clips zusammenfügen
        list_file = Path(OUTPUT_DIR) / f"concat_{req.videoId}.txt"
        list_file.write_text("\n".join(f"file '{p}'" for p in req.videoPaths))
        cmd = ["ffmpeg", "-y", "-f", "concat", "-safe", "0",
               "-i", str(list_file), "-c", "copy", str(output_path)]
        subprocess.run(cmd, check=True)
        list_file.unlink(missing_ok=True)
    
    if req.audioPath and output_path.exists():
        final_path = out_folder / f"{req.videoId}_final.{req.outputFormat}"
        cmd = ["ffmpeg", "-y", "-i", str(output_path), "-i", req.audioPath,
               "-c:v", "copy", "-c:a", "aac", "-shortest", str(final_path)]
        subprocess.run(cmd, check=True)
        output_path = final_path

    file_size = os.path.getsize(output_path) if output_path.exists() else 0
    logger.info(f"✅ Assembly abgeschlossen: {output_path}")
    return {"outputPath": str(output_path), "fileSize": file_size, "duration": 0}


# ============================================================
#  Export Center — Social-Media-Formate
#  (Teil von assembly.py, da es ebenfalls FFmpeg-basiert ist)
# ============================================================

class ExportSocialRequest(BaseModel):
    sourcePath: str
    targetWidth: int = 1080
    targetHeight: int = 1920
    targetFormat: str = "mp4"
    maxDurationSeconds: int | None = None
    cropMode: str = "smart"   # smart|center|blur-padding

export_router = APIRouter()

@export_router.post("")
async def export_social(req: ExportSocialRequest):
    out_folder = Path(OUTPUT_DIR) / "exports"
    out_folder.mkdir(parents=True, exist_ok=True)
    output_path = out_folder / f"{uuid.uuid4()}.{req.targetFormat}"

    # Seitenverhältnis-Anpassung je nach Crop-Modus
    if req.cropMode == "blur-padding":
        # Video mittig verkleinert + verschwommener Hintergrund füllt den Rest
        vf = (
            f"split=2[bg][fg];"
            f"[bg]scale={req.targetWidth}:{req.targetHeight},boxblur=20:5[bg];"
            f"[fg]scale={req.targetWidth}:-1[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2"
        )
    elif req.cropMode == "smart":
        # Zentrierter Crop auf Zielformat (einfache Heuristik — Motiv meist mittig)
        vf = (
            f"scale={req.targetWidth}:{req.targetHeight}:force_original_aspect_ratio=increase,"
            f"crop={req.targetWidth}:{req.targetHeight}"
        )
    else:  # center
        vf = f"scale={req.targetWidth}:{req.targetHeight}:force_original_aspect_ratio=decrease,pad={req.targetWidth}:{req.targetHeight}:(ow-iw)/2:(oh-ih)/2"

    cmd = ["ffmpeg", "-y", "-i", req.sourcePath, "-vf", vf]

    if req.maxDurationSeconds:
        cmd += ["-t", str(req.maxDurationSeconds)]

    cmd += ["-c:v", "libx264", "-crf", "20", "-preset", "medium",
            "-c:a", "aac", "-movflags", "+faststart", str(output_path)]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"FFmpeg Export-Fehler: {result.stderr}")

    file_size = os.path.getsize(output_path)
    logger.info(f"📤 Social Export fertig: {output_path} ({req.targetWidth}x{req.targetHeight})")
    return {"outputPath": str(output_path), "fileSize": file_size}
