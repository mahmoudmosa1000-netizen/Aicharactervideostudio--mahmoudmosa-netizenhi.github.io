# ============================================================
#  infrastructure/docker/ai-worker-lite.Dockerfile
#  Lite-Modus: FLUX.1-schnell braucht noch eine GPU (8GB+),
#  aber KEIN Wan 2.2, KEIN XTTS-v2, KEIN InsightFace/CLIP/DINOv2.
#  Deutlich kleineres Image als ai-worker.Dockerfile (Enterprise).
# ============================================================

FROM nvidia/cuda:12.4.1-cudnn-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 python3-pip ffmpeg libgl1-mesa-glx libglib2.0-0 curl \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 \
    && update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

WORKDIR /app

# Nur PyTorch + diffusers + Piper — kein insightface, kein TTS-Paket (XTTS),
# kein onnxruntime-gpu. Spart mehrere GB gegenüber dem Enterprise-Image.
RUN pip install torch==2.5.1 torchvision==0.20.1 \
    --index-url https://download.pytorch.org/whl/cu124

COPY requirements-lite.txt .
RUN pip install -r requirements-lite.txt

COPY . .

EXPOSE 8000
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
