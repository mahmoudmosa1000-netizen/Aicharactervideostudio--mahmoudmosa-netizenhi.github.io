# ============================================================
#  apps/ai-worker/routers/prompts.py
#  Endpunkt für Advanced Prompt Builder
# ============================================================

from fastapi import APIRouter, Request
from pydantic import BaseModel
from typing import Optional

router = APIRouter()


class BuildPromptsRequest(BaseModel):
    characterProfile: dict = {}
    sceneDraft: dict
    mode: str = "template"        # template|refine
    llmModel: str = "qwen3"


@router.post("")
async def build_prompts(req: BuildPromptsRequest, request: Request):
    from pipelines.prompt_builder import PromptBuilderPipeline
    pipeline = PromptBuilderPipeline(request.app.state.model_manager)

    if req.mode == "refine":
        result = await pipeline.refine_with_llm(req.characterProfile, req.sceneDraft, req.llmModel)
    else:
        result = pipeline.build_from_template(req.characterProfile, req.sceneDraft)

    return {"prompts": result}
