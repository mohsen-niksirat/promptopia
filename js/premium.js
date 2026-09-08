/* Promptopia premium layer.
   - Verifies signed activation codes (ECDSA P-256, offline, unforgeable)
     against the public key embedded below.
   - Keeps the unlock in localStorage ('premium-until' unix seconds).
   - ZarinPal-ready: set PAYMENT.zarinpal.merchantId and the redirect in
     PAYMENT.startPurchase() once you create the merchant account. The
     success page flow calls PromptopiaPremium.grant(days) with the
     signed code your payment backend issues. */
(function () {
  'use strict';

  /* ECDSA P-256 public key (tools/gen-code.mjs prints the matching one) */
  const PUBLIC_JWK = { kty: 'EC', crv: 'P-256', x: '50TC4p3tcRQdANQkbicIRCBjOnGCTLiIavsHHB9BUa0', y: 'DUhHfeA14vcEmAgwpQor-EsbAD4qHxoRZ1tYOT6D_ZQ' };

  const PAYMENT = {
    /* ZarinPal: create a merchant at zarinpal.com, paste the 36-char id here */
    zarinpal: {
      merchantId: '',           // e.g. 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
      amountToman: 99000,
      description: 'پکیج ویژه پرامپتوپیا — دسترسی به همه پرامپت‌های ویژه',
      callbackUrl: 'https://mohsen-niksirat.github.io/promptopia/premium-thanks.html',
      gateway: 'https://pay.zarinpal.com/paymentgateways',
    },
    /* fallback contact for manual sales (Telegram) */
    telegram: 'https://t.me/mohsenniksirat',
  };

  const LS_KEY = 'premium-until';

  function unlockedUntil() { return Number(localStorage.getItem(LS_KEY) || 0); }
  function isUnlocked() { return unlockedUntil() > Date.now() / 1000; }
  function daysLeft() { return Math.max(0, Math.ceil((unlockedUntil() - Date.now() / 1000) / 86400)); }

  async function verifyCode(code) {
    const m = /^PRO\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/.exec(String(code || '').trim());
    if (!m) return { ok: false, reason: 'format' };
    const [, payloadB64, sigB64] = m;
    let sig, payloadBytes;
    try {
      sig = base64urlToBytes(sigB64);
      payloadBytes = base64urlToBytes(payloadB64);
    } catch {
      return { ok: false, reason: 'format' };
    }
    const key = await crypto.subtle.importKey(
      'jwk', PUBLIC_JWK, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']
    );
    let okSig = false;
    try {
      okSig = await crypto.subtle.verify(
        { name: 'ECDSA', hash: 'SHA-256' }, key, sig, new TextEncoder().encode(payloadB64)
      );
    } catch {
      return { ok: false, reason: 'signature' };
    }
    if (!okSig) return { ok: false, reason: 'signature' };
    let payload;
    try { payload = JSON.parse(new TextDecoder().decode(payloadBytes)); }
    catch { return { ok: false, reason: 'payload' }; }
    if (payload.v !== 1) return { ok: false, reason: 'version' };
    if (!payload.e || payload.e < Date.now() / 1000) return { ok: false, reason: 'expired' };
    return { ok: true, exp: payload.e };
  }

  async function activate(code) {
    const res = await verifyCode(code);
    if (!res.ok) return res;
    const prev = Math.max(unlockedUntil(), Date.now() / 1000);
    localStorage.setItem(LS_KEY, String(Math.max(prev, res.exp)));
    return res;
  }

  function revoke() { localStorage.removeItem(LS_KEY); }

  function base64urlToBytes(s) {
    s = s.replace(/-/g, '+').replace(/_/g, '/');
    while (s.length % 4) s += '=';
    const bin = atob(s);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  /* ZarinPal starter: opens the payment gateway in a new tab.
     (Payment confirmation + code issuance must happen on your backend /
     payment-bot; grant() is what it calls at the end.) */
  function startPurchase() {
    const z = PAYMENT.zarinpal;
    if (!z.merchantId) {
      return { ok: false, fallback: PAYMENT.telegram };
    }
    const q = new URLSearchParams({
      merchant_id: z.merchantId,
      amount: String(z.amountToman * 10), /* rial */
      description: z.description,
      callback_url: z.callbackUrl,
    });
    window.open('https://api.zarinpal.com/pg/v4/payment/pay.json?' + q.toString(), '_blank', 'noopener');
    return { ok: true };
  }

  window.PromptopiaPremium = { isUnlocked, daysLeft, verifyCode, activate, revoke, startPurchase, PAYMENT };
})();
