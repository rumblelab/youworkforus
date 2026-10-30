// Renders the player's jack-o'-lantern candy pail in three moods (768x512 transparent PNG each):
//   img/bucket.png (mischievous), img/bucket-hit.png (ouch, sick tint), img/bucket-yay.png (star eyes).
// Same approach as render-candies.js: inline SVG, Playwright screenshot @2x with omitBackground,
// then tools/finish-bucket.py downscales, verifies and builds a contact sheet.
// The pail is modelled as a lobed surface of revolution seen from slightly above; the face is drawn
// flat and wrapped onto the surface in the page (so it curves with the pumpkin).
// All three variants share the exact same body, rim, handle and candy geometry; only the face,
// palette tint and small effects (puff / sparkles) change.
// Usage: node tools/render-bucket.js [imgDir]
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const IMG = path.resolve(process.argv[2] || path.join(__dirname, '..', 'img'));
const W = 768, H = 512;

// ---------- geometry (shared with the page for face wrapping) ----------
const GEO_SRC = `
const CX = 384, PHI = 13 * Math.PI / 180, SPHI = Math.sin(PHI), CPHI = Math.cos(PHI);
const HTOP = 272, RMAX = 360, HC = 118, YB = 422, NL = 12, DL = 2 * Math.PI / NL, DEPTH = 0.06;
function Rp(h) {
  const u = h > HC ? (h - HC) / 268 : (h - HC) / 166;
  return RMAX * Math.pow(Math.max(0, 1 - Math.pow(Math.abs(u), 2.2)), 1 / 2.2);
}
function rLobe(h, th) {
  const f = th - Math.round(th / DL) * DL;
  const b = Math.max(0, Math.cos(Math.PI * f / DL));
  return Rp(h) * (1 - DEPTH * (1 - Math.sqrt(b)));
}
function proj(h, th, r) { return [CX + r * Math.sin(th), YB - h * CPHI + r * Math.cos(th) * SPHI]; }
// face plane: u along the surface (px), v downward from FACE_TOP
const FACE_TOP = 256, RF = 330;
function wrapPt(u, v) {
  const h = FACE_TOP - v, th = u / RF;
  return proj(h, th, Rp(h) * (1 - DEPTH * 0.25));
}
`;
const G = new Function(GEO_SRC + 'return {CX,PHI,SPHI,CPHI,HTOP,RMAX,HC,YB,NL,DL,DEPTH,Rp,rLobe,proj,FACE_TOP,RF,wrapPt};')();
const { CX, SPHI, CPHI, HTOP, RMAX, HC, YB, DL, Rp, rLobe, proj } = G;

const f1 = n => n.toFixed(1);
const P = pts => 'M' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' L') + ' Z';
const Pl = pts => 'M' + pts.map(p => f1(p[0]) + ',' + f1(p[1])).join(' L');
const rad2 = d => d * Math.PI / 180;

// ---------- colour helpers ----------
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const toHex = a => '#' + a.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };

// ---------- defs helpers (same idea as render-candies.js) ----------
let defs = [], uid = 0;
const nid = p => `${p}${++uid}`;
const stopsXml = stops => stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('');
function linU(x1, y1, x2, y2, stops) {
  const id = nid('g');
  defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f1(x1)}" y1="${f1(y1)}" x2="${f1(x2)}" y2="${f1(y2)}">${stopsXml(stops)}</linearGradient>`);
  return `url(#${id})`;
}
function lin(stops, dir = 'v') {
  const id = nid('g');
  const [x2, y2] = dir === 'v' ? [0, 1] : dir === 'h' ? [1, 0] : [1, 1];
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stopsXml(stops)}</linearGradient>`);
  return `url(#${id})`;
}
function radU(cx, cy, r, stops, fx = cx, fy = cy) {
  const id = nid('r');
  defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f1(cx)}" cy="${f1(cy)}" r="${f1(r)}" fx="${f1(fx)}" fy="${f1(fy)}">${stopsXml(stops)}</radialGradient>`);
  return `url(#${id})`;
}
function rad(stops, cx = 0.35, cy = 0.3, r = 0.75) {
  const id = nid('r');
  defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stopsXml(stops)}</radialGradient>`);
  return `url(#${id})`;
}
function clipD(inner) { const id = nid('c'); defs.push(`<clipPath id="${id}">${inner}</clipPath>`); return `url(#${id})`; }
function blur(sd) { const id = nid('b'); defs.push(`<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${sd}"/></filter>`); return `url(#${id})`; }

// ---------- body ----------
const LOBES = [-90, 90, -60, 60, -30, 30, 0].map(rad2); // back-to-front draw order
function lobePath(tc) {
  // side lobes are cut at the true silhouette (theta = +-90deg); the part behind it is hidden anyway
  const t1 = Math.max(-Math.PI / 2, tc - DL / 2), t2 = Math.min(Math.PI / 2, tc + DL / 2), pts = [];
  const NH = 48, NT = 24;
  for (let i = 0; i <= NH; i++) { const h = HTOP * (1 - i / NH); pts.push(proj(h, t1, rLobe(h, t1))); }
  for (let j = 1; j < NT; j++) { const t = t1 + (t2 - t1) * j / NT; pts.push(proj(0, t, rLobe(0, t))); }
  for (let i = 0; i <= NH; i++) { const h = HTOP * i / NH; pts.push(proj(h, t2, rLobe(h, t2))); }
  for (let j = NT - 1; j > 0; j--) { const t = t1 + (t2 - t1) * j / NT; pts.push(proj(HTOP, t, rLobe(HTOP, t))); }
  return P(pts);
}
function curveAt(th, h0, h1, n = 40) { const pts = []; for (let i = 0; i <= n; i++) { const h = h0 + (h1 - h0) * i / n; pts.push(proj(h, th, rLobe(h, th))); } return pts; }
function ellipsePts(R, h, t0, t1, n = 96) { const pts = []; for (let i = 0; i <= n; i++) { const t = t0 + (t1 - t0) * i / n; pts.push(proj(h, t, R)); } return pts; }

const RRIM = Rp(HTOP), RO = RRIM + 16, RI = RRIM - 12, HLT = HTOP + 7, HLB = HTOP - 14;
const RIM_CY = YB - HLT * CPHI;            // centre line of the open top (lip top surface)
const BODY_D = LOBES.map(lobePath);
const BODY_X0 = CX - RMAX, BODY_X1 = CX + RMAX;
const BODY_YBOT = YB + Rp(0) * SPHI;

// lip (rolled rim): side band + top ring + opening
const lipBandD = P([...ellipsePts(RO, HLT, rad2(-90), rad2(90)), ...ellipsePts(RO, HLB, rad2(90), rad2(-90))]);
const lipTopD = P(ellipsePts(RO, HLT, 0, 2 * Math.PI)) + ' ' + P(ellipsePts(RI, HLT, 0, 2 * Math.PI));
const openD = P(ellipsePts(RI, HLT, 0, 2 * Math.PI));
const OPEN_TOP = YB - HLT * CPHI - RI * SPHI, OPEN_BOT = YB - HLT * CPHI + RI * SPHI;

// handle attachment
const HL_H = HTOP - 26, HL_R = Rp(HL_H) + 10, HL_Y = YB - HL_H * CPHI, HL_TOP = 20;
function handleD() {
  const xl = CX - HL_R, xr = CX + HL_R, ry = HL_Y - HL_TOP, k = 0.6;
  return `M${f1(xl)},${f1(HL_Y)} C${f1(xl)},${f1(HL_Y - k * ry * 1.05)} ${f1(CX - k * HL_R)},${HL_TOP} ${CX},${HL_TOP} C${f1(CX + k * HL_R)},${HL_TOP} ${f1(xr)},${f1(HL_Y - k * ry * 1.05)} ${f1(xr)},${f1(HL_Y)}`;
}

// ---------- face shapes in the flat face plane (u right, v down from FACE_TOP) ----------
// polynomial through 3 points (corner, middle, corner) -> smooth curve
function quad3(p0, p1, p2) {
  return u => {
    const [x0, y0] = p0, [x1, y1] = p1, [x2, y2] = p2;
    return y0 * (u - x1) * (u - x2) / ((x0 - x1) * (x0 - x2)) + y1 * (u - x0) * (u - x2) / ((x1 - x0) * (x1 - x2)) + y2 * (u - x0) * (u - x1) / ((x2 - x0) * (x2 - x1));
  };
}
// crescent/band mouth: top(u), thickness profile; teeth notches [u0,u1,depth] hanging from top / rising from bottom
function mouth({ u0, u1, top, thick, pow = 0.6, teethTop = [], teethBot = [], step = 3 }) {
  const um = (u0 + u1) / 2, hw = (u1 - u0) / 2;
  const th = u => thick * Math.pow(Math.max(0, 1 - Math.pow((u - um) / hw, 2)), pow);
  const edge = (u, list, sgn) => { for (const [a, b, d] of list) if (u >= a && u <= b) return sgn * Math.min(d, th(u) - 10); return 0; };
  const us = [];
  for (let u = u0; u <= u1 + 1e-6; u += step) us.push(u);
  for (const [a, b] of [...teethTop, ...teethBot]) us.push(a - 0.01, a + 0.01, b - 0.01, b + 0.01);
  us.sort((a, b) => a - b);
  const T = us.map(u => [u, top(u) + edge(u, teethTop, 1)]);
  const B = us.slice().reverse().map(u => [u, top(u) + th(u) - edge(u, teethBot, 1)]);
  return Pl([...T, ...B]) + ' Z';
}
function star(cx, cy, ro, ri, rot = 0, n = 5) {
  const pts = [];
  for (let i = 0; i < 2 * n; i++) { const a = rad2(rot - 90) + i * Math.PI / n, r = i % 2 ? ri : ro; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return P(pts);
}

const FACES = {
  grin: {
    holes: [
      // slanted, mischievous eyes (right brow cocked a bit higher)
      'M-234,22 L-76,74 C-90,102 -140,112 -184,104 C-224,92 -238,60 -234,22 Z',
      'M234,8 L78,72 C94,100 140,108 184,100 C224,88 238,52 234,8 Z',
      'M0,94 L-26,124 L26,124 Z',
      mouth({ u0: -266, u1: 266, top: quad3([-266, 122], [-10, 154], [266, 104]), thick: 64, pow: 0.55,
        teethTop: [[-118, -72, 28], [46, 92, 28]], teethBot: [[-30, 12, 24], [120, 156, 16]] }),
    ],
  },
  ouch: {
    holes: [
      // eyes squeezed shut: > <
      'M-228,22 L-84,68 L-228,114 L-212,86 L-144,68 L-212,50 Z',
      'M228,22 L84,68 L228,114 L212,86 L144,68 L212,50 Z',
      'M0,98 L-22,124 L22,124 Z',
      // gritted-teeth frown: arch band split into a 2x5 grid of cells
      ...(() => {
        const top = quad3([-214, 176], [0, 140], [214, 176]), T = 58, gap = 9;
        const xs = [-214, -128, -43, 43, 128, 214];
        const cells = [];
        for (let r = 0; r < 2; r++) {
          const off = r ? -21 : 21; // stagger bottom row
          const bx = r ? [-214, -171, -86, 0, 86, 171, 214] : xs;
          for (let c = 0; c < bx.length - 1; c++) {
            const a = bx[c] + (c ? gap / 2 : 0), b = bx[c + 1] - (c < bx.length - 2 ? gap / 2 : 0);
            const pts = [];
            const y0 = u => top(u) + (r ? T / 2 + gap / 2 : 0), y1 = u => top(u) + (r ? T : T / 2 - gap / 2);
            for (let u = a; u <= b + 1e-6; u += 3) pts.push([u, y0(u)]);
            pts.push([b, y0(b)]);
            for (let u = b; u >= a - 1e-6; u -= 3) pts.push([u, y1(u)]);
            pts.push([a, y1(a)]);
            cells.push(P(pts));
          }
        }
        return cells;
      })(),
    ],
  },
  yay: {
    holes: [
      star(-144, 60, 68, 29, -8),
      star(144, 60, 68, 29, 8),
      'M0,104 L-20,126 L20,126 Z',
      mouth({ u0: -258, u1: 258, top: quad3([-262, 112], [0, 138], [262, 112]), thick: 82, pow: 0.42,
        teethTop: [[-70, -22, 28], [22, 70, 28]], teethBot: [[-150, -112, 18], [112, 150, 18]] }),
    ],
  },
};

// ---------- candies peeking out of the top ----------
function twistCandy(x, y, rot, s, body, stripe) {
  const end = (sg) => `<path d="M${sg * 40},-9 L${sg * 70},-30 Q${sg * 76},-14 ${sg * 72},0 Q${sg * 76},14 ${sg * 70},30 L${sg * 40},9 Z" fill="${body}" stroke="#000" stroke-opacity=".35" stroke-width="2"/>
    <path d="M${sg * 46},-6 L${sg * 68},-20 M${sg * 46},0 L${sg * 70},0 M${sg * 46},6 L${sg * 68},20" stroke="#fff" stroke-opacity=".45" stroke-width="2.5" fill="none"/>`;
  const c = clipD(`<ellipse rx="46" ry="30"/>`);
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">${end(-1)}${end(1)}
    <ellipse rx="46" ry="30" fill="${body}"/>
    <g clip-path="${c}">${[-60, -30, 0, 30, 60].map(k => `<rect x="${k - 7}" y="-40" width="13" height="80" fill="${stripe}" transform="rotate(25)"/>`).join('')}
      <ellipse rx="46" ry="30" fill="${rad([[0, '#fff', 0.55], [0.4, '#fff', 0], [1, '#000', 0.35]], 0.35, 0.25, 0.85)}"/></g>
    <ellipse rx="46" ry="30" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="2.5"/>
    <ellipse cx="-16" cy="-15" rx="16" ry="6" fill="#fff" fill-opacity=".75" transform="rotate(-12 -16 -15)"/></g>`;
}
function lollipop(x, y, r, stickLen, rot = 0) {
  const sp = [];
  for (let t = 0; t <= 4.2 * Math.PI; t += 0.08) { const rr = r * 0.95 * t / (4.2 * Math.PI); sp.push([rr * Math.cos(t), rr * Math.sin(t)]); }
  return `<g transform="translate(${x},${y}) rotate(${rot})">
    <rect x="-6" y="0" width="12" height="${stickLen}" rx="5" fill="${lin([[0, '#c9c3d6'], [0.4, '#fff'], [1, '#a59cb8']], 'h')}" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/>
    <circle r="${r}" fill="#ff3d8b"/>
    <path d="${Pl(sp)}" fill="none" stroke="#fff" stroke-width="${r * 0.2}" stroke-linecap="round"/>
    <path d="${Pl(sp)}" fill="none" stroke="#7a1cc9" stroke-opacity=".55" stroke-width="${r * 0.07}" stroke-linecap="round" transform="rotate(40)"/>
    <circle r="${r}" fill="${rad([[0, '#fff', 0.5], [0.45, '#fff', 0], [1, '#3a0020', 0.45]], 0.35, 0.3, 0.8)}"/>
    <circle r="${r}" fill="none" stroke="#5a0630" stroke-opacity=".6" stroke-width="2.5"/>
    <ellipse cx="${-r * 0.38}" cy="${-r * 0.45}" rx="${r * 0.3}" ry="${r * 0.13}" fill="#fff" fill-opacity=".85" transform="rotate(-30 ${-r * 0.38} ${-r * 0.45})"/></g>`;
}
function bar(x, y, rot, w, h, body, band, txt) {
  const a = w / 2, b = h / 2, fh = 16;
  let crimp = (sg) => { let d = `M${-a + 4},${sg * (b - 2)}`; const n = 10; for (let i = 0; i <= n; i++) d += ` L${(-a + 4 + i * (w - 8) / n).toFixed(1)},${sg * (b + (i % 2 ? fh - 5 : fh))}`; return d + ` L${a - 4},${sg * (b - 2)} Z`; };
  const c = clipD(`<rect x="${-a}" y="${-b}" width="${w}" height="${h}" rx="8"/>`);
  return `<g transform="translate(${x},${y}) rotate(${rot})">
    <path d="${crimp(-1)} ${crimp(1)}" fill="${body}" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/>
    <path d="${crimp(-1)} ${crimp(1)}" fill="${lin([[0, '#000', 0.3], [0.3, '#fff', 0.3], [0.5, '#fff', 0], [1, '#000', 0.3]], 'h')}"/>
    <rect x="${-a}" y="${-b}" width="${w}" height="${h}" rx="8" fill="${body}"/>
    <g clip-path="${c}"><rect x="${-a}" y="${-b * 0.25}" width="${w}" height="${h * 0.32}" fill="${band}"/>
      <text x="0" y="${b * 0.02}" text-anchor="middle" dominant-baseline="central" font-family="'Inter Display','Inter',sans-serif" font-weight="900" font-size="${w * 0.34}" fill="#fff" stroke="#3a0a4a" stroke-width="4" paint-order="stroke fill" transform="rotate(-90)">${txt}</text>
      <rect x="${-a}" y="${-b}" width="${w}" height="${h}" fill="${lin([[0, '#000', 0.35], [0.15, '#fff', 0.05], [0.3, '#fff', 0.45], [0.45, '#fff', 0.05], [0.8, '#000', 0], [1, '#000', 0.4]], 'h')}"/></g>
    <rect x="${-a}" y="${-b}" width="${w}" height="${h}" rx="8" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/></g>`;
}
function candyCorn(x, y, rot, s) {
  const d = 'M0,-46 C10,-46 40,20 40,34 C40,48 -40,48 -40,34 C-40,20 -10,-46 0,-46 Z';
  const c = clipD(`<path d="${d}"/>`);
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})">
    <path d="${d}" fill="#ffd21f"/><g clip-path="${c}"><rect x="-50" y="-50" width="100" height="42" fill="#fff6e0"/><rect x="-50" y="-8" width="100" height="26" fill="#ff8a1a"/>
    <path d="${d}" fill="${rad([[0, '#fff', 0.45], [0.5, '#fff', 0], [1, '#000', 0.3]], 0.35, 0.3, 0.9)}"/></g>
    <path d="${d}" fill="none" stroke="#5a2a00" stroke-opacity=".45" stroke-width="2.5"/></g>`;
}

// ---------- sparkles / puff ----------
function twinkle(x, y, r, color = '#fff', glow = '#ffe36b', rot = 0) {
  const k = r * 0.22;
  const d = `M0,${-r} C${k},${-k} ${k},${-k} ${r},0 C${k},${k} ${k},${k} 0,${r} C${-k},${k} ${-k},${k} ${-r},0 C${-k},${-k} ${-k},${-k} 0,${-r} Z`;
  return `<g transform="translate(${x},${y}) rotate(${rot})"><circle r="${r * 0.7}" fill="${glow}" fill-opacity=".45" filter="${blur(r * 0.25)}"/>
    <path d="${d}" fill="${color}" stroke="#ffb300" stroke-width="${Math.max(1.5, r * 0.06)}" stroke-linejoin="round"/>
    <circle r="${r * 0.14}" fill="#fff"/></g>`;
}
function puff(x, y, s) {
  const blobs = [[0, 0, 34], [-36, 10, 26], [34, 12, 27], [-14, -24, 25], [20, -20, 23], [8, 20, 26]];
  const d = blobs.map(([bx, by, r]) => `M${bx - r},${by} a${r},${r} 0 1,0 ${2 * r},0 a${r},${r} 0 1,0 ${-2 * r},0 Z`).join(' ');
  return `<g transform="translate(${x},${y}) scale(${s})">
    <path d="${d}" fill="none" stroke="#2c4a12" stroke-width="7" stroke-linejoin="round"/>
    <path d="${d}" fill="#c9f07a"/>
    <path d="${d}" fill="${rad([[0, '#fff', 0.7], [0.45, '#fff', 0], [1, '#4f8a1a', 0.55]], 0.38, 0.3, 0.75)}"/>
    <circle cx="-62" cy="40" r="11" fill="#c9f07a" stroke="#2c4a12" stroke-width="3.5"/>
    <circle cx="-82" cy="60" r="6" fill="#c9f07a" stroke="#2c4a12" stroke-width="3"/></g>`;
}
function sweat(x, y, s, rot = 0) {
  const d = 'M0,-30 C10,-12 20,0 20,12 C20,24 11,32 0,32 C-11,32 -20,24 -20,12 C-20,0 -10,-12 0,-30 Z';
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})"><path d="${d}" fill="${rad([[0, '#ffffff'], [0.5, '#9fe0ff'], [1, '#2f8fd6']], 0.4, 0.55, 0.7)}" stroke="#0e3d66" stroke-width="3"/>
    <ellipse cx="-7" cy="10" rx="4" ry="8" fill="#fff" fill-opacity=".9"/></g>`;
}

// ---------- variants ----------
const BASE = { dark: '#a3360a', mid: '#f26a0f', light: '#ffa43c', hi: '#ffd59a', lip: '#ff9636', lipTop: '#ffbd6a', lipDark: '#b8480a', groove: '#6e2104' };
const VARIANTS = {
  bucket: { face: 'grin', tint: null, glowIn: '#ff7a00', glowOp: 0.3, holeTop: '#080100', holeBot: '#2a0a00' },
  'bucket-hit': { face: 'ouch', tint: ['#4fc83a', 0.3], glowIn: '#9cff3c', glowOp: 0.35, holeTop: '#071003', holeBot: '#16300a' },
  'bucket-yay': { face: 'yay', tint: null, glowIn: '#ffffff', glowOp: 0.75, holeTop: '#ffb21a', holeBot: '#fff3a8', bright: true },
};

function build(v) {
  defs = []; uid = 0;
  const pal = {};
  for (const k in BASE) pal[k] = v.tint ? mix(BASE[k], v.tint[0], v.tint[1]) : BASE[k];
  const bodyClip = clipD(BODY_D.map(d => `<path d="${d}"/>`).join(''));

  // lobes: per-lobe horizontal shading; lit from the upper left
  let lobes = '';
  for (const tc of LOBES) {
    const t1 = tc - DL / 2, t2 = tc + DL / 2;
    const xa = proj(HC, t1, rLobe(HC, t1))[0], xb = proj(HC, t2, rLobe(HC, t2))[0];
    const L = Math.max(0, Math.min(1, 0.55 + 0.5 * Math.cos(tc + rad2(28))));
    const peak = mix(pal.mid, pal.light, L);
    const g = linU(Math.min(xa, xb), 0, Math.max(xa, xb), 0, [[0, pal.dark], [0.2, mix(pal.dark, pal.mid, 0.75)], [0.46, peak], [0.62, mix(pal.mid, peak, 0.6)], [0.85, mix(pal.dark, pal.mid, 0.65)], [1, pal.dark]]);
    lobes += `<path d="${lobePath(tc)}" fill="${g}"/>`;
  }
  // groove lines (visible ones)
  let grooves = '';
  for (const gdeg of [-75, -45, -15, 15, 45, 75]) {
    const pts = curveAt(rad2(gdeg), 4, HTOP - 4);
    grooves += `<path d="${Pl(pts)}" fill="none" stroke="${pal.groove}" stroke-opacity=".55" stroke-width="5" stroke-linecap="round"/>`;
  }
  // global curvature shading over the body
  const shadeH = linU(BODY_X0, 0, BODY_X1, 0, [[0, '#000', 0.5], [0.08, '#000', 0.18], [0.22, '#fff', 0.06], [0.36, '#fff', 0.1], [0.55, '#000', 0], [0.78, '#000', 0.12], [0.93, '#1a0a1a', 0.4], [1, '#120612', 0.58]]);
  const shadeV = linU(0, RIM_CY, 0, BODY_YBOT, [[0, '#000', 0.25], [0.3, '#000', 0], [0.7, '#000', 0], [0.88, '#000', 0.22], [1, '#000', 0.5]]);
  // purple bounce light from the stage along the lower right edge
  const bounce = radU(CX + RMAX * 0.95, YB, RMAX * 0.5, [[0, '#9b7bff', 0.22], [1, '#9b7bff', 0]]);
  const lipShadow = `<path d="${lipBandD}" transform="translate(0,12)" fill="#3a0e00" fill-opacity=".55" filter="${blur(7)}"/>`;

  // specular streaks per lobe (masked out of the face holes)
  let spec = '';
  for (const tc of LOBES) {
    const L = Math.max(0, Math.cos(tc + rad2(35)));
    if (L < 0.15) continue;
    const ts = tc - 0.2 * DL, w = 0.075 * DL, left = [], right = [];
    const h0 = HTOP * 0.24, h1 = HTOP * 0.9, n = 30;
    for (let i = 0; i <= n; i++) {
      const s = i / n, h = h0 + (h1 - h0) * s, ww = w * Math.pow(Math.sin(Math.PI * s), 0.7);
      left.push(proj(h, ts - ww, rLobe(h, ts - ww) + 1)); right.unshift(proj(h, ts + ww, rLobe(h, ts + ww) + 1));
    }
    spec += `<path d="${P([...left, ...right])}" fill="#fff" fill-opacity="${(0.25 + 0.6 * L * L).toFixed(2)}" filter="${blur(3.5)}"/>`;
  }
  // big soft hotspot on the upper-left shoulder + crisp little glints
  const hot = proj(HTOP * 0.68, rad2(-42), RMAX);
  spec += `<ellipse cx="${f1(hot[0])}" cy="${f1(hot[1])}" rx="62" ry="34" transform="rotate(-28 ${f1(hot[0])} ${f1(hot[1])})" fill="${rad([[0, '#fff', 0.75], [1, '#fff', 0]], 0.5, 0.5, 0.5)}"/>`;
  const gl = proj(HTOP * 0.62, rad2(-50), RMAX);
  spec += `<ellipse cx="${f1(gl[0])}" cy="${f1(gl[1])}" rx="16" ry="7" transform="rotate(-50 ${f1(gl[0])} ${f1(gl[1])})" fill="#fff" fill-opacity=".95"/>`;

  // face holes (flat paths; wrapped in-page)
  const face = FACES[v.face];
  const holesDataFlat = face.holes.map(d => `<path data-flat="${d}" d="M0,0"/>`).join('');
  const holeClip = clipD(holesDataFlat);
  const fTop = G.wrapPt(0, 30)[1], fBot = G.wrapPt(0, 220)[1];
  const holeFill = linU(0, fTop, 0, fBot, [[0, v.holeTop], [1, v.holeBot]]);
  const glow = radU(CX, G.wrapPt(0, 150)[1], 300, [[0, v.glowIn, v.glowOp], [0.55, v.glowIn, v.glowOp * 0.35], [1, v.glowIn, 0]]);
  const wallFill = linU(0, fTop, 0, fBot, [[0, v.bright ? '#fff3b0' : mix(pal.light, '#ffe0a0', 0.4)], [1, v.bright ? '#ffd23a' : pal.mid]]);
  const holesFace = `<g clip-path="${holeClip}">
      <rect x="0" y="0" width="${W}" height="${H}" fill="${wallFill}"/>
      <g transform="translate(0,-9)">${face.holes.map(d => `<path data-flat="${d}" d="M0,0" fill="${holeFill}"/><path data-flat="${d}" d="M0,0" fill="${glow}"/>`).join('')}</g>
      <g transform="translate(0,-9)" filter="${blur(4)}">${face.holes.map(d => `<path data-flat="${d}" d="M0,0" fill="none" stroke="#000" stroke-opacity="${v.bright ? 0.35 : 0.6}" stroke-width="10"/>`).join('')}</g>
    </g>
    ${face.holes.map(d => `<path data-flat="${d}" d="M0,0" fill="none" stroke="${v.bright ? '#4a1200' : '#2a0a00'}" stroke-opacity="${v.bright ? 0.95 : 0.7}" stroke-width="${v.bright ? 6 : 2.5}" stroke-linejoin="round"/>`).join('')}`;
  const specMaskId = nid('m');
  defs.push(`<mask id="${specMaskId}" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#fff"/>${face.holes.map(d => `<path data-flat="${d}" d="M0,0" fill="#000" stroke="#000" stroke-width="6"/>`).join('')}</mask>`);
  // yay: the glow spills out of the face a little
  const outerGlow = v.bright ? `<g filter="${blur(14)}" opacity=".55">${face.holes.map(d => `<path data-flat="${d}" d="M0,0" fill="#ffe25a"/>`).join('')}</g>` : '';

  // lip
  const lipBandFill = linU(0, YB - HLT * CPHI, 0, YB - HLB * CPHI + RO * SPHI, [[0, pal.lipTop], [0.55, pal.lip], [1, pal.lipDark]]);
  const lipTopFill = linU(0, OPEN_TOP - 16, 0, OPEN_BOT + 16, [[0, mix(pal.lipDark, pal.lip, 0.5)], [0.5, pal.lip], [0.8, pal.lipTop], [1, mix(pal.lipTop, '#fff', 0.35)]]);
  const lipShadeH = linU(CX - RO, 0, CX + RO, 0, [[0, '#000', 0.35], [0.12, '#000', 0], [0.3, '#fff', 0.12], [0.6, '#000', 0], [0.9, '#000', 0.2], [1, '#000', 0.45]]);
  const lipGlint = Pl(ellipsePts((RO + RI) / 2 + 3, HLT, rad2(-62), rad2(-14), 40));
  const lipGlint2 = Pl(ellipsePts(RO - 2, HLT - 9, rad2(-70), rad2(-30), 30));
  const lip = (front) => `<g ${front ? `clip-path="${clipD(`<rect x="0" y="${f1(RIM_CY)}" width="${W}" height="${H}"/>`)}"` : ''}>
    <path d="${lipBandD}" fill="${lipBandFill}" stroke="#3a1000" stroke-opacity=".55" stroke-width="3" stroke-linejoin="round"/>
    <path d="${lipBandD}" fill="${lipShadeH}"/>
    <path d="${lipTopD}" fill-rule="evenodd" fill="${lipTopFill}"/>
    <path d="${lipTopD}" fill-rule="evenodd" fill="${lipShadeH}"/>
    <path d="${lipTopD}" fill-rule="evenodd" fill="none" stroke="#5a1800" stroke-opacity=".5" stroke-width="1.8"/>
    <path d="${lipGlint}" fill="none" stroke="#fff" stroke-opacity=".85" stroke-width="5" stroke-linecap="round" filter="${blur(1.6)}"/>
    <path d="${lipGlint2}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round" filter="${blur(2)}"/>
  </g>`;

  // interior
  const interiorFill = linU(0, OPEN_TOP, 0, OPEN_BOT, [[0, mix(pal.dark, '#000', 0.25)], [0.28, mix(pal.dark, '#000', 0.6)], [0.6, '#1a0600'], [1, '#0c0300']]);
  const interior = `<path d="${openD}" fill="${interiorFill}"/>
    <path d="${openD}" fill="${radU(CX - 60, OPEN_TOP + 10, RI * 0.9, [[0, mix(pal.light, '#000', 0.35), 0.5], [1, '#000', 0]])}"/>`;

  // candies (identical in all variants): clipped to "inside the opening or above the rim line"
  const candyClip = clipD(`<path d="${openD}"/><rect x="0" y="0" width="${W}" height="${f1(RIM_CY)}"/>`);
  const candies = `<g clip-path="${candyClip}">
    ${bar(318, 132, -16, 86, 150, '#7b2fd0', '#ffcf1f', 'BOO')}
    ${lollipop(500, 80, 42, 180, 10)}
    ${twistCandy(218, 158, -18, 1.05, '#16c2b0', '#e9fffb')}
    ${candyCorn(410, 160, 14, 0.85)}
    ${twistCandy(590, 168, 16, 0.95, '#ffd21f', '#ff4f7b')}
    ${candyCorn(258, 196, -30, 0.7)}
    <path d="${openD}" fill="${linU(0, OPEN_TOP + 40, 0, OPEN_BOT, [[0, '#0c0300', 0], [0.55, '#0c0300', 0.55], [1, '#0c0300', 0.9]])}"/>
  </g>`;

  // handle
  const hd = handleD();
  const handle = `<g>
    <path d="${hd}" fill="none" stroke="#000" stroke-width="30" stroke-linecap="round"/>
    <path d="${hd}" fill="none" stroke="#1b1424" stroke-width="25" stroke-linecap="round"/>
    <path d="${hd}" fill="none" stroke="#3b3150" stroke-width="12" stroke-linecap="round" transform="translate(-2,-5)" filter="${blur(2.5)}"/>
    <path d="${hd}" fill="none" stroke="#e8e0ff" stroke-opacity=".75" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="0 140 330 1000" transform="translate(-2,-7)" filter="${blur(0.8)}"/>
  </g>`;
  const lug = sx => {
    const x = CX + sx * (HL_R - 4), y = HL_Y;
    return `<g transform="translate(${f1(x)},${f1(y)})"><ellipse rx="19" ry="23" fill="#000"/><ellipse rx="16" ry="20" fill="${rad([[0, '#6c6280'], [0.35, '#251d30'], [1, '#07050a']], 0.35, 0.3, 0.8)}"/>
      <ellipse cx="-5" cy="-8" rx="5" ry="3" fill="#fff" fill-opacity=".7"/></g>`;
  };

  // extras per variant
  let back = '', front = '';
  if (v.face === 'ouch') {
    front = puff(660, 82, 0.95) + sweat(112, 262, 0.95, -18) + sweat(146, 218, 0.6, -10);
  }
  if (v.face === 'yay') {
    front = twinkle(86, 118, 34, '#fff', '#ffe36b', 0) + twinkle(690, 96, 40, '#fff', '#ffe36b', 10) + twinkle(140, 52, 17, '#fff8c4') +
      twinkle(632, 30, 15, '#fff8c4') + twinkle(726, 196, 15, '#fff8c4') + twinkle(42, 222, 13, '#fff8c4');
  }

  const bodyOutline = BODY_D.map(d => `<path d="${d}" fill="none" stroke="#2a0b00" stroke-opacity=".75" stroke-width="7" stroke-linejoin="round"/>`).join('');
  return `${back}
  <g id="bucket">
    ${bodyOutline}
    ${lobes}
    <g clip-path="${bodyClip}">${grooves}
      ${outerGlow}
      ${holesFace}
      <rect width="${W}" height="${H}" fill="${shadeH}"/>
      <rect width="${W}" height="${H}" fill="${shadeV}"/>
      <rect width="${W}" height="${H}" fill="${bounce}"/>
      ${lipShadow}
      <g mask="url(#${specMaskId})">${spec}</g>
    </g>
    ${lip(false)}
    ${interior}
    ${handle}
    ${candies}
    ${lip(true)}
    ${lug(-1)}${lug(1)}
  </g>
  <g id="fx">${front}</g>`;
}

function page(svg) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style></head><body>
<svg id="c" xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs>
<filter id="sh" filterUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}">
 <feGaussianBlur in="SourceAlpha" stdDeviation="9" result="b1"/><feOffset in="b1" dy="10" result="o1"/>
 <feComponentTransfer in="o1" result="s1"><feFuncA type="linear" slope="0.5"/></feComponentTransfer>
 <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="b2"/><feOffset in="b2" dy="3" result="o2"/>
 <feComponentTransfer in="o2" result="s2"><feFuncA type="linear" slope="0.35"/></feComponentTransfer>
 <feMerge><feMergeNode in="s1"/><feMergeNode in="s2"/><feMergeNode in="SourceGraphic"/></feMerge>
</filter>
${defs.join('\n')}
</defs>
<g filter="url(#sh)">${svg}</g>
</svg>
<script>
{
${GEO_SRC}
// wrap every flat face path onto the pumpkin surface
const NS = 'http://www.w3.org/2000/svg', tmp = document.createElementNS(NS, 'path');
document.querySelector('defs').appendChild(tmp);
for (const el of document.querySelectorAll('[data-flat]')) {
  const out = [];
  for (const sub of el.dataset.flat.split(/(?=M)/)) {
    tmp.setAttribute('d', sub);
    const L = tmp.getTotalLength(), n = Math.max(24, Math.ceil(L / 1.5)), pts = [];
    for (let i = 0; i <= n; i++) { const p = tmp.getPointAtLength(L * i / n); const q = wrapPt(p.x, p.y); pts.push(q[0].toFixed(2) + ',' + q[1].toFixed(2)); }
    out.push('M' + pts.join(' L') + ' Z');
  }
  el.setAttribute('d', out.join(' '));
}
}
</script></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  pg.on('pageerror', e => { console.error('PAGE ERROR:', e.message); process.exitCode = 1; });
  pg.on('console', m => console.log('page:', m.text()));
  for (const [slug, v] of Object.entries(VARIANTS)) {
    const html = page(build(v));
    await pg.setContent(html);
    await pg.evaluate(() => document.fonts.ready);
    const out = path.join(IMG, `${slug}@2x.tmp.png`);
    await pg.locator('#c').screenshot({ path: out, omitBackground: true });
    await pg.evaluate(() => document.getElementById('fx').setAttribute('display', 'none'));
    await pg.locator('#c').screenshot({ path: path.join(IMG, `${slug}.sil@2x.tmp.png`), omitBackground: true });
    console.log('rendered', slug);
  }
  await browser.close();
  // geometry the game needs for collision (fractions of the 768x512 image)
  const meta = {
    rimCenterY: RIM_CY / H, rimBackY: OPEN_TOP / H, rimFrontY: OPEN_BOT / H,
    openingX0: (CX - RI) / W, openingX1: (CX + RI) / W,
    lipX0: (CX - RO) / W, lipX1: (CX + RO) / W,
    bodyX0: BODY_X0 / W, bodyX1: BODY_X1 / W, bodyWidth: (BODY_X1 - BODY_X0) / W,
    bodyBottomY: BODY_YBOT / H, handleTopY: (HL_TOP - 15) / H,
  };
  fs.writeFileSync(path.join(__dirname, 'bucket-geometry.json'), JSON.stringify(meta, null, 2) + '\n');
  console.log(JSON.stringify(meta, null, 2));
})();
