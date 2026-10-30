#!/usr/bin/env python3
"""Cut img/source/sprite-sheet.webp into the named PNGs in img/.

Usage: python3 tools/slice-sheet.py [sheet] [outdir]

Finds connected regions of non-transparent pixels (merging anything within
2px), sorts them by row then column, and maps them by index to the names
below. If you regenerate the sheet with a different layout, re-check the
numbering with the contact sheet this writes to <outdir>/_contact.png.
Only needs Pillow + numpy.
"""
import sys, json
from collections import deque
from PIL import Image, ImageFilter, ImageDraw
import numpy as np

sheet = sys.argv[1] if len(sys.argv) > 1 else "img/source/sprite-sheet.webp"
out = sys.argv[2] if len(sys.argv) > 2 else "img"

CANDIES = ["kit-kat","mms","reeses","snickers","milky-way","twix","skittles","sour-patch-kids",
  "hersheys","crunch","100-grand","rolo","three-musketeers","butterfinger","peanut-mms","starburst",
  "tootsie-roll","dots","nerds","almond-joy","mounds","junior-mints","candy-corn","jolly-rancher",
  "kisses","laffy-taffy","milk-duds","mike-and-ike","good-and-plenty","smarties","twizzlers","life-savers"]
NAMED = {32:"ghost-idle",33:"ghost-run1",34:"ghost-run2",41:"ghost-run3",37:"ghost-run4",36:"ghost-yay",42:"ghost-sad",
         43:"bucket-face",45:"bucket-full",47:"bucket-plain",51:"bucket-empty-top"}   # 35,38,39,40 are motion-line fragments; 44,46,48-50 unused buckets

im = Image.open(sheet).convert("RGBA"); a = np.array(im)
mk = np.array(Image.fromarray(((a[..., 3] > 30) * 255).astype("uint8")).filter(ImageFilter.MaxFilter(5))) > 0
H, W = mk.shape; lab = np.zeros((H, W), dtype=np.int32); n = 0; boxes = []
for y in range(H):
    for x in range(W):
        if mk[y, x] and lab[y, x] == 0:
            n += 1; q = deque([(y, x)]); lab[y, x] = n; x0 = x1 = x; y0 = y1 = y; area = 0
            while q:
                cy, cx = q.popleft(); area += 1
                x0 = min(x0, cx); x1 = max(x1, cx); y0 = min(y0, cy); y1 = max(y1, cy)
                for ny, nx in ((cy-1, cx), (cy+1, cx), (cy, cx-1), (cy, cx+1)):
                    if 0 <= ny < H and 0 <= nx < W and mk[ny, nx] and lab[ny, nx] == 0:
                        lab[ny, nx] = n; q.append((ny, nx))
            if area >= 150: boxes.append((x0, y0, x1+1, y1+1))
boxes.sort(key=lambda b: (round((b[1]+b[3])/2/95), b[0]))
contact = Image.new("RGBA", im.size, (43, 33, 82, 255)); contact.alpha_composite(im); d = ImageDraw.Draw(contact)
geo = {}
for i, (x0, y0, x1, y1) in enumerate(boxes):
    name = CANDIES[i] if i < len(CANDIES) else NAMED.get(i)
    crop = im.crop((x0, y0, x1, y1)); crop = crop.crop(crop.getbbox())
    d.rectangle([x0, y0, x1, y1], outline=(255, 255, 255, 200)); d.text((x0+4, y0+3), f"{i} {name or ''}", fill=(255, 200, 80, 255))
    if not name: continue
    crop.save(f"{out}/{name}.png")
    if name.startswith("ghost"):   # the orange bucket in the ghost's hand is the catch zone
        c = np.array(crop).astype(int); r, g, b, al = c[..., 0], c[..., 1], c[..., 2], c[..., 3]
        ys, xs = np.where((al > 120) & (r > 190) & (g > 70) & (g < 190) & (b < 110) & (r-b > 120))
        w, h = crop.size
        geo[name] = {"w": w, "h": h, "bucket": [round(xs.min()/w, 3), round(ys.min()/h, 3), round((xs.max()-xs.min())/w, 3), round((ys.max()-ys.min())/h, 3)]}
contact.save(f"{out}/_contact.png")
json.dump(geo, open(f"{out}/ghost-geometry.json", "w"), indent=1)
print(f"{len(boxes)} regions; wrote {len(CANDIES)+len(NAMED)} sprites and ghost-geometry.json")
