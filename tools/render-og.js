// Renders the Open Graph / social preview image (1200x630, opaque PNG) to img/og.png.
// Usage: node render-og.js [imgDir] [outFile]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const IMG = path.resolve(process.argv[2] || '/home/user/youworkforus/img');
const OUT = path.resolve(process.argv[3] || path.join(IMG, 'og.png'));
const W = 1200, H = 630;

const FONT = "'Inter Display','Inter','Liberation Sans','DejaVu Sans',sans-serif";
const C = { night0: '#17102e', night1: '#2b2152', pumpkin: '#ff8a2b', cream: '#fff3d2', yuck: '#ff5f7a', good: '#8ef05a', red: '#ff2b3d' };

const uri = slug => 'data:image/png;base64,' + fs.readFileSync(path.join(IMG, slug + '.png')).toString('base64');

// deterministic RNG so re-renders are identical
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// [slug, cx, cy, size, rotation]. Good candies are falling; yuck candies get struck out.
const GOOD = [
  ['reeses', 180, 318, 170, -16],
  ['kit-kat', 1022, 150, 175, 18],
  ['snickers', 1010, 478, 165, -12],
  ['skittles', 528, 352, 132, 14],
  ['mms', 672, 340, 128, -18],
  ['sour-patch-kids', 600, 438, 118, 8],
];
const YUCK = [
  ['tootsie-roll', 178, 148, 150, 12],
  ['mounds', 182, 482, 150, -10],
  ['butterfinger', 1020, 318, 150, -14],
  ['almond-joy', 368, 470, 128, 10],
  ['junior-mints', 836, 470, 128, -8],
];

function stars() {
  const r = rng(31337); let s = '';
  for (let i = 0; i < 70; i++) {
    const x = (r() * W).toFixed(1), y = (r() * H * 0.9).toFixed(1), rad = (0.6 + r() * 1.6).toFixed(2), o = (0.25 + r() * 0.6).toFixed(2);
    s += `<circle cx="${x}" cy="${y}" r="${rad}" fill="${C.cream}" opacity="${o}"/>`;
  }
  // a few twinkle crosses
  for (const [x, y, k] of [[300, 60, 9], [950, 250, 7], [80, 240, 6], [1140, 560, 7], [430, 560, 6], [760, 600, 5]])
    s += `<path d="M${x - k},${y} L${x + k},${y} M${x},${y - k} L${x},${y + k}" stroke="${C.cream}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
  return s;
}

function good([slug, x, y, s, rot]) {
  // motion streaks above the candy, then the candy with a soft green halo
  let streaks = '';
  for (const [dx, len, o] of [[-0.2, 0.5, 0.3], [0, 0.7, 0.4], [0.2, 0.4, 0.25]])
    streaks += `<line x1="${x + dx * s}" y1="${y - s * 0.38}" x2="${x + dx * s}" y2="${y - s * 0.38 - len * s * 0.4}" stroke="${C.cream}" stroke-width="4" stroke-linecap="round" opacity="${o}"/>`;
  return `${streaks}
  <circle cx="${x}" cy="${y}" r="${s * 0.46}" fill="url(#goodHalo)"/>
  <image href="${uri(slug)}" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" transform="rotate(${rot} ${x} ${y})" filter="url(#drop)"/>`;
}

function yuck([slug, x, y, s, rot]) {
  const k = s * 0.34;
  const X = `M${x - k},${y - k} L${x + k},${y + k} M${x + k},${y - k} L${x - k},${y + k}`;
  return `<circle cx="${x}" cy="${y}" r="${s * 0.48}" fill="url(#yuckHalo)"/>
  <image href="${uri(slug)}" x="${x - s / 2}" y="${y - s / 2}" width="${s}" height="${s}" transform="rotate(${rot} ${x} ${y})" filter="url(#drop)"/>
  <path d="${X}" stroke="#2a0710" stroke-width="${s * 0.12}" stroke-linecap="round" opacity=".55" transform="translate(0 4)"/>
  <path d="${X}" stroke="#fff" stroke-width="${s * 0.105}" stroke-linecap="round"/>
  <path d="${X}" stroke="${C.red}" stroke-width="${s * 0.07}" stroke-linecap="round"/>`;
}

function bucket(cx, bottom) {
  const tw = 210, bw = 158, h = 128, top = bottom - h;
  const rimH = 22;
  const body = `M${cx - tw / 2},${top} L${cx + tw / 2},${top} L${cx + bw / 2},${bottom} L${cx - bw / 2},${bottom} Z`;
  const fy = top + rimH + 16; // face area
  const eye = (ex, dir) => `M${ex - 20},${fy + 30} L${ex + 20},${fy + 30} L${ex + dir * 6},${fy} Z`;
  const mouth = `M${cx - 50},${fy + 50} L${cx + 50},${fy + 50} L${cx + 40},${fy + 72} L${cx + 26},${fy + 62} L${cx + 13},${fy + 76} L${cx},${fy + 64} L${cx - 13},${fy + 76} L${cx - 26},${fy + 62} L${cx - 40},${fy + 72} Z`;
  return `
  <ellipse cx="${cx}" cy="${bottom + 4}" rx="${bw * 0.7}" ry="10" fill="#000" opacity=".35"/>
  <path d="M${cx - tw / 2 + 14},${top + 4} C${cx - tw / 2 + 14},${top - 120} ${cx + tw / 2 - 14},${top - 120} ${cx + tw / 2 - 14},${top + 4}" fill="none" stroke="#3a1d06" stroke-width="6" stroke-linecap="round"/>
  <path d="${body}" fill="${C.pumpkin}"/>
  <path d="M${cx - tw / 2},${top} L${cx + tw / 2},${top} L${cx + tw / 2 - 3.6},${top + rimH} L${cx - tw / 2 + 3.6},${top + rimH} Z" fill="#e8701a"/>
  <path d="${eye(cx - 40, 1)}" fill="#1a0d05"/>
  <path d="${eye(cx + 40, -1)}" fill="#1a0d05"/>
  <path d="${mouth}" fill="#1a0d05"/>`;
}

function page() {
  const goodLayer = GOOD.map(good).join('\n');
  const yuckLayer = YUCK.map(yuck).join('\n');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:${C.night0};}
svg{display:block}
</style></head><body>
<svg id="c" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${C.night0}"/><stop offset="1" stop-color="${C.night1}"/></linearGradient>
  <radialGradient id="glow" cx=".5" cy=".42" r=".55"><stop offset="0" stop-color="#4a3590" stop-opacity=".55"/><stop offset="1" stop-color="#4a3590" stop-opacity="0"/></radialGradient>
  <radialGradient id="moonGlow"><stop offset=".55" stop-color="${C.cream}" stop-opacity=".22"/><stop offset="1" stop-color="${C.cream}" stop-opacity="0"/></radialGradient>
  <radialGradient id="goodHalo"><stop offset="0" stop-color="${C.good}" stop-opacity=".38"/><stop offset="1" stop-color="${C.good}" stop-opacity="0"/></radialGradient>
  <radialGradient id="yuckHalo"><stop offset="0" stop-color="${C.yuck}" stop-opacity=".42"/><stop offset="1" stop-color="${C.yuck}" stop-opacity="0"/></radialGradient>
  <filter id="drop" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#000" flood-opacity=".45"/></filter>
  <filter id="titleShadow" x="-10%" y="-30%" width="120%" height="160%"><feDropShadow dx="0" dy="7" stdDeviation="0" flood-color="#0b0718" flood-opacity="1"/></filter>
</defs>
<rect width="${W}" height="${H}" fill="url(#sky)"/>
<rect width="${W}" height="${H}" fill="url(#glow)"/>
${stars()}
<circle cx="1110" cy="64" r="120" fill="url(#moonGlow)"/>
<circle cx="1110" cy="64" r="62" fill="${C.cream}"/>
<circle cx="1088" cy="54" r="10" fill="#e9dcb8"/><circle cx="1124" cy="84" r="7" fill="#e9dcb8"/>

<g filter="url(#titleShadow)">
  <text x="600" y="128" text-anchor="middle" font-family="${FONT}" font-weight="900" font-size="116" letter-spacing="-2"
    fill="${C.pumpkin}" stroke="#1a0d05" stroke-width="10" stroke-linejoin="round" paint-order="stroke fill" data-maxw="580">Candy Boss</text>
</g>
<text x="600" y="205" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="38" fill="${C.cream}" data-maxw="560">Train your kids to dodge</text>
<text x="600" y="250" text-anchor="middle" font-family="${FONT}" font-weight="800" font-size="38" fill="${C.cream}" data-maxw="560">the <tspan fill="${C.yuck}">nasty</tspan> candy.</text>

${yuckLayer}
${goodLayer}
${bucket(600, 550)}
</svg>
<script>
for (const el of document.querySelectorAll('[data-maxw]')) {
  const max = +el.dataset.maxw, w = el.getComputedTextLength();
  if (w > max) el.setAttribute('font-size', (+el.getAttribute('font-size')) * max / w);
}
</script></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.setContent(page());
  await pg.evaluate(() => document.fonts.ready);
  // make sure every candy <image> is decoded before the screenshot
  await pg.evaluate(() => Promise.all([...document.querySelectorAll('image')].map(i => { const im = new Image(); im.src = i.getAttribute('href'); return im.decode(); })));
  await pg.locator('#c').screenshot({ path: OUT, omitBackground: false });
  await browser.close();
  console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes');
})();
