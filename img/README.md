# Art

- `<slug>.png`: one picture per candy, 32 of them, listed in `manifest.json` (slug, name, default yuck flag, wrapper color used as a fallback).
- `ghost-*.png`: the player character. `idle`, `run1`..`run4` (running cycle), `yay` (good catch), `sad` (yuck catch). All face right; the game mirrors them.
- `ghost-geometry.json`: where the bucket sits in each ghost frame, as fractions of the frame. That bucket is the catch zone.
- `bucket-*.png`: spare bucket art for decoration.
- `og.png` (1200x630) and `icon.png` (512x512): link preview and app icon. Regenerate with `node tools/render-og.js`.
- `source/`: the original sprite sheet and the design mockup. Re-cut the sheet with `python3 tools/slice-sheet.py` (writes `_contact.png` so you can check the numbering).

To swap a candy picture, replace its `<slug>.png`; to add a candy, add a row to `manifest.json` (and to the `CANDIES` array in `index.html`) plus a PNG.
