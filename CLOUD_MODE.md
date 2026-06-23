# Cloud-Modus — Videos erstellen ohne eigene GPU

## Warum dieser Modus existiert

Die volle lokale Pipeline (Wan 2.2, FLUX.1, PuLID, Qwen3, XTTS-v2, ...) erfordert:
- Eine GPU mit mindestens 24GB VRAM (besser: 32GB+)
- 80–150GB an Modell-Downloads
- Korrekt funktionierende Versionen mehrerer Research-Pakete

Ohne das passiert genau das, was du gesehen hast: **keine Videos**.

Der Cloud-Modus ersetzt die lokalen Modelle durch gehostete APIs. Funktioniert auf jedem normalen Rechner — auch ohne GPU.

## Was sich ändert

| Funktion | Lokal | Cloud |
|---|---|---|
| Character-Analyse | Florence-2 + InsightFace + CLIP + DINOv2 | Claude Vision |
| Bildgenerierung | FLUX.1 Dev + IP-Adapter/PuLID/InstantID | FLUX via Replicate (Referenzbild-Input) |
| Videogenerierung | Wan 2.2 / LTX / CogVideoX | Bild→Video via Replicate |
| Story-Generierung | Qwen3 / DeepSeek / Llama 4 | Claude API |
| Sprachsynthese | XTTS-v2 | ElevenLabs |
| Vektor-Embeddings | Qdrant (lokal berechnet) | Entfällt — Konsistenz über direkten Bild-Input |

**Ehrlicher Kompromiss:** Die Charakter-Konsistenz im Cloud-Modus ist spürbar schwächer als mit PuLID/InstantID, weil diese spezialisierten Identity-Preservation-Modelle nicht als einfache gehostete API existieren. Für "gut genug für die meisten Anwendungsfälle" reicht es; für pixelgenaue Konsistenz über hunderte Videos (wie in der ursprünglichen Spezifikation) brauchst du letztlich doch die lokale GPU-Pipeline.

## Setup (5 Minuten)

```bash
cp .env.cloud.example .env
```

Drei API-Keys eintragen:

1. **Replicate** → [replicate.com/account/api-tokens](https://replicate.com/account/api-tokens)
2. **Anthropic** → [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)
3. **ElevenLabs** → [elevenlabs.io/app/settings/api-keys](https://elevenlabs.io/app/settings/api-keys) (optional — ohne Key funktioniert alles außer Sprachsynthese)

```bash
docker compose -f docker-compose.cloud.yml up --build
```

Prüfen, ob der Cloud-Modus aktiv ist:

```bash
curl http://localhost:8000/health
# → {"status": "ok", "provider_mode": "cloud", ...}
```

## Kosten

Kein Abo, reines Pay-per-Use. Grobe Richtwerte für ein 10-Szenen-Video:

| Posten | Kosten |
|---|---|
| 10× Bildgenerierung | ~$0.05 |
| 10× Bild→Video | ~$1.00 |
| 1× Story-Generierung | ~$0.03 |
| Voice-Over (optional) | ~$0.50 |
| **Gesamt** | **~$1.50 – $2.50** |

## Zurück zum lokalen Modus

Einfach `AI_PROVIDER=local` in `.env` setzen und mit der ursprünglichen `docker-compose.yml` starten — der Code ist identisch, nur die Provider-Weiche (`apps/ai-worker/providers/__init__.py`) entscheidet zur Laufzeit.

## Bekannte Einschränkungen des Cloud-Modus

- Die exakten Replicate-Modell-Slugs (`MODELS` in `providers/replicate_client.py`) können veraltet sein — Replicate aktualisiert Modellversionen. Bei Fehlern dort nachschauen und den Slug anpassen.
- Lange Videos (>5s) können bei manchen gehosteten Bild→Video-Modellen Frame-Limits haben — siehe `num_frames`-Begrenzung in `video_gen.py`.
- Es gibt noch keine Kosten-Obergrenze/Budget-Limit im Code — bei intensiver Nutzung selbst im Replicate/Anthropic-Dashboard im Blick behalten.
