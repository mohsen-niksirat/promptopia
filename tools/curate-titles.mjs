#!/usr/bin/env node
/**
 * One-shot title curation helper.
 * Rewrites weak auto-derived FA/EN titles for photo prompts and merges the
 * results into tools/editorial.json (v0 = FA, v1 = EN, optional v2 = category).
 *
 *   node tools/curate-titles.mjs
 *
 * Rules (layered, best effort — spot-check output and override by hand in
 * editorial.json afterwards):
 *   1. EN: strip openers/instructions, map common Russian words -> English,
 *      cut at the first sentence.
 *   2. FA: strip casual channel-caption prefixes ("پرامپت", "با این پرامپت", ...),
 *      then derive from English keywords via a small dictionary; fall back to a
 *      generic but human title instead of a bare category name.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ED_PATH = path.join(ROOT, 'tools', 'editorial.json');
const DATA_PATH = path.join(ROOT, 'data', 'prompts.js');

globalThis.window = {};
eval(fs.readFileSync(DATA_PATH, 'utf8'));
const DATA = globalThis.window.PROMPTOPIA_DATA.prompts;

const editorial = JSON.parse(fs.readFileSync(ED_PATH, 'utf8'));

/* ------------------------------------------------------------------ */
const stripEmojis = (s) => (s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();

/* English title from the prompt body */
const OPENER_RES = [
  /^\s*(vertical|horizontal)?\s*\d{1,2}\s*[:\-–]\s*\d{1,2}\s*,?\s*/i,
  /^\s*aspect ratio\s*\d{1,2}\s*[:\-–]\s*\d{1,2}\s*,?\s*/i,
];
const OPENER_TAIL = /^(a|an)?\s*(single[-\s]subject\s+)?(hyper[-\s]realistic\s+|ultra[-\s]realistic\s+|ultra\s+realistic\s+|realistic\s+|photorealistic\s+)?(cinematic\s+)?(top[-\s]down\s+)?(close[-\s]up\s+)?(full[-\s]body\s+)?(artistic\s+)?(premium\s+)?(high[-\s]end\s+)?(portrait|photograph|photo|scene|image|shot|edit|photography|collage|poster|selfie|illustration|artwork|frame|picture)\s+(of|with|showing|featuring|using|from)?\s*/i;
const LEAD_INSTR = /^(use|create|convert|transform|analyze|please|keep|preserve|remove|replace|generate|design|apply|maintain|do not|don't|using|based on|take|make|restore|erase|enhance|always|completely|100%|создай|сохранить|использовать|не менять|не изменять|чтобы|строго|strict(ly)?|identity|presentation|wardrobe|output|result|goal|task|note|rules?)\b[^\n.!?]{0,120}[.!?]\s*/i;
const SHOUT_INSTR = /^[A-ZА-ЯЁ\s\d'\"-]{18,}[.!?]?\s+/;
const DANGLE_TAIL = /\s+(of a|of an|of the same|of the|of|in|with|and|at|from|on|for|a|an|the|as|by|to|,|;|:)$/i;

const AD_RES = [
  /^(все\s+промпты\s+есть\s+в\s+постах|ещё\s+больше\s+промтов|чтобы\s+получить\s+такой\s+же\s+результат|перейди\s+в\s+чат|подпишись|присоединяйся|ссылка\s+в\s+шапке|1[.)]\s*перейди)[^\n.!?]{0,120}[.!?]?\s*/i,
  /^[\u{1F000}-\u{1FFFF}]{1,3}\s*(prompt|промт)\s*[:—-]?\s*/iu,
  /^\s*(prompt|промт)\s*[:—-]?\s*/iu,
];

function extractEnTitle(text) {
  let b = String(text).replace(/\s+/g, ' ').replace(/^["'\u201C\u201D]+|["'\u201C\u201D]+$/g, '');
  for (const re of AD_RES) b = b.replace(re, '');
  for (const re of OPENER_RES) b = b.replace(re, '');
  for (let i = 0; i < 3; i++) b = b.replace(LEAD_INSTR, '');
  b = b.replace(SHOUT_INSTR, '');
  b = b.replace(OPENER_TAIL, '');
  const m = /[.;!?]/.exec(b.slice(12));
  if (m) b = b.slice(0, 12 + m.index);
  b = b.trim().replace(/[\s,;:–—-]+$/, '');
  for (let i = 0; i < 4 && DANGLE_TAIL.test(b); i++) b = b.replace(DANGLE_TAIL, '');
  if (b.length > 60) {
    b = b.slice(0, 60);
    const sp = b.lastIndexOf(' ');
    if (sp > 30) b = b.slice(0, sp);
  }
  b = b.trim();
  if (b.length < 4) return '';
  return b.charAt(0).toUpperCase() + b.slice(1);
}

/* Russian -> English keyword map (photography prompts) */
const RU_EN = [
  /* mixed Cyrillic-Latin mashups seen in real exports (order matters) */
  [/Faceь|Faceи|Faceы|Faceу|Faceo|лиц[оаеу]|черты\s+лица/gi, 'face'],
  [/Girlы|Girlа|Girlу|Girlи|девушк|женщин/gi, 'girl'],
  [/Manы|Manа|Manу|парень|мужчин|юнош/gi, 'man'],
  [/Photoреалистичн\w+|фотореалистичн\w+/gi, 'photorealistic'],
  [/Photoграфии|Photoграфия|фотографи[ия]/gi, 'photo'],
  [/Photo|фото/gi, 'photo'],
  [/Portrait|портрет/gi, 'portrait'],
  [/Selfie|селфи|себя/gi, 'selfie'],
  [/Строго|строго|Сохрани|сохранить|сохран/gi, 'strictly preserve'],
  [/Не\s+меняй|Не\s+меняя|не\s+менять|не\s+изменять/gi, "don't change"],
  [/чёрно-бел\w+|черно-бел\w+|чернобел/gi, 'black and white'],
  [/крупным\s+планом/gi, 'close-up'],
  [/студийн\w+/gi, 'studio'],
  [/ребенок|ребёнок|детей|маленьк/gi, 'kids'],
  [/семь/gi, 'family'],
  [/собак/gi, 'dog'],
  [/кот|кошк/gi, 'cat'],
  [/кон[еь]/gi, 'horse'],
  [/машин/gi, 'car'],
  [/мотоцикл/gi, 'motorcycle'],
  [/свадьб|невест/gi, 'wedding'],
  [/неон/gi, 'neon'],
  [/ночн|ночь/gi, 'night'],
  [/ретро|винтаж/gi, 'vintage'],
  [/кинематограф/gi, 'cinematic'],
  [/улиц|городск/gi, 'street'],
  [/природ|пейзаж/gi, 'nature'],
  [/море|пляж|океан/gi, 'beach'],
  [/горы/gi, 'mountain'],
  [/еда|кухн/gi, 'food'],
  [/коллаж/gi, 'collage'],
  [/аниме/gi, 'anime'],
  [/золотой час|закат/gi, 'golden hour'],
  [/волосы|прическ|причёск/gi, 'hairstyle'],
  [/зеркало/gi, 'mirror'],
  [/стиль/gi, 'style'],
  [/картинк|рисун/gi, 'artwork'],
];

function ruToEn(text) {
  let b = text;
  for (const [re, en] of RU_EN) b = b.replace(re, en);
  return b;
}

/* FA title from an English keyword set */
const EN_FA = [
  [/\bselfie\b/i, 'سلفی'],
  [/\bportrait\b|\bheadshot\b/i, 'پرتره'],
  [/\bwedding\b|\bbride\b/i, 'عروسی'],
  [/\bfamily\b/i, 'خانواده'],
  [/\bcouple\b/i, 'کاپل'],
  [/\bdog\b|\bpuppy\b/i, 'سگ'],
  [/\bcat\b|\bkitten\b/i, 'گربه'],
  [/\bhorse\b/i, 'اسب'],
  [/\bcar\b/i, 'ماشین'],
  [/\bmotorcycle\b/i, 'موتور'],
  [/\banime\b/i, 'انیمه'],
  [/\bneon\b/i, 'نئون'],
  [/\bnight\b/i, 'شبانه'],
  [/\bvintage\b|\bretro\b/i, 'وینتیج'],
  [/\bcinematic\b/i, 'سینمایی'],
  [/\bstreet\b/i, 'خیابانی'],
  [/\bnature\b|\blandscape\b/i, 'طبیعت'],
  [/\bbeach\b|\bocean\b|\bsea\b/i, 'ساحلی'],
  [/\bmountain\b/i, 'کوهستان'],
  [/\bfood\b|\bmeal\b/i, 'غذا'],
  [/\bstudio\b/i, 'استودیویی'],
  [/\bhairstyle\b|\bhair\b/i, 'مدل مو'],
  [/\bmirror\b/i, 'آینه‌ای'],
  [/\bfashion\b|\bstyle\b|\boutfit\b/i, 'استایل'],
  [/\bwinter\b|\bsnow\b/i, 'برفی'],
  [/\bsunset\b|\bgolden hour\b/i, 'نور طلایی'],
  [/\bcyberpunk\b/i, 'سایبرپانک'],
  [/\bfantasy\b|\bmagic\b/i, 'فانتزی'],
  [/\bposter\b/i, 'پوستر'],
  [/\bproduct\b/i, 'محصول'],
  [/\bcollage\b/i, 'کلاژ'],
  [/\bphoto\b/i, 'عکس'],
  [/\bgirl\b|\bwoman\b/i, 'دختر'],
  [/\bman\b|\bguy\b/i, 'پسر'],
  [/\bkids\b|\bchild\b/i, 'کودک'],
  [/\bcaricature\b/i, 'کاریکاتور'],
];

function faFromEn(en) {
  const hits = [];
  for (const [re, fa] of EN_FA) if (re.test(en)) hits.push(fa);
  // keep at most 2 style words + 1 subject word
  const styles = hits.filter((h) => ['سینمایی', 'نئون', 'شبانه', 'وینتیج', 'خیابانی', 'ساحلی', 'برفی', 'نور طلایی', 'سایبرپانک', 'فانتزی', 'استودیویی', 'آینه‌ای', 'کلاژ'].includes(h));
  const subjects = hits.filter((h) => !styles.includes(h));
  const parts = [...new Set([...subjects.slice(0, 1), ...styles.slice(0, 2)])];
  return parts.join(' ');
}

/* clean casual Persian channel-caption prefixes */
function cleanFaTitle(fa) {
  let s = stripEmojis(fa || '')
    .replace(/^(پرامپت|این پرامپت|با این پرامپت|یه پرامپت|یدونه پرامپت|پرامپتی که|پرامپت مخصوص|پرامپت جدید)\s*/i, '')
    .replace(/[.!؟?\s]+$/, '')
    .trim();
  s = s.charAt(0).toUpperCase() + s.slice(1);
  return s;
}

/* Keyword-style EN title for Russian prompts: translate tokens, drop leftover
   Cyrillic, keep 2-4 known English keywords -> readable short title. */
const RU_KEYWORDS = [
  [/\bselfie\b|селфи/gi, 'Selfie'],
  [/\bportrait\b|портрет/gi, 'Portrait'],
  [/\bphoto\b|фото|фотограф/gi, 'Photo'],
  [/\bcollage\b|коллаж/gi, 'Collage'],
  [/\banime\b|аниме/gi, 'Anime'],
  [/\bcaricature\b|карикатур/gi, 'Caricature'],
  [/\bwedding\b|свадьб|невест/gi, 'Wedding'],
  [/\bcouple\b|пара|пары/gi, 'Couple'],
  [/\bfamily\b|семь/gi, 'Family'],
  [/\bmother\b|мать|мамой/gi, 'Mother'],
  [/\bchild\b|ребен|ребён|детей|маленьк/gi, 'Child'],
  [/\bgirl\b|девушк|женщин/gi, 'Girl'],
  [/\bwoman\b/gi, 'Woman'],
  [/\bman\b|парень|мужчин|юнош/gi, 'Man'],
  [/\bdog\b|собак/gi, 'Dog'],
  [/\bcat\b|кот|кошк/gi, 'Cat'],
  [/\bhorse\b|кон[еь]/gi, 'Horse'],
  [/\bcar\b|машин/gi, 'Car'],
  [/\bmotorcycle\b|мотоцикл/gi, 'Motorcycle'],
  [/\bhand\b|ладон/gi, 'Palm'],
  [/\beye\b|глаз/gi, 'Eyes'],
  [/\bhairstyle\b|волосы|прическ|причёск|пучк/gi, 'Hairstyle'],
  [/\bbarb\b|бород/gi, 'Beard'],
  [/\bface\b|лицо/gi, 'Face'],
  [/\bmirror\b|зеркал/gi, 'Mirror'],
  [/\bstudio\b|студийн/gi, 'Studio'],
  [/\bstreet\b|улиц|городск/gi, 'Street'],
  [/\bnature\b|природ|пейзаж/gi, 'Nature'],
  [/\bbeach\b|море|пляж|океан/gi, 'Beach'],
  [/\bmountain\b|горы/gi, 'Mountain'],
  [/\bnight\b|ночн|ночь/gi, 'Night'],
  [/\bevening\b|вечерн/gi, 'Evening'],
  [/\bwinter\b|зимн/gi, 'Winter'],
  [/\bsummer\b|летн/gi, 'Summer'],
  [/\bfall\b|осенн/gi, 'Fall'],
  [/\brain\b|дожд/gi, 'Rain'],
  [/\bsnow\b|снег/gi, 'Snow'],
  [/\bsunset\b|закат/gi, 'Sunset'],
  [/\bgolden\s*hour|золотой\s*час/gi, 'Golden Hour'],
  [/\bneon\b|неон/gi, 'Neon'],
  [/\bvintage\b|ретро|винтаж/gi, 'Vintage'],
  [/\bcinematic\b|кинематограф/gi, 'Cinematic'],
  [/\bfashion\b|модн|фэшн/gi, 'Fashion'],
  [/\bluxury\b|люкс|роскошн/gi, 'Luxury'],
  [/\bb&w\b|черно-бел|чёрно-бел|чернобел/gi, 'Black & White'],
  [/\bcolor\b|цветн/gi, 'Color'],
  [/\brealistic\b|реалистичн/gi, 'Realistic'],
  [/\bclose[- ]?up\b|крупн\s*план/gi, 'Close-Up'],
  [/\bportrait\s+of|портрет/gi, 'Portrait'],
  [/\bmakeup\b|макияж/gi, 'Makeup'],
  [/\bfood\b|еда|кухн/gi, 'Food'],
  [/\bcoffee\b|кафе/gi, 'Cafe'],
  [/\bcake\b|торт/gi, 'Cake'],
  [/\bflower\b|цветы|цветов/gi, 'Flowers'],
  [/\bcaricature\b|карикатур/gi, 'Caricature'],
  [/\bpregnant\b|беременн/gi, 'Pregnant'],
  [/\bgraduation\b|выпускн/gi, 'Graduation'],
  [/\bselfie\b/gi, 'Selfie'],
];
const RU_TITLE_STOP = /\b(photo|portrait|selfie|collage|anime|wedding|couple|family|mother|child|girl|woman|man|dog|cat|horse|car|motorcycle|palm|eyes|hairstyle|beard|face|mirror|studio|street|nature|beach|mountain|night|evening|winter|summer|fall|rain|snow|sunset|neon|vintage|cinematic|fashion|luxury|realistic|close-up|makeup|food|cafe|cake|flowers|pregnant|graduation|golden hour|black & white|color)\b/gi;

function ruKeywordTitle(text) {
  /* split English words glued to Cyrillic suffixes ("photoреалистичное" -> "photo реалистичное") */
  let b = String(text).replace(/\s+/g, ' ').toLowerCase().replace(/([a-z]+)(?=[а-яё])/gi, '$1 ');
  const found = [];
  for (const [re, kw] of RU_KEYWORDS) {
    if (re.test(b) && !found.includes(kw)) found.push(kw);
  }
  /* drop generic fillers if a real subject keyword exists */
  const subject = found.filter((k) => ['Girl', 'Man', 'Couple', 'Family', 'Woman', 'Child', 'Mother', 'Dog', 'Cat', 'Horse', 'Car', 'Motorcycle', 'Palm', 'Eyes', 'Face', 'Beard', 'Hairstyle', 'Flowers', 'Food', 'Cake', 'Coffee', 'Caricature', 'Wedding', 'Graduation'].includes(k));
  const style = found.filter((k) => !subject.includes(k));
  const picks = subject.slice(0, 1).concat(style.slice(0, 2));
  if (!picks.length) return '';
  return picks.join(' ');
}

/* ------------------------------------------------------------------ */
const photoIds = new Set(DATA.filter((p) => !p.text).map((p) => p.id));
const done = new Set(Object.keys(editorial).filter((k) => !k.startsWith('_')));

let added = 0;
for (const p of DATA) {
  if (!photoIds.has(p.id) || done.has(String(p.id))) continue;
  const body = p.variants[0].text;
  const isRu = /[\u0400-\u04FF]/.test(body);

  /* EN title */
  const INSTR = /^(use|using|create|convert|transform|turn|remove|restore|add|keep|preserve|make|edit|apply|find|analyze|show|present|maintain|design|generate|replace|don't|do not|this|the|you|if|for|to|in|on|with)\b/i;
  let en = '';
  if (isRu) {
    en = ruKeywordTitle(body);
    if (!en) en = extractEnTitle(ruToEn(body));
  } else {
    en = extractEnTitle(body);
  }
  if (!en || en.length < 8 || INSTR.test(en) || /^[a-z\"'\u201C\u201D]/.test(en) || /[\u0400-\u04FF]/.test(en)) {
    en = ruKeywordTitle(body) || en;
  }

  /* FA title */
  let fa = cleanFaTitle(p.t.fa);
  const faFallbacks = /^(پرتره و ژست|طبیعت و سفر|ماشین و موتور|غذا و کافه|حیوانات|فانتزی و هنر|خانواده و عروسی|لاکچری و ادیتوریال|فشن و استایل|کاربردی و ابزار|محصول و تبلیغات)$/.test(fa);
  if (!fa || fa.length < 5 || faFallbacks) {
    fa = faFromEn(en) || (isRu ? 'عکس' : 'عکس');
  }
  if (!en || en.length < 8) en = p.catEn || 'Photo prompt';

  if (fa !== p.t.fa || en !== p.t.en) {
    editorial[String(p.id)] = [fa, en];
    added++;
  }
}

/* sort keys: numeric ids first (stable), then keep insertion order */
const numeric = Object.keys(editorial).filter((k) => !k.startsWith('_') && /^\d+$/.test(k)).sort((a, b) => Number(a) - Number(b));
const rest = Object.keys(editorial).filter((k) => !k.startsWith('_') && !/^\d+$/.test(k));
const meta = Object.keys(editorial).filter((k) => k.startsWith('_'));
const out = {};
for (const k of meta) out[k] = editorial[k];
for (const k of numeric.concat(rest)) out[k] = editorial[k];

fs.writeFileSync(ED_PATH, JSON.stringify(out, null, 2) + '\n');
console.log(`wrote ${added} new editorial entries (${Object.keys(out).filter((k) => !k.startsWith('_')).length} total)`);