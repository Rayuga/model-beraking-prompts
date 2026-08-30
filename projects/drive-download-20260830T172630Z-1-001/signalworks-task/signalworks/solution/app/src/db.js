'use strict';
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const DATA_DIR = process.env.SIGNALWORKS_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'signalworks.db');
// The golden seeds from its OWN co-located copy of the roster, so moving the
// shipped asset can never break the Oracle. The two files are byte-identical.
const SEED_PATH = path.join(__dirname, 'seed_data.json');

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
    token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL);

  -- The one stored reference moment. Derived ONCE, at seed time, from the
  -- latest incident in the roster. Nothing in this app ever reads the wall
  -- clock to decide whether something has expired or fallen due.
  CREATE TABLE IF NOT EXISTS system_clock (
    id TEXT PRIMARY KEY, reference_at TEXT NOT NULL, reference_date TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS region (
    id TEXT PRIMARY KEY, name TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS interlockings (
    id TEXT PRIMARY KEY, name TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS line_sections (
    id TEXT PRIMARY KEY, name TEXT NOT NULL,
    interlocking_id TEXT NOT NULL REFERENCES interlockings(id));

  CREATE TABLE IF NOT EXISTS assets (
    id TEXT PRIMARY KEY, kind TEXT NOT NULL,
    section_id TEXT NOT NULL REFERENCES line_sections(id),
    state TEXT NOT NULL, inspection_due_on TEXT NOT NULL,
    last_inspected_on TEXT, config_note TEXT);

  CREATE TABLE IF NOT EXISTS asset_inspections (
    id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id),
    technician_id TEXT, result TEXT NOT NULL, inspected_on TEXT NOT NULL,
    next_due_on TEXT, evidence_ref TEXT, seq INTEGER NOT NULL, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS asset_state_changes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, asset_id TEXT NOT NULL REFERENCES assets(id),
    from_state TEXT NOT NULL, to_state TEXT NOT NULL, actor_id TEXT,
    reason TEXT, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS teams (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, on_call INTEGER NOT NULL DEFAULT 0);

  CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, team_id TEXT NOT NULL REFERENCES teams(id),
    competences TEXT NOT NULL, competence_expires_on TEXT NOT NULL,
    base_rate_pence_per_hour INTEGER NOT NULL);

  CREATE TABLE IF NOT EXISTS competence_requirements (
    id TEXT PRIMARY KEY, asset_kind TEXT NOT NULL, requires TEXT NOT NULL, note TEXT);

  CREATE TABLE IF NOT EXISTS operators (
    id TEXT PRIMARY KEY, name TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS incidents (
    id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id),
    section_id TEXT NOT NULL REFERENCES line_sections(id),
    state TEXT NOT NULL, raised_at TEXT NOT NULL, raised_by TEXT,
    acknowledged_at TEXT, acknowledged_by TEXT,
    assigned_at TEXT, assigned_by TEXT,
    cleared_at TEXT, cleared_by TEXT,
    settlement_id TEXT, note TEXT);

  CREATE TABLE IF NOT EXISTS incident_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, incident_id TEXT NOT NULL REFERENCES incidents(id),
    kind TEXT NOT NULL, actor_id TEXT, detail TEXT, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS delay_records (
    id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id),
    operator_id TEXT NOT NULL REFERENCES operators(id),
    delay_minutes INTEGER NOT NULL, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS handback_stages (
    id TEXT PRIMARY KEY, sequence INTEGER NOT NULL, name TEXT NOT NULL,
    evidence_required TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS handbacks (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
    asset_id TEXT NOT NULL REFERENCES assets(id), state TEXT NOT NULL,
    opened_by TEXT, opened_at TEXT NOT NULL, completed_at TEXT, completed_by TEXT);

  CREATE TABLE IF NOT EXISTS handback_steps (
    id INTEGER PRIMARY KEY AUTOINCREMENT, handback_id TEXT NOT NULL REFERENCES handbacks(id),
    stage_id TEXT NOT NULL REFERENCES handback_stages(id), sequence INTEGER NOT NULL,
    evidence_ref TEXT, completed_by TEXT, completed_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY, asset_id TEXT NOT NULL REFERENCES assets(id),
    incident_id TEXT, kind TEXT NOT NULL, state TEXT NOT NULL,
    team_id TEXT, technician_id TEXT, possession_id TEXT,
    -- a job a team CLAIMED off the board carries the moment it was taken; a job
    -- a desk merely planned onto a team does not.
    claimed_at TEXT, claimed_by TEXT,
    started_at TEXT, completed_at TEXT, note TEXT);

  CREATE TABLE IF NOT EXISTS job_assignments (
    id TEXT PRIMARY KEY, job_id TEXT NOT NULL REFERENCES jobs(id),
    team_id TEXT, technician_id TEXT, assigned_by TEXT, assigned_at TEXT NOT NULL,
    competence_required TEXT, competence_expires_on TEXT, state TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS possession_plans (
    id TEXT PRIMARY KEY, section_id TEXT NOT NULL REFERENCES line_sections(id),
    starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, state TEXT NOT NULL,
    planner_id TEXT NOT NULL, approved_by TEXT, approved_at TEXT,
    version INTEGER NOT NULL DEFAULT 1, executed_at TEXT, note TEXT);

  CREATE TABLE IF NOT EXISTS possession_approvals (
    id TEXT PRIMARY KEY, plan_id TEXT NOT NULL REFERENCES possession_plans(id),
    approver_id TEXT NOT NULL, plan_version INTEGER NOT NULL, state TEXT NOT NULL,
    created_at TEXT NOT NULL, invalidated_reason TEXT);

  CREATE TABLE IF NOT EXISTS line_blockages (
    id TEXT PRIMARY KEY, section_id TEXT NOT NULL REFERENCES line_sections(id),
    state TEXT NOT NULL, placed_by TEXT, reason TEXT, placed_at TEXT,
    removed_by TEXT, removed_at TEXT);

  CREATE TABLE IF NOT EXISTS delay_penalty_bands (
    id TEXT PRIMARY KEY, sequence INTEGER NOT NULL,
    up_to_minutes INTEGER, pence_per_minute INTEGER NOT NULL);

  CREATE TABLE IF NOT EXISTS major_disruption_windows (
    id TEXT PRIMARY KEY, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, reason TEXT);

  CREATE TABLE IF NOT EXISTS mutual_aid_credits (
    id TEXT PRIMARY KEY, incident_id TEXT, amount_pence INTEGER NOT NULL,
    state TEXT NOT NULL, consumed_on_settlement TEXT);

  CREATE TABLE IF NOT EXISTS payroll_rules (
    id TEXT PRIMARY KEY, rule TEXT NOT NULL, detail TEXT);

  CREATE TABLE IF NOT EXISTS callouts (
    id TEXT PRIMARY KEY, technician_id TEXT NOT NULL REFERENCES technicians(id),
    job_id TEXT, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
    settled_in TEXT, created_at TEXT);

  CREATE TABLE IF NOT EXISTS settlement_periods (
    id TEXT PRIMARY KEY, label TEXT NOT NULL, state TEXT NOT NULL,
    closed_by TEXT, closed_at TEXT);

  CREATE TABLE IF NOT EXISTS incident_settlements (
    id TEXT PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES incidents(id),
    period_id TEXT, delay_minutes INTEGER NOT NULL,
    gross_pence INTEGER NOT NULL, banded INTEGER NOT NULL, window_id TEXT,
    credit_id TEXT, credit_applied_pence INTEGER NOT NULL DEFAULT 0,
    net_pence INTEGER NOT NULL, state TEXT NOT NULL,
    offsets_settlement_id TEXT, reason TEXT,
    settled_by TEXT, settled_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS labour_settlements (
    id TEXT PRIMARY KEY, period_id TEXT,
    technician_id TEXT NOT NULL REFERENCES technicians(id),
    parts TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL,
    worked_minutes INTEGER NOT NULL, billed_minutes INTEGER NOT NULL,
    normal_minutes INTEGER NOT NULL, overtime_minutes INTEGER NOT NULL,
    night_minutes INTEGER NOT NULL, base_pence INTEGER NOT NULL,
    overtime_pence INTEGER NOT NULL, night_pence INTEGER NOT NULL,
    total_pence INTEGER NOT NULL, state TEXT NOT NULL,
    offsets_settlement_id TEXT, reason TEXT,
    settled_by TEXT, settled_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, account TEXT NOT NULL, ref TEXT NOT NULL,
    description TEXT NOT NULL, debit_pence INTEGER NOT NULL DEFAULT 0,
    credit_pence INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT, subject TEXT, section_id TEXT,
    message TEXT NOT NULL, created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, action TEXT NOT NULL,
    subject TEXT NOT NULL, detail TEXT, created_at TEXT NOT NULL);
  `);
}

function seedIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (n > 0) return;                     // never re-seed: state must survive a restart
  const s = JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'));
  const pw = s.password_for_all_accounts;

  const tx = db.transaction(() => {
    for (const u of s.users)
      db.prepare('INSERT INTO users (id,name,email,password,role,suspended) VALUES (?,?,?,?,?,0)')
        .run(u.id, u.name, u.email, pw, u.role);

    db.prepare('INSERT INTO region (id,name) VALUES (?,?)').run(s.region.id, s.region.name);

    for (const i of s.interlockings)
      db.prepare('INSERT INTO interlockings (id,name) VALUES (?,?)').run(i.id, i.name);

    for (const l of s.line_sections)
      db.prepare('INSERT INTO line_sections (id,name,interlocking_id) VALUES (?,?,?)')
        .run(l.id, l.name, l.interlocking_id);

    for (const a of s.assets)
      db.prepare(`INSERT INTO assets (id,kind,section_id,state,inspection_due_on,last_inspected_on,config_note)
        VALUES (?,?,?,?,?,NULL,NULL)`).run(a.id, a.kind, a.section_id, a.state, a.inspection_due_on);

    for (const t of s.teams)
      db.prepare('INSERT INTO teams (id,name,on_call) VALUES (?,?,?)').run(t.id, t.name, t.on_call ? 1 : 0);

    for (const t of s.technicians)
      db.prepare(`INSERT INTO technicians (id,name,team_id,competences,competence_expires_on,base_rate_pence_per_hour)
        VALUES (?,?,?,?,?,?)`).run(t.id, t.name, t.team_id, t.competences.join(','),
                                   t.competence_expires_on, t.base_rate_pence_per_hour);

    for (const c of s.competence_requirements)
      db.prepare('INSERT INTO competence_requirements (id,asset_kind,requires,note) VALUES (?,?,?,?)')
        .run(c.id, c.asset_kind, c.requires, c.note || null);

    for (const o of s.operators)
      db.prepare('INSERT INTO operators (id,name) VALUES (?,?)').run(o.id, o.name);

    for (const i of s.incidents)
      db.prepare(`INSERT INTO incidents (id,asset_id,section_id,state,raised_at,raised_by,
        acknowledged_at,acknowledged_by,assigned_at,assigned_by,cleared_at,cleared_by,settlement_id,note)
        VALUES (?,?,?,?,?,NULL,NULL,NULL,NULL,NULL,?,NULL,NULL,?)`)
        .run(i.id, i.asset_id, i.section_id, i.state, i.raised_at, i.cleared_at || null, i.note || null);

    for (const d of s.delay_records)
      db.prepare('INSERT INTO delay_records (id,incident_id,operator_id,delay_minutes,created_at) VALUES (?,?,?,?,?)')
        .run(d.id, d.incident_id, d.operator_id, d.delay_minutes, d.created_at || s.incidents[0].raised_at);

    for (const h of s.handback_stages)
      db.prepare('INSERT INTO handback_stages (id,sequence,name,evidence_required) VALUES (?,?,?,?)')
        .run(h.id, h.sequence, h.name, h.evidence_required);

    for (const j of s.jobs)
      db.prepare(`INSERT INTO jobs (id,asset_id,incident_id,kind,state,team_id,technician_id,
        possession_id,started_at,completed_at,note)
        VALUES (?,?,?,?,?,?,NULL,NULL,NULL,NULL,?)`)
        .run(j.id, j.asset_id, j.incident_id, j.kind, j.state, j.team_id, j.note || null);

    // A job that arrives already carrying a team carries the assignment record
    // that put it there, so the assignment history is never empty for it.
    for (const j of s.jobs) {
      if (!j.team_id) continue;
      db.prepare(`INSERT INTO job_assignments (id,job_id,team_id,technician_id,assigned_by,assigned_at,
        competence_required,competence_expires_on,state) VALUES (?,?,?,NULL,NULL,?,NULL,NULL,'ACTIVE')`)
        .run(`ASG-SEED-${j.id}`, j.id, j.team_id, s.incidents[0].raised_at);
    }

    for (const p of s.possession_plans)
      db.prepare(`INSERT INTO possession_plans (id,section_id,starts_at,ends_at,state,planner_id,
        approved_by,approved_at,version,executed_at,note) VALUES (?,?,?,?,?,?,?,?,1,NULL,?)`)
        .run(p.id, p.section_id, p.starts_at, p.ends_at, p.state, p.planner_id,
             p.approved_by || null, p.approved_by ? p.starts_at : null, p.note || null);

    for (const p of s.possession_plans) {
      if (!p.approved_by) continue;
      db.prepare(`INSERT INTO possession_approvals (id,plan_id,approver_id,plan_version,state,created_at,invalidated_reason)
        VALUES (?,?,?,1,'APPROVED',?,NULL)`).run(`PAP-SEED-${p.id}`, p.id, p.approved_by, p.starts_at);
    }

    for (const b of s.line_blockages)
      db.prepare(`INSERT INTO line_blockages (id,section_id,state,placed_by,reason,placed_at,removed_by,removed_at)
        VALUES (?,?,?,?,?,?,NULL,NULL)`)
        .run(b.id, b.section_id, b.state, b.placed_by, b.reason, s.incidents[0].raised_at);

    for (const b of s.delay_penalty_bands)
      db.prepare('INSERT INTO delay_penalty_bands (id,sequence,up_to_minutes,pence_per_minute) VALUES (?,?,?,?)')
        .run(b.id, b.sequence, b.up_to_minutes === null ? null : b.up_to_minutes, b.pence_per_minute);

    for (const w of s.major_disruption_windows)
      db.prepare('INSERT INTO major_disruption_windows (id,starts_at,ends_at,reason) VALUES (?,?,?,?)')
        .run(w.id, w.starts_at, w.ends_at, w.reason || null);

    for (const c of s.mutual_aid_credits)
      db.prepare('INSERT INTO mutual_aid_credits (id,incident_id,amount_pence,state,consumed_on_settlement) VALUES (?,?,?,?,NULL)')
        .run(c.id, c.incident_id, c.amount_pence, c.state);

    for (const r of s.payroll_rules) {
      const { id, rule, ...rest } = r;
      db.prepare('INSERT INTO payroll_rules (id,rule,detail) VALUES (?,?,?)').run(id, rule, JSON.stringify(rest));
    }

    for (const c of s.callouts)
      db.prepare('INSERT INTO callouts (id,technician_id,job_id,starts_at,ends_at,settled_in,created_at) VALUES (?,?,?,?,?,NULL,?)')
        .run(c.id, c.technician_id, c.job_id, c.starts_at, c.ends_at, c.starts_at);

    for (const p of s.settlement_periods)
      db.prepare('INSERT INTO settlement_periods (id,label,state,closed_by,closed_at) VALUES (?,?,?,NULL,NULL)')
        .run(p.id, p.label, p.state);

    // The reference moment: the latest incident the control office has seen.
    // Fixed at seed time so a restart, and every later comparison, agree.
    const referenceAt = s.incidents
      .map((i) => i.raised_at)
      .sort()
      .slice(-1)[0];
    db.prepare('INSERT INTO system_clock (id,reference_at,reference_date) VALUES (?,?,?)')
      .run('CLOCK', referenceAt, referenceAt.slice(0, 10));
  });
  tx();
}

module.exports = { open, DB_PATH, DATA_DIR, SEED_PATH };
