const root = document.querySelector('#app');

const state = {
  token: localStorage.getItem('oriel-token') || '',
  user: null,
  permits: [],
  parcels: [],
  selectedId: null,
  notice: '',
  error: '',
  showCreate: false,
  audit: null,
};

const money = (cents) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 2,
}).format((Number(cents) || 0) / 100);
const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
})[char]);
const pretty = (value) => String(value ?? '').replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function badge(status) {
  const colors = {
    DRAFT: 'bg-slate-700 text-slate-200', SUBMITTED: 'bg-sky-400/15 text-sky-200',
    PLANS_REVIEW: 'bg-amber-400/15 text-amber-200', PLANS_APPROVED: 'bg-indigo-400/15 text-indigo-200',
    FEE_DUE: 'bg-violet-400/15 text-violet-200', READY_FOR_INSPECTION: 'bg-cyan-400/15 text-cyan-200',
    CORRECTIONS_REQUIRED: 'bg-rose-400/15 text-rose-200', CERTIFIED: 'bg-emerald-400/15 text-emerald-200',
    DENIED: 'bg-slate-700 text-slate-400',
  };
  return `<span class="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${colors[status] || 'bg-slate-700 text-slate-200'}">${esc(pretty(status))}</span>`;
}

function flash() {
  if (!state.notice && !state.error) return '';
  const style = state.error ? 'border-rose-400/30 bg-rose-400/10 text-rose-100' : 'border-emerald-400/30 bg-emerald-400/10 text-emerald-100';
  return `<div role="status" class="mb-5 rounded-xl border px-4 py-3 text-sm ${style}">${esc(state.error || state.notice)}</div>`;
}

function loginScreen() {
  root.innerHTML = `<main class="mx-auto flex min-h-screen max-w-6xl items-center p-5 lg:p-8">
    <section class="grid w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-black/40 md:grid-cols-[1.1fr_.9fr]">
      <div class="hidden min-h-[620px] bg-gradient-to-br from-amber-400/20 via-slate-900 to-cyan-400/10 p-12 md:block">
        <div class="flex items-center gap-3"><span class="grid h-11 w-11 place-items-center rounded-xl bg-amber-300 text-xl font-black text-slate-950">O</span><span class="text-xl font-bold">Oriel Permitworks</span></div>
        <p class="mt-24 text-xs font-bold uppercase tracking-[.26em] text-amber-200">City of Oriel</p>
        <h1 class="mt-4 max-w-lg text-5xl font-bold leading-tight">A trustworthy record from counter to certificate.</h1>
        <p class="mt-6 max-w-md leading-7 text-slate-300">Municipal staff coordinate parcel eligibility, plan review, fees, inspections, and legal release in one durable desk.</p>
      </div>
      <form id="login-form" class="p-8 md:p-12">
        <p class="text-xs font-bold uppercase tracking-[.22em] text-amber-200">Staff access</p>
        <h2 class="mt-3 text-3xl font-bold">Sign in</h2>
        <p class="mt-3 text-sm text-slate-400">Use one of the seeded municipal accounts in the operating notes.</p>
        <label class="mt-8 block text-sm font-semibold">Account directory
          <select id="account-picker" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">
            <option value="">Choose a staff account</option>
            <option value="clerk.nadi@oriel.test">Nadi Ross · Clerk · NORTH</option>
            <option value="clerk.suri@oriel.test">Suri Hale · Clerk · SOUTH</option>
            <option value="review.arden@oriel.test">Arden Vale · Plans reviewer · NORTH</option>
            <option value="review.bela@oriel.test">Bela Moran · Plans reviewer · SOUTH</option>
            <option value="zoning.kael@oriel.test">Kael Drew · Zoning officer · NORTH</option>
            <option value="zoning.iren@oriel.test">Iren Cole · Zoning officer · SOUTH</option>
            <option value="inspector.mira@oriel.test">Mira Chen · Field inspector · NORTH</option>
            <option value="inspector.ren@oriel.test">Ren Moss · Field inspector · SOUTH</option>
            <option value="supervisor.oz@oriel.test">Oz Hart · Permit supervisor · NORTH</option>
            <option value="supervisor.lei@oriel.test">Lei Pratt · Permit supervisor · SOUTH</option>
            <option value="controller.vik@oriel.test">Vik Sato · Finance · ALL</option>
            <option value="admin.elsa@oriel.test">Elsa Rowan · Administrator · ALL</option>
          </select>
        </label>
        <label class="mt-5 block text-sm font-semibold">Work email
          <input name="email" type="email" autocomplete="username" required placeholder="clerk.nadi@oriel.test" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none ring-amber-300 focus:ring-2">
        </label>
        <label class="mt-5 block text-sm font-semibold">Password
          <input name="password" type="password" autocomplete="current-password" required value="password123" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 outline-none ring-amber-300 focus:ring-2">
        </label>
        <div class="mt-4 min-h-10">${flash()}</div>
        <button class="w-full rounded-xl bg-amber-300 px-4 py-3 font-bold text-slate-950 hover:bg-amber-200">Sign in to Permitworks</button>
      </form>
    </section>
  </main>`;
  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault(); state.error = ''; state.notice = '';
    try {
      const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
      state.token = result.token; localStorage.setItem('oriel-token', state.token); await loadDesk();
    } catch (error) { state.error = error.message; loginScreen(); }
  });
  document.querySelector('#account-picker').addEventListener('change', (event) => {
    if (event.currentTarget.value) document.querySelector('[name="email"]').value = event.currentTarget.value;
  });
}

function createPanel() {
  if (!state.showCreate || state.user.role !== 'CLERK') return '';
  return `<form id="create-form" class="mb-6 rounded-2xl border border-amber-300/30 bg-amber-300/5 p-5">
    <div class="flex items-start justify-between gap-4"><div><h2 class="font-bold">New permit application</h2><p class="mt-1 text-sm text-slate-400">Parcel facts set the district, eligible type, fee, and levy.</p></div><button type="button" id="cancel-create" class="text-sm text-slate-300">Cancel</button></div>
    <div class="mt-4 grid gap-4 md:grid-cols-4">
      <label class="text-sm font-medium">Public reference<input name="reference" required placeholder="ORI-N-2026-101" class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"></label>
      <label class="text-sm font-medium">Parcel<select name="parcelId" required class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2">${state.parcels.map((p) => `<option value="${p.id}">${esc(p.number)} · ${esc(p.zone)} · ${esc(pretty(p.allowedType))}</option>`).join('')}</select></label>
      <label class="text-sm font-medium">Applicant<input name="applicant" required value="Oriel Applicant" class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"></label>
      <label class="text-sm font-medium">Valuation (dollars)<input name="valuation" required type="number" min="1" step="0.01" value="12000" class="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"></label>
    </div>
    <button class="mt-4 rounded-lg bg-amber-300 px-4 py-2 text-sm font-bold text-slate-950">Create draft</button>
  </form>`;
}

function actionCard(title, body, controls) {
  return `<section class="rounded-xl border border-slate-700 bg-slate-950/50 p-4"><h3 class="font-semibold">${esc(title)}</h3><p class="mt-1 text-xs leading-5 text-slate-400">${esc(body)}</p><div class="mt-3">${controls}</div></section>`;
}

function actionPanel(p) {
  const u = state.user;
  const cards = [];
  if (u.role === 'CLERK' && p.status === 'DRAFT') {
    cards.push(actionCard('Submit application', 'Send this draft to the district supervisor for reviewer assignment.', `<button data-action="submit" class="action-button primary">Submit draft</button>`));
  }
  if (u.role === 'CLERK' && p.status === 'CORRECTIONS_REQUIRED') {
    cards.push(actionCard('File corrected valuation', 'Resubmitting invalidates stale zoning, fees, waivers, and inspection progress.', `<form data-form="correct" class="flex gap-2"><label class="grow text-xs">Corrected valuation (dollars)<input name="valuation" type="number" min="1" step="0.01" value="${p.valuationCents / 100}" class="field"></label><button class="action-button primary self-end">Apply correction</button></form>`));
  }
  if (u.role === 'CLERK' && p.status === 'FEE_DUE' && !p.receipt) {
    cards.push(actionCard('Request fee waiver', 'A waiver reduces only the permit fee. The statutory levy always remains due.', `<form data-form="waiver" class="flex gap-2"><label class="grow text-xs">Waiver (dollars)<input name="amount" type="number" min="0" step="0.01" value="400" class="field"></label><button class="action-button primary self-end">Request waiver</button></form>`));
  }
  if (u.role === 'SUPERVISOR' && p.status === 'SUBMITTED') {
    const reviewer = u.district === 'NORTH' ? { id: 3, name: 'Arden Vale' } : { id: 4, name: 'Bela Moran' };
    cards.push(actionCard('Assign plans reviewer', 'Assignment is restricted to an in-district plans reviewer.', `<form data-form="assign-reviewer"><label class="text-xs">Reviewer<select name="reviewerId" class="field"><option value="${reviewer.id}">${reviewer.name} · ${u.district}</option></select></label><button class="action-button primary mt-2">Commit assignment</button></form>`));
  }
  if (u.role === 'REVIEWER' && p.status === 'PLANS_REVIEW') {
    cards.push(actionCard('Plans decision', 'Record an approval or return the plans for a documented correction.', `<form data-form="plans"><label class="text-xs">Review note<textarea name="note" class="field" rows="2">Reviewed against the submitted plan set.</textarea></label><div class="mt-2 flex gap-2"><button name="decision" value="APPROVE" class="action-button primary">Approve plans</button><button name="decision" value="CORRECTIONS" class="action-button danger">Require corrections</button></div></form>`));
  }
  if (u.role === 'ZONING' && p.status === 'PLANS_APPROVED') {
    cards.push(actionCard('Zoning determination', 'Confirm stored parcel compatibility and create the official assessment.', `<button data-action="zoning" class="action-button primary">Approve zoning & assess</button>`));
  }
  if (p.status === 'FEE_DUE' && p.waiverCents !== null && !p.waiverApproved && ['SUPERVISOR', 'FINANCE'].includes(u.role)) {
    const next = p.waiverCents > 50000 && u.role === 'SUPERVISOR' ? 'Finance approval will still be required.' : 'This approval may make the waiver operative.';
    cards.push(actionCard('Review waiver request', `${money(p.waiverCents)} requested. ${next}`, `<button data-action="approve-waiver" class="action-button primary">Approve waiver</button>`));
  }
  if (u.role === 'FINANCE' && p.status === 'FEE_DUE' && p.assessment && !p.receipt) {
    cards.push(actionCard('Record assessment receipt', 'Record exactly the outstanding amount; the receipt key makes retries safe.', `<form data-form="receipt"><label class="text-xs">Amount (dollars)<input name="amount" type="number" min="0" step="0.01" value="${p.assessment.dueCents / 100}" class="field"></label><label class="mt-2 block text-xs">Receipt key<input name="key" value="ORI-${p.reference}-01" class="field"></label><button class="action-button primary mt-2">Record receipt</button></form>`));
  }
  if (u.role === 'SUPERVISOR' && p.zoningApproved && p.receipt && !p.assignedInspectorId && !['CERTIFIED', 'DENIED', 'CORRECTIONS_REQUIRED'].includes(p.status)) {
    const inspector = u.district === 'NORTH' ? { id: 7, name: 'Mira Chen' } : { id: 8, name: 'Ren Moss' };
    cards.push(actionCard('Assign field inspector', 'Only a paid, zoning-approved permit may enter field work.', `<form data-form="assign-inspector"><label class="text-xs">Inspector<select name="inspectorId" class="field"><option value="${inspector.id}">${inspector.name} · ${u.district}</option></select></label><button class="action-button primary mt-2">Commit inspector</button></form>`));
  }
  if (u.role === 'INSPECTOR' && p.status === 'READY_FOR_INSPECTION' && p.assignedInspectorId === u.id) {
    const nextType = p.foundationPassed ? 'FINAL' : 'FOUNDATION';
    if (!(nextType === 'FINAL' && p.finalPassed)) {
      cards.push(actionCard(`Schedule ${pretty(nextType)} inspection`, 'The foundation must pass before a final can be scheduled, and active slots cannot overlap.', `<form data-form="schedule"><input type="hidden" name="type" value="${nextType}"><label class="text-xs">Inspection slot<input name="slot" type="datetime-local" required value="2026-09-20T09:00" class="field"></label><button class="action-button primary mt-2">Schedule ${pretty(nextType)}</button></form>`));
    }
    p.inspections.filter((item) => item.status === 'SCHEDULED').forEach((item) => {
      cards.push(actionCard(`${pretty(item.type)} result`, `Scheduled ${new Date(item.slot).toLocaleString()}. Record the actual field outcome.`, `<div class="flex gap-2"><button data-result="PASSED" data-inspection="${esc(item.id)}" class="action-button primary">Pass inspection</button><button data-result="FAILED" data-inspection="${esc(item.id)}" class="action-button danger">Fail inspection</button></div>`));
    });
  }
  if (u.role === 'SUPERVISOR' && p.zoningApproved && p.receipt && p.foundationPassed && p.finalPassed && !p.certificate) {
    cards.push(actionCard('Issue certificate', 'All fee, zoning, and field gates are complete. Certificate issuance is final and idempotent.', `<button data-action="certificate" class="action-button primary">Issue certificate</button>`));
  }
  if (!cards.length) return `<div class="rounded-xl border border-slate-800 bg-slate-950/40 p-4 text-sm text-slate-400">No workflow action is available to this role in the permit's current state.</div>`;
  return `<div class="grid gap-3">${cards.join('')}</div>`;
}

function permitDetail(p) {
  if (!p) return `<aside class="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-sm text-slate-400">No permit is visible for this account.</aside>`;
  const inspections = p.inspections.length ? p.inspections.map((item) => `<li class="flex items-center justify-between gap-3 rounded-lg bg-slate-950/60 px-3 py-2"><span>${esc(pretty(item.type))} · ${esc(new Date(item.slot).toLocaleString())}</span>${badge(item.status)}</li>`).join('') : '<li class="text-sm text-slate-500">No inspections recorded.</li>';
  const note = p.planNote ? `<p class="mt-2 rounded-lg border border-amber-300/20 bg-amber-300/5 p-3 text-sm text-amber-100">${esc(p.planNote)}</p>` : `<p class="mt-2 text-sm text-slate-500">${p.planNoteRedacted ? 'A restricted reviewer note is redacted for this role.' : 'No reviewer note.'}</p>`;
  return `<aside class="space-y-5 rounded-2xl border border-slate-800 bg-slate-900 p-5 xl:sticky xl:top-5 xl:self-start">
    <div class="flex items-start justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-wider text-slate-500">Permit detail</p><h2 class="mt-1 text-xl font-bold">${esc(p.reference)}</h2><p class="mt-1 text-sm text-slate-400">${esc(p.applicant)}</p></div>${badge(p.status)}</div>
    <dl class="grid grid-cols-2 gap-x-5 gap-y-3 text-sm">
      <div><dt class="text-xs text-slate-500">District</dt><dd class="mt-1 font-medium">${esc(p.district)}</dd></div>
      <div><dt class="text-xs text-slate-500">Revision</dt><dd class="mt-1 font-medium">${p.revision}</dd></div>
      <div><dt class="text-xs text-slate-500">Parcel</dt><dd class="mt-1 font-medium">${esc(p.parcel.number)} · ${esc(p.parcel.zone)}</dd></div>
      <div><dt class="text-xs text-slate-500">Permit type</dt><dd class="mt-1 font-medium">${esc(pretty(p.permitType))}</dd></div>
      <div><dt class="text-xs text-slate-500">Valuation</dt><dd class="mt-1 font-medium">${money(p.valuationCents)}</dd></div>
      <div><dt class="text-xs text-slate-500">Permit fee</dt><dd class="mt-1 font-medium">${money(p.permitFeeCents)}</dd></div>
      <div><dt class="text-xs text-slate-500">Statutory levy</dt><dd class="mt-1 font-medium">${money(p.levyCents)}</dd></div>
      <div><dt class="text-xs text-slate-500">Reviewer</dt><dd class="mt-1 font-medium">${esc(p.assignedReviewer || 'Unassigned')}</dd></div>
      <div><dt class="text-xs text-slate-500">Inspector</dt><dd class="mt-1 font-medium">${esc(p.assignedInspector || 'Unassigned')}</dd></div>
      <div><dt class="text-xs text-slate-500">Zoning</dt><dd class="mt-1 font-medium">${p.zoningApproved ? 'Approved' : 'Not approved'}</dd></div>
    </dl>
    <section class="border-t border-slate-800 pt-4"><h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">Restricted plan note</h3>${note}</section>
    <section class="border-t border-slate-800 pt-4"><h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">Assessment & receipt</h3>${p.assessment ? `<dl class="mt-3 space-y-2 text-sm"><div class="flex justify-between"><dt class="text-slate-400">Assessment due</dt><dd class="font-semibold">${money(p.assessment.dueCents)}</dd></div><div class="flex justify-between"><dt class="text-slate-400">Waiver</dt><dd>${p.waiverCents === null ? 'None' : `${money(p.waiverCents)} · ${p.waiverApproved ? 'approved' : 'pending'}`}</dd></div><div class="flex justify-between"><dt class="text-slate-400">Settlement</dt><dd>${p.receipt ? `${money(p.receipt.amountCents)} received` : 'Outstanding'}</dd></div></dl>` : '<p class="mt-2 text-sm text-slate-500">No assessment yet.</p>'}</section>
    <section class="border-t border-slate-800 pt-4"><h3 class="text-xs font-bold uppercase tracking-wider text-slate-500">Field record</h3><ul class="mt-3 space-y-2">${inspections}</ul><p class="mt-3 text-sm ${p.certificate ? 'text-emerald-200' : 'text-slate-500'}">${p.certificate ? `Certificate issued ${new Date(p.certificate.issuedAt).toLocaleString()}` : 'No certificate issued.'}</p></section>
    <section class="border-t border-slate-800 pt-4"><h3 class="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Available work</h3>${actionPanel(p)}</section>
  </aside>`;
}

function auditPanel() {
  if (state.user.role !== 'ADMIN') return '';
  if (!state.audit) return `<section class="mb-6 rounded-2xl border border-slate-800 bg-slate-900 p-5"><div class="flex items-center justify-between"><div><h2 class="font-bold">Append-only audit evidence</h2><p class="mt-1 text-sm text-slate-400">Review actors, actions, entities, revisions, and timestamps.</p></div><button id="load-audit" class="action-button primary">Load audit</button></div></section>`;
  return `<section class="mb-6 overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><div class="flex items-center justify-between border-b border-slate-800 p-5"><div><h2 class="font-bold">Append-only audit evidence</h2><p class="mt-1 text-sm text-slate-400">${state.audit.length} durable event${state.audit.length === 1 ? '' : 's'}</p></div><button id="load-audit" class="text-sm font-semibold text-amber-200">Refresh</button></div><div class="max-h-72 overflow-auto"><table class="w-full min-w-[780px] text-left text-xs"><thead class="sticky top-0 bg-slate-950 text-slate-400"><tr><th class="px-4 py-3">Time</th><th class="px-4 py-3">Actor</th><th class="px-4 py-3">Action</th><th class="px-4 py-3">Entity</th><th class="px-4 py-3">Revision</th></tr></thead><tbody>${state.audit.map((item) => `<tr class="border-t border-slate-800"><td class="px-4 py-3">${esc(item.created_at)}</td><td class="px-4 py-3">${esc(item.actor_email || 'System')}</td><td class="px-4 py-3 font-semibold">${esc(pretty(item.action))}</td><td class="px-4 py-3">${esc(item.entity)} · ${esc(item.entity_id)}</td><td class="px-4 py-3">${item.revision ?? '—'}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function desk() {
  const selected = state.permits.find((p) => p.id === state.selectedId) || state.permits[0];
  if (selected) state.selectedId = selected.id;
  const open = state.permits.filter((p) => !['CERTIFIED', 'DENIED'].includes(p.status)).length;
  const due = state.permits.reduce((sum, p) => sum + (p.receipt ? 0 : (p.assessment?.dueCents || 0)), 0);
  const corrections = state.permits.filter((p) => p.status === 'CORRECTIONS_REQUIRED').length;
  root.innerHTML = `<div class="min-h-screen lg:flex">
    <aside class="border-b border-slate-800 bg-slate-900 lg:min-h-screen lg:w-72 lg:border-b-0 lg:border-r">
      <div class="p-5 lg:sticky lg:top-0"><div class="flex items-center gap-3"><span class="grid h-10 w-10 place-items-center rounded-xl bg-amber-300 font-black text-slate-950">O</span><div><p class="font-bold">Oriel Permitworks</p><p class="text-xs text-slate-400">Municipal control desk</p></div></div>
      <div class="mt-9 rounded-xl border border-slate-800 bg-slate-950/60 p-4"><p class="font-semibold">${esc(state.user.name)}</p><p class="mt-1 text-xs text-slate-400">${esc(pretty(state.user.role))} · ${esc(state.user.district)}</p><button id="logout" class="mt-4 text-sm font-semibold text-amber-200">Sign out</button></div>
      <div class="mt-5 text-xs leading-5 text-slate-500">Server-scoped district access<br>Versioned lifecycle changes<br>Durable SQLite book of record</div></div>
    </aside>
    <main class="min-w-0 flex-1 p-5 lg:p-8"><header class="flex flex-wrap items-start justify-between gap-4"><div><p class="text-xs font-bold uppercase tracking-[.22em] text-amber-200">City of Oriel · ${esc(state.user.district)}</p><h1 class="mt-2 text-3xl font-bold">Permit operations</h1><p class="mt-1 text-sm text-slate-400">Authenticated workspace for ${esc(pretty(state.user.role))}.</p></div><div class="flex gap-2">${state.user.role === 'CLERK' ? '<button id="toggle-create" class="action-button primary">+ New application</button>' : ''}<button id="refresh" class="action-button secondary">Refresh</button></div></header>
      <div class="mt-5">${flash()}</div>
      ${createPanel()}${auditPanel()}
      <section class="mb-6 grid gap-4 sm:grid-cols-3"><article class="metric"><p>Visible permits</p><strong>${state.permits.length}</strong><span>Authorized queue</span></article><article class="metric"><p>Open work</p><strong>${open}</strong><span>${corrections} requiring corrections</span></article><article class="metric"><p>Outstanding assessments</p><strong>${money(due)}</strong><span>Within visible scope</span></article></section>
      <div class="grid gap-6 xl:grid-cols-[1.25fr_.9fr]"><section class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><div class="border-b border-slate-800 p-5"><h2 class="font-bold">Permit registry</h2><p class="mt-1 text-xs text-slate-400">Select a row to inspect its facts and available role action.</p></div><div class="overflow-auto"><table class="w-full min-w-[760px] text-left text-sm"><thead class="bg-slate-950/60 text-xs uppercase tracking-wide text-slate-400"><tr><th class="px-4 py-3">Reference</th><th class="px-4 py-3">Applicant</th><th class="px-4 py-3">Parcel</th><th class="px-4 py-3">District</th><th class="px-4 py-3">Assessment</th><th class="px-4 py-3">State</th></tr></thead><tbody>${state.permits.map((p) => `<tr data-permit="${esc(p.id)}" class="permit-row cursor-pointer border-t ${p.id === selected?.id ? 'border-amber-300/30 bg-amber-300/5' : 'border-slate-800 hover:bg-slate-800/50'}"><td class="px-4 py-4 font-semibold">${esc(p.reference)}</td><td class="px-4 py-4 text-slate-300">${esc(p.applicant)}</td><td class="px-4 py-4 text-slate-300">${esc(p.parcel.number)}</td><td class="px-4 py-4">${esc(p.district)}</td><td class="px-4 py-4">${p.assessment ? money(p.assessment.dueCents) : 'Not assessed'}</td><td class="px-4 py-4">${badge(p.status)}</td></tr>`).join('')}</tbody></table></div></section>${permitDetail(selected)}</div>
    </main></div>`;
  bindDesk(selected);
}

async function mutate(message, operation) {
  state.notice = ''; state.error = '';
  try { await operation(); state.notice = message; await loadDesk(false); }
  catch (error) { state.error = error.message; desk(); }
}

function bindDesk(p) {
  document.querySelector('#logout').onclick = async () => {
    try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) { /* local cleanup still signs out */ }
    localStorage.removeItem('oriel-token'); Object.assign(state, { token: '', user: null, permits: [], selectedId: null, notice: 'Signed out.', error: '', audit: null }); loginScreen();
  };
  document.querySelector('#refresh').onclick = () => loadDesk(false);
  document.querySelector('#toggle-create')?.addEventListener('click', () => { state.showCreate = !state.showCreate; desk(); });
  document.querySelector('#cancel-create')?.addEventListener('click', () => { state.showCreate = false; desk(); });
  document.querySelectorAll('[data-permit]').forEach((row) => row.addEventListener('click', () => { state.selectedId = row.dataset.permit; state.error = ''; state.notice = ''; desk(); }));
  document.querySelector('#load-audit')?.addEventListener('click', async () => { try { state.audit = (await api('/api/audit')).audit; state.notice = 'Audit evidence loaded.'; desk(); } catch (error) { state.error = error.message; desk(); } });
  document.querySelector('#create-form')?.addEventListener('submit', async (event) => {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget)); const parcel = state.parcels.find((item) => String(item.id) === values.parcelId);
    await mutate('Draft application created.', async () => { const { permit } = await api('/api/permits', { method: 'POST', body: JSON.stringify({ reference: values.reference, parcelId: Number(values.parcelId), permitType: parcel.allowedType, applicant: values.applicant, valuationCents: Math.round(Number(values.valuation) * 100) }) }); state.selectedId = permit.id; state.showCreate = false; });
  });
  if (!p) return;
  const post = (path, body = {}) => api(path, { method: 'POST', body: JSON.stringify({ ...body, expectedRevision: p.revision }) });
  document.querySelector('[data-action="submit"]')?.addEventListener('click', () => mutate('Application submitted.', () => post(`/api/permits/${p.id}/submit`)));
  document.querySelector('[data-action="zoning"]')?.addEventListener('click', () => mutate('Zoning approved and assessment created.', () => post(`/api/permits/${p.id}/zoning-approve`)));
  document.querySelector('[data-action="approve-waiver"]')?.addEventListener('click', () => mutate('Waiver approval recorded.', () => post(`/api/permits/${p.id}/waiver-approve`)));
  document.querySelector('[data-action="certificate"]')?.addEventListener('click', () => mutate('Certificate issued.', () => post(`/api/permits/${p.id}/certificate`)));
  document.querySelector('[data-form="correct"]')?.addEventListener('submit', (event) => { event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget)); mutate('Correction filed and downstream work reset.', () => post(`/api/permits/${p.id}/correct`, { valuationCents: Math.round(Number(v.valuation) * 100) })); });
  document.querySelector('[data-form="waiver"]')?.addEventListener('submit', (event) => { event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget)); mutate('Waiver request recorded.', () => post(`/api/permits/${p.id}/waiver`, { amountCents: Math.round(Number(v.amount) * 100) })); });
  document.querySelector('[data-form="assign-reviewer"]')?.addEventListener('submit', (event) => { event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget)); mutate('Reviewer assignment committed.', () => post(`/api/permits/${p.id}/assign-reviewer`, { reviewerId: Number(v.reviewerId) })); });
  document.querySelector('[data-form="plans"]')?.addEventListener('submit', (event) => { event.preventDefault(); const button = event.submitter; const v = Object.fromEntries(new FormData(event.currentTarget)); const decision = button?.value || 'APPROVE'; mutate(decision === 'APPROVE' ? 'Plans approved.' : 'Corrections required.', () => post(`/api/permits/${p.id}/plans-review`, { decision, note: v.note })); });
  document.querySelector('[data-form="receipt"]')?.addEventListener('submit', (event) => { event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget)); mutate('Assessment receipt recorded.', () => api(`/api/assessments/${p.assessment.id}/receipts`, { method: 'POST', body: JSON.stringify({ amountCents: Math.round(Number(v.amount) * 100), receiptKey: v.key }) })); });
  document.querySelector('[data-form="assign-inspector"]')?.addEventListener('submit', (event) => { event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget)); mutate('Inspector assignment committed.', () => post(`/api/permits/${p.id}/assign-inspector`, { inspectorId: Number(v.inspectorId) })); });
  document.querySelector('[data-form="schedule"]')?.addEventListener('submit', (event) => { event.preventDefault(); const v = Object.fromEntries(new FormData(event.currentTarget)); mutate(`${pretty(v.type)} inspection scheduled.`, () => post(`/api/permits/${p.id}/inspections`, { type: v.type, slot: new Date(v.slot).toISOString() })); });
  document.querySelectorAll('[data-result]').forEach((button) => button.addEventListener('click', () => mutate(`${pretty(button.dataset.result)} result recorded.`, () => api(`/api/inspections/${button.dataset.inspection}/result`, { method: 'POST', body: JSON.stringify({ result: button.dataset.result, note: 'Recorded through field workspace', expectedRevision: p.revision }) }))));
}

async function loadDesk(clearFlash = true) {
  if (clearFlash) { state.notice = ''; state.error = ''; }
  try {
    const [{ user }, { permits }, { parcels }] = await Promise.all([api('/api/me'), api('/api/permits'), api('/api/parcels')]);
    state.user = user; state.permits = permits; state.parcels = parcels;
    if (state.selectedId && !permits.some((p) => p.id === state.selectedId)) state.selectedId = null;
    desk();
  } catch (_) {
    localStorage.removeItem('oriel-token'); Object.assign(state, { token: '', user: null, permits: [], selectedId: null, error: 'Your session ended. Sign in again.', audit: null }); loginScreen();
  }
}

state.token ? loadDesk() : loginScreen();
