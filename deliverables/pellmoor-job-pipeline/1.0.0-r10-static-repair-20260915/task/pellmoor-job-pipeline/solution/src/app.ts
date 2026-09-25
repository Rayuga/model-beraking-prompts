import * as d3 from 'd3';

type Stage = string;
type Person = { email: string; name: string; role: string };
type Score = { panel_member: string; score: number };
type Candidate = {
  id: string; role: string; name: string; stage: Stage; history: Stage[];
  applied_days: number; panel: string[]; scores: Score[]; notes: number; activity: number;
};
type Rung = { stage: Stage; reached: number; still: number; left: number };
type RoleView = {
  role: { code: string; title: string; team: string; openings: number };
  revision: number; funnel: Rung[]; candidates: Candidate[];
  capacity: { reserved: number; filled: number; available: number };
};

const TOKEN_KEY = 'pellmoor_session_v2';
let token = localStorage.getItem(TOKEN_KEY) || '';
let me: Person | null = null;
let stages: Stage[] = [];
let terminal: Stage[] = [];
let view: RoleView | null = null;
let openId: string | null = null;
let returnFocus: HTMLElement | null = null;
let batchSelected: string[] = [];
let batchReview: any = null;
let batchRequest: Record<string, unknown> | null = null;
let batchMessage = '';
let batchBusy = false;
let batchDone = false;

const $ = <T extends HTMLElement = HTMLElement>(selector: string) =>
  document.querySelector(selector) as T;
const esc = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] as string));

function operationId() {
  if (typeof crypto.randomUUID === 'function') {
    return `op_${crypto.randomUUID().replaceAll('-', '')}`;
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `op_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function api(method: string, endpoint: string, body?: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(endpoint, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

function say(message: string, good = false) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.dataset.tone = good ? 'good' : 'bad';
  toast.classList.add('show');
  window.setTimeout(() => toast.classList.remove('show'), 4200);
}

function setBusy(busy: boolean, message = 'Working…') {
  document.body.dataset.busy = String(busy);
  $('#progress').textContent = busy ? message : '';
  document.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    if (!button.closest('#signin')) button.disabled = busy;
  });
}

function drawFunnel(rungs: Rung[]) {
  const host = d3.select('#funnel');
  host.selectAll('*').remove();
  const total = d3.max(rungs, (rung) => rung.reached) ?? 0;
  if (!total) {
    host.append('p').attr('class', 'empty')
      .text('Nobody has applied to this vacancy yet. The funnel will appear after the first application.');
    return;
  }
  const width = (host.node() as HTMLElement).clientWidth || 640;
  const compact = width < 470;
  const rowHeight = compact ? 58 : 48;
  const labelWidth = compact ? 0 : 102;
  const chartWidth = compact ? width : Math.max(110, width - labelWidth - 180);
  const scale = d3.scaleLinear().domain([0, total]).range([0, chartWidth]);
  const svg = host.append('svg')
    .attr('width', '100%').attr('height', rungs.length * rowHeight + 20)
    .attr('viewBox', `0 0 ${width} ${rungs.length * rowHeight + 20}`)
    .attr('role', 'img')
    .attr('aria-label', `Funnel: ${rungs.map((r) => `${r.stage} ${r.reached} reached`).join(', ')}`);
  const groups = svg.selectAll('g.rung').data(rungs).join('g')
    .attr('class', 'rung').attr('transform', (_r, index) => `translate(0,${index * rowHeight + 10})`);
  groups.append('text').attr('class', 'stage-label')
    .attr('x', compact ? 0 : labelWidth - 10).attr('y', compact ? 14 : 20)
    .attr('text-anchor', compact ? 'start' : 'end')
    .text((r) => r.stage);
  groups.append('rect').attr('class', 'reached').attr('x', labelWidth).attr('y', compact ? 24 : 3)
    .attr('height', compact ? 16 : 25).attr('rx', 5).attr('width', (r) => Math.max(2, scale(r.reached)));
  groups.append('rect').attr('class', 'still').attr('x', labelWidth).attr('y', compact ? 24 : 3)
    .attr('height', compact ? 16 : 25).attr('rx', 5).attr('width', (r) => scale(r.still));
  groups.append('text').attr('class', 'figure')
    .attr('x', (r) => compact ? width : labelWidth + Math.max(2, scale(r.reached)) + 8)
    .attr('y', compact ? 14 : 20).attr('text-anchor', compact ? 'end' : 'start')
    .text((r) => `${r.reached} reached · ${r.still} here${r.left ? ` · ${r.left} left` : ''}`);
  groups.append('title').text((r) =>
    `${r.stage}: ${r.reached} reached, ${r.still} here, ${r.left} left here`);
}

function can(action: 'move' | 'add' | 'panel' | 'score' | 'note') {
  if (!me) return false;
  if (action === 'move') return me.role === 'hiring manager';
  if (action === 'add' || action === 'panel') return me.role === 'coordinator';
  if (action === 'score') return me.role === 'panel' || me.role === 'hiring manager';
  return true;
}

function drawBoard(snapshot: RoleView) {
  const columns = [...stages, ...terminal];
  $('#board').innerHTML = columns.map((stage) => {
    const here = snapshot.candidates.filter((candidate) => candidate.stage === stage);
    return `<section class="col${terminal.includes(stage) ? ' terminal' : ''}" aria-label="${esc(stage)} stage">
      <h3>${esc(stage)}<span class="n">${here.length}</span></h3>
      ${here.length ? here.map((candidate) => `<button class="cand" data-id="${candidate.id}">
        <b>${esc(candidate.name)}</b><span class="meta">${candidate.applied_days}d · ${candidate.id}
        ${candidate.scores.length ? ` · ${candidate.scores.length} scored` : ''}
        ${candidate.notes ? ` · ${candidate.notes} notes` : ''}</span></button>`).join('')
        : `<p class="empty-col">${terminal.includes(stage) ? 'nobody' : 'empty'}</p>`}
    </section>`;
  }).join('');
  $('#board').querySelectorAll<HTMLButtonElement>('.cand').forEach((button) => {
    button.onclick = () => {
      returnFocus = button;
      openCandidate(button.dataset.id as string);
    };
  });
}

function applySnapshot(snapshot: RoleView) {
  view = snapshot;
  const summary = document.querySelector<HTMLElement>(`#roles button[data-code="${snapshot.role.code}"] span`);
  if (summary) {
    const live = snapshot.candidates.filter((candidate) => !terminal.includes(candidate.stage)).length;
    summary.textContent = `${live} live · ${snapshot.candidates.length} total · r${snapshot.revision}`;
  }
  $('#role-title').textContent = `${snapshot.role.title} · ${snapshot.role.team}`;
  $('#role-sub').textContent = `${snapshot.role.openings} opening${snapshot.role.openings === 1 ? '' : 's'} · ${snapshot.capacity.reserved} reserved · ${snapshot.capacity.filled} filled · ${snapshot.capacity.available} available · ${snapshot.candidates.length} candidates · revision ${snapshot.revision}`;
  $('#revision').textContent = `r${snapshot.revision}`;
  $('#addcandidate').hidden = !can('add');
  $('#batch-open').hidden = !can('move');
  drawFunnel(snapshot.funnel);
  drawBoard(snapshot);
}

async function loadRole(code: string) {
  if (view?.role.code !== code) resetBatch();
  setBusy(true, 'Loading vacancy…');
  const result = await api('GET', `/api/roles/${encodeURIComponent(code)}`);
  setBusy(false);
  if (!result.ok) return say(result.data.error || 'That vacancy would not load.');
  closeCandidate(false);
  applySnapshot(result.data as RoleView);
}

function closeCandidate(restoreFocus = true) {
  const candidateId = openId;
  openId = null;
  $('#panel').innerHTML = '';
  $('#app').removeAttribute('inert');
  if (restoreFocus) {
    const fallback = candidateId
      ? document.querySelector<HTMLElement>(`.cand[data-id="${candidateId}"]`)
      : null;
    (returnFocus?.isConnected ? returnFocus : fallback)?.focus();
  }
  returnFocus = null;
}

function containDrawerFocus(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault();
    closeCandidate();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = Array.from($('#panel').querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter((element) => element.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function activityText(event: any) {
  const details = event.details || {};
  if (event.kind === 'candidate_created') return `added ${details.name} at applied`;
  if (event.kind === 'stage_changed') return `moved ${details.from} → ${details.to}${details.batch_id ? ` · batch ${details.batch_position}/${details.batch_size} · ${details.batch_id}` : ''}`;
  if (event.kind === 'panel_added') return `added ${details.member} to the panel`;
  if (event.kind === 'panel_removed') return `removed ${details.member} from the panel`;
  if (event.kind === 'score_recorded') return `recorded score ${details.score}`;
  if (event.kind === 'note_added') return 'added a note';
  return event.kind.replaceAll('_', ' ');
}

async function refreshAfterMutation(result: any, candidateId?: string) {
  if (view) {
    const latest = await api('GET', `/api/roles/${encodeURIComponent(view.role.code)}`);
    if (latest.ok) applySnapshot(latest.data);
  }
  if (candidateId) await openCandidate(candidateId);
}

async function mutate(endpoint: string, body: Record<string, unknown>, candidateId?: string) {
  if (!view) return { ok: false, status: 0, data: {} };
  setBusy(true, 'Saving…');
  const result = await api('POST', endpoint, {
    ...body, expected_revision: view.revision, operation_id: operationId(),
  });
  await refreshAfterMutation(result, candidateId);
  setBusy(false);
  if (!result.ok) say(result.data.error || 'That change was refused.');
  return result;
}

async function openCandidate(id: string) {
  const result = await api('GET', `/api/candidates/${encodeURIComponent(id)}`);
  if (!result.ok) {
    closeCandidate(); say(result.data.error || 'Candidate not found.'); return;
  }
  openId = id;
  const { candidate, panel, scores, historical_scores, offer_readiness, notes, activity, people, revision } = result.data;
  if (view) view.revision = revision;
  const next = stages[stages.indexOf(candidate.stage) + 1];
  const previous = stages[stages.indexOf(candidate.stage) - 1];
  const finished = terminal.includes(candidate.stage);
  const score = scores.find((item: Score) => item.panel_member === me?.email)?.score;
  const panelEditable = ['applied', 'screening', 'interview'].includes(candidate.stage);
  const canScore = can('score') && panel.includes(me?.email) && candidate.stage === 'interview';

  $('#panel').innerHTML = `<header><div><p class="eyebrow">${candidate.id}</p>
      <h2>${esc(candidate.name)}</h2></div><button id="close" aria-label="Close candidate">×</button></header>
    <p class="sub">${esc(candidate.stage)}${finished ? ' · terminal' : ''} · applied ${candidate.applied_days} days ago</p>
    <div class="history" aria-label="Stage history">${candidate.history.map((stage: string, index: number) =>
      `<span${stage === candidate.stage && index === candidate.history.length - 1 ? ' aria-current="step"' : ''}>${esc(stage)}</span>`).join('')}</div>
    ${can('move') && !finished ? `<div class="moves">
      ${previous ? `<button data-to="${previous}">Back to ${previous}</button>` : ''}
      ${next ? `<button class="primary" data-to="${next}">Move to ${next}</button>` : ''}
      <button data-to="rejected">Reject</button><button data-to="withdrawn">Withdraw</button></div>` : ''}
    <h3>Panel and scores</h3>
    <p id="assessment-status">Assessment version ${candidate.assessment_version} · ${esc(offer_readiness.reason)}</p>
    ${!panelEditable ? '<p class="empty">Panel and scores are frozen at this stage. Reopen an offered interview to reassess.</p>' : ''}
    ${panel.length ? `<ul class="panel-list">${panel.map((email: string) => {
      const person = people.find((item: Person) => item.email === email);
      const item = scores.find((value: Score) => value.panel_member === email);
      return `<li><span><b>${esc(person?.name || email)}</b><small>${esc(email)}</small></span>
        <strong>${item ? `${item.score}/5` : 'waiting'}</strong>
        ${can('panel') && panelEditable ? `<button class="remove-member" data-member="${esc(email)}" aria-label="Remove ${esc(person?.name || email)} from panel">Remove</button>` : ''}</li>`;
    }).join('')}</ul>` : '<p class="empty">No panel yet.</p>'}
    ${can('panel') && panelEditable && people.some((person: Person) => person.role !== 'coordinator' && !panel.includes(person.email)) ? `<form id="panelform" class="addrow"><label><span>Panel member</span>
      <select id="member">${people.filter((person: Person) => person.role !== 'coordinator' && !panel.includes(person.email))
        .map((person: Person) => `<option value="${esc(person.email)}">${esc(person.name)}</option>`).join('')}</select></label>
      <button>Add to panel</button></form>` : ''}
    ${canScore ? `<form id="scoreform" class="addrow"><label><span>My score</span>
      <select id="score">${[1, 2, 3, 4, 5].map((value) =>
        `<option${score === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label>
      <button>Record score</button></form>` : ''}
    <h3>Historical scores</h3>
    ${historical_scores.length ? `<ul id="historical-scores" class="notes">${historical_scores.map((item: any) =>
      `<li>Version ${item.assessment_version} · ${esc(item.scorer_name)} · ${item.score}/5 · historical</li>`).join('')}</ul>`
      : '<p class="empty">No historical scores. Only the current assessment can authorize an offer.</p>'}
    <h3>Notes</h3>
    ${notes.length ? `<ol class="notes">${notes.map((note: any) =>
      `<li><b>${esc(note.author_name)}</b><time>${esc(note.at)}</time><p>${esc(note.body)}</p></li>`).join('')}</ol>`
      : '<p class="empty">Nothing recorded yet.</p>'}
    <form id="notef" class="addrow"><label><span>New note</span>
      <input id="note" maxlength="1000" placeholder="Add a note; corrections stay in the trail"></label><button>Add note</button></form>
    <h3>Activity</h3>
    ${activity.length ? `<ol class="activity">${activity.map((event: any) =>
      `<li><b>${esc(event.actor_name)}</b> ${esc(activityText(event))}${event.details.assessment_reason ? ` · v${event.details.assessment_version}: ${esc(event.details.assessment_reason)}` : ''}<time>${esc(event.at)}</time></li>`).join('')}</ol>`
      : '<p class="empty">No changes recorded since import.</p>'}`;

  $('#app').setAttribute('inert', '');
  $('#panel').onkeydown = containDrawerFocus;
  $('#close').onclick = () => closeCandidate();
  $('#close').focus();
  $('#panel').querySelectorAll<HTMLButtonElement>('.moves button').forEach((button) => {
    button.onclick = async () => {
      const result = await mutate(`/api/candidates/${id}/stage`, { stage: button.dataset.to }, id);
      if (result.ok) say(`Moved to ${button.dataset.to}.`, true);
    };
  });
  const panelForm = document.querySelector<HTMLFormElement>('#panelform');
  if (panelForm) panelForm.onsubmit = async (event) => {
    event.preventDefault();
    const member = $('#member') as HTMLSelectElement;
    const result = await mutate(`/api/candidates/${id}/panel`, { member: member.value }, id);
    if (result.ok) say('Panel updated.', true);
  };
  const scoreForm = document.querySelector<HTMLFormElement>('#scoreform');
  $('#panel').querySelectorAll<HTMLButtonElement>('.remove-member').forEach((button) => {
    button.onclick = async () => {
      const result = await mutate(`/api/candidates/${id}/panel`, { member: button.dataset.member, action: 'remove' }, id);
      if (result.ok) say('Panel member removed. Fresh scores are required.', true);
    };
  });
  if (scoreForm) scoreForm.onsubmit = async (event) => {
    event.preventDefault();
    const input = $('#score') as HTMLSelectElement;
    const result = await mutate(`/api/candidates/${id}/score`, { score: Number(input.value) }, id);
    if (result.ok) say('Score recorded.', true);
  };
  ($('#notef') as HTMLFormElement).onsubmit = async (event) => {
    event.preventDefault();
    const input = $('#note') as HTMLInputElement;
    const draft = input.value;
    const result = await mutate(`/api/candidates/${id}/notes`, { body: draft }, id);
    if (result.ok) say('Note added.', true);
    else {
      const restored = document.querySelector<HTMLInputElement>('#note');
      if (restored) restored.value = draft;
    }
  };
}

async function loadWorkspace() {
  const result = await api('GET', '/api/roles');
  if (!result.ok) return signOutLocal();
  const list = $('#roles');
  list.innerHTML = result.data.roles.map((role: any) => `<button data-code="${role.code}">
    <b>${esc(role.title)}</b><span>${role.live} live · ${role.total} total · r${role.revision}</span></button>`).join('');
  list.querySelectorAll<HTMLButtonElement>('button').forEach((button) => {
    button.onclick = () => {
      list.querySelectorAll('button').forEach((item) => item.removeAttribute('aria-current'));
      button.setAttribute('aria-current', 'page');
      loadRole(button.dataset.code as string);
    };
  });
  (list.querySelector('button') as HTMLButtonElement | null)?.click();
}

function signOutLocal() {
  resetBatch();
  token = ''; me = null; view = null;
  localStorage.removeItem(TOKEN_KEY);
  closeCandidate(false);
  $('#app').hidden = true;
  $('#signin').hidden = false;
  ($('#email') as HTMLInputElement).focus();
}

async function boot() {
  if (!token) return signOutLocal();
  const result = await api('GET', '/api/me');
  if (!result.ok) return signOutLocal();
  me = result.data.person; stages = result.data.stages; terminal = result.data.terminal;
  $('#whoami').textContent = `${me!.name} · ${me!.role}`;
  $('#signin').hidden = true;
  $('#app').hidden = false;
  await loadWorkspace();
}

($('#loginf') as HTMLFormElement).onsubmit = async (event) => {
  event.preventDefault();
  const email = ($('#email') as HTMLInputElement).value;
  const password = ($('#password') as HTMLInputElement).value;
  const result = await api('POST', '/api/login', { email, password });
  if (!result.ok) return say(result.data.error || 'Sign-in failed.');
  $('#toast').classList.remove('show');
  token = result.data.token;
  localStorage.setItem(TOKEN_KEY, token);
  await boot();
};

($('#addcandidate') as HTMLFormElement).onsubmit = async (event) => {
  event.preventDefault();
  if (!view) return;
  const name = ($('#candidate-name') as HTMLInputElement).value;
  const result = await mutate('/api/candidates', { role: view.role.code, name });
  if (result.ok) {
    ($('#candidate-name') as HTMLInputElement).value = '';
    say('Candidate added at applied.', true);
  }
};

$('#theme').onclick = () => {
  const root = document.documentElement;
  const dark = root.dataset.theme === 'dark';
  root.dataset.theme = dark ? 'light' : 'dark';
  if (view) drawFunnel(view.funnel);
};

$('#signout').onclick = async () => {
  await api('POST', '/api/logout');
  signOutLocal();
  say('Signed out.', true);
};

function resetBatch() {
  batchSelected = []; batchReview = null; batchRequest = null;
  batchMessage = ''; batchBusy = false; batchDone = false;
  const dialog = document.querySelector<HTMLDialogElement>('#batch-dialog');
  if (dialog?.open) dialog.close();
}

function renderBatch() {
  if (!view) return;
  const locked = batchBusy || !!batchRequest || batchDone;
  const review = batchReview;
  const capacity = review && !batchDone ? review.capacity : view.capacity;
  const projected = review && !batchDone ? review.projected : {
    reserved: capacity.reserved + batchSelected.length, filled: capacity.filled,
    available: capacity.available - batchSelected.length,
  };
  const rows = review ? review.candidates : view.candidates;
  const activeId = document.activeElement?.id;
  $('#batch-content').innerHTML = `
    <header class="batch-head"><div><p class="eyebrow">Offer planning · ${esc(view.role.code)}</p>
      <h2 id="batch-title">${batchDone ? 'Batch completed' : review ? 'Review batch offers' : 'Plan batch offers'}</h2>
      <p class="sub">${esc(view.role.title)} · ${esc(view.role.team)}</p></div>
      <button id="batch-close" aria-label="Close batch offers" ${batchBusy ? 'disabled' : ''}>×</button></header>
    <div class="batch-body">
    <p class="batch-intro">${batchDone ? 'The saved receipt confirms this batch. Capacity below reflects the latest vacancy.' :
      review ? 'All selected offers will be committed together. No applicant changes if the batch is refused.' :
      'Choose applicants, then review their current assessments and the openings required. Planning does not reserve an opening.'}</p>
    <div class="batch-metrics" aria-label="Batch capacity">
      <div><span>Selected</span><strong id="batch-count">${batchSelected.length}</strong><small>${view.role.openings} total openings</small></div>
      <div><span>Available now</span><strong>${capacity.available}</strong><small>${capacity.reserved} reserved · ${capacity.filled} filled</small></div>
      <div><span>${batchDone ? 'Reserved now' : 'Available after offers'}</span><strong>${batchDone ? capacity.reserved : projected.available}</strong><small>${batchDone ? `${capacity.filled} filled` : `${projected.reserved} reserved · ${projected.filled} filled`}</small></div>
    </div>
    <p id="batch-status" tabindex="-1" role="status" class="batch-status${batchMessage && !batchDone ? ' warning' : ''}">${esc(batchMessage || (review ? `Reviewed at vacancy revision ${review.revision}.` : 'Select one or more applicants to review.'))}</p>
    ${review && !review.ready && !batchDone ? `<div class="batch-warning"><b>Not ready to offer</b><ul>${review.errors.map((error: string) => `<li>${esc(error)}</li>`).join('')}</ul></div>` : ''}
    <div class="batch-list" aria-label="${review ? 'Reviewed applicants' : 'Applicants for batch offers'}">
      ${rows.length ? rows.map((candidate: any) => review ?
        `<div class="batch-choice"><span class="batch-number">${batchSelected.indexOf(candidate.id) + 1}</span><span><b>${esc(candidate.name)}</b><small>${esc(candidate.id)} · assessment v${candidate.assessment_version}</small></span><span class="batch-state">${esc(candidate.reason)}</span></div>` :
        `<label class="batch-choice"><input type="checkbox" data-batch-id="${esc(candidate.id)}" ${batchSelected.includes(candidate.id) ? 'checked' : ''} ${locked ? 'disabled' : ''} aria-label="Select ${esc(candidate.name)} for batch offers"><span><b>${esc(candidate.name)}</b><small>${esc(candidate.id)} · ${esc(candidate.stage)}</small></span><span class="batch-state">${candidate.stage === 'interview' ? `${candidate.scores.length}/${candidate.panel.length} scored` : 'Interview required'}</span></label>`).join('') :
        '<p class="empty">No applicants in this vacancy yet. The coordinator can add applicants before offers are planned.</p>'}
    </div>
    </div>
    <footer class="batch-actions">
      ${batchDone ? '<button id="batch-finish" class="primary">Done</button>' : batchRequest ?
        `<button id="batch-retry" class="primary" ${batchBusy ? 'disabled' : ''}>${batchBusy ? 'Submitting batch…' : 'Retry submission'}</button>` :
        review ? `<button id="batch-edit" ${batchBusy ? 'disabled' : ''}>Edit selection</button><button id="batch-confirm" class="primary" ${!review.ready || batchBusy ? 'disabled' : ''}>Confirm ${batchSelected.length} offer${batchSelected.length === 1 ? '' : 's'}</button>` :
        `<button id="batch-review" class="primary" ${!batchSelected.length || batchBusy ? 'disabled' : ''}>${batchBusy ? 'Reviewing…' : 'Review selection'}</button>`}
    </footer>`;
  $('#batch-close').onclick = closeBatch;
  $('#batch-content').querySelectorAll<HTMLInputElement>('[data-batch-id]').forEach(input => {
    input.onchange = () => {
      const id = input.dataset.batchId!;
      batchSelected = input.checked ? [...batchSelected, id] : batchSelected.filter(value => value !== id);
      batchMessage = ''; renderBatch();
      $('#batch-content').querySelector<HTMLInputElement>(`[data-batch-id="${id}"]`)?.focus();
    };
  });
  const bind = (id: string, action: () => void) => { const button = document.getElementById(id); if (button) button.onclick = action; };
  bind('batch-review', reviewBatch);
  bind('batch-edit', () => { batchReview = null; batchMessage = ''; renderBatch(); $('#batch-review').focus(); });
  bind('batch-confirm', submitBatch);
  bind('batch-retry', submitBatch);
  bind('batch-finish', closeBatch);
  if (activeId && document.getElementById(activeId)) document.getElementById(activeId)?.focus();
}

function closeBatch() {
  if (batchBusy) return;
  ($('#batch-dialog') as HTMLDialogElement).close();
  $('#batch-open').focus();
  if (batchDone) resetBatch();
}

async function reviewBatch() {
  if (!view || batchBusy || batchRequest) return;
  batchBusy = true; renderBatch();
  try {
    const result = await api('POST', `/api/roles/${view.role.code}/batch-preview`, { candidate_ids: batchSelected });
    if (!result.ok) throw new Error(result.data.error || 'The selection could not be reviewed.');
    batchReview = result.data;
    const latest = await api('GET', `/api/roles/${view.role.code}`);
    if (latest.ok) applySnapshot(latest.data);
    batchMessage = '';
  } catch (error) { batchMessage = (error as Error).message; }
  finally { batchBusy = false; renderBatch(); $('#batch-status').focus(); }
}

async function submitBatch() {
  if (!view || batchBusy || (!batchRequest && !batchReview?.ready)) return;
  if (!batchRequest) batchRequest = { candidate_ids: [...batchSelected], expected_revision: batchReview.revision, operation_id: operationId() };
  batchBusy = true; batchMessage = 'Submitting the reviewed batch. Please wait.'; renderBatch();
  try {
    const result = await api('POST', `/api/roles/${view.role.code}/batch-offers`, batchRequest);
    if (result.status >= 500) throw new Error('The server could not confirm the outcome.');
    if (result.ok) {
      batchDone = true;
      batchMessage = `${result.data.count} offers confirmed together. Receipt ${result.data.batch_id}.`;
    } else {
      batchReview = null;
      batchMessage = `${result.data.error || 'The batch was refused.'} Selection retained. Review it again before confirming a new attempt.`;
    }
    batchRequest = null;
    const latest = await api('GET', `/api/roles/${view.role.code}`);
    if (latest.ok) applySnapshot(latest.data);
    else batchMessage += ' Reload the workspace to refresh capacity.';
  } catch (error) {
    batchMessage = batchDone ? 'Offers confirmed. Reload the workspace to refresh capacity.' :
      'The outcome could not be confirmed. Retry submission to recover the same result; do not create another batch.';
  } finally { batchBusy = false; renderBatch(); $('#batch-status').focus(); }
}

$('#batch-open').onclick = () => {
  closeCandidate(false); renderBatch();
  ($('#batch-dialog') as HTMLDialogElement).showModal(); $('#batch-close').focus();
};
$('#batch-dialog').addEventListener('cancel', event => { event.preventDefault(); closeBatch(); });
$('#batch-dialog').addEventListener('keydown', event => {
  if (event.key !== 'Tab') return;
  const items = Array.from($('#batch-dialog').querySelectorAll<HTMLElement>(
    'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])',
  )).filter(element => element.getClientRects().length > 0);
  const first = items[0], last = items[items.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
});
window.addEventListener('resize', () => { if (view) drawFunnel(view.funnel); });
boot();
