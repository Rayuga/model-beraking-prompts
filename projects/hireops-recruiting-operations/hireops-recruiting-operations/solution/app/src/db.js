'use strict';
// hireops data layer. Opens SQLite, creates the schema and seeds it ONCE. If the
// users table is non-empty the seed returns immediately and nothing is reset, so
// state survives a restart. The golden reads its OWN co-located seed roster so
// moving the shipped asset can never break it. Aggregates (budget headroom, net
// payroll outflow) are always SUMMED FROM ROWS; no stored composite total is ever
// trusted.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.HIREOPS_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'app.db');
const SEED_PATH = process.env.SEED_PATH || (fs.existsSync(path.join(__dirname, 'seed_data.json')) ? path.join(__dirname, 'seed_data.json') : (fs.existsSync(path.join(__dirname, '..', 'seed_data.json')) ? path.join(__dirname, '..', 'seed_data.json') : '/assets/seed_data.json'));
const ROSTER = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

// Stated reference data — read straight from the roster, never built by a write route.
const reference = {
  constants: ROSTER.constants,
};

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  createSchema(db);
  seedIfEmpty(db);
  return db;
}

function createSchema(db) {
  db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, role TEXT NOT NULL, authority_tier INTEGER,
    suspended INTEGER NOT NULL DEFAULT 0);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);

  -- The single stored reference moment, fixed at seed. Nothing in this app ever
  -- asks the operating system what time it is. Referral vesting compares a hire's
  -- 6-month cliff against THIS moment; signing/equity clawback compares against a
  -- rescission's OWN stored effective date.
  CREATE TABLE IF NOT EXISTS system_clock (
    id TEXT PRIMARY KEY, reference_at TEXT NOT NULL, reference_date TEXT NOT NULL);

  -- Referring employees (the recipients of a referral bonus).
  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY, name TEXT NOT NULL);

  -- Requisitions carry an annualized comp budget and a WRONG stated_headroom
  -- scalar. True headroom is budget + SUM(commitment_movements rows).
  CREATE TABLE IF NOT EXISTS requisitions (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, dept TEXT NOT NULL,
    budget_cents INTEGER NOT NULL, stated_headroom_scalar_cents INTEGER NOT NULL DEFAULT 0, note TEXT);

  -- Offers. The comp desk's raw inputs are stored; every composed figure (equity
  -- intrinsic, annualized, committed run-rate, approval-band basis) is DERIVED in
  -- rules.js, never a stored composite. status walks DRAFT -> PENDING -> COMMITTED,
  -- and a correction is a SUPERSEDED / RESCINDED marking plus new rows, never an edit.
  CREATE TABLE IF NOT EXISTS offers (
    id TEXT PRIMARY KEY, req_id TEXT NOT NULL REFERENCES requisitions(id),
    candidate TEXT NOT NULL, status TEXT NOT NULL,
    base_salary_cents INTEGER NOT NULL, signing_bonus_cents INTEGER NOT NULL DEFAULT 0,
    relocation_cents INTEGER NOT NULL DEFAULT 0,
    equity_units INTEGER NOT NULL DEFAULT 0, equity_fair_cents INTEGER NOT NULL DEFAULT 0,
    equity_strike_cents INTEGER NOT NULL DEFAULT 0,
    referred_by TEXT, referred_hire_start TEXT, start_date TEXT NOT NULL,
    raised_by TEXT, raised_at TEXT, approved_by TEXT, approved_at TEXT,
    supersedes_id TEXT, superseded_by_id TEXT,
    rescinded_at TEXT, rescission_effective_at TEXT, note TEXT);

  -- Budget commitment movements. Headroom = req.budget + SUM(movement_cents). A
  -- COMMIT is negative (consumes), a REVERSAL / RELEASE is positive (restores).
  -- Never a stored running total; always summed from these rows.
  CREATE TABLE IF NOT EXISTS commitment_movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, req_id TEXT NOT NULL REFERENCES requisitions(id),
    offer_id TEXT NOT NULL, kind TEXT NOT NULL, movement_cents INTEGER NOT NULL,
    ref TEXT, created_at TEXT NOT NULL);

  -- The cap-table twin's own persisted grant rows. Minted on approval; a rescission
  -- appends a cancellation row for the UNVESTED units (never edits the grant).
  CREATE TABLE IF NOT EXISTS equity_grants (
    id TEXT PRIMARY KEY, offer_id TEXT NOT NULL, units INTEGER NOT NULL,
    strike_cents INTEGER NOT NULL, fair_cents INTEGER NOT NULL, grant_date TEXT NOT NULL,
    schedule_note TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'LIVE', created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS equity_cancellations (
    id TEXT PRIMARY KEY, grant_id TEXT NOT NULL REFERENCES equity_grants(id), offer_id TEXT NOT NULL,
    effective_at TEXT NOT NULL, vested_units INTEGER NOT NULL, cancelled_units INTEGER NOT NULL,
    ref TEXT, created_at TEXT NOT NULL);

  -- Referral accruals keyed to the REFERRING employee (not the candidate). Total is
  -- the stated flat bonus, split 50% at hire / 50% at the 6-month retention cliff;
  -- the vested portion is DERIVED at read time against the reference moment.
  CREATE TABLE IF NOT EXISTS referral_accruals (
    id TEXT PRIMARY KEY, offer_id TEXT NOT NULL, referrer_id TEXT NOT NULL REFERENCES employees(id),
    candidate TEXT NOT NULL, referred_hire_start TEXT NOT NULL, total_cents INTEGER NOT NULL,
    at_hire_cents INTEGER NOT NULL, contingent_cents INTEGER NOT NULL, created_at TEXT NOT NULL);

  -- The payroll / remittance twin's own persisted rows. Signing & referral bonuses
  -- remit here; a clawback contra posts against it. Net payroll outflow for an offer
  -- is SUMMED from these rows (remittance minus contra), never a recomputed scalar.
  CREATE TABLE IF NOT EXISTS remittances (
    id TEXT PRIMARY KEY, offer_id TEXT NOT NULL, kind TEXT NOT NULL,
    amount_cents INTEGER NOT NULL, ref TEXT, created_at TEXT NOT NULL);

  -- Append-only after-images: the computed-figure snapshot each approve / revise /
  -- rescind writes. Corrections are additions; this trail is never edited or deleted.
  CREATE TABLE IF NOT EXISTS after_images (
    id INTEGER PRIMARY KEY AUTOINCREMENT, offer_id TEXT, action TEXT NOT NULL,
    actor_id TEXT, figures_json TEXT NOT NULL, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, action TEXT NOT NULL,
    subject TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL);
  `);
}

function seedIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (n > 0) return;                     // never re-seed: state must survive a restart
  const s = ROSTER;
  const pw = 'Hireops!2026'; // Public demo credential specified in instruction.md.
  const REF = s.reference_moment;
  const run = (sql, ...a) => db.prepare(sql).run(...a);
  const C = s.constants;

  const tx = db.transaction(() => {
    run('INSERT INTO system_clock (id,reference_at,reference_date) VALUES (?,?,?)',
        'CLOCK', REF, REF.slice(0, 10));

    for (const e of s.employees)
      run('INSERT INTO employees (id,name) VALUES (?,?)', e.id, e.name);

    for (const u of s.users)
      run('INSERT INTO users (id,name,email,password,role,authority_tier,suspended) VALUES (?,?,?,?,?,?,0)',
          u.id, u.name, u.email.toLowerCase(), pw, u.role, u.authority_tier == null ? null : u.authority_tier);

    for (const r of s.requisitions)
      run('INSERT INTO requisitions (id,title,dept,budget_cents,stated_headroom_scalar_cents,note) VALUES (?,?,?,?,?,?)',
          r.id, r.title, r.dept, r.budget_cents, r.stated_headroom_scalar_cents || 0, r.note || null);

    for (const o of s.offers)
      run(`INSERT INTO offers (id,req_id,candidate,status,base_salary_cents,signing_bonus_cents,relocation_cents,
           equity_units,equity_fair_cents,equity_strike_cents,referred_by,referred_hire_start,start_date,
           raised_by,raised_at,approved_by,approved_at,supersedes_id,superseded_by_id,rescinded_at,rescission_effective_at,note)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,NULL,NULL,?)`,
          o.id, o.req_id, o.candidate, o.status, o.base_salary_cents, o.signing_bonus_cents || 0,
          o.relocation_cents || 0, o.equity_units || 0, o.equity_fair_cents || 0, o.equity_strike_cents || 0,
          o.referred_by || null, o.referred_hire_start || null, o.start_date,
          o.raised_by || null, o.raised_at || null, o.approved_by || null, o.approved_at || null, o.note || null);

    for (const c of s.seed_commitments)
      run(`INSERT INTO commitment_movements (req_id,offer_id,kind,movement_cents,ref,created_at)
           VALUES (?,?,?,?,?,?)`, c.req_id, c.offer_id, 'COMMIT', c.movement_cents, 'SEED', REF);

    for (const g of (s.seed_equity_grants || []))
      run(`INSERT INTO equity_grants (id,offer_id,units,strike_cents,fair_cents,grant_date,schedule_note,state,created_at)
           VALUES (?,?,?,?,?,?,?,?,?)`, `GR-${g.offer_id}`, g.offer_id, g.units, g.strike_cents, g.fair_cents,
          g.grant_date, `${C.equity_vesting.cliff_bp / 100}% at the ${C.equity_vesting.cliff_months}-month cliff, then +${C.equity_vesting.monthly_bp / 100}% per completed month to 100% at ${C.equity_vesting.full_months} months`, 'LIVE', REF);

    for (const rm of (s.seed_remittances || []))
      run(`INSERT INTO remittances (id,offer_id,kind,amount_cents,ref,created_at) VALUES (?,?,?,?,?,?)`,
          `RM-${rm.offer_id}-${rm.kind}`, rm.offer_id, rm.kind, rm.amount_cents, 'SEED', REF);

    for (const ra of (s.seed_referral_accruals || [])) {
      const atHire = Math.floor(C.referral_bonus_cents * C.referral_at_hire_bp / 10000);
      run(`INSERT INTO referral_accruals (id,offer_id,referrer_id,candidate,referred_hire_start,total_cents,at_hire_cents,contingent_cents,created_at)
           VALUES (?,?,?,?,?,?,?,?,?)`, `RA-${ra.offer_id}`, ra.offer_id, ra.referrer_id, ra.candidate,
          ra.referred_hire_start, C.referral_bonus_cents, atHire, C.referral_bonus_cents - atHire, REF);
    }

    run('INSERT INTO audit_log (actor_id,action,subject,detail,created_at) VALUES (NULL,?,?,?,?)',
        'SEEDED', 'HIREOPS', 'roster loaded', REF);
  });
  tx();
}

module.exports = { open, createSchema, seedIfEmpty, reference, DB_PATH, DATA_DIR, SEED_PATH };
