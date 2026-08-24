'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.VENDOR_PORT || 3101);
const TOKEN = process.env.VENDOR_TOKEN || 'gv-vendor-dev';
const NOTICE_KEY = process.env.NOTICE_API_KEY || 'gv-notice-dev';
const HMAC_SECRET = process.env.INSURANCE_HMAC_SECRET || 'gv-hull-hmac-dev';

const TAX_BPS = {
  riverside: 725,
  downtown: 950,
  pier: 600,
  '44444444-4444-4444-4444-444444444444': 725,
  '55555555-5555-5555-5555-555555555555': 950,
  '77777777-7777-7777-7777-777777777777': 600
};

const WEEKEND_DAY_CENTS = 1200;
const HULL_PER_DAY_CENTS = 1500;

const SEVERE_DATES = new Set(['2030-11-01', '2030-11-02', '2030-11-03', '2030-11-04']);
const CLOSED_DATES = new Set(['2030-12-24', '2030-12-25', '2030-12-26', '2030-12-31']);

const FLEET_BAY = {
  'K-055': 'RIV-K055',
  'L-118': 'RIV-L118',
  'D-004': 'DTN-D004',
  'T-012': 'RIV-T012',
  'S-301': 'DTN-S301',
  'X-410': 'DTN-X410',
  'B-216': 'RIV-B216',
  'M-088': 'DTN-M088',
  'Y-300': 'DTN-Y300',
  'G-220': 'PIE-G220',
  'R-090': 'PIE-R090',
  'P-330': 'PIE-P330',
  'C-077': 'PIE-C077',
  'E-015': 'PIE-E015',
  'N-201': 'PIE-N201',
  'H-019': 'PIE-H019',
  'F-612': 'DTN-F612',
  'W-044': 'RIV-W044'
};

const notices = [];
const sms = [];
const emails = [];
const binds = [];
const tickets = new Map();
const scans = new Map();
const holds = [];
const punches = [];
const transfers = [];

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

function taxBps(key) {
  const c = String(key || '').trim().toLowerCase();
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-Notice-Key, X-Insurance-Signature',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
      });
      return res.end();
    }

    if (req.method === 'GET' && url.pathname === '/health') {
      return send(res, 200, { ok: true, service: 'gearvault-vendors' });
    }

    if (req.method === 'GET' && (url.pathname === '/desks' || url.pathname === '/')) {
      return send(res, 200, {
        service: 'gearvault-vendors',
        ok: true,
        desks: [
          'county tax office',
          'hull insurance bureau',
          'weekend surcharge desk',
          'weather desk',
          'holiday / blackout desk',
          'notice desk',
          'SMS desk',
          'email desk',
          'shop diary',
          'photo desk',
          'fleet serial desk',
          'bay serial-scan desk',
          'loyalty desk',
          'transfer bureau'
        ]
      });
    }

    if (req.method === 'GET' && url.pathname === '/fleet/serials') {
      requireToken(req);
      const tag = String(url.searchParams.get('asset_tag') || url.searchParams.get('tag') || '');
      const bay_code = FLEET_BAY[tag];
      if (!bay_code) return send(res, 404, { error: 'Unknown serialized unit' });
      return send(res, 200, { asset_tag: tag, bay_code });
    }

    if (req.method === 'GET' && url.pathname === '/tax/quote') {
      requireToken(req);
      const shop = url.searchParams.get('shop') || url.searchParams.get('locationId') || url.searchParams.get('location_id');
      const rental = Number(url.searchParams.get('rental_cents'));
      const bps = taxBps(shop);
      if (bps == null || !Number.isFinite(rental) || rental < 0) {
        return send(res, 400, { error: 'Shop and rental_cents are required' });
      }
      const tax_cents = Math.round((rental * bps) / 10000);
      return send(res, 200, { tax_cents, rate_bps: bps, shop });
    }

    if (req.method === 'POST' && url.pathname === '/insurance/hull') {
      requireToken(req);
      const body = await readBody(req);
      const category = String(body.category || body.unit_category || '');
      const days = Number(body.days ?? body.day_count ?? body.dayCount);
      if (!Number.isInteger(days) || days < 1) {
        return send(res, 400, { error: 'days (the number of billable days on the paper) is required' });
      }
      const per_day_cents = /drone/i.test(category) ? HULL_PER_DAY_CENTS : 0;
      const premium_cents = per_day_cents * days;
      return send(res, 200, {
        premium_cents,
        per_day_cents,
        days,
        rider: premium_cents ? 'HULL_DRONE' : 'NONE'
      });
    }

    if (req.method === 'POST' && url.pathname === '/insurance/bind') {
      requireToken(req);
      const body = await readBody(req);
      const sessionId = String(body.sessionId || body.session_id || '');
      const premium = Number(body.premium_cents);
      const sig = String(req.headers['x-insurance-signature'] || '');
      const expected = crypto.createHmac('sha256', HMAC_SECRET).update(`${sessionId}:${premium}`).digest('hex');
      if (!sessionId || !Number.isFinite(premium) || sig !== expected) {
        return send(res, 401, { error: 'Insurance bind signature rejected' });
      }
      const id = crypto.randomUUID();
      binds.push({
        id,
        sessionId,
        premium_cents: premium,
        customer_id: body.customer_id || null,
        unit_id: body.unit_id || null
      });
      return send(res, 201, { bind_id: id });
    }

    if (req.method === 'GET' && url.pathname === '/insurance/binds') {
      requireToken(req);
      const unit = url.searchParams.get('unit_id');
      const customer = url.searchParams.get('customer_id');
      const rows = binds.filter((row) => (
        (!unit || row.unit_id === unit) && (!customer || row.customer_id === customer)
      ));
      return send(res, 200, { binds: rows });
    }

    if (req.method === 'GET' && url.pathname === '/surcharge/weekend') {
      requireToken(req);
      const start = url.searchParams.get('start') || url.searchParams.get('date');
      const end = url.searchParams.get('end') || start;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || ''))) {
        return send(res, 400, { error: 'A date range is required' });
      }
      const days = datesInRange(start, end || start);
      const weekend_days = days.filter((d) => {
        const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
        return dow === 0 || dow === 6;
      });
      return send(res, 200, {
        surcharge_cents: WEEKEND_DAY_CENTS * weekend_days.length,
        per_weekend_day_cents: WEEKEND_DAY_CENTS,
        weekend_days,
        weekend_day_count: weekend_days.length,
        weekend: weekend_days.length > 0
      });
    }

    if (req.method === 'GET' && url.pathname === '/weather/forecast') {
      requireToken(req);
      const start = url.searchParams.get('start') || url.searchParams.get('date');
      const end = url.searchParams.get('end') || start;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || ''))) {
        return send(res, 400, { error: 'A date range is required' });
      }
      const days = datesInRange(start, end || start);
      const severe = days.some((d) => SEVERE_DATES.has(d));
      return send(res, 200, {
        outdoor_ok: !severe,
        canvas_hold: severe,
        condition: severe ? 'SEVERE' : 'CLEAR',
        days
      });
    }

    if (req.method === 'POST' && url.pathname === '/notices/receipts') {
      requireNoticeKey(req);
      const body = await readBody(req);
      if (!body.reservation_id || body.total_cents == null) {
        return send(res, 400, { error: 'reservation_id and total_cents are required' });
      }
      const row = {
        id: crypto.randomUUID(),
        reservation_id: body.reservation_id,
        customer_id: body.customer_id || null,
        asset_tag: body.asset_tag || null,
        total_cents: Number(body.total_cents),
        tax_cents: Number(body.tax_cents || 0),
        hull_cents: Number(body.hull_cents || 0),
        surcharge_cents: Number(body.surcharge_cents || 0),
        deposit_cents: Number(body.deposit_cents || 0),
        rental_cents: Number(body.rental_cents || 0)
      };
      notices.push(row);
      return send(res, 201, { receipt: row });
    }

    if (req.method === 'GET' && url.pathname === '/notices/receipts') {
      requireNoticeKey(req);
      const customer = url.searchParams.get('customer_id');
      const rows = notices.filter((row) => !customer || row.customer_id === customer);
      return send(res, 200, { receipts: rows });
    }

    if (req.method === 'POST' && url.pathname === '/media/tickets') {
      requireNoticeKey(req);
      const body = await readBody(req);
      if (!body.reservation_id) return send(res, 400, { error: 'reservation_id is required' });
      const id = crypto.randomUUID();
      tickets.set(id, { id, reservation_id: body.reservation_id, used: false });
      return send(res, 201, { ticket_id: id });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/media/tickets/')) {
      requireNoticeKey(req);
      const id = url.pathname.split('/').pop();
      const row = tickets.get(id);
      if (!row) return send(res, 404, { error: 'Unknown media ticket' });
      return send(res, 200, row);
    }

    if (req.method === 'POST' && url.pathname === '/calendar/holds') {
      requireToken(req);
      const body = await readBody(req);
      if (!body.reservation_id || !body.start_date || !body.end_date) {
        return send(res, 400, { error: 'reservation_id and dates are required' });
      }
      const row = {
        id: crypto.randomUUID(),
        reservation_id: body.reservation_id,
        unit_id: body.unit_id || null,
        asset_tag: body.asset_tag || null,
        start_date: body.start_date,
        end_date: body.end_date
      };
      holds.push(row);
      return send(res, 201, { hold: row });
    }

    if (req.method === 'GET' && url.pathname === '/calendar/holds') {
      requireToken(req);
      const unit = url.searchParams.get('unit_id');
      const tag = url.searchParams.get('asset_tag');
      const rows = holds.filter((row) => (
        (!unit || row.unit_id === unit) && (!tag || row.asset_tag === tag)
      ));
      return send(res, 200, { holds: rows });
    }

    if (req.method === 'GET' && url.pathname === '/blackout/calendar') {
      requireToken(req);
      const start = url.searchParams.get('start') || url.searchParams.get('date');
      const end = url.searchParams.get('end') || start;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(start || ''))) {
        return send(res, 400, { error: 'A date range is required' });
      }
      const days = datesInRange(start, end || start);
      const closed_dates = days.filter((d) => CLOSED_DATES.has(d));
      return send(res, 200, {
        shop_open: closed_dates.length === 0,
        van_idle: closed_dates.length > 0,
        condition: closed_dates.length ? 'CLOSED' : 'OPEN',
        closed_dates,
        days
      });
    }

    if (req.method === 'POST' && url.pathname === '/scan/tickets') {
      requireToken(req);
      const body = await readBody(req);
      if (!body.reservation_id || !body.unit_id) {
        return send(res, 400, { error: 'reservation_id and unit_id are required' });
      }
      const tag = String(body.asset_tag || '');
      const expectedBay = FLEET_BAY[tag];
      if (!expectedBay || String(body.bay_code || body.bayCode || '') !== expectedBay) {
        return send(res, 409, { error: 'Bay code does not match the fleet serial for that kit' });
      }
      const id = crypto.randomUUID();
      const row = {
        id,
        reservation_id: body.reservation_id,
        unit_id: body.unit_id,
        asset_tag: body.asset_tag || null,
        used: false
      };
      scans.set(id, row);
      return send(res, 201, { ticket_id: id });
    }

    if (req.method === 'GET' && url.pathname.startsWith('/scan/tickets/')) {
      requireToken(req);
      const id = url.pathname.split('/').pop();
      const row = scans.get(id);
      if (!row) return send(res, 404, { error: 'Unknown scan ticket' });
      return send(res, 200, row);
    }

    if (req.method === 'POST' && url.pathname === '/scan/redeem') {
      requireToken(req);
      const body = await readBody(req);
      const id = String(body.ticket_id || body.ticketId || '');
      const row = scans.get(id);
      if (!row) return send(res, 404, { error: 'Unknown scan ticket' });
      if (row.used) return send(res, 409, { error: 'Scan ticket already used' });
      if (body.reservation_id && row.reservation_id !== body.reservation_id) {
        return send(res, 409, { error: 'Scan ticket does not match this booking' });
      }
      row.used = true;
      return send(res, 200, row);
    }

    if (req.method === 'POST' && url.pathname === '/sms/receipts') {
      requireNoticeKey(req);
      const body = await readBody(req);
      if (!body.reservation_id || body.total_cents == null) {
        return send(res, 400, { error: 'reservation_id and total_cents are required' });
      }
      const row = {
        id: crypto.randomUUID(),
        reservation_id: body.reservation_id,
        customer_id: body.customer_id || null,
        asset_tag: body.asset_tag || null,
        total_cents: Number(body.total_cents),
        tax_cents: Number(body.tax_cents || 0),
        hull_cents: Number(body.hull_cents || 0),
        surcharge_cents: Number(body.surcharge_cents || 0),
        deposit_cents: Number(body.deposit_cents || 0),
        rental_cents: Number(body.rental_cents || 0),
        channel: 'sms'
      };
      sms.push(row);
      return send(res, 201, { receipt: row });
    }

    if (req.method === 'GET' && url.pathname === '/sms/receipts') {
      requireNoticeKey(req);
      const customer = url.searchParams.get('customer_id');
      const rows = sms.filter((row) => !customer || row.customer_id === customer);
      return send(res, 200, { receipts: rows });
    }

    if (req.method === 'POST' && url.pathname === '/email/receipts') {
      requireNoticeKey(req);
      const body = await readBody(req);
      if (!body.reservation_id || body.total_cents == null) {
        return send(res, 400, { error: 'reservation_id and total_cents are required' });
      }
      const row = {
        id: crypto.randomUUID(),
        reservation_id: body.reservation_id,
        customer_id: body.customer_id || null,
        asset_tag: body.asset_tag || null,
        total_cents: Number(body.total_cents),
        tax_cents: Number(body.tax_cents || 0),
        hull_cents: Number(body.hull_cents || 0),
        surcharge_cents: Number(body.surcharge_cents || 0),
        deposit_cents: Number(body.deposit_cents || 0),
        rental_cents: Number(body.rental_cents || 0),
        channel: 'email'
      };
      emails.push(row);
      return send(res, 201, { receipt: row });
    }

    if (req.method === 'GET' && url.pathname === '/email/receipts') {
      requireNoticeKey(req);
      const customer = url.searchParams.get('customer_id');
      const rows = emails.filter((row) => !customer || row.customer_id === customer);
      return send(res, 200, { receipts: rows });
    }

    if (req.method === 'POST' && url.pathname === '/loyalty/punches') {
      requireToken(req);
      const body = await readBody(req);
      if (!body.reservation_id || !body.customer_id) {
        return send(res, 400, { error: 'reservation_id and customer_id are required' });
      }
      const row = {
        id: crypto.randomUUID(),
        reservation_id: body.reservation_id,
        customer_id: body.customer_id,
        stamps: 1
      };
      punches.push(row);
      return send(res, 201, { punch: row });
    }

    if (req.method === 'GET' && url.pathname === '/loyalty/punches') {
      requireToken(req);
      const customer = url.searchParams.get('customer_id');
      const rows = punches.filter((row) => !customer || row.customer_id === customer);
      return send(res, 200, { punches: rows });
    }

    if (req.method === 'POST' && url.pathname === '/transfer/stamps') {
      requireToken(req);
      const body = await readBody(req);
      if (!body.unit_id || !body.to_shop) {
        return send(res, 400, { error: 'unit_id and to_shop are required' });
      }
      const row = {
        id: crypto.randomUUID(),
        unit_id: body.unit_id,
        from_shop: body.from_shop || null,
        to_shop: body.to_shop,
        clerk_id: body.clerk_id || null,
        used: false
      };
      transfers.push(row);
      return send(res, 201, { stamp_id: row.id });
    }

    if (req.method === 'GET' && url.pathname === '/transfer/stamps') {
      requireToken(req);
      const unit = url.searchParams.get('unit_id');
      const rows = transfers.filter((row) => !unit || row.unit_id === unit);
      return send(res, 200, { stamps: rows });
    }

    if (req.method === 'POST' && url.pathname === '/transfer/redeem') {
      requireToken(req);
      const body = await readBody(req);
      const id = String(body.stamp_id || body.stampId || body.transferStamp || '');
      const row = transfers.find((item) => item.id === id);
      if (!row) return send(res, 404, { error: 'Unknown transfer stamp' });
      if (row.used) return send(res, 409, { error: 'Transfer stamp already used' });
      if (body.unit_id && row.unit_id !== body.unit_id) {
        return send(res, 409, { error: 'Transfer stamp does not match this unit' });
      }
      row.used = true;
      return send(res, 200, row);
    }

    send(res, 404, { error: 'Unknown vendor route' });
  } catch (error) {
    send(res, error.status || 500, { error: error.message || 'Vendor error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`GearVault vendor desks on http://0.0.0.0:${PORT}`);
});
