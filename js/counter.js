/* Promptopia copy counter — privacy-friendly popularity signal.
   - Always increments localStorage counts (works offline, no network needed).
   - If COUNTER.endpoint is set, sends a beacon { id } (a number — nothing
     else, no cookies, no fingerprinting) so a tiny worker/function can
     aggregate global "most copied" stats. Point it at e.g. a Cloudflare
     Worker with KV, or GoatCounter's pixel API. */
(function () {
  'use strict';
  const COUNTER = {
    endpoint: '', // e.g. 'https://promptopia-stats.workers.dev/copy'
  };

  const LS_KEY = 'copy-counts';
  let counts = {};
  try { counts = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch { counts = {}; }

  function bump(id) {
    counts[id] = (counts[id] || 0) + 1;
    try { localStorage.setItem(LS_KEY, JSON.stringify(counts)); } catch { /* quota */ }
    if (COUNTER.endpoint && navigator.sendBeacon) {
      try { navigator.sendBeacon(COUNTER.endpoint, JSON.stringify({ id })); } catch { /* noop */ }
    }
  }

  /* local top list — used for the "popular" sort until global stats exist */
  function top(n) {
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n || 20)
      .map(([id, c]) => ({ id: Number(id), count: c }));
  }

  window.PromptopiaCounter = { bump, top, COUNTER };
})();
