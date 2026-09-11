const DEFAULT_USER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const HARBORVIEW = '10000000-0000-4000-8000-000000000001';
const DOWNTOWN = '10000000-0000-4000-8000-000000000002';
const RIVERWALK = '10000000-0000-4000-8000-000000000003';

let currentUser = null;
let currentView = 'jobs';
let selectedJobId = null;

function userId() {
  return localStorage.getItem('drawbill_demo_user') || DEFAULT_USER;
}

// The active demo user rides in a cookie as well as the header, so a same-origin
// request made from this page is made AS that user even when the caller did not
// add the header itself.
function setUserCookie(id) {
  document.cookie = `drawbill_demo_user=${encodeURIComponent(id)}; path=/; SameSite=Lax`;
}
setUserCookie(userId());

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-User-Id': userId(),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

function showToast(msg) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  root.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('toast-visible'));
  setTimeout(() => toast.remove(), 4200);
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function viewFromHash() {
  const raw = (location.hash || '').replace(/^#/, '');
  if (raw.startsWith('job/')) {
    selectedJobId = raw.slice(4);
    return 'job';
  }
  const view = raw.split('?')[0];
  const allowed = ['jobs', 'papers', 'plant', 'quote', 'notices', 'waivers', 'audit'];
  return allowed.includes(view) ? view : 'jobs';
}

function setView(view) {
  currentView = view;
  const next = `#${view}`;
  if (location.hash !== next) history.replaceState({}, '', next);
}

document.addEventListener('DOMContentLoaded', async () => {
  currentView = viewFromHash();
  document.querySelectorAll('nav [data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setView(btn.getAttribute('data-view'));
      render().catch(showError);
    });
  });
  window.addEventListener('hashchange', () => {
    currentView = viewFromHash();
    render().catch(showError);
  });
  try {
    await loadSession();
    const sessionId = new URLSearchParams(location.search).get('session_id');
    if (sessionId) {
      await api('/api/applications/confirm', { method: 'POST', body: JSON.stringify({ session_id: sessionId }) });
      history.replaceState({}, '', '/#papers');
      showToast('Paper posted from the card desk');
      currentView = 'papers';
    }
    await render();
  } catch (error) {
    showError(error);
  }
});

function showError(error) {
  const main = document.getElementById('main-content');
  if (!main) return;
  main.innerHTML = `<p class="error">${escapeHtml(error.message || error)}</p>`;
}

async function loadSession() {
  const [session, users] = await Promise.all([api('/api/session'), api('/api/demo-users')]);
  currentUser = session.user;
  document.getElementById('current-user').textContent = `${currentUser.full_name} · ${currentUser.role}`;
  const select = document.getElementById('user-switcher');
  select.innerHTML = users.users.map((u) =>
    `<option value="${u.id}" ${u.id === currentUser.id ? 'selected' : ''}>${escapeHtml(u.full_name)} (${escapeHtml(u.role)})</option>`
  ).join('');
  select.onchange = () => {
    localStorage.setItem('drawbill_demo_user', select.value);
    setUserCookie(select.value);
    location.reload();
  };
}

async function render() {
  const main = document.getElementById('main-content');
  if (currentView === 'jobs') main.innerHTML = await viewJobs();
  else if (currentView === 'job') main.innerHTML = await viewJob(selectedJobId);
  else if (currentView === 'papers') main.innerHTML = await viewPapers();
  else if (currentView === 'plant') main.innerHTML = await viewPlant();
  else if (currentView === 'quote') main.innerHTML = await viewQuote();
  else if (currentView === 'notices') main.innerHTML = await viewNotices();
  else if (currentView === 'waivers') main.innerHTML = await viewWaivers();
  else if (currentView === 'audit') main.innerHTML = await viewAudit();
  bindActions();
}

function bindActions() {
  document.querySelectorAll('[data-act]').forEach((btn) => {
    btn.addEventListener('click', () => runAct(btn.getAttribute('data-act'), btn));
  });
  document.querySelectorAll('[data-open-job]').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedJobId = btn.getAttribute('data-open-job');
      currentView = 'job';
      history.replaceState({}, '', `#job/${selectedJobId}`);
      render().catch(showError);
    });
  });
  const quoteBtn = document.getElementById('run-quote');
  if (quoteBtn) {
    quoteBtn.addEventListener('click', async () => {
      const jobId = document.getElementById('quote-job').value;
      const start = document.getElementById('quote-start').value;
      const end = document.getElementById('quote-end').value;
      try {
        const out = await api(`/api/quote?job_id=${encodeURIComponent(jobId)}&period_start=${start}&period_end=${end}`);
        document.getElementById('quote-result').innerHTML = quoteCard(out.quote);
      } catch (err) {
        document.getElementById('quote-result').innerHTML = `<p class="error">${escapeHtml(err.message)}</p>`;
      }
    });
  }
  const fileBtn = document.getElementById('file-custom');
  if (fileBtn) {
    fileBtn.addEventListener('click', async () => {
      try {
        await api('/api/applications', {
          method: 'POST',
          body: JSON.stringify({
            job_id: document.getElementById('file-job').value,
            period_start: document.getElementById('file-start').value,
            period_end: document.getElementById('file-end').value
          })
        });
        showToast('Paper filed');
        setView('papers');
        await render();
      } catch (err) {
        showToast(err.message);
        showError(err);
      }
    });
  }
}

function quoteCard(q) {
  return `<div class="card">
    <h4>Composed net ${escapeHtml(q.net_label)}</h4>
    <table>
      <tr><td>This-period WIP</td><td>${escapeHtml(q.wip_label)}</td></tr>
      <tr><td>New stored</td><td>${escapeHtml(q.stored_label)}</td></tr>
      <tr><td>Converted stored</td><td>${escapeHtml(q.converted_label || '—')}</td></tr>
      <tr><td>Fee</td><td>${escapeHtml(q.fee_label)}</td></tr>
      <tr><td>Bond</td><td>${escapeHtml(q.bond_label)}</td></tr>
      <tr><td>Tax</td><td>${escapeHtml(q.tax_label)}</td></tr>
      <tr><td>Fringe</td><td>${escapeHtml(q.fringe_label)}</td></tr>
      <tr><td>Retainage withheld</td><td>${escapeHtml(q.retainage_label)}</td></tr>
      <tr><td>Liquidated damages</td><td>${escapeHtml(q.ld_label)}</td></tr>
      <tr><td>Payees</td><td>${escapeHtml((q.payees || []).join('; '))}</td></tr>
    </table>
  </div>`;
}

function staffBar() {
  return `<div class="actions">
    <button class="btn" type="button" data-act="file-hv">File Harborview App 2</button>
    <button class="btn ghost" type="button" data-act="withdraw-hv">Withdraw uncertified Harborview pencil</button>
    <button class="btn secondary" type="button" data-act="submit-hv">Submit Harborview App 2</button>
    <button class="btn" type="button" data-act="certify-hv">Certify Harborview App 2</button>
    <button class="btn" type="button" data-act="release-hv">Release Harborview to rail</button>
    <button class="btn" type="button" data-act="pay-hv">Pay Harborview App 2</button>
    <button class="btn ghost" type="button" data-act="quote-hv">Quote Harborview App 2</button>
    <button class="btn secondary" type="button" data-act="file-dt">File Downtown first paper</button>
    <button class="btn ghost" type="button" data-act="withdraw-dt">Withdraw uncertified Downtown pencil</button>
    <button class="btn secondary" type="button" data-act="submit-dt">Submit Downtown first paper</button>
    <button class="btn secondary" type="button" data-act="certify-dt">Certify Downtown first paper</button>
    <button class="btn secondary" type="button" data-act="release-dt">Release Downtown to rail</button>
    <button class="btn secondary" type="button" data-act="pay-dt">Pay Downtown first paper</button>
    <button class="btn danger" type="button" data-act="file-rw">File Riverwalk late paper</button>
    <button class="btn danger" type="button" data-act="submit-rw">Submit Riverwalk late paper</button>
    <button class="btn danger" type="button" data-act="certify-rw">Certify Riverwalk late paper</button>
    <button class="btn danger" type="button" data-act="release-rw">Release Riverwalk to rail</button>
    <button class="btn danger" type="button" data-act="pay-rw">Pay Riverwalk late paper</button>
    <button class="btn secondary" type="button" data-act="notary-hv">Notarize Harborview App 2</button>
  </div>`;
}

async function viewJobs() {
  const { jobs } = await api('/api/jobs');
  const cards = jobs.map((job) => `
    <div class="card">
      <h4>${escapeHtml(job.short_name)}</h4>
      <p class="muted">${escapeHtml(job.county_window)} county · original ${escapeHtml(job.original_contract_label)} · SCD ${escapeHtml(job.scd)}</p>
      <p>Warehouse window ${escapeHtml(job.warehouse_window)} · status ${escapeHtml(job.status)}</p>
      <button class="btn ghost" type="button" data-open-job="${job.id}">Open schedule of values</button>
    </div>`).join('');
  return `
    <p class="eyebrow">Northline billing desk</p>
    <h2>Jobs</h2>
    <p class="muted">A paper is this month minus last posted snapshot. The card desk is a quote until the card clears.</p>
    ${staffBar()}
    <div class="grid">${cards || '<p>No jobs on this identity.</p>'}</div>
    <h3>File a period</h3>
    <div class="card form-row">
      <label class="field">Job
        <select id="file-job" class="form">${jobs.map((j) => `<option value="${j.id}">${escapeHtml(j.short_name)}</option>`).join('')}</select>
      </label>
      <label class="field">Period start <input id="file-start" type="date" value="2030-04-01"></label>
      <label class="field">Period end <input id="file-end" type="date" value="2030-04-30"></label>
      <button class="btn" type="button" id="file-custom">File pay application</button>
    </div>
  `;
}

async function viewJob(jobId) {
  const detail = await api(`/api/jobs/${jobId}`);
  const [tickets, cos] = await Promise.all([api('/api/tickets'), api('/api/change-orders')]);
  const jobTickets = (tickets.tickets || []).filter((t) => t.job_id === jobId);
  const jobCos = (cos.change_orders || []).filter((c) => c.job_id === jobId);
  const lines = detail.lines.map((l) =>
    `<tr><td>${escapeHtml(l.tag)}</td><td>${escapeHtml(l.description)}</td><td>${escapeHtml(l.original_label)}</td><td>${escapeHtml(l.kind)}</td><td>${l.unit_rate_label ? escapeHtml(l.unit_rate_label) : '—'}</td></tr>`
  ).join('');
  const papers = detail.applications.map((a) =>
    `<tr><td>${escapeHtml(a.number)}</td><td>${escapeHtml(a.period_start)} through ${escapeHtml(a.period_end)}</td><td>${escapeHtml(a.status)}</td><td>${a.net_label ? escapeHtml(a.net_label) : '—'}</td></tr>`
  ).join('');
  const ticketRows = jobTickets.map((t) =>
    `<tr><td>${escapeHtml(t.tag)}</td><td>${escapeHtml(t.kind)}</td><td>${t.qty} ${escapeHtml(t.unit || '')}</td><td>${escapeHtml(t.ticket_date)}</td></tr>`
  ).join('');
  const coRows = jobCos.map((c) =>
    `<tr><td>${escapeHtml(c.number)}</td><td>${escapeHtml(c.tag)}</td><td>${escapeHtml(c.status)}</td><td>${escapeHtml(c.amount_label)}</td><td>${escapeHtml(c.executed_on || '—')}</td></tr>`
  ).join('');
  return `
    <p class="eyebrow">${escapeHtml(detail.job.county_window)} county</p>
    <h2>${escapeHtml(detail.job.short_name)}</h2>
    <p class="muted">Original ${escapeHtml(detail.job.original_contract_label)} · SCD ${escapeHtml(detail.job.scd)} · warehouse ${escapeHtml(detail.job.warehouse_window)} · ${escapeHtml(detail.job.status)}</p>
    ${staffBar()}
    <div class="card">
      <h3>Schedule of values</h3>
      <table>
        <thead><tr><th>Line</th><th>Description</th><th>Original</th><th>Type</th><th>Unit rate</th></tr></thead>
        <tbody>${lines}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>Tickets on this job</h3>
      <table>
        <thead><tr><th>Line</th><th>Kind</th><th>Qty</th><th>Date</th></tr></thead>
        <tbody>${ticketRows || '<tr><td colspan="4">None</td></tr>'}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>Change orders on this job</h3>
      <table>
        <thead><tr><th>CO</th><th>Line</th><th>Status</th><th>Amount</th><th>Executed</th></tr></thead>
        <tbody>${coRows || '<tr><td colspan="5">None</td></tr>'}</tbody>
      </table>
    </div>
    <div class="card">
      <h3>Papers on this job</h3>
      <table>
        <thead><tr><th>Paper</th><th>Period</th><th>Status</th><th>Net</th></tr></thead>
        <tbody>${papers || '<tr><td colspan="4">None</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

async function viewPapers() {
  const { applications } = await api('/api/applications');
  const rows = applications.map((a) => `
    <div class="card">
      <strong>${escapeHtml(a.job_short_name)} · ${escapeHtml(a.number)}</strong>
      <div>${escapeHtml(a.period_start)} through ${escapeHtml(a.period_end)} · ${escapeHtml(a.status)}</div>
      <div>${a.net_label ? `Net ${escapeHtml(a.net_label)}` : 'Net not posted yet'}</div>
      ${a.wip_label ? `<table>
        <tr><td>This-period WIP</td><td>${escapeHtml(a.wip_label)}</td></tr>
        <tr><td>New stored</td><td>${escapeHtml(a.stored_label || '—')}</td></tr>
        <tr><td>Converted stored</td><td>${escapeHtml(a.converted_label || '—')}</td></tr>
        <tr><td>Fee</td><td>${escapeHtml(a.fee_label || '—')}</td></tr>
        <tr><td>Bond</td><td>${escapeHtml(a.bond_label || '—')}</td></tr>
        <tr><td>Tax</td><td>${escapeHtml(a.tax_label || '—')}</td></tr>
        <tr><td>Fringe</td><td>${escapeHtml(a.fringe_label || '—')}</td></tr>
        <tr><td>Retainage withheld</td><td>${escapeHtml(a.retainage_label || '—')}</td></tr>
        <tr><td>Liquidated damages</td><td>${escapeHtml(a.ld_label || '—')}</td></tr>
      </table>` : ''}
      <div class="muted">Payees: ${escapeHtml((a.payees || []).join('; ') || '—')}</div>
      ${(a.status === 'PENCIL' || a.status === 'SUBMITTED') ? `<button class="btn ghost" type="button" data-act="withdraw" data-id="${escapeHtml(a.id)}">Withdraw uncertified pencil</button>` : ''}
    </div>`).join('');
  return `<p class="eyebrow">Pay applications</p><h2>Papers</h2>${staffBar()}${rows || '<p class="muted">No papers.</p>'}`;
}

async function viewPlant() {
  const [tickets, cos, subs, payroll, ins, insp] = await Promise.all([
    api('/api/tickets'),
    api('/api/change-orders'),
    api('/api/sub-invoices'),
    api('/api/payroll'),
    api('/api/insurance'),
    api('/api/inspections')
  ]);
  const ticketRows = tickets.tickets.map((t) =>
    `<tr><td>${escapeHtml(t.tag)}</td><td>${escapeHtml(t.kind)}</td><td>${t.qty} ${escapeHtml(t.unit || '')}</td><td>${escapeHtml(t.ticket_date)}</td><td>${t.amount_label ? escapeHtml(t.amount_label) : '—'}</td></tr>`
  ).join('');
  const coRows = cos.change_orders.map((c) =>
    `<tr><td>${escapeHtml(c.number)}</td><td>${escapeHtml(c.tag)}</td><td>${escapeHtml(c.status)}</td><td>${escapeHtml(c.amount_label)}</td><td>${escapeHtml(c.executed_on || '—')}</td></tr>`
  ).join('');
  const subRows = subs.sub_invoices.map((s) =>
    `<tr><td>${escapeHtml(s.number)}</td><td>${escapeHtml(s.tag)}</td><td>${escapeHtml(s.amount_label)}</td><td>${escapeHtml(s.period_start)} through ${escapeHtml(s.period_end)}</td></tr>`
  ).join('');
  const polRows = ins.policies.map((p) =>
    `<tr><td>${escapeHtml(p.kind)}</td><td>${escapeHtml(p.expires_on)}</td></tr>`
  ).join('');
  return `
    <p class="eyebrow">Plant file</p>
    <h2>Tickets, extras, payroll, insurance</h2>
    ${staffBar()}
    <div class="card">
      <h3>Quantity and receiving tickets</h3>
      <table><thead><tr><th>Line</th><th>Kind</th><th>Qty</th><th>Date</th><th>Amount</th></tr></thead><tbody>${ticketRows || '<tr><td colspan="5">None</td></tr>'}</tbody></table>
    </div>
    <div class="card">
      <h3>Change-order registry</h3>
      <table><thead><tr><th>CO</th><th>Line</th><th>Status</th><th>Amount</th><th>Executed</th></tr></thead><tbody>${coRows || '<tr><td colspan="5">None</td></tr>'}</tbody></table>
    </div>
    <div class="card">
      <h3>Sub-invoices</h3>
      <table><thead><tr><th>Number</th><th>Line</th><th>Amount</th><th>Period</th></tr></thead><tbody>${subRows || '<tr><td colspan="4">None</td></tr>'}</tbody></table>
    </div>
    <div class="card">
      <h3>Certified payroll stamps</h3>
      <p>${payroll.count} inclusive days on file.</p>
    </div>
    <div class="card">
      <h3>Insurance</h3>
      <table><thead><tr><th>Kind</th><th>Expires</th></tr></thead><tbody>${polRows || '<tr><td colspan="2">None</td></tr>'}</tbody></table>
    </div>
    <div class="card">
      <h3>Inspections</h3>
      <p>${insp.inspections.map((i) => `${escapeHtml(i.kind)} stamped ${escapeHtml(i.stamped_on)}`).join(' · ') || 'None'}</p>
    </div>
  `;
}

async function viewQuote() {
  const { jobs } = await api('/api/jobs');
  return `
    <p class="eyebrow">Before the card</p>
    <h2>Live quote</h2>
    <p class="muted">The net you will actually be charged, from the plant desks — not the SOV grid sum.</p>
    ${staffBar()}
    <div class="card form-row">
      <label class="field">Job
        <select id="quote-job" class="form">${jobs.map((j) => `<option value="${j.id}" ${j.id === HARBORVIEW ? 'selected' : ''}>${escapeHtml(j.short_name)}</option>`).join('')}</select>
      </label>
      <label class="field">Period start <input id="quote-start" type="date" value="2030-04-01"></label>
      <label class="field">Period end <input id="quote-end" type="date" value="2030-04-30"></label>
      <button class="btn" type="button" id="run-quote">Compose quote</button>
    </div>
    <div id="quote-result"></div>
  `;
}

async function viewNotices() {
  const [notices, sms, emails, diary, punches] = await Promise.all([
    api('/api/notices'), api('/api/sms'), api('/api/emails'), api('/api/diary'), api('/api/punches')
  ]);
  const list = (rows, key) => rows.map((n) =>
    `<div class="card"><div>${escapeHtml(n.channel || key)}</div><div>Total ${n.total_cents != null ? escapeHtml('$' + (n.total_cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })) : '—'}</div></div>`
  ).join('');
  return `
    <p class="eyebrow">After pay</p>
    <h2>Notices, texts, email, diary, punches</h2>
    ${staffBar()}
    <h3>Paper notices</h3>${list(notices.notices, 'paper') || '<p class="muted">None</p>'}
    <h3>SMS</h3>${list(sms.sms, 'sms') || '<p class="muted">None</p>'}
    <h3>Email</h3>${list(emails.emails, 'email') || '<p class="muted">None</p>'}
    <h3>Diary holds</h3>${diary.diary.map((d) => `<div class="card">${escapeHtml(d.period_start)} through ${escapeHtml(d.period_end)}</div>`).join('') || '<p class="muted">None</p>'}
    <h3>Preferred-vendor punches</h3><p>${punches.punches.length} punch(es)</p>
  `;
}

async function viewWaivers() {
  const { waivers } = await api('/api/waivers');
  const rows = waivers.map((w) =>
    `<div class="card">${escapeHtml(w.kind)} · ${escapeHtml(w.status)}</div>`
  ).join('');
  return `<p class="eyebrow">Lien waivers</p><h2>Waivers</h2>${staffBar()}${rows || '<p class="muted">None</p>'}`;
}

async function viewAudit() {
  const { audit } = await api('/api/audit');
  const rows = audit.map((a) =>
    `<tr><td>${escapeHtml(a.action)}</td><td>${escapeHtml(a.entity)}</td><td>${escapeHtml(a.created_at)}</td></tr>`
  ).join('');
  return `<p class="eyebrow">Night auditor</p><h2>Audit trail</h2>
    <table><thead><tr><th>Action</th><th>Entity</th><th>When</th></tr></thead><tbody>${rows || '<tr><td colspan="3">Nothing to read on this identity.</td></tr>'}</tbody></table>`;
}

async function latestOpen(jobId) {
  const { applications } = await api('/api/applications');
  const rows = applications
    .filter((a) => a.job_id === jobId && a.status !== 'PAID_POSTED' && a.status !== 'VOID' && a.status !== 'REJECTED')
    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
  return rows[rows.length - 1];
}

async function runAct(act, btn) {
  try {
    if (act === 'withdraw' || act === 'withdraw-hv' || act === 'withdraw-dt') {
      const id = act === 'withdraw'
        ? btn?.getAttribute('data-id')
        : (await latestOpen(act === 'withdraw-dt' ? DOWNTOWN : HARBORVIEW))?.id;
      await api(`/api/applications/${id}/withdraw`, { method: 'POST', body: '{}' });
      showToast('Pencil withdrawn');
      setView('papers');
    } else if (act === 'file-hv') {
      await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ job_id: HARBORVIEW, period_start: '2030-04-01', period_end: '2030-04-30' })
      });
      showToast('Harborview App 2 filed');
      setView('papers');
    } else if (act === 'submit-hv') {
      const appRow = await latestOpen(HARBORVIEW);
      await api(`/api/applications/${appRow.id}/submit`, { method: 'POST', body: '{}' });
      showToast('Submitted');
    } else if (act === 'certify-hv') {
      const appRow = await latestOpen(HARBORVIEW);
      await api(`/api/applications/${appRow.id}/certify`, { method: 'POST', body: '{}' });
      showToast('Certified');
    } else if (act === 'release-hv') {
      const appRow = await latestOpen(HARBORVIEW);
      await api(`/api/applications/${appRow.id}/release`, { method: 'POST', body: '{}' });
      showToast('Released to rail');
    } else if (act === 'pay-hv') {
      const appRow = await latestOpen(HARBORVIEW);
      const out = await api(`/api/applications/${appRow.id}/checkout`, { method: 'POST', body: '{}' });
      location.href = out.url;
      return;
    } else if (act === 'quote-hv') {
      setView('quote');
      await render();
      document.getElementById('quote-job').value = HARBORVIEW;
      document.getElementById('quote-start').value = '2030-04-01';
      document.getElementById('quote-end').value = '2030-04-30';
      document.getElementById('run-quote').click();
      return;
    } else if (act === 'file-dt') {
      await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ job_id: DOWNTOWN, period_start: '2030-04-01', period_end: '2030-04-30' })
      });
      showToast('Downtown paper filed');
      setView('papers');
    } else if (act === 'submit-dt') {
      const filed = await latestOpen(DOWNTOWN);
      await api(`/api/applications/${filed.id}/submit`, { method: 'POST', body: '{}' });
      showToast('Downtown submitted');
    } else if (act === 'certify-dt') {
      const row = await latestOpen(DOWNTOWN);
      await api(`/api/applications/${row.id}/certify`, { method: 'POST', body: '{}' });
      showToast('Downtown certified');
    } else if (act === 'release-dt') {
      const row = await latestOpen(DOWNTOWN);
      await api(`/api/applications/${row.id}/release`, { method: 'POST', body: '{}' });
      showToast('Downtown released');
    } else if (act === 'pay-dt') {
      const row = await latestOpen(DOWNTOWN);
      const out = await api(`/api/applications/${row.id}/checkout`, { method: 'POST', body: '{}' });
      location.href = out.url;
      return;
    } else if (act === 'file-rw') {
      await api('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ job_id: RIVERWALK, period_start: '2030-04-01', period_end: '2030-04-10' })
      });
      showToast('Riverwalk paper filed');
      setView('papers');
    } else if (act === 'submit-rw') {
      const row = await latestOpen(RIVERWALK);
      await api(`/api/applications/${row.id}/submit`, { method: 'POST', body: '{}' });
      showToast('Riverwalk submitted');
    } else if (act === 'certify-rw') {
      const row = await latestOpen(RIVERWALK);
      await api(`/api/applications/${row.id}/certify`, { method: 'POST', body: '{}' });
      showToast('Riverwalk certified');
    } else if (act === 'release-rw') {
      const row = await latestOpen(RIVERWALK);
      await api(`/api/applications/${row.id}/release`, { method: 'POST', body: '{}' });
      showToast('Riverwalk released');
    } else if (act === 'pay-rw') {
      const appRow = await latestOpen(RIVERWALK);
      const out = await api(`/api/applications/${appRow.id}/checkout`, { method: 'POST', body: '{}' });
      location.href = out.url;
      return;
    } else if (act === 'notary-hv') {
      const { applications } = await api('/api/applications');
      const paid = applications.filter((a) => a.job_id === HARBORVIEW && a.status === 'PAID_POSTED');
      const appRow = paid[paid.length - 1];
      await api(`/api/applications/${appRow.id}/notary`, { method: 'POST', body: '{}' });
      showToast('Notarized');
    }
    await render();
  } catch (err) {
    showToast(err.message);
    const main = document.getElementById('main-content');
    const p = document.createElement('p');
    p.className = 'error';
    p.textContent = err.message;
    main.prepend(p);
  }
}
