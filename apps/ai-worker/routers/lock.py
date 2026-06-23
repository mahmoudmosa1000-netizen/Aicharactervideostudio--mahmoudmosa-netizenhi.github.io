# ============================================================
#  apps/ai-worker/routers/lock.py
#  Endpunkte für Character Lock Engine & tiefe Bildanalyse
# ============================================================

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


# ── Character Lock anwenden ──────────────────────────────────

class LockRequest(BaseModel):
    prompt: str
    negativePrompt: str = ""
    referenceImagePaths: list[str]
    method: str = "auto"          # auto|ip_adapter|pulid|instant_id|consis_id|photomaker_v2
    identityWeight: float = 0.8
    hasFace: bool = True
    isVideoFrame: bool = False
    width: int = 1024
    height: int = 1024
    steps: int = 30
    seed: Optional[int] = None


@router.post("/apply")
async def apply_character_lock(req: LockRequest, request: Request):
    from pipelines.character_lock import CharacterLockEngine, LockMethod
    engine = CharacterLockEngine(request.app.state.model_manager)

    result = await engine.apply_lock(
        prompt=req.prompt,
        negative_prompt=req.negativePrompt,
        reference_image_paths=req.referenceImagePaths,
        method=LockMethod(req.method),
        identity_weight=req.identityWeight,
        has_face=req.hasFace,
        is_video_frame=req.isVideoFrame,
        width=req.width,
        height=req.height,
        steps=req.steps,
        seed=req.seed,
    )

    # Bild speichern
    import uuid, os
    from pathlib import Path
    out_dir = Path(os.getenv("OUTPUT_DIR", "./storage/outputs")) / "locked"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / f"{uuid.uuid4()}.png"
    result.image.save(out_path)

    return {
        "imagePath": str(out_path),
        "methodUsed": result.method_used.value,
        "identityScore": result.identity_score,
        "metadata": result.metadata,
    }


# ── Konsistenz-Validierung ───────────────────────────────────

class ValidateRequest(BaseModel):
    generatedImagePath: str
    referenceImagePaths: list[str]


@router.post("/validate")
async def validate_consistency(req: ValidateRequest, request: Request):
    from pipelines.character_lock import CharacterLockEngine
    from PIL import Image

    engine = CharacterLockEngine(request.app.state.model_manager)
    generated = Image.open(req.generatedImagePath).convert("RGB")
    return await engine.validate_consistency(generated, req.referenceImagePaths)


# ── Tiefe Bildanalyse (Qwen2.5-VL / InternVL) ───────────────

class DeepAnalysisRequest(BaseModel):
    imagePath: str
    model: str = "qwen2.5-vl"     # qwen2.5-vl|internvl


@router.post("/deep-analyze")
async def deep_analyze(req: DeepAnalysisRequest, request: Request):
    from pipelines.image_analysis import DeepImageAnalysisPipeline
    pipeline = DeepImageAnalysisPipeline(request.app.state.model_manager)

    analysis = await pipeline.analyze(req.imagePath, model=req.model)
    profile = pipeline.to_character_profile(analysis)
    return {"analysis": analysis, "profile": profile}
