import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  imagingCharge, facilityFee, ledgerBalance, roundHalfUp,
  COPAY_CENTS, CONTRAST_ADDON_CENTS, STATEMENT_WRITE_OFF_CENTS,
  contractualAllowance, deniedPatientBalance, SAFETY_RESERVE_CENTS,
  PRIORITY_SURCHARGE_CENTS
} from './compute.js';

// Golden-internal roster manifest — the health system's records + staff sign-ins
// as DATA. The golden seeds its staff identities directly from it and the parity
// guard asserts every listed clinical record was seeded. This file is
// BYTE-IDENTICAL to the shipped agent asset environment/assets/artifacts/roster_seed_data.json: both
// carry the neutral base TRIGGERS (patients, base dispenses/labs/studies/claims,
// stub charges), while the DERIVED cross-domain cascade records (the reversal /
// contra-revenue / COGS / DEA-audit / safety-reserve / reconciliation / liability
// GL lines, the PATIENT_BALANCE / CREDIT charges, the DEA-form / refund / receipt
// / financial-hold records, the panel freeze, the sibling freezes, the retro
// claim sweep, the provider alerts and rework orders) are seeded ONLY here — no
// answer leaks to the agent. Only DATA lives in the roster: the rules, the
// cross-domain connections, the precedence and the derivations are NOT.
const __seedDir = path.dirname(fileURLToPath(import.meta.url));
export const ROSTER = JSON.parse(fs.readFileSync(path.join(__seedDir, 'roster.json'), 'utf8'));

const CLOCK = Date.parse('2026-08-17T10:00:00.000Z');
const DAY = 86400000;
const recent = CLOCK - 1 * DAY;
const old30 = CLOCK - 30 * DAY;
const expiryPast = CLOCK - 7 * DAY;
const expiryFuture = CLOCK + 60 * DAY;

const CTRL_UNIT = 3000;    // controlled drug unit price ($30.00)
const LAB_CHG = 5000;      // lab draw $50.00
const TRANSPORT_CHG = 20000; // transport run $200.00
const IMG_BASE = 40000;    // base imaging procedure charge $400.00

export function seed(db) {
  const now = CLOCK;
  const ins = {
    site: db.prepare(`INSERT INTO sites (id,name,created_at_ms) VALUES (?,?,?)`),
    party: db.prepare(`INSERT INTO parties (party_id,canonical_name,site_id,created_at_ms) VALUES (?,?,?,?)`),
    provider: db.prepare(`INSERT INTO providers (provider_id,canonical_name,site_id,created_at_ms) VALUES (?,?,?,?)`),
    user: db.prepare(`INSERT INTO users (id,full_name,email,role,disabled,created_at_ms) VALUES (?,?,?,?,0,?)`),
    usa: db.prepare(`INSERT INTO user_site_assignments (user_id,site_id) VALUES (?,?)`),
    patient: db.prepare(`INSERT INTO patients (party_id,site_id,name,created_at_ms) VALUES (?,?,?,?)`),
    enc: db.prepare(`INSERT INTO encounters (id,party_id,provider_id,site_id,status,created_at_ms) VALUES (?,?,?,?,?,?)`),
    ord: db.prepare(`INSERT INTO orders (id,party_id,provider_id,site_id,kind,target_ref,status,block_reason,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?)`),
    disp: db.prepare(`INSERT INTO dispenses (id,party_id,provider_id,site_id,drug,sku_id,qty,controlled,status,hold_reason,charge_cents,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`),
    ledg: db.prepare(`INSERT INTO controlled_ledger (id,drug,sku_id,entry_type,qty,ref_id,created_at_ms) VALUES (?,?,?,?,?,?,?)`),
    lo: db.prepare(`INSERT INTO lab_orders (id,party_id,provider_id,site_id,analyte,created_at_ms) VALUES (?,?,?,?,?,?)`),
    lr: db.prepare(`INSERT INTO lab_results (id,order_id,party_id,analyte,value,critical,status,charge_cents,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?)`),
    img: db.prepare(`INSERT INTO imaging_studies (id,party_id,provider_id,site_id,modality,contrast,sku_id,base_cents,charge_cents,facility_fee_cents,status,block_reason,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`),
    rig: db.prepare(`INSERT INTO rigs (id,site_id,dvir_status,hos_minutes,status,created_at_ms) VALUES (?,?,?,?,?,?)`),
    dsp: db.prepare(`INSERT INTO dispatches (id,party_id,rig_id,site_id,priority,status,refuse_reason,sku_id,charge_cents,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?)`),
    sku: db.prepare(`INSERT INTO skus (id,name,unit_cost_cents,on_hand,created_at_ms) VALUES (?,?,?,?,?)`),
    mov: db.prepare(`INSERT INTO supply_movements (id,sku_id,type,qty,ref_id,created_at_ms) VALUES (?,?,?,?,?,?)`),
    cc: db.prepare(`INSERT INTO cycle_counts (id,sku_id,counted,system_qty,variance_cents,flagged,due_ms,created_at_ms) VALUES (?,?,?,?,?,?,?,?)`),
    chg: db.prepare(`INSERT INTO charges (id,party_id,source_type,source_ref,amount_cents,status,swept,created_at_ms) VALUES (?,?,?,?,?,?,?,?)`),
    clm: db.prepare(`INSERT INTO claims (id,party_id,provider_id,charge_id,amount_cents,status,block_reason,deny_reason,prior_auth,consent_ref,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
    pay: db.prepare(`INSERT INTO payments (id,party_id,channel,ref_type,ref_id,amount_cents,status,stripe_ref,session_paid,settled_at_ms,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?,?,?)`),
    cred: db.prepare(`INSERT INTO credentials (provider_id,expiry_ms,created_at_ms) VALUES (?,?,?)`),
    env: db.prepare(`INSERT INTO envelopes (id,kind,docuseal_id,status,ref_type,ref_id,sent_at_ms,executed_at_ms,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?)`),
    panel: db.prepare(`INSERT INTO panels (id,provider_id,status,block_reason,created_at_ms) VALUES (?,?,?,?,?)`),
    gl: db.prepare(`INSERT INTO gl_lines (id,dept,line_type,source_type,source_ref,party_id,amount_cents,posted_ms,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?)`),
    aud: db.prepare(`INSERT INTO audit_events (id,actor_user_id,action,entity_type,entity_id,previous_state,new_state,reason,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?)`),
    dea: db.prepare(`INSERT INTO dea_forms (id,form_no,dispense_id,party_id,provider_id,drug,qty,schedule,created_at_ms) VALUES (?,?,?,?,?,?,?,?,?)`),
    refund: db.prepare(`INSERT INTO refunds (id,refund_no,party_id,ref_type,ref_id,amount_cents,reason,created_at_ms) VALUES (?,?,?,?,?,?,?,?)`),
    receipt: db.prepare(`INSERT INTO receipts (id,receipt_no,party_id,ref_type,ref_id,amount_cents,created_at_ms) VALUES (?,?,?,?,?,?,?)`),
    fh: db.prepare(`INSERT INTO financial_holds (id,party_id,status,reason,outstanding_cents,created_at_ms) VALUES (?,?,?,?,?,?)`)
  };
  let glN = 0;
  const gl = (dept, lineType, sourceType, sourceRef, partyId, amount) =>
    ins.gl.run(`GL-${String(++glN).padStart(4, '0')}`, dept, lineType, sourceType, sourceRef, partyId || null, amount, now, now);
  let audN = 0;
  const audit = (action, entityType, entityId, reason) =>
    ins.aud.run(`AE-${String(++audN).padStart(4, '0')}`, 'system', action, entityType, entityId, null, null, reason || null, now);

  // ── Sites ──
  ins.site.run('SITE-A', 'North Campus', now);
  ins.site.run('SITE-B', 'South Campus', now);

  // ── Demo users + site assignments (from the shared roster asset) ──
  for (const u of ROSTER.records.users) ins.user.run(u.id, u.full_name, u.email, u.role, now);
  for (const a of ROSTER.records.user_site_assignments) ins.usa.run(a.user_id, a.site_id);

  // ── Providers + credentials + panels (D8) ──
  ins.provider.run('PRV-01', 'Dr. Olivia Ordway', 'SITE-A', now);
  ins.provider.run('PRV-LAPSE', 'Dr. Les Lapsed', 'SITE-A', now);
  ins.cred.run('PRV-01', expiryFuture, now);
  ins.cred.run('PRV-LAPSE', expiryPast, now);
  ins.panel.run('PANEL-01', 'PRV-01', 'PENDING', null, now);
  // Panel of the lapsed provider is FROZEN by the credential lapse (H — buried).
  ins.panel.run('PANEL-LAPSE', 'PRV-LAPSE', 'FROZEN', 'CREDENTIAL_LAPSED', now);

  // ── SKUs (D6) ──
  ins.sku.run('SKU-O2', 'Oxygen cylinder', 5000, 50, now);
  ins.sku.run('SKU-CONTRAST', 'Contrast media', 15000, 40, now);
  ins.sku.run('SKU-SED', 'Midazolam (controlled)', CTRL_UNIT, 60, now);
  ins.sku.run('SKU-OPI', 'Oxycodone (controlled)', CTRL_UNIT, 1, now);   // short stock
  ins.sku.run('SKU-FENT', 'Fentanyl (controlled)', CTRL_UNIT, 168, now); // controlled book stands at 170; shelf reads 168 → a 2-unit shrinkage the close must square
  ins.sku.run('SKU-GLOVE', 'Exam gloves', 100, 97, now);                 // decrement anchor
  ins.sku.run('SKU-RECON', 'Ketamine (controlled)', CTRL_UNIT, 90, now); // period-close recon (100 opening − 10 drawn)

  // ── helper builders (all party-consistent) ──
  const P = (id, name, site = 'SITE-A') => { ins.party.run(id, name, site, now); ins.patient.run(id, site, name, now); return id; };
  const enc = (id, pid, { provider = 'PRV-01', status = 'OPEN', site = 'SITE-A' } = {}) => { ins.enc.run(id, pid, provider, site, status, now); return id; };
  const order = (id, pid, { provider = 'PRV-01', kind = 'DISPENSE', target = null, status = 'OPEN', block = null } = {}) => { ins.ord.run(id, pid, provider, 'SITE-A', kind, target, status, block, now); return id; };
  const dispense = (id, pid, { provider = 'PRV-01', drug = 'Midazolam (controlled)', sku = 'SKU-SED', qty = 1, controlled = 1, status = 'DISPENSED', hold = null, charge = 0 } = {}) => { ins.disp.run(id, pid, provider, 'SITE-A', drug, sku, qty, controlled, status, hold, charge, now); return id; };
  const ledgerEntry = (id, drug, sku, type, qty, ref, at = now) => { ins.ledg.run(id, drug, sku, type, qty, ref, at); };
  const labResult = (id, pid, analyte, value, critical, { status = 'RESULTED', charge = 0, at = recent } = {}) => { ins.lr.run(id, null, pid, analyte, value, critical ? 1 : 0, status, charge, at); return id; };
  const study = (id, pid, { provider = 'PRV-01', modality = 'CT', contrast = 1, sku = 'SKU-CONTRAST', base = IMG_BASE, status = 'READ', block = null } = {}) => {
    const fee = facilityFee(base);
    const charge = block ? 0 : imagingCharge(base, Boolean(contrast));
    ins.img.run(id, pid, provider, 'SITE-A', modality, contrast ? 1 : 0, sku, base, charge, fee, status, block, now);
    return { id, charge, fee };
  };
  const rig = (id, { dvir = 'PASS', hos = 300, status = 'AVAILABLE', site = 'SITE-A' } = {}) => { ins.rig.run(id, site, dvir, hos, status, now); return id; };
  const dispatch = (id, pid, { rigId = 'RIG-OK', priority = 0, status = 'COMPLETED', refuse = null, sku = 'SKU-O2', charge = TRANSPORT_CHG } = {}) => { ins.dsp.run(id, pid, rigId, 'SITE-A', priority ? 1 : 0, status, refuse, sku, charge, now); return id; };
  const movement = (id, sku, type, qty, ref) => { ins.mov.run(id, sku, type, qty, ref, now); };
  const charge = (id, pid, sourceType, sourceRef, amount, { status = 'OPEN', swept = 0 } = {}) => { ins.chg.run(id, pid, sourceType, sourceRef, amount, status, swept, now); return id; };
  const claim = (id, pid, { provider = 'PRV-01', chargeId = null, amount = 0, status = 'DRAFT', block = null, deny = null, priorAuth = 'NONE', consentRef = null } = {}) => { ins.clm.run(id, pid, provider, chargeId, amount, status, block, deny, priorAuth, consentRef, now); return id; };
  const envelope = (id, kind, refType, refId, { status = 'SENT', executedAt = null } = {}) => { ins.env.run(id, kind, `DS_TWIN_${id}`, status, refType, refId, now, executedAt, now); return id; };
  const cycleCount = (id, sku, counted, systemQty, { flagged = 0, due = null } = {}) => {
    const unit = db.prepare('SELECT unit_cost_cents FROM skus WHERE id = ?').get(sku).unit_cost_cents;
    const variance = Math.abs(systemQty - counted) * unit;
    ins.cc.run(id, sku, counted, systemQty, variance, flagged ? 1 : 0, due, now);
    return { id, variance };
  };
  const deaForm = (id, formNo, dispId, pid, { provider = 'PRV-01', drug = 'Midazolam (controlled)', qty = 1 } = {}) => { ins.dea.run(id, formNo, dispId, pid, provider, drug, qty, 'II', now); return id; };
  const refund = (id, refundNo, pid, refType, refId, amount, reason) => { ins.refund.run(id, refundNo, pid, refType, refId, amount, reason || null, now); return id; };
  const receipt = (id, receiptNo, pid, refType, refId, amount) => { ins.receipt.run(id, receiptNo, pid, refType, refId, amount, now); return id; };
  const finHold = (id, pid, outstanding, { status = 'ACTIVE', reason = 'COLLECTIONS_HOLD' } = {}) => { ins.fh.run(id, pid, status, reason, outstanding, now); return id; };

  const unitOf = (sku) => db.prepare('SELECT unit_cost_cents FROM skus WHERE id = ?').get(sku).unit_cost_cents;

  // shared rigs
  rig('RIG-OK', { dvir: 'PASS', hos: 300, status: 'AVAILABLE' });
  rig('RIG-GND', { dvir: 'OUT_OF_SERVICE', hos: 200, status: 'GROUNDED' });
  rig('RIG-HOS', { dvir: 'PASS', hos: 700, status: 'GROUNDED' });

  // ══════════════════════════════════════════════════════════════════════════
  //  COVERAGE — 10 cross-domain conjunctions a rules-correct build produces by
  //  default (first-order enforcement + obvious postings). These are the
  //  denominator, not the difficulty.
  // ══════════════════════════════════════════════════════════════════════════

  // COV1 (clinic+lab+pharmacy+billing): CRITICAL lab holds a not-yet-run fill; no charge.
  P('PAT-01', 'Alan Reyes');
  enc('ENC-01', 'PAT-01');
  order('ORD-01', 'PAT-01', { kind: 'DISPENSE', target: 'DISP-01', status: 'OPEN' });
  labResult('LAB-01', 'PAT-01', 'POTASSIUM', 6.4, true, { status: 'CRITICAL' });
  dispense('DISP-01', 'PAT-01', { status: 'HELD', hold: 'CRITICAL_LAB_HOLD' });
  claim('CLM-01', 'PAT-01', { amount: 0, status: 'DRAFT' });
  envelope('ENV-01', 'CONSENT', 'patient', 'PAT-01');
  audit('DISPENSE_HELD', 'dispense', 'DISP-01', 'CRITICAL_LAB_HOLD');

  // COV2 (imaging+supply+billing+compliance): contrast composition.
  P('PAT-05', 'Evan Cole');
  { const s = study('IMG-05', 'PAT-05', { contrast: 1, status: 'READ' });
    movement('MV-05', 'SKU-CONTRAST', 'DECREMENT', 1, 'IMG-05');
    charge('CHG-05', 'PAT-05', 'IMAGING', 'IMG-05', s.charge);
    gl('IMAGING', 'REVENUE', 'IMAGING', 'IMG-05', 'PAT-05', s.charge); }

  // COV3 (compliance+clinic+pharmacy+imaging): lapse blocks three domains.
  P('PAT-07', 'Gus Hale');
  order('ORD-07', 'PAT-07', { provider: 'PRV-LAPSE', kind: 'LAB', status: 'BLOCKED', block: 'CREDENTIAL_LAPSED' });
  dispense('DISP-07', 'PAT-07', { provider: 'PRV-LAPSE', status: 'HELD', hold: 'CREDENTIAL_LAPSED' });
  study('IMG-07', 'PAT-07', { provider: 'PRV-LAPSE', contrast: 0, status: 'BLOCKED', block: 'CREDENTIAL_LAPSED' });

  // COV4 (transport+billing+compliance+clinic): grounded rig refused, no charge.
  P('PAT-08', 'Hana Ito');
  enc('ENC-08', 'PAT-08');
  dispatch('DSP-08', 'PAT-08', { rigId: 'RIG-GND', status: 'REFUSED', refuse: 'RIG_GROUNDED_DVIR', charge: 0 });
  audit('DISPATCH_REFUSED', 'dispatch', 'DSP-08', 'RIG_GROUNDED_DVIR');

  // R1 (transport+billing+clinic+compliance): DENIAL TRILOGY — a state-transition
  //   unwind. DSP-09 ran and its claim posted (TRANSPORT REVENUE 20000). The payer
  //   DENIED it: the revenue is reversed to net zero, the 18% kept-back allowance
  //   books to billing as a contra-revenue, and the rest rolls onto the patient as a
  //   balance. The clinic reworked and RE-FILED it, so the claim is AUTHORIZED again:
  //   the revenue reposts, the contra is undone, and the patient balance is reversed.
  //   The books must read as if the denial had been undone — not as two runs, and not
  //   with the patient still owing. FINAL nets: TRANSPORT 20000, BILLING 0, balance
  //   REVERSED. A build that only completes the run (single REVENUE line), or that
  //   stops at the denial, lands on the wrong picture.
  P('PAT-09', 'Ivan Cruz');
  enc('ENC-09', 'PAT-09');
  dispatch('DSP-09', 'PAT-09', { rigId: 'RIG-OK', status: 'COMPLETED', charge: TRANSPORT_CHG });
  movement('MV-09', 'SKU-O2', 'DECREMENT', 1, 'DSP-09');
  charge('CHG-09', 'PAT-09', 'TRANSPORT', 'DSP-09', TRANSPORT_CHG, { status: 'AUTHORIZED' });
  { const allow = contractualAllowance(TRANSPORT_CHG);   // 3600
    const bal = TRANSPORT_CHG - allow;                    // 16400
    claim('CLM-09', 'PAT-09', { chargeId: 'CHG-09', amount: TRANSPORT_CHG, status: 'AUTHORIZED', priorAuth: 'NONE' });
    charge('CHG-09B', 'PAT-09', 'PATIENT_BALANCE', 'CLM-09', bal, { status: 'REVERSED' }); // no longer owed
    gl('TRANSPORT', 'REVENUE', 'TRANSPORT', 'DSP-09', 'PAT-09', TRANSPORT_CHG);   // t0 post
    gl('TRANSPORT', 'REVERSAL', 'TRANSPORT', 'DSP-09', 'PAT-09', -TRANSPORT_CHG); // t1 denial
    gl('TRANSPORT', 'REVENUE', 'TRANSPORT', 'DSP-09', 'PAT-09', TRANSPORT_CHG);   // t2 re-file → net 20000
    gl('BILLING', 'CONTRA_REVENUE', 'CLAIM_DENIED', 'CLM-09', 'PAT-09', -allow);  // t1 kept-back
    gl('BILLING', 'REVERSAL', 'CLAIM_DENIED', 'CLM-09', 'PAT-09', allow);         // t2 undo → net 0
    audit('CLAIM_DENIED', 'claim', 'CLM-09', 'PAYER_DENY');
    audit('CLAIM_AUTHORIZED', 'claim', 'CLM-09', 'REWORK_REFILED'); }

  // COV6 (billing+compliance+clinic+lab): claim first-unmet precedence (prior-auth before consent).
  P('PAT-11', 'Kim Novak');
  enc('ENC-11', 'PAT-11');
  ins.lo.run('LO-11', 'PAT-11', 'PRV-01', 'SITE-A', 'POTASSIUM', now);
  envelope('ENV-11', 'CONSENT', 'claim', 'CLM-11', { status: 'SENT' });
  { const s = study('IMG-11', 'PAT-11', { contrast: 1, status: 'ORDERED' });
    charge('CHG-11', 'PAT-11', 'IMAGING', 'IMG-11', s.charge);
    claim('CLM-11', 'PAT-11', { chargeId: 'CHG-11', amount: s.charge, status: 'BLOCKED', block: 'PRIOR_AUTH_REQUIRED', priorAuth: 'REQUIRED', consentRef: 'ENV-11' }); }

  // COV7 (billing+compliance+clinic+imaging): DocuSeal consent EXECUTED unlocks claim (DRIVEN).
  P('PAT-12', 'Luis Mora');
  enc('ENC-12', 'PAT-12');
  { const s = study('IMG-12', 'PAT-12', { contrast: 0, status: 'READ' });
    charge('CHG-12', 'PAT-12', 'IMAGING', 'IMG-12', s.charge);
    envelope('ENV-12', 'CONSENT', 'claim', 'CLM-12', { status: 'SENT' });
    claim('CLM-12', 'PAT-12', { chargeId: 'CHG-12', amount: s.charge, status: 'BLOCKED', block: 'CONSENT_MISSING', priorAuth: 'NONE', consentRef: 'ENV-12' }); }

  // COV8 (clinic+billing+transport+compliance): PAT-15's completed run bills a clean
  //   $200 transport fare. The dispatch COMPLETED, the fare posts as a TRANSPORT charge,
  //   the claim authorizes against that charge, and one TRANSPORT REVENUE line books to
  //   the ledger; ENC-15 is discharged. (This scenario grades DSP-15 per the rubric +
  //   roster — DSP-15/CHG-15(TRANSPORT)/CLM-15; the prior imaging denial-trilogy that
  //   sat here graded no current criterion and desynced the golden from the rubric.)
  P('PAT-15', 'Opal Reed');
  enc('ENC-15', 'PAT-15', { status: 'DISCHARGED' });
  { dispatch('DSP-15', 'PAT-15', { rigId: 'RIG-OK', status: 'COMPLETED', charge: TRANSPORT_CHG });
    charge('CHG-15', 'PAT-15', 'TRANSPORT', 'DSP-15', TRANSPORT_CHG, { status: 'AUTHORIZED' });
    claim('CLM-15', 'PAT-15', { chargeId: 'CHG-15', amount: TRANSPORT_CHG, status: 'AUTHORIZED', priorAuth: 'NONE' });
    gl('TRANSPORT', 'REVENUE', 'TRANSPORT', 'DSP-15', 'PAT-15', TRANSPORT_CHG); }

  // COV9 (supply+pharmacy+compliance+clinic): short stock holds fill, order open, ledger untouched.
  P('PAT-18', 'Rosa Keller');
  order('ORD-18', 'PAT-18', { kind: 'DISPENSE', target: 'DISP-18', status: 'OPEN' });
  dispense('DISP-18', 'PAT-18', { drug: 'Oxycodone (controlled)', sku: 'SKU-OPI', qty: 2, status: 'HELD', hold: 'CONTROLLED_STOCK_SHORT' });
  audit('DISPENSE_HELD', 'dispense', 'DISP-18', 'CONTROLLED_STOCK_SHORT');

  // COV10 (transport+compliance+billing+supply): HOS exceeded refused, no supply, no charge.
  P('PAT-19', 'Sami Vega');
  dispatch('DSP-19', 'PAT-19', { rigId: 'RIG-HOS', status: 'REFUSED', refuse: 'HOS_EXCEEDED', sku: null, charge: 0 });
  audit('DISPATCH_REFUSED', 'dispatch', 'DSP-19', 'HOS_EXCEEDED');

  // COV11 (clinic+imaging+billing+compliance): clean read — the positive control.
  P('PAT-20', 'Theo Blaine');
  enc('ENC-20', 'PAT-20');
  { const s = study('IMG-20', 'PAT-20', { contrast: 1, status: 'READ' });
    charge('CHG-20', 'PAT-20', 'IMAGING', 'IMG-20', s.charge);
    claim('CLM-20', 'PAT-20', { provider: 'PRV-01', chargeId: 'CHG-20', amount: s.charge, status: 'APPROVED', block: null, priorAuth: 'APPROVED' });
    gl('IMAGING', 'REVENUE', 'IMAGING', 'IMG-20', 'PAT-20', s.charge);
    envelope('ENV-20', 'CONSENT', 'patient', 'PAT-20'); }

  // ══════════════════════════════════════════════════════════════════════════
  //  Stripe copay (DRIVEN, coverage): PAT-21 copay paid → charge SETTLED → PHARMACY GL.
  // ══════════════════════════════════════════════════════════════════════════
  P('PAT-21', 'Uma Frank');
  dispense('DISP-21', 'PAT-21', { qty: 1, status: 'DISPENSED', charge: COPAY_CENTS });
  movement('MV-21', 'SKU-SED', 'DECREMENT', 1, 'DISP-21');
  ledgerEntry('LG-21D', 'Midazolam (controlled)', 'SKU-SED', 'DISPENSE', 1, 'DISP-21');
  charge('CHG-21', 'PAT-21', 'COPAY', 'DISP-21', COPAY_CENTS, { status: 'OPEN' });

  // ══════════════════════════════════════════════════════════════════════════
  //  24 NON-OBVIOUS BURIED CROSS-DOMAIN CASCADE BREAKERS
  //  Every amount is a STATED computation input; only the connection / precedence
  //  / derivation is hidden. The TRIGGER is in the roster; the DERIVED cascade is
  //  seeded ONLY here and must be inferred from the brief's war stories.
  // ══════════════════════════════════════════════════════════════════════════

  // ── Family A: a CRITICAL value that lands AFTER a fill was charged sweeps back.
  //   It (1) REVERSES the already-posted charge so the department nets to zero,
  //   (2) FREEZES the patient's OTHER still-open imaging + transport, (3) books a
  //   flat $250 patient-safety incident reserve as a COMPLIANCE liability and pings
  //   the ordering doctor. TRIGGER: DISP-40 already DISPENSED + LAB-40 critical.
  P('PAT-40', 'Aaron Delgado');
  enc('ENC-40', 'PAT-40');
  labResult('LAB-40', 'PAT-40', 'POTASSIUM', 6.9, true, { status: 'CRITICAL' });
  dispense('DISP-40', 'PAT-40', { qty: 2, status: 'REVERSED', hold: 'CRITICAL_LAB_HOLD', charge: 2 * CTRL_UNIT });
  charge('CHG-40', 'PAT-40', 'DISPENSE', 'DISP-40', 2 * CTRL_UNIT, { status: 'REVERSED' });
  gl('PHARMACY', 'REVENUE', 'DISPENSE', 'DISP-40', 'PAT-40', 2 * CTRL_UNIT);   // originally posted
  gl('PHARMACY', 'REVERSAL', 'DISPENSE', 'DISP-40', 'PAT-40', -2 * CTRL_UNIT); // clawed back → net 0
  movement('MV-40', 'SKU-SED', 'RECEIPT', 2, 'DISP-40');                        // drug back on the shelf
  // sibling freeze — the patient's OTHER open orders freeze until the value clears
  study('IMG-40B', 'PAT-40', { contrast: 0, status: 'HELD', block: 'CRITICAL_LAB_HOLD' });
  dispatch('DSP-40B', 'PAT-40', { rigId: 'RIG-OK', status: 'FROZEN', refuse: 'CRITICAL_LAB_HOLD', charge: 0 });
  // safety reserve memo (flat $250, NOT the charge) + provider alert
  gl('COMPLIANCE', 'LIABILITY', 'SAFETY_RESERVE', 'LAB-40', 'PAT-40', SAFETY_RESERVE_CENTS);
  audit('PROVIDER_ALERT', 'provider', 'PRV-01', 'CRITICAL_LAB');
  audit('DISPENSE_REVERSED', 'dispense', 'DISP-40', 'CRITICAL_LAB_HOLD');

  // A 2nd (hot INR): same retro-reversal + reserve on a different analyte/party.
  P('PAT-41', 'Bella Knox');
  enc('ENC-41', 'PAT-41');
  labResult('LAB-41', 'PAT-41', 'INR', 5.4, true, { status: 'CRITICAL' });
  dispense('DISP-41', 'PAT-41', { qty: 1, status: 'REVERSED', hold: 'CRITICAL_LAB_HOLD', charge: CTRL_UNIT });
  charge('CHG-41', 'PAT-41', 'DISPENSE', 'DISP-41', CTRL_UNIT, { status: 'REVERSED' });
  gl('PHARMACY', 'REVENUE', 'DISPENSE', 'DISP-41', 'PAT-41', CTRL_UNIT);
  gl('PHARMACY', 'REVERSAL', 'DISPENSE', 'DISP-41', 'PAT-41', -CTRL_UNIT);
  movement('MV-41', 'SKU-SED', 'RECEIPT', 1, 'DISP-41');
  gl('COMPLIANCE', 'LIABILITY', 'SAFETY_RESERVE', 'LAB-41', 'PAT-41', SAFETY_RESERVE_CENTS);
  audit('PROVIDER_ALERT', 'provider', 'PRV-01', 'CRITICAL_LAB');
  audit('DISPENSE_REVERSED', 'dispense', 'DISP-41', 'CRITICAL_LAB_HOLD');

  // ── Family B: a DENIED claim rolls a patient balance NET of the payer's standing
  //   18% contractual allowance (not the raw charge); the 18% books as a BILLING
  //   contra-revenue and a REWORK drops into the clinic. TRIGGER: CLM-42/43 DENIED.
  P('PAT-42', 'Caleb Rowe');
  enc('ENC-42', 'PAT-42');
  { const s = study('IMG-42', 'PAT-42', { contrast: 1, status: 'READ' });     // 63000
    charge('CHG-42', 'PAT-42', 'IMAGING', 'IMG-42', s.charge);
    claim('CLM-42', 'PAT-42', { chargeId: 'CHG-42', amount: s.charge, status: 'DENIED', block: 'PRIOR_AUTH_REQUIRED', deny: 'PRIOR_AUTH_REQUIRED', priorAuth: 'REQUIRED' });
    const bal = deniedPatientBalance(s.charge);        // 63000 − 11340 = 51660
    const allow = contractualAllowance(s.charge);      // 11340
    charge('CHG-42B', 'PAT-42', 'PATIENT_BALANCE', 'CLM-42', bal, { status: 'OPEN' });
    gl('BILLING', 'CONTRA_REVENUE', 'CLAIM_DENIED', 'CLM-42', 'PAT-42', -allow);
    order('ORD-42', 'PAT-42', { kind: 'REWORK', target: 'CLM-42', status: 'OPEN', block: 'PRIOR_AUTH_REQUIRED' });
    audit('CLAIM_DENIED', 'claim', 'CLM-42', 'PRIOR_AUTH_REQUIRED'); }

  P('PAT-43', 'Dara Moss');
  enc('ENC-43', 'PAT-43');
  labResult('LAB-43', 'PAT-43', 'GLUCOSE', 110, false, { charge: LAB_CHG });
  { const s = study('IMG-43', 'PAT-43', { contrast: 0, status: 'READ' });     // 48000
    charge('CHG-43', 'PAT-43', 'IMAGING', 'IMG-43', s.charge);
    claim('CLM-43', 'PAT-43', { chargeId: 'CHG-43', amount: s.charge, status: 'DENIED', block: 'CONSENT_MISSING', deny: 'CONSENT_MISSING', priorAuth: 'NONE' });
    const bal = deniedPatientBalance(s.charge);        // 48000 − 8640 = 39360
    const allow = contractualAllowance(s.charge);      // 8640
    charge('CHG-43B', 'PAT-43', 'PATIENT_BALANCE', 'CLM-43', bal, { status: 'OPEN' });
    gl('BILLING', 'CONTRA_REVENUE', 'CLAIM_DENIED', 'CLM-43', 'PAT-43', -allow);
    order('ORD-43', 'PAT-43', { kind: 'REWORK', target: 'CLM-43', status: 'OPEN', block: 'CONSENT_MISSING' });
    audit('CLAIM_DENIED', 'claim', 'CLM-43', 'CONSENT_MISSING'); }

  // ── Family C: every controlled (Schedule-II) fill MINTS a discrete DEA Form 222;
  //   a fill of $150 or more in drug value ALSO books a COMPLIANCE DEA-audit memo
  //   equal to the drug value, SEPARATE from the revenue and COGS lines. A smaller
  //   fill mints the form but NO memo. TRIGGER: DISP-44 (qty 6), DISP-45 (qty 3).
  P('PAT-44', 'Elena Ruiz');
  { const qty = 6, val = qty * CTRL_UNIT; // 18000 ≥ 15000 → memo
    dispense('DISP-44', 'PAT-44', { qty, status: 'DISPENSED', charge: val });
    movement('MV-44', 'SKU-SED', 'DECREMENT', qty, 'DISP-44');
    ledgerEntry('LG-44', 'Midazolam (controlled)', 'SKU-SED', 'DISPENSE', qty, 'DISP-44');
    charge('CHG-44', 'PAT-44', 'DISPENSE', 'DISP-44', val);
    gl('PHARMACY', 'REVENUE', 'DISPENSE', 'DISP-44', 'PAT-44', val);
    gl('SUPPLY', 'COGS', 'DISPENSE', 'DISP-44', 'PAT-44', qty * unitOf('SKU-SED'));
    deaForm('DEA-44', 'DEA222-000044', 'DISP-44', 'PAT-44', { qty });
    gl('COMPLIANCE', 'DEA_AUDIT', 'DISPENSE', 'DISP-44', 'PAT-44', val); }   // memo = drug value

  P('PAT-45', 'Frank Okafor');
  { const qty = 3, val = qty * CTRL_UNIT; // 9000 < 15000 → NO memo
    dispense('DISP-45', 'PAT-45', { qty, status: 'DISPENSED', charge: val });
    movement('MV-45', 'SKU-SED', 'DECREMENT', qty, 'DISP-45');
    ledgerEntry('LG-45', 'Midazolam (controlled)', 'SKU-SED', 'DISPENSE', qty, 'DISP-45');
    charge('CHG-45', 'PAT-45', 'DISPENSE', 'DISP-45', val);
    gl('PHARMACY', 'REVENUE', 'DISPENSE', 'DISP-45', 'PAT-45', val);
    gl('SUPPLY', 'COGS', 'DISPENSE', 'DISP-45', 'PAT-45', qty * unitOf('SKU-SED'));
    deaForm('DEA-45', 'DEA222-000045', 'DISP-45', 'PAT-45', { qty }); }
    // NO COMPLIANCE DEA_AUDIT line for DISP-45.

  // ── Family D: PERIOD-CLOSE WHOLE-SKU RECONCILIATION. At the close the shelf's
  //   closing on-hand VALUE must square: opening value − Σ cost-of-goods == the
  //   stored on-hand × unit cost, and that squared figure books as a SUPPLY
  //   reconciliation line. It only comes out right if every movement for the SKU
  //   is wired. SKU-RECON: opening 100 units, two fills drew 4 + 6, on_hand 90.
  P('PAT-46', 'Gina Sato');
  { const unit = unitOf('SKU-RECON');            // 3000
    ledgerEntry('LG-46R', 'Ketamine (controlled)', 'SKU-RECON', 'RECEIPT', 100, 'RCV-46');
    dispense('DISP-46A', 'PAT-46', { drug: 'Ketamine (controlled)', sku: 'SKU-RECON', qty: 4, status: 'DISPENSED', charge: 4 * CTRL_UNIT });
    movement('MV-46A', 'SKU-RECON', 'DECREMENT', 4, 'DISP-46A');
    ledgerEntry('LG-46A', 'Ketamine (controlled)', 'SKU-RECON', 'DISPENSE', 4, 'DISP-46A');
    charge('CHG-46A', 'PAT-46', 'DISPENSE', 'DISP-46A', 4 * CTRL_UNIT);
    gl('PHARMACY', 'REVENUE', 'DISPENSE', 'DISP-46A', 'PAT-46', 4 * CTRL_UNIT);
    gl('SUPPLY', 'COGS', 'DISPENSE', 'DISP-46A', 'PAT-46', 4 * unit);   // 12000
    dispense('DISP-46B', 'PAT-46', { drug: 'Ketamine (controlled)', sku: 'SKU-RECON', qty: 6, status: 'DISPENSED', charge: 6 * CTRL_UNIT });
    movement('MV-46B', 'SKU-RECON', 'DECREMENT', 6, 'DISP-46B');
    ledgerEntry('LG-46B', 'Ketamine (controlled)', 'SKU-RECON', 'DISPENSE', 6, 'DISP-46B');
    charge('CHG-46B', 'PAT-46', 'DISPENSE', 'DISP-46B', 6 * CTRL_UNIT);
    gl('PHARMACY', 'REVENUE', 'DISPENSE', 'DISP-46B', 'PAT-46', 6 * CTRL_UNIT);
    gl('SUPPLY', 'COGS', 'DISPENSE', 'DISP-46B', 'PAT-46', 6 * unit);   // 18000
    const onHand = 100 - (4 + 6);           // 90
    const closingValue = onHand * unit;     // 270000 == opening 300000 − COGS 30000
    gl('SUPPLY', 'RECONCILIATION', 'PERIOD_CLOSE', 'SKU-RECON', 'PAT-46', closingValue); }

  // ── Family E: a PAST-DUE statement balance over $600 raises a COLLECTIONS_HOLD
  //   that FREEZES the party's NEW orders across clinic, pharmacy and imaging and
  //   books a COMPLIANCE receivable — but an EMERGENCY transport run is exempt.
  //   PAT-47 owes $740 (over the line); PAT-48 owes $390 (under → no hold).
  P('PAT-47', 'Hugo Bianchi');
  charge('CHG-47A', 'PAT-47', 'IMAGING', 'IMG-47X', 63000, { status: 'OPEN' });   // pre-existing
  charge('CHG-47B', 'PAT-47', 'TRANSPORT', 'DSP-47X', 20000, { status: 'OPEN' }); // pre-existing
  { study('IMG-47X', 'PAT-47', { contrast: 1, status: 'READ' });                  // source of CHG-47A
    // outstanding statement = (63000+20000) − 4000 copay − 5000 write-off = 74000 (> 60000)
    const outstanding = (63000 + 20000) - COPAY_CENTS - STATEMENT_WRITE_OFF_CENTS; // 74000
    finHold('FH-47', 'PAT-47', outstanding);
    gl('COMPLIANCE', 'RECEIVABLE', 'COLLECTIONS', 'PAT-47', 'PAT-47', outstanding);
    // NEW orders frozen by the hold
    order('ORD-47', 'PAT-47', { kind: 'LAB', status: 'BLOCKED', block: 'COLLECTIONS_HOLD' });
    dispense('DISP-47', 'PAT-47', { qty: 1, status: 'HELD', hold: 'COLLECTIONS_HOLD', charge: 0 });
    study('IMG-47', 'PAT-47', { contrast: 0, status: 'HELD', block: 'COLLECTIONS_HOLD' });
    // EMERGENCY transport is exempt — it still runs and bills
    dispatch('DSP-47', 'PAT-47', { rigId: 'RIG-OK', priority: 1, status: 'COMPLETED', charge: TRANSPORT_CHG });
    movement('MV-47', 'SKU-O2', 'DECREMENT', 1, 'DSP-47');
    audit('COLLECTIONS_HOLD', 'party', 'PAT-47', 'COLLECTIONS_HOLD'); }

  // BOUNDARY control: PAT-48 owes EXACTLY $600.00 (60000). "Over $600" is strictly
  //   greater, so a balance that lands ON the line raises NO hold. A build that
  //   thresholds with >= turns this patient over wrongly. IMG-48 base 57500 →
  //   non-contrast charge 69000; statement 69000 − 4000 − 5000 = 60000 exactly.
  P('PAT-48', 'Iris Vance');
  { const s = study('IMG-48', 'PAT-48', { contrast: 0, base: 57500, status: 'READ' }); // 69000
    charge('CHG-48', 'PAT-48', 'IMAGING', 'IMG-48', s.charge, { status: 'OPEN' });
    // outstanding = 69000 − 4000 − 5000 = 60000 (== the $600 line, NOT over it) → NO hold
    order('ORD-48', 'PAT-48', { kind: 'LAB', status: 'OPEN' }); }

  // ── R3: HOLD PRECEDENCE (rule intersection). PAT-54 owes past the collections line
  //   (a standing money hold is ACTIVE) AND a fresh potassium of 7.0 just came back
  //   critical (a safety hold). A NEW fill hits BOTH holds at once. The record names
  //   the one actually in the way — the fresh safety flag governs the standing money
  //   hold — so the new fill reads CRITICAL_LAB_HOLD, not COLLECTIONS_HOLD, while the
  //   money hold stays recorded on the account. Both reason codes are in play; which
  //   one the record names is the buried precedence. (billing+lab+pharmacy+compliance)
  P('PAT-54', 'Owen Vale');
  enc('ENC-54', 'PAT-54');
  { const s = study('IMG-54X', 'PAT-54', { contrast: 0, base: 63000, status: 'READ' }); // 75600 past-due charge
    charge('CHG-54A', 'PAT-54', 'IMAGING', 'IMG-54X', s.charge, { status: 'OPEN' });
    const outstanding = s.charge - COPAY_CENTS - STATEMENT_WRITE_OFF_CENTS; // 66600 (> 60000 → money hold)
    finHold('FH-54', 'PAT-54', outstanding);
    gl('COMPLIANCE', 'RECEIVABLE', 'COLLECTIONS', 'PAT-54', 'PAT-54', outstanding); }
  labResult('LAB-54', 'PAT-54', 'POTASSIUM', 7.0, true, { status: 'CRITICAL' });
  dispense('DISP-54', 'PAT-54', { qty: 1, status: 'HELD', hold: 'CRITICAL_LAB_HOLD', charge: 0 }); // safety governs money
  audit('DISPENSE_HELD', 'dispense', 'DISP-54', 'CRITICAL_LAB_HOLD');

  // ── Family F: a copay already SETTLED then pulled must NET the pharmacy revenue
  //   to zero (a reversal contra), book a COMPLIANCE liability + a patient CREDIT,
  //   return the drug, AND mint a discrete REFUND voucher. TRIGGER: DISP-49 pulled.
  P('PAT-49', 'Jae Lund');
  enc('ENC-49', 'PAT-49');
  dispense('DISP-49', 'PAT-49', { qty: 1, status: 'REVERSED', hold: 'REVERSED_AFTER_SETTLE', charge: COPAY_CENTS });
  charge('CHG-49', 'PAT-49', 'COPAY', 'DISP-49', COPAY_CENTS, { status: 'REVERSED' });
  charge('CHG-49C', 'PAT-49', 'CREDIT', 'DISP-49', -COPAY_CENTS, { status: 'OPEN' });
  gl('PHARMACY', 'REVENUE', 'COPAY', 'DISP-49', 'PAT-49', COPAY_CENTS);   // original settle
  gl('PHARMACY', 'REVERSAL', 'COPAY', 'DISP-49', 'PAT-49', -COPAY_CENTS); // net 0
  gl('COMPLIANCE', 'LIABILITY', 'COPAY_REVERSAL', 'DISP-49', 'PAT-49', -COPAY_CENTS);
  movement('MV-49', 'SKU-SED', 'RECEIPT', 1, 'DISP-49');
  refund('RF-49', 'RFND-000049', 'PAT-49', 'dispense', 'DISP-49', COPAY_CENTS, 'REVERSED_AFTER_SETTLE');
  audit('COPAY_REVERSED', 'dispense', 'DISP-49', 'REVERSED_AFTER_SETTLE');

  // ── Family G: paying a patient statement online MINTS a discrete municipal-style
  //   RECEIPT record (a receipt_no), separate from the raw payment row, for the
  //   statement total. DRIVEN via Stripe hosted Checkout. TRIGGER: PAT-50 open
  //   LAB + non-contrast imaging charges → statement 44000.
  P('PAT-50', 'Kara Ng');
  labResult('LAB-50', 'PAT-50', 'GLUCOSE', 115, false, { charge: LAB_CHG });
  charge('CHG-50A', 'PAT-50', 'LAB', 'LAB-50', LAB_CHG, { status: 'OPEN' });
  { const s = study('IMG-50', 'PAT-50', { contrast: 0, status: 'READ' });         // 48000
    charge('CHG-50B', 'PAT-50', 'IMAGING', 'IMG-50', s.charge, { status: 'OPEN' }); }
  // statement total = (5000 + 48000) − 4000 − 5000 = 44000; receipt minted on payment.

  // ── Family H: a lapsed credential FREEZES the provider's panel (not merely leaves
  //   it pending) and RETRO-SWEEPS every open claim carrying that provider's name to
  //   read the lapse. PANEL-LAPSE already seeded FROZEN above. TRIGGER: PRV-LAPSE.
  P('PAT-51', 'Liam Poe');
  dispense('DISP-51', 'PAT-51', { provider: 'PRV-LAPSE', status: 'HELD', hold: 'CREDENTIAL_LAPSED' });
  study('IMG-51', 'PAT-51', { provider: 'PRV-LAPSE', contrast: 0, status: 'BLOCKED', block: 'CREDENTIAL_LAPSED' });
  order('ORD-51', 'PAT-51', { provider: 'PRV-LAPSE', kind: 'LAB', status: 'BLOCKED', block: 'CREDENTIAL_LAPSED' });
  charge('CHG-51', 'PAT-51', 'IMAGING', 'IMG-51', 0, { status: 'OPEN' });
  claim('CLM-51', 'PAT-51', { provider: 'PRV-LAPSE', chargeId: 'CHG-51', amount: 48000, status: 'BLOCKED', block: 'CREDENTIAL_LAPSED', priorAuth: 'NONE' });
  audit('CREDENTIAL_FREEZE', 'panel', 'PANEL-LAPSE', 'CREDENTIAL_LAPSED');

  // ── Family J: a booked run CANCELLED as a NO_SHOW must NET the reserved fare to
  //   zero on the ledger (revenue + reversal = 0), release the rig, and return the
  //   reserved oxygen. TRIGGER: DSP-52 CANCELLED.
  rig('RIG-52', { dvir: 'PASS', hos: 250, status: 'AVAILABLE' });
  P('PAT-52', 'Mona Blair');
  dispatch('DSP-52', 'PAT-52', { rigId: 'RIG-52', status: 'CANCELLED', refuse: 'NO_SHOW', charge: 0 });
  charge('CHG-52', 'PAT-52', 'TRANSPORT', 'DSP-52', TRANSPORT_CHG, { status: 'REVERSED' });
  gl('TRANSPORT', 'REVENUE', 'TRANSPORT', 'DSP-52', 'PAT-52', TRANSPORT_CHG);
  gl('TRANSPORT', 'REVERSAL', 'TRANSPORT', 'DSP-52', 'PAT-52', -TRANSPORT_CHG);
  movement('MV-52', 'SKU-O2', 'RECEIPT', 1, 'DSP-52');
  audit('DISPATCH_CANCELLED', 'dispatch', 'DSP-52', 'NO_SHOW');

  // ── Family K: a critical-lab patient's priority ride carries a flat $75 priority
  //   surcharge ON TOP of the $200 fare (so the fare is $275), and the surcharge
  //   posts as its OWN transport GL line separate from the base fare. TRIGGER:
  //   LAB-53 critical + DSP-53 priority completed.
  P('PAT-53', 'Nora Frei');
  enc('ENC-53', 'PAT-53');
  labResult('LAB-53', 'PAT-53', 'POTASSIUM', 6.6, true, { status: 'CRITICAL' });
  { const fare = TRANSPORT_CHG + PRIORITY_SURCHARGE_CENTS; // 27500
    dispatch('DSP-53', 'PAT-53', { rigId: 'RIG-OK', priority: 1, status: 'COMPLETED', charge: fare });
    movement('MV-53', 'SKU-O2', 'DECREMENT', 1, 'DSP-53');
    charge('CHG-53', 'PAT-53', 'TRANSPORT', 'DSP-53', fare);
    gl('TRANSPORT', 'REVENUE', 'TRANSPORT', 'DSP-53', 'PAT-53', TRANSPORT_CHG);              // base fare
    gl('TRANSPORT', 'PRIORITY_SURCHARGE', 'TRANSPORT', 'DSP-53', 'PAT-53', PRIORITY_SURCHARGE_CENTS); } // separate line

  // ══════════════════════════════════════════════════════════════════════════
  //  ANCHORS — standalone / penny / authz / controls
  // ══════════════════════════════════════════════════════════════════════════

  // p_ledger_penny: FENTANYL ledger — 3 receipts (+100,+50,+30) + 2 dispenses (−6,−4) → 170.
  ledgerEntry('LG-F1', 'Fentanyl (controlled)', 'SKU-FENT', 'RECEIPT', 100, 'RCV-F1');
  ledgerEntry('LG-F2', 'Fentanyl (controlled)', 'SKU-FENT', 'RECEIPT', 50, 'RCV-F2');
  ledgerEntry('LG-F3', 'Fentanyl (controlled)', 'SKU-FENT', 'RECEIPT', 30, 'RCV-F3');
  ledgerEntry('LG-F4', 'Fentanyl (controlled)', 'SKU-FENT', 'DISPENSE', 6, 'DISP-F1');
  ledgerEntry('LG-F5', 'Fentanyl (controlled)', 'SKU-FENT', 'DISPENSE', 4, 'DISP-F2');

  // s_supply_onhand_decrement: SKU-GLOVE baseline 100, one DECREMENT qty 3 → 97.
  movement('MV-GL', 'SKU-GLOVE', 'DECREMENT', 3, 'SEED-DEMO');

  // s_claim_prior_auth_threshold: one > $500 (REQUIRED) + one ≤ $500 (not required).
  P('PAT-PA', 'Pat Authurst');
  { const s1 = study('IMG-PA1', 'PAT-PA', { contrast: 1, status: 'READ' });   // 63000 > $500
    charge('CHG-PA1', 'PAT-PA', 'IMAGING', 'IMG-PA1', s1.charge);
    claim('CLM-PA1', 'PAT-PA', { chargeId: 'CHG-PA1', amount: s1.charge, status: 'BLOCKED', block: 'PRIOR_AUTH_REQUIRED', priorAuth: 'REQUIRED' }); }
  { const s2 = study('IMG-PA2', 'PAT-PA', { contrast: 0, status: 'READ' });   // 48000 ≤ $500
    charge('CHG-PA2', 'PAT-PA', 'IMAGING', 'IMG-PA2', s2.charge);
    claim('CLM-PA2', 'PAT-PA', { chargeId: 'CHG-PA2', amount: s2.charge, status: 'DRAFT', priorAuth: 'NONE' }); }

  // (legacy statement fixture retained for roster parity; graded by the
  //  multi-domain statement composition below, not a single-rule anchor.)
  P('PAT-ST', 'Stan Statement');
  labResult('LAB-ST', 'PAT-ST', 'POTASSIUM', 4.0, false, { status: 'RESULTED' });
  charge('CHG-ST1', 'PAT-ST', 'LAB', 'LAB-ST', LAB_CHG, { status: 'OPEN' });
  { const s = study('IMG-ST', 'PAT-ST', { contrast: 0, status: 'READ' });
    charge('CHG-ST2', 'PAT-ST', 'IMAGING', 'IMG-ST', s.charge, { status: 'OPEN' }); }

  // ══════════════════════════════════════════════════════════════════════════
  //  EDGE-CASE COMPOSITIONS — rule intersections / boundary / degenerate /
  //  two-book reconciliations. Each grades an EXACT derived value that only
  //  resolves when two or more buried rules compose in the right order (these
  //  replace the earlier single-rule anchors). Inputs are roster data; the
  //  derivations, precedence and connections are hidden in the brief's anecdotes.
  // ══════════════════════════════════════════════════════════════════════════

  // ── A: PRIOR-AUTH BOUNDARY. The $500 line is on the CLAIM CHARGE — which
  //   INCLUDES the facility fee — not the bare procedure. A $420 base scan whose
  //   facility fee pushes the charge to 50400 needs prior-auth; a $410 base at
  //   49200 does not. Both bases are under $500. (imaging+billing+compliance+clinic)
  P('PAT-PB', 'Percy Boyd');
  enc('ENC-PB', 'PAT-PB');
  { const s1 = study('IMG-PB1', 'PAT-PB', { contrast: 0, base: 42000, status: 'READ' }); // 42000 + 8400 = 50400 > 50000
    charge('CHG-PB1', 'PAT-PB', 'IMAGING', 'IMG-PB1', s1.charge);
    claim('CLM-PB1', 'PAT-PB', { chargeId: 'CHG-PB1', amount: s1.charge, status: 'BLOCKED', block: 'PRIOR_AUTH_REQUIRED', priorAuth: 'REQUIRED' });
    const s2 = study('IMG-PB2', 'PAT-PB', { contrast: 0, base: 41000, status: 'READ' }); // 41000 + 8200 = 49200 <= 50000
    charge('CHG-PB2', 'PAT-PB', 'IMAGING', 'IMG-PB2', s2.charge);
    claim('CLM-PB2', 'PAT-PB', { chargeId: 'CHG-PB2', amount: s2.charge, status: 'DRAFT', priorAuth: 'NONE' }); }

  // ── B: ZERO-BASE CONTRAST ADDENDUM (degenerate). A dye add-on read filed with
  //   NO base procedure of its own: the facility fee is a fifth of ZERO, so the
  //   charge is the $150 dye alone (15000), yet the bottle still bills and still
  //   books to supply as a 15000 cost. (imaging+supply+billing+compliance)
  P('PAT-ZB', 'Zoe Bram');
  { const s = study('IMG-ZB', 'PAT-ZB', { contrast: 1, base: 0, status: 'READ' }); // 0 + 15000 + 0 = 15000; facility 0
    movement('MV-ZB', 'SKU-CONTRAST', 'DECREMENT', 1, 'IMG-ZB');
    charge('CHG-ZB', 'PAT-ZB', 'IMAGING', 'IMG-ZB', s.charge);
    gl('IMAGING', 'REVENUE', 'IMAGING', 'IMG-ZB', 'PAT-ZB', s.charge);
    gl('SUPPLY', 'COGS', 'IMAGING', 'IMG-ZB', 'PAT-ZB', 1 * unitOf('SKU-CONTRAST')); }

  // ── C: MULTI-DOMAIN STATEMENT. One patient with a contrast scan (facility on
  //   the base only → 63000), a lab draw (5000) and a transport run (20000). The
  //   statement nets the copay THEN the write-off: 88000 − 4000 − 5000 = 79000.
  //   (imaging+lab+transport+billing+clinic)
  P('PAT-MC', 'Mira Cole');
  enc('ENC-MC', 'PAT-MC');
  { const s = study('IMG-MC', 'PAT-MC', { contrast: 1, status: 'READ' });  // 63000
    charge('CHG-MC1', 'PAT-MC', 'IMAGING', 'IMG-MC', s.charge, { status: 'OPEN' });
    labResult('LAB-MC', 'PAT-MC', 'GLUCOSE', 100, false, { charge: LAB_CHG });
    charge('CHG-MC2', 'PAT-MC', 'LAB', 'LAB-MC', LAB_CHG, { status: 'OPEN' });
    dispatch('DSP-MC', 'PAT-MC', { rigId: 'RIG-OK', status: 'COMPLETED', charge: TRANSPORT_CHG });
    movement('MV-MC', 'SKU-O2', 'DECREMENT', 1, 'DSP-MC');
    charge('CHG-MC3', 'PAT-MC', 'TRANSPORT', 'DSP-MC', TRANSPORT_CHG, { status: 'OPEN' }); }
  // statement total = (63000 + 5000 + 20000) − 4000 − 5000 = 79000

  // ── D: LEDGER vs SHELF RECONCILIATION. The controlled book for Fentanyl runs
  //   170 (Σ receipts − Σ dispenses) but the physical shelf reads 168 — a 2-unit
  //   shrinkage. The gap books to supply at unit cost: |170 − 168| × 3000 = 6000.
  //   (pharmacy+supply+compliance)
  gl('SUPPLY', 'RECONCILIATION', 'LEDGER_VARIANCE', 'SKU-FENT', null, Math.abs(170 - 168) * CTRL_UNIT); // 6000
  audit('LEDGER_SHELF_VARIANCE', 'sku', 'SKU-FENT', 'CONTROLLED_SHRINKAGE');

  // ── E: CYCLE-COUNT VARIANCE. Gloves counted 95 against a system 97 → a 2-unit
  //   gap that books to supply for the exact dollar difference: 2 × 100 = 200.
  //   The count is not yet due, so the close leaves its flag alone.
  //   (supply+billing+compliance)
  cycleCount('CC-GLOVE', 'SKU-GLOVE', 95, 97, { flagged: 0, due: expiryFuture });
  gl('SUPPLY', 'RECONCILIATION', 'CYCLE_VARIANCE', 'CC-GLOVE', null, Math.abs(97 - 95) * unitOf('SKU-GLOVE')); // 200
  audit('CYCLE_COUNT_VARIANCE', 'cycle_count', 'CC-GLOVE', 'COUNT_SHORT');

  // ── Controls (must NOT change at close-of-shift) ──
  P('PAT-CTL', 'Control Case');
  labResult('LAB-CTL', 'PAT-CTL', 'POTASSIUM', 4.0, false, { at: recent });
  cycleCount('CC-CTL', 'SKU-O2', 50, 50, { flagged: 0, due: expiryFuture });
  charge('CHG-CTL', 'PAT-CTL', 'DISPENSE', 'DISP-CTL', 5000, { status: 'SETTLED', swept: 1 });

  // ── z_site_isolation: SITE-B patient ──
  P('PAT-SITEB', 'Della Souza', 'SITE-B');
  enc('ENC-SITEB', 'PAT-SITEB', { site: 'SITE-B' });

  // ── close-of-shift pre-state (PAT-10) ──
  P('PAT-10', 'Jade Lu');
  charge('CHG-10', 'PAT-10', 'DISPENSE', 'DISP-10', 6000, { status: 'SETTLED', swept: 0 });
  labResult('LAB-10', 'PAT-10', 'POTASSIUM', 6.5, true, { status: 'CRITICAL', at: old30 });
  cycleCount('CC-10', 'SKU-SED', 58, 60, { flagged: 0, due: old30 });
  ledgerEntry('LG-10R', 'Midazolam (controlled)', 'SKU-SED', 'RECEIPT', 10, 'RCV-10');
}

// Parity guard — proves the seeded DB is id/identity-identical to the shared
// roster asset (single source of truth). The roster carries only DATA; derived
// amounts, hidden rules, connections and precedence are NOT in it.
export function assertRosterParity(db) {
  const problems = [];
  for (const u of ROSTER.records.users) {
    const row = db.prepare('SELECT role FROM users WHERE id = ?').get(u.id);
    if (!row) problems.push(`identity missing ${u.id}`);
    else if (row.role !== u.role) problems.push(`identity role drift ${u.id} ${row.role}!=${u.role}`);
  }
  const checks = [
    ['patients', 'party_id', null],
    ['providers', 'provider_id', null],
    ['skus', 'id', null],
    ['dispenses', 'id', 'party_id'],
    ['imaging_studies', 'id', 'party_id'],
    ['lab_results', 'id', 'party_id'],
    ['dispatches', 'id', 'party_id'],
    ['claims', 'id', 'party_id'],
    ['charges', 'id', 'party_id']
  ];
  for (const [tbl, idKey, partyKey] of checks) {
    for (const rec of ROSTER.records[tbl] || []) {
      const row = db.prepare(`SELECT * FROM ${tbl} WHERE ${idKey} = ?`).get(rec[idKey]);
      if (!row) { problems.push(`${tbl} missing ${rec[idKey]}`); continue; }
      if (partyKey && row.party_id !== rec[partyKey]) {
        problems.push(`${tbl} ${rec[idKey]} party drift ${row.party_id}!=${rec[partyKey]}`);
      }
    }
  }
  if (problems.length) {
    throw new Error(`ROSTER PARITY DRIFT (${problems.length}): ${problems.slice(0, 12).join('; ')}`);
  }
}
