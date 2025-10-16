
# ProsthetiScan API (FastAPI)

This backend accepts an image + two tapped points on the limb and:
1) Attempts to detect a credit-card sized rectangle in the image to compute a pixels-per-mm scale.
2) Computes the real-world distance between the two tapped points (in mm).
3) Returns a simple size recommendation (S/M/L) as a placeholder for future AI logic.

## Prereqs
- Python 3.10+
- Recommended: create and activate a virtualenv

## Setup
```bash
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
Open docs: http://localhost:8000/docs

## Notes
- Place a standard credit card (85.60mm × 53.98mm) fully visible in the photo for scale.
- The `/measure` endpoint returns `scale_ok = false` if it can't confidently detect a card. You can still see pixel distance; the width_mm will then be a naive conversion (not reliable).
- Replace the `recommendation_for_width` function with a more nuanced mapping or ML model later.
- This is a non-medical prototype. Not for clinical use.
