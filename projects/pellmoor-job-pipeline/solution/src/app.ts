// Pellmoor hiring console — browser side.
//
// The funnel and the stage columns are rendered from ONE response, so the chart
// and the columns cannot disagree with each other. Every mutation refetches that
// response, which is what makes a stage change show up in three places at once.

import * as d3 from 'd3';

type Stage = string;
interface Candidate {
  id: string; role: string; name: string; stage: Stage; history: Stage[];
  applied_days: number; panel: string[]; scores: { panel_member: string; score: number }[];
  notes: number;
}
interface Rung { stage: Stage; reached: number; still: number; left: number; }
interface RoleView {
  role: { code: string; title: string; team: string; openings: number };
  funnel: Rung[];
  candidates: Candidate[];
}

let ME: any = null;
let STAGES: Stage[] = [];
let TERMINAL: Stage[] = [];
let VIEW: RoleView | null = null;
let openId: string | null = null;

const $ = (s: string) => document.querySelector(s) as HTMLElement;
const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

async function api(method: string, path: string, body?: unknown) {
  const r = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

function say(msg: string, good = false) {
  const t = $('#toast');
  t.textContent = msg;
  t.dataset.tone = good ? 'good' : 'bad';
  t.classList.add('show');
  window.setTimeout(() => t.classList.remove('show'), 4500);
}

// ── the funnel ──────────────────────────────────────────────────────────────
function drawFunnel(rungs: Rung[]) {
  const host = d3.select('#funnel');
  host.selectAll('*').remove();

  const total = d3.max(rungs, (r) => r.reached) ?? 0;
  if (!total) {
    host.append('p').attr('class', 'empty')
      .text('Nobody has applied to this vacancy yet — the funnel appears once somebody does.');
    return;
  }

  const W = (host.node() as HTMLElement).clientWidth || 640;
  const rowH = 46;
  const H = rungs.length * rowH + 30;
  const labelW = 96;
  const x = d3.scaleLinear().domain([0, total]).range([0, W - labelW - 96]);

  const svg = host.append('svg')
    .attr('width', '100%').attr('height', H)
    .attr('viewBox', `0 0 ${W} ${H}`)
    .attr('role', 'img')
    .attr('aria-label', `Funnel: ${rungs.map((r) => `${r.stage} ${r.reached}`).join(', ')}`);

  const g = svg.selectAll('g.rung').data(rungs).join('g')
    .attr('class', 'rung')
    .attr('transform', (_d, i) => `translate(0,${i * rowH + 14})`);

  g.append('text').attr('class', 'stage-label')
    .attr('x', labelW - 12).attr('y', 18).attr('text-anchor', 'end')
    .text((d) => d.stage);

  g.append('rect').attr('class', 'reached')
    .attr('x', labelW).attr('y', 2).attr('height', 24).attr('rx', 5)
    .attr('width', (d) => Math.max(2, x(d.reached)));

  g.append('rect').attr('class', 'still')
    .attr('x', labelW).attr('y', 2).attr('height', 24).attr('rx', 5)
    .attr('width', (d) => Math.max(0, x(d.still)));

  g.append('text').attr('class', 'figure')
    .attr('x', (d) => labelW + Math.max(2, x(d.reached)) + 10).attr('y', 19)
    .text((d) => d.left
      ? `${d.reached} reached · ${d.still} here · ${d.left} left here`
      : `${d.reached} reached · ${d.still} here`);

  g.append('title').text((d) =>
    `${d.stage}: ${d.reached} reached, ${d.still} standing here, ${d.left} left at this stage`);
}

// ── the board ───────────────────────────────────────────────────────────────
function drawBoard(v: RoleView) {
  const cols = [...STAGES, ...TERMINAL];
  $('#board').innerHTML = cols.map((stage) => {
    const here = v.candidates.filter((c) => c.stage === stage);
    const terminal = TERMINAL.includes(stage);
    return `<section class="col${terminal ? ' terminal' : ''}">
      <h3>${esc(stage)}<span class="n">${here.length}</span></h3>
      ${here.length === 0
        ? `<p class="empty-col">${terminal ? 'nobody' : 'empty'}</p>`
        : here.map((c) => `
          <button class="cand" data-id="${c.id}">
            <b>${esc(c.name)}</b>
            <span class="meta">${c.applied_days}d
              ${c.scores.length ? ` · ${c.scores.length} scored` : ''}
              ${c.notes ? ` · ${c.notes} notes` : ''}</span>
          </button>`).join('')}
    </section>`;
  }).join('');

  $('#board').querySelectorAll<HTMLButtonElement>('button.cand').forEach((b) => {
    b.onclick = () => openCandidate(b.dataset.id as string);
  });
}

async function loadRole(code: string) {
  const r = await api('GET', `/api/roles/${code}`);
  if (!r.ok) return say(r.data.error || 'that vacancy would not load');
  VIEW = r.data as RoleView;
  $('#role-title').textContent = `${VIEW.role.title} · ${VIEW.role.team}`;
  $('#role-sub').textContent =
    `${VIEW.role.openings} opening${VIEW.role.openings === 1 ? '' : 's'} · ${VIEW.candidates.length} candidates`;
  drawFunnel(VIEW.funnel);
  drawBoard(VIEW);
  if (openId) openCandidate(openId);
}

async function openCandidate(id: string) {
  const r = await api('GET', `/api/candidates/${id}`);
  if (!r.ok) { openId = null; $('#panel').innerHTML = ''; return; }
  openId = id;
  const { candidate: c, panel, scores, notes, people } = r.data;
  const next = STAGES[STAGES.indexOf(c.stage) + 1];
  const prev = STAGES[STAGES.indexOf(c.stage) - 1];
  const terminal = TERMINAL.includes(c.stage);

  $('#panel').innerHTML = `
    <header>
      <h2>${esc(c.name)}</h2>
      <button id="close" aria-label="Close">×</button>
    </header>
    <p class="sub">${esc(c.stage)}${terminal ? ' — the end of it' : ''} ·
       applied ${c.applied_days} days ago</p>
    <div class="moves">
      ${prev && !terminal ? `<button data-to="${prev}">back to ${prev}</button>` : ''}
      ${next && !terminal ? `<button class="primary" data-to="${next}">move to ${next}</button>` : ''}
      ${!terminal ? '<button data-to="rejected">reject</button>' : ''}
      ${!terminal ? '<button data-to="withdrawn">withdrew</button>' : ''}
    </div>
    <h4>Panel</h4>
    ${panel.length ? `<ul class="panel">${panel.map((p: string) => {
      const s = scores.find((x: any) => x.panel_member === p);
      const nm = (people.find((q: any) => q.email === p) || {}).name || p;
      return `<li>${esc(nm)}<span>${s ? `scored ${s.score}` : 'not scored yet'}</span></li>`;
    }).join('')}</ul>` : '<p class="empty">No panel yet.</p>'}
    <div class="addrow">
      <select id="member">${people.filter((p: any) => !panel.includes(p.email))
        .map((p: any) => `<option value="${esc(p.email)}">${esc(p.name)}</option>`).join('')}</select>
      <button id="addpanel">Add to panel</button>
    </div>
    ${panel.includes(ME.email) ? `<div class="addrow">
      <select id="score">${[1, 2, 3, 4, 5].map((n) => `<option>${n}</option>`).join('')}</select>
      <button id="addscore">Record my score</button></div>` : ''}
    <h4>Notes</h4>
    ${notes.length ? `<ol class="notes">${notes.map((n: any) =>
      `<li><b>${esc((people.find((q: any) => q.email === n.author) || {}).name || n.author)}</b>
       ${esc(n.body)}</li>`).join('')}</ol>`
      : '<p class="empty">Nothing recorded yet.</p>'}
    <form id="notef" class="addrow">
      <input id="note" placeholder="Add a note — they are never edited" aria-label="New note">
      <button>Add</button>
    </form>`;

  $('#close').onclick = () => { openId = null; $('#panel').innerHTML = ''; };
  $('#panel').querySelectorAll<HTMLButtonElement>('.moves button').forEach((b) => {
    b.onclick = async () => {
      const r2 = await api('POST', `/api/candidates/${id}/stage`, { stage: b.dataset.to });
      if (!r2.ok) return say(r2.data.error);
      say(`moved to ${b.dataset.to}`, true);
      await loadRole(VIEW!.role.code);
    };
  });
  ($('#addpanel') as HTMLButtonElement).onclick = async () => {
    const m = ($('#member') as HTMLSelectElement).value;
    const r2 = await api('POST', `/api/candidates/${id}/panel`, { member: m });
    if (!r2.ok) return say(r2.data.error);
    await loadRole(VIEW!.role.code);
  };
  const sc = document.getElementById('addscore') as HTMLButtonElement | null;
  if (sc) sc.onclick = async () => {
    const v = ($('#score') as HTMLSelectElement).value;
    const r2 = await api('POST', `/api/candidates/${id}/score`, { score: Number(v) });
    if (!r2.ok) return say(r2.data.error);
    await loadRole(VIEW!.role.code);
  };
  ($('#notef') as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    const input = $('#note') as HTMLInputElement;
    const r2 = await api('POST', `/api/candidates/${id}/notes`, { body: input.value });
    if (!r2.ok) return say(r2.data.error);
    input.value = '';
    await loadRole(VIEW!.role.code);
  };
}

async function boot() {
  const me = await api('GET', '/api/me');
  if (!me.ok) { renderSignIn(); return; }
  ME = me.data.person; STAGES = me.data.stages; TERMINAL = me.data.terminal;
  $('#whoami').textContent = `${ME.name} · ${ME.role}`;
  $('#app').hidden = false;
  $('#signin').hidden = true;

  const roles = await api('GET', '/api/roles');
  const list = $('#roles');
  list.innerHTML = roles.data.roles.map((r: any) =>
    `<button data-code="${r.code}"><b>${esc(r.title)}</b>
     <span>${r.live} live · ${r.total} total</span></button>`).join('');
  list.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
    b.onclick = () => {
      list.querySelectorAll('button').forEach((x) => x.removeAttribute('aria-current'));
      b.setAttribute('aria-current', 'true');
      openId = null; $('#panel').innerHTML = '';
      loadRole(b.dataset.code as string);
    };
  });
  (list.querySelector('button') as HTMLButtonElement)?.click();
}

function renderSignIn() {
  $('#signin').hidden = false;
  $('#app').hidden = true;
  ($('#loginf') as HTMLFormElement).onsubmit = async (e) => {
    e.preventDefault();
    const email = ($('#email') as HTMLInputElement).value;
    const password = ($('#password') as HTMLInputElement).value;
    const r = await api('POST', '/api/login', { email, password });
    if (!r.ok) return say(r.data.error);
    boot();
  };
}

($('#theme') as HTMLButtonElement).onclick = () => {
  const el = document.documentElement;
  const dark = el.dataset.theme === 'dark'
    || (!el.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
  el.dataset.theme = dark ? 'light' : 'dark';
  if (VIEW) drawFunnel(VIEW.funnel);
};
($('#signout') as HTMLButtonElement).onclick = async () => {
  await api('POST', '/api/logout');
  location.reload();
};

boot();
