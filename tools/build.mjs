#!/usr/bin/env node
/**
 * Promptopia build pipeline
 *   node build.mjs parse   -> parse work/messages.html into work/full-prompts.json + stats
 *   node build.mjs select  -> auto-curate balanced subset -> tools/curation.json + work/candidates.tsv
 *   node build.mjs build   -> optimize images + emit ../data/prompts.js (uses curation.json + title-en.json)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const WORK = path.join(ROOT, 'work');
const DATA = path.join(ROOT, 'data');
const IMG = path.join(ROOT, 'assets', 'img');

/* ------------------------------------------------------------------ */
/* auto-titles for prompts without an editorial entry                  */
/* ------------------------------------------------------------------ */
const stripEmojis = (s) => (s || '').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();

const OPENER_RES = [
  /^\s*(vertical|horizontal)?\s*\d{1,2}\s*[:\-–]\s*\d{1,2}\s*,?\s*/i,
  /^\s*aspect ratio\s*\d{1,2}\s*[:\-–]\s*\d{1,2}\s*,?\s*/i,
];
const OPENER_TAIL = /^(a|an)?\s*(single[-\s]subject\s+)?(hyper[-\s]realistic\s+|ultra[-\s]realistic\s+|ultra\s+realistic\s+|realistic\s+|photorealistic\s+)?(cinematic\s+)?(top[-\s]down\s+)?(close[-\s]up\s+)?(full[-\s]body\s+)?(artistic\s+)?(premium\s+)?(high[-\s]end\s+)?(portrait|photograph|photo|scene|image|shot|edit|photography|collage|poster|selfie|illustration|artwork|frame|picture)\s+(of|with|showing|featuring|using|from)?\s*/i;
const LEAD_INSTR = /^(use|create|convert|transform|analyze|please|keep|preserve|remove|replace|generate|design|apply|maintain|do not|don't|using|based on|take|make|restore|erase|enhance|always|completely|100%)\b[^\n.!?]{0,120}[.!?]\s*/i;

function extractEnTitle(text) {
  let b = String(text).replace(/\s+/g, ' ');
  for (const re of OPENER_RES) b = b.replace(re, '');
  for (let i = 0; i < 2; i++) b = b.replace(LEAD_INSTR, '');
  b = b.replace(OPENER_TAIL, '');
  /* JSON-style prompts: pull the scene/description value if present */
  if (/^[{"[]/.test(b)) {
    const j = /"(?:scene|prompt|description|title|task)"\s*:\s*"([^"]{12,60})/i.exec(String(text));
    b = j ? j[1] : '';
  }
  const m = /[.;!?]/.exec(b.slice(12));
  if (m) b = b.slice(0, 12 + m.index);
  b = b.trim().replace(/[\s,;:–—-]+$/, '');
  if (b.length > 60) {
    b = b.slice(0, 60);
    const sp = b.lastIndexOf(' ');
    if (sp > 30) b = b.slice(0, sp);
  }
  if (b.length < 4) return '';
  return b.charAt(0).toUpperCase() + b.slice(1);
}

const FA_MODS = [
  [/black[-\s]and[-\s]white|\bb&w\b|monochrome/i, 'سیاه‌وسفید'],
  [/\bsepia\b/i, 'سپیا'],
  [/\bvintage\b|\bretro\b|\b90s\b|\b2000s\b|\by2k\b/i, 'وینتیج'],
  [/\bneon\b/i, 'نئون'],
  [/golden[-\s]hour|\bsunset\b|\bsunlit\b/i, 'نور طلایی'],
  [/\bnight\b|\bmidnight\b/i, 'شبانه'],
  [/\bwinter\b|\bsnow\b/i, 'برفی'],
  [/\brain\b/i, 'بارانی'],
  [/\bautumn\b/i, 'پاییزی'],
  [/\bstudio\b/i, 'استودیویی'],
  [/\bstreet\b/i, 'خیابانی'],
  [/\bbeach\b|\bocean\b|\bsea\b/i, 'ساحلی'],
  [/\bmountain/i, 'کوهستانی'],
  [/\bforest\b/i, 'جنگلی'],
  [/\bdesert\b/i, 'کویری'],
  [/\bcyberpunk\b/i, 'سایبرپانک'],
  [/\banime\b/i, 'انیمه‌ای'],
  [/\bfantasy\b|hogwarts|\bwizard\b|\bmagic\b/i, 'فانتزی'],
  [/\bluxury\b/i, 'لاکچری'],
  [/\bcinematic\b/i, 'سینمایی'],
  [/low[-\s]angle/i, 'زاویه‌پایین'],
  [/top[-\s]down/i, 'از بالا'],
  [/\bunderwater\b/i, 'زیرآب'],
  [/\burban\b|\bcity\b/i, 'شهری'],
  [/\bindoor\b|\bbedroom\b/i, 'داخل‌خانه'],
  [/\bmirror\b/i, 'آینه‌ای'],
];
const FA_HEADS = [
  [/mirror[-\s]selfie/i, 'سلفی آینه‌ای'],
  [/selfie/i, 'سلفی'],
  [/couple/i, 'کاپل'],
  [/wedding|bride|groom/i, 'عروسی'],
  [/family/i, 'خانواده'],
  [/collage/i, 'کلاژ'],
  [/photobooth/i, 'فتوبوث'],
  [/poster/i, 'پوستر'],
  [/timeline/i, 'تایم‌لاین'],
  [/\bgrid\b/i, 'گرید'],
  [/keychain/i, 'کلیدآویز'],
  [/puppet|doll|plush/i, 'عروسک'],
  [/statue|sculpture/i, 'مجسمه'],
  [/wizard/i, 'جادوگر'],
  [/analysis|infographic/i, 'تحلیل'],
  [/hairstyle|hair[-\s]?colou?r|haircut|\bhair\s+(?:styles?|types?)/i, 'مدل مو'],
  [/headshot/i, 'هدشات'],
  [/\bcat\b|kitten|kitty|feline/i, 'گربه'],
  [/\bdog\b|puppy/i, 'سگ'],
  [/horse|pony/i, 'اسب'],
  [/\bcar\b|convertible/i, 'ماشین'],
  [/motorcycle|\bbike\b|biker/i, 'موتور'],
  [/flower|bouquet|rose/i, 'گل'],
  [/cake|birthday/i, 'تولد'],
  [/coffee|cafe/i, 'کافه'],
  [/watermark/i, 'واترمارک'],
  [/portrait/i, 'پرتره'],
  [/woman|girl|female/i, 'دختر'],
  [/\bman\b|\bmale\b/i, 'مرد'],
  [/photo|image|picture|scene|shot/i, 'عکس'],
];

function deriveFaTitle(text, catFa) {
  const b = text.toLowerCase();
  let head = null;
  for (const [re, fa] of FA_HEADS) if (re.test(b)) { head = fa; break; }
  let mod = null;
  for (const [re, fa] of FA_MODS) if (re.test(b)) { mod = fa; break; }
  if (head === mod) mod = null;
  const parts = [head, mod].filter(Boolean);
  return parts.length ? parts.join(' ') : catFa;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const ZWNJ = /\u200c/g;
const cleanText = (s) =>
  (s || '')
    .replace(ZWNJ, ' ')            // keep words separated, drop invisible char
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const faNum = (s) => s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));

function parseDate(raw) {
  const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(raw || '');
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/* ------------------------------------------------------------------ */
/* categories (checked in order, first hit wins)                       */
/* ------------------------------------------------------------------ */
const CATEGORIES = [
  { key: 'animals',  fa: 'حیوانات',             en: 'Animals',            kw: ['حیوان','گربه','سگ','اسب','شیر','پرنده','طوطی','قناری','گرگ','ببر','آهو','گوزن','خرگوش','جغد','animal','cat','dog','horse','lion','bird','wolf','tiger','falcon','eagle','parrot','rabbit','deer','owl','puppy','kitten','pony','camel'] },
  { key: 'vehicles', fa: 'ماشین و موتور',        en: 'Cars & Bikes',       kw: ['ماشین','موتور','خودرو','رانندگی','سوپرکار','موتورسیکلت','کامیون','قطار','هواپیما','قایق','car','motorcycle','vehicle','supercar','bike','train','plane','aircraft','boat','yacht','truck'] },
  { key: 'food',     fa: 'غذا و کافه',           en: 'Food & Cafe',        kw: ['غذا','کافه','رستوران','قهوه','آشپز','دسر','کیک','food','coffee','cafe','restaurant','menu','chef','dessert','cake','bakery'] },
  { key: 'product',  fa: 'محصول و تبلیغات',      en: 'Product & Ads',      kw: ['محصول','تبلیغ','برند','ویترین','پوستر','بنر','product','commercial','brand','billboard','mockup','packaging'] },
  { key: 'family',   fa: 'خانواده و عروسی',      en: 'Family & Wedding',   kw: ['خانواده','کودک','نوزاد','بچه','عروس','داماد','عروسی','کاپل','کاپلی','زوج','پدربزرگ','مادربزرگ','عروسک','family','baby','kid','child','wedding','bride','groom','couple','grandpa','grandma'] },
  { key: 'travel',   fa: 'طبیعت و سفر',          en: 'Nature & Travel',    kw: ['طبیعت','سفر','جنگل','کوه','ساحل','دریا','صحرا','غروب','آسمان','برف','باران','آتشفشان','آبشار','کویر','شهر','خیابان','جاده','nature','travel','beach','mountain','forest','sunset','desert','sky','snow','rain','island','waterfall','volcano','city','street','valley','lake','river'] },
  { key: 'fantasy',  fa: 'فانتزی و هنر',         en: 'Fantasy & Art',      kw: ['فانتزی','هنری','نقاشی','انیمه','تخیلی','افسانه','ابرقهرمان','مجسمه','مجمسه','فضانورد','ربات','اژدها','fantasy','anime','painting','surreal','myth','hero','statue','sculpture','cyberpunk','astronaut','robot','dragon'] },
  { key: 'luxury',   fa: 'لاکچری و ادیتوریال',    en: 'Luxury & Editorial', kw: ['لاکچری','لوکس','مجلل','ثروتمند','luxury','premium','rich ','vogue','editorial','gold'] },
  { key: 'fashion',  fa: 'فشن و استایل',         en: 'Fashion & Style',    kw: ['فشن','استایل','مدلينگ','مدلینگ','لباس','پوشاک','ژست','گلدوزی','fashion','streetwear','outfit','model','stylish','style'] },
  { key: 'utility',  fa: 'کاربردی و ابزار',       en: 'Utility & Tools',    kw: ['بازسازی','تبدیل','پرسنلی','رنگی','ترمیم','کیفیت','ویرایش','حذف','restore','colorize','upscal'] },
];
/* this channel is people-photography at heart -> portrait is the default bucket, not a keyword one */
const DEFAULT_CAT = { key: 'portrait', fa: 'پرتره و ژست', en: 'Portrait & Poses' };

/* categories whose keywords are safe to match inside prompt bodies
   (style cats like fashion/luxury/portrait share boilerplate wording -> title only) */
const SCENE_CATS = CATEGORIES.filter((c) => ['animals','vehicles','food','product','family','travel','fantasy'].includes(c.key));

function classifyText(text, cats = CATEGORIES) {
  const t = ' ' +
    text.toLowerCase()
      .replace(/[\u200c]/g, ' ')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ') + ' ';
  for (const c of cats) {
    for (const k of c.kw) {
      if (t.includes(' ' + k.toLowerCase() + ' ')) return c.key;
    }
  }
  return null;
}
/* phrases that appear in almost every prompt and poison text matching */
const BOILER = [/luxury warm palette/gi, /premium color grading/gi, /professional commercial photography/gi, /editorial/gi, /cinematic/gi, /viral/gi, /\b8k\b/gi, /photorealistic/gi, /ultra-detailed/gi, /golden-hour/gi, /golden hour/gi];
const stripBoiler = (s) => BOILER.reduce((acc, r) => acc.replace(r, ' '), s);

function classify(title, prompt) {
  /* titles are the author's scene description; prompt bodies share boilerplate
     (streetwear/outfit/wardrobe...) so only scene categories match there */
  return classifyText(title || '') || classifyText(stripBoiler(prompt || ''), SCENE_CATS) || DEFAULT_CAT.key;
}

const catMeta = (key) =>
  CATEGORIES.find((c) => c.key === key) || DEFAULT_CAT;

/* ------------------------------------------------------------------ */
/* parse                                                               */
/* ------------------------------------------------------------------ */
function isVariantMarker(label) {
  return /نسخه|زنانه|مردانه|female|male/i.test(label);
}

function parseMessage(msg, idx) {
  const idAttr = msg.getAttribute('id') || '';
  const msgId = parseInt(idAttr.replace('message', ''), 10);
  if (!Number.isFinite(msgId)) return null;

  const dateEl = msg.querySelector('.date.details');
  const date = parseDate(dateEl?.getAttribute('title'));

  const photoWrap = msg.querySelector('.photo_wrap');
  const photoFull = photoWrap?.getAttribute('href') || null;

  const textEl = msg.querySelector('.text');
  if (!textEl) return null;

  // walk child nodes, split into segments at blockquote/pre boundaries
  const variants = [];
  let labelParts = [];
  let current = null; // { text, botUrl }

  const pushVariant = () => {
    if (current && cleanText(current.text).length >= 80) {
      variants.push({
        labelFa: cleanText(labelParts.join(' ')).replace(/[:：]\s*$/, ''),
        text: cleanText(current.text),
        botUrl: current.botUrl || null,
      });
    }
    current = null;
    labelParts = [];
  };

  const walk = (nodes) => {
    for (const node of nodes) {
      if (node.nodeType === 3) { // text
        const t = node.rawText || node.text || '';
        if (current) continue; // text after prompt is boilerplate
        labelParts.push(t);
        continue;
      }
      const tag = (node.rawTagName || '').toLowerCase();
      if (tag === 'br') continue;
      if (tag === 'blockquote' || tag === 'pre') {
        if (current) pushVariant();
        current = { text: node.text, botUrl: null };
        continue;
      }
      if (tag === 'a') {
        const href = node.getAttribute('href') || '';
        if (/start=prompt_/.test(href) && current) current.botUrl = href;
        continue;
      }
      if (node.childNodes?.length) walk(node.childNodes);
    }
  };
  walk(textEl.childNodes);
  pushVariant();

  if (!variants.length) return null;

  // title: label of first segment unless it looks like a variant marker
  let titleFa = '';
  if (variants.length === 1) titleFa = variants[0].labelFa;
  else if (variants[0].labelFa && !isVariantMarker(variants[0].labelFa)) titleFa = variants[0].labelFa;

  // variant labels for multi-variant messages
  const defaultLabels = variants.length > 1
    ? variants.map((_, i) => ({ fa: `نسخه ${i + 1}`, en: `Version ${i + 1}` }))
    : [];

  const fullText = variants.map((v) => v.text).join(' \n ');
  const hasDeep = variants.some((v) => v.botUrl && /start=prompt_/.test(v.botUrl));

  return {
    msgId,
    idx,
    date,
    photoFull,
    titleFa,
    variants,
    defaultLabels,
    hasDeep,
    category: classify(titleFa, fullText),
  };
}

function isRealTitle(t) {
  const s = (t || '').replace(/[\u200c]/g, ' ').trim();
  return s.length >= 5 && !/^(متن پرامپت|پرامپت|prompt)$/i.test(s);
}

function score(p, medianDate) {
  let s = 0;
  if (isRealTitle(p.titleFa)) s += 3;
  if (p.hasDeep) s += 2;
  const L = p.variants[0].text.length;
  if (L >= 300 && L <= 1600) s += 1.5;
  else if (L >= 160) s += 0.5;
  if (p.date && medianDate && p.date >= medianDate) s += 0.5;
  s += Math.min(p.variants.length, 2) * 0.25;
  return s;
}

async function cmdParse() {
  const html = fs.readFileSync(path.join(WORK, 'messages.html'), 'utf8');
  const root = parse(html);
  const msgs = root.querySelectorAll('.message.default');
  console.log(`messages in export: ${msgs.length}`);

  const items = [];
  const seen = new Set();
  for (const m of msgs) {
    const p = parseMessage(m, items.length);
    if (!p) continue;
    const dupKey = p.variants[0].text.slice(0, 120);
    if (seen.has(dupKey)) continue;
    seen.add(dupKey);
    items.push(p);
  }

  const withPhoto = items.filter((p) => p.photoFull);
  const dates = items.map((p) => p.date).filter(Boolean).sort();
  const medianDate = dates[Math.floor(dates.length / 2)];
  for (const p of items) p.score = score(p, medianDate);

  // stats
  const byCat = {};
  for (const p of items) byCat[p.category] = (byCat[p.category] || 0) + 1;
  const curatable = items.filter((p) => p.photoFull);

  fs.writeFileSync(path.join(WORK, 'full-prompts.json'), JSON.stringify(items, null, 1));

  console.log(`parsed prompts: ${items.length} (with photo: ${curatable.length}, deep-link: ${items.filter((p) => p.hasDeep).length}, real-title: ${items.filter((p) => isRealTitle(p.titleFa)).length})`);
  console.log('category distribution:');
  for (const [k, v] of Object.entries(byCat).sort((a, b) => b[1] - a[1]))
    console.log(`  ${k.padEnd(10)} ${v}`);
  console.log('\nsample titles:');
  for (const p of curatable.slice(0, 15)) console.log(`  #${p.msgId} [${p.category}] ${p.titleFa || '(no title)'}`);
}

/* ------------------------------------------------------------------ */
/* select (auto curation)                                              */
/* ------------------------------------------------------------------ */
async function cmdSelect() {
  const items = JSON.parse(fs.readFileSync(path.join(WORK, 'full-prompts.json'), 'utf8'));
  const pool = items.filter((p) => p.photoFull);
  const chosen = pool.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const curation = {
    note: 'IDs shipped in the live gallery. Add more msgIds (from work/full-prompts.json) and re-run `node build.mjs build`.',
    target: chosen.length,
    selected: chosen.map((p) => p.msgId),
  };
  fs.writeFileSync(path.join(__dirname, 'curation.json'), JSON.stringify(curation, null, 2));

  const dist = {};
  for (const p of chosen) dist[p.category] = (dist[p.category] || 0) + 1;
  console.log(`selected ${chosen.length} prompts`);
  console.log('curation distribution:', dist);
}

/* ------------------------------------------------------------------ */
/* build (images + data)                                               */
/* ------------------------------------------------------------------ */
async function cmdBuild({ force = false } = {}) {
  const sharp = (await import('sharp')).default;
  const items = JSON.parse(fs.readFileSync(path.join(WORK, 'full-prompts.json'), 'utf8'));
  const byId = new Map(items.map((p) => [p.msgId, p]));

  const curation = JSON.parse(fs.readFileSync(path.join(__dirname, 'curation.json'), 'utf8'));
  const edPath = path.join(__dirname, 'editorial.json');
  const editorial = fs.existsSync(edPath) ? JSON.parse(fs.readFileSync(edPath, 'utf8')) : {};
  const overrides = {};
  for (const [k, v] of Object.entries(editorial)) {
    if (k.startsWith('_') || !Array.isArray(v)) continue;
    if (v[2]) overrides[k] = v[2];
  }

  const out = [];
  let missingEd = 0;
  for (const id of curation.selected) {
    const p = byId.get(id);
    if (!p) { console.warn(`!! msgId ${id} not found`); continue; }
    if (!p.photoFull) { console.warn(`!! msgId ${id} has no photo`); continue; }
    const ed = editorial[String(id)];
    if (!ed) missingEd++;

    const imgName = `p${p.msgId}.webp`;
    const imgPath = path.join(IMG, imgName);
    if (force || !fs.existsSync(imgPath)) {
      const src = path.join(WORK, p.photoFull);
      await sharp(src)
        .rotate()
        .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 74, effort: 5 })
        .toFile(imgPath);
    }

    const cat = catMeta(overrides[String(id)] || p.category);
    const multi = p.variants.length > 1;
    const variants = p.variants.map((v, i) => {
      let lfa = multi ? (v.labelFa || (p.defaultLabels[i]?.fa ?? '')) : '';
      let len = multi ? (v.labelFa || (p.defaultLabels[i]?.en ?? '')) : '';
      if (/زنانه/.test(lfa)) { lfa = 'نسخه زنانه'; len = 'Female version'; }
      else if (/مردانه/.test(lfa)) { lfa = 'نسخه مردانه'; len = 'Male version'; }
      return {
        l: { fa: lfa, en: len },
        text: v.text,
      };
    });

    let tFa, tEn;
    if (ed) {
      tFa = ed[0] || stripEmojis(p.titleFa) || cat.fa;
      tEn = (ed[1] || '').trim();
    } else {
      /* auto-derive: EN from the prompt body, FA from channel title or a mini-dictionary */
      tEn = extractEnTitle(p.variants[0].text);
      const realT = isRealTitle(stripEmojis(p.titleFa));
      tFa = realT ? stripEmojis(p.titleFa) : deriveFaTitle(p.variants[0].text + ' ' + tEn, cat.fa);
      if (!tEn) tEn = cat.en;
    }
    out.push({
      id: p.msgId,
      t: { fa: tFa, en: tEn },
      cat: cat.key,
      catFa: cat.fa,
      catEn: cat.en,
      date: p.date,
      img: `assets/img/${imgName}`,
      variants,
    });
  }
  if (missingEd) console.log(`auto-derived bilingual titles for ${missingEd} prompts (add entries in tools/editorial.json to override)`);
  const catCount = {};
  for (const o of out) catCount[o.cat] = (catCount[o.cat] || 0) + 1;
  console.log('final category mix:', catCount);

  out.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  fs.mkdirSync(DATA, { recursive: true });
  fs.writeFileSync(
    path.join(DATA, 'prompts.js'),
    '/* Generated by tools/build.mjs - do not edit by hand */\nwindow.PROMPTOPIA_DATA = ' + JSON.stringify({ generatedAt: new Date().toISOString(), prompts: out }) + ';\n'
  );
  const mb = (n) => (n / 1048576).toFixed(1) + ' MB';
  const imgBytes = fs.readdirSync(IMG).reduce((s, f) => s + fs.statSync(path.join(IMG, f)).size, 0);
  console.log(`built data/prompts.js with ${out.length} prompts; images: ${mb(imgBytes)}`);

  /* per-prompt share pages: real OG tags for Telegram/IM previews, then redirect into the app */
  const SITE = 'https://mohsen-niksirat.github.io/promptopia/';
  const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shareDir = path.join(ROOT, 'p');
  fs.rmSync(shareDir, { recursive: true, force: true });
  fs.mkdirSync(shareDir, { recursive: true });
  for (const o of out) {
    const excerpt = o.variants[0].text.replace(/\s+/g, ' ').slice(0, 160);
    const imgUrl = SITE + o.img;
    const target = SITE + '#p' + o.id;
    const html = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<title>${escHtml(o.t.fa)} · پرامپتوپیا</title>
<meta name="description" content="${escHtml(excerpt)}">
<meta property="og:type" content="website">
<meta property="og:title" content="${escHtml(o.t.fa)} — پرامپتوپیا | ${escHtml(o.t.en)}">
<meta property="og:description" content="${escHtml(excerpt)}…">
<meta property="og:image" content="${imgUrl}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(o.t.fa)} — پرامپتوپیا">
<meta name="twitter:description" content="${escHtml(excerpt)}…">
<meta name="twitter:image" content="${imgUrl}">
<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace('${target}');</script>
</head>
<body><p>در حال انتقال… <a href="${target}">${escHtml(o.t.fa)}</a></p></body>
</html>\n`;
    fs.mkdirSync(path.join(shareDir, String(o.id)), { recursive: true });
    fs.writeFileSync(path.join(shareDir, String(o.id), 'index.html'), html);
  }
  console.log(`wrote ${out.length} share pages under /p/`);
}

/* ------------------------------------------------------------------ */
const cmd = process.argv[2] || 'all';
if (cmd === 'parse') await cmdParse();
else if (cmd === 'select') await cmdSelect();
else if (cmd === 'build') await cmdBuild({ force: process.argv.includes('--force') });
else { await cmdParse(); await cmdSelect(); await cmdBuild({ force: process.argv.includes('--force') }); }
