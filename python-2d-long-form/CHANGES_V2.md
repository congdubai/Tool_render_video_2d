# 2D Long Form — Seamless Character V2 (test)

Changes are restricted to `engine/kit.py`; public `draw_char()` and `walk_legs()` signatures are unchanged.

- Replaces thin single-stroke arms with filled, tapered sleeves following the original quadratic pose curves, preserving existing arm presets and interpolation.
- Uses soft, continuous leg paths with knees and small shoe silhouettes instead of straight rods.
- Preserves existing face, costume palette, timeline, story and rendering pipeline.

## Run

This is a **Python/Skia project**, not a Remotion project. Do not import it into a Remotion-only validator.

Install dependencies following `SKILL.md` and `scripts/setup.sh`; add `voice.wav` to `examples/marshmallow/` if needed, then run the example as described in `examples/marshmallow/README.md`.

## Verification

Python syntax compiled successfully. Skia is not installed in the packaging environment, so visual rendering was not verified here. This is an experimental character-shape patch, not a fully tested release. If you need to revert, restore `engine/kit.py` from the original ZIP.
