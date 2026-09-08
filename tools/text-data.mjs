/* Shared loader + cover generator for hand-curated text prompts
   (tools/text-prompts.json). Used by build.mjs (full pipeline) and
   sync-text.mjs (live data patch). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEXT_PROMPTS_PATH = path.join(__dirname, 'text-prompts.json');
export const TEXT_PROMPTS_MORE_PATH = path.join(__dirname, 'text-prompts-more.json');

/* ids in this range are text prompts, not photo prompts */
export const TEXT_ID_MIN = 20000;

export function isTextId(id) {
  return Number(id) >= TEXT_ID_MIN;
}

/* Normalize raw entries into the same shape the app expects
   ({ id, t, cat, catFa, catEn, date, img, variants }). */
export function normalizeTextPrompt(p) {
  return {
    id: p.id,
    t: { fa: String(p.t.fa || '').trim(), en: String(p.t.en || '').trim() },
    cat: p.cat,
    catFa: p.catFa,
    catEn: p.catEn,
    date: p.date,
    img: `assets/img/t-${p.id}.svg`,
    variants: (p.variants || []).map((v) => ({
      l: { fa: (v.l && v.l.fa) || '', en: (v.l && v.l.en) || '' },
      text: String(v.text || '').trim(),
    })),
    text: true,
    ...(p.premium ? { premium: true } : {}),
  };
}

export function loadTextPrompts() {
  const files = [TEXT_PROMPTS_PATH, TEXT_PROMPTS_MORE_PATH];
  const out = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    const raw = JSON.parse(fs.readFileSync(f, 'utf8'));
    for (const p of raw.prompts || []) out.push(normalizeTextPrompt(p));
  }
  /* de-dupe by id, keep first */
  const seen = new Set();
  return out.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true)));
}

/* ------------------------------------------------------------------ */
/* deterministic per-prompt cover art (no photo needed)                */
/* ------------------------------------------------------------------ */
const CAT_STYLE = {
  writing:   { c1: '#8b5cf6', c2: '#d946ef', glow: '#a78bfa' },
  coding:    { c1: '#d946ef', c2: '#f472b6', glow: '#f472b6' },
  marketing: { c1: '#fb923c', c2: '#f59e0b', glow: '#fbbf24' },
  education: { c1: '#38bdf8', c2: '#22d3ee', glow: '#7dd3fc' },
  business:  { c1: '#34d399', c2: '#10b981', glow: '#6ee7b7' },
  career:    { c1: '#22d3ee', c2: '#06b6d4', glow: '#67e8f9' },
  seo:       { c1: '#818cf8', c2: '#6366f1', glow: '#a5b4fc' },
  video:     { c1: '#f43f5e', c2: '#ec4899', glow: '#fda4af' },
  ui:        { c1: '#2dd4bf', c2: '#0ea5e9', glow: '#5eead4' },
  'prompt-eng': { c1: '#c084fc', c2: '#8b5cf6', glow: '#e9d5ff' },
};
const FALLBACK_CAT = 'writing';

/* icon body (drawn in a 1024x1280 space, ~centered on y 640) */
const ICONS = {
  writing: /* text lines */ `
    <rect x="236" y="430" width="552" height="92" rx="46" fill="url(#acc)"/>
    <rect x="236" y="572" width="552" height="92" rx="46" fill="#ffffff" opacity=".6"/>
    <rect x="236" y="714" width="420" height="92" rx="46" fill="#ffffff" opacity=".45"/>
    <rect x="236" y="856" width="552" height="92" rx="46" fill="#ffffff" opacity=".3"/>`,
  coding: /* chevrons < > */ `
    <path d="M372 470 L196 640 L372 810" fill="none" stroke="url(#acc)" stroke-width="84" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>
    <path d="M652 470 L828 640 L652 810" fill="none" stroke="#ffffff" stroke-width="84" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
    <path d="M540 430 L600 850" fill="none" stroke="#ffffff" stroke-width="44" stroke-linecap="round" opacity=".28"/>`,
  marketing: /* megaphone */ `
    <path d="M300 560 L560 498 L560 782 L300 720 Z" fill="url(#acc)"/>
    <rect x="226" y="686" width="96" height="56" rx="28" fill="#ffffff" opacity=".35"/>
    <ellipse cx="604" cy="640" rx="44" ry="132" fill="none" stroke="#ffffff" stroke-width="26" opacity=".9"/>
    <path d="M690 540 Q800 640 690 740" fill="none" stroke="#ffffff" stroke-width="26" stroke-linecap="round" opacity=".5"/>
    <path d="M760 480 Q900 640 760 800" fill="none" stroke="#ffffff" stroke-width="24" stroke-linecap="round" opacity=".4"/>`,
  education: /* graduation cap */ `
    <path d="M512 478 L812 598 L512 718 L212 598 Z" fill="url(#acc)"/>
    <rect x="372" y="718" width="280" height="58" rx="29" fill="#ffffff" opacity=".8"/>
    <path d="M512 776 V 848" stroke="#ffffff" stroke-width="20" stroke-linecap="round" opacity=".7"/>
    <circle cx="512" cy="866" r="18" fill="#ffffff" opacity=".8"/>`,
  business: /* briefcase */ `
    <path d="M452 560 v-46 a60 60 0 0 1 120 0 v46" fill="none" stroke="#ffffff" stroke-width="34" stroke-linecap="round" opacity=".9"/>
    <rect x="312" y="560" width="400" height="252" rx="34" fill="url(#acc)"/>
    <rect x="472" y="642" width="80" height="78" rx="12" fill="#ffffff" opacity=".4"/>`,
  career: /* CV with person */ `
    <rect x="312" y="430" width="400" height="420" rx="34" fill="url(#acc)"/>
    <circle cx="512" cy="545" r="60" fill="#ffffff" opacity=".95"/>
    <path d="M412 700 a100 70 0 0 1 200 0 Z" fill="#ffffff" opacity=".95"/>
    <rect x="352" y="732" width="120" height="18" rx="9" fill="#ffffff" opacity=".4"/>
    <rect x="352" y="768" width="200" height="18" rx="9" fill="#ffffff" opacity=".3"/>
    <rect x="352" y="804" width="160" height="18" rx="9" fill="#ffffff" opacity=".2"/>`,
  seo: /* magnifier + bars */ `
    <circle cx="470" cy="590" r="130" fill="none" stroke="url(#acc)" stroke-width="52"/>
    <path d="M565 685 L660 780" stroke="url(#acc)" stroke-width="60" stroke-linecap="round"/>
    <rect x="426" y="520" width="40" height="140" rx="14" fill="#ffffff" opacity=".5"/>
    <rect x="486" y="560" width="40" height="100" rx="14" fill="#ffffff" opacity=".65"/>
    <rect x="546" y="600" width="40" height="60" rx="14" fill="#ffffff" opacity=".8"/>`,
  video: /* play button in rounded frame */ `
    <rect x="292" y="468" width="440" height="344" rx="48" fill="none" stroke="url(#acc)" stroke-width="44"/>
    <path d="M462 552 L622 640 L462 728 Z" fill="url(#acc)"/>
    <rect x="352" y="780" width="120" height="22" rx="11" fill="#ffffff" opacity=".4"/>
    <rect x="492" y="780" width="200" height="22" rx="11" fill="#ffffff" opacity=".25"/>`,
  ui: /* browser window + cursor */ `
    <rect x="272" y="452" width="480" height="340" rx="34" fill="none" stroke="url(#acc)" stroke-width="40"/>
    <line x1="272" y1="540" x2="752" y2="540" stroke="url(#acc)" stroke-width="30"/>
    <circle cx="322" cy="497" r="18" fill="#ffffff" opacity=".6"/>
    <circle cx="374" cy="497" r="18" fill="#ffffff" opacity=".4"/>
    <rect x="322" y="592" width="200" height="30" rx="15" fill="#ffffff" opacity=".45"/>
    <rect x="322" y="648" width="380" height="26" rx="13" fill="#ffffff" opacity=".3"/>
    <path d="M620 660 L740 780 L688 786 L716 848 L680 862 L654 800 L620 728 Z" fill="#ffffff" opacity=".85"/>`,
  'prompt-eng': /* spark/wand + brackets */ `
    <path d="M300 480 L340 480 M320 460 L320 500" stroke="url(#acc)" stroke-width="36" stroke-linecap="round"/>
    <path d="M684 780 L724 780 M704 760 L704 800" stroke="#ffffff" stroke-width="36" stroke-linecap="round" opacity=".6"/>
    <path d="M400 470 L330 640 L400 810" fill="none" stroke="url(#acc)" stroke-width="64" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M624 470 L694 640 L624 810" fill="none" stroke="#ffffff" stroke-width="64" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>
    <path d="M470 430 L560 850" stroke="#ffffff" stroke-width="34" stroke-linecap="round" opacity=".35"/>`,
};

/* Deterministic SVG cover for a text prompt: category palette + icon,
   shifted slightly by the prompt id so no two cards look identical. */
export function coverSVG(id, cat) {
  const s = CAT_STYLE[cat] || CAT_STYLE[FALLBACK_CAT];
  const icon = ICONS[cat] || ICONS[FALLBACK_CAT];
  const rot = ((id % 7) - 3);                       // -3..3 degrees
  const gx = 0.40 + ((id % 5) * 0.05);              // glow x offset
  const gy = 0.36 + ((id % 4) * 0.06);              // glow y offset
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1280" viewBox="0 0 1024 1280">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#171021"/>
      <stop offset="1" stop-color="#0a0713"/>
    </linearGradient>
    <linearGradient id="acc" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${s.c1}"/>
      <stop offset="1" stop-color="${s.c2}"/>
    </linearGradient>
    <radialGradient id="glow" cx="${gx}" cy="${gy}" r="0.62">
      <stop offset="0" stop-color="${s.glow}" stop-opacity="0.38"/>
      <stop offset="1" stop-color="${s.glow}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1024" height="1280" fill="url(#bg)"/>
  <rect width="1024" height="1280" fill="url(#glow)"/>
  <g transform="rotate(${rot} 512 640)">${icon}
  </g>
</svg>
`;
}