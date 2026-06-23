# ============================================================
#  apps/ai-worker/providers/lite_color_extractor.py
#  Lite-Modus: Charakter-Farbanalyse OHNE jedes ML-Modell —
#  reine PIL/NumPy-Farbextraktion. Läuft auf JEDER Hardware,
#  sogar ohne GPU und ohne Modell-Download.
#
#  Ersetzt Florence-2 + InsightFace + CLIP + DINOv2 für die
#  Basis-Felder des Character-DNA-Profils. Liefert keine
#  Embeddings (keine Vektor-Ähnlichkeitssuche möglich) — das
#  ist der bewusste Kompromiss für $0 Betriebskosten.
# ============================================================

import logging
import numpy as np
from PIL import Image

logger = logging.getLogger("lite_color_extractor")

# Grobe Farbnamen-Tabelle für die Zuordnung von RGB zu menschenlesbaren Namen
COLOR_NAMES = {
    "Schwarz": (20, 20, 20), "Weiß": (240, 240, 240), "Grau": (128, 128, 128),
    "Rot": (200, 40, 40), "Orange": (230, 130, 40), "Gelb": (230, 210, 50),
    "Braun": (120, 80, 50), "Beige": (220, 200, 170), "Grün": (60, 150, 60),
    "Blau": (50, 90, 200), "Violett": (130, 60, 170), "Rosa": (230, 150, 180),
    "Türkis": (40, 180, 180), "Bernstein": (180, 120, 40),
}


class LiteColorExtractor:
    """Extrahiert dominante Farben per Quantisierung — kein Torch, kein GPU."""

    def analyze(self, image: Image.Image) -> dict:
        img = image.convert("RGB").resize((150, 150))

        dominant_colors = self._get_dominant_colors(img, n=3)
        primary_color_name = self._closest_color_name(dominant_colors[0])
        secondary_color_name = (
            self._closest_color_name(dominant_colors[1]) if len(dominant_colors) > 1 else None
        )

        # Heuristik: hellere/wärmere obere Bildhälfte → evtl. Gesicht/Fell,
        # dies ist eine grobe Näherung, kein echtes Verständnis der Anatomie
        upper_half = img.crop((0, 0, 150, 75))
        upper_colors = self._get_dominant_colors(upper_half, n=1)
        face_area_color = self._closest_color_name(upper_colors[0]) if upper_colors else primary_color_name

        profile = {
            "furColor": f"{primary_color_name}" + (f" und {secondary_color_name}" if secondary_color_name else ""),
            "skinColor": face_area_color,
            "eyeColor": None,   # Ohne Gesichtserkennung nicht zuverlässig bestimmbar
            "bodyType": None,
            "accessories": [],
            "distinctiveFeatures": [],
            "rawAnalysis": (
                "Lite-Modus: reine Farbextraktion (kein VLM/Embedding-Modell). "
                "Felder wie Augenfarbe, Körperform und Accessoires müssen manuell "
                "im Charakter-Formular ergänzt werden."
            ),
        }
        logger.info(f"🎨 Lite-Farbanalyse: dominant={primary_color_name}, sekundär={secondary_color_name}")
        return profile

    def _get_dominant_colors(self, img: Image.Image, n: int = 3) -> list[tuple[int, int, int]]:
        quantized = img.quantize(colors=8, method=Image.Quantize.MEDIANCUT)
        palette = quantized.getpalette()
        color_counts = quantized.getcolors()
        color_counts.sort(reverse=True, key=lambda c: c[0])

        colors = []
        for count, idx in color_counts[:n]:
            r, g, b = palette[idx * 3], palette[idx * 3 + 1], palette[idx * 3 + 2]
            colors.append((r, g, b))
        return colors

    def _closest_color_name(self, rgb: tuple[int, int, int]) -> str:
        best_name, best_dist = "Unbekannt", float("inf")
        for name, ref_rgb in COLOR_NAMES.items():
            dist = sum((a - b) ** 2 for a, b in zip(rgb, ref_rgb))
            if dist < best_dist:
                best_dist, best_name = dist, name
        return best_name


_extractor: LiteColorExtractor | None = None

def get_lite_color_extractor() -> LiteColorExtractor:
    global _extractor
    if _extractor is None:
        _extractor = LiteColorExtractor()
    return _extractor
