// Renders the YuckyCandy social preview and app icon from the art in img/.
//
// Usage (from the repo root):   node tools/render-og.js [imgDir]
//   writes  <imgDir>/og.png    1200x630 opaque Open Graph / Twitter card image
//           <imgDir>/icon.png  512x512 opaque app icon / favicon source (no text)
//   imgDir defaults to ../img next to this script.
//
// Each image is an inline SVG page screenshotted with Playwright Chromium: no network,
// system fonts only (Inter Display Black for the logo, Inter for the tagline).
// Source art: candy wrappers <slug>.png (see img/manifest.json) and ghost-*.png frames.
// Stray specks left over from slicing the art sheets are removed in-page before rendering.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const IMG = path.resolve(process.argv[2] || path.join(__dirname, '..', 'img'));

const LOGO_FONT = "'Inter Display','Inter','DejaVu Sans',sans-serif";
const TEXT_FONT = "'Inter','Inter Display','DejaVu Sans',sans-serif";
const C = {
  paper: '#f7edd6', paperEdge: '#e9d6b0', ink: '#2a160b',
  red: '#e8261f', redHi: '#ff6a4d', redLo: '#b5120f',
  night: '#24264a', nightHi: '#34356a', house: '#141530', ground: '#191a33', walk: '#4b4568',
  window: '#ffd45c', moon: '#fff1c4', pumpkin: '#ff8a1e', pumpkinLo: '#e2620a', cream: '#fff6df',
};

const uri = slug => 'data:image/png;base64,' + fs.readFileSync(path.join(IMG, slug + '.png')).toString('base64');
const size = slug => {
  const b = fs.readFileSync(path.join(IMG, slug + '.png'));
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};

// deterministic RNG so re-renders are identical
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

// ---------------------------------------------------------------- shared SVG bits
const DEFS = `
  <filter id="blotch" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency=".006" numOctaves="3" seed="3" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 .62  0 0 0 0 .45  0 0 0 0 .22  0 0 0 -1.4 .78"/>
  </filter>
  <filter id="wobble" x="-5%" y="-5%" width="110%" height="110%">
    <feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="11" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="6" xChannelSelector="R" yChannelSelector="G"/>
  </filter>
  <filter id="drop" x="-25%" y="-25%" width="150%" height="150%">
    <feDropShadow dx="3" dy="6" stdDeviation="2.5" flood-color="${C.ink}" flood-opacity=".35"/>
  </filter>
  <!-- thick ink sticker outline around a transparent PNG -->
  <filter id="sticker" x="-15%" y="-15%" width="130%" height="130%">
    <feMorphology in="SourceAlpha" operator="dilate" radius="9" result="d"/>
    <feGaussianBlur in="d" stdDeviation="1.2" result="db"/>
    <feComponentTransfer in="db" result="dd"><feFuncA type="linear" slope="3" intercept="-.6"/></feComponentTransfer>
    <feFlood flood-color="${C.ink}"/><feComposite in2="dd" operator="in" result="outline"/>
    <feMorphology in="SourceAlpha" operator="dilate" radius="3" result="w"/>
    <feFlood flood-color="#fff"/><feComposite in2="w" operator="in" result="rim"/>
    <feMerge><feMergeNode in="outline"/><feMergeNode in="rim"/><feMergeNode in="SourceGraphic"/></feMerge>
  </filter>
  <linearGradient id="redBody" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.redHi}"/><stop offset=".55" stop-color="${C.red}"/><stop offset="1" stop-color="${C.redLo}"/>
  </linearGradient>
  <linearGradient id="shine" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#fff" stop-opacity=".75"/><stop offset=".38" stop-color="#fff" stop-opacity=".18"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="skyBand" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${C.nightHi}"/><stop offset="1" stop-color="${C.night}"/>
  </linearGradient>
  <radialGradient id="moonGlow"><stop offset=".45" stop-color="${C.moon}" stop-opacity=".35"/><stop offset="1" stop-color="${C.moon}" stop-opacity="0"/></radialGradient>`;

// Image cleanup + text fitting, run inside the page before the screenshot.
const PAGE_SCRIPT = `
async function clean(src) {
  const im = new Image(); im.src = src; await im.decode();
  const w = im.naturalWidth, h = im.naturalHeight, cv = document.createElement('canvas');
  cv.width = w; cv.height = h; const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
  const d = g.getImageData(0, 0, w, h), a = d.data, lab = new Int32Array(w * h), areas = [0];
  const stack = new Int32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    if (lab[i] || a[i * 4 + 3] < 24) continue;
    const id = areas.length; let n = 0, sp = 0; stack[sp++] = i; lab[i] = id;
    while (sp) {
      const p = stack[--sp]; n++; const x = p % w, y = (p - x) / w;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
        const q = Y * w + X; if (!lab[q] && a[q * 4 + 3] >= 24) { lab[q] = id; stack[sp++] = q; }
      }
    }
    areas.push(n);
  }
  const keep = Math.max(...areas) * 0.04;
  for (let i = 0; i < w * h; i++) if (areas[lab[i]] < keep) a[i * 4 + 3] = 0;
  g.putImageData(d, 0, 0); return cv.toDataURL('image/png');
}
window.prepare = async () => {
  await document.fonts.ready;
  const cache = {};
  for (const el of document.querySelectorAll('image')) {
    const src = el.getAttribute('href');
    cache[src] = cache[src] || clean(src);
    el.setAttribute('href', await cache[src]);
  }
  await Promise.all([...document.querySelectorAll('image')].map(i => { const im = new Image(); im.src = i.getAttribute('href'); return im.decode(); }));
  // shrink a text group (all layers share data-fit) until the first layer fits data-maxw
  const groups = {};
  for (const el of document.querySelectorAll('[data-fit]')) (groups[el.dataset.fit] = groups[el.dataset.fit] || []).push(el);
  for (const els of Object.values(groups)) {
    const max = +els[0].dataset.maxw, w = els[0].getBBox().width;
    if (w > max) for (const el of els) el.setAttribute('font-size', (+el.getAttribute('font-size')) * max / w);
  }
};`;

const page = (w, h, bg, svg) => `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:${bg};}svg{display:block}</style></head><body>
<svg id="c" xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><defs>${DEFS}</defs>${svg}</svg>
<script>${PAGE_SCRIPT}</script></body></html>`;

// ---------------------------------------------------------------- og.png
const W = 1200, H = 630;
const BAND = 418;   // top of the night band
const GROUND = 556; // where the ghost stands

// [slug, cx, cy, width, rotation]. Good candies fall toward the ghost; yuck candies get a red X.
const GOOD = [
  ['kit-kat', 172, 128, 158, -16],
  ['snickers', 1030, 122, 165, 13],
  ['reeses', 218, 300, 140, 12],
  ['skittles', 975, 318, 132, -12],
  ['sour-patch-kids', 408, 372, 104, -14],
  ['mms', 806, 366, 106, 18],
];
const YUCK = [
  ['almond-joy', 92, 246, 116, 10],
  ['butterfinger', 1112, 244, 118, -12],
  ['mounds', 138, 462, 132, -8],
  ['junior-mints', 1070, 470, 120, 10],
  ['tootsie-roll', 300, 520, 116, -6],
];

function candy(slug, x, y, s, rot, extra = '') {
  const { w, h } = size(slug), sh = s * h / w;
  return `<image href="${uri(slug)}" x="${x - s / 2}" y="${y - sh / 2}" width="${s}" height="${sh}" transform="rotate(${rot} ${x} ${y})" filter="url(#drop)" ${extra}/>`;
}

function good([slug, x, y, s, rot]) {
  // comic speed lines above the wrapper, ink on paper / cream on the night band
  const col = y - s * 0.35 > BAND ? C.cream : C.ink;
  let lines = '';
  for (const [dx, len, o] of [[-0.28, 0.32, 0.55], [-0.05, 0.5, 0.8], [0.2, 0.36, 0.6]]) {
    const x1 = x + dx * s, y1 = y - s * 0.36;
    lines += `<line x1="${x1}" y1="${y1}" x2="${x1 - len * s * 0.12}" y2="${y1 - len * s * 0.55}" stroke="${col}" stroke-width="4" stroke-linecap="round" opacity="${o}"/>`;
  }
  return `<g filter="url(#wobble)">${lines}</g>${candy(slug, x, y, s, rot)}`;
}

function yuck([slug, x, y, s, rot]) {
  const k = s * 0.36;
  const X = `M${x - k},${y - k * 0.95} L${x + k},${y + k * 0.9} M${x + k * 0.95},${y - k} L${x - k * 0.9},${y + k}`;
  return `${candy(slug, x, y, s, rot, 'opacity=".92"')}
  <g filter="url(#wobble)">
    <path d="${X}" stroke="${C.ink}" stroke-width="${s * 0.15}" stroke-linecap="round" fill="none"/>
    <path d="${X}" stroke="${C.red}" stroke-width="${s * 0.095}" stroke-linecap="round" fill="none"/>
  </g>`;
}

function neighborhood() {
  const r = rng(4242);
  let stars = '';
  for (let i = 0; i < 46; i++) {
    const x = r() * W, y = BAND + 18 + r() * 95;
    stars += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(0.8 + r() * 1.4).toFixed(2)}" fill="${C.cream}" opacity="${(0.35 + r() * 0.5).toFixed(2)}"/>`;
  }
  const house = (x, w, wallTop, peak, wins) => {
    const base = GROUND + 4;
    let s = `<path d="M${x - 8},${wallTop + 4} L${x + w / 2},${peak} L${x + w + 8},${wallTop + 4} L${x + w},${wallTop + 4} L${x + w},${base} L${x},${base} L${x},${wallTop + 4} Z" fill="${C.house}"/>`;
    for (const [wx, wy, ww, wh] of wins) s += `<rect x="${x + wx}" y="${wy}" width="${ww}" height="${wh}" rx="2" fill="${C.window}"/><path d="M${x + wx + ww / 2},${wy} v${wh} M${x + wx},${wy + wh / 2} h${ww}" stroke="${C.house}" stroke-width="2.5"/>`;
    return s;
  };
  const tree = (x, y, rr) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="${C.house}"/><circle cx="${x - rr * 0.7}" cy="${y + rr * 0.45}" r="${rr * 0.75}" fill="${C.house}"/><circle cx="${x + rr * 0.7}" cy="${y + rr * 0.4}" r="${rr * 0.8}" fill="${C.house}"/><rect x="${x - 5}" y="${y + rr}" width="10" height="${GROUND - y - rr + 4}" fill="${C.house}"/>`;
  return `
  <g filter="url(#wobble)">
    <path d="M-10,${BAND + 10} C150,${BAND - 12} 330,${BAND + 14} 520,${BAND - 2} S880,${BAND - 16} 1050,${BAND + 4} S1180,${BAND - 6} 1210,${BAND} L1210,640 L-10,640 Z" fill="url(#skyBand)" stroke="${C.ink}" stroke-width="5"/>
  </g>
  ${stars}
  <circle cx="900" cy="${BAND + 46}" r="46" fill="url(#moonGlow)"/>
  <circle cx="900" cy="${BAND + 46}" r="21" fill="${C.moon}"/><circle cx="893" cy="${BAND + 41}" r="4" fill="#ecdba6"/><circle cx="906" cy="${BAND + 53}" r="3" fill="#ecdba6"/>
  <g filter="url(#wobble)">
    ${tree(250, 488, 26)}${tree(560, 500, 20)}${tree(842, 494, 24)}${tree(1170, 482, 28)}
    ${house(10, 150, 500, 452, [[30, 515, 26, 24], [92, 515, 26, 24]])}
    ${house(390, 110, 512, 474, [[40, 524, 28, 22]])}
    ${house(680, 124, 506, 466, [[22, 520, 24, 22], [76, 520, 24, 22]])}
    ${house(985, 160, 496, 444, [[28, 512, 28, 26], [104, 512, 28, 26]])}
    <path d="M-10,${GROUND} C300,${GROUND - 6} 900,${GROUND + 6} 1210,${GROUND - 2} L1210,640 L-10,640 Z" fill="${C.ground}"/>
    <path d="M-10,${GROUND + 26} C300,${GROUND + 22} 900,${GROUND + 30} 1210,${GROUND + 24} L1210,${GROUND + 46} C900,${GROUND + 52} 300,${GROUND + 44} -10,${GROUND + 48} Z" fill="${C.walk}"/>
  </g>`;
}

function paperFlecks() {
  const r = rng(99); let s = '';
  for (let i = 0; i < 260; i++) {
    const x = r() * W, y = r() * BAND, a = r() * 180, l = 2 + r() * 7;
    s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${l.toFixed(1)}" height="1.4" rx=".7" fill="#8a6a40" opacity="${(0.1 + r() * 0.2).toFixed(2)}" transform="rotate(${a.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
  }
  return s;
}

function logo(cx, baseline, fs, maxw) {
  const word = 'YuckyCandy';
  const rot = '-5 3 -2 4 -3 -4 3 -2 4 -3';
  const dy = [0, 5, -6, 5, -3, -2, 5, -5, 4, -4];
  const tspans = [...word].map((ch, i) => `<tspan dy="${dy[i] - (dy[i - 1] || 0)}">${ch}</tspan>`).join('');
  const t = (attrs, dx = 0, dyy = 0) => `<text x="${cx + dx}" y="${baseline + dyy}" text-anchor="middle" font-family="${LOGO_FONT}" font-weight="900" font-size="${fs}" letter-spacing="5" rotate="${rot}" data-fit="logo" data-maxw="${maxw}" stroke-linejoin="round" stroke-linecap="round" ${attrs}>${tspans}</text>`;
  return `<g transform="rotate(-3 ${cx} ${baseline})">
    ${t(`fill="${C.ink}" stroke="${C.ink}" stroke-width="20"`, 5, 8)}
    ${t(`fill="${C.ink}" stroke="${C.ink}" stroke-width="20"`)}
    ${t(`fill="url(#redBody)" stroke="url(#redBody)" stroke-width="3"`)}
    ${t(`fill="url(#shine)"`)}
  </g>`;
}

function ogSvg() {
  const g = size('ghost-run2'), gw = 300, gh = gw * g.h / g.w;
  const gx = 600 - gw / 2 + 8, gy = GROUND - gh + 4;
  return `
  <rect width="${W}" height="${H}" fill="${C.paper}"/>
  <rect width="${W}" height="${H}" filter="url(#blotch)"/>
  ${paperFlecks()}
  ${neighborhood()}
  ${logo(600, 172, 124, 580)}
  <text x="600" y="246" text-anchor="middle" font-family="${TEXT_FONT}" font-weight="800" font-size="38" fill="${C.ink}" data-fit="tag" data-maxw="560">Train your kids to bring home</text>
  <text x="600" y="291" text-anchor="middle" font-family="${TEXT_FONT}" font-weight="800" font-size="38" fill="${C.ink}" data-fit="tag" data-maxw="560">the good stuff.</text>
  ${YUCK.map(yuck).join('\n')}
  ${GOOD.map(good).join('\n')}
  <ellipse cx="610" cy="${GROUND + 2}" rx="110" ry="11" fill="#000" opacity=".4"/>
  <g filter="url(#wobble)">
    <path d="M${gx - 34},${gy + 70} h-46 M${gx - 28},${gy + 104} h-62 M${gx - 36},${gy + 138} h-40" stroke="${C.cream}" stroke-width="5" stroke-linecap="round" opacity=".85"/>
  </g>
  <image href="${uri('ghost-run2')}" x="${gx}" y="${gy}" width="${gw}" height="${gh}" filter="url(#sticker)"/>`;
}

// ---------------------------------------------------------------- icon.png
const S = 512;
function iconSvg() {
  const g = size('ghost-idle'), gh = 392, gw = gh * g.w / g.h;
  return `
  <defs>
    <radialGradient id="iconBg" cx=".5" cy=".42" r=".72"><stop offset="0" stop-color="#ffb04a"/><stop offset=".6" stop-color="${C.pumpkin}"/><stop offset="1" stop-color="${C.pumpkinLo}"/></radialGradient>
    <radialGradient id="iconGlow"><stop offset="0" stop-color="${C.cream}" stop-opacity=".55"/><stop offset="1" stop-color="${C.cream}" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="${S}" height="${S}" fill="url(#iconBg)"/>
  <rect x="14" y="14" width="${S - 28}" height="${S - 28}" rx="104" fill="none" stroke="${C.cream}" stroke-width="6" opacity=".35"/>
  <circle cx="256" cy="244" r="215" fill="url(#iconGlow)"/>
  <ellipse cx="256" cy="${256 + gh / 2 - 6}" rx="140" ry="16" fill="${C.ink}" opacity=".3"/>
  <image href="${uri('ghost-idle')}" x="${256 - gw / 2}" y="${256 - gh / 2 - 6}" width="${gw}" height="${gh}" filter="url(#sticker)"/>`;
}

// ---------------------------------------------------------------- render
async function render(browser, html, w, h, out) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.setContent(html);
  await pg.evaluate(() => window.prepare());
  await pg.locator('#c').screenshot({ path: out, omitBackground: false });
  await ctx.close();
  console.log('wrote', out, fs.statSync(out).size, 'bytes');
}

(async () => {
  const browser = await chromium.launch();
  await render(browser, page(W, H, C.paper, ogSvg()), W, H, path.join(IMG, 'og.png'));
  await render(browser, page(S, S, C.pumpkin, iconSvg()), S, S, path.join(IMG, 'icon.png'));
  await browser.close();
})();
