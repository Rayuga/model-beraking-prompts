// ─── Clinical / money math — every constant here is STATED in the brief ──────
// Money in cents; round half-up to the cent. Facility fee = 20% of the BASE
// procedure charge only (never including the contrast add-on). Contrast add-on
// flat $150.00. Prior-auth required when a claim charge exceeds $500.00. Lab
// critical: serum potassium > 6.0 mmol/L, INR > 4.5. HOS limit 660 on-duty
// minutes. Credential LAPSED when expiry precedes the clinical clock. Controlled
// ledger running balance = Σ receipts − Σ dispenses.

export const COPAY_CENTS = 4000;               // flat $40.00
export const CONTRAST_ADDON_CENTS = 15000;     // flat $150.00
export const FACILITY_RATE = 0.20;             // 20% of BASE only
export const PRIOR_AUTH_THRESHOLD_CENTS = 50000; // > $500.00
export const K_CRITICAL = 6.0;                 // serum potassium mmol/L
export const INR_CRITICAL = 4.5;
export const HOS_LIMIT_MIN = 660;              // 11h on-duty
export const STATEMENT_WRITE_OFF_CENTS = 5000; // standing $50.00 courtesy write-off

// ── Buried cross-domain rule inputs (STATED in the brief; only the connection,
//    precedence and derivation are for the builder to infer) ─────────────────
export const CONTRACTUAL_ALLOWANCE_RATE = 0.18; // payer keeps back 18% on a DENIED claim
export const SAFETY_RESERVE_CENTS = 25000;      // flat $250.00 patient-safety incident reserve
export const COLLECTIONS_THRESHOLD_CENTS = 60000; // balance over $600.00 → collections hold
export const DEA_AUDIT_THRESHOLD_CENTS = 15000;   // controlled fill value ≥ $150.00 → DEA audit memo
export const PRIORITY_SURCHARGE_CENTS = 7500;     // flat $75.00 critical-lab priority transport surcharge

// A denied claim: the payer keeps a standing 18% contractual allowance, so the
// patient is left owing (charge − allowance); the allowance itself is written down.
export function contractualAllowance(chargeCents) {
  return roundHalfUp(Number(chargeCents || 0) * CONTRACTUAL_ALLOWANCE_RATE);
}
export function deniedPatientBalance(chargeCents) {
  return Number(chargeCents || 0) - contractualAllowance(chargeCents);
}

export function roundHalfUp(value) {
  if (value >= 0) return Math.floor(value + 0.5);
  return Math.ceil(value - 0.5);
}

export function centsToDollars(cents) {
  return (Number(cents || 0) / 100).toFixed(2);
}

// Facility fee = 20% of the BASE procedure charge ONLY. Not on the contrast add-on.
export function facilityFee(baseCents, rate = FACILITY_RATE) {
  return roundHalfUp(Number(baseCents || 0) * rate);
}

// Total imaging charge = base + (contrast ? $150 : 0) + facility fee (on base only).
export function imagingCharge(baseCents, contrast) {
  const base = Number(baseCents || 0);
  return base + (contrast ? CONTRAST_ADDON_CENTS : 0) + facilityFee(base);
}

// A claim whose charge exceeds $500.00 requires prior-auth.
export function priorAuthRequired(chargeCents) {
  return Number(chargeCents || 0) > PRIOR_AUTH_THRESHOLD_CENTS;
}

// Lab critical thresholds (the words on the chart live in the brief).
export function isCriticalLab(analyte, value) {
  const v = Number(value);
  const a = String(analyte || '').toUpperCase();
  if (a === 'POTASSIUM' || a === 'K') return v > K_CRITICAL;
  if (a === 'INR') return v > INR_CRITICAL;
  return false;
}

// Credential LAPSED if its expiry precedes the clock.
export function credentialLapsed(expiryMs, nowMs) {
  return Number(expiryMs) < Number(nowMs);
}

// A driver over 660 on-duty minutes is over hours.
export function hosExceeded(minutes) {
  return Number(minutes || 0) > HOS_LIMIT_MIN;
}

// Controlled-ledger running balance = Σ receipts − Σ dispenses (append-only).
export function ledgerBalance(entries) {
  let bal = 0;
  for (const e of entries) {
    if (e.entry_type === 'RECEIPT') bal += Number(e.qty || 0);
    else if (e.entry_type === 'DISPENSE') bal -= Number(e.qty || 0);
  }
  return bal;
}

export function ageDays(fromMs, nowMs) {
  return Math.floor((Number(nowMs) - Number(fromMs)) / 86400000);
}
