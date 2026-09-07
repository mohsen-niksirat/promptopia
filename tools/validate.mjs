#!/usr/bin/env node
/**
 * CI validation: fails if the shipped data is inconsistent.
 * Run: node tools/validate.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let errors = 0;
const fail = (msg) => { errors++; console.error('  ✗ ' + msg); };
const ok = (msg) => console.log('  ✓ ' + msg);

/* 1. data/prompts.js parses and has prompts */
let data = null;
try {
  globalThis.window = {};
  eval(fs.readFileSync(path.join(ROOT, 'data', 'prompts.js'), 'utf8'));
  data = globalThis.window.PROMPTOPIA_DATA;
} catch (e) {
  fail('data/prompts.js does not parse: ' + e.message);
}
if (data) {
  if (!Array.isArray(data.prompts) || data.prompts.length === 0) fail('prompts array is empty');
  else ok(`prompts: ${data.prompts.length}`);
}

/* 2. curation.json matches the shipped data (photo prompts only —
      hand-curated text prompts live in tools/text-prompts.json) */
const curation = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'curation.json'), 'utf8'));
let textCount = 0;
try {
  const tp = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'text-prompts.json'), 'utf8'));
  textCount = (tp.prompts || []).length;
} catch { /* missing/malformed file -> textCount stays 0 */ }
const photoCount = data ? data.prompts.filter((p) => p.id < 20000).length : 0;
if (data && curation.selected.length !== photoCount) {
  fail(`curation.json has ${curation.selected.length} ids but data has ${photoCount} photo prompts (+ ${textCount} text prompts) — re-run build`);
} else if (data) ok(`curation count matches data (${photoCount} photos + ${textCount} text)`);

/* 3. every prompt has image + title + at least one variant */
if (data) {
  const missing = [];
  for (const p of data.prompts) {
    if (!fs.existsSync(path.join(ROOT, p.img))) missing.push(`image missing: ${p.img}`);
    if (!p.t.fa || !p.t.en) missing.push(`title missing: #${p.id}`);
    if (!p.variants?.length || !p.variants[0].text) missing.push(`prompt text missing: #${p.id}`);
  }
  if (missing.length) missing.slice(0, 10).forEach(fail); else ok('all prompts have image, titles and text');
}

/* 4. share pages exist for every prompt */
if (data) {
  const missingShare = data.prompts.filter((p) => !fs.existsSync(path.join(ROOT, 'p', String(p.id), 'index.html')));
  if (missingShare.length) fail(`${missingShare.length} share pages missing (e.g. #${missingShare[0].id})`);
  else ok('share pages: all present');
}

/* 5. editorial.json is well-formed */
try {
  const ed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'editorial.json'), 'utf8'));
  const bad = Object.entries(ed).filter(([k, v]) => !k.startsWith('_') && (!Array.isArray(v) || v.length < 2));
  if (bad.length) fail(`editorial.json malformed entries: ${bad.map(([k]) => k).join(', ')}`);
  else ok(`editorial.json: ${Object.keys(ed).filter((k) => !k.startsWith('_')).length} entries`);
} catch (e) {
  fail('editorial.json is not valid JSON');
}

/* 6. SEO + PWA files exist */
for (const f of ['robots.txt', 'sitemap.xml', 'manifest.webmanifest', 'sw.js', '.nojekyll', 'index.html']) {
  if (fs.existsSync(path.join(ROOT, f))) ok(`present: ${f}`);
  else fail(`missing: ${f}`);
}

console.log(errors ? `\n✗ ${errors} problem(s) found` : '\n✓ all checks passed');
process.exit(errors ? 1 : 0);
