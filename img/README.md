# Candy images
These 23 `<slug>.png` files are generated placeholder illustrations (512x512, transparent background), one per entry in `manifest.json`; no real logos or photos are used.
To use a real photo instead, save it as PNG under the same filename (e.g. `snickers.png`), with a transparent or plain background, roughly square (512x512 or larger is ideal).
Re-render all placeholders (needs Node + Playwright Chromium, Python + Pillow): `node tools/render-candies.js img && python3 tools/finish.py img` from the repo root.
Re-render only some: append slugs to the node command, e.g. `node tools/render-candies.js img twix kit-kat`; note this overwrites any real photo with that filename.
