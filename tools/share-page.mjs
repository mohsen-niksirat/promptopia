/* Shared landing-page renderer for /p/<id>/ static share pages.
   Real content (title, category, full prompt text in both languages,
   related prompts, FAQ) + JSON-LD + og:image — crawlable by search engines. */
import { coverSVG } from './text-data.mjs';

const SITE = 'https://mohsen-niksirat.github.io/promptopia/';

const escHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function landingPageHTML(p, related) {
  const fa = p.variants.find((v) => /فارسی|persian/i.test(v.l.fa + v.l.en)) || p.variants[0];
  const en = p.variants.find((v) => /انگلیسی|english/i.test(v.l.fa + v.l.en)) || p.variants[1] || p.variants[0];
  const excerpt = (p.variants[0].text || '').replace(/\s+/g, ' ').slice(0, 160);
  const og = SITE + 'assets/og/p-' + p.id + '.png';
  const img = SITE + p.img;
  const url = SITE + 'p/' + p.id + '/';
  const appUrl = SITE + '#p' + p.id;

  const relatedCards = (related || []).map((r) => `
      <a class="rel" href="${SITE}p/${r.id}/"><span>${escHtml(r.t.fa)}</span><small>${escHtml(r.t.en)}</small></a>`).join('');

  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(p.t.fa)} · پرامپتوپیا — ${escHtml(p.t.en)}</title>
<meta name="description" content="${escHtml(excerpt)}…">
<link rel="canonical" href="${url}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Promptopia — پرامپتوپیا">
<meta property="og:title" content="${escHtml(p.t.fa)} — پرامپتوپیا">
<meta property="og:description" content="${escHtml(excerpt)}…">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(p.t.fa)} — پرامپتوپیا">
<meta name="twitter:description" content="${escHtml(excerpt)}…">
<meta name="twitter:image" content="${og}">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "CreativeWork",
      "name": ${JSON.stringify(p.t.fa)},
      "alternateName": ${JSON.stringify(p.t.en)},
      "headline": ${JSON.stringify(p.t.fa + ' — ' + p.t.en)},
      "description": ${JSON.stringify(excerpt)},
      "image": ${JSON.stringify(img)},
      "inLanguage": ["fa", "en"],
      "url": ${JSON.stringify(url)},
      "author": { "@type": "Person", "name": "Mohsen Niksirat", "url": "https://github.com/mohsen-niksirat" },
      "publisher": { "@type": "Organization", "name": "Promptopia", "url": ${JSON.stringify(SITE)} },
      "isAccessibleForFree": ${!p.premium},
      "keywords": ${JSON.stringify((p.catFa || '') + ', ' + (p.catEn || '') + ', پرامپت هوش مصنوعی, AI prompt')}
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "پرامپتوپیا", "item": ${JSON.stringify(SITE)} },
        { "@type": "ListItem", "position": 2, "name": ${JSON.stringify(p.catFa || p.cat || '')}, "item": ${JSON.stringify(SITE + '#section-' + (p.cat || ''))} },
        { "@type": "ListItem", "position": 3, "name": ${JSON.stringify(p.t.fa)} }
      ]
    },
    {
      "@type": "FAQPage",
      "mainEntity": [
        {
          "@type": "Question",
          "name": ${JSON.stringify('پرامپت «' + p.t.fa + '» چطور استفاده می‌کنم؟')},
          "acceptedAnswer": { "@type": "Answer", "text": "روی دکمه کپی بزنید، متن پرامپت را در Google Gemini یا ChatGPT پیست کنید و ارسال کنید. " + ${JSON.stringify(p.t.fa)} + " رایگان است." }
        },
        {
          "@type": "Question",
          "name": "آیا این پرامپت رایگان است؟",
          "acceptedAnswer": { "@type": "Answer", "text": ${JSON.stringify(p.premium ? 'این پرامپت بخشی از پکیج ویژه پرامپتوپیا است و با کد فعال‌سازی باز می‌شود.' : 'بله، این پرامپت کاملاً رایگان است.')} }
        }
      ]
    }
  ]
}
</script>
<style>
:root{color-scheme:dark}
*{box-sizing:border-box}
body{margin:0;font-family:Vazirmatn,Tahoma,system-ui,sans-serif;background:#0a0713;color:#e7e3f4;line-height:1.9}
.wrap{max-width:760px;margin:0 auto;padding:24px 18px 64px}
.badge{display:inline-block;font-size:.78rem;padding:.2rem .8rem;border-radius:999px;background:rgba(167,139,250,.14);color:#a78bfa;border:1px solid rgba(167,139,250,.3);margin-bottom:10px}
.premium{background:rgba(251,191,36,.12);color:#fbbf24;border-color:rgba(251,191,36,.35)}
h1{font-size:1.7rem;margin:.2rem 0 .4rem;line-height:1.5}
h1 small{display:block;font-size:1rem;color:#9b94b8;font-weight:400}
.meta{color:#8b84a8;font-size:.8rem;margin-bottom:22px}
.panel{background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:16px;padding:20px;margin:14px 0;white-space:pre-wrap;font-size:.95rem;overflow-wrap:anywhere}
.panel.premium-locked{position:relative}
.panel.premium-locked .blur{filter:blur(7px);opacity:.75;user-select:none;pointer-events:none;max-height:170px;overflow:hidden}
.lock-note{position:absolute;inset:0;display:grid;place-items:center;text-align:center}
.cta{display:inline-flex;align-items:center;gap:.5rem;background:linear-gradient(135deg,#8b5cf6,#d946ef);color:#fff;text-decoration:none;font-weight:700;padding:.85rem 1.6rem;border-radius:14px;margin:18px 0}
.cta.ghost{background:none;border:1px solid rgba(255,255,255,.2);color:#cfc9e8;font-weight:500}
h2{font-size:1.05rem;margin:30px 0 10px;color:#cfc9e8}
.rel-list{display:flex;flex-direction:column;gap:8px}
.rel{display:flex;flex-direction:column;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:10px 14px;text-decoration:none;color:inherit}
.rel:hover{border-color:rgba(167,139,250,.4)}
.rel small{color:#8b84a8;direction:ltr;text-align:left}
footer{margin-top:40px;color:#6f688c;font-size:.8rem}
footer a{color:#a78bfa}
</style>
</head>
<body>
<div class="wrap">
  <span class="badge">${escHtml(p.catFa || p.cat || '')}</span>${p.premium ? '<span class="badge premium">★ ویژه</span>' : ''}
  <h1>${escHtml(p.t.fa)}<small>${escHtml(p.t.en)}</small></h1>
  <div class="meta">پرامپتوپیا · گالری پرامپت‌های آماده هوش مصنوعی</div>

  <h2>پرامپت فارسی</h2>
  <div class="panel${p.premium ? ' premium-locked' : ''}">
${p.premium
    ? `    <div class="blur">${escHtml((fa.text || '').slice(0, 320))}</div>
    <div class="lock-note"><div>★ این پرامپت ویژه است<br><small>با کد فعال‌سازی یا خرید، متن کامل باز می‌شود</small></div></div>`
    : `    ${escHtml(fa.text || '')}` }
  </div>

  <h2>English prompt</h2>
  <div class="panel" dir="ltr" style="text-align:left${p.premium ? ';position:relative' : ''}">
${p.premium
    ? `    <div class="blur">${escHtml((en.text || '').slice(0, 320))}</div>
    <div class="lock-note"><div>★ Premium prompt<br><small>Unlock with an activation code or purchase</small></div></div>`
    : `    ${escHtml(en.text || '')}` }
  </div>

  <a class="cta" href="${appUrl}">Open in Promptopia / باز کردن در پرامپتوپیا</a>
  <a class="cta ghost" href="${SITE}">Browse all 1,300+ prompts</a>

${related && related.length ? `<h2>پرامپت‌های مرتبط / Related prompts</h2><div class="rel-list">${relatedCards}
  </div>` : ''}

  <footer>پرامپتوپیا — <a href="${SITE}">mohsen-niksirat.github.io/promptopia</a> · ساخته‌شده توسط <a href="https://github.com/mohsen-niksirat">Mohsen Niksirat</a></footer>
</div>
</body>
</html>
`;
}

/* related = same category, prefer title similarity, fall back to newest in cat */
export function pickRelated(p, all, n = 4) {
  const pool = all.filter((x) => x.id !== p.id && x.cat === p.cat);
  const words = String(p.t.en || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const score = (x) => {
    const t = String(x.t.en || '').toLowerCase();
    return words.reduce((s, w) => s + (t.includes(w) ? 1 : 0), 0);
  };
  return pool.sort((a, b) => score(b) - score(a) || (b.date || '').localeCompare(a.date || '')).slice(0, n);
}
