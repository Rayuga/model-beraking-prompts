import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seed, assertRosterParity } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'medledger.db');

let raw = null;
let usingBetterSqlite = false;
try {
  const mod = await import('better-sqlite3');
  const Database = mod.default;
  raw = new Database(DB_PATH);
  raw.pragma('foreign_keys = ON');
  raw.pragma('journal_mode = WAL');
  raw.pragma('busy_timeout = 5000');
  usingBetterSqlite = true;
} catch (_err) {
  const mod = await import('node:sqlite');
  const { DatabaseSync } = mod;
  raw = new DatabaseSync(DB_PATH);
  raw.exec('PRAGMA foreign_keys = ON');
  raw.exec('PRAGMA journal_mode = WAL');
  raw.exec('PRAGMA busy_timeout = 5000');
}

export const db = {
  exec: (sql) => raw.exec(sql),
  prepare: (sql) => raw.prepare(sql),
  transaction(fn) {
    return (...args) => {
      raw.exec('BEGIN IMMEDIATE');
      try {
        const result = fn(...args);
        raw.exec('COMMIT');
        return result;
      } catch (error) {
        try { raw.exec('ROLLBACK'); } catch { /* ignore */ }
        throw error;
      }
    };
  },
  _usingBetterSqlite: () => usingBetterSqlite
};

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
  );

  -- ── Identity spine (the vocabulary-drift join keys) ──────────────────────
  -- ONE party is patient (D1) / payer-guarantor (D7) / consent-subject (D8).
  -- ONE provider is ordering (D1) / rendering (D7) / panel-holder (D8). Only the
  -- matching id reveals they are one person; each domain uses its own word.
  CREATE TABLE IF NOT EXISTS parties (
    party_id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    site_id TEXT REFERENCES sites(id),
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS providers (
    provider_id TEXT PRIMARY KEY,
    canonical_name TEXT NOT NULL,
    site_id TEXT REFERENCES sites(id),
    created_at_ms INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN (
      'ADMINISTRATOR','CLINICIAN','PHARMACIST','LAB_TECH','RADIOLOGIST',
      'TRANSPORT_DISPATCHER','SUPPLY_MANAGER','BILLING_CLERK','COMPLIANCE_OFFICER'
    )),
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS user_site_assignments (
    user_id TEXT NOT NULL REFERENCES users(id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    PRIMARY KEY (user_id, site_id)
  );

  -- ── D1 Clinic ─────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS patients (
    party_id TEXT PRIMARY KEY REFERENCES parties(party_id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    name TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS encounters (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    provider_id TEXT REFERENCES providers(provider_id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    status TEXT NOT NULL DEFAULT 'OPEN',
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    provider_id TEXT REFERENCES providers(provider_id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    kind TEXT NOT NULL,
    target_ref TEXT,
    status TEXT NOT NULL DEFAULT 'OPEN',
    block_reason TEXT,
    created_at_ms INTEGER NOT NULL
  );

  -- ── D2 Pharmacy ─────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS dispenses (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    provider_id TEXT REFERENCES providers(provider_id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    drug TEXT NOT NULL,
    sku_id TEXT REFERENCES skus(id),
    qty INTEGER NOT NULL DEFAULT 0,
    controlled INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    hold_reason TEXT,
    charge_cents INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS controlled_ledger (
    id TEXT PRIMARY KEY,
    drug TEXT NOT NULL,
    sku_id TEXT REFERENCES skus(id),
    entry_type TEXT NOT NULL CHECK (entry_type IN ('RECEIPT','DISPENSE')),
    qty INTEGER NOT NULL DEFAULT 0,
    ref_id TEXT,
    created_at_ms INTEGER NOT NULL
  );

  -- ── D3 Lab ──────────────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS lab_orders (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    provider_id TEXT REFERENCES providers(provider_id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    analyte TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS lab_results (
    id TEXT PRIMARY KEY,
    order_id TEXT REFERENCES lab_orders(id),
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    analyte TEXT NOT NULL,
    value REAL NOT NULL,
    critical INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'RESULTED',
    charge_cents INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL
  );

  -- ── D4 Imaging / Radiology ───────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS imaging_studies (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    provider_id TEXT REFERENCES providers(provider_id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    modality TEXT NOT NULL,
    contrast INTEGER NOT NULL DEFAULT 0,
    sku_id TEXT REFERENCES skus(id),
    base_cents INTEGER NOT NULL DEFAULT 0,
    charge_cents INTEGER NOT NULL DEFAULT 0,
    facility_fee_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'ORDERED',
    block_reason TEXT,
    created_at_ms INTEGER NOT NULL
  );

  -- ── D5 Medical transport ─────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS rigs (
    id TEXT PRIMARY KEY,
    site_id TEXT NOT NULL REFERENCES sites(id),
    dvir_status TEXT NOT NULL DEFAULT 'PASS',
    hos_minutes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'AVAILABLE',
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS dispatches (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    rig_id TEXT REFERENCES rigs(id),
    site_id TEXT NOT NULL REFERENCES sites(id),
    priority INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    refuse_reason TEXT,
    sku_id TEXT REFERENCES skus(id),
    charge_cents INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL
  );

  -- ── D6 Central supply ─────────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS skus (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit_cost_cents INTEGER NOT NULL DEFAULT 0,
    on_hand INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS supply_movements (
    id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL REFERENCES skus(id),
    type TEXT NOT NULL CHECK (type IN ('RECEIPT','DECREMENT','ADJUSTMENT')),
    qty INTEGER NOT NULL DEFAULT 0,
    ref_id TEXT,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS cycle_counts (
    id TEXT PRIMARY KEY,
    sku_id TEXT NOT NULL REFERENCES skus(id),
    counted INTEGER NOT NULL DEFAULT 0,
    system_qty INTEGER NOT NULL DEFAULT 0,
    variance_cents INTEGER NOT NULL DEFAULT 0,
    flagged INTEGER NOT NULL DEFAULT 0,
    due_ms INTEGER,
    created_at_ms INTEGER NOT NULL
  );

  -- ── D7 Billing / Claims ───────────────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS charges (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    source_type TEXT NOT NULL,
    source_ref TEXT,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'OPEN',
    swept INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS claims (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    provider_id TEXT REFERENCES providers(provider_id),
    charge_id TEXT REFERENCES charges(id),
    amount_cents INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'DRAFT',
    block_reason TEXT,
    deny_reason TEXT,
    prior_auth TEXT NOT NULL DEFAULT 'NONE',
    consent_ref TEXT,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    party_id TEXT REFERENCES parties(party_id),
    channel TEXT NOT NULL CHECK (channel IN ('COPAY','STATEMENT')),
    ref_type TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('PENDING','SETTLED','FAILED')),
    stripe_ref TEXT,
    session_paid INTEGER NOT NULL DEFAULT 0,
    settled_at_ms INTEGER,
    created_at_ms INTEGER NOT NULL
  );

  -- ── D8 Credentialing / Compliance ─────────────────────────────────────────────
  CREATE TABLE IF NOT EXISTS credentials (
    provider_id TEXT PRIMARY KEY REFERENCES providers(provider_id),
    expiry_ms INTEGER NOT NULL,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS envelopes (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind IN ('CONSENT','ATTESTATION','CREDENTIALING')),
    docuseal_id TEXT,
    status TEXT NOT NULL CHECK (status IN ('SENT','EXECUTED','VOIDED')),
    ref_type TEXT,
    ref_id TEXT,
    sent_at_ms INTEGER,
    executed_at_ms INTEGER,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS panels (
    id TEXT PRIMARY KEY,
    provider_id TEXT NOT NULL REFERENCES providers(provider_id),
    status TEXT NOT NULL DEFAULT 'PENDING',
    block_reason TEXT,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS gl_lines (
    id TEXT PRIMARY KEY,
    dept TEXT NOT NULL CHECK (dept IN ('CLINIC','PHARMACY','LAB','IMAGING','TRANSPORT','SUPPLY','BILLING','COMPLIANCE')),
    line_type TEXT NOT NULL DEFAULT 'REVENUE',
    source_type TEXT,
    source_ref TEXT,
    party_id TEXT REFERENCES parties(party_id),
    amount_cents INTEGER NOT NULL DEFAULT 0,
    posted_ms INTEGER NOT NULL,
    created_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS gl_ref_idx ON gl_lines(source_ref);
  CREATE INDEX IF NOT EXISTS gl_dept_idx ON gl_lines(dept);

  CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    reason TEXT,
    created_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_events(entity_type, entity_id);

  -- ── Secondary derived-record ledgers (the buried cross-domain cascades) ────
  -- Formal, discrete records a satisficing build never mints: a DEA Form 222 for
  -- a controlled fill, a refund voucher for a pulled copay, a municipal-style
  -- receipt for a paid statement, and a financial (collections) hold that freezes
  -- a party's NEW orders across departments.
  CREATE TABLE IF NOT EXISTS dea_forms (
    id TEXT PRIMARY KEY,
    form_no TEXT NOT NULL,
    dispense_id TEXT NOT NULL,
    party_id TEXT REFERENCES parties(party_id),
    provider_id TEXT REFERENCES providers(provider_id),
    drug TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 0,
    schedule TEXT NOT NULL DEFAULT 'II',
    created_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS dea_form_ref_idx ON dea_forms(dispense_id);
  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY,
    refund_no TEXT NOT NULL,
    party_id TEXT REFERENCES parties(party_id),
    ref_type TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    reason TEXT,
    created_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS refund_ref_idx ON refunds(ref_id);
  CREATE TABLE IF NOT EXISTS receipts (
    id TEXT PRIMARY KEY,
    receipt_no TEXT NOT NULL,
    party_id TEXT REFERENCES parties(party_id),
    ref_type TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    amount_cents INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS receipt_ref_idx ON receipts(ref_id);
  CREATE TABLE IF NOT EXISTS financial_holds (
    id TEXT PRIMARY KEY,
    party_id TEXT NOT NULL REFERENCES parties(party_id),
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    reason TEXT NOT NULL DEFAULT 'COLLECTIONS_HOLD',
    outstanding_cents INTEGER NOT NULL DEFAULT 0,
    created_at_ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS finhold_party_idx ON financial_holds(party_id);

  -- ── Stripe webhook idempotency + delivery ledger (app-owned) ──────────────
  CREATE TABLE IF NOT EXISTS stripe_events (
    event_id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    session_id TEXT,
    processed_count INTEGER NOT NULL DEFAULT 1,
    created_at_ms INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    type TEXT NOT NULL,
    session_id TEXT,
    payload TEXT NOT NULL,
    signature TEXT NOT NULL,
    accepted INTEGER NOT NULL DEFAULT 1,
    created_at_ms INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clock (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    now_ms_override INTEGER NULL
  );
  INSERT OR IGNORE INTO clock (id, now_ms_override) VALUES (1, NULL);
`);

// Fixed clinical clock so aging/expiry/HOS are deterministic across runs.
const CLINICAL_CLOCK_MS = Date.parse('2026-08-17T10:00:00.000Z');

export function getNowMs() {
  const row = db.prepare('SELECT now_ms_override FROM clock WHERE id = 1').get();
  if (row?.now_ms_override !== null && row?.now_ms_override !== undefined) {
    return Number(row.now_ms_override);
  }
  return CLINICAL_CLOCK_MS;
}

export function getUserById(id) {
  return db.prepare(`SELECT id, full_name, email, role, disabled FROM users WHERE id = ?`).get(id);
}
export function listUsers() {
  return db.prepare(`SELECT id, full_name, email, role, disabled FROM users ORDER BY created_at_ms ASC`).all();
}

export function seedIfNeeded() {
  const row = db.prepare(`SELECT COUNT(*) AS c FROM users`).get();
  if (row?.c > 0) return;
  seed(db);
}

seedIfNeeded();
// Prove the seeded fixtures are id/identity-identical to the shared roster asset.
assertRosterParity(db);
