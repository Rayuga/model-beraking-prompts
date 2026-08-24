import postgres from 'postgres';
import { asDate } from './dates.js';

const url = process.env.DATABASE_URL || 'postgres://gearvault:gearvault@127.0.0.1:5432/gearvault';
export const sql = postgres(url, { max: 8, prepare: false, onnotice: () => {} });

export const DEFAULT_CUSTOMER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

function row(value) {
  if (!value) return value;
  const out = { ...value };
  for (const key of ['start_date', 'end_date', 'issued_on', 'expires_on']) {
    if (out[key] != null) out[key] = asDate(out[key]);
  }
  return out;
}

function rows(list) {
  return (list || []).map(row);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    role: user.role,
    account_status: user.account_status,
    outstanding_balance_usd: (user.outstanding_balance_cents || 0) / 100,
    member: Boolean(user.member)
  };
}

export function isUniqueConstraintError(error) {
  if (!error || typeof error !== 'object') return false;
  const code = String(error.code || '');
  return code === '23505' || code === '23P01' || /unique|exclusion/i.test(String(error.message || ''));
}

export async function userById(id) {
  const [found] = await sql`SELECT * FROM users WHERE id = ${id}`;
  return found || null;
}

export async function locationById(id) {
  const [found] = await sql`SELECT * FROM locations WHERE id = ${id}`;
  return found || null;
}

export async function allLocations() {
  return sql`SELECT * FROM locations ORDER BY name`;
}

export async function unitById(id) {
  const [found] = await sql`SELECT * FROM units WHERE id = ${id}`;
  return found || null;
}

export async function unitByIdOrTag(id) {
  const [found] = await sql`SELECT * FROM units WHERE id = ${id} OR asset_tag = ${id}`;
  return found || null;
}

export async function allUnits() {
  return sql`SELECT * FROM units ORDER BY asset_tag`;
}

export async function reservationById(id) {
  const [found] = await sql`SELECT * FROM reservations WHERE id = ${id}`;
  return row(found || null);
}

export async function reservationBySession(sessionId) {
  const [found] = await sql`SELECT * FROM reservations WHERE stripe_session_id = ${sessionId}`;
  return row(found || null);
}

export async function reservationForCustomer(id, customerId) {
  const [found] = await sql`
    SELECT * FROM reservations WHERE id = ${id} AND customer_id = ${customerId}
  `;
  return row(found || null);
}

export async function reservationsFor(customerId) {
  if (customerId) {
    return rows(await sql`
      SELECT * FROM reservations WHERE customer_id = ${customerId}
      ORDER BY start_date DESC, created_at DESC
    `);
  }
  return rows(await sql`SELECT * FROM reservations ORDER BY start_date DESC, created_at DESC`);
}

export async function reservationIdsFor(customerId) {
  const found = await sql`SELECT id FROM reservations WHERE customer_id = ${customerId}`;
  return found.map((item) => item.id);
}

export async function demoUsers() {
  return sql`
    SELECT id, email, full_name, role, account_status
    FROM users
    ORDER BY
      CASE role
        WHEN 'customer' THEN 0
        WHEN 'rental_associate' THEN 1
        WHEN 'damage_assessor' THEN 2
        WHEN 'transfer_clerk' THEN 3
        ELSE 4
      END,
      full_name
  `;
}

export async function certificationsFor(customerId) {
  if (customerId) {
    return rows(await sql`SELECT * FROM certifications WHERE customer_id = ${customerId}`);
  }
  return rows(await sql`SELECT * FROM certifications ORDER BY expires_on DESC`);
}

export async function userNames() {
  const found = await sql`SELECT id, full_name FROM users`;
  return Object.fromEntries(found.map((item) => [item.id, item.full_name]));
}

export async function hasCurrentCertification(customerId, certType, onDate) {
  if (!certType) return true;
  const [found] = await sql`
    SELECT 1 AS ok FROM certifications
    WHERE customer_id = ${customerId}
      AND certification_type = ${certType}
      AND issued_on <= ${onDate}
      AND expires_on >= ${onDate}
  `;
  return Boolean(found);
}

export async function findOverlap(unitId, startDate, endDate, exceptId = null) {
  const found = exceptId
    ? await sql`
        SELECT id, start_date, end_date FROM reservations
        WHERE unit_id = ${unitId}
          AND status IN ('CONFIRMED','CHECKED_OUT','RETURNED')
          AND id != ${exceptId}
          AND start_date <= ${endDate}
          AND end_date >= ${startDate}
      `
    : await sql`
        SELECT id, start_date, end_date FROM reservations
        WHERE unit_id = ${unitId}
          AND status IN ('CONFIRMED','CHECKED_OUT','RETURNED')
          AND start_date <= ${endDate}
          AND end_date >= ${startDate}
      `;
  return row(found[0] || null);
}

export async function writeAudit(actorId, action, entityType, entityId, previousState, newState, reason) {
  await sql`
    INSERT INTO audit_log
      (id, actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
    VALUES (
      ${cryptoRandom()}, ${actorId}, ${action}, ${entityType}, ${entityId},
      ${previousState || null}, ${newState || null}, ${reason || null}
    )
  `;
}

function cryptoRandom() {
  return globalThis.crypto.randomUUID();
}

export async function insertReservation(values) {
  await sql`
    INSERT INTO reservations (
      id, customer_id, location_id, unit_id, start_date, end_date, status,
      daily_rate_cents, rental_subtotal_cents, tax_cents, hull_cents, surcharge_cents,
      deposit_held_cents, stripe_session_id, stripe_payment_intent
    ) VALUES (
      ${values.id}, ${values.customer_id}, ${values.location_id}, ${values.unit_id},
      ${values.start_date}, ${values.end_date}, 'CONFIRMED',
      ${values.daily_rate_cents}, ${values.rental_subtotal_cents}, ${values.tax_cents},
      ${values.hull_cents}, ${values.surcharge_cents}, ${values.deposit_held_cents},
      ${values.stripe_session_id}, ${values.stripe_payment_intent}
    )
  `;
}

export async function begin(fn) {
  return sql.begin(async (tx) => fn(tx));
}

export async function openFiledDamage(reservationId) {
  const [found] = await sql`
    SELECT 1 AS ok FROM damage_reports WHERE reservation_id = ${reservationId} AND status = 'FILED'
  `;
  return Boolean(found);
}

export async function filedDamageFor(reservationId, unitId) {
  const [found] = await sql`
    SELECT id FROM damage_reports
    WHERE reservation_id = ${reservationId} AND unit_id = ${unitId} AND status = 'FILED'
  `;
  return found || null;
}

export async function insertDamage(values) {
  await sql`
    INSERT INTO damage_reports (
      id, reservation_id, unit_id, filed_by, description, severity, proposed_cents, status
    ) VALUES (
      ${values.id}, ${values.reservation_id}, ${values.unit_id}, ${values.filed_by},
      ${values.description}, ${values.severity}, ${values.proposed_cents}, 'FILED'
    )
  `;
}

export async function damageById(id) {
  const [found] = await sql`SELECT * FROM damage_reports WHERE id = ${id}`;
  return found || null;
}

export async function damageReports() {
  return sql`
    SELECT d.*, u.asset_tag, r.customer_id, cu.full_name AS customer_name
    FROM damage_reports d
    JOIN units u ON u.id = d.unit_id
    JOIN reservations r ON r.id = d.reservation_id
    JOIN users cu ON cu.id = r.customer_id
    ORDER BY d.created_at DESC
  `;
}

export async function auditEntries() {
  return sql`SELECT * FROM audit_log ORDER BY created_at DESC`;
}

export async function migrate() {
  await sql`CREATE EXTENSION IF NOT EXISTS btree_gist`;
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN (
        'customer', 'rental_associate', 'damage_assessor', 'shop_manager',
        'transfer_clerk', 'bay_technician', 'night_auditor',
        'insurance_liaison', 'lot_runner'
      )),
      account_status TEXT NOT NULL DEFAULT 'ACTIVE'
        CHECK (account_status IN ('ACTIVE', 'ON_HOLD', 'SUSPENDED')),
      outstanding_balance_cents INTEGER NOT NULL DEFAULT 0,
      member BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      address TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS units (
      id TEXT PRIMARY KEY,
      asset_tag TEXT NOT NULL UNIQUE,
      category TEXT NOT NULL,
      model TEXT NOT NULL,
      location_id TEXT NOT NULL REFERENCES locations(id),
      daily_rate_cents INTEGER NOT NULL CHECK (daily_rate_cents > 0),
      deposit_cents INTEGER NOT NULL CHECK (deposit_cents > 0),
      replacement_value_cents INTEGER NOT NULL CHECK (replacement_value_cents > 0),
      required_certification TEXT,
      status TEXT NOT NULL DEFAULT 'AVAILABLE'
        CHECK (status IN (
          'AVAILABLE', 'RESERVED', 'CHECKED_OUT',
          'RETURNED_PENDING_INSPECTION', 'DAMAGE_HOLD',
          'IN_REPAIR', 'RETIRED'
        ))
    );

    CREATE TABLE IF NOT EXISTS certifications (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      certification_type TEXT NOT NULL,
      issued_on DATE NOT NULL,
      expires_on DATE NOT NULL
    );

    CREATE TABLE IF NOT EXISTS reservations (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL REFERENCES users(id),
      location_id TEXT NOT NULL REFERENCES locations(id),
      unit_id TEXT NOT NULL REFERENCES units(id),
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'CONFIRMED'
        CHECK (status IN (
          'CONFIRMED', 'CHECKED_OUT', 'RETURNED', 'CLOSED', 'CANCELLED'
        )),
      daily_rate_cents INTEGER NOT NULL,
      rental_subtotal_cents INTEGER NOT NULL,
      tax_cents INTEGER NOT NULL DEFAULT 0,
      hull_cents INTEGER NOT NULL DEFAULT 0,
      surcharge_cents INTEGER NOT NULL DEFAULT 0,
      deposit_held_cents INTEGER NOT NULL,
      deposit_captured_cents INTEGER NOT NULL DEFAULT 0,
      deposit_released_cents INTEGER NOT NULL DEFAULT 0,
      stripe_session_id TEXT UNIQUE,
      stripe_payment_intent TEXT,
      checked_out_at TIMESTAMPTZ,
      returned_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS damage_reports (
      id TEXT PRIMARY KEY,
      reservation_id TEXT NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
      unit_id TEXT NOT NULL REFERENCES units(id),
      filed_by TEXT NOT NULL REFERENCES users(id),
      description TEXT NOT NULL,
      severity TEXT NOT NULL,
      proposed_cents INTEGER NOT NULL CHECK (proposed_cents > 0),
      status TEXT NOT NULL DEFAULT 'FILED'
        CHECK (status IN ('FILED', 'APPROVED', 'DENIED')),
      reviewed_by TEXT REFERENCES users(id),
      decision_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS idempotency_keys (
      id TEXT PRIMARY KEY,
      idem_key TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      method TEXT NOT NULL,
      path TEXT NOT NULL,
      request_fingerprint TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (idem_key, actor_id)
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id TEXT PRIMARY KEY,
      actor_id TEXT NOT NULL,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      previous_state TEXT,
      new_state TEXT,
      reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  await sql.unsafe(`
    DO $$ BEGIN
      ALTER TABLE reservations ADD CONSTRAINT reservations_unit_overlap
        EXCLUDE USING gist (
          unit_id WITH =,
          daterange(start_date, end_date, '[]') WITH &&
        ) WHERE (status IN ('CONFIRMED','CHECKED_OUT','RETURNED'));
    EXCEPTION
      WHEN duplicate_object THEN NULL;
      WHEN duplicate_table THEN NULL;
    END $$;
    ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
    ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN (
      'customer', 'rental_associate', 'damage_assessor', 'shop_manager',
      'transfer_clerk', 'bay_technician', 'night_auditor',
      'insurance_liaison', 'lot_runner'
    ));
    ALTER TABLE users ADD COLUMN IF NOT EXISTS member BOOLEAN NOT NULL DEFAULT FALSE;
  `);
}

const locations = [
  ['44444444-4444-4444-4444-444444444444', 'Riverside Rental Center', 'riverside', '1800 River Road, Riverside'],
  ['55555555-5555-5555-5555-555555555555', 'Downtown Studio Annex', 'downtown', '42 Market Street, Downtown'],
  ['77777777-7777-7777-7777-777777777777', 'Harbour Pier Desk', 'pier', '9 Pier Lane, Harbour']
];

const users = [
  ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'maya.chen@example.com', 'Maya Chen', 'customer', 'ACTIVE', 0, true],
  ['bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'jordan.hale@example.com', 'Jordan Hale', 'customer', 'ACTIVE', 0, false],
  ['cccccccc-cccc-cccc-cccc-cccccccccccc', 'priya.nair@example.com', 'Priya Nair', 'customer', 'ON_HOLD', 15000, false],
  ['dddddddd-dddd-dddd-dddd-dddddddddddd', 'chris.nguyen@example.com', 'Chris Nguyen', 'customer', 'ACTIVE', 0, false],
  ['eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'tess.okada@example.com', 'Tess Okada', 'customer', 'ACTIVE', 0, false],
  ['ffffffff-ffff-ffff-ffff-ffffffffffff', 'luis.ferreira@example.com', 'Luis Ferreira', 'customer', 'ACTIVE', 0, false],
  ['11111111-1111-1111-1111-111111111111', 'sam.ortiz@gearvault.com', 'Sam Ortiz', 'rental_associate', 'ACTIVE', 0, false],
  ['88888888-8888-8888-8888-888888888888', 'dana.ruiz@gearvault.com', 'Dana Ruiz', 'rental_associate', 'ACTIVE', 0, false],
  ['22222222-2222-2222-2222-222222222222', 'riley.okonkwo@gearvault.com', 'Riley Okonkwo', 'damage_assessor', 'ACTIVE', 0, false],
  ['99999999-9999-9999-9999-999999999999', 'jules.adeyemi@gearvault.com', 'Jules Adeyemi', 'damage_assessor', 'ACTIVE', 0, false],
  ['33333333-3333-3333-3333-333333333333', 'elena.voss@gearvault.com', 'Elena Voss', 'shop_manager', 'ACTIVE', 0, false],
  ['66666666-6666-6666-6666-666666666666', 'noah.kim@gearvault.com', 'Noah Kim', 'transfer_clerk', 'ACTIVE', 0, false],
  ['77777777-aaaa-4aaa-8aaa-777777777777', 'omar.haddad@gearvault.com', 'Omar Haddad', 'bay_technician', 'ACTIVE', 0, false],
  ['10101010-1010-4010-8010-101010101010', 'harper.singh@gearvault.com', 'Harper Singh', 'night_auditor', 'ACTIVE', 0, false],
  ['12121212-1212-4212-8212-121212121212', 'wei.tan@gearvault.com', 'Wei Tan', 'insurance_liaison', 'ACTIVE', 0, false],
  ['13131313-1313-4313-8313-131313131313', 'casey.bloom@gearvault.com', 'Casey Bloom', 'lot_runner', 'ACTIVE', 0, false]
];

const units = [
  ['61000000-0000-4000-8000-000000000055', 'K-055', 'Camera Body', 'Full-frame mirrorless body', locations[0][0], 8500, 20000, 180000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000118', 'L-118', 'Lens', '70-200mm f/2.8', locations[0][0], 4500, 40000, 60000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000004', 'D-004', 'Drone', 'Cinema quadcopter', locations[1][0], 12000, 50000, 250000, 'Drone Operator', 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000012', 'T-012', 'Tent', '3-season two-person tent', locations[0][0], 2500, 8000, 22000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000301', 'S-301', 'PA Speaker', 'Powered 15-inch PA', locations[1][0], 6000, 15000, 90000, null, 'IN_REPAIR'],
  ['61000000-0000-4000-8000-000000000410', 'X-410', 'Lighting Rig', 'LED panel kit', locations[1][0], 9000, 30000, 220000, null, 'RETIRED'],
  ['61000000-0000-4000-8000-000000000216', 'B-216', 'Boom Pole', 'Carbon boom', locations[0][0], 1800, 4000, 22000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000088', 'M-088', 'Microphone', 'Shotgun condenser', locations[1][0], 3500, 9000, 45000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000300', 'Y-300', 'Lighting Rig', 'Bicolor LED tube pair', locations[1][0], 5500, 12000, 70000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000220', 'G-220', 'Generator', 'Quiet inverter 2200W', locations[2][0], 4000, 12000, 80000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000090', 'R-090', 'Rain Fly', 'Canvas rain fly', locations[2][0], 1200, 3000, 9000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000330', 'P-330', 'Projector', 'Short-throw 1080p', locations[2][0], 7000, 20000, 110000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000077', 'C-077', 'Camera Body', 'Crop-sensor stills body', locations[2][0], 5000, 15000, 90000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000015', 'E-015', 'PA Speaker', 'Battery column PA', locations[2][0], 4800, 11000, 64000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000201', 'N-201', 'Drone', 'Compact aerial', locations[2][0], 9500, 40000, 180000, 'Drone Operator', 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000019', 'H-019', 'Hydrophone', 'Underwater contact mic', locations[2][0], 2800, 7000, 32000, null, 'AVAILABLE'],
  ['61000000-0000-4000-8000-000000000612', 'F-612', 'Fog Machine', 'Hazers retired from the floor', locations[1][0], 2200, 5000, 18000, null, 'RETIRED'],
  ['61000000-0000-4000-8000-000000000044', 'W-044', 'Wireless Kit', 'Dual-channel IEM', locations[0][0], 6500, 18000, 95000, null, 'IN_REPAIR']
];

const certifications = [
  ['c1000000-0000-4000-8000-000000000001', users[0][0], 'Drone Operator', '2024-01-15', '2031-12-31'],
  ['c1000000-0000-4000-8000-000000000002', users[1][0], 'Drone Operator', '2022-01-10', '2024-03-01']
];

export async function seed() {
  for (const item of locations) {
    await sql`
      INSERT INTO locations (id, name, slug, address)
      VALUES (${item[0]}, ${item[1]}, ${item[2]}, ${item[3]})
      ON CONFLICT (id) DO NOTHING
    `;
  }
  for (const item of users) {
    await sql`
      INSERT INTO users (id, email, full_name, role, account_status, outstanding_balance_cents, member)
      VALUES (${item[0]}, ${item[1]}, ${item[2]}, ${item[3]}, ${item[4]}, ${item[5]}, ${item[6]})
      ON CONFLICT (id) DO UPDATE SET member = EXCLUDED.member
    `;
  }
  for (const item of units) {
    await sql`
      INSERT INTO units (
        id, asset_tag, category, model, location_id,
        daily_rate_cents, deposit_cents, replacement_value_cents,
        required_certification, status
      ) VALUES (
        ${item[0]}, ${item[1]}, ${item[2]}, ${item[3]}, ${item[4]},
        ${item[5]}, ${item[6]}, ${item[7]}, ${item[8]}, ${item[9]}
      )
      ON CONFLICT (id) DO NOTHING
    `;
  }
  for (const item of certifications) {
    await sql`
      INSERT INTO certifications (id, customer_id, certification_type, issued_on, expires_on)
      VALUES (${item[0]}, ${item[1]}, ${item[2]}, ${item[3]}, ${item[4]})
      ON CONFLICT (id) DO NOTHING
    `;
  }
}

export async function ready() {
  await migrate();
  await seed();
}

function toPg(text) {
  let n = 0;
  return String(text).replace(/\?/g, () => `$${++n}`);
}

function runnerFor(conn) {
  return {
    prepare(text) {
      const pg = toPg(text);
      return {
        async get(...params) {
          const found = await conn.unsafe(pg, params);
          return row(found[0]);
        },
        async all(...params) {
          return rows(await conn.unsafe(pg, params));
        },
        async run(...params) {
          const result = await conn.unsafe(pg, params);
          return { changes: result.count ?? 0 };
        }
      };
    }
  };
}

/**
 * Run several statements as one real Postgres transaction.
 *
 * Single conditional UPDATEs elsewhere in this app are already atomic on their
 * own; this is for the paths that touch more than one row and must not be seen
 * half-applied — a damage decision writes the report, the reservation's deposit
 * split and the unit's resting place together.
 */
export async function withTx(fn) {
  return sql.begin((tx) => fn(runnerFor(tx)));
}

export const db = {
  prepare(text) {
    const pg = toPg(text);
    return {
      async get(...params) {
        const found = await sql.unsafe(pg, params);
        return row(found[0]);
      },
      async all(...params) {
        return rows(await sql.unsafe(pg, params));
      },
      async run(...params) {
        const result = await sql.unsafe(pg, params);
        return { changes: result.count ?? 0 };
      }
    };
  },
  async exec(text) {
    const raw = String(text || '').trim();
    if (!raw) return;
    if (/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(raw)) {
      // Pooled statements would not share the connection this token opened, so
      // honouring it here would be a transaction in name only. Use withTx().
      throw new Error('Use withTx() for transactions rather than raw transaction control');
    }
    await sql.unsafe(raw);
  }
};

await ready();
