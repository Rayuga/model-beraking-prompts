import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { seed } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const configuredPath = process.env.DB_PATH;
const databasePath = configuredPath ? path.resolve(configuredPath) : path.resolve(__dirname, '../torquebay.db');
const dataDir = path.dirname(databasePath);
fs.mkdirSync(dataDir, { recursive: true });

const raw = new Database(databasePath);
raw.exec('PRAGMA foreign_keys = ON');
raw.exec('PRAGMA journal_mode = WAL');
raw.exec('PRAGMA busy_timeout = 5000');

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
        try { raw.exec('ROLLBACK'); } catch { }
        throw error;
      }
    };
  }
};

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN (
      'SERVICE_ADVISOR','TECHNICIAN','SHOP_FOREMAN','PARTS_MANAGER',
      'SHOP_MANAGER','WARRANTY_ADMIN','CUSTOMER'
    )),
    customer_id TEXT,
    approval_limit_cents INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_name TEXT,
    email TEXT,
    phone TEXT,
    billing_address TEXT,
    preferred_contact TEXT,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ON_HOLD','SUSPENDED')),
    outstanding_balance_cents INTEGER NOT NULL DEFAULT 0,
    hold_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    vin TEXT NOT NULL UNIQUE,
    make TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER NOT NULL,
    license_plate TEXT,
    mileage INTEGER NOT NULL,
    drivetrain TEXT NOT NULL CHECK (drivetrain IN ('GAS','DIESEL','HYBRID','EV')),
    engine_family TEXT,
    status TEXT NOT NULL DEFAULT 'CHECKED_IN' CHECK (status IN (
      'CHECKED_IN','IN_BAY','AWAITING_PARTS','AWAITING_APPROVAL','READY_FOR_PICKUP','PICKED_UP'
    )),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS technicians (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id),
    daily_labor_hour_limit REAL NOT NULL DEFAULT 8,
    employment_status TEXT NOT NULL DEFAULT 'ACTIVE',
    safety_qc_score REAL NOT NULL DEFAULT 90,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN (
      'AVAILABLE','ASSIGNED','ON_JOB','OFF_DUTY','SUSPENDED'
    ))
  );

  CREATE TABLE IF NOT EXISTS certifications (
    id TEXT PRIMARY KEY,
    technician_id TEXT NOT NULL REFERENCES technicians(id),
    cert_type TEXT NOT NULL CHECK (cert_type IN ('GENERAL','EV_HYBRID','ALIGNMENT','EPA_609')),
    expires_on TEXT NOT NULL,
    UNIQUE (technician_id, cert_type)
  );

  CREATE TABLE IF NOT EXISTS bays (
    id TEXT PRIMARY KEY,
    number INTEGER NOT NULL UNIQUE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('LIFT','ALIGNMENT','DIAGNOSTIC','HEAVY_DUTY')),
    equipment TEXT,
    status TEXT NOT NULL DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE','OCCUPIED','MAINTENANCE_HOLD')),
    version INTEGER NOT NULL DEFAULT 1,
    maintenance_reason TEXT
  );

  CREATE TABLE IF NOT EXISTS parts (
    id TEXT PRIMARY KEY,
    part_number TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    reorder_threshold INTEGER NOT NULL DEFAULT 2,
    unit_cost_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'IN_STOCK' CHECK (status IN (
      'IN_STOCK','LOW_STOCK','BACKORDERED','ON_ORDER','RESERVED'
    ))
  );

  CREATE TABLE IF NOT EXISTS part_compatibilities (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL REFERENCES parts(id),
    make TEXT,
    model TEXT,
    year_from INTEGER,
    year_to INTEGER,
    drivetrain TEXT,
    engine_family TEXT
  );

  CREATE TABLE IF NOT EXISTS warranty_coverages (
    id TEXT PRIMARY KEY,
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
    coverage_type TEXT NOT NULL CHECK (coverage_type IN ('MANUFACTURER','SHOP')),
    component TEXT NOT NULL,
    expires_on TEXT NOT NULL,
    mileage_limit INTEGER,
    active INTEGER NOT NULL DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS repair_orders (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    vehicle_id TEXT NOT NULL REFERENCES vehicles(id),
    opened_by TEXT NOT NULL REFERENCES users(id),
    intake_notes TEXT,
    diagnostic_findings TEXT,
    intake_mileage INTEGER NOT NULL,
    priority TEXT NOT NULL DEFAULT 'NORMAL' CHECK (priority IN ('LOW','NORMAL','HIGH','URGENT')),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
      'DRAFT','DIAGNOSING','ESTIMATE_PENDING','ESTIMATE_APPROVED',
      'IN_PROGRESS','AWAITING_PARTS','COMPLETED','INVOICED','CLOSED','CANCELLED'
    )),
    completion_key TEXT UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS estimates (
    id TEXT PRIMARY KEY,
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
      'DRAFT','PENDING_APPROVAL','PARTIALLY_APPROVED','PENDING_STAFF_APPROVAL','APPROVED','REJECTED','EXPIRED'
    )),
    revision INTEGER NOT NULL DEFAULT 1,
    expires_at TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    sent_at TEXT,
    staff_approved_by TEXT REFERENCES users(id),
    staff_approved_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS estimate_line_items (
    id TEXT PRIMARY KEY,
    estimate_id TEXT NOT NULL REFERENCES estimates(id),
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    kind TEXT NOT NULL CHECK (kind IN ('LABOR','PARTS')),
    description TEXT NOT NULL,
    required_certification TEXT,
    hours REAL,
    labor_rate_cents INTEGER,
    part_id TEXT REFERENCES parts(id),
    quantity INTEGER,
    unit_cost_cents INTEGER,
    amount_cents INTEGER NOT NULL,
    customer_approval TEXT NOT NULL DEFAULT 'NONE' CHECK (customer_approval IN ('NONE','APPROVED','DECLINED')),
    approved_by TEXT REFERENCES users(id),
    approved_at TEXT,
    created_by TEXT NOT NULL REFERENCES users(id),
    warranty_component TEXT,
    documentation_required TEXT,
    billed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS bay_bookings (
    id TEXT PRIMARY KEY,
    bay_id TEXT NOT NULL REFERENCES bays(id),
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RELEASED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS technician_assignments (
    id TEXT PRIMARY KEY,
    technician_id TEXT NOT NULL REFERENCES technicians(id),
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    window_start TEXT NOT NULL,
    window_end TEXT NOT NULL,
    overtime_override INTEGER NOT NULL DEFAULT 0,
    override_reason TEXT,
    override_by TEXT REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RELEASED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS labor_logs (
    id TEXT PRIMARY KEY,
    technician_id TEXT NOT NULL REFERENCES technicians(id),
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    line_item_id TEXT REFERENCES estimate_line_items(id),
    hours REAL NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS job_documents (
    id TEXT PRIMARY KEY,
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    line_item_id TEXT NOT NULL REFERENCES estimate_line_items(id),
    doc_type TEXT NOT NULL CHECK (doc_type IN ('PHOTO','TORQUE','ROAD_TEST')),
    notes TEXT,
    attached_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (line_item_id, doc_type)
  );

  CREATE TABLE IF NOT EXISTS part_reservations (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL REFERENCES parts(id),
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    line_item_id TEXT,
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'RESERVED' CHECK (status IN ('RESERVED','BACKORDERED','CONSUMED','RELEASED')),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shipments (
    id TEXT PRIMARY KEY,
    part_id TEXT NOT NULL REFERENCES parts(id),
    quantity INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'INCOMING' CHECK (status IN ('INCOMING','RECEIVED')),
    expected_on TEXT,
    received_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS warranty_claims (
    id TEXT PRIMARY KEY,
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    line_item_id TEXT NOT NULL UNIQUE,
    coverage_id TEXT REFERENCES warranty_coverages(id),
    coverage_type TEXT NOT NULL,
    claim_amount_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'FILED' CHECK (status IN (
      'FILED','UNDER_REVIEW','APPROVED','DENIED','REIMBURSED'
    )),
    filed_by TEXT NOT NULL REFERENCES users(id),
    reviewer_id TEXT REFERENCES users(id),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY,
    number TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    repair_order_id TEXT NOT NULL REFERENCES repair_orders(id),
    subtotal_cents INTEGER NOT NULL,
    tax_cents INTEGER NOT NULL,
    discount_cents INTEGER NOT NULL DEFAULT 0,
    total_cents INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
      'DRAFT','PENDING_APPROVAL','APPROVED','SENT','PAID','VOID'
    )),
    created_by TEXT NOT NULL REFERENCES users(id),
    approved_by TEXT REFERENCES users(id),
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS invoice_line_items (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    estimate_line_item_id TEXT NOT NULL,
    description TEXT NOT NULL,
    amount_cents INTEGER NOT NULL,
    UNIQUE (invoice_id, estimate_line_item_id)
  );

  CREATE TABLE IF NOT EXISTS invoice_corrections (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    previous_total_cents INTEGER NOT NULL,
    new_total_cents INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES invoices(id),
    customer_id TEXT NOT NULL REFERENCES customers(id),
    amount_cents INTEGER NOT NULL,
    method TEXT NOT NULL DEFAULT 'LEDGER',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS appointment_requests (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES customers(id),
    vehicle_id TEXT REFERENCES vehicles(id),
    preferred_date TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'REQUESTED',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor_id TEXT NOT NULL,
    actor_name TEXT NOT NULL,
    actor_role TEXT NOT NULL,
    action TEXT NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    previous_state TEXT,
    new_state TEXT,
    reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS ro_customer_idx ON repair_orders(customer_id);
  CREATE INDEX IF NOT EXISTS ro_status_idx ON repair_orders(status);
  CREATE INDEX IF NOT EXISTS lines_ro_idx ON estimate_line_items(repair_order_id);
  CREATE INDEX IF NOT EXISTS bookings_bay_idx ON bay_bookings(bay_id, status);
  CREATE INDEX IF NOT EXISTS assign_tech_idx ON technician_assignments(technician_id, status);
  CREATE INDEX IF NOT EXISTS audit_entity_idx ON audit_log(entity, entity_id);
`);

seed(db);

export function nowIso() {
  return new Date().toISOString();
}

export function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

export function addDays(date, days) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    customer_id: user.customer_id,
    approval_limit_cents: user.approval_limit_cents
  };
}
