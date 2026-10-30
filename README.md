# YuckyCandy 🎃

Train your kids to bring home the good stuff. A free Halloween training game for kids (and selfish parents), live at [yuckycandy.com](https://yuckycandy.com). Open `index.html` in any browser. No build step, works on a phone.

## How it plays

1. **Home.** The hook, the tagline, the YUCK list (Almond Joy, Mounds, Tootsie Roll, Junior Mints, Butterfinger by default) and one big PLAY NOW button.
2. **Catch.** Candy rains on a night-time neighborhood. Slide the ghost (finger, mouse, or arrow keys); only candy that drops into its pumpkin bucket counts. Each good candy is +1. It keeps getting faster, with a "FASTER!" callout every 20 seconds.
3. **Three strikes.** Catch three yuck candies and the night is over.
4. **Completion screen.** A scorecard built to be screenshotted: "NN% HALLOWEEN READY!" (good caught ÷ (good caught + good missed + yuck caught)), a quip about the yuck candy they fell for most, good / yucky / time, and the yuck list. No names, no share button. Play again, or Create your own yuck list.
5. **Create your own yuck list.** Slide (or tap) candy between Yucky and Good. The editor shows a link that carries your list as `?yuck=slug,slug,...`; anyone who opens it plays with your list. Share or copy it from there.

## Hosting notes

- `SITE_URL` near the top of the script is empty on purpose: the share link uses wherever the page is served from. Set it (e.g. `https://yuckycandy.com`) to pin links and show the domain on the scorecard.
- Open Graph / Twitter tags point at `https://yuckycandy.com/img/og.png`; the favicon and home-screen icon are `img/icon.png`.
- Everything is static: any host that serves files works (GitHub Pages, Netlify, S3).

## Art

All art is transparent PNG in `img/`, cut from the sprite sheet the user generated (`tools/slice-sheet.py`).

- **32 candies:** `img/<slug>.png`, one per entry in `img/manifest.json` (slug, name, default yuck flag, wrapper color). The page has the manifest inlined in its `CANDIES` constant (so it runs from `file://`); if you add or rename a candy, update both. A missing image falls back to a drawn wrapper in the manifest color.
- **Ghost catcher:** `ghost-idle.png`, `ghost-run1.png`…`ghost-run4.png` (run cycle), `ghost-yay.png` (good catch), `ghost-sad.png` (yuck catch), all facing right; the game mirrors them for left. `img/ghost-geometry.json` gives each frame's size and its bucket box as fractions `[x, y, w, h]`: that box is the catch zone, and it is inlined in the page as `GHOST_GEOM`. If the ghost frames are missing, the old drawn bucket comes back.
- **Buckets:** `bucket-face.png`, `bucket-full.png` (used on the scorecard), `bucket-plain.png`, `bucket-empty-top.png`.
- **To replace art:** drop in a new PNG with the same filename. If a ghost frame's size or bucket position changes, update `ghost-geometry.json` and the `GHOST_GEOM` copy in `index.html`. `GHOST_CROP` in `index.html` hides two stray sprite-sheet crumbs on the current `ghost-sad` and `ghost-yay` frames; delete those entries if you replace those frames.
