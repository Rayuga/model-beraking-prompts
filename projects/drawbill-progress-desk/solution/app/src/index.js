import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import ical from 'ical-generator';
import {
  DEFAULT_USER_ID,
  personById,
  allPeople,
  jobById,
  jobsVisibleTo,
  linesForJob,
  filterLinesForPerson,
  applicationById,
  applicationBySession,
  applicationsForJob,
  liveOverlaps,
  insertApplication,
  replaceApplicationLines,
  updateApplication,
  withTx,
  writeAudit,
  noticesFor,
  waiversFor,
  punchesFor,
  diaryFor,
  auditEntries,
  booksOpen,
  db,
  LEDGER_FILE
} from './db.js';
import { isoDate } from './dates.js';
import { dollars } from './money.js';
import { composeQuote, newId } from './compose.js';
import { vendorJson, postPaidVendors } from './vendors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const rawBase = process.env.BASE_URL || process.env.APP_PUBLIC_URL || `http://localhost:${port}`;
const baseUrl = String(rawBase).replace('127.0.0.1', 'localhost');

app.use(express.json());
app.use(express.static(path.resolve(__dirname, '../public')));

function fail(res, err) {
  const status = err.status || 500;
  return res.status(status).json({ error: err.message || 'Request failed' });
}

function demoUserCookie(req) {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === 'drawbill_demo_user') return decodeURIComponent(rest.join('='));
  }
  return null;
}

const NORTHLINE_COMPANY = '11111111-1111-4111-8111-111111111111';

// Westfork is listed on Avery's desk and is read-only there: a Northline filer
// may look at a job Northline does not run, and may not move its paper.
function refuseOffNorthlineWrite(person, job) {
  if (person.company_id === NORTHLINE_COMPANY && job && job.gc_company_id !== NORTHLINE_COMPANY) {
    const err = new Error('Northline files its own owner papers');
    err.status = 403;
    throw err;
  }
}

function requirePerson(req, res, next) {
  const claimed = req.header('X-Demo-User-Id') || demoUserCookie(req) || DEFAULT_USER_ID;
  const id = String(claimed).trim();
  const person = personById(id);
  if (!person) {
    return res.status(401).json({ error: 'Unknown identity' });
  }
  req.person = person;
  next();
}

app.use('/api', requirePerson);

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    ledger: 'sqlite',
    ledger_file: LEDGER_FILE.replaceAll('\\', '/'),
    books_open: booksOpen()
  });
});

app.get('/APP_MANIFEST.md', (_req, res) => {
  res.type('text/markdown');
  res.sendFile(path.resolve(__dirname, '../APP_MANIFEST.md'));
});

app.get('/api/session', (req, res) => {
  res.json({ user: publicPerson(req.person) });
});

app.get('/api/demo-users', (_req, res) => {
  res.json({ users: allPeople() });
});

function publicPerson(p) {
  return {
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    role: p.role,
    account_status: p.account_status,
    company_id: p.company_id,
    member: Boolean(p.member)
  };
}

function canFile(person) {
  return person.role === 'gc_pm' || person.role === 'project_engineer';
}

function visibleJob(req, jobId) {
  const job = jobById(jobId);
  if (!job) return null;
  return jobsVisibleTo(req.person).some((j) => j.id === job.id) ? job : null;
}

app.get('/api/jobs', (req, res) => {
  const jobs = jobsVisibleTo(req.person).map((job) => ({
    ...job,
    original_contract_label: dollars(job.original_contract_cents)
  }));
  res.json({ jobs });
});

app.get('/api/jobs/:id', (req, res) => {
  const job = visibleJob(req, req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found' });
  const lines = filterLinesForPerson(req.person, linesForJob(job.id)).map((line) => ({
    ...line,
    original_label: dollars(line.original_cents),
    unit_rate_label: line.unit_rate_cents == null ? null : dollars(line.unit_rate_cents)
  }));
  const applications = applicationsForJob(job.id).map(publicApp);
  res.json({ job, lines, applications });
});

function publicApp(row) {
  return {
    ...row,
    net_label: row.net_cents == null ? null : dollars(row.net_cents),
    wip_label: row.wip_cents == null ? null : dollars(row.wip_cents),
    stored_label: row.new_stored_cents == null ? null : dollars(row.new_stored_cents),
    converted_label: row.converted_cents == null ? null : dollars(row.converted_cents),
    fee_label: row.fee_cents == null ? null : dollars(row.fee_cents),
    bond_label: row.bond_cents == null ? null : dollars(row.bond_cents),
    tax_label: row.tax_cents == null ? null : dollars(row.tax_cents),
    fringe_label: row.fringe_cents == null ? null : dollars(row.fringe_cents),
    retainage_label: row.retainage_cents == null ? null : dollars(row.retainage_cents),
    ld_label: row.ld_cents == null ? null : dollars(row.ld_cents),
    payees: Array.isArray(row.payees)
      ? row.payees
      : (row.payees ? JSON.parse(row.payees) : [])
  };
}

app.get('/api/applications', (req, res) => {
  const jobs = jobsVisibleTo(req.person);
  const rows = [];
  for (const job of jobs) {
    for (const appRow of applicationsForJob(job.id)) {
      rows.push({ ...publicApp(appRow), job_short_name: job.short_name });
    }
  }
  res.json({ applications: rows });
});

app.get('/api/applications/:id', (req, res) => {
  const row = applicationById(req.params.id);
  if (!row || !visibleJob(req, row.job_id)) {
    return res.status(404).json({ error: 'Application not found' });
  }
  const lines = db.prepare('SELECT * FROM application_lines WHERE application_id = ?').all(row.id);
  res.json({ application: publicApp(row), lines });
});

app.post('/api/applications', async (req, res) => {
  try {
    if (!canFile(req.person)) {
      const err = new Error('Only the GC project manager or project engineer can file a paper');
      err.status = 403;
      throw err;
    }
    const job = visibleJob(req, req.body?.job_id);
    if (!job) {
      const err = new Error('Job not found');
      err.status = 404;
      throw err;
    }
    refuseOffNorthlineWrite(req.person, job);
    const start = isoDate(req.body?.period_start);
    const end = isoDate(req.body?.period_end);
    if (!start || !end || start > end) {
      const err = new Error('Period must be calendar days, inclusive on both ends');
      err.status = 400;
      throw err;
    }
    if (liveOverlaps(job.id, start, end).length) {
      const err = new Error('That inclusive period overlaps a live paper on this job');
      err.status = 409;
      throw err;
    }
    const quote = await composeQuote(job, start, end);
    const id = newId();
    const number = `App ${applicationsForJob(job.id).length + 1}`;
    withTx(() => {
      insertApplication({
        id,
        job_id: job.id,
        number,
        period_start: start,
        period_end: end,
        status: 'PENCIL',
        kind: 'progress',
        filed_by: req.person.id
      });
      replaceApplicationLines(id, quote.derived.map((d) => ({
        id: crypto.randomUUID(),
        sov_line_id: d.line.id,
        billed_to_date_cents: d.billed_to_date_cents,
        stored_remaining_cents: d.stored_remaining_cents,
        this_period_wip_cents: d.this_period_wip_cents
      })));
      updateApplication(id, {
        net_cents: quote.net_cents,
        wip_cents: quote.wip_cents,
        new_stored_cents: quote.new_stored_cents,
        converted_cents: quote.converted_cents,
        fee_cents: quote.fee_cents,
        bond_cents: quote.bond_cents,
        tax_cents: quote.tax_cents,
        fringe_cents: quote.fringe_cents,
        retainage_cents: quote.retainage_cents,
        ld_cents: quote.ld_cents,
        payees: JSON.stringify(quote.payees)
      });
      writeAudit({
        actorId: req.person.id,
        action: 'file',
        entity: 'application',
        entityId: id,
        next: { net_cents: quote.net_cents }
      });
    });
    res.status(201).json({ application: publicApp(applicationById(id)), quote });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/applications/:id/withdraw', (req, res) => {
  try {
    const row = applicationById(req.params.id);
    if (!row || !visibleJob(req, row.job_id)) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (!canFile(req.person)) {
      const err = new Error('Only the filer roles can withdraw a pencil');
      err.status = 403;
      throw err;
    }
    refuseOffNorthlineWrite(req.person, jobById(row.job_id));
    // A pencil typed wrong is not a life sentence, but anything the architect
    // has already certified — or that has been released or paid — is a matter
    // of record and stays on the books.
    if (row.status !== 'PENCIL' && row.status !== 'SUBMITTED') {
      const err = new Error('Only a pencil that has not been certified can be withdrawn');
      err.status = 409;
      throw err;
    }
    updateApplication(row.id, { status: 'VOID' });
    writeAudit({
      actorId: req.person.id,
      action: 'withdraw',
      entity: 'application',
      entityId: row.id,
      next: { status: 'VOID' }
    });
    // liveOverlaps() ignores VOID rows, so the days are free to be typed again.
    res.json({ application: publicApp(applicationById(row.id)) });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/applications/:id/submit', (req, res) => {
  try {
    const row = applicationById(req.params.id);
    if (!row || !visibleJob(req, row.job_id)) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (!canFile(req.person)) {
      const err = new Error('Only the filer roles can submit');
      err.status = 403;
      throw err;
    }
    refuseOffNorthlineWrite(req.person, jobById(row.job_id));
    if (req.person.account_status === 'ON_HOLD') {
      const err = new Error('An on-hold company cannot leave pencil');
      err.status = 409;
      throw err;
    }
    if (row.status !== 'PENCIL') {
      const err = new Error('Only a pencil paper can be submitted');
      err.status = 409;
      throw err;
    }
    updateApplication(row.id, { status: 'SUBMITTED' });
    writeAudit({ actorId: req.person.id, action: 'submit', entity: 'application', entityId: row.id });
    res.json({ application: publicApp(applicationById(row.id)) });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/applications/:id/certify', async (req, res) => {
  try {
    if (req.person.role !== 'architect') {
      const err = new Error('Only the architect of record can certify');
      err.status = 403;
      throw err;
    }
    const row = applicationById(req.params.id);
    if (!row || !visibleJob(req, row.job_id)) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (row.status !== 'SUBMITTED') {
      const err = new Error('Only a submitted paper can be certified');
      err.status = 409;
      throw err;
    }
    const job = jobById(row.job_id);
    const quote = await composeQuote(job, row.period_start, row.period_end);
    const proposed = req.body?.net_cents == null ? quote.net_cents : Number(req.body.net_cents);
    await vendorJson('POST', '/architect/stamp', {
      body: {
        application_id: row.id,
        proposed_net_cents: proposed,
        composed_net_cents: quote.net_cents
      }
    });
    withTx(() => {
      updateApplication(row.id, {
        status: 'CERTIFIED',
        certified_by: req.person.id,
        net_cents: quote.net_cents,
        wip_cents: quote.wip_cents,
        new_stored_cents: quote.new_stored_cents,
        converted_cents: quote.converted_cents,
        fee_cents: quote.fee_cents,
        bond_cents: quote.bond_cents,
        tax_cents: quote.tax_cents,
        fringe_cents: quote.fringe_cents,
        retainage_cents: quote.retainage_cents,
        ld_cents: quote.ld_cents,
        payees: JSON.stringify(quote.payees)
      });
      db.prepare(`INSERT INTO local_waivers (application_id, kind, status) VALUES (?, 'conditional', 'ISSUED')`).run(row.id);
      writeAudit({ actorId: req.person.id, action: 'certify', entity: 'application', entityId: row.id, next: { net_cents: quote.net_cents } });
    });
    res.json({ application: publicApp(applicationById(row.id)) });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/applications/:id/release', (req, res) => {
  try {
    if (req.person.role !== 'owner_ap') {
      const err = new Error('Only owner AP can release a paper to the rail');
      err.status = 403;
      throw err;
    }
    const row = applicationById(req.params.id);
    if (!row || !visibleJob(req, row.job_id)) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (row.status !== 'CERTIFIED') {
      const err = new Error('Only a certified paper can be released to the rail');
      err.status = 409;
      throw err;
    }
    updateApplication(row.id, { status: 'RELEASED_TO_RAIL', released_by: req.person.id });
    writeAudit({ actorId: req.person.id, action: 'release', entity: 'application', entityId: row.id });
    res.json({ application: publicApp(applicationById(row.id)) });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/applications/:id/checkout', async (req, res) => {
  try {
    if (req.person.role !== 'gc_pm') {
      const err = new Error('Only the GC project manager can send a certified paper to the card desk');
      err.status = 403;
      throw err;
    }
    if (req.person.account_status === 'ON_HOLD') {
      const err = new Error('An on-hold identity cannot pay');
      err.status = 409;
      throw err;
    }
    const row = applicationById(req.params.id);
    if (!row || !visibleJob(req, row.job_id)) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (row.status !== 'RELEASED_TO_RAIL') {
      const err = new Error('The card desk only takes a paper released to the rail');
      err.status = 409;
      throw err;
    }
    if (row.status === 'PAID_POSTED') {
      const err = new Error('This paper is already posted');
      err.status = 409;
      throw err;
    }
    const job = jobById(row.job_id);
    const quote = await composeQuote(job, row.period_start, row.period_end);
    if (quote.net_cents <= 0) {
      const err = new Error('Composed net is not payable at the card desk');
      err.status = 409;
      throw err;
    }
    const clientNet = req.body?.net_cents;
    if (clientNet != null && Number(clientNet) !== quote.net_cents) {
      // ignored: the card desk is asked for the composed net
    }
    const session = await vendorJson('POST', '/card/sessions', {
      body: {
        amount_cents: quote.net_cents,
        currency: 'usd',
        reference: `${job.short_name} ${row.number}`,
        description: `Payees: ${(quote.payees || []).join('; ')}`,
        customer_email: req.person.email,
        success_url: `${baseUrl}/?session_id={CARD_SESSION_ID}`,
        cancel_url: `${baseUrl}/?canceled=1`,
        metadata: {
          application_id: row.id,
          payees: (quote.payees || []).join('; ')
        }
      }
    });
    writeAudit({ actorId: req.person.id, action: 'checkout_quote', entity: 'application', entityId: row.id, next: { session: session.id, net_cents: quote.net_cents } });
    res.json({ url: session.url, session_id: session.id, amount_cents: quote.net_cents, amount_label: dollars(quote.net_cents) });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/applications/confirm', async (req, res) => {
  try {
    const sessionId = String(req.body?.session_id || '').trim();
    if (!sessionId) {
      const err = new Error('session_id is required');
      err.status = 400;
      throw err;
    }
    const existing = applicationBySession(sessionId);
    if (existing) {
      return res.json({ application: publicApp(existing), idempotent: true });
    }
    let session;
    try {
      session = await vendorJson('GET', `/card/sessions/${encodeURIComponent(sessionId)}`);
    } catch {
      const err = new Error('The card desk does not recognize that session');
      err.status = 400;
      throw err;
    }
    if (session.payment_status !== 'paid') {
      const err = new Error('The card desk has not taken that payment');
      err.status = 409;
      throw err;
    }
    const applicationId = session.metadata?.application_id;
    const row = applicationId ? applicationById(applicationId) : null;
    if (!row || !visibleJob(req, row.job_id)) {
      const err = new Error('Application not found for that session');
      err.status = 404;
      throw err;
    }
    if (row.status === 'PAID_POSTED') {
      return res.json({ application: publicApp(row), idempotent: true });
    }
    if (row.status !== 'RELEASED_TO_RAIL') {
      const err = new Error('This paper is not on the rail');
      err.status = 409;
      throw err;
    }
    const job = jobById(row.job_id);
    const quote = await composeQuote(job, row.period_start, row.period_end);
    if (quote.net_cents <= 0) {
      const err = new Error('Composed net is not payable at the card desk');
      err.status = 409;
      throw err;
    }
    if (Number(session.amount_cents) !== quote.net_cents) {
      const err = new Error('Paid amount does not match the composed net');
      err.status = 409;
      throw err;
    }
    const filer = personById(row.filed_by);
    await postPaidVendors({ application: row, quote, person: filer });
    const cal = ical({ name: 'DrawBill pay period' });
    cal.createEvent({
      start: new Date(`${row.period_start}T00:00:00Z`),
      end: new Date(`${row.period_end}T23:59:59Z`),
      summary: `${job.short_name} ${row.number}`,
      description: `Posted net ${dollars(quote.net_cents)}`
    });
    withTx(() => {
      db.prepare(`UPDATE local_waivers SET status = 'VOID' WHERE application_id = ? AND kind = 'conditional'`).run(row.id);
      db.prepare(`INSERT INTO local_waivers (application_id, kind, status) VALUES (?, 'unconditional', 'PENDING_NOTARY')`).run(row.id);
      db.prepare(`INSERT INTO local_notices (channel, application_id, person_id, total_cents, payload) VALUES ('paper', ?, ?, ?, ?)`).run(row.id, filer?.id || req.person.id, quote.net_cents, JSON.stringify(quote));
      db.prepare(`INSERT INTO local_notices (channel, application_id, person_id, total_cents, payload) VALUES ('sms', ?, ?, ?, ?)`).run(row.id, filer?.id || req.person.id, quote.net_cents, JSON.stringify(quote));
      db.prepare(`INSERT INTO local_notices (channel, application_id, person_id, total_cents, payload) VALUES ('email', ?, ?, ?, ?)`).run(row.id, filer?.id || req.person.id, quote.net_cents, JSON.stringify(quote));
      db.prepare(`INSERT INTO local_diary (application_id, period_start, period_end, ics) VALUES (?, ?, ?, ?)`).run(row.id, row.period_start, row.period_end, cal.toString());
      if (filer?.member) {
        db.prepare(`INSERT INTO local_punches (application_id, person_id) VALUES (?, ?)`).run(row.id, filer.id);
      }
      updateApplication(row.id, {
        status: 'PAID_POSTED',
        card_session_id: sessionId,
        net_cents: quote.net_cents,
        wip_cents: quote.wip_cents,
        new_stored_cents: quote.new_stored_cents,
        converted_cents: quote.converted_cents,
        fee_cents: quote.fee_cents,
        bond_cents: quote.bond_cents,
        tax_cents: quote.tax_cents,
        fringe_cents: quote.fringe_cents,
        retainage_cents: quote.retainage_cents,
        ld_cents: quote.ld_cents,
        payees: JSON.stringify(quote.payees)
      });
      writeAudit({ actorId: req.person.id, action: 'paid_posted', entity: 'application', entityId: row.id, next: { net_cents: quote.net_cents, session: sessionId } });
    });
    res.json({ application: publicApp(applicationById(row.id)) });
  } catch (err) {
    fail(res, err);
  }
});

app.post('/api/applications/:id/notary', (req, res) => {
  try {
    if (req.person.role !== 'notary') {
      const err = new Error('Only the notary can stamp an unconditional waiver');
      err.status = 403;
      throw err;
    }
    const row = applicationById(req.params.id);
    if (!row || !visibleJob(req, row.job_id)) {
      const err = new Error('Application not found');
      err.status = 404;
      throw err;
    }
    if (row.status !== 'PAID_POSTED') {
      const err = new Error('Unconditional waivers wait until the paper is paid and posted');
      err.status = 409;
      throw err;
    }
    db.prepare(`UPDATE local_waivers SET status = 'NOTARIZED' WHERE application_id = ? AND kind = 'unconditional'`).run(row.id);
    writeAudit({ actorId: req.person.id, action: 'notary', entity: 'application', entityId: row.id });
    res.json({ application: publicApp(row) });
  } catch (err) {
    fail(res, err);
  }
});

app.get('/api/quote', async (req, res) => {
  try {
    const job = visibleJob(req, req.query.job_id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    const start = isoDate(req.query.period_start);
    const end = isoDate(req.query.period_end);
    if (!start || !end || start > end) {
      const err = new Error('Period must be calendar days, inclusive on both ends');
      err.status = 400;
      throw err;
    }
    const quote = await composeQuote(job, start, end);
    res.json({
      quote: {
        wip_cents: quote.wip_cents,
        new_stored_cents: quote.new_stored_cents,
        converted_cents: quote.converted_cents,
        fee_cents: quote.fee_cents,
        bond_cents: quote.bond_cents,
        tax_cents: quote.tax_cents,
        fringe_cents: quote.fringe_cents,
        retainage_cents: quote.retainage_cents,
        ld_cents: quote.ld_cents,
        net_cents: quote.net_cents,
        payees: quote.payees,
        net_label: dollars(quote.net_cents),
        wip_label: dollars(quote.wip_cents),
        stored_label: dollars(quote.new_stored_cents),
        converted_label: dollars(quote.converted_cents),
        fee_label: dollars(quote.fee_cents),
        tax_label: dollars(quote.tax_cents),
        fringe_label: dollars(quote.fringe_cents),
        retainage_label: dollars(quote.retainage_cents),
        bond_label: dollars(quote.bond_cents),
        ld_label: dollars(quote.ld_cents)
      }
    });
  } catch (err) {
    fail(res, err);
  }
});

function scopedJobIds(req) {
  return jobsVisibleTo(req.person).map((j) => j.id);
}

app.get('/api/tickets', (req, res) => {
  const ids = scopedJobIds(req);
  if (!ids.length) return res.json({ tickets: [] });
  const rows = db.prepare(`
    SELECT t.*, s.tag, s.description, s.job_id, s.company_id, s.unit_rate_cents
    FROM tickets t JOIN sov_lines s ON s.id = t.sov_line_id
    WHERE s.job_id IN (${ids.map(() => '?').join(',')})
    ORDER BY t.ticket_date, s.tag
  `).all(...ids);
  const filtered = req.person.role === 'sub_pm'
    ? rows.filter((r) => r.company_id === req.person.company_id)
    : rows;
  res.json({
    tickets: filtered.map((t) => ({
      ...t,
      amount_label: t.unit_rate_cents ? dollars(t.qty * t.unit_rate_cents) : null
    }))
  });
});

app.get('/api/change-orders', (req, res) => {
  const ids = scopedJobIds(req);
  if (!ids.length) return res.json({ change_orders: [] });
  const rows = db.prepare(`
    SELECT c.*, s.tag, s.job_id
    FROM change_orders c JOIN sov_lines s ON s.id = c.sov_line_id
    WHERE c.job_id IN (${ids.map(() => '?').join(',')})
    ORDER BY c.number
  `).all(...ids);
  res.json({
    change_orders: rows.map((c) => ({ ...c, amount_label: dollars(c.amount_cents) }))
  });
});

app.get('/api/sub-invoices', (req, res) => {
  const ids = scopedJobIds(req);
  if (!ids.length) return res.json({ sub_invoices: [] });
  const rows = db.prepare(`
    SELECT si.*, s.tag
    FROM sub_invoices si JOIN sov_lines s ON s.id = si.sov_line_id
    WHERE si.job_id IN (${ids.map(() => '?').join(',')})
    ORDER BY si.number
  `).all(...ids);
  const filtered = req.person.role === 'sub_pm'
    ? rows.filter((r) => {
      const line = db.prepare('SELECT company_id FROM sov_lines WHERE id = ?').get(r.sov_line_id);
      return line?.company_id === req.person.company_id;
    })
    : rows;
  res.json({
    sub_invoices: filtered.map((s) => ({ ...s, amount_label: dollars(s.amount_cents) }))
  });
});

app.get('/api/payroll', (req, res) => {
  const ids = scopedJobIds(req);
  if (!ids.length) return res.json({ stamps: [] });
  const rows = db.prepare(`
    SELECT * FROM payroll_stamps
    WHERE job_id IN (${ids.map(() => '?').join(',')})
    ORDER BY stamp_date
  `).all(...ids);
  res.json({ stamps: rows, count: rows.length });
});

app.get('/api/insurance', (req, res) => {
  const ids = scopedJobIds(req);
  if (!ids.length) return res.json({ policies: [] });
  const rows = db.prepare(`
    SELECT * FROM insurance WHERE job_id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);
  res.json({ policies: rows });
});

app.get('/api/inspections', (req, res) => {
  const ids = scopedJobIds(req);
  if (!ids.length) return res.json({ inspections: [] });
  const rows = db.prepare(`
    SELECT * FROM inspections WHERE job_id IN (${ids.map(() => '?').join(',')})
  `).all(...ids);
  res.json({ inspections: rows });
});

app.get('/api/notices', (req, res) => res.json({ notices: noticesFor(req.person).filter((n) => n.channel === 'paper') }));
app.get('/api/sms', (req, res) => res.json({ sms: noticesFor(req.person).filter((n) => n.channel === 'sms') }));
app.get('/api/emails', (req, res) => res.json({ emails: noticesFor(req.person).filter((n) => n.channel === 'email') }));
app.get('/api/waivers', (req, res) => res.json({ waivers: waiversFor(req.person) }));
app.get('/api/punches', (req, res) => res.json({ punches: punchesFor(req.person) }));
app.get('/api/diary', (req, res) => res.json({ diary: diaryFor(req.person) }));
app.get('/api/audit', (req, res) => res.json({ audit: auditEntries(req.person) }));

app.listen(port, '0.0.0.0', () => {
  process.stdout.write(`DrawBill listening on ${port} (${baseUrl})\n`);
});
