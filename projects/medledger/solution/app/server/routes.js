import express from 'express';
import { db, getNowMs, listUsers } from './db.js';
import { requireAuth, requireRoles } from './auth.js';
import { badRequest, forbidden, notFound } from './errors.js';
import { iso, userSiteIds, userHasSite, isCitywide } from './helpers.js';
import { listPayments, getPayment, listDeliveries, stripeConfigured, stripeOffline, stripeLive } from './stripe.js';
import { getEnvelope } from './docuseal.js';
import * as svc from './services.js';
import { enrichCredential } from './services.js';

const router = express.Router();

router.use((req, res, next) => {
  if (req.path === '/demo-users' && req.method === 'GET') return next();
  return requireAuth(req, res, next);
});

// ─── Session / identity ─────────────────────────────────────────────────────
router.get('/session', requireAuth, (req, res) => {
  const { id, full_name, email, role } = req.user;
  res.json({ user: { id, full_name, email, role, site_ids: userSiteIds(req.user) } });
});
router.get('/demo-users', (_req, res) => res.json({ users: listUsers() }));
router.get('/sites', requireAuth, (_req, res) => res.json({ sites: db.prepare(`SELECT * FROM sites`).all() }));
router.get('/dashboard', requireAuth, (_req, res) => {
  res.json({ stats: { now_ms: getNowMs(), now_iso: iso(getNowMs()), stripe_configured: stripeConfigured(), stripe_offline: stripeOffline(), stripe_live: stripeLive() } });
});

// ═══ D1 Clinic ═══════════════════════════════════════════════════════════════
router.get('/patients', requireAuth, (req, res) => {
  const rows = db.prepare(`SELECT * FROM patients ORDER BY created_at_ms ASC`).all()
    .filter((p) => userHasSite(req.user, p.site_id));
  res.json({ patients: rows });
});
router.get('/patients/:id', requireAuth, (req, res, next) => {
  try {
    const p = db.prepare(`SELECT * FROM patients WHERE party_id = ?`).get(req.params.id);
    if (!p) throw notFound('Patient not found');
    if (!userHasSite(req.user, p.site_id)) throw notFound('Patient not found');
    res.json({ patient: p });
  } catch (err) { next(err); }
});
router.get('/patients/:id/statement', requireAuth, (req, res, next) => {
  try {
    const p = db.prepare(`SELECT * FROM patients WHERE party_id = ?`).get(req.params.id);
    if (!p) throw notFound('Patient not found');
    if (!userHasSite(req.user, p.site_id)) throw notFound('Patient not found');
    res.json({ statement: svc.patientStatement(req.params.id) });
  } catch (err) { next(err); }
});
router.post('/patients/:id/checkout-statement', requireAuth, requireRoles(['BILLING_CLERK', 'ADMINISTRATOR', 'COMPLIANCE_OFFICER']), async (req, res, next) => {
  try {
    res.json(await svc.checkoutStatement({ partyId: req.params.id, actorUserId: req.user.id }));
  } catch (err) { next(err); }
});
router.get('/financial-holds/:partyId', requireAuth, (req, res, next) => {
  try {
    res.json({ financial_hold: svc.getFinancialHold(req.params.partyId) });
  } catch (err) { next(err); }
});
router.get('/receipts', requireAuth, (req, res) => res.json({ receipts: svc.listReceipts({ ref: req.query.ref }) }));
router.get('/encounters/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM encounters WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Encounter not found');
    res.json({ encounter: r });
  } catch (err) { next(err); }
});
router.get('/orders/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Order not found');
    res.json({ order: r });
  } catch (err) { next(err); }
});

// ═══ D2 Pharmacy ══════════════════════════════════════════════════════════════
router.get('/dispenses/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM dispenses WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Dispense not found');
    res.json({ dispense: r });
  } catch (err) { next(err); }
});
router.get('/controlled-ledger', requireAuth, (req, res) => {
  res.json({ ledger: svc.controlledLedger({ drug: req.query.drug, sku: req.query.sku }) });
});
router.post('/dispenses/:id/checkout-copay', requireAuth, requireRoles(['PHARMACIST', 'BILLING_CLERK', 'ADMINISTRATOR']), async (req, res, next) => {
  try {
    res.json(await svc.checkoutCopay({ dispenseId: req.params.id, actorUserId: req.user.id }));
  } catch (err) { next(err); }
});
router.get('/dea-forms', requireAuth, (req, res) => res.json({ dea_forms: svc.listDeaForms({ dispense: req.query.dispense }) }));
router.get('/refunds', requireAuth, (req, res) => res.json({ refunds: svc.listRefunds({ ref: req.query.ref }) }));

// ═══ D3 Lab ═══════════════════════════════════════════════════════════════════
router.get('/lab-results/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM lab_results WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Lab result not found');
    res.json({ lab_result: { ...r, critical: Boolean(r.critical) } });
  } catch (err) { next(err); }
});
router.get('/lab-orders/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM lab_orders WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Lab order not found');
    res.json({ lab_order: r });
  } catch (err) { next(err); }
});

// ═══ D4 Imaging ═══════════════════════════════════════════════════════════════
router.get('/imaging-studies/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM imaging_studies WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Imaging study not found');
    res.json({ imaging_study: { ...r, contrast: Boolean(r.contrast) } });
  } catch (err) { next(err); }
});

// ═══ D5 Transport ═════════════════════════════════════════════════════════════
router.get('/rigs/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM rigs WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Rig not found');
    res.json({ rig: r });
  } catch (err) { next(err); }
});
router.get('/dispatches/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM dispatches WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Dispatch not found');
    res.json({ dispatch: { ...r, priority: Boolean(r.priority) } });
  } catch (err) { next(err); }
});

// ═══ D6 Central supply ════════════════════════════════════════════════════════
router.get('/skus', requireAuth, (_req, res) => res.json({ skus: db.prepare(`SELECT * FROM skus ORDER BY created_at_ms ASC`).all() }));
router.get('/skus/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM skus WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('SKU not found');
    res.json({ sku: r });
  } catch (err) { next(err); }
});
router.get('/supply-movements', requireAuth, (req, res) => res.json({ supply_movements: svc.supplyMovements(req.query.ref) }));
router.get('/cycle-counts/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM cycle_counts WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Cycle count not found');
    res.json({ cycle_count: { ...r, flagged: Boolean(r.flagged) } });
  } catch (err) { next(err); }
});

// ═══ D7 Billing / Claims ══════════════════════════════════════════════════════
router.get('/charges', requireAuth, (req, res) => res.json({ charges: svc.listCharges({ ref: req.query.ref }) }));
router.get('/charges/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM charges WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Charge not found');
    res.json({ charge: r });
  } catch (err) { next(err); }
});
router.get('/claims/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM claims WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Claim not found');
    res.json({ claim: r });
  } catch (err) { next(err); }
});
router.get('/payments', requireAuth, (req, res) => res.json({ payments: listPayments({ refId: req.query.refId, channel: req.query.channel }) }));

// ═══ D8 Credentialing / Compliance ════════════════════════════════════════════
router.get('/credentials/:providerId', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM credentials WHERE provider_id = ?`).get(req.params.providerId);
    if (!r) throw notFound('Credential not found');
    res.json({ credential: enrichCredential(r) });
  } catch (err) { next(err); }
});
router.get('/providers', requireAuth, (_req, res) => res.json({ providers: db.prepare(`SELECT * FROM providers ORDER BY created_at_ms ASC`).all() }));
router.get('/panels/:id', requireAuth, (req, res, next) => {
  try {
    const r = db.prepare(`SELECT * FROM panels WHERE id = ?`).get(req.params.id);
    if (!r) throw notFound('Panel not found');
    res.json({ panel: r });
  } catch (err) { next(err); }
});
router.get('/envelopes/:id', requireAuth, (req, res, next) => {
  try {
    const r = getEnvelope(req.params.id);
    if (!r) throw notFound('Envelope not found');
    res.json({ envelope: r });
  } catch (err) { next(err); }
});
router.post('/envelopes/:id/execute', requireAuth, requireRoles(['COMPLIANCE_OFFICER', 'ADMINISTRATOR']), (req, res, next) => {
  try {
    res.json({ envelope: svc.executeConsentEnvelope({ envelopeId: req.params.id, actorUserId: req.user.id }) });
  } catch (err) { next(err); }
});
router.get('/gl/lines', requireAuth, (req, res) => res.json({ gl_lines: svc.glLines({ ref: req.query.ref, dept: req.query.dept }) }));
router.get('/finance/reconcile', requireAuth, requireRoles(['COMPLIANCE_OFFICER', 'ADMINISTRATOR']), (_req, res) => {
  res.json({ reconciliation: svc.financeReconcile() });
});
router.get('/audit', requireAuth, (req, res, next) => {
  try {
    if (!['ADMINISTRATOR', 'COMPLIANCE_OFFICER'].includes(req.user.role)) throw forbidden('Not authorized');
    const events = db.prepare(`SELECT * FROM audit_events ORDER BY created_at_ms DESC LIMIT 500`).all().map((e) => ({ ...e, created_at_iso: iso(e.created_at_ms) }));
    res.json({ events });
  } catch (err) { next(err); }
});

// ─── Checkout (twin Pay + redirect reconcile) ───────────────────────────────
router.post('/checkout/:paymentId/complete', requireAuth, (req, res, next) => {
  try {
    res.json({ payment: svc.completeCheckout({ paymentId: req.params.paymentId, actorUserId: req.user.id }) });
  } catch (err) { next(err); }
});
router.get('/checkout/reconcile', requireAuth, async (req, res, next) => {
  try {
    const sessionId = req.query.session_id;
    if (!sessionId) throw badRequest('session_id required');
    res.json({ payment: await svc.reconcileCheckout({ sessionId, actorUserId: req.user.id }) });
  } catch (err) { next(err); }
});
router.get('/stripe/webhook/deliveries', requireAuth, (_req, res) => res.json({ deliveries: listDeliveries() }));

// ═══ Admin ════════════════════════════════════════════════════════════════════
router.post('/admin/close-of-shift', requireAuth, requireRoles('ADMINISTRATOR'), (req, res, next) => {
  try {
    res.json(svc.closeOfShift({ actorUserId: req.user.id }));
  } catch (err) { next(err); }
});

export default router;
