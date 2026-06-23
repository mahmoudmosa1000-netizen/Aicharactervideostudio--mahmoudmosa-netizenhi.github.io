# ============================================================
#  infrastructure/tensorrt/optimize_models.py
#  Konvertiert wiederkehrend genutzte Modelle zu TensorRT-
#  Engines für schnellere Inferenz (typisch 2-4x Speedup
#  gegenüber nativem PyTorch auf NVIDIA-GPUs).
#
#  WANN SICH DAS LOHNT:
#  - InsightFace/CLIP/DINOv2 laufen bei JEDEM Charakter-Upload
#    und JEDER Generierung → hohe Frequenz, lohnt sich immer.
#  - FLUX.1/Wan 2.2 sind sehr groß und ändern sich selten →
#    einmalige Kompilierung amortisiert sich schnell bei Skalierung.
#  - LLMs (Qwen3 etc.) NICHT hier optimieren — dafür ist vLLM/
#    SGLang besser geeignet (siehe infrastructure/vllm/).
#
#  Nutzung:
#    python optimize_models.py --model insightface --precision fp16
#    python optimize_models.py --model clip --precision fp16
#    python optimize_models.py --model flux --precision fp8
# ============================================================

import argparse
import logging
import os
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("tensorrt-optimize")

CACHE_DIR = os.getenv("MODEL_CACHE_DIR", "./storage/models")
ENGINE_DIR = Path(CACHE_DIR) / "tensorrt-engines"


def optimize_onnx_model(model_name: str, onnx_path: str, precision: str = "fp16"):
    """
    Generischer ONNX → TensorRT Pfad für Embedding-Modelle
    (InsightFace, CLIP, DINOv2). Diese Modelle sind klein genug
    um komplett zu TensorRT kompiliert zu werden.
    """
    import tensorrt as trt

    ENGINE_DIR.mkdir(parents=True, exist_ok=True)
    engine_path = ENGINE_DIR / f"{model_name}_{precision}.engine"

    logger.info(f"🔧 Kompiliere {model_name} → TensorRT ({precision})")

    builder = trt.Builder(trt.Logger(trt.Logger.WARNING))
    network = builder.create_network(1 << int(trt.NetworkDefinitionCreationFlag.EXPLICIT_BATCH))
    parser = trt.OnnxParser(network, builder.logger)

    with open(onnx_path, "rb") as f:
        if not parser.parse(f.read()):
            for i in range(parser.num_errors):
                logger.error(parser.get_error(i))
            raise RuntimeError(f"ONNX-Parsing fehlgeschlagen: {model_name}")

    config = builder.create_builder_config()
    config.set_memory_pool_limit(trt.MemoryPoolType.WORKSPACE, 4 << 30)  # 4GB Workspace

    if precision == "fp16":
        config.set_flag(trt.BuilderFlag.FP16)
    elif precision == "fp8":
        config.set_flag(trt.BuilderFlag.FP8)
    elif precision == "int8":
        config.set_flag(trt.BuilderFlag.INT8)
        logger.warning("⚠ INT8 benötigt Kalibrierungsdaten — Genauigkeit kann leiden")

    # Dynamische Batch-Größen erlauben (1 bis 8 Referenzbilder pro Charakter)
    profile = builder.create_optimization_profile()
    input_tensor = network.get_input(0)
    shape = input_tensor.shape
    profile.set_shape(
        input_tensor.name,
        min=(1, *shape[1:]), opt=(4, *shape[1:]), max=(8, *shape[1:]),
    )
    config.add_optimization_profile(profile)

    serialized_engine = builder.build_serialized_network(network, config)
    if serialized_engine is None:
        raise RuntimeError(f"TensorRT-Build fehlgeschlagen: {model_name}")

    with open(engine_path, "wb") as f:
        f.write(serialized_engine)

    logger.info(f"✅ Engine gespeichert: {engine_path}")
    return str(engine_path)


def export_insightface_to_onnx() -> str:
    """InsightFace-Backbone (ArcFace) zu ONNX exportieren."""
    onnx_path = Path(CACHE_DIR) / "onnx" / "insightface_arcface.onnx"
    onnx_path.parent.mkdir(parents=True, exist_ok=True)
    logger.info("📦 Exportiere InsightFace ArcFace-Backbone zu ONNX...")
    # In der Praxis: insightface stellt bereits .onnx-Dateien bereit
    # (buffalo_l Modellpaket) — hier nur der Pfad-Verweis.
    return str(onnx_path)


def export_clip_to_onnx() -> str:
    """CLIP Vision-Encoder zu ONNX exportieren."""
    import torch
    import open_clip

    onnx_path = Path(CACHE_DIR) / "onnx" / "clip_vit_l14.onnx"
    onnx_path.parent.mkdir(parents=True, exist_ok=True)

    logger.info("📦 Exportiere CLIP ViT-L/14 zu ONNX...")
    model, _, _ = open_clip.create_model_and_transforms("ViT-L-14", pretrained="laion2b_s32b_b82k")
    model.eval()

    dummy_input = torch.randn(1, 3, 224, 224)
    torch.onnx.export(
        model.visual, dummy_input, str(onnx_path),
        input_names=["pixel_values"], output_names=["image_embeds"],
        dynamic_axes={"pixel_values": {0: "batch"}, "image_embeds": {0: "batch"}},
        opset_version=17,
    )
    return str(onnx_path)


MODEL_EXPORTERS = {
    "insightface": export_insightface_to_onnx,
    "clip": export_clip_to_onnx,
}


def main():
    parser = argparse.ArgumentParser(description="TensorRT Modell-Optimierung")
    parser.add_argument("--model", required=True, choices=["insightface", "clip", "dinov2"])
    parser.add_argument("--precision", default="fp16", choices=["fp16", "fp8", "int8"])
    args = parser.parse_args()

    exporter = MODEL_EXPORTERS.get(args.model)
    if not exporter:
        logger.error(f"Kein ONNX-Export für {args.model} definiert")
        return

    onnx_path = exporter()
    engine_path = optimize_onnx_model(args.model, onnx_path, args.precision)
    logger.info(f"🎉 Fertig: {args.model} → {engine_path}")
    logger.info(
        "   model_manager.py muss die Engine-Datei statt des PyTorch-Modells "
        "laden (siehe TensorRTInferenceWrapper in model_manager.py)"
    )


if __name__ == "__main__":
    main()
