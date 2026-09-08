/* Zero-dependency PNG generator for og:image share cards.
   Encodes PNG manually (node:zlib) and draws with a built-in 5x7
   bitmap font — no native modules, works everywhere node runs. */
import zlib from 'node:zlib';

/* ---------- color helpers ---------- */
const hex = (c) => {
  const s = c.replace('#', '');
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
};
const mix = (a, b, t) => [
  Math.round(a[0] + (b[0] - a[0]) * t),
  Math.round(a[1] + (b[1] - a[1]) * t),
  Math.round(a[2] + (b[2] - a[2]) * t),
];

/* ---------- 5x7 bitmap font (A-Z a-z 0-9 punctuation) ---------- */
/* Each glyph: 5 columns x 7 rows, bit 0x80..0x01 left→right. */
const F = {
  A: [0x7c,0x12,0x11,0x12,0x7c], B: [0xfe,0x91,0x91,0x91,0x6e], C: [0x7c,0x82,0x82,0x82,0x44],
  D: [0xfe,0x82,0x82,0x44,0x38], E: [0xfe,0x91,0x91,0x91,0x82], F: [0xfe,0x90,0x90,0x90,0x80],
  G: [0x7c,0x82,0x92,0x92,0x74], H: [0xfe,0x10,0x10,0x10,0xfe], I: [0x82,0xfe,0x82,0x00,0x00],
  J: [0x30,0x48,0x82,0xfe,0x02], K: [0xfe,0x10,0x28,0x44,0x82], L: [0xfe,0x02,0x02,0x02,0x02],
  M: [0xfe,0x40,0x20,0x40,0xfe], N: [0xfe,0x20,0x10,0x08,0xfe], O: [0x7c,0x82,0x82,0x82,0x7c],
  P: [0xfe,0x90,0x90,0x90,0x60], Q: [0x7c,0x82,0x8a,0x84,0x7a], R: [0xfe,0x90,0x98,0x94,0x62],
  S: [0x62,0x91,0x91,0x91,0x8e], T: [0x80,0x80,0xfe,0x80,0x80], U: [0xfc,0x02,0x02,0x02,0xfc],
  V: [0xf8,0x04,0x02,0x04,0xf8], W: [0xfe,0x08,0x10,0x08,0xfe], X: [0xc6,0x28,0x10,0x28,0xc6],
  Y: [0xe0,0x10,0x0e,0x10,0xe0], Z: [0x86,0x8a,0x92,0xa2,0xc2],
  '0': [0x7c,0xa2,0x92,0x8a,0x7c], '1': [0x08,0x18,0x08,0x08,0x3e], '2': [0x3e,0x42,0x32,0x0e,0x02],
  '3': [0x24,0x82,0x92,0x92,0x6c], '4': [0x18,0x28,0x48,0xfe,0x08], '5': [0xe4,0x92,0x92,0x92,0x7c],
  '6': [0x7c,0x92,0x92,0x92,0x64], '7': [0x02,0xc2,0x32,0x0a,0x06], '8': [0x6c,0x92,0x92,0x92,0x6c],
  '9': [0x3c,0x92,0x92,0x92,0x74],
  ' ': [0,0,0,0,0], '.': [0,0x60,0x60,0,0], ',': [0,0,0x20,0x40,0x20], '-': [0x10,0x10,0x10,0x10,0x10],
  '&': [0x6c,0x92,0x6c,0x24,0x58], '!': [0x7e,0,0,0,0], '?': [0x3e,0x42,0x30,0,0x20],
  ':': [0,0x24,0x24,0,0], '+': [0x10,0x10,0x7c,0x10,0x10], '/': [0x04,0x08,0x10,0x20,0x40],
  '(': [0x20,0x40,0x80,0x40,0x20], ')': [0x08,0x04,0x02,0x04,0x08], "'": [0x20,0x40,0,0,0],
  '"': [0x50,0xa0,0,0,0], '%': [0x88,0x14,0x28,0x50,0x22], '#': [0x28,0x7c,0x28,0x7c,0x28],
  '*': [0,0x44,0x28,0x54,0x10],
};
/* latin-1 fallback → ascii, so titles like "Café" or "—" still render */
const TRANS = { '—': '-', '–': '-', '’': "'", '‘': "'", '“': '"', '”': '"', '…': '.', 'é': 'e', 'è': 'e', 'à': 'a', 'ü': 'u', 'ö': 'o', 'ä': 'a' };

const glyph = (ch) => F[ch.toUpperCase()] || F[TRANS[ch]] || F['?'];

/* ---------- canvas ---------- */
export class PngCanvas {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.px = Buffer.alloc(w * h * 3, 0);
  }
  set(x, y, [r, g, b]) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 3;
    this.px[i] = r; this.px[i + 1] = g; this.px[i + 2] = b;
  }
  /* vertical + radial-ish gradient: color stops top→bottom, softened by a center glow */
  gradient(stops, glow) {
    const g = glow ? hex(glow.color) : null;
    for (let y = 0; y < this.h; y++) {
      const t = y / (this.h - 1);
      const seg = Math.min(stops.length - 2, Math.floor(t * (stops.length - 1)));
      const local = (t - seg / (stops.length - 1)) * (stops.length - 1);
      const c = mix(hex(stops[seg]), hex(stops[seg + 1]), Math.max(0, Math.min(1, local)));
      for (let x = 0; x < this.w; x++) {
        let col = c;
        if (g) {
          const dx = (x / this.w - glow.x) * (this.w / this.h);
          const dy = y / this.h - glow.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          const k = Math.max(0, 1 - d / glow.r) * glow.a;
          col = mix(col, g, k);
        }
        this.set(x, y, col);
      }
    }
  }
  roundRect(x0, y0, w, h, rad, color, alpha = 1) {
    const c = hex(color);
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const dx = x < x0 + rad ? x0 + rad - x : x > x0 + w - rad - 1 ? x - (x0 + w - rad - 1) : 0;
        const dy = y < y0 + rad ? y0 + rad - y : y > y0 + h - rad - 1 ? y - (y0 + h - rad - 1) : 0;
        if (dx * dx + dy * dy > rad * rad) continue;
        const i = (y * this.w + x) * 3;
        this.px[i] = Math.round(this.px[i] * (1 - alpha) + c[0] * alpha);
        this.px[i + 1] = Math.round(this.px[i + 1] * (1 - alpha) + c[1] * alpha);
        this.px[i + 2] = Math.round(this.px[i + 2] * (1 - alpha) + c[2] * alpha);
      }
    }
  }
  /* scale=1 → 5x7 px per glyph, 1px spacing. returns end x */
  text(str, x, y, { scale = 2, color = '#ffffff', alpha = 1, spacing = 1 } = {}) {
    const c = hex(color);
    let cx = x;
    for (const raw of String(str)) {
      const g = glyph(raw);
      const gw = 5 * scale;
      for (let col = 0; col < 5; col++) {
        const bits = g[col];
        for (let row = 0; row < 7; row++) {
          if (bits & (1 << (6 - row))) {
            for (let sx = 0; sx < scale; sx++) for (let sy = 0; sy < scale; sy++) {
              const px = cx + col * scale + sx, py = y + row * scale + sy;
              const i = (py * this.w + px) * 3;
              if (px < 0 || py < 0 || px >= this.w || py >= this.h) continue;
              this.px[i] = Math.round(this.px[i] * (1 - alpha) + c[0] * alpha);
              this.px[i + 1] = Math.round(this.px[i + 1] * (1 - alpha) + c[1] * alpha);
              this.px[i + 2] = Math.round(this.px[i + 2] * (1 - alpha) + c[2] * alpha);
            }
          }
        }
      }
      cx += gw + scale * spacing;
    }
    return cx;
  }
  measure(str, scale = 2, spacing = 1) {
    return String(str).length * (5 * scale + scale * spacing) - scale * spacing;
  }
  /* word-wrapped text; returns lines used */
  wrapText(str, x, y, maxW, { scale = 2, color = '#ffffff', alpha = 1, lineH = null, maxLines = 4 } = {}) {
    const lh = lineH || Math.ceil(scale * 7 * 1.5);
    const clean = String(str).replace(/[\u0600-\u06FF\u200c]+/g, '').replace(/\s+/g, ' ').trim();
    const words = clean.split(' ').filter(Boolean);
    const lines = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (this.measure(t, scale) <= maxW) line = t;
      else { if (line) lines.push(line); line = w; if (lines.length === maxLines) break; }
    }
    if (lines.length < maxLines && line) lines.push(line);
    if (lines.length === maxLines && (line || words.length)) {
      let last = lines[maxLines - 1] || '';
      if (this.measure(last + '...', scale) <= maxW) lines[maxLines - 1] = last + '...';
    }
    lines.forEach((l, i) => this.text(l, x, y + i * lh, { scale, color, alpha }));
    return lines.length;
  }
  toPNG() {
    const { w, h, px } = this;
    const raw = Buffer.alloc((w * 3 + 1) * h);
    for (let y = 0; y < h; y++) {
      raw[y * (w * 3 + 1)] = 0; /* filter: none */
      px.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3);
    }
    const idat = zlib.deflateSync(raw, { level: 9 });
    const chunk = (type, data) => {
      const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
      const t = Buffer.from(type, 'ascii');
      const crcBuf = Buffer.concat([t, data]);
      const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf) >>> 0);
      return Buffer.concat([len, t, data, crc]);
    };
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = 2; /* 8-bit truecolor */
    return Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      chunk('IHDR', ihdr),
      chunk('IDAT', idat),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }
}

/* crc32 for PNG chunks */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ 0xffffffff;
}
