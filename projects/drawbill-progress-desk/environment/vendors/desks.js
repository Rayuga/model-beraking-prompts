'use strict';

const http = require('http');

const PORT = Number(process.env.VENDOR_PORT || 3101);
const TOKEN = process.env.VENDOR_TOKEN || 'db-vendor-dev';
const NOTICE_KEY = process.env.NOTICE_API_KEY || 'db-notice-dev';
const PUBLIC_BASE = String(process.env.VENDOR_BASE_URL || `http://localhost:${PORT}`)
  .replace(/\/$/, '');

const TAX_BPS = {
  riverside: 725,
  downtown: 800,
  pier: 600
};

const HARBORVIEW = '10000000-0000-4000-8000-000000000001';
const DOWNTOWN = '10000000-0000-4000-8000-000000000002';
const RIVERWALK = '10000000-0000-4000-8000-000000000003';

const FRINGE = {
  [`${HARBORVIEW}|2030-03-01|2030-03-31`]: 500000,
  [`${HARBORVIEW}|2030-04-01|2030-04-30`]: 1000000,
  [`${DOWNTOWN}|2030-04-01|2030-04-30`]: 0,
  [`${RIVERWALK}|2030-04-01|2030-04-10`]: 0
};

const WEATHER_DAYS = {
  [`${RIVERWALK}|2030-04-01|2030-04-10`]: 2,
  [`pier|2030-04-01|2030-04-10`]: 2
};

const BLACKOUT_START = '2030-06-25';
const BLACKOUT_END = '2030-06-30';
const BOOKS_OPEN = '2030-03-01';

const notices = [];
const sms = [];
const emails = [];
const punches = [];
const diary = [];
const architectStamps = [];
const waivers = [];

// ---------------------------------------------------------------------------
// Plant call ledger.
//
// Every desk request is recorded here so the plant can prove afterwards which
// desks a till actually asked. Read-only and unauthenticated on purpose: it
// carries no figures a caller could not already obtain by asking the desk.
// A till that invents its own tax, retainage, fee, bond, fringe or damages
// numbers instead of asking leaves an empty ledger.
// ---------------------------------------------------------------------------
const callLog = [];
const MAX_CALLS = 5000;

// The card desk's open and settled sessions. The plant runs the card window
// itself; a till never touches card details.
const cardSessions = new Map();
let cardSeq = 0;

function recordCall(method, pathname) {
  if (pathname.startsWith('/audit/')) return;
  if (pathname.startsWith('/card/')) return;
  if (pathname === '/health') return;
  callLog.push({ method, path: pathname, at: new Date().toISOString() });
  if (callLog.length > MAX_CALLS) callLog.splice(0, callLog.length - MAX_CALLS);
}

function resetPlantState() {
  callLog.length = 0;
  cardSessions.clear();
  notices.length = 0;
  sms.length = 0;
  emails.length = 0;
  punches.length = 0;
  diary.length = 0;
  architectStamps.length = 0;
  waivers.length = 0;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function send(res, status, body) {
  const json = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(json),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(json);
}

function sendHtml(res, status, html) {
  res.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html)
  });
  res.end(html);
}

function redirect(res, location) {
  res.writeHead(303, { Location: location, 'Content-Length': 0 });
  res.end();
}

function readForm(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      const out = {};
      for (const [key, value] of new URLSearchParams(raw)) out[key] = value;
      resolve(out);
    });
    req.on('error', reject);
  });
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function money(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(Number(cents) || 0);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  return `${sign}$${whole}.${String(abs % 100).padStart(2, '0')}`;
}

// The return address the till gave us, with the session it is about. The desk
// spells the placeholder {CARD_SESSION_ID}, still answers to the older
// {CHECKOUT_SESSION_ID} spelling, and appends the id as `session_id` when the
// till left no placeholder at all.
function returnUrl(raw, sessionId) {
  const base = String(raw || '');
  if (base.includes('{CARD_SESSION_ID}') || base.includes('{CHECKOUT_SESSION_ID}')) {
    return base
      .replace('{CARD_SESSION_ID}', encodeURIComponent(sessionId))
      .replace('{CHECKOUT_SESSION_ID}', encodeURIComponent(sessionId));
  }
  const joiner = base.includes('?') ? '&' : '?';
  return `${base}${joiner}session_id=${encodeURIComponent(sessionId)}`;
}

const GOOD_CARD = '4242424242424242';

function cardWindow(session, error) {
  const paid = session.payment_status === 'paid';
  const body = paid
    ? `<p class="ok">Paid ${escapeHtml(money(session.amount_cents))}. This window is closed.</p>`
    : `<form method="POST" action="/card/pay/${escapeHtml(session.id)}">
      <label for="card">Card number</label>
      <input id="card" name="card" inputmode="numeric" autocomplete="cc-number" placeholder="4242 4242 4242 4242">
      <div class="row">
        <span><label for="exp">Expiry</label><input id="exp" name="exp" placeholder="12/34"></span>
        <span><label for="cvc">CVC</label><input id="cvc" name="cvc" placeholder="123"></span>
        <span><label for="zip">ZIP</label><input id="zip" name="zip" placeholder="94103"></span>
      </div>
      <label for="email">Email</label>
      <input id="email" name="email" type="email" value="${escapeHtml(session.customer_email || '')}">
      <button type="submit" name="action" value="pay">Pay ${escapeHtml(money(session.amount_cents))}</button>
      <button type="submit" name="action" value="cancel" class="link">Cancel and go back</button>
    </form>`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plant card desk</title>
<style>
 body { font: 15px/1.5 system-ui, sans-serif; margin: 0; background: #f4f5f7; color: #1c2024; }
 main { max-width: 26rem; margin: 3rem auto; background: #fff; padding: 1.5rem;
        border: 1px solid #d7dbe0; border-radius: 10px; }
 h1 { font-size: 1.05rem; margin: 0 0 .25rem; }
 .desk { color: #6b7280; font-size: .85rem; margin: 0 0 1.25rem; }
 .amount { font-size: 1.9rem; font-weight: 600; margin: 0 0 .25rem; }
 .what { color: #6b7280; margin: 0 0 1.5rem; }
 label { display: block; font-size: .8rem; color: #4b5563; margin: .75rem 0 .2rem; }
 input { width: 100%; box-sizing: border-box; padding: .55rem .6rem; font-size: 1rem;
         border: 1px solid #c9ced6; border-radius: 6px; }
 .row { display: flex; gap: .6rem; }
 .row span { flex: 1; }
 button { width: 100%; margin-top: 1.25rem; padding: .65rem; font-size: 1rem;
          border: 0; border-radius: 6px; background: #1f6feb; color: #fff; cursor: pointer; }
 button.link { background: none; color: #4b5563; margin-top: .5rem; text-decoration: underline; }
 .error { background: #fdecec; border: 1px solid #f5b5b5; color: #91232a;
          padding: .55rem .7rem; border-radius: 6px; margin: 0 0 1rem; }
 .ok { background: #e9f7ee; border: 1px solid #a9dcbc; color: #1c5c33;
       padding: .55rem .7rem; border-radius: 6px; }
</style></head>
<body><main>
 <h1>Plant card desk</h1>
 <p class="desk">The plant takes the card. The till never sees it.</p>
 ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
 <p class="amount">${escapeHtml(money(session.amount_cents))}</p>
 <p class="what">${escapeHtml(session.description || session.reference || 'Progress payment')}</p>
 ${body}
</main></body></html>`;
}

function publicCardSession(session) {
  return {
    id: session.id,
    status: session.status,
    payment_status: session.payment_status,
    amount_cents: session.amount_cents,
    currency: session.currency,
    reference: session.reference,
    description: session.description,
    customer_email: session.customer_email,
    metadata: session.metadata,
    url: session.url,
    paid_at: session.paid_at
  };
}

function requireToken(req) {
  const header = req.headers.authorization || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (token !== TOKEN) {
    const err = new Error('Vendor token rejected');
    err.status = 401;
    throw err;
  }
}

function requireNoticeKey(req) {
  if ((req.headers['x-notice-key'] || '') !== NOTICE_KEY) {
    const err = new Error('Notice desk key rejected');
    err.status = 401;
    throw err;
  }
}

function refuse(message, status = 409) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function needInt(body, key, { allowNegative = false } = {}) {
  if (body[key] == null || body[key] === '') {
    refuse(`${key} is required`, 400);
  }
  const n = Number(body[key]);
  if (!Number.isInteger(n)) refuse(`${key} must be an integer`, 400);
  if (!allowNegative && n < 0) refuse(`${key} must be a non-negative integer`, 400);
  return n;
}

function needStr(input, key) {
  const v = String(input || '').trim();
  if (!v) refuse(`${key} is required`, 400);
  return v;
}

function taxBps(windowName) {
  const c = String(windowName || '').trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TAX_BPS, c) ? TAX_BPS[c] : null;
}

function datesInRange(start, end) {
  const out = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    const next = new Date(`${d}T00:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    d = next.toISOString().slice(0, 10);
  }
  return out;
}

function inclusiveDaysAfter(scd, periodEnd) {
  if (periodEnd <= scd) return 0;
  const start = new Date(`${scd}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() + 1);
  const from = start.toISOString().slice(0, 10);
  if (from > periodEnd) return 0;
  return datesInRange(from, periodEnd).length;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart <= bEnd && bStart <= aEnd;
}

const DESKS = [
  { desk: 'card desk', method: 'POST', path: '/card/sessions', auth: 'bearer',
    body: ['amount_cents (integer pennies, must be positive)', 'reference', 'description',
           'customer_email', 'success_url (may carry {CARD_SESSION_ID})', 'cancel_url',
           'metadata (echoed back on retrieval)'],
    returns: ['id', 'url (the plant card window the payer is sent to)', 'status', 'payment_status', 'amount_cents'] },
  { desk: 'card desk', method: 'GET', path: '/card/sessions/{id}', auth: 'bearer',
    returns: ['id', 'status (open | complete | canceled)', 'payment_status (unpaid | paid)',
              'amount_cents', 'metadata', 'customer_email'] },
  { desk: 'county tax office', method: 'GET', path: '/tax/quote', auth: 'bearer',
    query: ['window (riverside | downtown | pier)', 'base (must be wip)', 'cents (integer pennies of this-period installed work)'],
    returns: ['tax_cents', 'rate_bps', 'window'] },
  { desk: 'warehouse tax office', method: 'GET', path: '/tax/warehouse', auth: 'bearer',
    query: ['window', 'base (must be stored)', 'cents'],
    returns: ['tax_cents'] },
  { desk: 'retainage desk', method: 'POST', path: '/retainage/quote', auth: 'bearer',
    body: ['wip_cents', 'converted_cents', 'gc_this_cents', 'new_stored_cents', 'completed_and_stored_cents', 'current_contracted_cents'],
    returns: ['ret_wip_cents', 'ret_stored_cents', 'ret_cents', 'job_rate_bps'] },
  { desk: 'gc fee desk', method: 'POST', path: '/fee/quote', auth: 'bearer',
    body: ['original_base_cents', 'co_base_cents'],
    returns: ['fee_cents'] },
  { desk: 'bond desk', method: 'POST', path: '/bond/quote', auth: 'bearer',
    body: ['original_contract_cents', 'already_billed'],
    returns: ['bond_cents'] },
  { desk: 'fringe rider desk', method: 'POST', path: '/fringe/quote', auth: 'bearer',
    body: ['job_id', 'period_start', 'period_end'],
    returns: ['fringe_cents'] },
  { desk: 'weather desk', method: 'GET', path: '/weather/days', auth: 'bearer',
    query: ['job_id or window', 'start', 'end'],
    returns: ['weather_days'] },
  { desk: 'liquidated damages desk', method: 'POST', path: '/ld/quote', auth: 'bearer',
    body: ['scd', 'period_end', 'weather_days'],
    returns: ['ld_cents', 'ld_days'] },
  { desk: 'fiscal blackout desk', method: 'GET', path: '/blackout/calendar', auth: 'bearer',
    query: ['start', 'end'],
    returns: ['open', 'condition'] },
  { desk: 'stored materials desk', method: 'POST', path: '/stored/quote', auth: 'bearer',
    body: ['previous_stored_cents', 'current_stored_cents'],
    returns: ['new_stored_cents', 'converted_cents'] },
  { desk: 'change-order registry', method: 'POST', path: '/co/registry', auth: 'bearer',
    body: ['job_id', 'period_end', 'co_id'],
    returns: ['status', 'amount_cents', 'executed_on'] },
  { desk: 'steel index', method: 'GET', path: '/index/mill', auth: 'bearer',
    query: ['item'],
    returns: ['amount_cents'] },
  { desk: 'quantity tickets', method: 'POST', path: '/tickets/cap', auth: 'bearer',
    body: ['line_id', 'claimed_qty', 'unit_rate_cents'],
    returns: ['ok'] },
  { desk: 'permit / inspection', method: 'POST', path: '/permit/gate', auth: 'bearer',
    body: ['job_id', 'line_tag', 'predecessor_complete', 'billed_cents'],
    returns: ['ok'] },
  { desk: 'certified payroll', method: 'POST', path: '/payroll/status', auth: 'bearer',
    body: ['job_id', 'period_start', 'period_end', 'stamped_days'],
    returns: ['ok', 'required_days'] },
  { desk: 'insurance COI', method: 'POST', path: '/insurance/coi', auth: 'bearer',
    body: ['job_id', 'period_end', 'gl_wc_expires_on', 'has_inland_marine', 'has_new_stored'],
    returns: ['ok'] },
  { desk: 'architect e-stamp', method: 'POST', path: '/architect/stamp', auth: 'bearer',
    body: ['application_id', 'proposed_net_cents', 'composed_net_cents'],
    returns: ['stamped', 'net_cents'] },
  { desk: 'owner encumbrance', method: 'POST', path: '/encumbrance/check', auth: 'bearer',
    body: ['remaining_cents', 'net_cents'],
    returns: ['ok'] },
  { desk: 'joint check', method: 'POST', path: '/joint-check/payees', auth: 'bearer',
    body: ['steel_this_period_cents', 'gc_name', 'steel_name'],
    returns: ['payees'] },
  { desk: 'DBE participation', method: 'POST', path: '/dbe/check', auth: 'bearer',
    body: ['dbe_wip_cents', 'wip_ex_gc_cents'],
    returns: ['ok', 'ratio_bps'] },
  { desk: 'sub-invoice', method: 'POST', path: '/sub-invoice/check', auth: 'bearer',
    body: ['steel_this_period_cents', 'sub_invoice_cents'],
    returns: ['ok'] },
  { desk: 'lien waiver', method: 'POST', path: '/waivers', auth: 'notice-key',
    body: ['application_id', 'kind', 'status'],
    returns: ['id'] },
  { desk: 'notice desk', method: 'POST', path: '/notices/receipts', auth: 'notice-key',
    body: ['application_id', 'total_cents', 'breakdown'],
    returns: ['id'] },
  { desk: 'SMS desk', method: 'POST', path: '/sms/receipts', auth: 'notice-key',
    body: ['application_id', 'total_cents', 'breakdown'],
    returns: ['id'] },
  { desk: 'email desk', method: 'POST', path: '/emails/receipts', auth: 'notice-key',
    body: ['application_id', 'total_cents', 'breakdown'],
    returns: ['id'] },
  { desk: 'pay-period diary', method: 'POST', path: '/diary/holds', auth: 'notice-key',
    body: ['application_id', 'period_start', 'period_end'],
    returns: ['id'] },
  { desk: 'preferred-vendor punch', method: 'POST', path: '/loyalty/punches', auth: 'notice-key',
    body: ['application_id', 'person_id', 'member'],
    returns: ['id'] }
];

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Notice-Key',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      });
      return res.end();
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'drawbill-vendors' });
    }

    // The plant answers cross-origin so a till's own page, and anyone auditing
    // it, can read the desks without a proxy.
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

    recordCall(req.method, url.pathname);

    if (req.method === 'GET' && url.pathname === '/audit/calls') {
      const since = url.searchParams.get('since');
      const rows = since ? callLog.filter((c) => c.at >= since) : callLog.slice();
      const byPath = {};
      for (const c of rows) byPath[c.path] = (byPath[c.path] || 0) + 1;
      return send(res, 200, {
        total: rows.length,
        by_path: byPath,
        paths: Object.keys(byPath).sort(),
        calls: rows.slice(-400)
      });
    }

    if (req.method === 'POST' && url.pathname === '/audit/reset') {
      requireToken(req);
      resetPlantState();
      return send(res, 200, { ok: true, reset: true });
    }

    if (req.method === 'GET' && (url.pathname === '/desks' || url.pathname === '/')) {
      return send(res, 200, {
        service: 'drawbill-vendors',
        note: 'Every desk on the plant network publishes what it accepts here. '
          + 'What a desk answers is the desk\'s business; what the till does with the answer is the till\'s.',
        auth: {
          bearer: 'Authorization: Bearer <VENDOR_TOKEN> — every desk below unless it says notice-key',
          notice_key: 'X-Notice-Key: <NOTICE_API_KEY> — copy desks (paper, SMS, email, diary, punch, waivers)'
        },
        desks: DESKS
      });
    }

    if (req.method === 'GET' && url.pathname === '/tax/quote') {
      requireToken(req);
      const windowName = needStr(url.searchParams.get('window'), 'window');
      const base = needStr(url.searchParams.get('base'), 'base').toLowerCase();
      if (base !== 'wip') {
        refuse('County tax quotes installed work only. Stored piles belong on the warehouse window.');
      }
      const cents = Number(url.searchParams.get('cents'));
      if (!Number.isInteger(cents) || cents < 0) refuse('cents must be a non-negative integer', 400);
      const bps = taxBps(windowName);
      if (bps == null) refuse('Unknown tax window', 400);
      return send(res, 200, {
        tax_cents: Math.trunc((cents * bps) / 10000),
        rate_bps: bps,
        window: windowName.toLowerCase()
      });
    }

    if (req.method === 'GET' && url.pathname === '/tax/warehouse') {
      requireToken(req);
      const windowName = needStr(url.searchParams.get('window'), 'window');
      const base = needStr(url.searchParams.get('base'), 'base').toLowerCase();
      if (base === 'wip') {
        refuse('Warehouse tax does not quote installed work. Ask the job county for WIP.');
      }
      if (base !== 'stored') refuse('Warehouse tax quotes stored piles only.');
      const cents = Number(url.searchParams.get('cents'));
      if (!Number.isInteger(cents) || cents < 0) refuse('cents must be a non-negative integer', 400);
      const bps = taxBps(windowName);
      if (bps == null) refuse('Unknown tax window', 400);
      return send(res, 200, {
        tax_cents: Math.trunc((cents * bps) / 10000),
        rate_bps: bps,
        window: windowName.toLowerCase()
      });
    }

    if (req.method === 'POST' && url.pathname === '/retainage/quote') {
      requireToken(req);
      const body = await readBody(req);
      const wip = needInt(body, 'wip_cents');
      const converted = needInt(body, 'converted_cents');
      const gcThis = needInt(body, 'gc_this_cents');
      const newStored = needInt(body, 'new_stored_cents');
      const cas = needInt(body, 'completed_and_stored_cents');
      const contracted = needInt(body, 'current_contracted_cents');
      if (contracted <= 0) refuse('current_contracted_cents must be positive', 400);
      const jobRateBps = cas * 2 >= contracted ? 500 : 1000;
      const wipBase = wip - converted - gcThis;
      if (wipBase < 0) refuse('Retainage WIP base cannot be negative');
      const retWip = Math.trunc((wipBase * jobRateBps) / 10000);
      const retStored = Math.trunc((newStored * 1000) / 10000);
      return send(res, 200, {
        ret_wip_cents: retWip,
        ret_stored_cents: retStored,
        ret_cents: retWip + retStored,
        job_rate_bps: jobRateBps
      });
    }

    if (req.method === 'POST' && url.pathname === '/fee/quote') {
      requireToken(req);
      const body = await readBody(req);
      const original = needInt(body, 'original_base_cents');
      const co = needInt(body, 'co_base_cents');
      const fee = Math.trunc((original * 800) / 10000) + Math.trunc((co * 600) / 10000);
      return send(res, 200, { fee_cents: fee });
    }

    if (req.method === 'POST' && url.pathname === '/bond/quote') {
      requireToken(req);
      const body = await readBody(req);
      const original = needInt(body, 'original_contract_cents');
      if (body.already_billed == null) refuse('already_billed is required', 400);
      if (body.already_billed === true || body.already_billed === 'true') {
        refuse('Bond is once, on the original contract, on the first posted paper');
      }
      return send(res, 200, { bond_cents: Math.trunc((original * 100) / 10000) });
    }

    if (req.method === 'POST' && url.pathname === '/fringe/quote') {
      requireToken(req);
      const body = await readBody(req);
      const jobId = needStr(body.job_id, 'job_id');
      const start = needStr(body.period_start, 'period_start');
      const end = needStr(body.period_end, 'period_end');
      const key = `${jobId}|${start}|${end}`;
      if (!Object.prototype.hasOwnProperty.call(FRINGE, key)) {
        refuse('Fringe desk has no rider for that job and inclusive period');
      }
      return send(res, 200, { fringe_cents: FRINGE[key] });
    }

    if (req.method === 'GET' && url.pathname === '/weather/days') {
      requireToken(req);
      const jobId = url.searchParams.get('job_id') || url.searchParams.get('window') || '';
      const start = needStr(url.searchParams.get('start'), 'start');
      const end = needStr(url.searchParams.get('end'), 'end');
      const key = `${jobId}|${start}|${end}`;
      const days = Object.prototype.hasOwnProperty.call(WEATHER_DAYS, key) ? WEATHER_DAYS[key] : 0;
      return send(res, 200, { weather_days: days });
    }

    if (req.method === 'POST' && url.pathname === '/ld/quote') {
      requireToken(req);
      const body = await readBody(req);
      const scd = needStr(body.scd, 'scd');
      const periodEnd = needStr(body.period_end, 'period_end');
      if (body.weather_days == null) refuse('weather_days is required — ask the weather desk first', 400);
      const weather = Number(body.weather_days);
      if (!Number.isInteger(weather) || weather < 0) refuse('weather_days must be a non-negative integer', 400);
      const rawDays = inclusiveDaysAfter(scd, periodEnd);
      const ldDays = Math.max(0, rawDays - weather);
      return send(res, 200, { ld_cents: ldDays * 250000, ld_days: ldDays });
    }

    if (req.method === 'GET' && url.pathname === '/blackout/calendar') {
      requireToken(req);
      const start = needStr(url.searchParams.get('start'), 'start');
      const end = needStr(url.searchParams.get('end'), 'end');
      if (end < BOOKS_OPEN) refuse('Books are not open before 2030-03-01');
      const blocked = rangesOverlap(start, end, BLACKOUT_START, BLACKOUT_END);
      return send(res, 200, {
        open: !blocked,
        condition: blocked ? 'CLOSED' : 'OPEN',
        blackout_start: BLACKOUT_START,
        blackout_end: BLACKOUT_END
      });
    }

    if (req.method === 'POST' && url.pathname === '/stored/quote') {
      requireToken(req);
      const body = await readBody(req);
      const prev = needInt(body, 'previous_stored_cents');
      const curr = needInt(body, 'current_stored_cents');
      const converted = Math.max(0, prev - curr);
      const neu = Math.max(0, curr - prev);
      return send(res, 200, { new_stored_cents: neu, converted_cents: converted });
    }

    if (req.method === 'POST' && url.pathname === '/co/registry') {
      requireToken(req);
      const body = await readBody(req);
      const coId = needStr(body.co_id, 'co_id');
      const periodEnd = needStr(body.period_end, 'period_end');
      if (coId === '40000000-0000-4000-8000-000000000001') {
        const executedOn = '2030-04-10';
        if (executedOn > periodEnd) refuse('CO-01 is not executed as of that period end');
        return send(res, 200, { status: 'EXECUTED', amount_cents: 4000000, executed_on: executedOn, number: 'CO-01' });
      }
      if (coId === '40000000-0000-4000-8000-000000000002') {
        refuse('CO-02 is still draft. Unexecuted extras do not belong on a paper.');
      }
      refuse('Unknown change order', 404);
    }

    if (req.method === 'GET' && url.pathname === '/index/mill') {
      requireToken(req);
      const item = needStr(url.searchParams.get('item'), 'item');
      if (item !== 'mill_extra_harborview') refuse('Index has no print for that item', 404);
      return send(res, 200, { amount_cents: 4000000, item });
    }

    if (req.method === 'POST' && url.pathname === '/tickets/cap') {
      requireToken(req);
      const body = await readBody(req);
      needStr(body.line_id, 'line_id');
      needInt(body, 'claimed_qty');
      needInt(body, 'unit_rate_cents');
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/permit/gate') {
      requireToken(req);
      const body = await readBody(req);
      const tag = needStr(body.line_tag, 'line_tag');
      const billed = needInt(body, 'billed_cents');
      if (tag === '03-400' && billed > 0 && !body.predecessor_complete) {
        refuse('Superstructure stays at zero until foundations are complete and the foundation stamp exists');
      }
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/payroll/status') {
      requireToken(req);
      const body = await readBody(req);
      const start = needStr(body.period_start, 'period_start');
      const end = needStr(body.period_end, 'period_end');
      const required = datesInRange(start, end);
      const stamped = Array.isArray(body.stamped_days) ? body.stamped_days.map(String) : null;
      if (!stamped) refuse('stamped_days is required', 400);
      const missing = required.filter((d) => !stamped.includes(d));
      if (missing.length) refuse(`Certified payroll missing ${missing[0]}`);
      return send(res, 200, { ok: true, required_days: required.length });
    }

    if (req.method === 'POST' && url.pathname === '/insurance/coi') {
      requireToken(req);
      const body = await readBody(req);
      const periodEnd = needStr(body.period_end, 'period_end');
      const expires = needStr(body.gl_wc_expires_on, 'gl_wc_expires_on');
      if (expires < periodEnd) refuse('GL/WC does not run through the last inclusive day of the period');
      if (body.has_new_stored && !body.has_inland_marine) {
        refuse('Stored piles need inland marine on file');
      }
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/architect/stamp') {
      requireToken(req);
      const body = await readBody(req);
      const proposed = needInt(body, 'proposed_net_cents', { allowNegative: true });
      const composed = needInt(body, 'composed_net_cents', { allowNegative: true });
      const applicationId = needStr(body.application_id, 'application_id');
      if (proposed !== composed) refuse('Architect stamps the exact composed net. A penny off is sent back.');
      architectStamps.push({ application_id: applicationId, net_cents: composed });
      return send(res, 200, { stamped: true, net_cents: composed });
    }

    if (req.method === 'POST' && url.pathname === '/encumbrance/check') {
      requireToken(req);
      const body = await readBody(req);
      const remaining = needInt(body, 'remaining_cents');
      const net = needInt(body, 'net_cents');
      if (remaining < net) refuse('Owner encumbrance does not cover this net');
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/joint-check/payees') {
      requireToken(req);
      const body = await readBody(req);
      const steel = needInt(body, 'steel_this_period_cents');
      const gcName = needStr(body.gc_name, 'gc_name');
      const steelName = needStr(body.steel_name, 'steel_name');
      if (steel > 0) {
        return send(res, 200, { payees: [gcName, steelName], joint: true });
      }
      return send(res, 200, { payees: [gcName], joint: false });
    }

    if (req.method === 'POST' && url.pathname === '/dbe/check') {
      requireToken(req);
      const body = await readBody(req);
      const dbe = needInt(body, 'dbe_wip_cents');
      const base = needInt(body, 'wip_ex_gc_cents');
      if (base <= 0) refuse('DBE base cannot be zero', 400);
      const ratioBps = Math.trunc((dbe * 10000) / base);
      if (ratioBps < 500) refuse('DBE participation is short of five percent of this-period work excluding general conditions');
      return send(res, 200, { ok: true, ratio_bps: ratioBps });
    }

    if (req.method === 'POST' && url.pathname === '/sub-invoice/check') {
      requireToken(req);
      const body = await readBody(req);
      const steel = needInt(body, 'steel_this_period_cents');
      const sub = needInt(body, 'sub_invoice_cents');
      if (steel > 0 && sub < steel) refuse('Ironclad\'s invoice does not cover this-period steel');
      return send(res, 200, { ok: true });
    }

    if (req.method === 'POST' && url.pathname === '/waivers') {
      requireNoticeKey(req);
      const body = await readBody(req);
      const row = {
        id: `wvr-${waivers.length + 1}`,
        application_id: needStr(body.application_id, 'application_id'),
        kind: needStr(body.kind, 'kind'),
        status: needStr(body.status, 'status')
      };
      waivers.push(row);
      return send(res, 200, row);
    }

    if (req.method === 'POST' && url.pathname === '/notices/receipts') {
      requireNoticeKey(req);
      const body = await readBody(req);
      const row = { id: `ntc-${notices.length + 1}`, ...body };
      if (body.total_cents == null) refuse('total_cents is required', 400);
      notices.push(row);
      return send(res, 200, { id: row.id });
    }

    if (req.method === 'POST' && url.pathname === '/sms/receipts') {
      requireNoticeKey(req);
      const body = await readBody(req);
      if (body.total_cents == null) refuse('total_cents is required', 400);
      const row = { id: `sms-${sms.length + 1}`, ...body };
      sms.push(row);
      return send(res, 200, { id: row.id });
    }

    if (req.method === 'POST' && url.pathname === '/emails/receipts') {
      requireNoticeKey(req);
      const body = await readBody(req);
      if (body.total_cents == null) refuse('total_cents is required', 400);
      const row = { id: `eml-${emails.length + 1}`, ...body };
      emails.push(row);
      return send(res, 200, { id: row.id });
    }

    if (req.method === 'POST' && url.pathname === '/diary/holds') {
      requireNoticeKey(req);
      const body = await readBody(req);
      const row = {
        id: `dry-${diary.length + 1}`,
        application_id: needStr(body.application_id, 'application_id'),
        period_start: needStr(body.period_start, 'period_start'),
        period_end: needStr(body.period_end, 'period_end')
      };
      diary.push(row);
      return send(res, 200, row);
    }

    if (req.method === 'POST' && url.pathname === '/loyalty/punches') {
      requireNoticeKey(req);
      const body = await readBody(req);
      if (!body.member) refuse('Punch desk only stamps preferred-vendor members');
      const row = {
        id: `pch-${punches.length + 1}`,
        application_id: needStr(body.application_id, 'application_id'),
        person_id: needStr(body.person_id, 'person_id')
      };
      punches.push(row);
      return send(res, 200, row);
    }

    // -----------------------------------------------------------------------
    // Card desk. The plant runs the card window on its own origin: a till asks
    // for a session, sends the payer here, and afterwards asks the desk what
    // actually happened. A till that posts a paper on the strength of its own
    // redirect, without asking, is trusting the browser.
    // -----------------------------------------------------------------------
    if (req.method === 'POST' && url.pathname === '/card/sessions') {
      requireToken(req);
      const body = await readBody(req);
      const amount = needInt(body, 'amount_cents');
      if (amount <= 0) refuse('The card desk does not take a zero or negative amount', 400);
      const successUrl = needStr(body.success_url, 'success_url');
      const cancelUrl = needStr(body.cancel_url, 'cancel_url');
      cardSeq += 1;
      const id = `cds_${Date.now().toString(36)}${cardSeq.toString(36).padStart(3, '0')}`;
      const session = {
        id,
        status: 'open',
        payment_status: 'unpaid',
        amount_cents: amount,
        currency: String(body.currency || 'usd').toLowerCase(),
        reference: body.reference == null ? null : String(body.reference),
        description: body.description == null ? null : String(body.description),
        customer_email: body.customer_email == null ? null : String(body.customer_email),
        metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
        success_url: successUrl,
        cancel_url: cancelUrl,
        url: `${PUBLIC_BASE}/card/pay/${id}`,
        paid_at: null
      };
      cardSessions.set(id, session);
      return send(res, 200, publicCardSession(session));
    }

    if (req.method === 'GET' && url.pathname.startsWith('/card/sessions/')) {
      requireToken(req);
      const session = cardSessions.get(url.pathname.slice('/card/sessions/'.length));
      if (!session) refuse('The card desk has no session by that id', 404);
      return send(res, 200, publicCardSession(session));
    }

    // The card window itself. Unauthenticated on purpose: this is the page the
    // payer's browser opens, and it carries no figure the payer did not
    // already agree to.
    if (req.method === 'GET' && url.pathname.startsWith('/card/pay/')) {
      const session = cardSessions.get(url.pathname.slice('/card/pay/'.length));
      if (!session) return sendHtml(res, 404, '<!doctype html><p>No such card session.</p>');
      return sendHtml(res, 200, cardWindow(session, null));
    }

    if (req.method === 'POST' && url.pathname.startsWith('/card/pay/')) {
      const session = cardSessions.get(url.pathname.slice('/card/pay/'.length));
      if (!session) return sendHtml(res, 404, '<!doctype html><p>No such card session.</p>');
      const form = await readForm(req);
      if (form.action === 'cancel') {
        session.status = 'canceled';
        return redirect(res, session.cancel_url);
      }
      if (session.payment_status === 'paid') {
        return redirect(res, returnUrl(session.success_url, session.id));
      }
      const digits = String(form.card || '').replace(/\D/g, '');
      if (digits !== GOOD_CARD) {
        return sendHtml(res, 200, cardWindow(session, 'That card was declined. The plant takes 4242 4242 4242 4242.'));
      }
      session.payment_status = 'paid';
      session.status = 'complete';
      session.paid_at = new Date().toISOString();
      if (form.email) session.customer_email = String(form.email);
      return redirect(res, returnUrl(session.success_url, session.id));
    }

    send(res, 404, { error: 'Unknown desk' });
  } catch (err) {
    send(res, err.status || 500, { error: err.message || 'Vendor desk failed' });
  }
});

// ---------------------------------------------------------------------------
// The desks have to keep answering for the whole life of the box. The product
// is built against them and demonstrated against them, so a desk that dies
// takes the run with it. Nothing a caller sends is allowed to end the process,
// and a port still held by a previous copy is waited out rather than treated as
// fatal.
// ---------------------------------------------------------------------------
process.on('uncaughtException', (err) => {
  process.stderr.write(`drawbill-vendors uncaught: ${(err && err.stack) || err}\n`);
});

process.on('unhandledRejection', (err) => {
  process.stderr.write(`drawbill-vendors unhandled rejection: ${(err && err.stack) || err}\n`);
});

server.on('clientError', (err, socket) => {
  try {
    if (socket && socket.writable) {
      socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    } else if (socket) {
      socket.destroy();
    }
  } catch (_) {
    // a half-open socket is not a reason to stop serving the other desks
  }
});

server.keepAliveTimeout = 65000;
server.headersTimeout = 70000;

function listen() {
  try {
    server.listen(PORT, '0.0.0.0');
  } catch (err) {
    process.stderr.write(`drawbill-vendors listen threw: ${err && err.message}\n`);
    setTimeout(listen, 1000);
  }
}

server.on('listening', () => {
  process.stdout.write(`drawbill-vendors listening on ${PORT}\n`);
});

server.on('error', (err) => {
  process.stderr.write(`drawbill-vendors listen error: ${(err && err.code) || err}\n`);
  try {
    server.close();
  } catch (_) {
    // not listening yet; nothing to close
  }
  setTimeout(listen, 1000);
});

listen();
