const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

const sql = postgres(process.env.DATABASE_URL || 'postgres://gearvault:gearvault@127.0.0.1:5432/gearvault', { max: 12 });
const readSeed = name => JSON.parse(fs.readFileSync(path.join(__dirname, 'assets', name), 'utf8'));

async function initialize() {
  await sql`CREATE EXTENSION IF NOT EXISTS btree_gist`;
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS people (
      id uuid PRIMARY KEY, email text UNIQUE NOT NULL, full_name text NOT NULL,
      role text NOT NULL, account_status text NOT NULL DEFAULT 'ACTIVE',
      outstanding_balance_cents integer NOT NULL DEFAULT 0,
      member boolean NOT NULL DEFAULT false,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS locations (
      id uuid PRIMARY KEY, name text NOT NULL, slug text UNIQUE NOT NULL, address text NOT NULL
    );
    CREATE TABLE IF NOT EXISTS units (
      id uuid PRIMARY KEY, asset_tag text UNIQUE NOT NULL, category text NOT NULL, model text NOT NULL,
      location_id uuid NOT NULL REFERENCES locations(id), daily_rate_cents integer NOT NULL CHECK (daily_rate_cents >= 0),
      deposit_cents integer NOT NULL CHECK (deposit_cents >= 0), replacement_value_cents integer NOT NULL CHECK (replacement_value_cents >= 0),
      required_certification text, status text NOT NULL CHECK (status IN ('AVAILABLE','RESERVED','CHECKED_OUT','AWAITING_INSPECTION','IN_REPAIR','RETIRED'))
    );
    CREATE TABLE IF NOT EXISTS certifications (
      id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES people(id), certification_type text NOT NULL,
      issued_on date NOT NULL, expires_on date NOT NULL
    );
    CREATE TABLE IF NOT EXISTS checkout_quotes (
      id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES people(id), unit_id uuid NOT NULL REFERENCES units(id),
      start_date date NOT NULL, end_date date NOT NULL, day_count integer NOT NULL,
      base_cents integer NOT NULL, discount_cents integer NOT NULL, rental_cents integer NOT NULL,
      weekend_cents integer NOT NULL, tax_cents integer NOT NULL, hull_cents integer NOT NULL,
      deposit_cents integer NOT NULL, total_cents integer NOT NULL, vendor_snapshot jsonb NOT NULL,
      stripe_session_id text UNIQUE, stripe_url text, status text NOT NULL DEFAULT 'OPEN', created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS reservations (
      id uuid PRIMARY KEY, customer_id uuid NOT NULL REFERENCES people(id), unit_id uuid NOT NULL REFERENCES units(id),
      quote_id uuid UNIQUE REFERENCES checkout_quotes(id), start_date date NOT NULL, end_date date NOT NULL,
      day_count integer NOT NULL, base_cents integer NOT NULL, discount_cents integer NOT NULL, rental_cents integer NOT NULL,
      weekend_cents integer NOT NULL, tax_cents integer NOT NULL, hull_cents integer NOT NULL, deposit_cents integer NOT NULL,
      total_cents integer NOT NULL, deposit_deduction_cents integer NOT NULL DEFAULT 0,
      status text NOT NULL CHECK (status IN ('PAID','CHECKED_OUT','AWAITING_INSPECTION','AWAITING_DECISION','COMPLETED','CANCELLED')),
      stripe_session_id text UNIQUE NOT NULL, stripe_payment_intent_id text, paid_at timestamptz NOT NULL,
      checked_out_at timestamptz, returned_at timestamptz, completed_at timestamptz, cancelled_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS serial_scans (
      id uuid PRIMARY KEY, reservation_id uuid NOT NULL REFERENCES reservations(id), unit_id uuid NOT NULL REFERENCES units(id),
      technician_id uuid NOT NULL REFERENCES people(id), bay_code text NOT NULL, vendor_ticket_id text UNIQUE NOT NULL,
      used boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS inspections (
      id uuid PRIMARY KEY, reservation_id uuid UNIQUE NOT NULL REFERENCES reservations(id), assessor_id uuid NOT NULL REFERENCES people(id),
      outcome text NOT NULL CHECK (outcome IN ('CLEAR','DAMAGE')), severity text,
      notes text NOT NULL DEFAULT '', proposed_cents integer NOT NULL DEFAULT 0,
      photo_ticket_id text, status text NOT NULL CHECK (status IN ('PENDING','APPROVED')),
      manager_id uuid REFERENCES people(id), approved_cents integer, decision_notes text,
      created_at timestamptz NOT NULL DEFAULT now(), decided_at timestamptz
    );
    CREATE TABLE IF NOT EXISTS transfers (
      id uuid PRIMARY KEY, unit_id uuid NOT NULL REFERENCES units(id), from_location_id uuid NOT NULL REFERENCES locations(id),
      to_location_id uuid NOT NULL REFERENCES locations(id), clerk_id uuid NOT NULL REFERENCES people(id),
      vendor_stamp_id text UNIQUE NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS audit_log (
      id bigserial PRIMARY KEY, actor_id uuid NOT NULL REFERENCES people(id), action text NOT NULL,
      entity_type text NOT NULL, entity_id text NOT NULL, before_state jsonb, after_state jsonb,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS idempotency_receipts (
      actor_id uuid NOT NULL REFERENCES people(id), ticket_key text NOT NULL, request_hash text NOT NULL,
      status_code integer NOT NULL, response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (actor_id, ticket_key)
    );
  `);
  await sql`DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='no_live_reservation_overlap') THEN
      ALTER TABLE reservations ADD CONSTRAINT no_live_reservation_overlap EXCLUDE USING gist
      (unit_id WITH =, daterange(start_date, end_date, '[]') WITH &&)
      WHERE (status IN ('PAID','CHECKED_OUT','AWAITING_INSPECTION','AWAITING_DECISION'));
    END IF;
  END $$`;

  const customers = readSeed('customers_seed_data.json').customers;
  const staff = readSeed('staff_seed_data.json').staff;
  for (const p of customers) await sql`INSERT INTO people ${sql({id:p.id,email:p.email,full_name:p.full_name,role:'customer',account_status:p.account_status,outstanding_balance_cents:p.outstanding_balance_usd*100,member:p.full_name==='Maya Chen'})} ON CONFLICT (id) DO NOTHING`;
  for (const p of staff) await sql`INSERT INTO people ${sql({id:p.id,email:p.email,full_name:p.full_name,role:p.role,account_status:'ACTIVE',outstanding_balance_cents:0,member:false})} ON CONFLICT (id) DO NOTHING`;
  for (const l of readSeed('locations_seed_data.json').locations) await sql`INSERT INTO locations ${sql(l)} ON CONFLICT (id) DO NOTHING`;
  for (const u of readSeed('units_seed_data.json').units) await sql`INSERT INTO units ${sql({id:u.id,asset_tag:u.asset_tag,category:u.category,model:u.model,location_id:u.location_id,daily_rate_cents:u.daily_rate_usd*100,deposit_cents:u.deposit_usd*100,replacement_value_cents:u.replacement_value_usd*100,required_certification:u.required_certification,status:u.status})} ON CONFLICT (id) DO NOTHING`;
  for (const c of readSeed('certifications_seed_data.json').certifications) await sql`INSERT INTO certifications ${sql({id:c.id,customer_id:c.customer_id,certification_type:c.certification_type,issued_on:c.issued_on,expires_on:c.expires_on})} ON CONFLICT (id) DO NOTHING`;
}

module.exports = { sql, initialize };
