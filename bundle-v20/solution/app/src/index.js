import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import Stripe from 'stripe';
import {
  DEFAULT_CUSTOMER_ID,
  publicUser,
  isUniqueConstraintError,
  userById,
  locationById,
  allLocations,
  unitById,
  unitByIdOrTag,
  allUnits,
  reservationById,
  reservationBySession,
  reservationForCustomer,
  reservationsFor,
  reservationIdsFor,
  demoUsers,
  certificationsFor,
  userNames,
  hasCurrentCertification,
  findOverlap,
  writeAudit,
  insertReservation,
  begin,
  openFiledDamage,
  filedDamageFor,
  insertDamage,
  withTx,
  damageById,
  damageReports,
  auditEntries,
  sql,
  db
} from './db.js';
import { isoDate, inclusiveDays, todayUtc } from './dates.js';
import {
  billableRentalCents,
  grossRentalCents,
  weekRateReliefCents,
  exceedsMaxSpan,
  MAX_RENTAL_DAYS
} from './pricing.js';
import { dollars } from './money.js';
import { composeVendorQuote, postPaidVendors, vendorJson } from './vendors.js';
import { reservationIcs } from './calendar.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const rawBase = process.env.BASE_URL || process.env.APP_PUBLIC_URL || `http://localhost:${port}`;
const baseUrl = String(rawBase).replace('127.0.0.1', 'localhost');
const stripeSecret = process.env.STRIPE_SECRET_KEY;
const stripe = stripeSecret ? new Stripe(stripeSecret) : null;

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../public')));

function resolveArtifact(name) {
  const candidates = [
    path.resolve('/assets/artifacts', name),
    path.resolve(__dirname, '../artifacts', name),
    path.resolve(__dirname, '../public/shop', name)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

const CUSTOMER = 'customer';
const ASSOCIATE = 'rental_associate';
const ASSESSOR = 'damage_assessor';
const MANAGER = 'shop_manager';
const TRANSFER = 'transfer_clerk';
const BAY_TECH = 'bay_technician';
const NIGHT_AUDITOR = 'night_auditor';
const INSURANCE_LIAISON = 'insurance_liaison';
const LOT_RUNNER = 'lot_runner';
const LOCKING_STATUSES = "('CONFIRMED','CHECKED_OUT','RETURNED')";
const BLOCKED_UNIT_STATUSES = new Set(['IN_REPAIR', 'RETIRED', 'DAMAGE_HOLD', 'RETURNED_PENDING_INSPECTION']);

// The van only takes kit that is genuinely idle on the floor. Anything spoken
// for on a paid paper, out the door, standing in the inspection corner, held
// against a write-up, in the bay, or retired stays where it is.
/**
 * Which day(s) a van move is asked for. The bureau will not stamp a move on a
 * day the shops are dark, and the day that matters is the day of the move —
 * not whatever today happens to be. A request that names no date is a move
 * today.
 */
function moveWindow(body) {
  const raw = body || {};
  const start = raw.moveDate ?? raw.move_date ?? raw.date ?? raw.start ?? raw.start_date ?? raw.startDate;
  const end = raw.moveEnd ?? raw.move_end ?? raw.end ?? raw.end_date ?? raw.endDate ?? start;
  if (start == null || start === '') return { start: todayUtc(), end: todayUtc() };
  const a = isoDate(start);
  const b = isoDate(end);
  if (!a || !b || b < a) return null;
  return { start: a, end: b };
}

const TRANSFERABLE_UNIT_STATUS = 'AVAILABLE';

function transferBlockReason(unit) {
  if (unit.status === TRANSFERABLE_UNIT_STATUS) return null;
  return `That kit is not idle on the floor (${unit.status.replaceAll('_', ' ').toLowerCase()})`;
}

// An identity that matches nobody is turned away — it never quietly becomes the
// default customer. Only a genuinely ABSENT header opens as Maya, because the app
// ships signed in as her; a header that is present but unresolvable is a 401, and
// so is a present-but-blank one. Never fall through to DEFAULT_CUSTOMER_ID on a
// value the caller actually supplied, or an unknown id silently inherits Maya's
// reservations.
// The tablet always says who is standing at the counter. A request that does not
// say is not served — there is no default identity to fall back on.
//
// This closed a real hole: an omitted header used to open as Maya, which meant any
// unauthenticated caller read her reservations. "The app opens signed in as Maya"
// is a property of the PAGE, which puts her id on every request it makes, not a
// property of the API, which requires one.
async function getCurrentUser(req) {
  const raw = req.get('x-demo-user-id');
  if (raw === undefined || raw === null) return { user: null, supplied: false };
  const header = String(raw).trim();
  if (header === '') return { user: null, supplied: true };
  return { user: await userById(header), supplied: true };
}

// ---------------------------------------------------------------------------
// Idempotency
//
// Every request that changes something must carry an Idempotency-Key. The point
// is not the header itself but what it buys: a counter that loses its connection
// mid-charge can retry the SAME key and get the SAME answer back, with the money
// having moved exactly once. Retrying is only safe if the shop remembers.
//
// Three rules, and all three matter:
//   - No key on a mutating request  -> 400. There is no "just this once".
//   - Same key, same request        -> the stored response is replayed verbatim,
//                                      and the handler does NOT run again.
//   - Same key, different request   -> 409. A key identifies one specific act;
//                                      reusing it for a different one is a bug in
//                                      the caller and must be surfaced, not
//                                      silently treated as a new action.
//
// Keys are scoped to the actor. Two people may hold the same key string without
// ever seeing each other's responses — the scope is (key, actor), not key alone.
// ---------------------------------------------------------------------------
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
// No exemptions. The golden has no identity-switch route (identity travels in a
// header), and leaving an escape hatch here would let any route opt itself out.
const IDEMPOTENCY_EXEMPT = new Set();

function requestFingerprint(req) {
  // Method, path and body identify the act. Anything else about the request
  // (headers, ordering of JSON keys as sent) must not change the fingerprint, or
  // a legitimate retry from a different client would read as a different act.
  const body = req.body === undefined ? null : req.body;
  return crypto.createHash('sha256')
    .update(JSON.stringify([req.method, req.path, stableJson(body)]))
    .digest('hex');
}

function stableJson(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(stableJson);
  return Object.keys(value).sort().reduce((out, k) => {
    out[k] = stableJson(value[k]);
    return out;
  }, {});
}

async function idempotency(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (IDEMPOTENCY_EXEMPT.has(req.path)) return next();

  const key = String(req.get('idempotency-key') || '').trim();
  if (!key) {
    return res.status(400).json({
      error: 'Idempotency-Key header is required on requests that change something'
    });
  }

  const fingerprint = requestFingerprint(req);
  try {
    const seen = await db
      .prepare('SELECT * FROM idempotency_keys WHERE idem_key = ? AND actor_id = ?')
      .get(key, req.user.id);

    if (seen) {
      if (seen.request_fingerprint !== fingerprint) {
        return res.status(409).json({
          error: 'Idempotency-Key has already been used for a different request'
        });
      }
      // Replay verbatim. The handler must not run a second time.
      res.set('Idempotency-Replayed', 'true');
      return res.status(seen.status_code).json(JSON.parse(seen.response_body));
    }
  } catch (error) {
    return next(error);
  }

  // Capture whatever the handler ends up sending, then record it against the key.
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    const status = res.statusCode || 200;
    // Only successful acts are worth replaying. A refusal is not a completed
    // action, so the caller may legitimately fix the request and retry the key.
    if (status >= 200 && status < 300) {
      db.prepare(
        `INSERT INTO idempotency_keys
           (id, idem_key, actor_id, method, path, request_fingerprint, status_code, response_body)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT (idem_key, actor_id) DO NOTHING`
      )
        .run(crypto.randomUUID(), key, req.user.id, req.method, req.path, fingerprint,
             status, JSON.stringify(body ?? null))
        .catch((error) => console.error('idempotency record failed', error));
    }
    return originalJson(body);
  };
  return next();
}

async function requireUser(req, res, next) {
  try {
    const { user } = await getCurrentUser(req);
    if (!user) {
      // Always this exact shape, whatever the unresolvable value looked like —
      // a UUID that matches nobody, "admin", "customer", or an email used where
      // an id belongs. No 500s, no leaked driver text, no branch that treats an
      // unknown value as an ambiguous-but-acceptable identity.
      return res.status(401).json({ error: 'Unknown demo user' });
    }
    req.user = user;
    // Chained here rather than registered per-route: idempotency needs req.user,
    // and hanging it off the identity check means a route can never accidentally
    // be added without it.
    return idempotency(req, res, next);
  } catch (error) {
    next(error);
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' });
    }
    next();
  };
}

function requireCustomer(req, res, next) {
  if (req.user.role !== CUSTOMER) {
    return res.status(403).json({ error: 'Only customers can start a rental checkout' });
  }
  next();
}

function compactKey(key) {
  return String(key || '').replace(/^x-/i, '').replace(/[-_\s]/g, '').toLowerCase();
}

function walkEntries(value, visit) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    value.forEach((item) => walkEntries(item, visit));
    return;
  }
  for (const [key, nested] of Object.entries(value)) {
    visit(key, nested);
    walkEntries(nested, visit);
  }
}

function walkScalars(value, out) {
  if (value == null || value === '') return out;
  if (Array.isArray(value)) {
    value.forEach((item) => walkScalars(item, out));
    return out;
  }
  if (typeof value === 'object') {
    Object.values(value).forEach((item) => walkScalars(item, out));
    return out;
  }
  const text = String(value).trim();
  if (text) out.push(text);
  return out;
}

const PASSTHROUGH_HEADERS = new Set([
  'host', 'user-agent', 'accept', 'accept-encoding', 'accept-language',
  'content-type', 'content-length', 'connection', 'origin', 'referer',
  'cookie', 'x-demo-user-id'
]);

function requestBags(req) {
  const bags = [req.body, req.query];
  const headers = {};
  for (const [name, value] of Object.entries(req.headers || {})) {
    const lower = String(name).toLowerCase();
    if (PASSTHROUGH_HEADERS.has(lower)) continue;
    if (lower.startsWith('sec-') || lower.startsWith('cdn-') || lower.startsWith('x-forwarded')) continue;
    headers[name] = value;
  }
  bags.push(headers);
  return bags.filter((bag) => bag && typeof bag === 'object');
}

function keyLooksLikeOverride(key) {
  const c = compactKey(key);
  if (!c) return false;
  return (
    c.includes('override')
    || c.includes('certif')
    || c.includes('certid')
    || c === 'cert'
    || c.startsWith('cert')
    || c.includes('skipcert')
    || c.includes('waive')
    || c.includes('bypass')
    || c.includes('unlock')
    || c.includes('ignorecert')
    || c.includes('hascert')
    || c.includes('requiredcert')
    || c.includes('managerapprov')
    || c.includes('adminoverride')
    || c.includes('approvedby')
    || c === 'approved'
    || c === 'force'
    || c === 'forced'
    || c.includes('forcecheckout')
    || (c.includes('force') && (c.includes('check') || c.includes('cert')))
    || c === 'skip'
  );
}

function keyLooksLikeLocation(key) {
  const c = compactKey(key);
  if (!c || keyLooksLikeOverride(key)) return false;
  return (
    c.includes('location')
    || c.includes('pickup')
    || c.includes('shop')
    || (c.includes('store') && !c.includes('restore'))
    || c.includes('branch')
    || c.includes('warehouse')
    || c === 'site'
    || c.startsWith('siteid')
    || c.startsWith('sitename')
  );
}

function hasOverrideAttempt(reqOrBag) {
  const bags = reqOrBag && typeof reqOrBag === 'object' && (reqOrBag.body || reqOrBag.query || reqOrBag.headers)
    ? requestBags(reqOrBag)
    : [reqOrBag];
  return bags.some((bag) => {
    let found = false;
    walkEntries(bag, (key) => {
      if (keyLooksLikeOverride(key)) found = true;
    });
    return found;
  });
}

function collectLocationClaims(reqOrBag) {
  const bags = reqOrBag && typeof reqOrBag === 'object' && (reqOrBag.body || reqOrBag.query || reqOrBag.headers)
    ? requestBags(reqOrBag)
    : [reqOrBag];
  const out = [];
  for (const bag of bags) {
    walkEntries(bag, (key, value) => {
      if (keyLooksLikeLocation(key)) walkScalars(value, out);
    });
  }
  return out;
}

function locationTokenMatches(row, claim) {
  const c = String(claim || '').trim().toLowerCase();
  if (!c || !row) return false;
  const id = String(row.id || '').toLowerCase();
  const slug = String(row.slug || '').toLowerCase();
  const name = String(row.name || '').toLowerCase();
  if (c === id || c === slug || c === name) return true;
  if (slug && (c.includes(slug) || slug.includes(c))) return true;
  if (name && (name.includes(c) || c.includes(name))) return true;
  return false;
}

async function claimedPickupMismatch(req, reservationLocationId) {
  const claims = collectLocationClaims(req);
  if (!claims.length) return false;
  const pickup = await locationById(reservationLocationId);
  const all = await allLocations();
  return claims.some((claim) => {
    const hitsPickup = locationTokenMatches(pickup, claim);
    const hitsOther = all.some((loc) => loc.id !== reservationLocationId && locationTokenMatches(loc, claim));
    return hitsOther || !hitsPickup;
  });
}

function firstNumber(obj, keys) {
  if (!obj || typeof obj !== 'object') return NaN;
  for (const key of keys) {
    if (obj[key] == null || obj[key] === '') continue;
    const n = Number(obj[key]);
    if (Number.isFinite(n)) return n;
  }
  return NaN;
}

async function unitJson(row) {
  const location = await locationById(row.location_id);
  return {
    id: row.id,
    asset_tag: row.asset_tag,
    category: row.category,
    model: row.model,
    location_id: row.location_id,
    location_name: location?.name,
    shop: location?.name,
    daily_rate_usd: dollars(row.daily_rate_cents),
    deposit_usd: dollars(row.deposit_cents),
    replacement_value_usd: dollars(row.replacement_value_cents),
    required_certification: row.required_certification,
    status: row.status
  };
}

async function reservationJson(row) {
  const unit = await unitById(row.unit_id);
  const customer = await userById(row.customer_id);
  const location = await locationById(row.location_id);
  return {
    id: row.id,
    customer_id: row.customer_id,
    customer_name: customer?.full_name,
    location_id: row.location_id,
    location_name: location?.name,
    unit_id: row.unit_id,
    asset_tag: unit?.asset_tag,
    category: unit?.category,
    start_date: row.start_date,
    end_date: row.end_date,
    status: row.status,
    daily_rate_usd: dollars(row.daily_rate_cents),
    rental_subtotal_usd: dollars(row.rental_subtotal_cents),
    tax_usd: dollars(row.tax_cents),
    hull_usd: dollars(row.hull_cents),
    surcharge_usd: dollars(row.surcharge_cents),
    deposit_held_usd: dollars(row.deposit_held_cents),
    deposit_captured_usd: dollars(row.deposit_captured_cents),
    deposit_released_usd: dollars(row.deposit_released_cents),
    checked_out_at: row.checked_out_at,
    returned_at: row.returned_at
  };
}

function quoteForUnit(unit, startDate, endDate) {
  const days = inclusiveDays(startDate, endDate);
  if (!days) return null;
  const gross = grossRentalCents(unit.daily_rate_cents, days);
  const relief = weekRateReliefCents(gross, days);
  const rental = gross - relief;
  return {
    days,
    gross_rental_cents: gross,
    week_rate_relief_cents: relief,
    rental_cents: rental,
    deposit_cents: unit.deposit_cents,
    tax_cents: 0,
    hull_cents: 0,
    surcharge_cents: 0,
    total_cents: rental + unit.deposit_cents
  };
}

async function liveQuote(unit, startDate, endDate) {
  const quote = quoteForUnit(unit, startDate, endDate);
  if (!quote) return null;
  const location = await locationById(unit.location_id);
  const extras = await composeVendorQuote(
    unit, location, quote.rental_cents, startDate, endDate, quote.days
  );
  quote.tax_cents = extras.tax_cents;
  quote.hull_cents = extras.hull_cents;
  quote.surcharge_cents = extras.surcharge_cents;
  quote.total_cents = quote.rental_cents + quote.tax_cents + quote.hull_cents + quote.surcharge_cents + quote.deposit_cents;
  return quote;
}

function quotePublic(quote) {
  return {
    days: quote.days,
    gross_rental_usd: dollars(quote.gross_rental_cents),
    week_rate_relief_usd: dollars(quote.week_rate_relief_cents),
    rental_usd: dollars(quote.rental_cents),
    tax_usd: dollars(quote.tax_cents),
    hull_usd: dollars(quote.hull_cents),
    surcharge_usd: dollars(quote.surcharge_cents),
    deposit_usd: dollars(quote.deposit_cents),
    total_usd: dollars(quote.total_cents)
  };
}

async function bookingGate(unit, customer, startDate, endDate) {
  if (!unit) return { status: 404, error: 'Unit not found' };
  if (BLOCKED_UNIT_STATUSES.has(unit.status) || unit.status === 'RETURNED_PENDING_INSPECTION') {
    return { status: 409, error: `That unit is not available (${unit.status.replaceAll('_', ' ').toLowerCase()})` };
  }
  if (customer.role === CUSTOMER && customer.account_status === 'ON_HOLD') {
    return { status: 409, error: 'This account is on hold until the outstanding balance is resolved' };
  }
  if (startDate < todayUtc()) {
    return { status: 400, error: 'Reservations must start on a future date' };
  }
  const spanDays = inclusiveDays(startDate, endDate);
  if (!spanDays) {
    return { status: 400, error: 'End date must be on or after the start date' };
  }
  if (exceedsMaxSpan(spanDays)) {
    return {
      status: 400,
      error: `One booking cannot run longer than ${MAX_RENTAL_DAYS} days`
    };
  }
  if (unit.required_certification && !await hasCurrentCertification(customer.id, unit.required_certification, todayUtc())) {
    return {
      status: 409,
      error: `A current ${unit.required_certification} certification is required for this unit`
    };
  }
  if (await findOverlap(unit.id, startDate, endDate)) {
    return { status: 409, error: 'Those dates overlap an existing paid reservation for this unit' };
  }
  return null;
}

app.get('/health', async (_req, res) => {
  try {
    await sql`SELECT 1 AS ok`;
    res.json({ ok: true, ledger: 'postgres' });
  } catch {
    res.status(503).json({ ok: false, ledger: 'unavailable' });
  }
});

app.get('/api/session', requireUser, (req, res) => {
  res.json({ user: publicUser(req.user) });
});

app.get('/api/demo-users', async (_req, res) => {
  const users = await db.prepare(`
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
  `).all();
  res.json({ users });
});

app.get('/api/locations', async (_req, res) => {
  res.json({ locations: await db.prepare('SELECT * FROM locations ORDER BY name').all() });
});

app.get('/api/quote', requireUser, requireCustomer, async (req, res) => {
  try {
    const unitId = req.query.unitId || req.query.unit_id;
    const startDate = isoDate(req.query.startDate || req.query.start_date);
    const endDate = isoDate(req.query.endDate || req.query.end_date);
    const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(unitId);
    if (!unit || !startDate || !endDate) {
      return res.status(400).json({ error: 'Unit, start date, and end date are required' });
    }
    const blocked = await bookingGate(unit, req.user, startDate, endDate);
    if (blocked) return res.status(blocked.status).json({ error: blocked.error });
    const quote = await liveQuote(unit, startDate, endDate);
    res.json(quotePublic(quote));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to quote' });
  }
});

app.get('/api/notices', requireUser, async (req, res) => {
  try {
    const query = req.user.role === CUSTOMER ? { customer_id: req.user.id } : {};
    const data = await vendorJson('GET', '/notices/receipts', { notice: true, query });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to read notices' });
  }
});

app.get('/api/sms', requireUser, async (req, res) => {
  try {
    const query = req.user.role === CUSTOMER ? { customer_id: req.user.id } : {};
    const data = await vendorJson('GET', '/sms/receipts', { notice: true, query });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to read texts' });
  }
});

app.get('/api/emails', requireUser, async (req, res) => {
  try {
    const query = req.user.role === CUSTOMER ? { customer_id: req.user.id } : {};
    const data = await vendorJson('GET', '/email/receipts', { notice: true, query });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to read emails' });
  }
});

app.get('/api/loyalty', requireUser, async (req, res) => {
  try {
    const query = req.user.role === CUSTOMER ? { customer_id: req.user.id } : {};
    const data = await vendorJson('GET', '/loyalty/punches', { query });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to read loyalty punches' });
  }
});

// Hull binds are the insurance liaison's desk. The brief is explicit that "an
// insurance liaison reads hull binds", and a bind row carries the Stripe session
// id, the premium, the customer and the unit — a financial record. Gate the read
// the same way every other role-scoped read is gated: the liaison, the manager who
// decides money, the night auditor who reads the books, and the customer whose own
// cover it is. A rental associate, assessor, bay tech, transfer clerk or lot runner
// has no business in it.
const HULL_BIND_READERS = new Set([INSURANCE_LIAISON, MANAGER, NIGHT_AUDITOR]);

app.get('/api/hull-binds', requireUser, async (req, res) => {
  try {
    if (req.user.role === CUSTOMER) {
      const data = await vendorJson('GET', '/insurance/binds', {
        query: { customer_id: req.user.id }
      });
      return res.json(data);
    }
    if (!HULL_BIND_READERS.has(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to do that' });
    }
    const data = await vendorJson('GET', '/insurance/binds', { query: {} });
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to read hull binds' });
  }
});

app.post('/api/hull-binds', requireUser, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || req.body?.session_id || '');
    const premium = Number(req.body?.premium_cents ?? req.body?.premiumCents);
    const signature = req.get('x-insurance-signature') || req.body?.signature || req.body?.insuranceSignature;
    const url = new URL('/insurance/bind', `${process.env.VENDOR_BASE_URL || 'http://localhost:3101'}/`);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.VENDOR_TOKEN || 'gv-vendor-dev'}`,
        ...(signature ? { 'X-Insurance-Signature': String(signature) } : {})
      },
      body: JSON.stringify({
        sessionId,
        premium_cents: premium,
        customer_id: req.user.role === CUSTOMER ? req.user.id : (req.body?.customer_id || req.body?.customerId),
        unit_id: req.body?.unit_id || req.body?.unitId
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status >= 400 ? response.status : 401).json({
        error: data.error || 'Insurance bureau rejected the hull bind'
      });
    }
    res.status(201).json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to bind hull cover' });
  }
});

app.get('/api/calendar-holds', requireUser, async (req, res) => {
  try {
    const data = await vendorJson('GET', '/calendar/holds', {});
    if (req.user.role === CUSTOMER) {
      const mine = new Set(
        (await db.prepare('SELECT id FROM reservations WHERE customer_id = ?').all(req.user.id)).map((row) => row.id)
      );
      return res.json({ holds: (data.holds || []).filter((row) => mine.has(row.reservation_id)) });
    }
    res.json(data);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to read calendar holds' });
  }
});

app.get('/api/units', async (_req, res) => {
  const units = await Promise.all(
    (await db.prepare('SELECT * FROM units ORDER BY asset_tag').all()).map((u) => unitJson(u))
  );
  res.json({ units });
});

app.get('/api/units/:id', async (req, res) => {
  const row = await db.prepare('SELECT * FROM units WHERE id = ? OR asset_tag = ?').get(req.params.id, req.params.id);
  if (!row) return res.status(404).json({ error: 'Unit not found' });
  res.json({ unit: await unitJson(row) });
});

app.get('/api/certifications', requireUser, async (req, res) => {
  let rows;
  if (req.user.role === CUSTOMER) {
    rows = await db.prepare('SELECT * FROM certifications WHERE customer_id = ?').all(req.user.id);
  } else {
    rows = await db.prepare('SELECT * FROM certifications ORDER BY expires_on DESC').all();
  }
  const customers = Object.fromEntries(
    (await db.prepare('SELECT id, full_name FROM users').all()).map((u) => [u.id, u.full_name])
  );
  res.json({
    certifications: rows.map((row) => ({
      id: row.id,
      customer_id: row.customer_id,
      customer_name: customers[row.customer_id],
      certification_type: row.certification_type,
      issued_on: row.issued_on,
      expires_on: row.expires_on
    }))
  });
});

app.post('/api/reservations', requireUser, requireCustomer, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });

    const unitId = req.body?.unitId;
    const startDate = isoDate(req.body?.startDate);
    const endDate = isoDate(req.body?.endDate);
    if (!unitId || !startDate || !endDate) {
      return res.status(400).json({ error: 'Unit, start date, and end date are required' });
    }

    const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(unitId);
    const certBlocked = Boolean(
      unit?.required_certification
      && !await hasCurrentCertification(req.user.id, unit.required_certification, todayUtc())
    );
    if (certBlocked && hasOverrideAttempt(req)) {
      return res.status(403).json({ error: 'Certification requirements cannot be overridden' });
    }
    const blocked = await bookingGate(unit, req.user, startDate, endDate);
    if (blocked) return res.status(blocked.status).json({ error: blocked.error });

    const quote = await liveQuote(unit, startDate, endDate);
    const lineItems = [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: `Rental ${unit.asset_tag} (${unit.category})`,
            description: `${startDate} to ${endDate} · ${quote.days} day(s)`
          },
          unit_amount: quote.rental_cents
        },
        quantity: 1
      },
      {
        price_data: {
          currency: 'usd',
          product_data: { name: `Shop tax ${unit.asset_tag}`, description: 'Pickup-shop tax desk' },
          unit_amount: quote.tax_cents
        },
        quantity: 1
      }
    ];
    if (quote.hull_cents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `Hull rider ${unit.asset_tag}`, description: 'Insurance bureau drone hull' },
          unit_amount: quote.hull_cents
        },
        quantity: 1
      });
    }
    if (quote.surcharge_cents > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: { name: `Weekend surcharge ${unit.asset_tag}`, description: 'Weekend desk' },
          unit_amount: quote.surcharge_cents
        },
        quantity: 1
      });
    }
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Deposit ${unit.asset_tag}`,
          description: 'Refundable damage deposit'
        },
        unit_amount: quote.deposit_cents
      },
      quantity: 1
    });
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${baseUrl}/booking-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/`,
      metadata: {
        customerId: req.user.id,
        unitId: unit.id,
        locationId: unit.location_id,
        startDate,
        endDate,
        expectedAmount: String(quote.total_cents)
      }
    });

    res.json({ sessionUrl: session.url, sessionId: session.id, quote: quotePublic(quote) });
  } catch (error) {
    console.error('Create checkout error:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to start payment' });
  }
});

app.post('/api/reservations/confirm', requireUser, requireCustomer, async (req, res) => {
  try {
    if (!stripe) return res.status(503).json({ error: 'Stripe is not configured' });

    const sessionId = req.body?.sessionId;
    if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const metadata = session.metadata || {};
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ error: 'Payment has not completed' });
    }
    if (metadata.customerId !== req.user.id) {
      return res.status(403).json({ error: 'Payment belongs to another customer' });
    }

    const existing = await db.prepare('SELECT * FROM reservations WHERE stripe_session_id = ?').get(session.id);
    if (existing) {
      return res.json({ reservation: await reservationJson(existing) });
    }

    const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(metadata.unitId);
    const startDate = isoDate(metadata.startDate);
    const endDate = isoDate(metadata.endDate);
    if (!unit || !startDate || !endDate) {
      return res.status(400).json({ error: 'Payment is missing reservation details' });
    }

    const quote = await liveQuote(unit, startDate, endDate);
    if (!quote || session.amount_total !== quote.total_cents || Number(metadata.expectedAmount) !== quote.total_cents) {
      return res.status(400).json({ error: 'Payment amount does not match the unit card and vendor desks' });
    }

    const blocked = await bookingGate(unit, req.user, startDate, endDate);
    if (blocked) return res.status(blocked.status).json({ error: blocked.error });

    const id = crypto.randomUUID();
    let overlapped = false;
    try {
      await withTx(async (tx) => {
        if (await findOverlap(unit.id, startDate, endDate)) {
          overlapped = true;
          return;
        }
        await tx.prepare(`
        INSERT INTO reservations (
          id, customer_id, location_id, unit_id, start_date, end_date, status,
          daily_rate_cents, rental_subtotal_cents, tax_cents, hull_cents, surcharge_cents, deposit_held_cents,
          stripe_session_id, stripe_payment_intent
        ) VALUES (?, ?, ?, ?, ?, ?, 'CONFIRMED', ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
          id,
          req.user.id,
          unit.location_id,
          unit.id,
          startDate,
          endDate,
          unit.daily_rate_cents,
          quote.rental_cents,
          quote.tax_cents,
          quote.hull_cents,
          quote.surcharge_cents,
          quote.deposit_cents,
          session.id,
          String(session.payment_intent || '')
        );
        await tx.prepare(`UPDATE units SET status = 'RESERVED' WHERE id = ? AND status = 'AVAILABLE'`).run(unit.id);
        await tx.prepare(`
          INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
          VALUES (?, ?, 'reservation.confirm', 'reservation', ?, NULL, 'CONFIRMED', 'stripe paid')
        `).run(crypto.randomUUID(), req.user.id, id);
      });
      if (overlapped) {
        return res.status(409).json({ error: 'Those dates overlap an existing paid reservation for this unit' });
      }
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const again = await db.prepare('SELECT * FROM reservations WHERE stripe_session_id = ?').get(session.id);
        if (again) return res.json({ reservation: await reservationJson(again) });
        return res.status(409).json({ error: 'Those dates overlap an existing paid reservation for this unit' });
      }
      throw error;
    }

    const saved = await reservationJson(await db.prepare('SELECT * FROM reservations WHERE id = ?').get(id));
    await postPaidVendors({
      reservation: saved,
      sessionId: session.id,
      quote,
      options: { member: Boolean(req.user.member) }
    });
    res.json({ reservation: saved });
  } catch (error) {
    console.error('Confirm reservation error:', error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Unable to confirm payment' });
  }
});

app.get('/api/reservations', requireUser, async (req, res) => {
  let rows;
  if (req.user.role === CUSTOMER) {
    rows = await db.prepare(`
      SELECT * FROM reservations WHERE customer_id = ?
      ORDER BY start_date DESC, created_at DESC
    `).all(req.user.id);
  } else {
    rows = await db.prepare('SELECT * FROM reservations ORDER BY start_date DESC, created_at DESC').all();
  }
  res.json({ reservations: await Promise.all(rows.map(reservationJson)) });
});

app.get('/api/reservations/:id', requireUser, async (req, res) => {
  const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Reservation not found' });
  if (req.user.role === CUSTOMER && row.customer_id !== req.user.id) {
    return res.status(404).json({ error: 'Reservation not found' });
  }
  res.json({ reservation: await reservationJson(row) });
});

app.post('/api/reservations/:id/cancel', requireUser, requireCustomer, async (req, res) => {
  const row = await db.prepare('SELECT * FROM reservations WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Reservation not found' });
  if (row.status !== 'CONFIRMED') {
    return res.status(409).json({ error: 'Only a paid booking that has not gone out can be cancelled' });
  }
  await withTx(async (tx) => {
    await tx.prepare(`
      UPDATE reservations
      SET status = 'CANCELLED', deposit_released_cents = deposit_held_cents
      WHERE id = ? AND status = 'CONFIRMED'
    `).run(row.id);
    await tx.prepare(`UPDATE units SET status = 'AVAILABLE' WHERE id = ? AND status = 'RESERVED'`).run(row.unit_id);
    await tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
      VALUES (?, ?, 'reservation.cancel', 'reservation', ?, 'CONFIRMED', 'CANCELLED', NULL)
    `).run(crypto.randomUUID(), req.user.id, row.id);
  });
  res.json({ reservation: await reservationJson(await db.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id)) });
});

app.post('/api/reservations/:id/checkout', requireUser, requireRole(ASSOCIATE), async (req, res) => {
  const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Reservation not found' });
  if (row.status === 'CHECKED_OUT' || row.status === 'RETURNED' || row.status === 'CLOSED') {
    return res.json({ reservation: await reservationJson(row) });
  }
  if (row.status !== 'CONFIRMED') {
    return res.status(409).json({ error: 'This reservation cannot be checked out' });
  }

  const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(row.unit_id);
  const customer = await db.prepare('SELECT * FROM users WHERE id = ?').get(row.customer_id);
  if (await claimedPickupMismatch(req, row.location_id)) {
    return res.status(409).json({ error: 'This kit can only be handed over at the pickup shop on the booking' });
  }
  if (unit.location_id !== row.location_id) {
    return res.status(409).json({ error: 'This kit is not at the pickup shop named on the booking' });
  }
  if (unit.status === 'IN_REPAIR' || unit.status === 'RETIRED' || unit.status === 'DAMAGE_HOLD') {
    return res.status(409).json({ error: `That unit cannot go out (${unit.status.replaceAll('_', ' ').toLowerCase()})` });
  }
  if (unit.required_certification && !await hasCurrentCertification(customer.id, unit.required_certification, todayUtc())) {
    return res.status(409).json({
      error: `A current ${unit.required_certification} certification is required at pickup`
    });
  }
  if (hasOverrideAttempt(req)) {
    return res.status(403).json({ error: 'Certification requirements cannot be overridden' });
  }

  const scanTicket = req.body?.scanTicket || req.body?.scan_ticket || req.body?.ticketId;
  if (!scanTicket) {
    return res.status(400).json({ error: 'A bay-desk serial scan is required before a kit leaves' });
  }
  try {
    await vendorJson('POST', '/scan/redeem', {
      body: {
        ticket_id: scanTicket,
        reservation_id: row.id,
        unit_id: row.unit_id
      }
    });
  } catch (error) {
    return res.status(error.status || 409).json({ error: error.message || 'Unknown or used scan ticket' });
  }

  const now = new Date().toISOString();
  let alreadyOut = null;
  let notCheckable = false;
  await withTx(async (tx) => {
    const current = await tx.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id);
    if (current.status === 'CHECKED_OUT') {
      alreadyOut = current;
      return;
    }
    const result = await tx.prepare(`
      UPDATE reservations
      SET status = 'CHECKED_OUT', checked_out_at = COALESCE(checked_out_at, ?)
      WHERE id = ? AND status = 'CONFIRMED'
    `).run(now, row.id);
    if (!result.changes) {
      notCheckable = true;
      return;
    }
    await tx.prepare(`UPDATE units SET status = 'CHECKED_OUT' WHERE id = ?`).run(row.unit_id);
    await tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
      VALUES (?, ?, 'reservation.checkout', 'reservation', ?, 'CONFIRMED', 'CHECKED_OUT', NULL)
    `).run(crypto.randomUUID(), req.user.id, row.id);
  });
  if (alreadyOut) return res.json({ reservation: await reservationJson(alreadyOut) });
  if (notCheckable) return res.status(409).json({ error: 'This reservation cannot be checked out' });
  res.json({ reservation: await reservationJson(await db.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id)) });
});

app.post('/api/reservations/:id/return', requireUser, requireRole(ASSOCIATE), async (req, res) => {
  const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Reservation not found' });
  if (row.status === 'RETURNED' || row.status === 'CLOSED') {
    return res.json({ reservation: await reservationJson(row) });
  }
  if (row.status !== 'CHECKED_OUT') {
    return res.status(409).json({ error: 'Only a checked-out reservation can be returned' });
  }

  const now = new Date().toISOString();
  let alreadyBack = null;
  let notReturnable = false;
  await withTx(async (tx) => {
    const current = await tx.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id);
    if (current.status === 'RETURNED' || current.status === 'CLOSED') {
      alreadyBack = current;
      return;
    }
    const result = await tx.prepare(`
      UPDATE reservations
      SET status = 'RETURNED', returned_at = COALESCE(returned_at, ?)
      WHERE id = ? AND status = 'CHECKED_OUT'
    `).run(now, row.id);
    if (!result.changes) {
      notReturnable = true;
      return;
    }
    await tx.prepare(`UPDATE units SET status = 'RETURNED_PENDING_INSPECTION' WHERE id = ?`).run(row.unit_id);
    await tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
      VALUES (?, ?, 'reservation.return', 'reservation', ?, 'CHECKED_OUT', 'RETURNED', NULL)
    `).run(crypto.randomUUID(), req.user.id, row.id);
  });
  if (alreadyBack) return res.json({ reservation: await reservationJson(alreadyBack) });
  if (notReturnable) return res.status(409).json({ error: 'Only a checked-out reservation can be returned' });
  res.json({ reservation: await reservationJson(await db.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id)) });
});

app.post('/api/reservations/:id/inspect-clear', requireUser, requireRole(ASSESSOR), async (req, res) => {
  const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Reservation not found' });
  if (row.status === 'CLOSED') {
    return res.json({ reservation: await reservationJson(row) });
  }
  if (row.status !== 'RETURNED') {
    return res.status(409).json({ error: 'Inspect a returned kit before clearing it' });
  }
  const open = await db.prepare(`
    SELECT 1 FROM damage_reports WHERE reservation_id = ? AND status = 'FILED'
  `).get(row.id);
  if (open) return res.status(409).json({ error: 'An open damage report still needs a decision' });

  await withTx(async (tx) => {
    await tx.prepare(`
      UPDATE reservations
      SET status = 'CLOSED',
          deposit_released_cents = deposit_held_cents - deposit_captured_cents
      WHERE id = ? AND status = 'RETURNED'
    `).run(row.id);
    await tx.prepare(`UPDATE units SET status = 'AVAILABLE' WHERE id = ?`).run(row.unit_id);
    await tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
      VALUES (?, ?, 'reservation.inspect_clear', 'reservation', ?, 'RETURNED', 'CLOSED', 'no damage')
    `).run(crypto.randomUUID(), req.user.id, row.id);
  });
  res.json({ reservation: await reservationJson(await db.prepare('SELECT * FROM reservations WHERE id = ?').get(row.id)) });
});

app.get('/api/reservations/:id/calendar.ics', requireUser, async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Reservation not found' });
    if (req.user.role === CUSTOMER && row.customer_id !== req.user.id) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    const unit = await unitById(row.unit_id);
    const customer = await userById(row.customer_id);
    res.type('text/calendar; charset=utf-8');
    res.send(reservationIcs(row, unit, customer));
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to build calendar feed' });
  }
});

app.get('/api/reservations/:id/hire-waiver.pdf', requireUser, async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Reservation not found' });
    if (req.user.role === CUSTOMER && row.customer_id !== req.user.id) {
      return res.status(404).json({ error: 'Reservation not found' });
    }
    const file = resolveArtifact('hire_waiver.pdf');
    if (!file) return res.status(404).json({ error: 'Hire waiver is missing from the shop files' });
    res.type('application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="gearvault-hire-waiver.pdf"');
    res.sendFile(file);
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to hand over the hire waiver' });
  }
});

app.post('/api/reservations/:id/scan-ticket', requireUser, requireRole(ASSOCIATE, BAY_TECH), async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Reservation not found' });
    if (row.status !== 'CONFIRMED') {
      return res.status(409).json({ error: 'A serial scan is only issued against a paid kit still on the shelf' });
    }
    const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(row.unit_id);
    const serial = await vendorJson('GET', '/fleet/serials', {
      query: { asset_tag: unit?.asset_tag }
    });
    const ticket = await vendorJson('POST', '/scan/tickets', {
      body: {
        reservation_id: row.id,
        unit_id: row.unit_id,
        asset_tag: unit?.asset_tag,
        bay_code: serial.bay_code
      }
    });
    res.status(201).json({ ticketId: ticket.ticket_id });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to issue a serial scan' });
  }
});

app.post('/api/units/:id/transfer-stamp', requireUser, requireRole(TRANSFER), async (req, res) => {
  try {
    const unit = await unitByIdOrTag(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    const toShop = String(req.body?.to_shop || req.body?.toShop || req.body?.location_name || '').trim();
    if (!toShop) return res.status(400).json({ error: 'A destination shop is required' });
    const idleBlocked = transferBlockReason(unit);
    if (idleBlocked) return res.status(409).json({ error: idleBlocked });
    const window = moveWindow(req.body);
    if (!window) {
      return res.status(400).json({ error: 'A move date has to be a calendar day' });
    }
    const blackout = await vendorJson('GET', '/blackout/calendar', {
      query: { start: window.start, end: window.end }
    });
    if (blackout.van_idle === true || blackout.shop_open === false) {
      return res.status(409).json({ error: 'Van moves are idle while the shops are dark' });
    }
    const from = await locationById(unit.location_id);
    const stamp = await vendorJson('POST', '/transfer/stamps', {
      body: {
        unit_id: unit.id,
        from_shop: from?.slug,
        to_shop: toShop,
        clerk_id: req.user.id
      }
    });
    res.status(201).json({ stampId: stamp.stamp_id });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Transfer bureau refused the stamp' });
  }
});

app.post('/api/units/:id/transfer', requireUser, requireRole(TRANSFER), async (req, res) => {
  try {
    const unit = await unitByIdOrTag(req.params.id);
    if (!unit) return res.status(404).json({ error: 'Unit not found' });
    const stampId = req.body?.transferStamp || req.body?.stamp_id || req.body?.stampId;
    if (!stampId) {
      return res.status(400).json({ error: 'The transfer bureau has to stamp the move first' });
    }
    const idleBlocked = transferBlockReason(unit);
    if (idleBlocked) return res.status(409).json({ error: idleBlocked });
    const window = moveWindow(req.body);
    if (!window) {
      return res.status(400).json({ error: 'A move date has to be a calendar day' });
    }
    const blackout = await vendorJson('GET', '/blackout/calendar', {
      query: { start: window.start, end: window.end }
    });
    if (blackout.van_idle === true || blackout.shop_open === false) {
      return res.status(409).json({ error: 'Van moves are idle while the shops are dark' });
    }
    const redeemed = await vendorJson('POST', '/transfer/redeem', {
      body: { stamp_id: stampId, unit_id: unit.id }
    });
    const dest = String(redeemed.to_shop || req.body?.to_shop || '').trim().toLowerCase();
    const location = (await allLocations()).find((row) => (
      row.slug === dest
      || row.id === dest
      || dest.includes(row.slug)
      || row.slug.includes(dest)
      || row.name.toLowerCase().includes(dest)
      || dest.includes(row.name.toLowerCase())
    ));
    if (!location) return res.status(400).json({ error: 'Unknown destination shop' });
    await db.prepare('UPDATE units SET location_id = ? WHERE id = ?').run(location.id, unit.id);
    const updated = await db.prepare('SELECT * FROM units WHERE id = ?').get(unit.id);
    res.json({ unit: updated });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to move that kit' });
  }
});

app.post('/api/reservations/:id/media-ticket', requireUser, requireRole(ASSESSOR), async (req, res) => {
  try {
    const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Reservation not found' });
    if (row.status !== 'RETURNED') {
      return res.status(409).json({ error: 'A media ticket is only issued against a returned kit' });
    }
    const ticket = await vendorJson('POST', '/media/tickets', {
      notice: true,
      body: { reservation_id: row.id }
    });
    res.status(201).json({ ticketId: ticket.ticket_id });
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Unable to issue a media ticket' });
  }
});

app.post('/api/reservations/:id/damage', requireUser, requireRole(ASSESSOR), async (req, res) => {
  const row = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Reservation not found' });
  if (row.status !== 'RETURNED') {
    return res.status(409).json({ error: 'Damage can only be filed against a returned kit' });
  }

  const description = String(req.body?.description || '').trim();
  const severity = String(req.body?.severity || '').trim();
  const proposedUsd = firstNumber(req.body, [
    'proposedUsd', 'proposed_usd', 'proposed', 'proposedAmount', 'proposed_amount',
    'deductionUsd', 'deduction_usd', 'amount'
  ]);
  const proposedFromCents = firstNumber(req.body, [
    'proposedCents', 'proposed_cents', 'deductionCents', 'deduction_cents'
  ]);
  const proposed = Number.isFinite(proposedUsd)
    ? proposedUsd
    : (Number.isFinite(proposedFromCents) ? proposedFromCents / 100 : NaN);
  if (!description || !severity || !Number.isFinite(proposed) || proposed <= 0) {
    return res.status(400).json({ error: 'Description, severity, and a proposed deduction are required' });
  }

  const ticketId = req.body?.mediaTicket || req.body?.media_ticket || req.body?.ticketId;
  if (!ticketId) {
    return res.status(400).json({ error: 'A photo-desk media ticket is required to file damage' });
  }
  try {
    const ticket = await vendorJson('GET', `/media/tickets/${ticketId}`, { notice: true });
    if (ticket.reservation_id !== row.id) {
      return res.status(409).json({ error: 'That media ticket does not belong to this return' });
    }
  } catch (error) {
    return res.status(error.status || 400).json({ error: error.message || 'Unknown media ticket' });
  }

  const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(row.unit_id);
  const proposedCents = Math.round(proposed * 100);
  const ceiling = Math.min(row.deposit_held_cents, unit.replacement_value_cents);
  if (proposedCents > ceiling) {
    return res.status(400).json({
      error: 'The proposed deduction cannot exceed the held deposit or the unit replacement value'
    });
  }

  const existing = await db.prepare(`
    SELECT id FROM damage_reports WHERE reservation_id = ? AND unit_id = ? AND status = 'FILED'
  `).get(row.id, row.unit_id);
  if (existing) {
    return res.status(409).json({ error: 'An actionable damage report already exists for this return' });
  }

  const id = crypto.randomUUID();
  await withTx(async (tx) => {
    await tx.prepare(`
      INSERT INTO damage_reports (
        id, reservation_id, unit_id, filed_by, description, severity, proposed_cents, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'FILED')
    `).run(id, row.id, row.unit_id, req.user.id, description, severity, proposedCents);
    await tx.prepare(`UPDATE units SET status = 'DAMAGE_HOLD' WHERE id = ?`).run(row.unit_id);
    await tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
      VALUES (?, ?, 'damage.file', 'damage_report', ?, NULL, 'FILED', ?)
    `).run(crypto.randomUUID(), req.user.id, id, description);
  });
  res.status(201).json({
    report: await db.prepare('SELECT * FROM damage_reports WHERE id = ?').get(id)
  });
});

app.get('/api/damage-reports', requireUser, requireRole(ASSESSOR, MANAGER), async (req, res) => {
  const rows = await db.prepare(`
    SELECT d.*, u.asset_tag, r.customer_id, cu.full_name AS customer_name
    FROM damage_reports d
    JOIN units u ON u.id = d.unit_id
    JOIN reservations r ON r.id = d.reservation_id
    JOIN users cu ON cu.id = r.customer_id
    ORDER BY d.created_at DESC
  `).all();
  res.json({
    reports: rows.map((row) => ({
      id: row.id,
      reservation_id: row.reservation_id,
      unit_id: row.unit_id,
      asset_tag: row.asset_tag,
      customer_name: row.customer_name,
      filed_by: row.filed_by,
      description: row.description,
      severity: row.severity,
      proposed_usd: row.proposed_cents / 100,
      status: row.status,
      reviewed_by: row.reviewed_by
    }))
  });
});

async function decideDamage(req, res, decision) {
  const report = await db.prepare('SELECT * FROM damage_reports WHERE id = ?').get(req.params.id);
  if (!report) return res.status(404).json({ error: 'Damage report not found' });
  if (report.status !== 'FILED') {
    return res.status(409).json({ error: 'This report has already been decided' });
  }
  if (report.filed_by === req.user.id) {
    return res.status(403).json({ error: 'The person who filed a damage report cannot decide it' });
  }

  const reservation = await db.prepare('SELECT * FROM reservations WHERE id = ?').get(report.reservation_id);
  const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(report.unit_id);
  const ceiling = Math.min(reservation.deposit_held_cents, unit.replacement_value_cents);
  if (decision === 'APPROVED' && report.proposed_cents > ceiling) {
    return res.status(400).json({
      error: 'The proposed deduction cannot exceed the held deposit or the unit replacement value'
    });
  }

  await withTx(async (tx) => {
    await tx.prepare(`
      UPDATE damage_reports
      SET status = ?, reviewed_by = ?, decision_reason = ?
      WHERE id = ? AND status = 'FILED'
    `).run(decision, req.user.id, String(req.body?.reason || decision.toLowerCase()), report.id);

    if (decision === 'APPROVED') {
      await tx.prepare(`
        UPDATE reservations
        SET status = 'CLOSED',
            deposit_captured_cents = ?,
            deposit_released_cents = deposit_held_cents - ?
        WHERE id = ?
      `).run(report.proposed_cents, report.proposed_cents, reservation.id);
    } else {
      await tx.prepare(`
        UPDATE reservations
        SET status = 'CLOSED',
            deposit_captured_cents = 0,
            deposit_released_cents = deposit_held_cents
        WHERE id = ?
      `).run(reservation.id);
    }
    // Elena signing off something Riley wrote up as major sends the kit to the
    // repair bay rather than back onto the shelf.
    const major = /major|severe|critical|write[-\s]?off|total(?:led|led)?/i.test(String(report.severity || ''));
    const restedStatus = decision === 'APPROVED' && major ? 'IN_REPAIR' : 'AVAILABLE';
    await tx.prepare(`UPDATE units SET status = ? WHERE id = ? AND status = 'DAMAGE_HOLD'`).run(restedStatus, unit.id);
    await tx.prepare(`
      INSERT INTO audit_log (id, actor_id, action, entity_type, entity_id, previous_state, new_state, reason)
      VALUES (?, ?, ?, 'damage_report', ?, 'FILED', ?, ?)
    `).run(
      crypto.randomUUID(), req.user.id, `damage.${decision.toLowerCase()}`,
      report.id, decision, req.body?.reason || null
    );
  });
  res.json({ report: await db.prepare('SELECT * FROM damage_reports WHERE id = ?').get(report.id) });
}

app.post('/api/damage-reports/:id/approve', requireUser, requireRole(MANAGER), (req, res) => {
  decideDamage(req, res, 'APPROVED');
});

app.post('/api/damage-reports/:id/deny', requireUser, requireRole(MANAGER), (req, res) => {
  decideDamage(req, res, 'DENIED');
});

app.post('/api/units/:id/repair', requireUser, requireRole(MANAGER), async (req, res) => {
  const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  if (unit.status === 'CHECKED_OUT') {
    return res.status(409).json({ error: 'A kit that is already out cannot be sent to repair' });
  }
  await db.prepare(`UPDATE units SET status = 'IN_REPAIR' WHERE id = ?`).run(unit.id);
  await writeAudit(req.user.id, 'unit.repair', 'unit', unit.id, unit.status, 'IN_REPAIR', req.body?.reason);
  res.json({ unit: await unitJson(await db.prepare('SELECT * FROM units WHERE id = ?').get(unit.id)) });
});

app.post('/api/units/:id/restore', requireUser, requireRole(MANAGER), async (req, res) => {
  const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  if (unit.status === 'CHECKED_OUT' || unit.status === 'RESERVED') {
    return res.status(409).json({ error: 'This unit is still on a live reservation' });
  }
  // The unit's own resting place is not the whole answer. A unit can sit in the
  // repair bay while a live paper still points at it — that is exactly what
  // happens when a manager benches kit that is already promised. Restoring it
  // then would put it back on the floor for someone else to take while its
  // customer is still holding a paper on it. Ask the papers, not just the unit.
  const spokenFor = await db.prepare(
    `SELECT id FROM reservations
      WHERE unit_id = ? AND status IN ('CONFIRMED','CHECKED_OUT','RETURNED')
      LIMIT 1`
  ).get(unit.id);
  if (spokenFor) {
    return res.status(409).json({ error: 'This unit is still on a live reservation' });
  }
  await db.prepare(`UPDATE units SET status = 'AVAILABLE' WHERE id = ?`).run(unit.id);
  await writeAudit(req.user.id, 'unit.restore', 'unit', unit.id, unit.status, 'AVAILABLE', req.body?.reason);
  res.json({ unit: await unitJson(await db.prepare('SELECT * FROM units WHERE id = ?').get(unit.id)) });
});

app.post('/api/units/:id/retire', requireUser, requireRole(MANAGER), async (req, res) => {
  const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  if (unit.status === 'CHECKED_OUT') {
    return res.status(409).json({ error: 'A kit that is already out cannot be retired' });
  }
  await db.prepare(`UPDATE units SET status = 'RETIRED' WHERE id = ?`).run(unit.id);
  await writeAudit(req.user.id, 'unit.retire', 'unit', unit.id, unit.status, 'RETIRED', req.body?.reason);
  res.json({ unit: await unitJson(await db.prepare('SELECT * FROM units WHERE id = ?').get(unit.id)) });
});

app.post('/api/units/:id/rate', requireUser, requireRole(MANAGER), async (req, res) => {
  const unit = await db.prepare('SELECT * FROM units WHERE id = ?').get(req.params.id);
  if (!unit) return res.status(404).json({ error: 'Unit not found' });
  const daily = firstNumber(req.body, [
    'dailyRateUsd', 'daily_rate_usd', 'dailyRate', 'daily_rate', 'rate'
  ]);
  if (!Number.isFinite(daily) || daily <= 0) {
    return res.status(400).json({ error: 'A positive daily rate is required' });
  }
  await db.prepare('UPDATE units SET daily_rate_cents = ? WHERE id = ?').run(Math.round(daily * 100), unit.id);
  await writeAudit(req.user.id, 'unit.rate', 'unit', unit.id, String(unit.daily_rate_cents), String(Math.round(daily * 100)), null);
  res.json({ unit: await unitJson(await db.prepare('SELECT * FROM units WHERE id = ?').get(unit.id)) });
});

app.post('/api/customers/:id/hold', requireUser, requireRole(MANAGER), async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'customer'`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  await db.prepare(`UPDATE users SET account_status = 'ON_HOLD' WHERE id = ?`).run(customer.id);
  await writeAudit(req.user.id, 'customer.hold', 'user', customer.id, customer.account_status, 'ON_HOLD', req.body?.reason);
  res.json({ user: publicUser(await db.prepare('SELECT * FROM users WHERE id = ?').get(customer.id)) });
});

app.post('/api/customers/:id/release-hold', requireUser, requireRole(MANAGER), async (req, res) => {
  const customer = await db.prepare(`SELECT * FROM users WHERE id = ? AND role = 'customer'`).get(req.params.id);
  if (!customer) return res.status(404).json({ error: 'Customer not found' });
  await db.prepare(`UPDATE users SET account_status = 'ACTIVE' WHERE id = ?`).run(customer.id);
  await writeAudit(req.user.id, 'customer.release_hold', 'user', customer.id, customer.account_status, 'ACTIVE', req.body?.reason);
  res.json({ user: publicUser(await db.prepare('SELECT * FROM users WHERE id = ?').get(customer.id)) });
});

app.get('/api/audit', requireUser, requireRole(MANAGER, NIGHT_AUDITOR), async (_req, res) => {
  res.json({
    entries: await db.prepare('SELECT * FROM audit_log ORDER BY created_at DESC').all()
  });
});

app.use((_req, res) => {
  res.sendFile(path.resolve(__dirname, '../public/index.html'));
});

if (process.env.GEARVAULT_LISTEN !== '0') {
  app.listen(port, '0.0.0.0', () => {
    console.log(`GearVault listening on http://0.0.0.0:${port}`);
  });
}

export { app, claimedPickupMismatch, hasOverrideAttempt };
