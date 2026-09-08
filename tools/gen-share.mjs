#!/usr/bin/env node
/**
 * Regenerate static /p/<id>/ landing pages for ALL prompts (photos + text)
 * and write a complete sitemap.xml listing every page.
 *   Run: node tools/gen-share.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { landingPageHTML, pickRelated } from './share-page.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const P_DIR = path.join(ROOT, 'p');
const DATA_PATH = path.join(ROOT, 'data', 'prompts.js');
const SITE = 'https://mohsen-niksirat.github.io/promptopia/';

/* 1. load data */
globalThis.window = {};
eval(fs.readFileSync(DATA_PATH, 'utf8'));
const data = globalThis.window.PROMPTOPIA_DATA;
const prompts = data.prompts;

/* 2. remove stale pages (ids no longer in data) */
fs.mkdirSync(P_DIR, { recursive: true });
const validIds = new Set(prompts.map((p) => String(p.id)));
for (const entry of fs.readdirSync(P_DIR, { withFileTypes: true })) {
  if (entry.isDirectory() && !validIds.has(entry.name)) {
    fs.rmSync(path.join(P_DIR, entry.name), { recursive: true, force: true });
  }
}

/* 3. write one landing page per prompt (retry — antivirus/indexer briefly
   locks freshly-touched files on Windows; locks clear within seconds) */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function writeRetry(file, content) {
  for (let attempt = 0; ; attempt++) {
    try { fs.writeFileSync(file, content); return; }
    catch (e) {
      if (attempt >= 6) throw e;
      await sleep(1000 + attempt * 1000);
    }
  }
}
let n = 0;
const t0 = Date.now();
for (const p of prompts) {
  const dir = path.join(P_DIR, String(p.id));
  fs.mkdirSync(dir, { recursive: true });
  await writeRetry(path.join(dir, 'index.html'), landingPageHTML(p, pickRelated(p, prompts)));
  n++;
  if (n % 400 === 0) console.log('  ...', n);
}
console.log(`landing pages: ${n} in ${((Date.now() - t0) / 1000).toFixed(1)}s -> /p/`);

/* 4. sitemap.xml with every landing page */
const today = new Date().toISOString().slice(0, 10);
const urls = [
  { loc: SITE, priority: '1.0', changefreq: 'daily' },
  { loc: SITE + '#categoryNav', priority: '0.9', changefreq: 'daily' },
  ...prompts.map((p) => ({ loc: SITE + 'p/' + p.id + '/', priority: '0.7', changefreq: 'monthly' })),
];
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${today}</lastmod><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
console.log('sitemap.xml:', urls.length, 'urls');
