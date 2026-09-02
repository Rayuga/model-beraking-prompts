'use strict';
// Orbital Ops Console data layer. Opens the SQLite database, creates the
// schema and seeds it ONCE. If the users table is non-empty the seed returns
// immediately and nothing is reset, so state survives a restart. The golden
// reads its OWN co-located seed workbook (seed_data.xlsx) so moving the shipped
// asset can never break it.
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const XLSX = require('xlsx');
const { hashPassword } = require('./auth');

const DATA_DIR = process.env.ORBITALOPS_DATA_DIR || path.join(__dirname, '..', 'data');
const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'orbitalops.db');
const SEED_PATH =
  process.env.SEED_PATH ||
  (fs.existsSync(path.join(__dirname, 'seed_data.xlsx'))
    ? path.join(__dirname, 'seed_data.xlsx')
    : fs.existsSync(path.join(__dirname, '..', 'seed_data.xlsx'))
    ? path.join(__dirname, '..', 'seed_data.xlsx')
    : '/assets/artifacts/orbitalops_seed.xlsx');

// The seed ships as an Excel workbook (orbitalops_seed.xlsx): one sheet per
// entity array (users, craft, passes, commands, anomalies, telemetry,
// audit_seed) with each row a record and columns the record's keys, plus a
// Constants sheet holding the scalar figures. We parse it back into the exact
// roster shape the seeding logic below expects, so the seeded DB is identical
// to the state the old JSON seed produced.
function loadRoster(xlsxPath) {
  const wb = XLSX.readFile(xlsxPath);
  const rows = (name) =>
    XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: null, raw: true });

  const constants = {};
  for (const r of rows('Constants')) constants[r.key] = r.value;

  const users = rows('users').map((u) => ({
    ...u,
    // assigned_craft is stored as a compact JSON array string in the cell.
    assigned_craft:
      u.assigned_craft == null || u.assigned_craft === ''
        ? []
        : typeof u.assigned_craft === 'string'
        ? JSON.parse(u.assigned_craft)
        : u.assigned_craft,
  }));

  return {
    password_for_all_accounts: constants.password_for_all_accounts,
    high_energy_delta_v_ms: constants.high_energy_delta_v_ms,
    battery_reserve_pct: constants.battery_reserve_pct,
    users,
    craft: rows('craft'),
    passes: rows('passes'),
    commands: rows('commands'),
    anomalies: rows('anomalies'),
    telemetry: rows('telemetry'),
    audit_seed: rows('audit_seed'),
  };
}

const ROSTER = loadRoster(SEED_PATH);

// The two threshold figures are STATED reference data, read straight from the
// roster and never hardcoded in a route or re-derived by a write.
const reference = {
  high_energy_delta_v_ms: ROSTER.high_energy_delta_v_ms,
  battery_reserve_pct: ROSTER.battery_reserve_pct,
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
  CREATE TABLE IF NOT EXISTS config (k TEXT PRIMARY KEY, v TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS users (
    email   TEXT PRIMARY KEY,
    name    TEXT NOT NULL,
    role    TEXT NOT NULL,
    status  TEXT NOT NULL DEFAULT 'ACTIVE',
    salt    TEXT NOT NULL,
    pw_hash TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS user_craft (
    email      TEXT NOT NULL,
    craft_code TEXT NOT NULL,
    PRIMARY KEY (email, craft_code));

  CREATE TABLE IF NOT EXISTS sessions (
    token      TEXT PRIMARY KEY,
    email      TEXT NOT NULL,
    created_at TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS craft (
    code          TEXT PRIMARY KEY,
    name          TEXT NOT NULL,
    tank_kg       REAL NOT NULL,
    propellant_kg REAL NOT NULL,
    battery_pct   INTEGER NOT NULL,
    reserve_pct   INTEGER NOT NULL,
    checkout      TEXT NOT NULL,
    checkout_at   TEXT);

  CREATE TABLE IF NOT EXISTS passes (
    code       TEXT PRIMARY KEY,
    craft_code TEXT NOT NULL,
    opens_at   TEXT NOT NULL,
    closes_at  TEXT NOT NULL);

  -- The plan/threshold figures a command is judged against (propellant,
  -- battery draw, window, delta-v) all live on THIS row, never on the client
  -- request. authorized_by/at are set only by the authorize route.
  CREATE TABLE IF NOT EXISTS commands (
    ref              TEXT PRIMARY KEY,
    craft_code       TEXT NOT NULL,
    type             TEXT NOT NULL,
    delta_v_ms       REAL NOT NULL DEFAULT 0,
    propellant_kg    REAL NOT NULL DEFAULT 0,
    battery_draw_pct INTEGER NOT NULL DEFAULT 0,
    starts_at        TEXT NOT NULL,
    ends_at          TEXT NOT NULL,
    status           TEXT NOT NULL DEFAULT 'DRAFT',
    submitted_by     TEXT,
    authorized_by    TEXT,
    authorized_at    TEXT,
    executed_at      TEXT);

  CREATE TABLE IF NOT EXISTS anomalies (
    code       TEXT PRIMARY KEY,
    craft_code TEXT NOT NULL,
    status     TEXT NOT NULL,
    summary    TEXT NOT NULL,
    raised_at  TEXT NOT NULL);

  CREATE TABLE IF NOT EXISTS telemetry (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    craft_code    TEXT NOT NULL,
    recorded_at   TEXT NOT NULL,
    battery_pct   INTEGER NOT NULL,
    propellant_kg REAL NOT NULL,
    temp_c        REAL NOT NULL);

  -- Append-only. No route ever updates or deletes a row here.
  CREATE TABLE IF NOT EXISTS audit (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    action      TEXT NOT NULL,
    subject_ref TEXT,
    actor_email TEXT,
    at          TEXT NOT NULL,
    detail      TEXT);

  CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `);
}

function seedIfEmpty(db) {
  const n = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (n > 0) return; // never re-seed: state must survive a restart
  const s = ROSTER;
  const pw = s.password_for_all_accounts;

  const tx = db.transaction(() => {
    db.prepare('INSERT OR REPLACE INTO config (k, v) VALUES (?, ?)')
      .run('high_energy_delta_v_ms', String(s.high_energy_delta_v_ms));
    db.prepare('INSERT OR REPLACE INTO config (k, v) VALUES (?, ?)')
      .run('battery_reserve_pct', String(s.battery_reserve_pct));

    const insUser = db.prepare(
      `INSERT INTO users (email, name, role, status, salt, pw_hash) VALUES (?, ?, ?, 'ACTIVE', ?, ?)`
    );
    const insAssign = db.prepare(
      'INSERT INTO user_craft (email, craft_code) VALUES (?, ?)'
    );
    for (const u of s.users) {
      const { salt, hash } = hashPassword(pw);
      insUser.run(u.email, u.name, u.role, salt, hash);
      for (const c of u.assigned_craft || []) insAssign.run(u.email, c);
    }

    const insCraft = db.prepare(
      `INSERT INTO craft (code, name, tank_kg, propellant_kg, battery_pct, reserve_pct, checkout, checkout_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of s.craft) {
      insCraft.run(c.code, c.name, c.tank_kg, c.propellant_kg, c.battery_pct, c.reserve_pct, c.checkout, c.checkout_at);
    }

    const insPass = db.prepare(
      'INSERT INTO passes (code, craft_code, opens_at, closes_at) VALUES (?, ?, ?, ?)'
    );
    for (const p of s.passes) insPass.run(p.code, p.craft_code, p.opens_at, p.closes_at);

    const insCmd = db.prepare(
      `INSERT INTO commands
         (ref, craft_code, type, delta_v_ms, propellant_kg, battery_draw_pct,
          starts_at, ends_at, status, submitted_by, executed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const c of s.commands) {
      insCmd.run(
        c.ref, c.craft_code, c.type, c.delta_v_ms, c.propellant_kg, c.battery_draw_pct,
        c.starts_at, c.ends_at, c.status, c.submitted_by || null, c.executed_at || null
      );
    }

    const insAnom = db.prepare(
      'INSERT INTO anomalies (code, craft_code, status, summary, raised_at) VALUES (?, ?, ?, ?, ?)'
    );
    for (const a of s.anomalies) insAnom.run(a.code, a.craft_code, a.status, a.summary, a.raised_at);

    const insTel = db.prepare(
      `INSERT INTO telemetry (craft_code, recorded_at, battery_pct, propellant_kg, temp_c)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const t of s.telemetry) insTel.run(t.craft_code, t.recorded_at, t.battery_pct, t.propellant_kg, t.temp_c);

    const insAudit = db.prepare(
      'INSERT INTO audit (action, subject_ref, actor_email, at, detail) VALUES (?, ?, ?, ?, ?)'
    );
    for (const a of s.audit_seed || []) insAudit.run(a.action, a.subject_ref, a.actor_email, a.at, a.detail || null);

    db.prepare('INSERT INTO meta (k, v) VALUES (?, ?)').run('loaded', new Date().toISOString());
  });
  tx();
}

function config(db, key, fallback = null) {
  const row = db.prepare('SELECT v FROM config WHERE k = ?').get(key);
  return row ? row.v : fallback;
}

function thresholds(db) {
  return {
    highEnergyDeltaV: Number(config(db, 'high_energy_delta_v_ms', reference.high_energy_delta_v_ms)),
    batteryReservePct: Number(config(db, 'battery_reserve_pct', reference.battery_reserve_pct)),
  };
}

module.exports = { open, createSchema, seedIfEmpty, reference, thresholds, DB_PATH, DATA_DIR, SEED_PATH };
