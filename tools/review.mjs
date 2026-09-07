import fs from 'node:fs';

const items = JSON.parse(fs.readFileSync(new URL('../work/full-prompts.json', import.meta.url), 'utf8'));
const curation = JSON.parse(fs.readFileSync(new URL('./curation.json', import.meta.url), 'utf8'));
const byId = new Map(items.map((p) => [p.msgId, p]));

const stripEmo = (s) => s.replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '').trim();
const opener = /^(a|an)\s+(single.subject\s+)?(cinematic\s+)?(ultra.realistic\s+)?(hyper.realistic\s+)?(top.down\s+)?(close.up\s+)?(full.body\s+)?(artistic\s+)?(portrait|photograph|photo|scene|image|shot|edit|photography)\s+(of\s+|with\s+|showing\s+)?/i;
const boiler = /strict (identity & presentation override|presentation lock|wardrobe integrity lock)[\s\S]*$/i;

const rows = ['id\tcat\ttitle\tvariants\tbody'];
for (const id of curation.selected) {
  const p = byId.get(id);
  if (!p) continue;
  let body = p.variants[0].text.replace(boiler, '');
  body = body.replace(opener, '');
  const hint = body.slice(0, 150).replace(/\s+/g, ' ').replace(/\t/g, ' ');
  const title = stripEmo(p.titleFa || '').replace(/\t/g, ' ') || '(none)';
  rows.push(`${id}\t${p.category}\t${title}\t${p.variants.length}\t${hint}`);
}
fs.writeFileSync(new URL('../work/review.tsv', import.meta.url), rows.join('\n'));
console.log('wrote work/review.tsv with', rows.length - 1, 'rows');
