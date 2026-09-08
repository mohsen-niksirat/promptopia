#!/usr/bin/env node
/**
 * Bump the release version across every cache-busted asset.
 *   node tools/bump.mjs      -> next version (v+1)
 *   node tools/bump.mjs 12   -> force version 12
 *
 * Keeps index.html (?v=N on css/js/data), sw.js (VERSION + comment) and
 * the inline cache-bust comments in sync, so returning visitors never get
 * stale service-worker/cache copies after a release.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const html = fs.readFileSync(INDEX, 'utf8');
const sw = fs.readFileSync(SW, 'utf8');

const htmlVs = [...html.matchAll(/\?v=(\d+)/g)].map((m) => Number(m[1]));
const swV = /promptopia-v(\d+)/.exec(sw);
if (!htmlVs.length || !swV) {
  console.error('✗ could not find version markers (index.html ?v=N / sw.js promptopia-vN)');
  process.exit(1);
}

const current = Math.max(...htmlVs, Number(swV[1]));
const next = process.argv[2] ? Number(process.argv[2]) : current + 1;
if (!Number.isInteger(next) || next < 1) {
  console.error('✗ version must be a positive integer');
  process.exit(1);
}

/* sw.js has both the VERSION constant (promptopia-vN) and ?v=N on its CORE entries */
fs.writeFileSync(INDEX, html.replace(/\?v=\d+/g, `?v=${next}`));
fs.writeFileSync(SW, sw
  .replace(/promptopia-v\d+/g, `promptopia-v${next}`)
  .replace(/\?v=\d+/g, `?v=${next}`));
if (next === current) console.log(`already at v${current} — synced sw.js CORE cache-bust`);
else console.log(`✓ cache-bust bumped v${current} -> v${next} (index.html + sw.js CORE)`);