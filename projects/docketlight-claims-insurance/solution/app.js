const root = document.querySelector('#app');
const state = {
  user: null, claims: [], policies: [], users: [], ledger: [], audit: [],
  selectedId: null, view: 'desk', message: '', error: ''
};

const esc = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
})[char]);
const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD'
}).format(Number(value || 0) / 100);
const roleName = (value) => ({
  INTAKE: 'Intake specialist', ADJUSTER: 'Adjuster', SUPERVISOR: 'Claims supervisor',
  FINANCE: 'Finance controller', ADMIN: 'Administrator'
})[value] || value;
const paymentField = (payment, camel, snake) => payment?.[camel] ?? payment?.[snake] ?? null;
function detailText(value) {
  let details = value;
  if (typeof value === 'string') {
    try { details = JSON.parse(value); } catch { return value || '—'; }
  }
  if (!details || typeof details !== 'object') return '—';
  const entries = Object.entries(details).filter(([, item]) => item !== null && item !== '');
  return entries.length ? entries.map(([key, item]) => `${key}: ${item}`).join(' · ') : '—';
}

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request refused (${response.status})`);
  return data;
}

function notice() {
  if (!state.message && !state.error) return '';
  const tone = state.error ? 'border-rose-400/40 bg-rose-400/10 text-rose-100' : 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100';
  return `<div class="mb-5 rounded-xl border px-4 py-3 text-sm ${tone}">${esc(state.error || state.message)}</div>`;
}

function statusChip(value) {
  const label = String(value || 'UNKNOWN').replaceAll('_', ' ');
  return `<span class="rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-200">${esc(label)}</span>`;
}

function action(label, name, disabled = false) {
  return `<button data-action="${esc(name)}" ${disabled ? 'disabled' : ''} class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40">${esc(label)}</button>`;
}

function renderLogin() {
  root.innerHTML = `<main class="grid min-h-screen place-items-center p-6"><section class="login-shell grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl"><div class="brand-panel bg-gradient-to-br from-cyan-500/20 via-slate-900 to-indigo-500/20 p-12"><div class="grid h-12 w-12 place-items-center rounded-2xl bg-cyan-300 text-xl font-black text-slate-950">D</div><p class="mt-14 text-sm font-semibold uppercase tracking-[.25em] text-cyan-300">Northstar Mutual</p><h1 class="mt-4 text-5xl font-bold leading-tight">Claims decisions with a defensible trail.</h1><p class="mt-5 text-slate-300">Regional intake, evidence, reserves, and settlement in one desk.</p></div><form id="login-form" class="p-8 md:p-12"><p class="text-sm font-semibold uppercase tracking-[.2em] text-cyan-300">Docketlight Enterprise</p><h2 class="mt-3 text-3xl font-bold">Access your operations desk</h2><label class="mt-9 block text-sm">Work email<input name="email" type="email" required autocomplete="username" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" /></label><label class="mt-5 block text-sm">Password<input name="password" type="password" required autocomplete="current-password" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" /></label><button id="use-ava-demo" type="button" class="mt-4 w-full rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-cyan-200">Use Ava demo credentials</button>${state.message ? `<div role="status" class="mt-4 text-sm text-emerald-300">${esc(state.message)}</div>` : ''}<div role="alert" class="mt-4 min-h-6 text-sm text-rose-300">${esc(state.error)}</div><button class="mt-2 w-full rounded-xl bg-cyan-300 px-4 py-3 font-bold text-slate-950">Continue securely</button></form></section></main>`;
  document.querySelector('#use-ava-demo').addEventListener('click', () => {
    const form = document.querySelector('#login-form');
    form.elements.email.value = 'adjuster.ava@docketlight.test';
    form.elements.password.value = 'password123';
    form.elements.password.focus();
  });
  document.querySelector('#login-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    state.error = '';
    const credentials = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify(credentials) });
      state.message = '';
      await load();
    } catch (error) {
      state.error = error.message;
      renderLogin();
    }
  });
}

function claimActions(claim) {
  if (!claim) return '';
  const buttons = [];
  const role = state.user.role;
  const terminal = claim.status === 'SETTLED';
  const assignedHere = Number(claim.assignedAdjusterId) === Number(state.user.id);
  const payment = claim.payments?.[0];
  if (role === 'INTAKE' && claim.status === 'DRAFT') buttons.push(action('Send into review workflow', 'submit'));
  if (role === 'INTAKE' && !terminal && !payment) buttons.push(action('Revise reported loss', 'amend'));
  if (role === 'SUPERVISOR' && ['SUBMITTED', 'INVESTIGATING', 'READY_FOR_REVIEW'].includes(claim.status)) buttons.push(action(claim.assignedAdjusterId ? 'Reassign regional adjuster' : 'Choose regional adjuster', 'assign'));
  if (role === 'SUPERVISOR' && claim.assignedAdjusterId && ['SUBMITTED', 'INVESTIGATING', 'READY_FOR_REVIEW'].includes(claim.status)) buttons.push(action('Reopen assignment', 'reopen'));
  if (role === 'ADJUSTER' && assignedHere && claim.status === 'SUBMITTED') buttons.push(action('Begin investigation', 'triage'));
  if (role === 'ADJUSTER' && assignedHere && claim.status === 'INVESTIGATING') {
    buttons.push(action('Attach site photo', 'photo'), action('Attach estimate', 'estimate'), action('Send for reserve review', 'ready'));
  }
  if (role === 'ADJUSTER' && assignedHere && claim.status === 'READY_FOR_REVIEW' && !payment) {
    buttons.push(action('Propose reserve', 'reserve'));
    if (claim.reserveApproved && !claim.payments?.length) buttons.push(action('Request settlement payment', 'payment-request'));
  }
  if (role === 'SUPERVISOR' && claim.reserveCents && !claim.reserveSupervisorBy) buttons.push(action('Approve reserve as supervisor', 'reserve-approve'));
  if (role === 'SUPERVISOR' && payment && !paymentField(payment, 'supervisorBy', 'supervisor_by')) buttons.push(action('Approve payment as supervisor', 'payment-approve'));
  if (role === 'FINANCE' && payment && payment.status === 'PENDING') buttons.push(action('Release approved payment', 'payment-release'));
  return buttons.length ? `<div class="mt-5 flex flex-wrap gap-2">${buttons.join('')}</div>` : '<p class="mt-5 text-xs text-slate-500">No workflow action is available to this role in the current state.</p>';
}

function claimDetail(claim) {
  if (!claim) return '<p class="text-sm text-slate-400">No claim is available in this scope.</p>';
  const evidence = claim.evidence || [];
  const reserveHistory = claim.reserveHistory || [];
  const payments = claim.payments || [];
  const ledgerRows = claim.ledger || [];
  const timeline = claim.timeline || [];
  return `<div class="flex items-start justify-between gap-3"><div><p class="text-xs uppercase tracking-[.18em] text-slate-500">Selected matter</p><h2 class="mt-1 text-xl font-bold">${esc(claim.reference)}</h2><p class="mt-1 text-xs text-slate-400">Revision ${esc(claim.revision)} · ${esc(claim.region)}</p></div>${statusChip(claim.status)}</div><dl class="mt-5 grid grid-cols-2 gap-3 text-sm"><div class="rounded-xl bg-slate-950/70 p-3"><dt class="text-xs text-slate-500">Customer</dt><dd class="mt-1 font-semibold">${esc(claim.claimant || claim.policy?.holder)}</dd></div><div class="rounded-xl bg-slate-950/70 p-3"><dt class="text-xs text-slate-500">Policy</dt><dd class="mt-1 font-semibold">${esc(claim.policy?.number)}</dd><dd class="mt-1 text-xs text-slate-400">${esc(claim.policy?.effectiveFrom)} to ${esc(claim.policy?.effectiveTo)}</dd><dd class="mt-1 text-xs text-slate-400">Deductible ${money(claim.policy?.deductibleCents)}</dd><dd class="mt-1 text-xs text-slate-400">Limit ${money(claim.policy?.limitCents)}</dd></div><div class="rounded-xl bg-slate-950/70 p-3"><dt class="text-xs text-slate-500">Date of loss</dt><dd class="mt-1 font-semibold">${esc(claim.lossDate)}</dd></div><div class="rounded-xl bg-slate-950/70 p-3"><dt class="text-xs text-slate-500">Assigned adjuster</dt><dd class="mt-1 font-semibold">${esc(claim.assignedAdjuster || 'Unassigned')}</dd></div><div class="rounded-xl bg-slate-950/70 p-3"><dt class="text-xs text-slate-500">Reported loss</dt><dd class="mt-1 font-semibold">${money(claim.lossCents)}</dd></div><div class="rounded-xl bg-slate-950/70 p-3"><dt class="text-xs text-slate-500">Payable exposure</dt><dd class="mt-1 font-semibold">${money(claim.payableCents)}</dd><dd class="mt-1 text-xs text-slate-500">Reserve ceiling ${money(claim.payableCents)}</dd></div></dl>${claim.medicalNote ? `<section class="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3"><h3 class="text-xs font-bold uppercase tracking-wide text-amber-100">Restricted note</h3><p class="mt-2 text-sm text-amber-50">${esc(claim.medicalNote)}</p></section>` : ''}<section class="mt-5"><h3 class="text-xs font-bold uppercase tracking-wide text-slate-400">Evidence</h3><div class="mt-2 flex flex-wrap gap-2">${evidence.length ? evidence.map((item) => `<span class="rounded-lg bg-slate-800 px-2 py-1 text-xs">${esc(item.type)} · ${esc(item.note || 'recorded')}</span>`).join('') : '<span class="text-sm text-slate-500">No evidence recorded</span>'}</div></section><section class="mt-5"><h3 class="text-xs font-bold uppercase tracking-wide text-slate-400">Reserve and settlement</h3><p class="mt-2 text-sm">Current reserve ${claim.reserveCents ? money(claim.reserveCents) : 'none'} · ${claim.reserveApproved ? 'fully approved' : 'not fully approved'} · payment ${payments.length ? 'requested' : 'not requested'}</p><div class="mt-2 space-y-2">${reserveHistory.map((item) => `<div class="rounded-lg bg-slate-950/60 p-2 text-xs space-y-1 leading-relaxed"><p><span class="text-slate-400">Reserve amount</span> · <span class="font-semibold">${money(item.amount_cents)}</span></p><p><span class="text-slate-400">Status</span> · ${esc(item.status)} · <span class="text-slate-400">Supervisor</span> · ${item.supervisor_by ? 'approved' : 'pending'}</p></div>`).join('') || '<p class="text-sm text-rose-200">No reserve recorded on this claim.</p>'}</div><div class="mt-2 space-y-2">${payments.map((item) => `<div class="rounded-lg bg-slate-950/60 p-2 text-xs space-y-1 leading-relaxed"><p><span class="text-slate-400">Payment amount</span> · <span class="font-semibold">${money(paymentField(item, 'amountCents', 'amount_cents'))}</span> · <span class="text-slate-400">Status</span> · ${esc(item.status)}</p><p><span class="text-slate-400">Retry key</span> · <span class="font-mono">${esc(paymentField(item, 'idempotencyKey', 'idempotency_key') || '—')}</span></p><p><span class="text-slate-400">Supervisor</span> · ${paymentField(item, 'supervisorBy', 'supervisor_by') ? 'approved' : 'pending'} · <span class="text-slate-400">Released</span> · ${paymentField(item, 'releasedBy', 'released_by') ? 'yes' : 'no'}</p></div>`).join('') || '<p class="text-sm text-slate-500">No payment requested</p>'}</div><p class="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">Ledger entries</p><div class="mt-2 space-y-2">${ledgerRows.map((item) => `<div class="rounded-lg bg-slate-950/60 p-2 text-xs"><span class="font-semibold">${esc(item.direction)}</span> · ${money(item.amount_cents)} · ${esc(item.kind)} · ${esc(item.related_id)} · <span class="text-slate-500">${esc(item.created_at)}</span></div>`).join('') || '<p class="text-sm text-slate-500">No ledger entries for this claim.</p>'}</div></section><section class="mt-5"><h3 class="text-xs font-bold uppercase tracking-wide text-slate-400">Claim timeline</h3><div class="mt-2 space-y-2">${timeline.length ? timeline.map((item) => `<div class="rounded-lg bg-slate-950/60 p-2 text-xs space-y-1 leading-relaxed"><p><span class="font-semibold">${esc(item.action)}</span> · <span class="text-slate-400">Revision</span> ${esc(item.revision)} · <span class="text-slate-400">Actor</span> ${esc(item.actor_email || 'System')}</p><p class="text-slate-500"><span class="text-slate-400">Time</span> · ${esc(item.created_at)} · <span class="text-slate-400">Details</span> · ${esc(detailText(item.details))}</p></div>`).join('') : '<p class="text-sm text-slate-500">No recorded activity yet.</p>'}</div></section>${claim.medicalNote ? '' : `<p class="mt-5 text-xs text-slate-500">Restricted medical detail is not available to this account.</p>`}${claimActions(claim)}`;
}

function deskView() {
  const selected = state.claims.find((item) => item.id === state.selectedId) || state.claims[0];
  const open = state.claims.filter((item) => item.status !== 'SETTLED').length;
  const exposure = state.claims.reduce((sum, item) => sum + Number(item.payableCents || 0), 0);
  return `<section><header class="flex flex-wrap items-start justify-between gap-4"><div><p class="text-sm font-semibold uppercase tracking-[.2em] text-cyan-300">Claims operations</p><h1 class="mt-1 text-3xl font-bold">Regional control desk</h1><p class="mt-2 text-sm text-slate-400">${esc(roleName(state.user.role))} · ${esc(state.user.region)}</p></div>${state.user.role === 'INTAKE' ? '<button data-view="new-claim" class="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-cyan-200 hover:border-cyan-400">Open a new claim</button>' : ''}</header><div class="mt-7 grid gap-4 sm:grid-cols-3"><article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p class="text-sm text-slate-400">Visible matters</p><p class="mt-2 text-3xl font-bold">${state.claims.length}</p></article><article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p class="text-sm text-slate-400">Open workload</p><p class="mt-2 text-3xl font-bold">${open}</p></article><article class="rounded-2xl border border-slate-800 bg-slate-900 p-5"><p class="text-sm text-slate-400">Visible payable exposure</p><p class="mt-2 text-3xl font-bold">${money(exposure)}</p></article></div><div class="mt-7 grid gap-6 xl:grid-cols-[1.05fr_1fr]"><section class="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"><div class="flex items-center justify-between border-b border-slate-800 p-4"><div><h2 class="font-bold">Claim queue</h2><p class="text-xs text-slate-500">Only records allowed for this account</p></div>${action('Reload', 'refresh')}</div><div class="overflow-auto"><table class="w-full min-w-[560px] text-left text-sm"><thead class="bg-slate-950/50 text-xs uppercase text-slate-500"><tr><th class="px-4 py-3">Reference</th><th class="px-4 py-3">Region</th><th class="px-4 py-3">Payable</th><th class="px-4 py-3">State</th></tr></thead><tbody>${state.claims.map((claim) => `<tr data-claim-id="${esc(claim.id)}" tabindex="0" role="button" aria-label="Open claim ${esc(claim.reference)}" class="cursor-pointer border-t border-slate-800 hover:bg-slate-800/50"><td class="px-4 py-3 font-semibold">${esc(claim.reference)}</td><td class="px-4 py-3">${esc(claim.region)}</td><td class="px-4 py-3">${money(claim.payableCents)}</td><td class="px-4 py-3">${statusChip(claim.status)}</td></tr>`).join('')}</tbody></table></div></section><aside class="rounded-2xl border border-slate-800 bg-slate-900 p-5">${claimDetail(selected)}</aside></div></section>`;
}

function ledgerView() {
  if (!['FINANCE', 'ADMIN'].includes(state.user.role)) return '<section class="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6"><h1 class="text-2xl font-bold">Financial history is restricted</h1><p class="mt-2 text-sm">This account may continue its claim work but cannot inspect organisation-wide entries.</p></section>';
  return `<section><h1 class="text-3xl font-bold">Payment history</h1><p class="mt-2 text-sm text-slate-400">Immutable ledger debits from released payments.</p><div class="mt-6 overflow-auto rounded-2xl border border-slate-800 bg-slate-900"><table class="w-full min-w-[760px] text-left text-sm"><thead class="bg-slate-950/50 text-xs uppercase text-slate-500"><tr><th class="p-3">Claim</th><th class="p-3">Direction</th><th class="p-3">Amount</th><th class="p-3">Kind</th><th class="p-3">Related record</th><th class="p-3">Time</th></tr></thead><tbody>${state.ledger.map((item) => `<tr class="border-t border-slate-800"><td class="p-3 font-semibold">${esc(item.claim_reference || item.claim_id)}</td><td class="p-3">${esc(item.direction)}</td><td class="p-3">${money(item.amount_cents)}</td><td class="p-3">${esc(item.kind)}</td><td class="p-3 font-mono text-xs">${esc(item.related_id)}</td><td class="p-3 text-xs">${esc(item.created_at)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function auditView() {
  if (state.user.role !== 'ADMIN') return '<section class="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6"><h1 class="text-2xl font-bold">Governance records are restricted</h1><p class="mt-2 text-sm">Only administrators may inspect the organisation-wide history.</p></section>';
  return `<section><h1 class="text-3xl font-bold">Governance event history</h1><p class="mt-2 text-sm text-slate-400">Append-only evidence for controlled operations.</p><div class="mt-6 overflow-auto rounded-2xl border border-slate-800 bg-slate-900"><table class="w-full min-w-[980px] text-left text-sm"><thead class="bg-slate-950/50 text-xs uppercase text-slate-500"><tr><th class="p-3">Time</th><th class="p-3">Actor</th><th class="p-3">Event</th><th class="p-3">Affected record</th><th class="p-3">Revision</th><th class="p-3">Material details</th></tr></thead><tbody>${state.audit.map((item) => `<tr class="border-t border-slate-800"><td class="p-3 text-xs">${esc(item.created_at)}</td><td class="p-3">${esc(item.actor_email || 'System')}</td><td class="p-3 font-semibold">${esc(item.action)}</td><td class="p-3">${esc(item.entity)} · ${esc(item.entity_id)}</td><td class="p-3">${esc(item.revision)}</td><td class="p-3 text-xs">${esc(detailText(item.details))}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function usersView() {
  if (state.user.role !== 'ADMIN') return '<section class="rounded-2xl border border-amber-400/30 bg-amber-400/10 p-6"><h1 class="text-2xl font-bold">Account administration is restricted</h1></section>';
  return `<section><h1 class="text-3xl font-bold">Account status control</h1><p class="mt-2 text-sm text-slate-400">Suspending revokes open sessions immediately and blocks new sign-ins until access is restored.</p><div class="mt-6 grid gap-3 md:grid-cols-2">${state.users.map((user) => `<article class="rounded-2xl border border-slate-800 bg-slate-900 p-4"><p class="font-semibold">${esc(user.email)}</p><p class="mt-1 text-xs text-slate-400">${esc(roleName(user.role))} · ${esc(user.region)} · ${esc(user.status)}</p>${user.status === 'ACTIVE' ? `<button data-action="suspend" data-user-id="${esc(user.id)}" class="mt-3 rounded-lg border border-rose-400/40 px-3 py-2 text-xs font-semibold text-rose-200">Suspend this account</button>` : `<button data-action="reactivate" data-user-id="${esc(user.id)}" class="mt-3 rounded-lg border border-emerald-400/40 px-3 py-2 text-xs font-semibold text-emerald-200">Restore access</button>`}</article>`).join('')}</div></section>`;
}

function newClaimView() {
  if (state.user.role !== 'INTAKE') return deskView();
  const options = state.policies.length
    ? state.policies.map((policy) => `<option value="${esc(policy.number)}">${esc(policy.number)} — ${esc(policy.holder)}</option>`).join('')
    : '<option value="">No policy is available in your region</option>';
  return `<section class="mx-auto max-w-2xl"><header class="flex items-start justify-between gap-4"><div><h1 class="text-3xl font-bold">Open a new claim</h1><p class="mt-2 text-sm text-slate-400">Record a new NORTH draft against one of the policies in your region.</p></div><button data-view="desk" class="rounded-lg border border-slate-700 px-3 py-2 text-sm text-cyan-200 hover:border-cyan-400">Back to the desk</button></header><form id="new-claim-form" class="mt-6 grid gap-5 rounded-2xl border border-slate-800 bg-slate-900 p-6"><label class="block text-sm">External claim reference<input name="reference" required autocomplete="off" placeholder="e.g. DL-NEW-260901" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" /></label><label class="block text-sm">Policy<select name="policyNumber" required class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3">${options}</select></label><label class="block text-sm">Date of loss<input name="lossDate" type="date" required class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" /></label><label class="block text-sm">Reported loss in dollars<input name="loss" type="number" min="0.01" step="0.01" required class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3" /></label><label class="block text-sm">Private note about the insured person (optional)<textarea name="medicalNote" rows="3" class="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3"></textarea></label><div class="flex flex-wrap gap-3"><button type="submit" class="rounded-xl bg-cyan-300 px-5 py-3 text-sm font-bold text-slate-950">Create the claim</button><button type="button" data-view="desk" class="rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-cyan-200">Cancel</button></div></form></section>`;
}

function bindNewClaim() {
  const form = document.querySelector('#new-claim-form');
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    state.error = ''; state.message = '';
    const values = Object.fromEntries(new FormData(form));
    try {
      const policy = state.policies.find((item) => item.number === values.policyNumber);
      if (!policy) throw new Error('That policy is not available to this account');
      const lossCents = Math.round(Number(values.loss) * 100);
      if (!Number.isFinite(lossCents) || lossCents <= 0) throw new Error('Reported loss must be a positive dollar amount');
      const result = await api('/api/claims', {
        method: 'POST',
        body: JSON.stringify({
          reference: String(values.reference || '').trim().toUpperCase(),
          policyId: policy.id,
          claimant: policy.holder,
          lossDate: values.lossDate,
          lossCents,
          medicalNote: String(values.medicalNote || '').trim()
        })
      });
      state.selectedId = result.claim.id;
      state.view = 'desk';
      state.message = 'The claim was created and persisted.';
    } catch (error) {
      state.error = error.message;
      state.view = 'new-claim';
    }
    await load();
  });
}

function render() {
  if (!state.user) return renderLogin();
  const views = { desk: deskView, ledger: ledgerView, audit: auditView, users: usersView, 'new-claim': newClaimView };
  root.innerHTML = `<div class="app-shell min-h-screen md:flex"><aside class="border-b border-slate-800 bg-slate-900/90 p-5 md:min-h-screen md:w-64 md:border-b-0 md:border-r"><div class="flex items-center gap-3"><div class="grid h-10 w-10 place-items-center rounded-xl bg-cyan-300 font-black text-slate-950">D</div><div><p class="font-bold">Docketlight</p><p class="text-xs text-slate-400">Northstar Mutual</p></div></div><nav aria-label="Primary" class="mt-9 grid gap-2 text-left text-sm"><button data-view="desk" class="rounded-lg px-3 py-2 text-left hover:bg-slate-800">Operational workspace</button><button data-view="ledger" class="rounded-lg px-3 py-2 text-left hover:bg-slate-800">Financial entries</button><button data-view="audit" class="rounded-lg px-3 py-2 text-left hover:bg-slate-800">Governance history</button>${state.user.role === 'ADMIN' ? '<button data-view="users" class="rounded-lg px-3 py-2 text-left hover:bg-slate-800">Account controls</button>' : ''}</nav><div class="mt-9 rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-xs"><p class="font-semibold">${esc(state.user.name)}</p><p class="mt-1 text-slate-400">${esc(roleName(state.user.role))} · ${esc(state.user.region)}</p><button data-action="logout" class="mt-3 font-semibold text-cyan-300">End session</button></div></aside><main class="flex-1 p-5 md:p-8">${notice()}${(views[state.view] || deskView)()}</main></div>`;
  bind();
  if (state.view === 'new-claim') bindNewClaim();
}

function bind() {
  document.querySelectorAll('[data-view]').forEach((item) => item.addEventListener('click', () => { state.view = item.dataset.view; render(); }));
  document.querySelectorAll('[data-claim-id]').forEach((item) => {
    const openClaim = () => { state.selectedId = item.dataset.claimId; render(); };
    item.addEventListener('click', openClaim);
    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openClaim(); }
    });
  });
  document.querySelectorAll('[data-action]').forEach((item) => item.addEventListener('click', () => perform(item.dataset.action, item.dataset.userId)));
}

async function perform(name, userId) {
  const claim = state.claims.find((item) => item.id === state.selectedId);
  if (!claim) { state.error = 'Select a claim before acting.'; render(); return; }
  state.error = ''; state.message = '';
  try {
    if (name === 'logout') {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch (_) { /* local sign-out still applies */ }
      state.user = null; state.selectedId = null; state.message = 'Signed out: the server ended your session.'; state.error = '';
      return renderLogin();
    }
    if (name === 'refresh') { state.message = 'Reloading from the server…'; render(); await load(); state.message = 'The desk was refreshed from the server.'; render(); return; }
    if (name === 'submit') {
      await api(`/api/claims/${claim.id}/submit`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision }) });
    } else if (name === 'amend') {
      const loss = prompt('Revised loss in dollars', String(claim.lossCents / 100)); if (!loss) return;
      await api(`/api/claims/${claim.id}/amend`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision, lossCents: Math.round(Number(loss) * 100) }) });
    } else if (name === 'assign') {
      const email = prompt('Regional adjuster email', state.users[0]?.email || ''); if (!email) return;
      const adjuster = state.users.find((item) => item.email === email);
      if (!adjuster) throw new Error('That adjuster is not available in this regional directory');
      await api(`/api/claims/${claim.id}/assign`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision, adjusterId: adjuster.id }) });
    } else if (name === 'reopen') {
      await api(`/api/claims/${claim.id}/reopen`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision }) });
    } else if (name === 'triage') {
      await api(`/api/claims/${claim.id}/triage`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision }) });
    } else if (name === 'photo' || name === 'estimate') {
      const type = name.toUpperCase();
      const note = prompt(`${type} evidence note`, `${type} recorded`) || `${type} recorded`;
      await api(`/api/claims/${claim.id}/evidence`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision, type, note }) });
    } else if (name === 'ready') {
      await api(`/api/claims/${claim.id}/ready`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision }) });
    } else if (name === 'reserve') {
      const maxDollars = (claim.payableCents / 100).toFixed(2);
      const amount = prompt(`Reserve for ${claim.reference} in dollars (max ${maxDollars})`); if (!amount) return;
      const amountCents = Math.round(Number(amount) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error('Reserve must be a positive dollar amount');
      if (amountCents > claim.payableCents) throw new Error(`Reserve cannot exceed payable exposure of ${money(claim.payableCents)}`);
      await api(`/api/claims/${claim.id}/reserve`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision, amountCents }) });
    } else if (name === 'reserve-approve') {
      await api(`/api/claims/${claim.id}/reserve-approve`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision }) });
    } else if (name === 'payment-request') {
      const key = prompt('Idempotency key'); if (!key) return;
      const exactDollars = (claim.reserveCents / 100).toFixed(2);
      const proposed = prompt(`Payment amount in dollars (must exactly match approved reserve ${exactDollars})`, exactDollars);
      const amountCents = Math.round(Number(proposed || 0) * 100);
      if (!Number.isFinite(amountCents) || amountCents <= 0) throw new Error('Payment must be a positive dollar amount');
      if (amountCents !== claim.reserveCents) throw new Error(`Payment must exactly match the approved reserve of ${money(claim.reserveCents)}`);
      await api(`/api/claims/${claim.id}/payment-request`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision, idempotencyKey: key, amountCents }) });
    } else if (name === 'payment-approve') {
      const payment = claim.payments[0];
      await api(`/api/payments/${payment.id}/approve`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision }) });
    } else if (name === 'payment-release') {
      const payment = claim.payments[0];
      await api(`/api/payments/${payment.id}/release`, { method: 'POST', body: JSON.stringify({ expectedRevision: claim.revision }) });
    } else if (name === 'suspend') {
      if (!confirm('Suspend this account immediately?')) return;
      await api(`/api/admin/users/${userId}/suspend`, { method: 'POST', body: '{}' });
    } else if (name === 'reactivate') {
      if (!confirm('Restore this account immediately?')) return;
      await api(`/api/admin/users/${userId}/reactivate`, { method: 'POST', body: '{}' });
    }
    state.message = 'The operation completed and persisted.';
    await load();
  } catch (error) {
    state.error = error.message;
    try { await load(); } catch (_) { /* keep local error state */ }
    state.error = error.message;
    render();
  }
}

async function optional(path) {
  try { return await api(path); } catch (_) { return {}; }
}

async function load() {
  try {
    const profile = await api('/api/me');
    state.user = profile.user;
    const [claimData, policyData, userData, ledgerData, auditData] = await Promise.all([
      api('/api/claims'),
      state.user.role === 'INTAKE' ? optional('/api/policies') : Promise.resolve({}),
      ['SUPERVISOR', 'ADMIN'].includes(state.user.role) ? optional('/api/users') : Promise.resolve({}),
      ['FINANCE', 'ADMIN'].includes(state.user.role) ? optional('/api/ledger') : Promise.resolve({}),
      state.user.role === 'ADMIN' ? optional('/api/audit') : Promise.resolve({}),
    ]);
    state.claims = claimData.claims || [];
    state.policies = policyData.policies || [];
    state.users = userData.users || [];
    state.ledger = ledgerData.ledger || [];
    state.audit = auditData.audit || [];
    if (!state.claims.some((item) => item.id === state.selectedId)) state.selectedId = state.claims[0]?.id || null;
    render();
  } catch (_) {
    state.user = null; state.selectedId = null;
    renderLogin();
  }
}

load();
