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
};

const TOKEN_KEY = 'pellmoor_session_v2';
let token = localStorage.getItem(TOKEN_KEY) || '';
let me: Person | null = null;
let stages: Stage[] = [];
let terminal: Stage[] = [];
let view: RoleView | null = null;
let openId: string | null = null;
let returnFocus: HTMLElement | null = null;

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
  const width = Math.max(330, (host.node() as HTMLElement).clientWidth || 640);
  const rowHeight = 48;
  const labelWidth = width < 470 ? 78 : 102;
  const chartWidth = Math.max(110, width - labelWidth - (width < 470 ? 118 : 180));
  const scale = d3.scaleLinear().domain([0, total]).range([0, chartWidth]);
  const svg = host.append('svg')
    .attr('width', '100%').attr('height', rungs.length * rowHeight + 20)
    .attr('viewBox', `0 0 ${width} ${rungs.length * rowHeight + 20}`)
    .attr('role', 'img')
    .attr('aria-label', `Funnel: ${rungs.map((r) => `${r.stage} ${r.reached} reached`).join(', ')}`);
  const groups = svg.selectAll('g.rung').data(rungs).join('g')
    .attr('class', 'rung').attr('transform', (_r, index) => `translate(0,${index * rowHeight + 10})`);
  groups.append('text').attr('class', 'stage-label')
    .attr('x', labelWidth - 10).attr('y', 20).attr('text-anchor', 'end')
    .text((r) => r.stage);
  groups.append('rect').attr('class', 'reached').attr('x', labelWidth).attr('y', 3)
    .attr('height', 25).attr('rx', 5).attr('width', (r) => Math.max(2, scale(r.reached)));
  groups.append('rect').attr('class', 'still').attr('x', labelWidth).attr('y', 3)
    .attr('height', 25).attr('rx', 5).attr('width', (r) => scale(r.still));
  groups.append('text').attr('class', 'figure')
    .attr('x', (r) => labelWidth + Math.max(2, scale(r.reached)) + 8).attr('y', 20)
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
  $('#role-title').textContent = `${snapshot.role.title} · ${snapshot.role.team}`;
  $('#role-sub').textContent = `${snapshot.role.openings} opening${snapshot.role.openings === 1 ? '' : 's'} · ${snapshot.candidates.length} candidates · revision ${snapshot.revision}`;
  $('#revision').textContent = `r${snapshot.revision}`;
  $('#addcandidate').hidden = !can('add');
  drawFunnel(snapshot.funnel);
  drawBoard(snapshot);
}

async function loadRole(code: string) {
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
  if (event.kind === 'stage_changed') return `moved ${details.from} → ${details.to}`;
  if (event.kind === 'panel_added') return `added ${details.member} to the panel`;
  if (event.kind === 'score_recorded') return `recorded score ${details.score}`;
  if (event.kind === 'note_added') return 'added a note';
  return event.kind.replaceAll('_', ' ');
}

async function refreshAfterMutation(result: any, candidateId?: string) {
  if (result.data.snapshot) applySnapshot(result.data.snapshot);
  if (candidateId) await openCandidate(candidateId);
}

async function mutate(endpoint: string, body: Record<string, unknown>, candidateId?: string) {
  if (!view) return { ok: false, status: 0, data: {} };
  setBusy(true, 'Saving…');
  const result = await api('POST', endpoint, {
    ...body, expected_revision: view.revision, operation_id: operationId(),
  });
  setBusy(false);
  await refreshAfterMutation(result, candidateId);
  if (!result.ok) say(result.data.error || 'That change was refused.');
  return result;
}

async function openCandidate(id: string) {
  const result = await api('GET', `/api/candidates/${encodeURIComponent(id)}`);
  if (!result.ok) {
    closeCandidate(); say(result.data.error || 'Candidate not found.'); return;
  }
  openId = id;
  const { candidate, panel, scores, notes, activity, people, revision } = result.data;
  if (view) view.revision = revision;
  const next = stages[stages.indexOf(candidate.stage) + 1];
  const previous = stages[stages.indexOf(candidate.stage) - 1];
  const finished = terminal.includes(candidate.stage);
  const score = scores.find((item: Score) => item.panel_member === me?.email)?.score;
  const canScore = can('score') && panel.includes(me?.email);

  $('#panel').innerHTML = `<header><div><p class="eyebrow">${candidate.id}</p>
      <h2>${esc(candidate.name)}</h2></div><button id="close" aria-label="Close candidate">×</button></header>
    <p class="sub">${esc(candidate.stage)}${finished ? ' · terminal' : ''} · applied ${candidate.applied_days} days ago</p>
    <div class="history" aria-label="Stage history">${candidate.history.map((stage: string) =>
      `<span${stage === candidate.stage ? ' aria-current="step"' : ''}>${esc(stage)}</span>`).join('')}</div>
    ${can('move') && !finished ? `<div class="moves">
      ${previous ? `<button data-to="${previous}">Back to ${previous}</button>` : ''}
      ${next ? `<button class="primary" data-to="${next}">Move to ${next}</button>` : ''}
      <button data-to="rejected">Reject</button><button data-to="withdrawn">Withdraw</button></div>` : ''}
    <h3>Panel and scores</h3>
    ${panel.length ? `<ul class="panel-list">${panel.map((email: string) => {
      const person = people.find((item: Person) => item.email === email);
      const item = scores.find((value: Score) => value.panel_member === email);
      return `<li><span><b>${esc(person?.name || email)}</b><small>${esc(email)}</small></span>
        <strong>${item ? `${item.score}/5` : 'waiting'}</strong></li>`;
    }).join('')}</ul>` : '<p class="empty">No panel yet.</p>'}
    ${can('panel') ? `<form id="panelform" class="addrow"><label><span>Panel member</span>
      <select id="member">${people.filter((person: Person) => !panel.includes(person.email))
        .map((person: Person) => `<option value="${esc(person.email)}">${esc(person.name)}</option>`).join('')}</select></label>
      <button>Add to panel</button></form>` : ''}
    ${canScore ? `<form id="scoreform" class="addrow"><label><span>My score</span>
      <select id="score">${[1, 2, 3, 4, 5].map((value) =>
        `<option${score === value ? ' selected' : ''}>${value}</option>`).join('')}</select></label>
      <button>Record score</button></form>` : ''}
    <h3>Notes</h3>
    ${notes.length ? `<ol class="notes">${notes.map((note: any) =>
      `<li><b>${esc(note.author_name)}</b><time>${esc(note.at)}</time><p>${esc(note.body)}</p></li>`).join('')}</ol>`
      : '<p class="empty">Nothing recorded yet.</p>'}
    <form id="notef" class="addrow"><label><span>New note</span>
      <input id="note" maxlength="1000" placeholder="Add a note; corrections stay in the trail"></label><button>Add note</button></form>
    <h3>Activity</h3>
    ${activity.length ? `<ol class="activity">${activity.map((event: any) =>
      `<li><b>${esc(event.actor_name)}</b> ${esc(activityText(event))}<time>${esc(event.at)}</time></li>`).join('')}</ol>`
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
  const dark = root.dataset.theme === 'dark'
    || (!root.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  root.dataset.theme = dark ? 'light' : 'dark';
  if (view) drawFunnel(view.funnel);
};

$('#signout').onclick = async () => {
  await api('POST', '/api/logout');
  signOutLocal();
  say('Signed out.', true);
};

window.addEventListener('resize', () => { if (view) drawFunnel(view.funnel); });
boot();
