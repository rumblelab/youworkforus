# Candy Boss 🎃

Train your kids to dodge the nasty candy. Open `index.html` in any browser. No build step, works on a phone.

## How it plays

1. **The yuck list.** We're opinionated: Almond Joy, Mounds, Tootsie Roll, Junior Mints, and Butterfinger are the nasties. The start screen shows them with a big YUCK and one button.
2. **Catch.** Candy rains from the sky. Slide the pumpkin bucket (finger, mouse, or arrow keys) to catch everything else. Each good candy is +1. It keeps getting faster, with a "FASTER!" callout every 20 seconds.
3. **Three strikes.** Catch three yuck candies and the night is over.
4. **Completion screen.** Built to be screenshotted: the big number caught, stars, how long you lasted, a mini breakdown, and the yuck list. No names, no share button. Play again, or change the yuck list.
5. **Change the yuck list.** Slide (or tap) candy between the Yuck and Yum sides. The editor shows a link that carries your list as `?yuck=slug,slug,...`; anyone who opens it plays with your yuck list. Share or copy it from there.

## Hosting notes

- `SITE_URL` near the top of the script in `index.html`: set it to the public address once there is one. The share link and the small domain line on the completion screen use it.
- The Open Graph tags in `<head>` point at `img/og.png` (1200x630). Scrapers need absolute URLs, so change `og:image` and `twitter:image` to `https://your-domain/img/og.png` when the domain exists.
- Everything is static: any host that serves files works (GitHub Pages, Netlify, S3).

## Images

`img/<slug>.png` is one picture per candy (see `img/manifest.json` and `img/README.md`). They are generated placeholder illustrations; drop in real photos with the same filenames to replace them. `tools/` holds the render scripts for the candies and the OG image.
