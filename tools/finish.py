# Downscale @2x renders to 512x512, verify, and build a contact sheet.
import json, os, sys, glob
from PIL import Image, ImageDraw, ImageFont
IMG = sys.argv[1] if len(sys.argv) > 1 else '/home/user/youworkforus/img'
SHEET = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'contact.png')
for tmp in glob.glob(os.path.join(IMG, '*@2x.tmp.png')):
    im = Image.open(tmp).convert('RGBA').resize((512, 512), Image.LANCZOS)
    im.save(tmp.replace('@2x.tmp.png', '.png'), optimize=True)
    os.remove(tmp)
man = json.load(open(os.path.join(IMG, 'manifest.json')))
bad = []
for c in man:
    p = os.path.join(IMG, c['slug'] + '.png')
    if not os.path.exists(p): bad.append((c['slug'], 'missing')); continue
    im = Image.open(p)
    if im.size != (512, 512) or im.mode != 'RGBA': bad.append((c['slug'], f'{im.size} {im.mode}')); continue
    a = im.getchannel('A')
    corners = [a.getpixel(xy) for xy in [(0, 0), (511, 0), (0, 511), (511, 511)]]
    if max(corners) != 0: bad.append((c['slug'], f'corners {corners}'))
    bb = a.point(lambda v: 255 if v > 40 else 0).getbbox()
    print(f"{c['slug']:18s} ok  opaque-bbox={bb}")
print('PROBLEMS:', bad or 'none')
cols, cell = 6, 180
rows = (len(man) + cols - 1) // cols
sheet = Image.new('RGB', (cols * cell, rows * (cell + 22)), '#2b2152')
d = ImageDraw.Draw(sheet)
font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13)
for i, c in enumerate(man):
    p = os.path.join(IMG, c['slug'] + '.png')
    if not os.path.exists(p): continue
    im = Image.open(p).resize((cell - 10, cell - 10), Image.LANCZOS)
    x, y = (i % cols) * cell, (i // cols) * (cell + 22)
    sheet.paste(im, (x + 5, y + 5), im)
    d.text((x + cell / 2, y + cell + 6), c['slug'], fill='#d8d0ff', font=font, anchor='mm')
sheet.save(SHEET)
# small-size preview (approx phone 90px)
small = Image.new('RGB', (cols * 100, rows * 100), '#2b2152')
for i, c in enumerate(man):
    p = os.path.join(IMG, c['slug'] + '.png')
    if not os.path.exists(p): continue
    im = Image.open(p).resize((90, 90), Image.LANCZOS)
    small.paste(im, ((i % cols) * 100 + 5, (i // cols) * 100 + 5), im)
small.save(SHEET.replace('.png', '-90px.png'))
print('sheet:', SHEET)
