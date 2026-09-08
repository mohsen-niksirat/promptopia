/* Generate an og:image PNG share card for every prompt + the homepage card.
   Pure JS (png.mjs) — no native deps. The gradient+glow base is cached per
   category palette, so per-card work is just a buffer copy + text. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PngCanvas } from './png.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'assets', 'og');
const DATA_PATH = path.join(ROOT, 'data', 'prompts.js');

/* per-category accent palettes (matches the site cover art) */
const PALETTE = {
  writing: '#8b5cf6', coding: '#d946ef', marketing: '#fb923c', education: '#38bdf8',
  business: '#34d399', career: '#22d3ee', seo: '#818cf8', video: '#f43f5e',
  ui: '#2dd4bf', 'prompt-eng': '#c084fc',
  portrait: '#a78bfa', family: '#f472b6', travel: '#38bdf8', vehicles: '#60a5fa',
  food: '#fbbf24', animals: '#4ade80', fantasy: '#c084fc', product: '#f59e0b',
  utility: '#34d399', fashion: '#f472b6', luxury: '#e2b714',
};
const DEFAULT_ACCENT = '#a78bfa';

const W = 1200, H = 630;

/* base canvas: dark gradient + centered glow, tinted per category */
function makeBase(accent) {
  const c = new PngCanvas(W, H);
  c.gradient(['#171021', '#0a0713'], { color: accent, x: 0.5, y: 0.42, r: 0.85, a: 0.30 });
  return c;
}
const baseCache = new Map();
function baseFor(cat) {
  const accent = PALETTE[cat] || DEFAULT_ACCENT;
  if (!baseCache.has(accent)) baseCache.set(accent, makeBase(accent));
  const src = baseCache.get(accent);
  const c = new PngCanvas(W, H);
  src.px.copy(c.px);
  return c;
}

function brandRow(c) {
  c.text('PROMPTOPIA', 64, 58, { scale: 4, color: '#a78bfa', alpha: 0.95 });
  /* three little brand dots */
  ['#a78bfa', '#d946ef', '#fb923c'].forEach((col, i) => {
    c.roundRect(64 + i * 26, 96, 16, 16, 8, col, 0.9);
  });
}

function cardFor(p) {
  const c = baseFor(p.cat);
  brandRow(c);
  /* category chip */
  const catEn = (p.catEn || p.cat || '').toUpperCase();
  const chipW = c.measure(catEn, 2) + 36;
  c.roundRect(64, 128, chipW, 34, 17, '#ffffff', 0.14);
  c.text(catEn, 82, 137, { scale: 2, color: '#ffffff', alpha: 0.9 });
  /* title (latin only — Persian titles fall back to english side) */
  const title = String(p.t.en || p.t.fa || '');
  c.wrapText(title, 64, 200, W - 128, { scale: 5, lineH: 66, maxLines: 3, alpha: 0.96 });
  /* CTA pill */
  const label = 'COPY  -  PASTE  -  CREATE';
  const pillW = c.measure(label, 3) + 72;
  c.roundRect(64, H - 128, pillW, 60, 30, '#8b5cf6', 1);
  c.text(label, 64 + 36, H - 128 + 23, { scale: 3, color: '#ffffff' });
  /* prompt count top-right */
  return c.toPNG();
}

function homeCard() {
  const c = new PngCanvas(W, H);
  c.gradient(['#171021', '#0a0713'], { color: '#a78bfa', x: 0.5, y: 0.4, r: 0.9, a: 0.34 });
  brandRow(c);
  c.wrapText('READY-MADE AI PROMPT GALLERY', 64, 210, W - 128, { scale: 7, lineH: 90, maxLines: 2, alpha: 0.97 });
  const label = '1,300+ PROMPTS - FA/EN - COPY & CREATE';
  const pillW = c.measure(label, 3) + 72;
  c.roundRect(64, H - 130, pillW, 60, 30, '#8b5cf6', 1);
  c.text(label, 64 + 36, H - 130 + 23, { scale: 3, color: '#ffffff' });
  return c.toPNG();
}

/* ---------- run ---------- */
globalThis.window = {};
eval(fs.readFileSync(DATA_PATH, 'utf8'));
const data = globalThis.window.PROMPTOPIA_DATA;
fs.mkdirSync(OUT_DIR, { recursive: true });

fs.writeFileSync(path.join(OUT_DIR, 'home.png'), homeCard());

let n = 0;
const t0 = Date.now();
for (const p of data.prompts) {
  fs.writeFileSync(path.join(OUT_DIR, `p-${p.id}.png`), cardFor(p));
  n++;
  if (n % 300 === 0) console.log('  ...', n);
}
console.log(`og images: ${n + 1} files in ${((Date.now() - t0) / 1000).toFixed(1)}s -> assets/og/`);
