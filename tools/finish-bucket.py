# Downscale the @2x bucket renders to 768x512, verify them, and build a contact sheet on the stage colour.
# Usage: python3 tools/finish-bucket.py [imgDir] [sheet.png]
import os, sys
from PIL import Image, ImageChops, ImageDraw, ImageFont
IMG = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'img')
SHEET = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'bucket-contact.png')
SLUGS = ['bucket', 'bucket-hit', 'bucket-yay']
W, H = 768, 512
for s in SLUGS:
    tmp = os.path.join(IMG, s + '@2x.tmp.png')
    if os.path.exists(tmp):
        Image.open(tmp).convert('RGBA').resize((W, H), Image.LANCZOS).save(os.path.join(IMG, s + '.png'), optimize=True)
        os.remove(tmp)
bad, ims = [], {}
for s in SLUGS:
    im = Image.open(os.path.join(IMG, s + '.png'))
    ims[s] = im
    if im.size != (W, H) or im.mode != 'RGBA': bad.append((s, f'{im.size} {im.mode}')); continue
    a = im.getchannel('A')
    corners = [a.getpixel(xy) for xy in [(0, 0), (W - 1, 0), (0, H - 1), (W - 1, H - 1)]]
    if max(corners): bad.append((s, f'corners {corners}'))
    print(f'{s:12s} {im.size} {im.mode} corners={corners} opaque-bbox={a.point(lambda v: 255 if v > 128 else 0).getbbox()}')
# the pail itself (body + lip + handle + candies, effects hidden) must be pixel-identical in outline across variants
sils = {}
for s in SLUGS:
    p = os.path.join(IMG, s + '.sil@2x.tmp.png')
    if os.path.exists(p):
        sils[s] = Image.open(p).getchannel('A').resize((W, H), Image.LANCZOS).point(lambda v: 255 if v > 128 else 0)
        os.remove(p)
if len(sils) == 3:
    for s in SLUGS[1:]:
        n = sum(ImageChops.difference(sils['bucket'], sils[s]).histogram()[1:])
        print(f'{s:12s} outline pixels differing from bucket.png (effects hidden): {n}')
        if n: bad.append((s, f'outline differs by {n}px'))
    # measured geometry from the alpha mask
    m = sils['bucket']
    bb = m.getbbox(); print('pail opaque bbox (no effects):', bb, f'x {bb[0]/W:.3f}-{bb[2]/W:.3f}, y {bb[1]/H:.3f}-{bb[3]/H:.3f}')
    # widest row of the pail body (below the lip, above the base) and the rim row
    rows = []
    for y in range(int(H * 0.45), int(H * 0.8)):
        xs = [x for x in range(W) if m.getpixel((x, y))]
        if xs: rows.append((xs[-1] - xs[0], xs[0], xs[-1], y))
    w_, x0, x1, y = max(rows)
    print(f'body widest at y={y} ({y/H:.3f}): x {x0}-{x1} -> {x0/W:.3f}-{(x1+1)/W:.3f} of width, spans {(x1-x0+1)/W:.3f}')
print('PROBLEMS:', bad or 'none')

stage = lambda size: Image.new('RGB', size, '#2b2152')
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 18)
pad = 24
sheet = stage((3 * W + 4 * pad, H + 2 * pad + 30 + 200))
d = ImageDraw.Draw(sheet)
for i, s in enumerate(SLUGS):
    x = pad + i * (W + pad)
    sheet.paste(ims[s], (x, pad), ims[s])
    d.text((x + W / 2, pad + H + 14), s + '.png (768x512)', fill='#d8d0ff', font=font, anchor='mm')
# phone size row: ~100px wide, plus 2x zoom of that (nearest) so it is easy to inspect
y = pad + H + 40
for i, s in enumerate(SLUGS):
    small = ims[s].resize((100, 67), Image.LANCZOS)
    x = pad + i * (W + pad)
    sheet.paste(small, (x, y + 40), small)
    big = small.resize((200, 134), Image.NEAREST)
    sheet.paste(big, (x + 140, y + 6), big)
    d.text((x + 50, y + 20), '100px', fill='#d8d0ff', font=font, anchor='mm')
    d.text((x + 400, y + 70), '<- 100px, 2x zoom', fill='#8f86b8', font=font, anchor='lm')
sheet.save(SHEET)
print('sheet:', SHEET)
