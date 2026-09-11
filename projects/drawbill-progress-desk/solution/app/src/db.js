import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { usdToCents } from './money.js';
import { datesInRange } from './dates.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '../data');
fs.mkdirSync(dataDir, { recursive: true });

export const LEDGER_FILE = path.join(dataDir, 'drawbill.db');
export const db = new DatabaseSync(LEDGER_FILE);
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA journal_mode = WAL');

export const DEFAULT_USER_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const BOOKS_OPEN = '2030-03-01';

function artifactDir() {
  const appRoot = path.resolve(__dirname, '..');
  const candidates = [
    path.join(appRoot, 'artifacts'),
    process.env.SEED_DIR,
    '/assets/artifacts',
    path.resolve(__dirname, '../../../environment/assets/artifacts'),
    path.resolve(__dirname, '../../../../environment/assets/artifacts')
  ].filter(Boolean);
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'people_seed_data.json'))) return dir;
  }
  throw new Error('DrawBill seed artifacts not found');
}

function readJson(name) {
  return JSON.parse(fs.readFileSync(path.join(artifactDir(), name), 'utf8'));
}

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL,
    preferred_vendor_member INTEGER NOT NULL DEFAULT 0,
    dbe INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS people (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    role TEXT NOT NULL,
    company_id TEXT NOT NULL REFERENCES companies(id),
    account_status TEXT NOT NULL,
    isolation INTEGER NOT NULL DEFAULT 0,
    member INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    short_name TEXT NOT NULL,
    gc_company_id TEXT NOT NULL REFERENCES companies(id),
    owner_company_id TEXT NOT NULL REFERENCES companies(id),
    architect_company_id TEXT NOT NULL REFERENCES companies(id),
    county_window TEXT NOT NULL,
    warehouse_window TEXT NOT NULL,
    original_contract_cents INTEGER NOT NULL,
    scd TEXT NOT NULL,
    status TEXT NOT NULL,
    stop_work INTEGER NOT NULL DEFAULT 0,
    encumbrance_remaining_cents INTEGER NOT NULL,
    gc_monthly_draw_cents INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS sov_lines (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    tag TEXT NOT NULL,
    description TEXT NOT NULL,
    kind TEXT NOT NULL,
    original_cents INTEGER NOT NULL,
    unit TEXT,
    unit_rate_cents INTEGER,
    company_id TEXT NOT NULL REFERENCES companies(id),
    joint_check INTEGER NOT NULL DEFAULT 0,
    dbe INTEGER NOT NULL DEFAULT 0,
    permit_gated INTEGER NOT NULL DEFAULT 0,
    gc_line INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS change_orders (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    sov_line_id TEXT NOT NULL REFERENCES sov_lines(id),
    number TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    executed_on TEXT,
    index_item TEXT
  );
  CREATE TABLE IF NOT EXISTS tickets (
    id TEXT PRIMARY KEY,
    sov_line_id TEXT NOT NULL REFERENCES sov_lines(id),
    kind TEXT NOT NULL,
    qty INTEGER NOT NULL,
    unit TEXT,
    ticket_date TEXT NOT NULL,
    status TEXT NOT NULL,
    yard_window TEXT,
    filed_by TEXT
  );
  CREATE TABLE IF NOT EXISTS lump_progress (
    id TEXT PRIMARY KEY,
    sov_line_id TEXT NOT NULL REFERENCES sov_lines(id),
    billed_to_date_cents INTEGER NOT NULL,
    as_of TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sub_invoices (
    id TEXT PRIMARY KEY,
    sov_line_id TEXT NOT NULL REFERENCES sov_lines(id),
    job_id TEXT NOT NULL REFERENCES jobs(id),
    number TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL,
    filed_by TEXT
  );
  CREATE TABLE IF NOT EXISTS payroll_stamps (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    stamp_date TEXT NOT NULL,
    officer_id TEXT NOT NULL,
    UNIQUE (job_id, stamp_date)
  );
  CREATE TABLE IF NOT EXISTS insurance (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    kind TEXT NOT NULL,
    expires_on TEXT NOT NULL,
    filed_by TEXT
  );
  CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    kind TEXT NOT NULL,
    stamped_on TEXT NOT NULL,
    sov_line_tag TEXT
  );
  CREATE TABLE IF NOT EXISTS applications (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES jobs(id),
    number TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    status TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'progress',
    card_session_id TEXT UNIQUE,
    net_cents INTEGER,
    wip_cents INTEGER,
    new_stored_cents INTEGER,
    converted_cents INTEGER,
    fee_cents INTEGER,
    bond_cents INTEGER,
    tax_cents INTEGER,
    fringe_cents INTEGER,
    retainage_cents INTEGER,
    ld_cents INTEGER,
    payees TEXT,
    filed_by TEXT,
    certified_by TEXT,
    released_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS application_lines (
    id TEXT PRIMARY KEY,
    application_id TEXT NOT NULL REFERENCES applications(id),
    sov_line_id TEXT NOT NULL REFERENCES sov_lines(id),
    billed_to_date_cents INTEGER NOT NULL,
    stored_remaining_cents INTEGER NOT NULL,
    this_period_wip_cents INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS local_notices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    channel TEXT NOT NULL,
    application_id TEXT NOT NULL,
    person_id TEXT,
    total_cents INTEGER NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS local_waivers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS local_punches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id TEXT NOT NULL,
    person_id TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS local_diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    application_id TEXT NOT NULL,
    period_start TEXT NOT NULL,
    period_end TEXT NOT NULL,
    ics TEXT
  );
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT,
    previous TEXT,
    next TEXT,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

export function withTx(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try { db.exec('ROLLBACK'); } catch { /* ignore */ }
    throw err;
  }
}

export function writeAudit({ actorId, action, entity, entityId, previous, next, reason }) {
  db.prepare(`
    INSERT INTO audit (actor_id, action, entity, entity_id, previous, next, reason)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    actorId || null,
    action,
    entity,
    entityId || null,
    previous == null ? null : JSON.stringify(previous),
    next == null ? null : JSON.stringify(next),
    reason || null
  );
}

function seed() {
  const companies = readJson('companies_seed_data.json').companies;
  const people = readJson('people_seed_data.json').people;
  const jobsFile = readJson('jobs_seed_data.json');
  const plant = readJson('plant_seed_data.json');

  const insCompany = db.prepare(`
    INSERT INTO companies (id, name, kind, status, preferred_vendor_member, dbe)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, kind=excluded.kind, status=excluded.status,
      preferred_vendor_member=excluded.preferred_vendor_member, dbe=excluded.dbe
  `);
  for (const c of companies) {
    insCompany.run(c.id, c.name, c.kind, c.status, c.preferred_vendor_member ? 1 : 0, c.dbe ? 1 : 0);
  }

  const insPerson = db.prepare(`
    INSERT INTO people (id, full_name, email, role, company_id, account_status, isolation, member)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      full_name=excluded.full_name, email=excluded.email, role=excluded.role,
      company_id=excluded.company_id, account_status=excluded.account_status,
      isolation=excluded.isolation, member=excluded.member
  `);
  for (const p of people) {
    const company = companies.find((c) => c.id === p.company_id);
    const member = !p.isolation && company?.preferred_vendor_member ? 1 : 0;
    insPerson.run(
      p.id, p.full_name, p.email, p.role, p.company_id, p.account_status,
      p.isolation ? 1 : 0, member
    );
  }

  const insJob = db.prepare(`
    INSERT INTO jobs (
      id, name, short_name, gc_company_id, owner_company_id, architect_company_id,
      county_window, warehouse_window, original_contract_cents, scd, status,
      stop_work, encumbrance_remaining_cents, gc_monthly_draw_cents
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      encumbrance_remaining_cents=excluded.encumbrance_remaining_cents
  `);
  for (const j of jobsFile.jobs) {
    insJob.run(
      j.id, j.name, j.short_name, j.gc_company_id, j.owner_company_id, j.architect_company_id,
      j.county_window, j.warehouse_window, usdToCents(j.original_contract_usd), j.scd, j.status,
      j.stop_work ? 1 : 0, usdToCents(j.encumbrance_remaining_usd), usdToCents(j.gc_monthly_draw_usd)
    );
  }

  const insLine = db.prepare(`
    INSERT INTO sov_lines (
      id, job_id, tag, description, kind, original_cents, unit, unit_rate_cents,
      company_id, joint_check, dbe, permit_gated, gc_line
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  for (const line of jobsFile.sov_lines) {
    insLine.run(
      line.id, line.job_id, line.tag, line.description, line.kind,
      usdToCents(line.original_usd), line.unit || null,
      line.unit_rate_usd == null ? null : usdToCents(line.unit_rate_usd),
      line.company_id, line.joint_check ? 1 : 0, line.dbe ? 1 : 0,
      line.permit_gated ? 1 : 0, line.gc_line ? 1 : 0
    );
  }

  const insCo = db.prepare(`
    INSERT INTO change_orders (id, job_id, sov_line_id, number, description, amount_cents, status, executed_on, index_item)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET status=excluded.status, executed_on=excluded.executed_on
  `);
  for (const co of plant.change_orders) {
    insCo.run(
      co.id, co.job_id, co.sov_line_id, co.number, co.description,
      usdToCents(co.amount_usd), co.status, co.executed_on, co.index_item
    );
  }

  const insTicket = db.prepare(`
    INSERT INTO tickets (id, sov_line_id, kind, qty, unit, ticket_date, status, yard_window, filed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  for (const t of plant.tickets) {
    insTicket.run(t.id, t.sov_line_id, t.kind, t.qty, t.unit, t.ticket_date, t.status, t.yard_window || null, t.filed_by);
  }

  const insProg = db.prepare(`
    INSERT INTO lump_progress (id, sov_line_id, billed_to_date_cents, as_of)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  for (const p of plant.lump_progress) {
    insProg.run(p.id, p.sov_line_id, usdToCents(p.billed_to_date_usd), p.as_of);
  }

  const insSub = db.prepare(`
    INSERT INTO sub_invoices (id, sov_line_id, job_id, number, period_start, period_end, amount_cents, status, filed_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  for (const s of plant.sub_invoices) {
    insSub.run(s.id, s.sov_line_id, s.job_id, s.number, s.period_start, s.period_end, usdToCents(s.amount_usd), s.status, s.filed_by);
  }

  const insPay = db.prepare(`
    INSERT INTO payroll_stamps (id, job_id, stamp_date, officer_id)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(job_id, stamp_date) DO NOTHING
  `);
  for (const range of plant.payroll_ranges) {
    for (const day of datesInRange(range.start, range.end)) {
      insPay.run(`${range.job_id}:${day}`, range.job_id, day, range.officer_id);
    }
  }

  const insIns = db.prepare(`
    INSERT INTO insurance (id, job_id, kind, expires_on, filed_by)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  for (const row of plant.insurance) {
    insIns.run(row.id, row.job_id, row.kind, row.expires_on, row.filed_by);
  }

  const insInsp = db.prepare(`
    INSERT INTO inspections (id, job_id, kind, stamped_on, sov_line_tag)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  for (const row of plant.inspections) {
    insInsp.run(row.id, row.job_id, row.kind, row.stamped_on, row.sov_line_tag);
  }

  const insApp = db.prepare(`
    INSERT INTO applications (
      id, job_id, number, period_start, period_end, status, kind, card_session_id,
      net_cents, wip_cents, new_stored_cents, converted_cents, fee_cents, bond_cents,
      tax_cents, fringe_cents, retainage_cents, ld_cents, filed_by, certified_by, released_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  const insAppLine = db.prepare(`
    INSERT INTO application_lines (id, application_id, sov_line_id, billed_to_date_cents, stored_remaining_cents, this_period_wip_cents)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `);
  for (const app of plant.posted_applications) {
    insApp.run(
      app.id, app.job_id, app.number, app.period_start, app.period_end, app.status, app.kind,
      app.card_session_id, usdToCents(app.net_usd), usdToCents(app.wip_usd),
      usdToCents(app.new_stored_usd), usdToCents(app.converted_usd), usdToCents(app.fee_usd),
      usdToCents(app.bond_usd), usdToCents(app.tax_usd), usdToCents(app.fringe_usd),
      usdToCents(app.retainage_usd), usdToCents(app.ld_usd),
      app.filed_by, app.certified_by, app.released_by
    );
    for (const line of app.lines) {
      insAppLine.run(
        `${app.id}:${line.sov_line_id}`, app.id, line.sov_line_id,
        usdToCents(line.billed_to_date_usd), usdToCents(line.stored_remaining_usd),
        usdToCents(line.this_period_wip_usd)
      );
    }
  }
  for (const app of plant.pencil_applications) {
    insApp.run(
      app.id, app.job_id, app.number, app.period_start, app.period_end, app.status, app.kind,
      null, null, null, null, null, null, null, null, null, null, null,
      app.filed_by, null, null
    );
  }
}

seed();

export function personById(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM people WHERE id = ?').get(id) || null;
}

export function companyById(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM companies WHERE id = ?').get(id) || null;
}

export function allPeople() {
  return db.prepare('SELECT id, full_name, email, role, account_status FROM people ORDER BY full_name').all();
}

export function jobById(id) {
  if (!id) return null;
  return db.prepare('SELECT * FROM jobs WHERE id = ?').get(id) || null;
}

export function linesForJob(jobId) {
  return db.prepare('SELECT * FROM sov_lines WHERE job_id = ? ORDER BY tag').all(jobId);
}

export function jobsVisibleTo(person) {
  if (!person || person.isolation) return [];
  const NORTHLINE = '11111111-1111-4111-8111-111111111111';
  // Avery's demo desk sees every seeded contract, including the Westfork
  // job whose GC company is not Northline. Listed is not fileable: index.js
  // refuses a Northline filer on a non-Northline job. Priya still only sees Westfork.
  if (person.role === 'gc_pm' && person.account_status === 'ACTIVE' && person.company_id === NORTHLINE) {
    return db.prepare('SELECT * FROM jobs ORDER BY short_name').all();
  }
  if (person.role === 'auditor' || person.role === 'bond_clerk' || person.role === 'insurance_liaison' || person.role === 'notary' || person.role === 'payroll' || person.role === 'yard_runner' || person.role === 'superintendent' || person.role === 'project_engineer') {
    return db.prepare('SELECT * FROM jobs ORDER BY short_name').all();
  }
  if (person.role === 'architect') {
    return db.prepare('SELECT * FROM jobs WHERE architect_company_id = ? ORDER BY short_name').all(person.company_id);
  }
  if (person.role === 'owner_ap') {
    return db.prepare('SELECT * FROM jobs WHERE owner_company_id = ? ORDER BY short_name').all(person.company_id);
  }
  if (person.role === 'sub_pm') {
    return db.prepare(`
      SELECT DISTINCT j.* FROM jobs j
      JOIN sov_lines s ON s.job_id = j.id
      WHERE s.company_id = ?
      ORDER BY j.short_name
    `).all(person.company_id);
  }
  return db.prepare('SELECT * FROM jobs WHERE gc_company_id = ? ORDER BY short_name').all(person.company_id);
}

export function filterLinesForPerson(person, lines) {
  if (person?.role === 'sub_pm') {
    return lines.filter((l) => l.company_id === person.company_id);
  }
  return lines;
}

export function postedSnapshot(jobId) {
  return db.prepare(`
    SELECT * FROM applications
    WHERE job_id = ? AND status = 'PAID_POSTED' AND kind = 'progress'
    ORDER BY period_end DESC
  `).get(jobId) || null;
}

export function postedLines(applicationId) {
  return db.prepare('SELECT * FROM application_lines WHERE application_id = ?').all(applicationId);
}

export function applicationsForJob(jobId) {
  return db.prepare('SELECT * FROM applications WHERE job_id = ? ORDER BY period_start').all(jobId);
}

export function applicationById(id) {
  return db.prepare('SELECT * FROM applications WHERE id = ?').get(id) || null;
}

export function applicationBySession(sessionId) {
  return db.prepare('SELECT * FROM applications WHERE card_session_id = ?').get(sessionId) || null;
}

export function liveOverlaps(jobId, start, end, exceptId) {
  const rows = db.prepare(`
    SELECT * FROM applications
    WHERE job_id = ? AND status NOT IN ('VOID', 'REJECTED')
  `).all(jobId);
  return rows.filter((row) => {
    if (exceptId && row.id === exceptId) return false;
    return start <= row.period_end && row.period_start <= end;
  });
}

export function executedCos(jobId, periodEnd) {
  return db.prepare(`
    SELECT * FROM change_orders
    WHERE job_id = ? AND status = 'EXECUTED' AND executed_on IS NOT NULL AND executed_on <= ?
  `).all(jobId, periodEnd);
}

export function ticketsForLine(lineId) {
  return db.prepare(`SELECT * FROM tickets WHERE sov_line_id = ? AND status = 'FILED'`).all(lineId);
}

export function payrollDays(jobId) {
  return db.prepare('SELECT stamp_date FROM payroll_stamps WHERE job_id = ?').all(jobId).map((r) => r.stamp_date);
}

export function insuranceFor(jobId) {
  return db.prepare('SELECT * FROM insurance WHERE job_id = ?').all(jobId);
}

export function foundationStamp(jobId) {
  return db.prepare(`SELECT * FROM inspections WHERE job_id = ? AND kind = 'foundation'`).get(jobId) || null;
}

export function subInvoiceCovering(jobId, lineId, start, end) {
  return db.prepare(`
    SELECT * FROM sub_invoices
    WHERE job_id = ? AND sov_line_id = ? AND status = 'FILED'
      AND period_start = ? AND period_end = ?
  `).get(jobId, lineId, start, end) || null;
}

export function lumpAsOf(lineId, asOf) {
  return db.prepare(`
    SELECT * FROM lump_progress
    WHERE sov_line_id = ? AND as_of <= ?
    ORDER BY as_of DESC
  `).get(lineId, asOf) || null;
}

export function insertApplication(row) {
  db.prepare(`
    INSERT INTO applications (
      id, job_id, number, period_start, period_end, status, kind, filed_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(row.id, row.job_id, row.number, row.period_start, row.period_end, row.status, row.kind, row.filed_by);
}

export function replaceApplicationLines(applicationId, lines) {
  db.prepare('DELETE FROM application_lines WHERE application_id = ?').run(applicationId);
  const ins = db.prepare(`
    INSERT INTO application_lines (id, application_id, sov_line_id, billed_to_date_cents, stored_remaining_cents, this_period_wip_cents)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const line of lines) {
    ins.run(line.id, applicationId, line.sov_line_id, line.billed_to_date_cents, line.stored_remaining_cents, line.this_period_wip_cents);
  }
}

export function updateApplication(id, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const sql = `UPDATE applications SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`;
  db.prepare(sql).run(...keys.map((k) => fields[k]), id);
}

export function booksOpen() {
  return BOOKS_OPEN;
}

export function noticesFor(person) {
  if (!person || person.isolation) return [];
  if (person.role === 'auditor') {
    return db.prepare('SELECT * FROM local_notices ORDER BY id').all();
  }
  return db.prepare('SELECT * FROM local_notices WHERE person_id = ? ORDER BY id').all(person.id);
}

export function waiversFor(person) {
  if (!person || person.isolation) return [];
  return db.prepare(`
    SELECT w.* FROM local_waivers w
    JOIN applications a ON a.id = w.application_id
    JOIN jobs j ON j.id = a.job_id
    WHERE (? = 'auditor')
       OR j.gc_company_id = ?
       OR j.owner_company_id = ?
       OR j.architect_company_id = ?
    ORDER BY w.id
  `).all(person.role, person.company_id, person.company_id, person.company_id);
}

export function punchesFor(person) {
  if (!person || person.isolation) return [];
  return db.prepare('SELECT * FROM local_punches WHERE person_id = ? ORDER BY id').all(person.id);
}

export function diaryFor(person) {
  if (!person || person.isolation) return [];
  if (person.role === 'auditor') return db.prepare('SELECT * FROM local_diary ORDER BY id').all();
  return db.prepare(`
    SELECT d.* FROM local_diary d
    JOIN applications a ON a.id = d.application_id
    WHERE a.filed_by = ?
    ORDER BY d.id
  `).all(person.id);
}

export function auditEntries(person) {
  if (!person || (person.role !== 'auditor' && person.role !== 'owner_ap')) return [];
  return db.prepare('SELECT * FROM audit ORDER BY id').all();
}
