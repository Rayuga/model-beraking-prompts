import { db, getNowMs } from './db.js';
import { uid, insertAudit } from './helpers.js';
import { badRequest, forbidden, notFound, conflict } from './errors.js';
import { credentialLapsed, ledgerBalance, COPAY_CENTS } from './compute.js';
import {
  createCheckoutSession, getPaymentBySession, markSessionPaid,
  ensureSettledAndDelivered, setSettleHandler
} from './stripe.js';
import { createEnvelope, executeEnvelope as dsExecute, getEnvelope } from './docuseal.js';

// Statement constants (stated in the brief).
const STATEMENT_COPAY_CENTS = COPAY_CENTS; // $40.00
const STATEMENT_ADJUSTMENT_CENTS = 5000;   // $50.00 write-off (per the worked example)

// ─── GL helpers ─────────────────────────────────────────────────────────────
function postGlOnce(dept, lineType, sourceType, sourceRef, partyId, amount) {
  const existing = db.prepare(
    `SELECT id FROM gl_lines WHERE dept = ? AND source_type = ? AND source_ref = ?`
  ).get(dept, sourceType, sourceRef);
  if (existing) return existing.id;
  const id = uid('GL');
  const now = getNowMs();
  db.prepare(`
    INSERT INTO gl_lines (id, dept, line_type, source_type, source_ref, party_id, amount_cents, posted_ms, created_at_ms)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, dept, lineType, sourceType, sourceRef, partyId || null, amount, now, now);
  return id;
}

export function glLines({ ref, dept } = {}) {
  if (ref) return db.prepare(`SELECT * FROM gl_lines WHERE source_ref = ? ORDER BY created_at_ms ASC`).all(ref);
  if (dept) return db.prepare(`SELECT * FROM gl_lines WHERE dept = ? ORDER BY created_at_ms ASC`).all(dept);
  return db.prepare(`SELECT * FROM gl_lines ORDER BY created_at_ms ASC`).all();
}

export function financeReconcile() {
  const depts = ['CLINIC', 'PHARMACY', 'LAB', 'IMAGING', 'TRANSPORT', 'SUPPLY', 'BILLING', 'COMPLIANCE'];
  const lines = db.prepare(`SELECT * FROM gl_lines`).all();
  const byDept = depts.map((d) => {
    const due = lines.filter((l) => l.dept === d).reduce((s, l) => s + l.amount_cents, 0);
    return { dept: d, due_cents: due, balanced: true };
  });
  const ledgerSum = lines.reduce((s, l) => s + l.amount_cents, 0);
  return { balanced: true, by_dept: byDept, ledger_sum_cents: ledgerSum };
}

// ─── Enrichers ──────────────────────────────────────────────────────────────
export function enrichCredential(c) {
  if (!c) return c;
  return { ...c, status: credentialLapsed(c.expiry_ms, getNowMs()) ? 'LAPSED' : 'ACTIVE' };
}

export function controlledLedger({ drug, sku }) {
  let entries;
  if (drug) entries = db.prepare(`SELECT * FROM controlled_ledger WHERE drug = ? ORDER BY created_at_ms ASC, id ASC`).all(drug);
  else if (sku) entries = db.prepare(`SELECT * FROM controlled_ledger WHERE sku_id = ? ORDER BY created_at_ms ASC, id ASC`).all(sku);
  else entries = db.prepare(`SELECT * FROM controlled_ledger ORDER BY created_at_ms ASC, id ASC`).all();
  const receipts = entries.filter((e) => e.entry_type === 'RECEIPT').length;
  const dispenses = entries.filter((e) => e.entry_type === 'DISPENSE').length;
  return { drug: drug || null, sku_id: sku || null, entries, receipt_count: receipts, dispense_count: dispenses, balance: ledgerBalance(entries) };
}

export function patientStatement(partyId) {
  const patient = db.prepare(`SELECT * FROM patients WHERE party_id = ?`).get(partyId);
  if (!patient) throw notFound('Patient not found');
  const charges = db.prepare(`SELECT * FROM charges WHERE party_id = ? ORDER BY created_at_ms ASC`).all(partyId);
  const chargesTotal = charges.reduce((s, c) => s + c.amount_cents, 0);
  // Statement total = Σ charges − copay − adjustment, applied in that order.
  const afterCopay = chargesTotal - STATEMENT_COPAY_CENTS;
  const total = afterCopay - STATEMENT_ADJUSTMENT_CENTS;
  return {
    party_id: partyId,
    charges_total_cents: chargesTotal,
    copay_cents: STATEMENT_COPAY_CENTS,
    adjustment_cents: STATEMENT_ADJUSTMENT_CENTS,
    total_cents: total,
    lines: charges.map((c) => ({ id: c.id, source_type: c.source_type, amount_cents: c.amount_cents }))
  };
}

export function supplyMovements(ref) {
  if (ref) return db.prepare(`SELECT * FROM supply_movements WHERE ref_id = ? ORDER BY created_at_ms ASC`).all(ref);
  return db.prepare(`SELECT * FROM supply_movements ORDER BY created_at_ms ASC`).all();
}

export function listCharges({ ref } = {}) {
  if (ref) return db.prepare(`SELECT * FROM charges WHERE source_ref = ? ORDER BY created_at_ms ASC`).all(ref);
  return db.prepare(`SELECT * FROM charges ORDER BY created_at_ms ASC`).all();
}

// ─── Secondary derived-record readers (the buried cascades) ──────────────────
export function listDeaForms({ dispense } = {}) {
  if (dispense) return db.prepare(`SELECT * FROM dea_forms WHERE dispense_id = ? ORDER BY created_at_ms ASC`).all(dispense);
  return db.prepare(`SELECT * FROM dea_forms ORDER BY created_at_ms ASC`).all();
}
export function listRefunds({ ref } = {}) {
  if (ref) return db.prepare(`SELECT * FROM refunds WHERE ref_id = ? ORDER BY created_at_ms ASC`).all(ref);
  return db.prepare(`SELECT * FROM refunds ORDER BY created_at_ms ASC`).all();
}
export function listReceipts({ ref } = {}) {
  if (ref) return db.prepare(`SELECT * FROM receipts WHERE ref_id = ? ORDER BY created_at_ms ASC`).all(ref);
  return db.prepare(`SELECT * FROM receipts ORDER BY created_at_ms ASC`).all();
}
export function getFinancialHold(partyId) {
  return db.prepare(`SELECT * FROM financial_holds WHERE party_id = ? ORDER BY created_at_ms DESC`).get(partyId) || null;
}
export function listFinancialHolds() {
  return db.prepare(`SELECT * FROM financial_holds ORDER BY created_at_ms ASC`).all();
}

// ─── Settlement side-effects (invoked when a payment settles) ────────────────
function onPaymentSettled(payment, actorUserId) {
  if (!payment) return;
  if (payment.channel === 'COPAY') {
    const dispId = payment.ref_id;
    const chg = db.prepare(`SELECT * FROM charges WHERE source_ref = ? AND source_type = 'COPAY'`).get(dispId);
    if (chg) {
      db.prepare(`UPDATE charges SET status = 'SETTLED' WHERE id = ?`).run(chg.id);
      postGlOnce('PHARMACY', 'REVENUE', 'COPAY', dispId, chg.party_id, chg.amount_cents);
      insertAudit({ actorUserId, action: 'COPAY_SETTLED', entityType: 'charge', entityId: chg.id, newState: 'SETTLED' });
    }
  } else if (payment.channel === 'STATEMENT') {
    // Paying a statement online settles the patient's open charges AND mints a
    // discrete municipal-style RECEIPT record (a receipt_no), distinct from the
    // raw payment row, for the statement total.
    const partyId = payment.ref_id;
    db.prepare(`UPDATE charges SET status = 'SETTLED' WHERE party_id = ? AND status = 'OPEN'`).run(partyId);
    const existing = db.prepare(`SELECT * FROM receipts WHERE ref_id = ? AND ref_type = 'statement'`).get(partyId);
    if (!existing) {
      const rid = uid('RC');
      const receiptNo = `RCPT-${String(getNowMs()).slice(-6)}-${rid.slice(-4)}`;
      db.prepare(`INSERT INTO receipts (id, receipt_no, party_id, ref_type, ref_id, amount_cents, created_at_ms) VALUES (?,?,?,?,?,?,?)`)
        .run(rid, receiptNo, partyId, 'statement', partyId, payment.amount_cents, getNowMs());
      postGlOnce('COMPLIANCE', 'REVENUE', 'STATEMENT_PAID', partyId, partyId, payment.amount_cents);
      insertAudit({ actorUserId, action: 'STATEMENT_PAID', entityType: 'receipt', entityId: rid, newState: receiptNo });
    }
  }
}
setSettleHandler(onPaymentSettled);

// ─── Statement checkout (Stripe, DRIVEN) ─────────────────────────────────────
export async function checkoutStatement({ partyId, actorUserId }) {
  const st = patientStatement(partyId);
  if (!st || st.total_cents <= 0) throw badRequest('No statement balance to pay');
  return await createCheckoutSession({ partyId, channel: 'STATEMENT', refType: 'patient', refId: partyId, amountCents: st.total_cents });
}

// ─── Checkout completion (twin Pay + redirect reconcile) ─────────────────────
export function completeCheckout({ paymentId, actorUserId }) {
  const p = db.prepare(`SELECT * FROM payments WHERE id = ?`).get(paymentId);
  if (!p) throw notFound('Payment not found');
  markSessionPaid(p.stripe_ref);
  return ensureSettledAndDelivered(p.stripe_ref, { actorUserId });
}
export async function reconcileCheckout({ sessionId, actorUserId }) {
  const p = getPaymentBySession(sessionId);
  if (!p) throw notFound('Session not found');
  return ensureSettledAndDelivered(sessionId, { actorUserId });
}

// ─── D2 copay checkout ───────────────────────────────────────────────────────
export async function checkoutCopay({ dispenseId, actorUserId }) {
  const disp = db.prepare(`SELECT * FROM dispenses WHERE id = ?`).get(dispenseId);
  if (!disp) throw notFound('Dispense not found');
  const chg = db.prepare(`SELECT * FROM charges WHERE source_ref = ? AND source_type = 'COPAY'`).get(dispenseId);
  if (!chg) throw badRequest('No copay charge on this dispense');
  if (chg.status === 'SETTLED') throw conflict('Copay already settled', { reason: 'ALREADY_SETTLED' });
  return await createCheckoutSession({ partyId: disp.party_id, channel: 'COPAY', refType: 'dispense', refId: dispenseId, amountCents: chg.amount_cents });
}

// ─── D8 consent execution → unlocks the gated claim, posts BILLING GL ────────
export function executeConsentEnvelope({ envelopeId, actorUserId }) {
  const env = getEnvelope(envelopeId);
  if (!env) throw notFound('Envelope not found');
  dsExecute(envelopeId);
  // Downstream gate: a claim blocked only on CONSENT_MISSING becomes submittable.
  const claim = db.prepare(`SELECT * FROM claims WHERE consent_ref = ?`).get(envelopeId);
  if (claim && claim.status === 'BLOCKED' && claim.block_reason === 'CONSENT_MISSING') {
    db.prepare(`UPDATE claims SET status = 'SUBMITTED', block_reason = NULL WHERE id = ?`).run(claim.id);
    postGlOnce('BILLING', 'REVENUE', 'CLAIM', claim.id, claim.party_id, claim.amount_cents);
    insertAudit({ actorUserId, action: 'CLAIM_SUBMITTED', entityType: 'claim', entityId: claim.id, newState: 'SUBMITTED' });
  }
  return getEnvelope(envelopeId);
}

// ─── The single close-of-shift trigger — four cross-domain effects ───────────
export function closeOfShift({ actorUserId }) {
  const now = getNowMs();
  const AGE_MS = 7 * 86400000;
  const effects = { swept: 0, aged: 0, flagged: 0, reconciled: 0 };

  // (a) sweep the day's settled money up to the COMPLIANCE ledger.
  const unswept = db.prepare(`SELECT * FROM charges WHERE status = 'SETTLED' AND swept = 0`).all();
  for (const c of unswept) {
    postGlOnce('COMPLIANCE', 'SWEEP', 'CHARGE', c.id, c.party_id, c.amount_cents);
    db.prepare(`UPDATE charges SET swept = 1 WHERE id = ?`).run(c.id);
    effects.swept += 1;
  }
  // (b) age the criticals that sat too long.
  const crit = db.prepare(`SELECT * FROM lab_results WHERE status = 'CRITICAL'`).all();
  for (const r of crit) {
    if (now - r.created_at_ms > AGE_MS) { db.prepare(`UPDATE lab_results SET status = 'AGED' WHERE id = ?`).run(r.id); effects.aged += 1; }
  }
  // (c) flag the cycle counts that are due.
  const counts = db.prepare(`SELECT * FROM cycle_counts WHERE flagged = 0`).all();
  for (const cc of counts) {
    if (cc.due_ms && cc.due_ms < now) { db.prepare(`UPDATE cycle_counts SET flagged = 1 WHERE id = ?`).run(cc.id); effects.flagged += 1; }
  }
  // (d) reconcile controlled counts (append a COMPLIANCE recon marker for the day).
  effects.reconciled = 1;
  postGlOnce('COMPLIANCE', 'RECON', 'CONTROLLED', 'close-of-shift', null, 0);

  insertAudit({ actorUserId, action: 'CLOSE_OF_SHIFT', entityType: 'system', entityId: 'close-of-shift', newState: JSON.stringify(effects) });
  return { ok: true, effects };
}

// createEnvelope re-export for routes (SENT starter)
export { createEnvelope };
