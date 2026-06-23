# ============================================================
#  apps/ai-worker/pipelines/character_dna.py
#  Character DNA Pipeline — InsightFace + CLIP + DINOv2 + Florence-2
# ============================================================

import os
import uuid
import logging
import numpy as np
from PIL import Image
from typing import Optional
import torch

from providers import is_cloud_mode, is_lite_mode

logger = logging.getLogger("character_dna")

QDRANT_URL        = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY    = os.getenv("QDRANT_API_KEY", "")
OUTPUT_DIR        = os.getenv("OUTPUT_DIR", "./storage/outputs")

# Qdrant Collection-Namen
COL_FACE     = "character_face_embeddings"
COL_STYLE    = "character_style_embeddings"
COL_BODY     = "character_body_embeddings"


class CharacterDNAPipeline:
    """
    Vollständige Character DNA Analyse-Pipeline.
    Schritt 1: Bilder analysieren (Florence-2)
    Schritt 2: Gesicht extrahieren (InsightFace) → 512d
    Schritt 3: Style Embedding (CLIP) → 768d
    Schritt 4: Body Embedding (DINOv2) → 1024d
    Schritt 5: Alles in Qdrant speichern
    """

    def __init__(self, model_manager):
        self.mm = model_manager
        self._qdrant = None

    def _get_qdrant(self):
        if self._qdrant is None:
            from qdrant_client import QdrantClient
            self._qdrant = QdrantClient(url=QDRANT_URL, api_key=QDRANT_API_KEY or None)
            self._ensure_collections()
        return self._qdrant

    def _ensure_collections(self):
        from qdrant_client.models import VectorParams, Distance
        client = self._qdrant
        existing = {c.name for c in client.get_collections().collections}
        specs = [
            (COL_FACE,  512,  Distance.COSINE),
            (COL_STYLE, 768,  Distance.COSINE),
            (COL_BODY,  1024, Distance.COSINE),
        ]
        for name, size, dist in specs:
            if name not in existing:
                client.create_collection(name, vectors_config=VectorParams(size=size, distance=dist))
                logger.info(f"📦 Qdrant Collection erstellt: {name}")

    # ── Hauptmethode ─────────────────────────────────────────

    async def analyze(self, character_id: str, image_paths: list[str]) -> dict:
        logger.info(f"🧬 Starte DNA-Analyse für Charakter {character_id} ({len(image_paths)} Bilder)")

        # ── CLOUD-MODUS: Claude Vision statt Florence-2/InsightFace/CLIP/DINOv2 ──
        if is_cloud_mode():
            return await self._analyze_cloud(character_id, image_paths)

        # ── LITE-MODUS: reine Farbextraktion, kein GPU/VLM nötig ──
        if is_lite_mode():
            return self._analyze_lite(image_paths)

        images = [Image.open(p).convert("RGB") for p in image_paths]
        results = {"embeddings": [], "profile": {}}

        # ── Schritt 1: Bildanalyse (Florence-2) ─────────────
        description = await self._analyze_with_florence(images[0])
        results["profile"] = self._parse_florence_output(description)
        logger.info("✅ Florence-2 Analyse abgeschlossen")

        # ── Schritt 2: Gesicht (InsightFace) ────────────────
        face_embedding = self._extract_face_embedding(images)
        if face_embedding is not None:
            qdrant_id = str(uuid.uuid4())
            self._store_in_qdrant(COL_FACE, qdrant_id, face_embedding, character_id)
            results["embeddings"].append({
                "type": "FACE", "qdrantId": qdrant_id,
                "collection": COL_FACE, "dimensions": len(face_embedding),
                "model": "insightface-buffalo-l", "score": 0.95,
            })
            logger.info("✅ Gesichts-Embedding gespeichert (512d)")

        # ── Schritt 3: Style (CLIP) ──────────────────────────
        style_embedding = self._extract_clip_embedding(images[0])
        if style_embedding is not None:
            qdrant_id = str(uuid.uuid4())
            self._store_in_qdrant(COL_STYLE, qdrant_id, style_embedding, character_id)
            results["embeddings"].append({
                "type": "STYLE", "qdrantId": qdrant_id,
                "collection": COL_STYLE, "dimensions": len(style_embedding),
                "model": "clip-vit-l-14", "score": 0.92,
            })
            logger.info("✅ Style-Embedding gespeichert (768d)")

        # ── Schritt 4: Body (DINOv2) ────────────────────────
        body_embedding = self._extract_dinov2_embedding(images[0])
        if body_embedding is not None:
            qdrant_id = str(uuid.uuid4())
            self._store_in_qdrant(COL_BODY, qdrant_id, body_embedding, character_id)
            results["embeddings"].append({
                "type": "BODY", "qdrantId": qdrant_id,
                "collection": COL_BODY, "dimensions": len(body_embedding),
                "model": "dinov2-vitl14", "score": 0.90,
            })
            logger.info("✅ Body-Embedding gespeichert (1024d)")

        logger.info(f"🧬 DNA-Analyse abgeschlossen: {len(results['embeddings'])} Embeddings")
        return results

    # ── CLOUD-MODUS: Claude Vision-Analyse ────────────────────

    async def _analyze_cloud(self, character_id: str, image_paths: list[str]) -> dict:
        import base64
        from providers.anthropic_client import get_anthropic_client

        client = get_anthropic_client()
        with open(image_paths[0], "rb") as f:
            image_b64 = base64.b64encode(f.read()).decode()

        media_type = "image/png" if image_paths[0].lower().endswith(".png") else "image/jpeg"

        system_prompt = "Du bist ein Experte für Charakter-Design-Analyse. Antworte NUR mit validem JSON, ohne Markdown-Backticks."
        user_prompt = """Analysiere dieses Charakterbild und antworte mit exakt diesem JSON-Format:
{
  "furColor": "Beschreibung oder null",
  "skinColor": "Beschreibung oder null",
  "eyeColor": "Beschreibung",
  "hairColor": "Beschreibung oder null",
  "bodyType": "Körperform",
  "accessories": ["Accessoire1", "Accessoire2"],
  "clothingStyle": "Stil-Beschreibung",
  "distinctiveFeatures": ["Merkmal1", "Merkmal2"],
  "personality": ["Eigenschaft1", "Eigenschaft2", "Eigenschaft3"]
}"""

        try:
            profile = await client.generate_json_with_image(system_prompt, user_prompt, image_b64, media_type)
            profile["rawAnalysis"] = "Claude Vision Analyse (Cloud-Modus)"
            logger.info("✅ Cloud-DNA-Analyse abgeschlossen (Claude Vision)")
        except Exception as e:
            logger.error(f"Cloud-DNA-Analyse fehlgeschlagen: {e}")
            profile = {"rawAnalysis": f"Analyse fehlgeschlagen: {e}"}

        # Keine lokalen Vektor-Embeddings im Cloud-Modus (kein InsightFace/CLIP/DINOv2).
        # Charakter-Konsistenz läuft im Cloud-Modus stattdessen über direktes
        # Referenzbild-Konditionieren bei der Bildgenerierung (siehe image_gen.py).
        logger.info("ℹ️  Cloud-Modus: keine Embeddings — Konsistenz über Referenzbild-Input bei der Generierung")
        return {"embeddings": [], "profile": profile}

    # ── LITE-MODUS: Farbextraktion ohne jedes ML-Modell ──────

    def _analyze_lite(self, image_paths: list[str]) -> dict:
        from providers.lite_color_extractor import get_lite_color_extractor

        extractor = get_lite_color_extractor()
        image = Image.open(image_paths[0]).convert("RGB")
        profile = extractor.analyze(image)

        logger.info("✅ Lite-DNA-Analyse abgeschlossen (Farbextraktion, kein GPU genutzt)")
        # Auch hier: keine Embeddings — Konsistenz im Lite-Modus läuft über
        # FLUX.1-schnell img2img mit dem Referenzbild als Startpunkt (image_gen.py)
        return {"embeddings": [], "profile": profile}

    # ── Lokaler Modus (Florence-2 + InsightFace + CLIP + DINOv2) ──

    async def _analyze_with_florence(self, image: Image.Image) -> str:
        florence = self.mm.get_florence2()
        if florence is None:
            return ""
        model, processor = florence["model"], florence["processor"]
        task = "<DETAILED_CAPTION>"
        inputs = processor(text=task, images=image, return_tensors="pt").to(model.device)
        with torch.no_grad():
            ids = model.generate(**inputs, max_new_tokens=512)
        return processor.batch_decode(ids, skip_special_tokens=False)[0]

    def _parse_florence_output(self, description: str) -> dict:
        """Extrahiert strukturierte Informationen aus der Florence-Beschreibung."""
        desc_lower = description.lower()
        profile = {"rawAnalysis": description}

        # Einfache Keyword-Extraktion (in Produktion: LLM-basiert)
        colors = ["orange", "white", "black", "brown", "gray", "golden", "cream"]
        detected_colors = [c for c in colors if c in desc_lower]
        if detected_colors:
            profile["furColor"] = " und ".join(detected_colors[:2]).capitalize()

        eye_colors = ["blue", "green", "amber", "brown", "yellow", "red"]
        for ec in eye_colors:
            if ec in desc_lower:
                profile["eyeColor"] = ec.capitalize()
                break

        if "scarf" in desc_lower or "schal" in desc_lower:
            profile["accessories"] = ["Schal"]
        if "apron" in desc_lower or "schürze" in desc_lower:
            profile["accessories"] = profile.get("accessories", []) + ["Schürze"]

        return profile

    # ── InsightFace ──────────────────────────────────────────

    def _extract_face_embedding(self, images: list[Image.Image]) -> Optional[list[float]]:
        app = self.mm.get_insightface()
        if app is None:
            return None
        embeddings = []
        for img in images:
            img_np = np.array(img)[:, :, ::-1]  # RGB → BGR für InsightFace
            faces = app.get(img_np)
            if faces:
                embeddings.append(faces[0].embedding)

        if not embeddings:
            logger.warning("⚠ Kein Gesicht gefunden")
            return None

        # Durchschnitt aller gefundenen Gesichter
        avg = np.mean(embeddings, axis=0)
        avg = avg / np.linalg.norm(avg)  # Normalisieren
        return avg.tolist()

    # ── CLIP ─────────────────────────────────────────────────

    def _extract_clip_embedding(self, image: Image.Image) -> Optional[list[float]]:
        clip_data = self.mm.get_clip()
        if clip_data is None:
            return None
        import open_clip
        model, preprocess = clip_data["model"], clip_data["preprocess"]
        device = next(model.parameters()).device
        img_tensor = preprocess(image).unsqueeze(0).to(device)
        with torch.no_grad():
            features = model.encode_image(img_tensor)
            features = features / features.norm(dim=-1, keepdim=True)
        return features.squeeze().cpu().float().tolist()

    # ── DINOv2 ───────────────────────────────────────────────

    def _extract_dinov2_embedding(self, image: Image.Image) -> Optional[list[float]]:
        model = self.mm.get_dinov2()
        if model is None:
            return None
        from torchvision import transforms
        transform = transforms.Compose([
            transforms.Resize(518),
            transforms.CenterCrop(518),
            transforms.ToTensor(),
            transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
        ])
        device = next(model.parameters()).device
        tensor = transform(image).unsqueeze(0).to(device)
        with torch.no_grad():
            features = model(tensor)
        features = features / features.norm(dim=-1, keepdim=True)
        return features.squeeze().cpu().float().tolist()

    # ── Qdrant speichern ─────────────────────────────────────

    def _store_in_qdrant(self, collection: str, point_id: str, vector: list, character_id: str):
        from qdrant_client.models import PointStruct
        client = self._get_qdrant()
        client.upsert(
            collection_name=collection,
            points=[PointStruct(id=point_id, vector=vector, payload={"characterId": character_id})],
        )

    # ── Ähnlichkeitssuche ────────────────────────────────────

    def find_similar_characters(self, face_embedding: list[float], limit: int = 5) -> list[dict]:
        client = self._get_qdrant()
        results = client.search(
            collection_name=COL_FACE,
            query_vector=face_embedding,
            limit=limit,
            score_threshold=0.85,
        )
        return [{"characterId": r.payload["characterId"], "score": r.score} for r in results]
