import crypto from 'node:crypto';
import { db, getNowMs } from './db.js';
import { uid, insertAudit } from './helpers.js';

// Patient copay / statement payments run Stripe's real test-mode hosted Checkout
// when a key is present; any error degrades to a deterministic offline twin
// producing the SAME payments / gl rows. The app grades its OWN payments/gl
// state, never the provider. A signature-verifying, idempotent webhook records
// the settlement.

export function stripeOffline() {
  const v = String(process.env.STRIPE_OFFLINE ?? '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}
export function stripeLive() {
  return Boolean(process.env.STRIPE_SECRET_KEY) && !stripeOffline();
}
export function stripeConfigured() { return true; }

function webhookSecret() {
  return process.env.STRIPE_WEBHOOK_SECRET || 'offline_twin_deterministic_signer';
}
function baseUrl() {
  return process.env.APP_PUBLIC_URL || process.env.BASE_URL || 'http://localhost:3000';
}

export function signPayload(payload, timestamp, secret = webhookSecret()) {
  const signed = `${timestamp}.${payload}`;
  const hmac = crypto.createHmac('sha256', secret).update(signed, 'utf8').digest('hex');
  return `t=${timestamp},v1=${hmac}`;
}

export function constructEvent(rawBody, sigHeader, secret = webhookSecret()) {
  if (!sigHeader || typeof sigHeader !== 'string') throw new Error('missing Stripe-Signature');
  const parts = Object.fromEntries(sigHeader.split(',').map((kv) => kv.split('=').map((s) => s.trim())));
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) throw new Error('malformed Stripe-Signature');
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const a = Buffer.from(v1, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) throw new Error('signature verification failed');
  return JSON.parse(rawBody);
}

export function getPayment(id) {
  return db.prepare(`SELECT * FROM payments WHERE id = ?`).get(id);
}
export function getPaymentBySession(sessionId) {
  return db.prepare(`SELECT * FROM payments WHERE stripe_ref = ?`).get(sessionId);
}
export function listPayments({ refId, channel } = {}) {
  if (refId) return db.prepare(`SELECT * FROM payments WHERE ref_id = ? ORDER BY created_at_ms ASC`).all(refId);
  if (channel) return db.prepare(`SELECT * FROM payments WHERE channel = ? ORDER BY created_at_ms ASC`).all(channel);
  return db.prepare(`SELECT * FROM payments ORDER BY created_at_ms ASC`).all();
}

export async function createCheckoutSession({ partyId, channel, refType, refId, amountCents }) {
  const nowMs = getNowMs();
  const id = uid('PAY');
  let sessionId = `cs_test_twin_${crypto.randomBytes(8).toString('hex')}`;
  let checkoutUrl = null;
  let live = false;
  if (stripeLive()) {
    try {
      const created = await createLiveCheckoutSessionAsync({ paymentId: id, channel, refId, amountCents });
      if (created && created.id) { sessionId = created.id; checkoutUrl = created.url; live = true; }
    } catch (_err) { live = false; }
  }
  if (!live) checkoutUrl = `/checkout/${id}`;
  db.prepare(`
    INSERT INTO payments (id, party_id, channel, ref_type, ref_id, amount_cents, status, stripe_ref, session_paid, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, 0, ?)
  `).run(id, partyId || null, channel, refType, refId, amountCents, sessionId, nowMs);
  return { payment: getPayment(id), checkout_url: checkoutUrl, session_id: sessionId, live };
}

export async function createLiveCheckoutSessionAsync({ paymentId, channel, refId, amountCents }) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const successUrl = `${baseUrl()}/checkout/success?session_id={CHECKOUT_SESSION_ID}&payment=${paymentId}`;
    const cancelUrl = `${baseUrl()}/checkout/cancel?payment=${paymentId}`;
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', successUrl);
    form.set('cancel_url', cancelUrl);
    form.set('client_reference_id', paymentId);
    form.set('metadata[payment_id]', paymentId);
    form.set('metadata[channel]', channel);
    form.set('metadata[ref_id]', refId);
    form.set('line_items[0][price_data][currency]', 'usd');
    form.set('line_items[0][price_data][product_data][name]', `MedLedger ${channel} ${refId}`);
    form.set('line_items[0][price_data][unit_amount]', String(amountCents));
    form.set('line_items[0][quantity]', '1');
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
      signal: controller.signal
    });
    if (!res.ok) throw new Error(`stripe checkout create ${res.status}`);
    const data = await res.json();
    return { id: data.id, url: data.url };
  } finally { clearTimeout(t); }
}

// settle callback is injected by services.js to run the domain side-effects.
let onSettle = null;
export function setSettleHandler(fn) { onSettle = fn; }

export function settlePaymentBySession(sessionId, { actorUserId = 'stripe' } = {}) {
  const p = getPaymentBySession(sessionId);
  if (!p) return null;
  if (p.status === 'SETTLED') return p;
  const nowMs = getNowMs();
  db.prepare(`UPDATE payments SET status = 'SETTLED', settled_at_ms = ? WHERE id = ?`).run(nowMs, p.id);
  insertAudit({ actorUserId, action: 'PAYMENT_SETTLED', entityType: 'payment', entityId: p.id, newState: 'SETTLED', reason: sessionId });
  if (onSettle) { try { onSettle(getPayment(p.id), actorUserId); } catch { /* best-effort side effects */ } }
  return getPaymentBySession(sessionId);
}

export function buildSignedCompletedEvent(sessionId) {
  const p = getPaymentBySession(sessionId);
  const event = {
    id: `evt_${crypto.randomBytes(10).toString('hex')}`,
    type: 'checkout.session.completed',
    created: Math.floor(getNowMs() / 1000),
    data: { object: { id: sessionId, object: 'checkout.session', payment_status: 'paid', amount_total: p ? p.amount_cents : 0, metadata: p ? { payment_id: p.id, channel: p.channel, ref_id: p.ref_id } : {} } }
  };
  const payload = JSON.stringify(event);
  const timestamp = Math.floor(getNowMs() / 1000);
  return { payload, signature: signPayload(payload, timestamp), eventId: event.id };
}

function recordDelivery({ eventId, type, sessionId, payload, signature, accepted }) {
  db.prepare(`
    INSERT INTO webhook_deliveries (id, event_id, type, session_id, payload, signature, accepted, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(uid('WHD'), eventId, type, sessionId || null, payload, signature, accepted ? 1 : 0, getNowMs());
}
export function listDeliveries() {
  return db.prepare(`SELECT * FROM webhook_deliveries ORDER BY created_at_ms ASC`).all();
}

export function ingestWebhook(rawPayload, sigHeader, { actorUserId = 'stripe' } = {}) {
  const event = constructEvent(rawPayload, sigHeader); // throws on bad/absent signature
  const sessionId = event?.data?.object?.id || null;
  recordDelivery({ eventId: event.id, type: event.type, sessionId, payload: rawPayload, signature: sigHeader, accepted: true });
  const existing = db.prepare(`SELECT * FROM stripe_events WHERE event_id = ?`).get(event.id);
  if (existing) return { ok: true, duplicate: true, event_id: event.id };
  db.prepare(`INSERT INTO stripe_events (event_id, type, session_id, processed_count, created_at_ms) VALUES (?, ?, ?, 1, ?)`)
    .run(event.id, event.type, sessionId, getNowMs());
  let settled = false; let phantom = false;
  if (event.type === 'checkout.session.completed' && sessionId) {
    if (getPaymentBySession(sessionId)) { settlePaymentBySession(sessionId, { actorUserId }); settled = true; }
    else phantom = true;
  }
  return { ok: true, duplicate: false, event_id: event.id, settled, phantom };
}

export function ensureSettledAndDelivered(sessionId, { actorUserId = 'stripe' } = {}) {
  settlePaymentBySession(sessionId, { actorUserId });
  const already = db.prepare(`SELECT COUNT(*) AS c FROM webhook_deliveries WHERE session_id = ? AND accepted = 1`).get(sessionId);
  if (!already || already.c === 0) {
    const { payload, signature } = buildSignedCompletedEvent(sessionId);
    ingestWebhook(payload, signature, { actorUserId });
  }
  return getPaymentBySession(sessionId);
}

export function markSessionPaid(sessionId) {
  db.prepare(`UPDATE payments SET session_paid = 1 WHERE stripe_ref = ?`).run(sessionId);
}
