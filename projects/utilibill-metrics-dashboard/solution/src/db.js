'use strict';
// UtiliBill data layer. Opens the SQLite database, creates the schema and seeds it
// ONCE. If the users table is non-empty the seed returns immediately and nothing is
// reset, so state survives a restart. The golden reads its OWN co-located seed roster
// first so moving the shipped asset can never break it.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.UTILIBILL_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'utilibill.db');
const SEED_PATH =
  process.env.SEED_PATH ||
  (fs.existsSync(path.join(__dirname, 'seed_data.json'))
    ? path.join(__dirname, 'seed_data.json')
    : fs.existsSync(path.join(__dirname, '..', 'seed_data.json'))
    ? path.join(__dirname, '..', 'seed_data.json')
    : '/assets/artifacts/utilibill_seed.json');
const ROSTER = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

// The synthetic tariff constants and the reference moment are STATED reference data —
// read straight from the roster, never built by a route.
const reference = {
  reference_moment: ROSTER.reference_moment,
  policy: ROSTER.policy,
  rate_change: ROSTER.rate_change,
};

function open() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
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
    password TEXT NOT NULL, role TEXT NOT NULL, suspended INTEGER NOT NULL DEFAULT 0);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);

  -- The single stored reference moment, fixed at seed. Nothing ever asks the OS clock.
  CREATE TABLE IF NOT EXISTS system_clock (
    id TEXT PRIMARY KEY, reference_at TEXT NOT NULL, reference_date TEXT NOT NULL);

  -- A customer premise/account: its tariff, whether it net-meters or is on a budget/
  -- levelized plan, and (for budget accounts) the seeded levelized amount and the stored
  -- enrollment anniversary instant. The current levelized is the LATEST budget_trueup's
  -- new value or this seed value; never edited in place.
  CREATE TABLE IF NOT EXISTS accounts (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, tariff TEXT NOT NULL,
    net_metering INTEGER NOT NULL DEFAULT 0, budget INTEGER NOT NULL DEFAULT 0,
    levelized_cents INTEGER NOT NULL DEFAULT 0, anniversary_at TEXT, note TEXT);

  -- A billing cycle for an account: its half-open [start,end) window, the stored
  -- baseline accrual weight (the ONLY evidence of when unmetered energy was used), and
  -- its status. status: OPEN, ISSUED_ESTIMATE, BILLED, FINALIZED, REMITTED.
  CREATE TABLE IF NOT EXISTS cycles (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id), label TEXT NOT NULL,
    window_start TEXT NOT NULL, window_end TEXT NOT NULL, baseline_weight INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'OPEN');

  -- A meter read from the AMI/MDM twin. ESTIMATED reads carry the estimate; an ACTUAL
  -- read on a later cycle may carry trueup_total_kwh + the accrual cycle ids the revealed
  -- usage spreads across. TOU buckets are pre-stored per sub-period (metered, not
  -- day-counted): peak_pre (before the rate change), peak_boundary (stamped exactly at
  -- the effective instant -> NEW rate, half-open), peak_after (after), shoulder, offpeak.
  CREATE TABLE IF NOT EXISTS meter_reads (
    id TEXT PRIMARY KEY, cycle_id TEXT NOT NULL REFERENCES cycles(id), kind TEXT NOT NULL,
    delivered_kwh INTEGER NOT NULL DEFAULT 0, exported_kwh INTEGER NOT NULL DEFAULT 0,
    peak_pre_kwh INTEGER NOT NULL DEFAULT 0, peak_boundary_kwh INTEGER NOT NULL DEFAULT 0,
    peak_after_kwh INTEGER NOT NULL DEFAULT 0, shoulder_kwh INTEGER NOT NULL DEFAULT 0,
    offpeak_kwh INTEGER NOT NULL DEFAULT 0, trueup_total_kwh INTEGER,
    accrual_cycle_ids TEXT NOT NULL DEFAULT '[]');

  -- A bill for a cycle. kind: ESTIMATE (seeded), CYCLE (a normal billed cycle),
  -- REBILL (a true-up re-bill of an accrual period). state: ISSUED, BILLED, SUPERSEDED,
  -- PENDING_APPROVAL (a re-bill whose contra delta > the dual-control threshold),
  -- APPROVED. total_cents is the server's own figure; a body-claimed amount is never
  -- stored. energy_net_cents is energy AFTER any net-metering credit (the GRT base part).
  CREATE TABLE IF NOT EXISTS bills (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    cycle_id TEXT NOT NULL REFERENCES cycles(id), kind TEXT NOT NULL,
    delivered_kwh INTEGER NOT NULL DEFAULT 0, exported_kwh INTEGER NOT NULL DEFAULT 0,
    energy_cents INTEGER NOT NULL DEFAULT 0, credit_cents INTEGER NOT NULL DEFAULT 0,
    energy_net_cents INTEGER NOT NULL DEFAULT 0, fixed_cents INTEGER NOT NULL DEFAULT 0,
    rps_cents INTEGER NOT NULL DEFAULT 0, sbc_cents INTEGER NOT NULL DEFAULT 0,
    grt_cents INTEGER NOT NULL DEFAULT 0, total_cents INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'BILLED', superseded INTEGER NOT NULL DEFAULT 0,
    superseded_by_id TEXT, supersedes_id TEXT, raised_by TEXT, approved_by TEXT,
    breakdown TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, approved_at TEXT);

  -- Per-bill regulatory rider accrual rows. kind: RPS, SBC, GRT. The remittance sums
  -- these OWN rows; base_cents is the base the rate rode.
  CREATE TABLE IF NOT EXISTS rider_accruals (
    id TEXT PRIMARY KEY, bill_id TEXT NOT NULL REFERENCES bills(id),
    account_id TEXT NOT NULL, cycle_id TEXT NOT NULL, kind TEXT NOT NULL,
    base_cents INTEGER NOT NULL DEFAULT 0, rate INTEGER NOT NULL DEFAULT 0,
    amount_cents INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);

  -- A contra against a superseded prior bill (the true-up delta = re-bill - prior bill).
  CREATE TABLE IF NOT EXISTS contras (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    bill_id TEXT NOT NULL, cycle_id TEXT NOT NULL, amount_cents INTEGER NOT NULL,
    note TEXT, created_by TEXT, created_at TEXT NOT NULL);

  -- Net-metering bank movements. Bank balance = SUM(amount_cents). SEED at seed,
  -- CARRYFORWARD at billing a net-metering cycle (the excess/drawdown delta). Energy-only
  -- offset: the credit erases the energy line, the excess banks; it is never cashed out.
  CREATE TABLE IF NOT EXISTS nm_bank_movements (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    amount_cents INTEGER NOT NULL, kind TEXT NOT NULL, bill_id TEXT, note TEXT, created_at TEXT NOT NULL);

  -- Seeded prior actual bills for a budget/levelized account (the trailing-12). The
  -- deferred movement per cycle = actual - levelized is DERIVED; the balance is SUMMED
  -- from these rows (never a stored scalar), less any settled true-up.
  CREATE TABLE IF NOT EXISTS budget_ledgers (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    cycle_no INTEGER NOT NULL, actual_cents INTEGER NOT NULL);

  -- The annual budget true-up minted at the enrollment anniversary: it SETTLES the
  -- deferred balance and RESETS the levelized to the trailing-12 ratio. Append-only:
  -- the current levelized is the latest new_levelized_cents, never an in-place edit.
  CREATE TABLE IF NOT EXISTS budget_trueups (
    id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id),
    settled_cents INTEGER NOT NULL, trailing_total_cents INTEGER NOT NULL,
    old_levelized_cents INTEGER NOT NULL, new_levelized_cents INTEGER NOT NULL,
    created_by TEXT, created_at TEXT NOT NULL);

  -- A regulatory settlement period and the cycles finalized into it.
  CREATE TABLE IF NOT EXISTS settlement_periods (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'OPEN');
  CREATE TABLE IF NOT EXISTS period_cycles (
    id TEXT PRIMARY KEY, period_id TEXT NOT NULL REFERENCES settlement_periods(id),
    cycle_id TEXT NOT NULL REFERENCES cycles(id), created_at TEXT NOT NULL);

  -- The persisted remittance line = SUM of the app's OWN RPS+SBC+GRT accrual rows across
  -- the finalized cycles; never a stored scalar and never the twin's echo.
  CREATE TABLE IF NOT EXISTS remittances (
    id TEXT PRIMARY KEY, period_id TEXT NOT NULL REFERENCES settlement_periods(id),
    rps_cents INTEGER NOT NULL, sbc_cents INTEGER NOT NULL, grt_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL, authority_ack TEXT, created_by TEXT, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, action TEXT NOT NULL,
    subject TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL);
  `);
}

function seedIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (n > 0) return;                        // never re-seed: state must survive a restart
  const s = ROSTER;
  const pw = s.password_for_all_accounts;
  const REF = s.reference_moment;
  const run = (sql, ...a) => db.prepare(sql).run(...a);

  const tx = db.transaction(() => {
    run('INSERT INTO system_clock (id,reference_at,reference_date) VALUES (?,?,?)',
        'CLOCK', REF, REF.slice(0, 10));

    for (const u of s.users)
      run('INSERT INTO users (id,name,email,password,role,suspended) VALUES (?,?,?,?,?,0)',
          u.id, u.name, u.email.toLowerCase(), pw, u.role);

    for (const a of s.accounts)
      run('INSERT INTO accounts (id,name,tariff,net_metering,budget,levelized_cents,anniversary_at,note) VALUES (?,?,?,?,?,?,?,?)',
          a.id, a.name, a.tariff, a.net_metering || 0, a.budget || 0,
          a.levelized_cents || 0, a.anniversary_at || null, a.note || null);

    for (const c of s.cycles)
      run('INSERT INTO cycles (id,account_id,label,window_start,window_end,baseline_weight,status) VALUES (?,?,?,?,?,?,?)',
          c.id, c.account_id, c.label, c.window_start, c.window_end, c.baseline_weight || 0, c.status || 'OPEN');

    for (const r of s.meter_reads)
      run(`INSERT INTO meter_reads (id,cycle_id,kind,delivered_kwh,exported_kwh,peak_pre_kwh,peak_boundary_kwh,peak_after_kwh,shoulder_kwh,offpeak_kwh,trueup_total_kwh,accrual_cycle_ids)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          r.id, r.cycle_id, r.kind, r.delivered_kwh || 0, r.exported_kwh || 0,
          r.peak_pre_kwh || 0, r.peak_boundary_kwh || 0, r.peak_after_kwh || 0,
          r.shoulder_kwh || 0, r.offpeak_kwh || 0,
          r.trueup_total_kwh == null ? null : r.trueup_total_kwh,
          JSON.stringify(r.accrual_cycle_ids || []));

    for (const b of (s.prior_bills || []))
      run(`INSERT INTO bills (id,account_id,cycle_id,kind,delivered_kwh,exported_kwh,energy_cents,credit_cents,energy_net_cents,fixed_cents,rps_cents,sbc_cents,grt_cents,total_cents,state,raised_by,breakdown,created_at)
           VALUES (?,?,?,?,?,0,?,0,?,?,?,?,?,?,?,NULL,?,?)`,
          b.id, b.account_id, b.cycle_id, b.kind, b.delivered_kwh || 0,
          b.energy_cents || 0, b.energy_cents || 0, b.fixed_cents || 0,
          b.rps_cents || 0, b.sbc_cents || 0, b.grt_cents || 0, b.total_cents || 0,
          b.state || 'ISSUED', JSON.stringify({ seeded: true }), REF);

    for (const m of (s.nm_bank_movements || []))
      run(`INSERT INTO nm_bank_movements (id,account_id,amount_cents,kind,bill_id,note,created_at)
           VALUES (?,?,?,?,NULL,?,?)`, m.id, m.account_id, m.amount_cents, m.kind || 'SEED', m.note || null, REF);

    for (const bl of (s.budget_ledgers || []))
      run('INSERT INTO budget_ledgers (id,account_id,cycle_no,actual_cents) VALUES (?,?,?,?)',
          bl.id, bl.account_id, bl.cycle_no, bl.actual_cents);

    for (const p of (s.settlement_periods || []))
      run('INSERT INTO settlement_periods (id,label,status) VALUES (?,?,?)', p.id, p.label, p.status || 'OPEN');

    run('INSERT INTO audit_log (actor_id,action,subject,detail,created_at) VALUES (NULL,?,?,?,?)',
        'SEEDED', 'UTILIBILL', 'roster loaded', REF);
  });
  tx();
}

module.exports = { open, createSchema, seedIfEmpty, reference, ROSTER, DB_PATH, DATA_DIR, SEED_PATH };
