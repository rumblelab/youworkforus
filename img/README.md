# Candy images
These 23 `<slug>.png` files are generated placeholder illustrations (512x512, transparent background), one per entry in `manifest.json`; no real logos or photos are used.
To use a real photo instead, save it as PNG under the same filename (e.g. `snickers.png`), with a transparent or plain background, roughly square (512x512 or larger is ideal).
Re-render all placeholders (needs Node + Playwright Chromium, Python + Pillow): `node tools/render-candies.js img && python3 tools/finish.py img` from the repo root.
Re-render only some: append slugs to the node command, e.g. `node tools/render-candies.js img twix kit-kat`; note this overwrites any real photo with that filename.
The player pail (`bucket.png`, `bucket-hit.png`, `bucket-yay.png`, 768x512, same outline in all three) is generated too: `node tools/render-bucket.js img && python3 tools/finish-bucket.py img` (rim and body fractions are written to `tools/bucket-geometry.json`).
