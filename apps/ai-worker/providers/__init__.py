# ============================================================
#  apps/ai-worker/providers/__init__.py
#  Zentrale Weiche: AI_PROVIDER=local|cloud|lite entscheidet,
#  welche Pipeline-Implementierung genutzt wird.
#
#  local = volle Enterprise-Pipeline (Wan 2.2, FLUX.1 Dev, PuLID...)
#          braucht 24GB+ VRAM und große Modell-Downloads
#  cloud = gehostete APIs (Replicate/Anthropic/ElevenLabs)
#          keine GPU nötig, aber laufende Kosten pro Generierung
#  lite  = leichte lokale Modelle (FLUX.1-schnell, Ollama, Piper)
#          läuft auf normaler Gaming-GPU (8GB+ VRAM), $0 laufende Kosten,
#          dafür geringere Qualität/Konsistenz als 'local' oder 'cloud'
# ============================================================

import os

def get_provider_mode() -> str:
    return os.getenv("AI_PROVIDER", "local").lower()

def is_cloud_mode() -> bool:
    return get_provider_mode() == "cloud"

def is_lite_mode() -> bool:
    return get_provider_mode() == "lite"

def is_local_mode() -> bool:
    return get_provider_mode() == "local"
