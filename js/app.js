/* Promptopia app */
(function () {
  'use strict';

  const DATA = (window.PROMPTOPIA_DATA && window.PROMPTOPIA_DATA.prompts) || [];
  const LS = {
    get: (k, d) => { try { const v = localStorage.getItem('promptopia:' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem('promptopia:' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  const state = {
    lang: LS.get('lang', 'fa'),
    theme: LS.get('theme', 'dark'),
    q: '',
    cat: 'all',
    sort: 'new',
    page: 1,
    favs: new Set(LS.get('favs', [])),
    modal: { prompt: null, variant: 0 },
  };
  const PER_PAGE = 24;
  window.APP_LANG = state.lang;

  /* ---------- helpers ---------- */
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const norm = (s) => String(s).toLowerCase().replace(/ي/g, 'ی').replace(/ك/g, 'ک').replace(/[\u064B-\u065F\u0670\u0640]/g, '');
  const fmt = (n) => new Intl.NumberFormat(state.lang === 'fa' ? 'fa-IR' : 'en-US').format(n);
  const title = (p) => (state.lang === 'fa' ? p.t.fa : p.t.en);
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
    $('#themeToggle').setAttribute('aria-label', state.theme === 'dark' ? window.t('themeLight') : window.t('themeDark'));
    renderStats();
    renderChips();
    renderGrid();
  }

  function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    LS.set('theme', state.theme);
  }

  /* ---------- data views ---------- */
  function catList() {
    const counts = new Map();
    for (const p of DATA) counts.set(p.cat, (counts.get(p.cat) || 0) + 1);
    return Array.from(counts.entries());
  }
  function catLabel(p) { return state.lang === 'fa' ? p.catFa : p.catEn; }
  function filtered() {
    const q = norm(state.q.trim());
    let list = DATA.filter((p) => {
      if (state.cat === 'favs' && !state.favs.has(p.id)) return false;
      if (state.cat !== 'all' && state.cat !== 'favs' && p.cat !== state.cat) return false;
      if (!q) return true;
      const hay = norm([
        p.t.fa, p.t.en, p.catFa, p.catEn,
        p.variants.map((v) => v.text).join(' '),
      ].join(' \n '));
      return hay.includes(q);
    });
    if (q) {
      /* relevance: title/category matches first, prompt-body matches after */
      const titleHits = [];
      const bodyHits = [];
      for (const p of list) {
        const inTitle = norm([p.t.fa, p.t.en, p.catFa, p.catEn].join(' ')).includes(q);
        (inTitle ? titleHits : bodyHits).push(p);
      }
      list = titleHits.concat(bodyHits);
    }
    if (state.sort === 'old') list = list.slice().reverse();
    return list;
  }

  /* ---------- chips ---------- */
  function renderChips() {
    const chips = $('#chips');
    const items = [
      { key: 'all', label: window.t('all'), n: DATA.length },
      ...catList().map(([key, n]) => {
        const sample = DATA.find((p) => p.cat === key);
        return { key, label: state.lang === 'fa' ? sample.catFa : sample.catEn, n };
      }),
      { key: 'favs', label: '♥ ' + window.t('favorites'), n: state.favs.size },
    ];
    chips.innerHTML = items.map((it) =>
      `<button class="chip ${it.key === 'favs' ? 'chip-fav' : ''} ${state.cat === it.key ? 'active' : ''}" role="tab"
        aria-selected="${state.cat === it.key}" data-cat="${it.key}">
        <span>${esc(it.label)}</span><span class="n">${fmt(it.n)}</span></button>`
    ).join('');
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
    return {
      observe(el) { pending.add(el); onScroll(); },
    };
  })();

  /* ---------- grid & pagination ---------- */
  function pulseGrid() {
    const g = $('#grid');
    g.classList.remove('grid-in');
    void g.offsetWidth; // restart animation
    g.classList.add('grid-in');
  }
  function renderGrid() {
    const grid = $('#grid');
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
    if (state.page > pages) state.page = pages;
    const slice = list.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);

    $('#emptyBox').hidden = list.length > 0;
    $('#resultCount').textContent = window.t('results', { n: fmt(list.length) });
    grid.innerHTML = slice.map(cardHTML).join('');
    $$('.card', grid).forEach((c, i) => {
      c.style.animationDelay = (i % 12) * 38 + 'ms';
      revealer.observe(c);
    });
    renderPagination(pages);
    prefetchNextPage(list, pages);

    // image fade-in
    $$('img[data-lazy]', grid).forEach((img) => {
      const done = () => img.classList.add('loaded');
      if (img.complete && img.naturalWidth) done(); else img.addEventListener('load', done, { once: true });
    });

    // favorites hearts
    $$('.fav', grid).forEach((b) => {
      const id = Number(b.dataset.fav);
      syncFavBtn(b, id);
      b.addEventListener('click', (ev) => { ev.stopPropagation(); toggleFav(id); });
    });

    // copy buttons
    $$('.btn-copy', grid).forEach((b) => {
      b.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const p = DATA.find((x) => x.id === Number(b.dataset.id));
        if (p && (await copyText(p.variants[0].text))) toast(window.t('copied'));
      });
    });
  }

  const GEMINI_URL = 'https://gemini.google.com/app';

  /* preload next page's images when the browser is idle -> instant pagination */
  function prefetchNextPage(list, pages) {
    if (state.page >= pages) return;
    const next = list.slice(state.page * PER_PAGE, (state.page + 1) * PER_PAGE);
    const run = () => next.forEach((p) => { const im = new Image(); im.decoding = 'async'; im.src = p.img; });
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

  function renderPagination(pages) {
    const nav = $('#pagination');
    if (pages <= 1) { nav.innerHTML = ''; nav.hidden = true; return; }
    nav.hidden = false;
    const cur = state.page;
    const glyph = state.lang === 'fa' ? { prev: '›', next: '‹' } : { prev: '‹', next: '›' };
    const btn = (label, page, opts = {}) => {
      if (page === '…') return '<span class="page-dots">…</span>';
      const cls = ['page-btn', opts.cls || '', page === cur ? 'active' : ''].filter(Boolean).join(' ');
      const dis = opts.disabled ? ' disabled' : '';
      const aria = opts.aria ? ` aria-label="${esc(opts.aria)}"` : '';
      return `<button class="${cls}" type="button" data-page="${page}"${dis}${aria}>${label}</button>`;
    };
    nav.innerHTML =
      btn(glyph.prev, cur - 1, { cls: 'p-nav', disabled: cur === 1, aria: window.t('prevPage') }) +
      pageList(cur, pages).map((n) => btn(n, n, {})).join('') +
      btn(glyph.next, cur + 1, { cls: 'p-nav', disabled: cur === pages, aria: window.t('nextPage') }) +
      `<span class="page-info">${esc(window.t('pageInfo', { x: fmt(cur), y: fmt(pages) }))}</span>`;
  }

  function syncPageHash() {
    history.replaceState(null, '', state.page > 1 ? '#page-' + state.page : location.pathname + location.search);
  }
  function goToPage(p) {
    if (p === state.page) return;
    state.page = p;
    renderGrid();
    pulseGrid();
    syncPageHash();
    $('#gallery').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cardHTML(p) {
    return `<article class="card" data-id="${p.id}" tabindex="0" role="button" aria-label="${esc(title(p))}">
      <div class="card-media">
        <span class="skeleton" aria-hidden="true"></span>
        <img data-lazy src="${p.img}" alt="${esc(title(p))}" loading="lazy" decoding="async">
        <span class="badge">${esc(catLabel(p))}</span>
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
        <a class="btn-use" href="${GEMINI_URL}" target="_blank" rel="noopener" onclick="event.stopPropagation()">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path d="M12 2l2.1 5.6L20 9.4l-5.4 2.4L12 18l-2.6-6.2L4 9.4l5.9-1.8L12 2z" fill="currentColor"/></svg>
          <span>${esc(window.t('useFree'))}</span>
        </a>
      </div>
    </article>`;
  }

  /* ---------- favorites ---------- */
  function syncFavBtn(btn, id) {
    btn.classList.toggle('on', state.favs.has(id));
  }
  function toggleFav(id) {
    if (state.favs.has(id)) { state.favs.delete(id); toast(window.t('favRemoved')); }
    else { state.favs.add(id); toast(window.t('favAdded')); }
    LS.set('favs', Array.from(state.favs));
    $$('.fav').forEach((b) => { if (Number(b.dataset.fav) === id) syncFavBtn(b, id); });
    if ($('#promptModal').open && state.modal.prompt) syncFavBtn($('#modalFav'), state.modal.prompt.id);
    if (state.cat === 'favs') renderGrid();
    renderChips();
  }

  /* ---------- modal ---------- */
  const modal = $('#promptModal');
  function openModal(id, fromHash) {
    const p = DATA.find((x) => x.id === id);
    if (!p) return;
    state.modal = { prompt: p, variant: 0 };
    fillModal();
    modal.showModal();
    document.documentElement.classList.add('modal-open'); // lock page scroll behind the dialog
    if (!fromHash) history.replaceState(null, '', '#p' + id);
  }
  function closeModal() {
    modal.close();
    document.documentElement.classList.remove('modal-open'); // unlock page scroll
    history.replaceState(null, '', location.pathname + location.search);
  }
  function fillModal() {
    const p = state.modal.prompt;
    const v = p.variants[state.modal.variant] || p.variants[0];
    $('#modalImg').src = p.img;
    $('#modalImg').alt = title(p);
    $('#modalCat').textContent = catLabel(p);
    $('#modalDate').textContent = p.date || '';
    $('#modalTitle').textContent = title(p);
    $('#promptBox').textContent = v.text;
    syncFavBtn($('#modalFav'), p.id);

    // variant tabs
    const tabs = $('#variantTabs');
    if (p.variants.length > 1) {
      tabs.hidden = false;
      tabs.innerHTML = p.variants.map((vv, i) =>
        `<button class="vtab ${i === state.modal.variant ? 'active' : ''}" type="button" data-v="${i}">${esc(variantLabel(p, i))}</button>`
      ).join('');
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
    // grid interactions
    const grid = $('#grid');
    grid.addEventListener('click', (ev) => {
      const card = ev.target.closest('.card');
      if (!card) return;
      if (ev.target.closest('.fav, .btn-copy, .btn-use')) return;
      openModal(Number(card.dataset.id));
    });
    grid.addEventListener('keydown', (ev) => {
      const card = ev.target.closest('.card');
      if (card && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); openModal(Number(card.dataset.id)); }
    });

    // chips (delegated)
    $('#chips').addEventListener('click', (ev) => {
      const chip = ev.target.closest('.chip');
      if (!chip) return;
      state.cat = chip.dataset.cat;
      state.page = 1;
      renderChips();
      renderGrid();
      pulseGrid();
      syncPageHash();
    });

    // pagination (delegated)
    $('#pagination').addEventListener('click', (ev) => {
      const b = ev.target.closest('.page-btn');
      if (!b || b.disabled) return;
      goToPage(Number(b.dataset.page));
    });

    // search
    let searchTimer = null;
    $('#searchInput').addEventListener('input', (ev) => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.q = ev.target.value;
        state.page = 1;
        renderGrid();
        pulseGrid();
        syncPageHash();
      }, 160);
    });

    // sort
    $('#sortSelect').addEventListener('change', (ev) => {
      state.sort = ev.target.value;
      state.page = 1;
      renderGrid();
      pulseGrid();
      syncPageHash();
    });

    // lang & theme
    $('#langToggle').addEventListener('click', () => {
      state.lang = state.lang === 'fa' ? 'en' : 'fa';
      window.APP_LANG = state.lang;
      LS.set('lang', state.lang);
      applyI18n();
    });
    $('#themeToggle').addEventListener('click', () => {
      state.theme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme();
    });

    // modal
    $('#modalClose').addEventListener('click', closeModal);
    modal.addEventListener('close', () => document.documentElement.classList.remove('modal-open'));
    modal.addEventListener('click', (ev) => { if (ev.target === modal) closeModal(); });
    modal.addEventListener('cancel', (ev) => { ev.preventDefault(); closeModal(); });
    document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && modal.open) closeModal(); });
    $('#modalFav').addEventListener('click', () => { if (state.modal.prompt) toggleFav(state.modal.prompt.id); });
    $('#modalCopy').addEventListener('click', async () => {
      const p = state.modal.prompt;
      if (p && (await copyText(p.variants[state.modal.variant].text))) toast(window.t('copied'));
    });
    $('#modalShare').addEventListener('click', async () => {
      const p = state.modal.prompt;
      if (!p) return;
      /* share the per-prompt page: real OG preview in messengers, redirects to #p<id> */
      const base = (location.origin + location.pathname).replace(/index\.html$/, '');
      const url = base + 'p/' + p.id + '/';
      const shareData = { title: 'Promptopia — ' + title(p), url };
      if (navigator.share) {
        try { await navigator.share(shareData); return; } catch { /* fall through */ }
      }
      if (await copyText(url)) toast(window.t('linkCopied'));
    });

    // back-to-top button
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

  /* ---------- hero stats & marquee ---------- */
  function renderStats() {
    const cats = catList().length;
    $('#heroStats').innerHTML = `
      <div class="stat"><b>${fmt(DATA.length)}</b><span>${esc(window.t('statPrompts'))}</span></div>
      <div class="stat"><b>${fmt(cats)}</b><span>${esc(window.t('statCats'))}</span></div>
      <div class="stat"><b>${esc(window.t('statFreeVal'))}</b><span>${esc(window.t('statFree'))}</span></div>`;
  }
  /* Showcase marquee: infinite auto-scroll that pauses on hover/touch and can be
     dragged (mouse or touch) or scrolled left/right with the wheel. Two identical
     copies are rendered and the offset wraps around half the strip width, so the
     loop is seamless even while images are still loading. */
  function initMarquee() {
    const marquee = $('#marquee');
    if (!marquee) return;
    const picks = DATA.slice(0, 14);
    const imgs = picks.map((p) => `<img src="${p.img}" alt="" decoding="async" draggable="false">`).join('');
    marquee.innerHTML = imgs + imgs; // duplicate for seamless loop

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canHover = window.matchMedia('(hover: hover)').matches;
    const SPEED = 0.05; // px per ms (~3px per frame at 60fps)

    const M = {
      x: 0, half: 0,
      paused: false, hover: false,
      pointers: new Set(), drag: null,
      raf: null, last: null,
    };

    function wrap() {
      if (M.half <= 0) return;
      while (M.x <= -M.half) M.x += M.half;
      while (M.x > 0) M.x -= M.half;
    }
    function render() { marquee.style.transform = `translateX(${M.x}px)`; }
    function measure() {
      M.half = marquee.scrollWidth / 2; // width of one copy = loop distance
      wrap();
    }
    function setPaused(p) { M.paused = p; marquee.classList.toggle('paused', p); }
    function updatePause() { setPaused(M.hover || M.pointers.size > 0); }

    function frame(ts) {
      M.raf = requestAnimationFrame(frame);
      if (M.last == null) M.last = ts;
      const dt = ts - M.last;
      M.last = ts;
      if (dt > 100) return; // tab was hidden -> don't jump ahead
      if (M.paused || M.drag || reduceMotion) return;
      M.x -= SPEED * dt;
      wrap();
      render();
    }

    // pause while hovered (mouse devices only, so touch never gets stuck)
    if (canHover) {
      marquee.addEventListener('mouseenter', () => { M.hover = true; updatePause(); });
      marquee.addEventListener('mouseleave', () => { M.hover = false; updatePause(); });
    }

    // wheel -> horizontal scroll (prevents the page from scrolling over the strip)
    marquee.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      M.x -= ev.deltaY + ev.deltaX;
      wrap();
      render();
    }, { passive: false });

    // drag with mouse or touch
    marquee.addEventListener('pointerdown', (ev) => {
      M.drag = { id: ev.pointerId, startX: ev.clientX, startOffset: M.x };
      M.pointers.add(ev.pointerId);
      try { marquee.setPointerCapture(ev.pointerId); } catch { /* noop */ }
      marquee.classList.add('dragging');
      updatePause();
    });
    marquee.addEventListener('pointermove', (ev) => {
      if (!M.drag || M.drag.id !== ev.pointerId) return;
      M.x = M.drag.startOffset + (ev.clientX - M.drag.startX);
      wrap();
      render();
    });
    const endDrag = (ev) => {
      if (!M.drag || M.drag.id !== ev.pointerId) return;
      M.drag = null;
      M.pointers.delete(ev.pointerId);
      marquee.classList.remove('dragging');
      if (marquee.hasPointerCapture && marquee.hasPointerCapture(ev.pointerId)) {
        try { marquee.releasePointerCapture(ev.pointerId); } catch { /* noop */ }
      }
      updatePause();
    };
    marquee.addEventListener('pointerup', endDrag);
    marquee.addEventListener('pointercancel', endDrag);

    // keep the loop distance accurate while images/layout settle
    window.addEventListener('resize', measure, { passive: true });
    $$('img', marquee).forEach((img) => {
      if (img.complete && img.naturalWidth) measure();
      else img.addEventListener('load', measure, { once: true });
    });

    measure();
    if (reduceMotion) render(); // static, still draggable/scrollable
    else M.raf = requestAnimationFrame(frame);
  }

  /* ---------- scroll reveal ---------- */
  function initReveal() {
    $$('[data-reveal]').forEach((el) => revealer.observe(el));
  }

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
  initMarquee();
  initReveal();
  registerSW();

  // deep-links: #p<id> opens the modal, #page-N jumps to a gallery page
  function applyHash() {
    const pageMatch = /^#page-(\d+)$/.exec(location.hash);
    if (pageMatch) {
      const n = Math.max(1, Number(pageMatch[1]));
      if (n !== state.page) {
        state.page = n;
        renderGrid();
        pulseGrid();
        $('#gallery').scrollIntoView({ behavior: 'auto', block: 'start' });
      }
      return;
    }
    const pm = /^#p(\d+)$/.exec(location.hash);
    if (pm && modal.open !== true) openModal(Number(pm[1]), true);
  }
  window.addEventListener('hashchange', applyHash);
  applyHash();
})();
