/* Promptopia app */
(function () {
  'use strict';

  const DATA = (window.PROMPTOPIA_DATA && window.PROMPTOPIA_DATA.prompts) || [];
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem('promptopia:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('promptopia:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  const THEMES = [
    { id: 'dark',     fa: 'تیره',       en: 'Dark',       mode: 'dark',  dots: ['#8b5cf6', '#d946ef', '#fb923c'], color: '#07080d' },
    { id: 'light',    fa: 'روشن',       en: 'Light',      mode: 'light', dots: ['#c4b5fd', '#f0abfc', '#fdba74'], color: '#f4f5fa' },
    { id: 'midnight', fa: 'نیمه‌شب',     en: 'Midnight',   mode: 'dark',  dots: ['#2563eb', '#7c3aed', '#ec4899'], color: '#060913' },
    { id: 'emerald',  fa: 'زمردی',      en: 'Emerald',    mode: 'dark',  dots: ['#059669', '#10b981', '#a3e635'], color: '#051410' },
    { id: 'sunset',   fa: 'غروب',       en: 'Sunset',     mode: 'dark',  dots: ['#e11d48', '#f97316', '#f59e0b'], color: '#150806' },
    { id: 'cream',    fa: 'کرم',        en: 'Cream',      mode: 'light', dots: ['#f43f5e', '#f97316', '#d97706'], color: '#faf6f0' },
    { id: 'ocean',    fa: 'اقیانوسی',   en: 'Ocean',      mode: 'dark',  dots: ['#0ea5e9', '#14b8a6', '#38bdf8'], color: '#04131d' },
    { id: 'lavender', fa: 'لاوندر',     en: 'Lavender',   mode: 'dark',  dots: ['#8b5cf6', '#a78bfa', '#f0abfc'], color: '#100b1d' },
    { id: 'rose',     fa: 'رز',         en: 'Rose',       mode: 'dark',  dots: ['#e11d48', '#ec4899', '#fb7185'], color: '#1a080f' },
    { id: 'graphite', fa: 'گرافیتی',    en: 'Graphite',   mode: 'dark',  dots: ['#64748b', '#94a3b8', '#e2e8f0'], color: '#101318' },
  ];
  const savedTheme = LS.get('theme', 'dark');
  const state = {
    lang: LS.get('lang', 'fa'),
    theme: THEMES.some((t) => t.id === savedTheme) ? savedTheme : 'dark',
    q: '',
    sort: 'new',
    sectionPages: Object.create(null),
    expanded: Object.create(null),
    favs: new Set(LS.get('favs', [])),
    modal: { prompt: null, variant: 0, returnHash: '' },
  };
  const PER_PAGE = 24;
  const PREVIEW_COUNT = 6; /* cards shown in a collapsed section's preview row */
  const CATEGORY_ICONS = {
    writing: '✍️', coding: '⌘', marketing: '📣', education: '📚', business: '💼', career: '🚀', seo: '⌕',
    portrait: '✦', family: '♡', travel: '✈️', vehicles: '🚘', food: '🍜', animals: '🐾', fantasy: '🪄',
    product: '🛍️', utility: '🧰', fashion: '👗', luxury: '💎', favs: '♥',
    video: '🎬', ui: '🎨', 'prompt-eng': '✨',
  };
  window.APP_LANG = state.lang;

  /* ---------- helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s).toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670\u0640]/g, '');
  const fmt = (n) => new Intl.NumberFormat(state.lang === 'fa' ? 'fa-IR' : 'en-US').format(n);
  const title = (p) => (state.lang === 'fa' ? p.t.fa : p.t.en);

  /* image variants: photos ship a 480w card candidate + a 40px blur placeholder */
  function imgVariants(p) {
    if (p.text) return { src: p.img, sm: p.img, blur: p.img, srcset: '' };
    const base = p.img.replace(/\.webp$/, '');
    return { src: p.img, sm: base + '-480.webp', blur: base + '-blur.webp', srcset: `${base}-480.webp 480w, ${p.img} 900w` };
  }
  const CARD_SIZES = '(min-width: 900px) 280px, 45vw';
  const MODAL_SIZES = '(min-width: 900px) 560px, 92vw';
  const toastEl = () => $('#toast');
  let toastTimer = null;
  function toast(msg) {
    const t = toastEl();
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* noop */ }
      ta.remove();
      return ok;
    }
  }

  /* ---------- i18n / theme ---------- */
  function applyI18n() {
    const L = window.I18N[state.lang];
    document.documentElement.lang = state.lang;
    document.documentElement.dir = L.dir;
    document.title = L.title;
    $('#brandName').textContent = state.lang === 'fa' ? 'پرامپتوپیا' : 'Promptopia';
    $('#langToggle').textContent = L.langSwitch;
    $$('[data-i18n]').forEach((el) => { el.textContent = window.t(el.getAttribute('data-i18n')); });
    $$('[data-i18n-ph]').forEach((el) => { el.placeholder = window.t(el.getAttribute('data-i18n-ph')); });
    $('#modalRandom').setAttribute('aria-label', window.t('random'));
    $('#themeToggle').setAttribute('aria-label', window.t('chooseTheme'));
    $('#favExport').setAttribute('aria-label', window.t('favExport'));
    $('#favImport').setAttribute('aria-label', window.t('favImport'));
    renderThemeMenu();
    renderStats();
    renderDaily();
    renderSections();
  }

  function applyTheme() {
    const t = THEMES.find((x) => x.id === state.theme) || THEMES[0];
    document.documentElement.dataset.theme = t.id;
    document.documentElement.dataset.mode = t.mode;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = t.color;
    LS.set('theme', state.theme);
    renderThemeMenu();
  }

  function renderThemeMenu() {
    const menu = $('#themeMenu');
    if (!menu) return;
    menu.innerHTML = THEMES.map((t) => {
      const active = t.id === state.theme;
      const label = state.lang === 'fa' ? t.fa : t.en;
      const dots = t.dots.map((c) => `<i style="background:${c}"></i>`).join('');
      return `<button class="theme-opt ${active ? 'active' : ''}" type="button" role="menuitemradio" aria-checked="${active}" data-theme="${t.id}">
        <span class="theme-dots" aria-hidden="true">${dots}</span>
        <span>${esc(label)}</span>
        <span class="theme-check" aria-hidden="true">${active ? '✓' : ''}</span>
      </button>`;
    }).join('');
  }

  /* ---------- category sections ---------- */
  function categoryEntries() {
    const byKey = new Map();
    for (const p of DATA) {
      if (!byKey.has(p.cat)) byKey.set(p.cat, { key: p.cat, labelFa: p.catFa, labelEn: p.catEn, count: 0 });
      byKey.get(p.cat).count++;
    }
    /* most prompts first (stable for ties) */
    return Array.from(byKey.values()).sort((a, b) => b.count - a.count);
  }

  function categoryMeta(key) {
    if (key === 'favs') return { key, labelFa: window.t('favorites'), labelEn: window.t('favorites'), count: state.favs.size };
    return categoryEntries().find((entry) => entry.key === key) || { key, labelFa: key, labelEn: key, count: 0 };
  }

  function sectionKeys() {
    const keys = categoryEntries().map((entry) => entry.key);
    if (state.favs.size) keys.push('favs');
    return keys;
  }

  function catLabel(p) { return state.lang === 'fa' ? p.catFa : p.catEn; }

  function promptMatches(p, q) {
    if (!q) return true;
    return norm([
      p.t.fa, p.t.en, p.catFa, p.catEn,
      p.variants.map((v) => v.text).join(' '),
    ].join(' \n ')).includes(q);
  }

  function filteredSection(key) {
    const q = norm(state.q.trim());
    let list = DATA.filter((p) => (key === 'favs' ? state.favs.has(p.id) : p.cat === key));
    if (q) {
      list = list.filter((p) => promptMatches(p, q));
      const titleHits = [];
      const bodyHits = [];
      for (const p of list) {
        const inTitle = norm([p.t.fa, p.t.en, p.catFa, p.catEn].join(' ')).includes(q);
        (inTitle ? titleHits : bodyHits).push(p);
      }
      list = titleHits.concat(bodyHits);
    }
    if (state.sort === 'old') list = list.slice().reverse();
    else if (state.sort === 'popular' && window.PromptopiaCounter) {
      const top = new Map(window.PromptopiaCounter.top(10000).map((x) => [x.id, x.count]));
      list = list.slice().sort((a, b) => (top.get(b.id) || 0) - (top.get(a.id) || 0));
    }
    return list;
  }

  function resetSectionPages() {
    state.sectionPages = Object.create(null);
  }

  /* a section is expanded either by the user or implicitly while searching */
  function isExpanded(key) {
    return !!state.q || !!state.expanded[key];
  }

  function renderCategoryNav() {
    const nav = $('#categoryNav');
    if (!nav) return;
    const entries = categoryEntries();
    const items = entries.concat(state.favs.size ? [categoryMeta('favs')] : []);
    nav.innerHTML = items.map((entry) => {
      const label = state.lang === 'fa' ? entry.labelFa : entry.labelEn;
      return `<a class="category-link ${entry.key === 'favs' ? 'category-link-fav' : ''}" href="#section-${esc(entry.key)}" aria-label="${esc(label)}">
        <span class="category-icon" aria-hidden="true">${CATEGORY_ICONS[entry.key] || '✦'}</span>
        <span>${esc(label)}</span><b>${fmt(entry.count)}</b>
      </a>`;
    }).join('');
  }

  function sectionHTML(key, list) {
    const meta = categoryMeta(key);
    const label = state.lang === 'fa' ? meta.labelFa : meta.labelEn;
    return `<section class="prompt-section" id="section-${esc(key)}" data-section="${esc(key)}" aria-labelledby="heading-${esc(key)}">
      <div class="section-heading">
        <div class="section-heading-main">
          <span class="section-icon" aria-hidden="true">${CATEGORY_ICONS[key] || '✦'}</span>
          <div><h2 id="heading-${esc(key)}">${esc(label)}</h2><p class="section-count">${esc(window.t('sectionCount', { n: fmt(list.length) }))}</p></div>
        </div>
        <a class="section-top" href="#categoryNav">${esc(window.t('backToCategories'))}</a>
      </div>
      <div class="grid section-grid" id="grid-${esc(key)}"></div>
      <div class="section-more-row"><button class="btn btn-ghost btn-sm section-more" type="button" data-more="${esc(key)}" hidden></button></div>
      <nav class="pagination section-pagination" data-section="${esc(key)}" aria-label="${esc(label)} ${esc(window.t('pagination'))}"></nav>
    </section>`;
  }

  /* the section the user is currently looking at: the one whose box
     overlaps the viewport center (null when still at the hero) */
  function activeSectionKey() {
    const sections = $$('#sections .prompt-section');
    if (!sections.length) return null;
    const mid = innerHeight / 2;
    let best = null;
    let bestDist = Infinity;
    for (const s of sections) {
      const r = s.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) continue;
      const dist = Math.abs((r.top + r.bottom) / 2 - mid);
      if (dist < bestDist) { bestDist = dist; best = s; }
    }
    return best ? best.dataset.section : null;
  }

  function renderSections() {
    const sections = $('#sections');
    if (!sections) return;
    renderCategoryNav();
    const views = sectionKeys().map((key) => ({ key, list: filteredSection(key) }));
    const visible = state.q ? views.filter((view) => view.list.length) : views;
    const total = views.reduce((sum, view) => sum + view.list.length, 0);
    $('#resultCount').textContent = window.t('results', { n: fmt(total) });
    $('#emptyBox').hidden = total > 0;
    sections.innerHTML = visible.map((view) => sectionHTML(view.key, view.list)).join('');
    visible.forEach((view) => renderSection(view.key, view.list));
  }

  /* ---------- reveal-on-scroll (rAF + rect based, no IntersectionObserver) ---------- */
  const revealer = (() => {
    const pending = new Set();
    let scheduled = false;
    const check = () => {
      scheduled = false;
      const vh = window.innerHeight;
      for (const el of Array.from(pending)) {
        if (!el.isConnected) { pending.delete(el); continue; }
        const r = el.getBoundingClientRect();
        if (r.top < vh + 80 && r.bottom > -80) {
          el.classList.add('in');
          pending.delete(el);
        }
      }
    };
    const onScroll = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(check);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return { observe(el) { pending.add(el); onScroll(); } };
  })();

  /* ---------- section grids & pagination ---------- */
  function pulseGrid(grid) {
    grid.classList.remove('grid-in');
    void grid.offsetWidth;
    grid.classList.add('grid-in');
  }

  function prefetchNextPage(list, page, pages) {
    if (page >= pages) return;
    const next = list.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
    const run = () => next.forEach((p) => { const im = new Image(); im.decoding = 'async'; im.src = imgVariants(p).sm; });
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 4000 });
    else setTimeout(run, 2000);
  }

  function pageList(cur, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const out = [1];
    let lo = Math.max(2, cur - 1);
    let hi = Math.min(total - 1, cur + 1);
    if (cur <= 3) { lo = 2; hi = 4; }
    if (cur >= total - 2) { lo = total - 3; hi = total - 1; }
    if (lo > 2) out.push('…');
    for (let i = lo; i <= hi; i++) out.push(i);
    if (hi < total - 1) out.push('…');
    out.push(total);
    return out;
  }

  function renderPagination(nav, pages, cur, key) {
    if (pages <= 1) { nav.innerHTML = ''; nav.hidden = true; return; }
    nav.hidden = false;
    const glyph = state.lang === 'fa' ? { prev: '›', next: '‹' } : { prev: '‹', next: '›' };
    const btn = (label, page, opts = {}) => {
      if (page === '…') return '<span class="page-dots">…</span>';
      const cls = ['page-btn', opts.cls || '', page === cur ? 'active' : ''].filter(Boolean).join(' ');
      const dis = opts.disabled ? ' disabled' : '';
      const aria = opts.aria ? ` aria-label="${esc(opts.aria)}"` : '';
      return `<button class="${cls}" type="button" data-page="${page}"${aria}${dis}>${label}</button>`;
    };
    nav.innerHTML = btn(glyph.prev, cur - 1, { cls: 'p-nav', disabled: cur === 1, aria: window.t('prevPage') })
      + pageList(cur, pages).map((n) => btn(n, n)).join('')
      + btn(glyph.next, cur + 1, { cls: 'p-nav', disabled: cur === pages, aria: window.t('nextPage') })
      + `<span class="page-info">${esc(window.t('pageInfo', { x: fmt(cur), y: fmt(pages) }))}</span>`;
  }

  function renderSection(key, list) {
    const section = $(`[data-section="${key}"]`);
    if (!section) return;
    const grid = $('.section-grid', section);
    const pag = $('.section-pagination', section);
    const moreRow = $('.section-more-row', section);
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    $('.section-count', section).textContent = window.t('sectionCount', { n: fmt(list.length) });

    if (!isExpanded(key) && list.length > PREVIEW_COUNT) {
      /* preview row: top cards only, full grid behind the "view all" button */
      state.sectionPages[key] = 1;
      grid.innerHTML = list.slice(0, PREVIEW_COUNT).map(cardHTML).join('');
      pag.hidden = true;
      pag.innerHTML = '';
      moreRow.hidden = false;
      $('.section-more', section).textContent = window.t('viewAllN', { n: fmt(list.length) });
    } else {
      const page = Math.min(state.sectionPages[key] || 1, pages);
      state.sectionPages[key] = page;
      grid.innerHTML = list.slice((page - 1) * PER_PAGE, page * PER_PAGE).map(cardHTML).join('');
      renderPagination(pag, pages, page, key);
      moreRow.hidden = true;
      prefetchNextPage(list, page, pages);
    }
    $$('.card', grid).forEach((card, i) => {
      card.style.animationDelay = (i % 12) * 38 + 'ms';
      revealer.observe(card);
    });
    $$('img[data-lazy]', grid).forEach((img) => {
      const done = () => img.classList.add('loaded');
      if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
    });
  }

  function syncSectionHash(key, page) {
    const hash = page > 1 ? '#s-' + key + '-page-' + page : '';
    history.replaceState(null, '', location.pathname + location.search + hash);
  }

  function goToSectionPage(key, page) {
    const list = filteredSection(key);
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    const next = Math.max(1, Math.min(Number(page), pages));
    if (next === (state.sectionPages[key] || 1)) return;
    state.sectionPages[key] = next;
    renderSection(key, list);
    pulseGrid($(`[data-section="${key}"] .section-grid`));
    syncSectionHash(key, next);
    $(`[data-section="${key}"]`).scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ---------- premium ---------- */
  function isLocked(p) {
    return !!(p && p.premium && window.PromptopiaPremium && !window.PromptopiaPremium.isUnlocked());
  }

  function countCopy(id) {
    if (window.PromptopiaCounter) window.PromptopiaCounter.bump(id);
  }

  function cardHTML(p) {
    const iv = imgVariants(p);
    const srcset = iv.srcset ? ` srcset="${iv.srcset}" sizes="${CARD_SIZES}"` : '';
    const locked = isLocked(p);
    return `<article class="card" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(title(p))}">
      <div class="card-media" style="background-image:url('${iv.blur}')">
        <span class="skeleton" aria-hidden="true"></span>
        <img data-lazy src="${iv.src}"${srcset} alt="${esc(title(p))}" loading="lazy" decoding="async">
        <span class="badge">${esc(catLabel(p))}</span>
        ${p.premium ? '<span class="badge badge-premium" title="' + esc(window.t('premiumBadge')) + '">★</span>' : ''}
        <button class="fav" type="button" data-fav="${p.id}" aria-label="${window.t('favorites')}">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M12 20.5C7 16.5 3.5 13.3 3.5 9.7 3.5 7 5.6 5 8.2 5c1.5 0 3 .7 3.8 2 .8-1.3 2.3-2 3.8-2 2.6 0 4.7 2 4.7 4.7 0 3.6-3.5 6.8-8.5 10.8Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>
        </button>
        <span class="card-title">${esc(title(p))}</span>
      </div>
      <div class="card-foot">
        <button class="btn-copy" type="button" data-id="${p.id}">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="2.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M5 15V6.5A2.5 2.5 0 0 1 7.5 4H15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          <span>${esc(window.t('copy'))}</span>
        </button>
        <a class="btn-use" href="https://gemini.google.com/app" target="_blank" rel="noopener" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2l2.1 5.6L20 9.4l-5.4 2.4L12 18l-2.6-6.2L12 2z" fill="currentColor"/></svg>
          <span>${esc(window.t('useFree'))}</span>
        </a>
      </div>
    </article>`;
  }

  /* ---------- favorites ---------- */
  function syncFavBtn(btn, id) { btn.classList.toggle('on', state.favs.has(id)); }

  function toggleFav(id) {
    if (state.favs.has(id)) { state.favs.delete(id); toast(window.t('favRemoved')); }
    else { state.favs.add(id); toast(window.t('favAdded')); }
    LS.set('favs', Array.from(state.favs));
    $$('.fav').forEach((b) => { if (Number(b.dataset.fav) === id) syncFavBtn(b, id); });
    if ($('#promptModal').open && state.modal.prompt) syncFavBtn($('#modalFav'), state.modal.prompt.id);
    renderSections();
  }

  /* ---------- modal ---------- */
  const modal = $('#promptModal');
  function openModal(id, fromHash) {
    const p = DATA.find((x) => x.id === id);
    if (!p) return;
    state.modal = { prompt: p, variant: 0, returnHash: fromHash ? '' : location.hash };
    fillModal();
    modal.showModal();
    document.documentElement.classList.add('modal-open');
    if (!fromHash) history.replaceState(null, '', '#p' + id);
  }

  function closeModal() {
    modal.close();
    document.documentElement.classList.remove('modal-open');
    history.replaceState(null, '', location.pathname + location.search + (state.modal.returnHash || ''));
  }

  let fillSeq = 0;
  function fillModal() {
    const seq = ++fillSeq;
    const p = state.modal.prompt;
    const v = p.variants[state.modal.variant] || p.variants[0];
    const isText = !!p.text;
    modal.classList.toggle('text-prompt', isText);
    const iv = imgVariants(p);
    const mi = $('#modalImg');
    if (mi.getAttribute('src') !== iv.src) {
      /* blur-up swap: fade out, switch to the new source, reveal on load — no stale frame.
         seq guards against a slow load of prompt A revealing over prompt B. */
      mi.classList.add('img-fade');
      const show = () => { if (seq === fillSeq) mi.classList.remove('img-fade'); };
      mi.src = iv.src;
      mi.srcset = iv.srcset;
      mi.sizes = iv.srcset ? MODAL_SIZES : '';
      mi.closest('.modal-media').style.backgroundImage = "url('" + iv.blur + "')";
      if (mi.complete && mi.naturalWidth > 0) setTimeout(show, 40);
      else { mi.addEventListener('load', show, { once: true }); mi.addEventListener('error', show, { once: true }); }
    } else {
      mi.closest('.modal-media').style.backgroundImage = "url('" + iv.blur + "')";
      mi.classList.remove('img-fade');
    }
    mi.alt = title(p);
    $('#modalIcon').src = isText ? p.img : '';
    $('#modalIcon').alt = catLabel(p);
    $('#modalCat').textContent = catLabel(p);
    $('#modalDate').textContent = p.date || '';
    $('#modalTitle').textContent = title(p);
    const locked = isLocked(p);
    const box = $('#promptBox');
    if (locked) {
      /* teaser: first ~2 lines visible, rest blurred behind the lock note.
         Buttons are handled by the delegated #promptBox listener in bind(). */
      box.classList.add('locked');
      box.innerHTML = '<div class="lock-teaser">' + esc(v.text.slice(0, 90)) + '</div>' +
        '<div class="lock-note"><span class="lock-star">★</span>' +
        '<p>' + esc(window.t('premiumLocked')) + '</p>' +
        '<div class="lock-actions"><button class="btn btn-primary btn-sm" id="lockBuy" type="button">' + esc(window.t('premiumBuy')) + '</button>' +
        '<button class="btn btn-ghost btn-sm" id="lockCode" type="button">' + esc(window.t('premiumHaveCode')) + '</button></div>' +
        '<div class="code-row" hidden><input id="codeInput" class="input code-input" autocomplete="off" spellcheck="false" placeholder="PRO....">' +
        '<button class="btn btn-primary btn-sm" id="codeGo" type="button">' + esc(window.t('premiumActivate')) + '</button></div></div>';
    } else {
      box.classList.remove('locked');
      box.textContent = v.text;
    }
    syncFavBtn($('#modalFav'), p.id);
    const tabs = $('#variantTabs');
    if (p.variants.length > 1) {
      tabs.hidden = false;
      tabs.innerHTML = p.variants.map((vv, i) => `<button class="vtab ${i === state.modal.variant ? 'active' : ''}" type="button" data-v="${i}">${esc(variantLabel(p, i))}</button>`).join('');
      $$('.vtab', tabs).forEach((b) => b.addEventListener('click', () => {
        state.modal.variant = Number(b.dataset.v);
        fillModal();
      }));
    } else {
      tabs.hidden = true;
      tabs.innerHTML = '';
    }
  }

  function variantLabel(p, i) {
    const v = p.variants[i];
    const l = state.lang === 'fa' ? (v.l.fa || v.l.en) : (v.l.en || v.l.fa);
    return l || (state.lang === 'fa' ? 'نسخه ' + (i + 1) : 'Version ' + (i + 1));
  }

  /* ---------- events ---------- */
  function bind() {
    const sections = $('#sections');
    sections.addEventListener('click', async (ev) => {
      const pageButton = ev.target.closest('.section-pagination .page-btn');
      if (pageButton && !pageButton.disabled) {
        goToSectionPage(pageButton.closest('.section-pagination').dataset.section, Number(pageButton.dataset.page));
        return;
      }
      const moreBtn = ev.target.closest('.section-more');
      if (moreBtn) {
        const key = moreBtn.dataset.more;
        state.expanded[key] = true;
        renderSection(key, filteredSection(key));
        pulseGrid($(`[data-section="${key}"] .section-grid`));
        return;
      }
      const card = ev.target.closest('.card');
      if (!card) return;
      /* card copy button (delegated) — blocked for locked premium prompts */
      const copyBtn = ev.target.closest('.btn-copy');
      if (copyBtn) {
        ev.stopPropagation();
        const p = DATA.find((x) => x.id === Number(copyBtn.dataset.id));
        if (!p) return;
        if (isLocked(p)) { toast(window.t('premiumCopyBlocked')); openModal(p.id); return; }
        if (await copyText(p.variants[0].text)) { toast(window.t('copied')); countCopy(p.id); }
        return;
      }
      if (ev.target.closest('.fav, .btn-use')) return;
      openModal(Number(card.dataset.id));
    });
    sections.addEventListener('keydown', (ev) => {
      const card = ev.target.closest('.card');
      if (card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openModal(Number(card.dataset.id)); }
    });

    /* keyboard: '/' focuses search, arrows move between modals within a category */
    document.addEventListener('keydown', (ev) => {
      const t = ev.target;
      const typing = t instanceof Element && (t.matches('input, textarea, select') || t.isContentEditable);
      if (ev.key === '/' && !typing && !modal.open) {
        ev.preventDefault();
        $('#searchInput').focus();
        $('#searchInput').select();
        return;
      }
      if (!modal.open || !state.modal.prompt) return;
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      ev.preventDefault();
      const p = state.modal.prompt;
      const inCat = DATA.filter((x) => x.cat === p.cat);
      const idx = inCat.findIndex((x) => x.id === p.id);
      /* RTL (fa): ArrowLeft advances; LTR (en): ArrowRight advances */
      const fwd = state.lang === 'fa' ? ev.key === 'ArrowLeft' : ev.key === 'ArrowRight';
      const next = inCat[(idx + (fwd ? 1 : -1) + inCat.length) % inCat.length];
      if (next) openModal(next.id);
    });

    let searchTimer = null;
    $('#searchInput').addEventListener('input', (ev) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.q = ev.target.value;
        resetSectionPages();
        renderSections();
      }, 160);
    });

    $('#sortSelect').addEventListener('change', (ev) => {
      state.sort = ev.target.value;
      resetSectionPages();
      renderSections();
    });

    $('#langToggle').addEventListener('click', () => {
      state.lang = state.lang === 'fa' ? 'en' : 'fa';
      window.APP_LANG = state.lang;
      LS.set('lang', state.lang);
      applyI18n();
    });

    const themeToggle = $('#themeToggle');
    const themeMenu = $('#themeMenu');
    const setMenu = (open) => {
      themeMenu.hidden = !open;
      themeToggle.setAttribute('aria-expanded', String(open));
    };
    themeToggle.addEventListener('click', () => setMenu(themeMenu.hidden));
    document.addEventListener('click', (ev) => { if (!ev.target.closest('.theme-wrap')) setMenu(false); });
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape' && !themeMenu.hidden) { setMenu(false); ev.stopPropagation(); }
    });
    themeMenu.addEventListener('click', (ev) => {
      const btn = ev.target.closest('.theme-opt');
      if (!btn) return;
      state.theme = btn.dataset.theme;
      applyTheme();
      setMenu(false);
    });

    /* ---------- premium (delegated: the lock UI is rebuilt per fill) ---------- */
    async function onBuyClick() {
      const P = window.PromptopiaPremium;
      if (!P) return;
      const res = P.startPurchase();
      if (!res.ok) {
        /* no merchant id yet: point to Telegram for manual purchase */
        window.open(res.fallback, '_blank', 'noopener');
        toast(window.t('premiumTelegram'));
      }
    }
    async function onActivateClick() {
      const P = window.PromptopiaPremium;
      const code = $('#codeInput') ? $('#codeInput').value : '';
      if (!P || !code) return;
      const res = await P.activate(code);
      if (res.ok) {
        toast(window.t('premiumUnlocked', { n: P.daysLeft() }));
        renderSections();
        fillModal();
      } else {
        toast(window.t('premiumBadCode'));
      }
    }
    $('#promptBox').addEventListener('click', (ev) => {
      if (ev.target.closest('#lockBuy')) { ev.stopPropagation(); onBuyClick(); return; }
      if (ev.target.closest('#lockCode')) {
        ev.stopPropagation();
        const row = $('.code-row', $('#promptBox'));
        row.hidden = !row.hidden;
        if (!row.hidden) $('#codeInput').focus();
        return;
      }
      if (ev.target.closest('#codeGo')) { ev.stopPropagation(); onActivateClick(); }
    });

    $('#modalClose').addEventListener('click', closeModal);
    modal.addEventListener('close', () => document.documentElement.classList.remove('modal-open'));
    modal.addEventListener('click', (ev) => { if (ev.target === modal) closeModal(); });
    modal.addEventListener('cancel', (ev) => { ev.preventDefault(); closeModal(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && modal.open) closeModal(); });
    $('#modalFav').addEventListener('click', () => { if (state.modal.prompt) toggleFav(state.modal.prompt.id); });
    const selectedText = () => {
      const p = state.modal.prompt;
      if (!p) return null;
      if (isLocked(p)) { toast(window.t('premiumCopyBlocked')); return null; }
      return p.variants[state.modal.variant].text;
    };
    $('#modalCopy').addEventListener('click', async () => {
      const t = selectedText();
      if (t && (await copyText(t))) { toast(window.t('copied')); countCopy(state.modal.prompt.id); }
    });
    $('#modalBuild').addEventListener('click', () => {
      const t = selectedText();
      if (!t) return;
      window.open('https://chatgpt.com/?q=' + encodeURIComponent(t), '_blank', 'noopener');
      copyText(t).then((ok) => { if (ok) toast(window.t('copied')); });
    });
    $('#siteChatgpt').addEventListener('click', (ev) => {
      const t = selectedText();
      if (!t) return;
      ev.preventDefault();
      window.open('https://chatgpt.com/?q=' + encodeURIComponent(t), '_blank', 'noopener');
      copyText(t);
    });
    $('#siteGemini').addEventListener('click', (ev) => {
      const t = selectedText();
      if (!t) return;
      ev.preventDefault();
      window.open('https://gemini.google.com/app', '_blank', 'noopener');
      copyText(t).then((ok) => { if (ok) toast(window.t('copiedPaste')); });
    });
    $('#modalShare').addEventListener('click', async () => {
      const p = state.modal.prompt;
      if (!p) return;
      const base = (location.origin + location.pathname).replace(/index\.html$/, '');
      const url = base + 'p/' + p.id + '/';
      const shareData = { title: 'Promptopia — ' + title(p), url };
      if (navigator.share) {
        try { await navigator.share(shareData); return; } catch { /* fall through */ }
      }
      if (await copyText(url)) toast(window.t('linkCopied'));
    });

    // prompt of the day
    $('#dailyBox').addEventListener('click', (ev) => {
      const card = ev.target.closest('.daily-card');
      if (card) openModal(Number(card.dataset.id));
    });

    // random prompt (toolbar + inside the modal) — respects what the user is browsing:
    // active search first, then the nearest category section, else the whole gallery
    const pickRandom = () => {
      if (!DATA.length) return;
      const q = norm(state.q.trim());
      let pool = [];
      if (q) pool = DATA.filter((p) => promptMatches(p, q));
      else {
        const key = activeSectionKey();
        if (key) pool = filteredSection(key);
      }
      if (!pool.length) pool = DATA;
      const draw = () => pool[Math.floor(Math.random() * pool.length)].id;
      let id = draw();
      if (state.modal.prompt && pool.length > 1) {
        for (let i = 0; i < 8 && id === state.modal.prompt.id; i++) id = draw();
      }
      openModal(id);
    };
    $('#randomBtn').addEventListener('click', pickRandom);
    $('#modalRandom').addEventListener('click', pickRandom);

    // favorites export / import (backup & restore on another device)
    $('#favExport').addEventListener('click', () => {
      const payload = {
        app: 'promptopia',
        exportedAt: new Date().toISOString(),
        ids: Array.from(state.favs),
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'promptopia-favorites.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast(window.t('favExported'));
    });
    $('#favImport').addEventListener('click', () => $('#favFile').click());
    $('#favFile').addEventListener('change', () => {
      const file = $('#favFile').files && $('#favFile').files[0];
      $('#favFile').value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(String(reader.result));
          const ids = Array.isArray(data) ? data : (Array.isArray(data.ids) ? data.ids : null);
          if (!ids) throw new Error('bad payload');
          const valid = ids.map(Number).filter((n) => Number.isFinite(n) && DATA.some((p) => p.id === n));
          if (!valid.length) throw new Error('no valid ids');
          for (const n of valid) state.favs.add(n);
          LS.set('favs', Array.from(state.favs));
          renderSections();
          toast(window.t('favImported', { n: fmt(valid.length) }));
        } catch {
          toast(window.t('favImportError'));
        }
      };
      reader.readAsText(file);
    });

    const topBtn = document.createElement('button');
    topBtn.className = 'top-btn';
    topBtn.type = 'button';
    topBtn.setAttribute('aria-label', window.t('top'));
    topBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    topBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    document.body.appendChild(topBtn);
    const header = $('.site-header');
    window.addEventListener('scroll', () => {
      topBtn.classList.toggle('show', window.scrollY > 600);
      header.classList.toggle('scrolled', window.scrollY > 8);
    }, { passive: true });
    topBtn.addEventListener('click', () => topBtn.setAttribute('aria-label', window.t('top')));
  }

  /* ---------- hero stats ---------- */
  function renderStats() {
    const cats = categoryEntries().length;
    $('#heroStats').innerHTML = `
      <div class="stat"><b>${fmt(DATA.length)}</b><span>${esc(window.t('statPrompts'))}</span></div>
      <div class="stat"><b>${fmt(cats)}</b><span>${esc(window.t('statCats'))}</span></div>
      <div class="stat"><b>${esc(window.t('statFreeVal'))}</b><span>${esc(window.t('statFree'))}</span></div>`;
  }

  /* ---------- prompt of the day (deterministic, changes daily) ---------- */
  function renderDaily() {
    const box = $('#dailyBox');
    if (!box || !DATA.length) return;
    const dayNum = Math.floor(Date.now() / 86400000);
    const p = DATA[dayNum % DATA.length];
    if (!p) return;
    const dateLabel = new Intl.DateTimeFormat(state.lang === 'fa' ? 'fa-IR' : 'en-US', { day: 'numeric', month: 'long' }).format(new Date());
    box.hidden = false;
    const iv = imgVariants(p);
    box.innerHTML = `<button class="daily-card" type="button" data-id="${p.id}" aria-label="${esc(window.t('dailyTitle'))}: ${esc(title(p))}">
      <img src="${iv.sm}" alt="" loading="lazy" decoding="async">
      <span class="daily-info">
        <span class="daily-badge">${esc(window.t('dailyTitle'))} · ${esc(dateLabel)}</span>
        <span class="daily-name">${esc(title(p))}</span>
      </span>
      <span class="btn btn-ghost btn-sm daily-cta">${esc(window.t('dailyView'))}</span>
    </button>`;
  }

  function initReveal() { $$('[data-reveal]').forEach((el) => revealer.observe(el)); }

  /* ---------- pwa ---------- */
  function registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(location.hostname)) return;
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }

  /* ---------- boot ---------- */
  applyTheme();
  bind();
  applyI18n();
  initReveal();
  registerSW();

  function applyHash() {
    const promptMatch = /^#p(\d+)$/.exec(location.hash);
    if (promptMatch && !modal.open) {
      openModal(Number(promptMatch[1]), true);
      return;
    }
    const pageMatch = /^#s-([a-z0-9-]+)-page-(\d+)$/.exec(location.hash);
    if (pageMatch && sectionKeys().includes(pageMatch[1])) {
      const key = pageMatch[1];
      state.expanded[key] = true; /* a page deep-link implies the full grid */
      state.sectionPages[key] = Math.max(1, Number(pageMatch[2]));
      renderSections();
      requestAnimationFrame(() => $(`[data-section="${key}"]`)?.scrollIntoView({ behavior: 'auto', block: 'start' }));
    }
  }
  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
