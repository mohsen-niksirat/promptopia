/* Shared loader for hand-curated text prompts (tools/text-prompts.json).
   Used by build.mjs (full pipeline) and sync-text.mjs (live data patch). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const TEXT_PROMPTS_PATH = path.join(__dirname, 'text-prompts.json');

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
    img: `assets/img/cover-${p.cat}.svg`,
    variants: (p.variants || []).map((v) => ({
      l: { fa: (v.l && v.l.fa) || '', en: (v.l && v.l.en) || '' },
      text: String(v.text || '').trim(),
    })),
    text: true,
  };
}

export function loadTextPrompts() {
  if (!fs.existsSync(TEXT_PROMPTS_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(TEXT_PROMPTS_PATH, 'utf8'));
  return (raw.prompts || []).map(normalizeTextPrompt);
}