# ============================================================
#  infrastructure/docker/ai-worker-lite.Dockerfile
#  Cloud-Modus: KEIN CUDA, KEIN PyTorch-Download (~30GB gespart).
#  Läuft auf jedem normalen Rechner/Server — die eigentliche
#  KI-Arbeit passiert bei Replicate/Anthropic/ElevenLabs extern.
#
#  Nutzen: docker-compose.cloud.yml verwendet dieses Dockerfile
#  statt ai-worker.Dockerfile (welches weiterhin für AI_PROVIDER=local
#  mit echter GPU gebraucht wird).
# ============================================================

FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1-mesa-glx \
    libglib2.0-0 \
    curl \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Nur die schlanken Cloud-Abhängigkeiten — kein torch, kein
# diffusers, kein insightface. Siehe requirements-cloud.txt.
COPY requirements-cloud.txt .
RUN pip install -r requirements-cloud.txt

COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
