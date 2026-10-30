// Renders placeholder candy illustrations (512x512 transparent PNG) for every entry in img/manifest.json.
// Usage: node render-candies.js [imgDir] [slug ...]
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const IMG = path.resolve(process.argv[2] || '/home/user/youworkforus/img');
const only = process.argv.slice(3);
const manifest = JSON.parse(fs.readFileSync(path.join(IMG, 'manifest.json'), 'utf8'));

const INTER = "'Inter Display','Inter','Liberation Sans',sans-serif";
const LIB = "'Liberation Sans','DejaVu Sans',sans-serif";
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

// deterministic RNG so re-renders are identical
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

let defs = [];
let uid = 0;
const nid = p => `${p}${++uid}`;
function lin(stops, dir = 'v') {
  const id = nid('g');
  const [x2, y2] = dir === 'v' ? [0, 1] : dir === 'h' ? [1, 0] : [1, 1];
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</linearGradient>`);
  return `url(#${id})`;
}
function rad(stops, cx = 0.35, cy = 0.3, r = 0.75) {
  const id = nid('r');
  defs.push(`<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join('')}</radialGradient>`);
  return `url(#${id})`;
}
function clip(d) { const id = nid('c'); defs.push(`<clipPath id="${id}"><path d="${d}"/></clipPath>`); return `url(#${id})`; }

// text; maxw => shrunk in-browser to fit. outer => second, wider stroke layer behind.
function T(x, y, s, o = {}) {
  const { size = 60, fill = '#fff', stroke = 'none', sw = 0, fam = INTER, weight = 900, italic = false,
    maxw = 0, ls = 0, rot = 0, outer = null, html = null } = o;
  const one = (f, st, w) => `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="${fam}" font-weight="${weight}" font-style="${italic ? 'italic' : 'normal'}" font-size="${size}" fill="${f}" stroke="${st}" stroke-width="${w}" stroke-linejoin="round" paint-order="stroke fill" letter-spacing="${ls}"${maxw ? ` data-maxw="${maxw}"` : ''}${rot ? ` transform="rotate(${rot} ${x} ${y})"` : ''}>${html || esc(s)}</text>`;
  return (outer ? one(outer[0], outer[0], sw + outer[1]) : '') + one(fill, stroke, sw);
}

// ---------- package shapes (drawn centered at 0,0) ----------
const GLOSS_V = () => lin([[0, '#fff', 0], [0.08, '#fff', 0.45], [0.2, '#fff', 0.08], [0.5, '#000', 0], [1, '#000', 0.34]]);
const SHADE_H = () => lin([[0, '#000', 0.32], [0.09, '#000', 0], [0.91, '#000', 0], [1, '#000', 0.32]], 'h');

function flowBar({ L = 420, H = 190, angle = -10, body, fin, content = '', fw = 32 }) {
  fin = fin || body;
  const a = L / 2 - fw, h = H / 2, fh = h * 0.86;
  const bodyP = `M${-a},${-h + 9} Q${-a + 3},${-h} ${-a + 26},${-h} L${a - 26},${-h} Q${a - 3},${-h} ${a},${-h + 9} L${a},${h - 9} Q${a - 3},${h} ${a - 26},${h} L${-a + 26},${h} Q${-a + 3},${h} ${-a},${h - 9} Z`;
  const finP = s => {
    const x0 = s * (a - 4), x1 = s * (a + fw); const n = Math.max(6, Math.round(2 * fh / 9));
    let d = `M${x0},${-fh}`;
    for (let i = 0; i <= n; i++) d += ` L${i % 2 ? x1 - s * 6 : x1},${(-fh + i * 2 * fh / n).toFixed(1)}`;
    return d + ` L${x0},${fh} Z`;
  };
  const fins = [finP(-1), finP(1)];
  const finClip = clip(fins.join(' '));
  let crimps = '';
  for (let x = a + 3; x < a + fw - 6; x += 4)
    for (const s of [-1, 1]) crimps += `<line x1="${s * x}" y1="${-fh}" x2="${s * x}" y2="${fh}" stroke="#000" stroke-opacity=".22" stroke-width="1.3"/><line x1="${s * (x + 1.6)}" y1="${-fh}" x2="${s * (x + 1.6)}" y2="${fh}" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>`;
  const bc = clip(bodyP);
  return `<g transform="translate(256,256) rotate(${angle})">
    ${fins.map(d => `<path d="${d}" fill="${fin}"/>`).join('')}
    <g clip-path="${finClip}">${crimps}<rect x="${-a - fw}" y="${-fh}" width="${2 * (a + fw)}" height="${2 * fh}" fill="${GLOSS_V()}"/></g>
    <path d="${bodyP}" fill="${body}"/>
    <g clip-path="${bc}">${content}
      <rect x="${-a}" y="${-h}" width="${2 * a}" height="${H}" fill="${GLOSS_V()}"/>
      <rect x="${-a}" y="${-h}" width="${2 * a}" height="${H}" fill="${SHADE_H()}"/></g>
    <path d="${bodyP}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/>
  </g>`;
}

function pouch({ W = 320, H = 420, angle = -4, body, seam, content = '', sh = 30, cx = 256, cy = 256, under = '' }) {
  seam = seam || body;
  const w = W / 2, b = H / 2 - sh, sw = w * 0.93;
  const bodyP = `M${-w + 16},${-b} L${w - 16},${-b} Q${w},${-b} ${w + 1},${-b + 16} Q${w + 9},0 ${w + 1},${b - 16} Q${w},${b} ${w - 16},${b} L${-w + 16},${b} Q${-w},${b} ${-w - 1},${b - 16} Q${-w - 9},0 ${-w - 1},${-b + 16} Q${-w},${-b} ${-w + 16},${-b} Z`;
  const seamP = s => {
    const y0 = s * (b - 4), y1 = s * (b + sh); const n = Math.round(2 * sw / 10);
    let d = `M${-sw},${y0}`;
    for (let i = 0; i <= n; i++) d += ` L${(-sw + i * 2 * sw / n).toFixed(1)},${i % 2 ? y1 - s * 6 : y1}`;
    return d + ` L${sw},${y0} Z`;
  };
  const seams = [seamP(-1), seamP(1)];
  const sc = clip(seams.join(' '));
  let crimps = '';
  for (let y = b + 3; y < b + sh - 6; y += 4)
    for (const s of [-1, 1]) crimps += `<line x1="${-sw}" y1="${s * y}" x2="${sw}" y2="${s * y}" stroke="#000" stroke-opacity=".22" stroke-width="1.3"/><line x1="${-sw}" y1="${s * (y + 1.6)}" x2="${sw}" y2="${s * (y + 1.6)}" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>`;
  const bc = clip(bodyP);
  const glossH = lin([[0, '#000', 0.34], [0.12, '#000', 0], [0.2, '#fff', 0.05], [0.27, '#fff', 0.4], [0.35, '#fff', 0.04], [0.8, '#000', 0], [1, '#000', 0.36]], 'h');
  const glossV = lin([[0, '#fff', 0.25], [0.12, '#fff', 0], [0.85, '#000', 0], [1, '#000', 0.25]]);
  return `<g transform="translate(${cx},${cy}) rotate(${angle})">${under}
    ${seams.map(d => `<path d="${d}" fill="${seam}"/>`).join('')}
    <g clip-path="${sc}">${crimps}<rect x="${-sw}" y="${-b - sh}" width="${2 * sw}" height="${2 * (b + sh)}" fill="${lin([[0, '#000', 0.3], [0.25, '#fff', 0.25], [0.4, '#fff', 0], [1, '#000', 0.3]], 'h')}"/></g>
    <path d="${bodyP}" fill="${body}"/>
    <g clip-path="${bc}">${content}
      <rect x="${-w - 10}" y="${-b}" width="${2 * w + 20}" height="${2 * b}" fill="${glossH}"/>
      <rect x="${-w - 10}" y="${-b}" width="${2 * w + 20}" height="${2 * b}" fill="${glossV}"/></g>
    <path d="${bodyP}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.5"/>
  </g>`;
}

function box({ W, H, D = 50, front, top, side, content = '', angle = 0 }) {
  const dx = D * 0.75, dy = -D * 0.55;
  const x0 = -(W + dx) / 2, y0 = -(H - dy) / 2 - dy;
  const f = `M${x0},${y0} h${W} v${H} h${-W} Z`;
  const t = `M${x0},${y0} L${x0 + dx},${y0 + dy} L${x0 + W + dx},${y0 + dy} L${x0 + W},${y0} Z`;
  const s = `M${x0 + W},${y0} L${x0 + W + dx},${y0 + dy} L${x0 + W + dx},${y0 + H + dy} L${x0 + W},${y0 + H} Z`;
  const fc = clip(f);
  return `<g transform="translate(256,256) rotate(${angle})">
    <path d="${t}" fill="${top}"/><path d="${t}" fill="${lin([[0, '#fff', 0.35], [1, '#fff', 0.05]])}"/>
    <path d="${s}" fill="${side}"/><path d="${s}" fill="${lin([[0, '#000', 0.15], [1, '#000', 0.4]])}"/>
    <path d="${f}" fill="${front}"/>
    <g clip-path="${fc}"><g transform="translate(${x0 + W / 2},${y0 + H / 2})">${content}</g>
      <rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${lin([[0, '#fff', 0.28], [0.35, '#fff', 0], [0.7, '#000', 0], [1, '#000', 0.25]], 'd')}"/></g>
    <path d="${t} ${s} ${f}" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="M${x0},${y0} h${W} L${x0 + W + dx},${y0 + dy}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="2"/>
  </g>`;
}

function twist({ L = 260, H = 140, ew = 85, angle = -10, body, end, content = '', rx = 22, endStroke = 'none', bodyStroke = '#000', bodyStrokeOp = 0.3, glossOp = 1, under = '' }) {
  const a = L / 2, h = H / 2, nk = h * 0.24, fl = h * 1.08;
  const endP = s => {
    let d = `M${s * (a - 6)},${-h * 0.72} C${s * (a + 8)},${-h * 0.6} ${s * (a + 8)},${-nk} ${s * (a + 20)},${-nk} C${s * (a + 40)},${-nk} ${s * (a + ew - 20)},${-fl} ${s * (a + ew)},${-fl}`;
    const n = 7;
    for (let i = 1; i <= n; i++) {
      const y = -fl + i * 2 * fl / n, ym = y - fl / n;
      d += ` Q${s * (a + ew - 14)},${ym.toFixed(1)} ${s * (a + ew - (i === n ? 0 : 2))},${y.toFixed(1)}`;
    }
    d += ` C${s * (a + ew - 20)},${fl} ${s * (a + 40)},${nk} ${s * (a + 20)},${nk} C${s * (a + 8)},${nk} ${s * (a + 8)},${h * 0.6} ${s * (a - 6)},${h * 0.72} Z`;
    return d;
  };
  const folds = s => [-0.75, -0.4, -0.05, 0.3, 0.68].map(k => `<path d="M${s * (a + 22)},${k * nk * 1.5} Q${s * (a + ew * 0.6)},${k * fl * 0.6} ${s * (a + ew - 8)},${k * fl}" fill="none" stroke="#000" stroke-opacity=".22" stroke-width="2"/><path d="M${s * (a + 24)},${k * nk * 1.5 + 3} Q${s * (a + ew * 0.6)},${k * fl * 0.6 + 4} ${s * (a + ew - 8)},${k * fl + 5}" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width="1.5"/>`).join('');
  const bodyP = `M${-a + rx},${-h} H${a - rx} Q${a},${-h} ${a},${-h + rx} V${h - rx} Q${a},${h} ${a - rx},${h} H${-a + rx} Q${-a},${h} ${-a},${h - rx} V${-h + rx} Q${-a},${-h} ${-a + rx},${-h} Z`;
  const bc = clip(bodyP);
  const cyl = lin([[0, '#000', 0.35], [0.14, '#fff', 0], [0.26, '#fff', 0.42 * glossOp], [0.4, '#fff', 0], [0.78, '#000', 0.08], [1, '#000', 0.4]]);
  const neck = s => `<rect x="${s > 0 ? a + 8 : -a - 26}" y="${-nk * 1.15}" width="18" height="${nk * 2.3}" rx="6" fill="${end}"/><rect x="${s > 0 ? a + 8 : -a - 26}" y="${-nk * 1.15}" width="18" height="${nk * 2.3}" rx="6" fill="#000" fill-opacity=".25"/>`;
  return `<g transform="translate(256,256) rotate(${angle})">${under}
    ${[-1, 1].map(s => `<path d="${endP(s)}" fill="${end}" stroke="${endStroke}" stroke-width="2"/>${folds(s)}`).join('')}
    ${neck(-1)}${neck(1)}
    <path d="${bodyP}" fill="${body}"/>
    <g clip-path="${bc}">${content}<rect x="${-a}" y="${-h}" width="${L}" height="${H}" fill="${cyl}"/></g>
    <path d="${bodyP}" fill="none" stroke="${bodyStroke}" stroke-opacity="${bodyStrokeOp}" stroke-width="1.5"/>
  </g>`;
}

// ---------- small motifs ----------
function lentil(x, y, r, color, rot = 0, sx = 1.1) {
  const g = rad([[0, '#fff', 0.55], [0.35, color], [1, color]], 0.35, 0.3, 0.8);
  return `<g transform="translate(${x},${y}) rotate(${rot})"><ellipse rx="${r * sx}" ry="${r}" fill="${color}"/><ellipse rx="${r * sx}" ry="${r}" fill="${g}"/><ellipse rx="${r * sx}" ry="${r}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/><ellipse cx="${-r * 0.35}" cy="${-r * 0.42}" rx="${r * 0.35}" ry="${r * 0.18}" fill="#fff" fill-opacity=".6" transform="rotate(-20 ${-r * 0.35} ${-r * 0.42})"/></g>`;
}
function peanut(x, y, r, color, rot = 0) {
  const g = rad([[0, '#fff', 0.5], [0.4, color], [1, color]], 0.35, 0.3, 0.8);
  const d = `M${-r * 1.25},0 C${-r * 1.3},${-r} ${-r * 0.2},${-r * 1.05} 0,${-r * 0.85} C${r * 0.2},${-r * 1.05} ${r * 1.3},${-r} ${r * 1.25},0 C${r * 1.3},${r} ${r * 0.2},${r * 1.05} 0,${r * 0.85} C${-r * 0.2},${r * 1.05} ${-r * 1.3},${r} ${-r * 1.25},0 Z`;
  return `<g transform="translate(${x},${y}) rotate(${rot})"><path d="${d}" fill="${color}"/><path d="${d}" fill="${g}"/><path d="${d}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="2"/><ellipse cx="${-r * 0.5}" cy="${-r * 0.5}" rx="${r * 0.4}" ry="${r * 0.16}" fill="#fff" fill-opacity=".55" transform="rotate(-15 ${-r * 0.5} ${-r * 0.5})"/></g>`;
}
function cup(x, y) {
  let ridges = '';
  for (let i = 0; i <= 14; i++) { const t = i / 14; ridges += `<line x1="${-64 + 128 * t}" y1="-16" x2="${-50 + 100 * t}" y2="40" stroke="#2a1205" stroke-opacity=".7" stroke-width="2.2"/>`; }
  return `<g transform="translate(${x},${y})"><path d="M-64,-16 L64,-16 L50,40 Q0,48 -50,40 Z" fill="${lin([[0, '#5e2f12'], [1, '#3a1a08']])}"/>${ridges}
    <path d="M-64,-16 L64,-16 L50,40 Q0,48 -50,40 Z" fill="${lin([[0, '#000', 0.3], [0.3, '#fff', 0.15], [0.45, '#fff', 0], [1, '#000', 0.35]], 'h')}"/>
    <ellipse cy="-16" rx="64" ry="17" fill="#7a4220"/><ellipse cy="-18" rx="52" ry="11" fill="#8f5228"/><ellipse cx="-18" cy="-21" rx="20" ry="4" fill="#fff" fill-opacity=".25"/></g>`;
}
function stars(r, n, box, color = '#fff', op = 0.8) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const x = box[0] + r() * (box[2] - box[0]), y = box[1] + r() * (box[3] - box[1]), k = 3 + r() * 4;
    s += `<path d="M${x},${y - k} L${x + k * 0.3},${y - k * 0.3} L${x + k},${y} L${x + k * 0.3},${y + k * 0.3} L${x},${y + k} L${x - k * 0.3},${y + k * 0.3} L${x - k},${y} L${x - k * 0.3},${y - k * 0.3} Z" fill="${color}" fill-opacity="${op}"/>`;
  }
  return s;
}
function coconut(x, y, r) {
  let hair = '';
  for (let i = 0; i < 26; i++) { const t = i / 26 * Math.PI * 2; hair += `<line x1="${Math.cos(t) * r * 0.85}" y1="${Math.sin(t) * r * 0.85}" x2="${Math.cos(t + 0.12) * r * 1.0}" y2="${Math.sin(t + 0.12) * r * 1.0}" stroke="#3a1d0c" stroke-width="2"/>`; }
  return `<g transform="translate(${x},${y})"><circle r="${r}" fill="#6b3d1f"/>${hair}<circle r="${r * 0.78}" fill="${rad([[0, '#ffffff'], [0.7, '#f7f1e3'], [1, '#e2d6bd']], 0.4, 0.4, 0.7)}"/><circle r="${r}" fill="none" stroke="#2a1205" stroke-width="2"/></g>`;
}
function almond(x, y, s, rot) {
  const d = `M0,${-28 * s} C${18 * s},${-18 * s} ${20 * s},${14 * s} 0,${30 * s} C${-20 * s},${14 * s} ${-18 * s},${-18 * s} 0,${-28 * s} Z`;
  return `<g transform="translate(${x},${y}) rotate(${rot})"><path d="${d}" fill="${rad([[0, '#e2a565'], [1, '#9a5a28']], 0.4, 0.35, 0.8)}" stroke="#5a2d10" stroke-width="2"/>
    <path d="M0,${-22 * s} C${6 * s},0 ${6 * s},${10 * s} 0,${24 * s}" fill="none" stroke="#7a4219" stroke-opacity=".6" stroke-width="1.5"/><path d="M${-7 * s},${-12 * s} C${-10 * s},0 ${-8 * s},${10 * s} ${-4 * s},${18 * s}" fill="none" stroke="#7a4219" stroke-opacity=".5" stroke-width="1.5"/></g>`;
}
function mint(x, y, cut) {
  return `<g transform="translate(${x},${y})"><ellipse cy="4" rx="30" ry="21" fill="#2a1408"/><ellipse rx="30" ry="21" fill="${rad([[0, '#8a5634'], [0.5, '#4a2512'], [1, '#2a1408']], 0.38, 0.3, 0.8)}"/>
    ${cut ? `<ellipse cy="-2" rx="23" ry="14" fill="${rad([[0, '#ffffff'], [1, '#d9f2e6']], 0.4, 0.4, 0.7)}" stroke="#3a1d0c" stroke-width="2"/>` : `<ellipse cx="-9" cy="-9" rx="10" ry="4" fill="#fff" fill-opacity=".35" transform="rotate(-15 -9 -9)"/>`}</g>`;
}
function chew(x, y, s, color, rot) {
  return `<g transform="translate(${x},${y}) rotate(${rot})"><rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="7" fill="${color}" stroke="#fff" stroke-width="3" stroke-opacity=".85"/>
    <rect x="${-s / 2}" y="${-s / 2}" width="${s}" height="${s}" rx="7" fill="${lin([[0, '#fff', 0.5], [0.4, '#fff', 0], [1, '#000', 0.2]], 'd')}"/></g>`;
}

// ---------- per-candy designs ----------
const D = {
  'snickers': () => flowBar({
    body: lin([[0, '#7a4520'], [1, '#4a2510']]),
    content: `<g transform="skewX(-14)"><rect x="-150" y="-46" width="300" height="92" rx="46" fill="#f7f2e6" stroke="#1d4aa8" stroke-width="5"/></g>
      ${T(0, 2, 'SNICKERS', { size: 74, fill: '#1f4fb4', fam: LIB, weight: 700, italic: true, maxw: 262, stroke: '#0e2a6b', sw: 1.5 })}
      <rect x="-200" y="66" width="400" height="6" fill="#c8102e" opacity=".8"/><rect x="-200" y="-72" width="400" height="6" fill="#c8102e" opacity=".8"/>`
  }),
  'milky-way': () => {
    const r = rng(7);
    return flowBar({
      angle: -9, body: lin([[0, '#5a3420'], [1, '#2f1a0d']]),
      content: `<path d="M-200,40 Q0,-110 200,-10 L200,20 Q0,-75 -200,70 Z" fill="#5fbf45" opacity=".35"/>${stars(r, 14, [-170, -85, 170, 85], '#fff', 0.7)}
        ${T(0, 0, 'MILKY WAY', { size: 66, fill: '#53b33c', stroke: '#fff', sw: 8, outer: ['#163d10', 7], italic: true, maxw: 300 })}`
    });
  },
  'three-musketeers': () => flowBar({
    angle: -10, body: lin([[0, '#f4f6fa'], [0.45, '#c9d0db'], [0.55, '#aab3c2'], [1, '#e1e6ee']]), fin: lin([[0, '#e8ecf2'], [1, '#9aa4b4']]),
    content: `<rect x="-200" y="-70" width="400" height="10" fill="#1d3f8f"/><rect x="-200" y="60" width="400" height="10" fill="#1d3f8f"/>
      ${T(-112, 4, '3', { size: 150, fill: '#d0142c', stroke: '#fff', sw: 8, outer: ['#1d3f8f', 6] })}
      ${T(42, 2, 'MUSKETEERS', { size: 46, fill: '#1d3f8f', maxw: 226, italic: true })}`
  }),
  'twix': () => flowBar({
    angle: -10, body: lin([[0, '#f3d27a'], [0.3, '#ddae42'], [0.62, '#bb8722'], [1, '#8a5f12']]),
    content: `<path d="M-200,58 C-100,30 -40,90 40,60 S170,40 200,55 L200,110 L-200,110 Z" fill="#7a4a10" opacity=".45"/>
      <path d="M-200,-62 C-100,-82 0,-40 200,-70 L200,-110 L-200,-110 Z" fill="#fff" opacity=".18"/>
      ${T(0, -2, 'TWIX', { size: 116, fill: '#d0021b', stroke: '#fff', sw: 9, outer: ['#6b0010', 7], maxw: 270 })}`
  }),
  'kit-kat': () => flowBar({
    angle: -10, body: lin([[0, '#e01d39'], [1, '#9e0a20']]),
    content: `<g transform="rotate(-9)"><ellipse rx="140" ry="64" fill="#fff"/><ellipse rx="128" ry="53" fill="none" stroke="#c8102e" stroke-width="3"/></g>
      ${T(0, 0, 'KIT KAT', { size: 66, fill: '#c8102e', maxw: 210, rot: -9 })}`
  }),
  'hersheys': () => {
    const silver = lin([[0, '#ffffff'], [0.45, '#dfe3e8'], [0.56, '#9aa3ad'], [1, '#eef0f3']]);
    return flowBar({
      angle: -10, body: lin([[0, '#5c3524'], [1, '#2a140a']]),
      content: `<rect x="-200" y="-78" width="400" height="4" fill="${silver}"/><rect x="-200" y="74" width="400" height="4" fill="${silver}"/>
        ${T(0, -12, "HERSHEY'S", { size: 76, fill: silver, stroke: '#140802', sw: 2.5, maxw: 322 })}
        ${T(0, 46, 'MILK CHOCOLATE', { size: 21, fill: '#d6dae0', weight: 700, ls: 4, maxw: 300 })}`
    });
  },
  'crunch': () => {
    const r = rng(11); let crisps = '';
    for (let i = 0; i < 60; i++) crisps += `<ellipse cx="${-190 + r() * 380}" cy="${-95 + r() * 190}" rx="${5 + r() * 6}" ry="${3 + r() * 3}" transform="rotate(${r() * 180})" fill="#7fa8f0" fill-opacity="${0.25 + r() * 0.3}"/>`;
    return flowBar({
      angle: -10, body: lin([[0, '#3473dd'], [1, '#163f8c']]),
      content: `${crisps}${T(0, 0, 'CRUNCH', { size: 96, fill: '#fff', stroke: '#c8102e', sw: 6, outer: ['#0d2a66', 8], maxw: 300 })}`
    });
  },
  'butterfinger': () => {
    const r = rng(5); let flakes = '';
    for (let i = 0; i < 26; i++) {
      const x = -185 + r() * 370, y = (r() < 0.5 ? -1 : 1) * (52 + r() * 40), k = 6 + r() * 9;
      flakes += `<path d="M${x},${y - k} L${x + k},${y - k * 0.2} L${x + k * 0.4},${y + k} L${x - k * 0.9},${y + k * 0.5} Z" fill="${r() < 0.5 ? '#e8701a' : '#f08c2a'}" transform="rotate(${r() * 90} ${x} ${y})"/>`;
    }
    return flowBar({
      angle: -10, body: lin([[0, '#ffd83a'], [1, '#f0a400']]),
      content: `${flakes}${T(0, 0, 'BUTTERFINGER', { size: 58, fill: '#1d4fa8', stroke: '#fff', sw: 8, outer: ['#0b2a66', 5], maxw: 322 })}`
    });
  },
  'almond-joy': () => flowBar({
    angle: -10, body: lin([[0, '#2a82c8'], [1, '#104a80']]),
    content: `${coconut(118, -8, 44)}${almond(92, 40, 1.15, -35)}
      ${T(-52, -26, 'ALMOND', { size: 52, fill: '#fff', stroke: '#0a2f55', sw: 7, maxw: 210 })}
      ${T(-52, 32, 'JOY', { size: 64, fill: '#fff', stroke: '#0a2f55', sw: 7, maxw: 210 })}`
  }),
  'mounds': () => flowBar({
    angle: -10, body: lin([[0, '#c22e36'], [1, '#6e1016']]),
    content: `<rect x="-200" y="-74" width="400" height="5" fill="#fff" opacity=".9"/><rect x="-200" y="69" width="400" height="5" fill="#fff" opacity=".9"/>
      ${T(0, -10, 'MOUNDS', { size: 90, fill: '#fff', stroke: '#3d0609', sw: 8, maxw: 300 })}
      ${T(0, 44, 'DARK CHOCOLATE · COCONUT', { size: 17, fill: '#ffe9e9', weight: 700, ls: 2, maxw: 290 })}`
  }),
  'reeses': () => flowBar({
    L: 420, H: 272, angle: -6, body: lin([[0, '#f78a2c'], [1, '#c9520c']]),
    content: `${T(0, -78, "REESE'S", { size: 84, fill: '#ffd21a', stroke: '#4a2410', sw: 10, maxw: 310 })}
      ${T(0, -28, 'PEANUT BUTTER CUPS', { size: 19, fill: '#4a2410', weight: 800, ls: 2, maxw: 300 })}
      ${cup(-76, 46)}${cup(76, 46)}`
  }),
  'mms': () => {
    const cols = ['#d6262b', '#f7c600', '#1ea34a', '#1a6fd6', '#f27a12', '#8a4a26', '#1a6fd6', '#d6262b', '#1ea34a'];
    const pos = [[-95, 60], [-30, 50], [40, 62], [105, 55], [-110, 120], [-50, 115], [15, 118], [80, 122], [128, 108]];
    return pouch({
      angle: -5, body: lin([[0, '#7a3e1d'], [1, '#4a220e']]),
      content: `${T(0, -88, "M&amp;M's", { html: "M&amp;M's", size: 100, fill: '#fff', stroke: '#2a1205', sw: 10, maxw: 270 })}
        ${T(0, -24, 'MILK CHOCOLATE', { size: 20, fill: '#f5d9a8', weight: 700, ls: 3, maxw: 260 })}
        ${pos.map((p, i) => lentil(p[0], p[1], 25, cols[i], (i * 37) % 60 - 30)).join('')}`
    });
  },
  'peanut-mms': () => {
    const cols = ['#d6262b', '#1a6fd6', '#1ea34a', '#f27a12', '#8a4a26', '#d6262b', '#1a6fd6'];
    const pos = [[-90, 62], [-10, 55], [80, 64], [-120, 128], [-40, 125], [40, 128], [118, 118]];
    return pouch({
      angle: 4, body: lin([[0, '#ffd21a'], [1, '#e0a200']]),
      content: `${T(0, -128, 'PEANUT', { size: 40, fill: '#5a2d12', ls: 3, maxw: 240 })}
        ${T(0, -64, "M&amp;M's", { html: "M&amp;M's", size: 96, fill: '#5a2d12', stroke: '#fff', sw: 9, outer: ['#5a2d12', 4], maxw: 270 })}
        ${pos.map((p, i) => peanut(p[0], p[1], 27, cols[i], (i * 41) % 70 - 35)).join('')}`
    });
  },
  'skittles': () => {
    const rb = ['#e8232a', '#ff8a1a', '#ffd21a', '#2cb34a', '#8e3bd1'];
    const arcs = rb.map((c, i) => { const R = 150 - i * 13; return `<path d="M${-R},150 A${R},${R} 0 0 1 ${R},150" fill="none" stroke="${c}" stroke-width="13.5"/>`; }).join('');
    const cand = [[-62, 112, 4], [0, 98, 2], [62, 112, 3], [-30, 152, 0], [32, 152, 1]];
    return pouch({
      angle: -4, body: lin([[0, '#e23434'], [1, '#a3161a']]),
      content: `<g opacity=".95">${arcs}</g>
        ${T(0, -112, 'SKITTLES', { size: 62, fill: '#fff', stroke: '#6e0a0a', sw: 9, maxw: 270, rot: -4 })}
        ${T(0, -62, 'TASTE THE RAINBOW', { size: 17, fill: '#ffe1e1', weight: 700, ls: 2, maxw: 250 })}
        ${cand.map(([x, y, k]) => lentil(x, y, 24, rb[k], 0, 1.05)).join('')}`
    });
  },
  'sour-patch-kids': () => {
    defs.push(`<pattern id="sugar" width="9" height="9" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.6" fill="#fff" fill-opacity=".85"/><circle cx="6.5" cy="6" r="1.3" fill="#fff" fill-opacity=".7"/></pattern>
      <g id="kid"><circle cx="0" cy="-34" r="17"/><rect x="-15" y="-21" width="30" height="38" rx="12"/><rect x="-34" y="-17" width="68" height="13" rx="6.5"/><rect x="-15" y="6" width="13" height="34" rx="6.5"/><rect x="2" y="6" width="13" height="34" rx="6.5"/></g>`);
    const kid = (x, y, c, rot, s = 1) => `<g transform="translate(${x},${y}) rotate(${rot}) scale(${s})"><use href="#kid" fill="${c}" stroke="#000" stroke-opacity=".35" stroke-width="3"/><use href="#kid" fill="${c}"/><use href="#kid" fill="url(#sugar)"/><circle cx="-6" cy="-40" r="5" fill="#fff" fill-opacity=".45"/></g>`;
    return pouch({
      angle: -5, body: lin([[0, '#38c266'], [1, '#1d8a42']]),
      content: `<path d="M-200,-200 H200 V-38 C120,-10 60,-62 0,-36 S-120,-10 -200,-40 Z" fill="#ffd21a"/>
        ${T(0, -118, 'SOUR PATCH', { size: 50, fill: '#1d4fb0', stroke: '#fff', sw: 7, outer: ['#0b2a66', 4], maxw: 270 })}
        ${T(0, -54, 'KIDS', { size: 82, fill: '#e8232a', stroke: '#fff', sw: 8, outer: ['#6b0a0f', 4], maxw: 220 })}
        ${kid(-82, 90, '#e8232a', -18, 1.15)}${kid(0, 110, '#ff8a1a', 8, 1.15)}${kid(84, 88, '#2b7de0', 20, 1.15)}`
    });
  },
  'swedish-fish': () => {
    const fish = `M-95,0 C-65,-58 40,-58 72,-10 L110,-44 C102,-14 102,14 110,44 L72,10 C40,58 -65,58 -95,0 Z`;
    return pouch({
      angle: 4, body: lin([[0, '#e8303c'], [1, '#a3121c']]),
      content: `<rect x="-128" y="-12" width="256" height="178" rx="34" fill="${lin([[0, '#bfe9ff'], [1, '#6cc3ef']])}" stroke="#fff" stroke-width="5"/>
        <path d="M-128,30 q32,-14 64,0 t64,0 t64,0 t64,0" fill="none" stroke="#fff" stroke-opacity=".6" stroke-width="4"/>
        <path d="M-128,140 q32,-14 64,0 t64,0 t64,0 t64,0" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="4"/>
        <g transform="translate(0,82)"><path d="${fish}" fill="${rad([[0, '#ff6b6b'], [0.6, '#e3121f'], [1, '#a50c18']], 0.4, 0.35, 0.8)}" stroke="#7a0a12" stroke-width="3"/>
          <circle cx="-62" cy="-8" r="6" fill="#7a0a12" fill-opacity=".7"/><path d="M-20,-30 Q0,-10 -20,14" fill="none" stroke="#7a0a12" stroke-opacity=".5" stroke-width="3"/>
          <ellipse cx="-20" cy="-26" rx="40" ry="8" fill="#fff" fill-opacity=".35" transform="rotate(-8 -20 -26)"/></g>
        ${T(0, -128, 'SWEDISH', { size: 56, fill: '#fff', stroke: '#5e070d', sw: 8, maxw: 260 })}
        ${T(0, -64, 'FISH', { size: 70, fill: '#fff', stroke: '#5e070d', sw: 8, maxw: 240 })}`
    });
  },
  'starburst': () => flowBar({
    L: 420, H: 168, angle: -10, body: lin([[0, '#ff79a8'], [1, '#d22f6a']]), fin: lin([[0, '#ffd84a'], [1, '#f0a400']]),
    content: `${T(0, -32, 'STARBURST', { size: 62, fill: '#ffd400', stroke: '#d4141f', sw: 8, outer: ['#fff', 5], maxw: 320 })}
      ${chew(-90, 40, 44, '#ff9fc0', -6)}${chew(-30, 42, 44, '#ffd84a', 4)}${chew(30, 40, 44, '#ff9a2e', -3)}${chew(90, 42, 44, '#e8323c', 6)}`
  }),
  'airheads': () => {
    const cols = ['#e8232a', '#1c7fe0', '#ffc61a', '#2cb34a', '#8e3bd1', '#ff8a1a', '#1c7fe0', '#e8232a'];
    const html = 'AIRHEADS'.split('').map((c, i) => `<tspan fill="${cols[i]}">${c}</tspan>`).join('');
    return flowBar({
      L: 432, H: 128, angle: -12, body: lin([[0, '#ffffff'], [1, '#d9e3ec']]), fin: lin([[0, '#5cc6f2'], [1, '#1f8fc4']]),
      content: `<rect x="-220" y="-64" width="440" height="20" fill="#36b3e8"/><rect x="-220" y="44" width="440" height="20" fill="#36b3e8"/>
        ${T(0, 0, '', { html, size: 68, fill: '#fff', stroke: '#0b2a6e', sw: 7, maxw: 330 })}`
    });
  },
  'nerds': () => {
    const r = rng(3); let dots = '';
    const pal = ['#ff4f9a', '#ffd21a', '#3bb3ff', '#ffffff', '#8e3bd1', '#2cc36b', '#ff8a1a'];
    for (let i = 0; i < 130; i++) {
      const x = -120 + r() * 240, y = -160 + r() * 320, k = 3 + r() * 3.5;
      dots += `<rect x="${x - k}" y="${y - k * 0.8}" width="${2 * k}" height="${1.6 * k}" rx="${k * 0.7}" transform="rotate(${r() * 180} ${x} ${y})" fill="${pal[i % pal.length]}" stroke="#000" stroke-opacity=".25" stroke-width="1"/>`;
    }
    return box({
      W: 250, H: 330, D: 54, angle: -5,
      front: '#8e3bd1', top: lin([[0, '#ff7ab6'], [0.5, '#ff7ab6'], [0.5, '#b26ae6'], [1, '#b26ae6']], 'h'), side: '#6d23a8',
      content: `<path d="M-130,-170 H30 C10,-60 -30,40 -10,170 H-130 Z" fill="#ff4f9a"/><path d="M30,-170 C10,-60 -30,40 -10,170" fill="none" stroke="#fff" stroke-width="6"/>
        ${dots}
        <ellipse cx="0" cy="-20" rx="120" ry="58" fill="#fff" fill-opacity=".0"/>
        ${T(0, -22, 'NERDS', { size: 84, fill: '#fff', stroke: '#3a0f5c', sw: 12, maxw: 220, rot: -10 })}`
    });
  },
  'junior-mints': () => box({
    W: 360, H: 220, D: 46, angle: 4,
    front: lin([[0, '#22b888'], [1, '#0f7a58']]), top: '#4fd0a6', side: '#0c6448',
    content: `<rect x="-190" y="-48" width="380" height="74" fill="#fff"/><rect x="-190" y="-56" width="380" height="5" fill="#fff" opacity=".8"/><rect x="-190" y="29" width="380" height="5" fill="#fff" opacity=".8"/>
      ${T(0, -11, 'JUNIOR MINTS', { size: 48, fill: '#0d6b4f', maxw: 320 })}
      ${T(0, -82, 'CHOCOLATE · MINT', { size: 18, fill: '#e6fff5', weight: 700, ls: 3, maxw: 300 })}
      ${mint(-70, 76, false)}${mint(0, 80, true)}${mint(70, 76, false)}`
  }),
  'tootsie-roll': () => twist({
    L: 276, H: 160, ew: 80, angle: -10, body: lin([[0, '#6a3b24'], [1, '#3d1f10']]), end: '#4f2b19',
    content: `<rect x="-140" y="-66" width="280" height="8" fill="#fff"/><rect x="-140" y="58" width="280" height="8" fill="#fff"/>
      ${T(0, -16, 'TOOTSIE', { size: 62, fill: '#fff', stroke: '#b5121b', sw: 7, outer: ['#2a1205', 4], maxw: 236 })}
      ${T(0, 34, 'ROLL', { size: 44, fill: '#fff', stroke: '#b5121b', sw: 6, outer: ['#2a1205', 4], maxw: 200, ls: 4 })}`
  }),
  'jolly-rancher': () => {
    const candy = `<rect x="-118" y="-62" width="236" height="124" rx="24" fill="${lin([[0, '#7fdcff'], [0.45, '#1c9fd8'], [1, '#0a5f96']])}" fill-opacity=".95"/>
      <rect x="-104" y="-50" width="208" height="100" rx="16" fill="none" stroke="#fff" stroke-opacity=".45" stroke-width="3"/>
      <rect x="-118" y="-62" width="236" height="124" rx="24" fill="none" stroke="#06406a" stroke-opacity=".6" stroke-width="2"/>`;
    return twist({
      L: 270, H: 166, ew: 68, angle: -9, rx: 28, body: 'rgba(225,244,255,0.32)', end: 'rgba(120,200,240,0.42)', endStroke: 'rgba(255,255,255,0.7)',
      bodyStroke: '#fff', bodyStrokeOp: 0.75, glossOp: 1.4,
      content: `${candy}
        <path d="M-130,-70 L-60,85 M40,-90 L90,90 M-20,-90 L10,-40" stroke="#fff" stroke-opacity=".35" stroke-width="3"/>
        ${T(0, -22, 'JOLLY', { size: 50, fill: '#fff', stroke: '#0b3f7a', sw: 8, maxw: 220 })}
        ${T(0, 28, 'RANCHER', { size: 46, fill: '#fff', stroke: '#0b3f7a', sw: 8, maxw: 222 })}`
    });
  },
  'twizzlers': () => {
    defs.push(`<pattern id="twst" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(35)"><rect width="12" height="4.5" fill="#6b0710" fill-opacity=".55"/><rect y="5" width="12" height="2" fill="#fff" fill-opacity=".22"/></pattern>`);
    const ropeG = lin([[0, '#7a0a12'], [0.3, '#e0262f'], [0.45, '#ff5a5a'], [0.7, '#c8121c'], [1, '#6b0710']], 'h');
    const rope = (x, y, rot, len) => `<g transform="translate(${x},${y}) rotate(${rot})"><rect x="-19" y="0" width="38" height="${len}" rx="6" fill="${ropeG}"/><rect x="-19" y="0" width="38" height="${len}" rx="6" fill="url(#twst)"/>
      <ellipse cx="0" cy="2" rx="19" ry="8" fill="#e83a40" stroke="#7a0a12" stroke-width="2"/><circle cx="0" cy="2" r="4.5" fill="#5a050b"/></g>`;
    const ropes = rope(-80, -232, -9, 220) + rope(-27, -262, -3, 250) + rope(27, -248, 3, 240) + rope(80, -226, 9, 220);
    return pouch({
      W: 300, H: 320, angle: 0, cy: 312, body: lin([[0, '#d81e28'], [1, '#8a0a12']]), under: ropes,
      content: `<path d="M-170,-150 C-60,-110 60,-110 170,-150 L170,-128 C60,-90 -60,-90 -170,-128 Z" fill="#ffd31a" opacity=".9"/>
        ${T(0, -10, 'TWIZZLERS', { size: 66, fill: '#ffd31a', stroke: '#5e070d', sw: 9, outer: ['#fff', 4], maxw: 262, rot: -6 })}
        ${T(0, 58, 'TWISTS', { size: 26, fill: '#fff', weight: 800, ls: 7, maxw: 200 })}
        ${T(0, 100, 'STRAWBERRY', { size: 18, fill: '#ffd9db', weight: 700, ls: 3, maxw: 200 })}`
    });
  },
};

function page(svg) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}</style></head><body>
<svg id="c" xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
<defs>
<filter id="sh" filterUnits="userSpaceOnUse" x="0" y="0" width="512" height="512">
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
for (const el of document.querySelectorAll('[data-maxw]')) {
  const max = +el.dataset.maxw, w = el.getComputedTextLength();
  if (w > max) el.setAttribute('font-size', (+el.getAttribute('font-size')) * max / w);
}
</script></body></html>`;
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 2 });
  const pg = await ctx.newPage();
  const missing = [];
  for (const c of manifest) {
    if (only.length && !only.includes(c.slug)) continue;
    const fn = D[c.slug];
    if (!fn) { missing.push(c.slug); continue; }
    defs = []; uid = 0;
    const svg = fn();
    await pg.setContent(page(svg));
    await pg.evaluate(() => document.fonts.ready);
    const out = path.join(IMG, `${c.slug}@2x.tmp.png`);
    await pg.locator('#c').screenshot({ path: out, omitBackground: true });
    console.log('rendered', c.slug);
  }
  await browser.close();
  if (missing.length) { console.error('NO DESIGN FOR:', missing.join(', ')); process.exitCode = 1; }
})();
