'use strict';
// ExpenseFlow data layer. Opens the SQLite database, creates the schema and seeds
// it ONCE. If the users table is non-empty the seed returns immediately and nothing
// is reset, so state survives a restart. The golden reads its OWN co-located seed
// roster first so moving the shipped asset can never break it.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.EXPENSEFLOW_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'expenseflow.db');
const SEED_PATH =
  process.env.SEED_PATH ||
  (fs.existsSync(path.join(__dirname, 'seed_data.json'))
    ? path.join(__dirname, 'seed_data.json')
    : fs.existsSync(path.join(__dirname, '..', 'seed_data.json'))
    ? path.join(__dirname, '..', 'seed_data.json')
    : '/assets/artifacts/expenseflow_seed.json');
const ROSTER = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));

// The caps, rates, allocation and tier bounds are STATED reference data — read
// straight from the roster, never built by a write route. They are SYNTHETIC
// contract constants that deliberately differ from any real-world figure.
const reference = {
  home_currency: ROSTER.home_currency,
  per_diem_full_day_cents: ROSTER.per_diem_full_day_cents,
  per_diem_block_cents: ROSTER.per_diem_block_cents,
  per_diem_block_hours: ROSTER.per_diem_block_hours,
  mileage_rate_cents_per_mile: ROSTER.mileage_rate_cents_per_mile,
  lodging_nightly_cap_cents: ROSTER.lodging_nightly_cap_cents,
  airfare_economy_cap_cents: ROSTER.airfare_economy_cap_cents,
  vat_inclusive_bp: ROSTER.vat_inclusive_bp,
  tier_manager_max_cents: ROSTER.tier_manager_max_cents,
  tier_director_max_cents: ROSTER.tier_director_max_cents,
  eligible_vat_categories: ROSTER.eligible_vat_categories,
  nonreimbursable_categories: ROSTER.nonreimbursable_categories,
  reference_moment: ROSTER.reference_moment,
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
    password TEXT NOT NULL, role TEXT NOT NULL,
    approval_limit_cents INTEGER, suspended INTEGER NOT NULL DEFAULT 0);

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL);

  -- The single stored reference moment, fixed at seed time. Nothing in this app
  -- ever asks the operating system what time it is.
  CREATE TABLE IF NOT EXISTS system_clock (
    id TEXT PRIMARY KEY, reference_at TEXT NOT NULL, reference_date TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS employees (
    id TEXT PRIMARY KEY, name TEXT NOT NULL);

  -- A cost center carries its budget and a DECOY stored scalar headroom. The real
  -- headroom is budget minus the SUM of the live commitment rows; the stale scalar
  -- is never the authority.
  CREATE TABLE IF NOT EXISTS cost_centers (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    budget_cents INTEGER NOT NULL, stored_scalar_headroom_cents INTEGER NOT NULL DEFAULT 0);

  -- The seeded FX daily-rate twin. A foreign line converts at the rate for its OWN
  -- transaction date (half-open day windows); an absent date uses the most-recent
  -- prior stored rate. Rates are integer ten-thousandths (12500 = 1.2500).
  CREATE TABLE IF NOT EXISTS fx_rates (
    id INTEGER PRIMARY KEY AUTOINCREMENT, as_of_date TEXT NOT NULL, pair TEXT NOT NULL,
    rate_ten_thousandths INTEGER NOT NULL, note TEXT);

  CREATE TABLE IF NOT EXISTS reports (
    id TEXT PRIMARY KEY, employee_id TEXT NOT NULL REFERENCES employees(id),
    title TEXT NOT NULL, filed_by TEXT NOT NULL REFERENCES users(id),
    trip_depart_at TEXT NOT NULL, trip_return_at TEXT NOT NULL, submitted_date TEXT NOT NULL,
    state TEXT NOT NULL DEFAULT 'FILED',
    approved_by TEXT, approved_tier TEXT, approved_at TEXT,
    adjudicated_at TEXT, posted_at TEXT, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS report_allocations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, report_id TEXT NOT NULL REFERENCES reports(id),
    cost_center_id TEXT NOT NULL REFERENCES cost_centers(id),
    pct_bp INTEGER NOT NULL, is_plug INTEGER NOT NULL DEFAULT 0);

  -- A line carries a CLAIMED amount in its currency (or miles, for mileage) and a
  -- transaction date. The FX/cap/tax derivations read these; the conversion,
  -- the binding cap and the reimbursable are computed, never stored on the line.
  CREATE TABLE IF NOT EXISTS line_items (
    id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id), line_no INTEGER NOT NULL,
    category TEXT NOT NULL, currency TEXT NOT NULL, amount_cents INTEGER, miles INTEGER,
    txn_date TEXT NOT NULL, nights INTEGER, note TEXT);

  -- The per-line adjudication record, minted when finance adjudicates a report: the
  -- FX-converted home amount, the binding cap, the reimbursable and the disallowed
  -- excess, plus this line's VAT-reclaim contribution when its category is eligible.
  -- This is the second-order record of the FX -> cap -> tax spine, per line.
  CREATE TABLE IF NOT EXISTS line_postings (
    id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id),
    line_id TEXT NOT NULL REFERENCES line_items(id), line_no INTEGER NOT NULL, category TEXT NOT NULL,
    currency TEXT NOT NULL, claimed_cents INTEGER, txn_date TEXT,
    rate_ten_thousandths INTEGER, converted_cents INTEGER NOT NULL,
    cap_kind TEXT, cap_cents INTEGER, reimbursable_cents INTEGER NOT NULL, disallowed_cents INTEGER NOT NULL,
    vat_eligible INTEGER NOT NULL DEFAULT 0, vat_contribution_cents INTEGER NOT NULL DEFAULT 0,
    created_by TEXT, created_at TEXT NOT NULL);

  -- The disallowed-excess record. A row is minted ONLY when a line's disallowed
  -- amount is positive: a line landing exactly on its cap mints NOTHING here.
  CREATE TABLE IF NOT EXISTS disallowances (
    id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id),
    line_id TEXT NOT NULL REFERENCES line_items(id), category TEXT NOT NULL,
    amount_cents INTEGER NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL);

  -- The VAT-reclaim accrual: a receivable from the tax authority on the ELIGIBLE
  -- post-cap base. A rejected receipt posts a REVERSAL row (negative), so the net
  -- accrual is SUMMED from the rows, never edited.
  CREATE TABLE IF NOT EXISTS vat_accruals (
    id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id),
    base_cents INTEGER NOT NULL, amount_cents INTEGER NOT NULL,
    kind TEXT NOT NULL, is_reversal INTEGER NOT NULL DEFAULT 0, reverses_id TEXT,
    note TEXT, created_at TEXT NOT NULL);

  -- A cost-center commitment. Prior committed rows are is_prior=1 (report_id NULL).
  -- The plug center absorbs the residual so the split sums to the report total
  -- EXACTLY. A clawback SUPERSEDES the report's CURRENTLY LIVE commitments (kept,
  -- state SUPERSEDED, chaining generation over generation on a second rejection)
  -- and mints fresh netted ones; rows are never edited.
  CREATE TABLE IF NOT EXISTS commitments (
    id TEXT PRIMARY KEY, report_id TEXT, cost_center_id TEXT NOT NULL REFERENCES cost_centers(id),
    amount_cents INTEGER NOT NULL, pct_bp INTEGER, is_plug INTEGER NOT NULL DEFAULT 0,
    state TEXT NOT NULL DEFAULT 'LIVE', is_prior INTEGER NOT NULL DEFAULT 0,
    supersedes_id TEXT, superseded_by_id TEXT, note TEXT, created_by TEXT, created_at TEXT NOT NULL);

  -- The deterministic payout twin: finance posts a batch and a canned acknowledgement
  -- flips it to PAID. The graded artifacts are the app's own commitment/accrual rows,
  -- never this twin's output.
  CREATE TABLE IF NOT EXISTS payout_batches (
    id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id),
    amount_cents INTEGER NOT NULL, state TEXT NOT NULL, created_at TEXT NOT NULL);

  -- An employee recovery raised on a rejected receipt: the POST-CAP reimbursed
  -- figure the desk actually paid, never the claim. A report may raise more than
  -- one of these over its life, one per rejected line.
  CREATE TABLE IF NOT EXISTS recoveries (
    id TEXT PRIMARY KEY, report_id TEXT NOT NULL REFERENCES reports(id),
    line_id TEXT NOT NULL, employee_id TEXT NOT NULL, amount_cents INTEGER NOT NULL,
    note TEXT, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT NOT NULL, cost_center_id TEXT, report_id TEXT,
    ref TEXT NOT NULL, description TEXT NOT NULL,
    debit_cents INTEGER NOT NULL DEFAULT 0, credit_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, action TEXT NOT NULL,
    subject TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL);
  `);
}

function seedIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (n > 0) return;                     // never re-seed: state must survive a restart
  const s = ROSTER;
  const pw = s.password_for_all_accounts;
  const REF = s.reference_moment;
  const run = (sql, ...a) => db.prepare(sql).run(...a);

  const tx = db.transaction(() => {
    run('INSERT INTO system_clock (id,reference_at,reference_date) VALUES (?,?,?)',
        'CLOCK', REF, REF.slice(0, 10));

    for (const u of s.users)
      run('INSERT INTO users (id,name,email,password,role,approval_limit_cents,suspended) VALUES (?,?,?,?,?,?,0)',
          u.id, u.name, u.email.toLowerCase(), pw, u.role, u.approval_limit_cents ?? null);

    for (const e of s.employees)
      run('INSERT INTO employees (id,name) VALUES (?,?)', e.id, e.name);

    for (const c of s.cost_centers)
      run('INSERT INTO cost_centers (id,name,budget_cents,stored_scalar_headroom_cents) VALUES (?,?,?,?)',
          c.id, c.name, c.budget_cents, c.stored_scalar_headroom_cents || 0);

    for (const f of s.fx_rates)
      run('INSERT INTO fx_rates (as_of_date,pair,rate_ten_thousandths,note) VALUES (?,?,?,?)',
          f.as_of_date, f.pair, f.rate_ten_thousandths, f.note || null);

    // Prior committed reimbursements exist as REAL commitment rows so each cost
    // center's headroom is SUMMED FROM ROWS, never read from the stored scalar decoy.
    for (const p of (s.prior_commitments || []))
      run(`INSERT INTO commitments (id,report_id,cost_center_id,amount_cents,pct_bp,is_plug,state,is_prior,note,created_at)
           VALUES (?,NULL,?,?,NULL,0,'LIVE',1,?,?)`, p.id, p.cost_center_id, p.amount_cents, p.note || null, REF);

    for (const r of s.reports) {
      run(`INSERT INTO reports (id,employee_id,title,filed_by,trip_depart_at,trip_return_at,submitted_date,state,created_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
          r.id, r.employee_id, r.title, r.filed_by, r.trip_depart_at, r.trip_return_at, r.submitted_date, r.state || 'FILED', REF);
      for (const a of (r.allocation || []))
        run('INSERT INTO report_allocations (report_id,cost_center_id,pct_bp,is_plug) VALUES (?,?,?,?)',
            r.id, a.cost_center_id, a.pct_bp, a.is_plug || 0);
    }

    for (const l of s.line_items)
      run(`INSERT INTO line_items (id,report_id,line_no,category,currency,amount_cents,miles,txn_date,nights,note)
           VALUES (?,?,?,?,?,?,?,?,?,?)`,
          l.id, l.report_id, l.line_no, l.category, l.currency, l.amount_cents ?? null, l.miles ?? null,
          l.txn_date, l.nights ?? null, l.note || null);

    run('INSERT INTO audit_log (actor_id,action,subject,detail,created_at) VALUES (NULL,?,?,?,?)',
        'SEEDED', 'EXPENSEFLOW', 'roster loaded', REF);
  });
  tx();
}

module.exports = { open, createSchema, seedIfEmpty, reference, DB_PATH, DATA_DIR, SEED_PATH };
