'use strict';
/* Pipeline board. Cards are keyed nodes that are updated and re-ordered in place;
 * nothing a person is using is ever rebuilt under them. A move is shown at once and
 * put back, with the reason, if the server refuses it. */
window.boardView = function (H) {
  const { el, api, refresh, keep, when, STAGE_NAMES, user } = H;
  const FLOW = ['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED'];
  const MANAGER = ['INTERVIEW', 'OFFER', 'HIRED'];
  const canWrite = user.role === 'recruiter' || user.role === 'hiring_manager';
  let boot = null, jobId = keep.get('job') || '', openId = null, notesFor = null, notesCount = -1;
  const selected = new Set();
  const cards = new Map();

  const jobSelect = el('select', { id: 'board-job' });
  const facts = el('p', { class: 'muted job-facts' });
  const status = el('p', { class: 'status-line', role: 'status' });
  const alert = el('p', { class: 'error', role: 'alert', tabindex: '-1' });
  const undo = el('button', { type: 'button', class: 'secondary', hidden: true });
  const bulkCount = el('span', { class: 'bulk-count' });
  const bulkStage = el('select', { 'aria-label': 'Move selected candidates to' }, Object.entries(STAGE_NAMES).map(([value, text]) => el('option', { value, text })));
  const bulkReason = el('input', { type: 'text', 'aria-label': 'Reason for rejecting the selected candidates', placeholder: 'Reason for rejecting', hidden: true });
  const bulkGo = el('button', { type: 'button', class: 'primary', text: 'Move selected' });
  const bulkClear = el('button', { type: 'button', class: 'secondary', text: 'Clear selection' });
  const bulk = el('div', { class: 'bulk-bar', role: 'group', 'aria-label': 'Selected candidates', hidden: true }, [bulkCount, bulkStage, bulkReason, bulkGo, bulkClear]);
  const columns = el('div', { class: 'board' });
  const lists = {}, heads = {};
  for (const stage of Object.keys(STAGE_NAMES)) {
    heads[stage] = el('h2');
    lists[stage] = el('ol', { class: 'cards', 'data-stage': stage, 'aria-label': STAGE_NAMES[stage] });
    columns.append(el('section', { class: 'column', 'data-stage': stage }, [heads[stage], lists[stage]]));
  }

  /* ---------------------------------------------------------------- forms (recruiter) */
  function field(label, input) {
    const fault = el('span', { class: 'field-fault' });
    return { node: el('div', {}, [el('label', { class: 'field' }, [el('span', { text: label }), input]), fault]), input, fault };
  }
  const forms = el('div', { class: 'forms' });
  let managerSelect = null;
  if (user.role === 'recruiter') {
    const name = field('Candidate name', el('input', { type: 'text', autocomplete: 'off' }));
    const email = field('Candidate email', el('input', { type: 'text', inputmode: 'email', autocomplete: 'off' }));
    const source = field('Source', el('input', { type: 'text', autocomplete: 'off', value: 'Careers page' }));
    const addError = el('p', { class: 'error', role: 'alert' });
    const add = el('form', { class: 'panel', 'aria-label': 'Add a candidate', novalidate: true }, [el('h2', { text: 'Add a candidate to this job' }),
      el('div', { class: 'form-grid' }, [name.node, email.node, source.node]), el('button', { type: 'submit', class: 'primary', text: 'Add candidate' }), addError]);
    add.addEventListener('submit', async (e) => {
      e.preventDefault();
      addError.textContent = ''; email.fault.textContent = ''; email.input.removeAttribute('aria-invalid');
      const r = await api('POST', '/api/applications', { job_id: jobId, candidate_name: name.input.value, candidate_email: email.input.value, source: source.input.value });
      if (r.status === 401) return;
      if (!r.ok) {
        if (r.data && r.data.field === 'candidate_email') { email.fault.textContent = r.data.error; email.input.setAttribute('aria-invalid', 'true'); email.input.focus(); }
        else addError.textContent = (r.data && r.data.error) || 'The candidate was not added.';
        return;
      }
      name.input.value = ''; email.input.value = '';
      status.textContent = `${r.data.candidate_name} was added to Applied.`;
      await refresh();
    });
    const jobTitle = field('Job title', el('input', { type: 'text', autocomplete: 'off' }));
    const team = field('Team', el('input', { type: 'text', autocomplete: 'off' }));
    managerSelect = el('select');
    const manager = field('Hiring manager', managerSelect);
    const limit = field('Interview places', el('input', { type: 'text', inputmode: 'numeric', value: '3' }));
    const jobError = el('p', { class: 'error', role: 'alert' });
    const open = el('form', { class: 'panel', 'aria-label': 'Open a job', novalidate: true }, [el('h2', { text: 'Open a job' }),
      el('div', { class: 'form-grid' }, [jobTitle.node, team.node, manager.node, limit.node]), el('button', { type: 'submit', class: 'primary', text: 'Open job' }), jobError]);
    open.addEventListener('submit', async (e) => {
      e.preventDefault();
      jobError.textContent = '';
      const places = /^\d+$/.test(limit.input.value.trim()) ? Number(limit.input.value.trim()) : NaN;
      const r = await api('POST', '/api/jobs', { title: jobTitle.input.value, team: team.input.value, manager_id: managerSelect.value, interview_limit: places });
      if (r.status === 401) return;
      if (!r.ok) { jobError.textContent = (r.data && r.data.error) || 'The job was not opened.'; return; }
      jobTitle.input.value = ''; team.input.value = '';
      jobId = r.data.id; keep.set('job', jobId);
      status.textContent = `${r.data.title} is open.`;
      await refresh();
      jobSelect.focus();
    });
    forms.append(add, open);
  }

  /* ---------------------------------------------------------------- detail panel */
  const dTitle = el('h2', { tabindex: '-1' });
  const dFacts = el('div', { class: 'facts' });
  const dNotes = el('ol', { class: 'notes', 'aria-label': 'Internal notes' });
  const dNote = el('textarea', { rows: '3', 'aria-label': 'Add an internal note' });
  const dAdd = el('button', { type: 'button', class: 'primary', text: 'Add note' });
  const dError = el('p', { class: 'error', role: 'alert' });
  const dThread = el('button', { type: 'button', class: 'secondary', text: 'Open conversation' });
  const dClose = el('button', { type: 'button', class: 'secondary', text: 'Close' });
  const noteBox = el('div', { class: 'note-box' }, [dNote, dAdd, dError]);
  const detail = el('aside', { class: 'detail panel', 'aria-label': 'Candidate details', hidden: true }, [
    dTitle, dFacts, el('h3', { text: 'Internal notes (never shown to the candidate)' }), dNotes, noteBox, el('div', { class: 'actionbar' }, [dThread, dClose])]);
  let opener = null;
  dNote.addEventListener('input', () => keep.set('note.' + openId, dNote.value));
  dClose.addEventListener('click', () => { detail.hidden = true; openId = null; const c = opener && cards.get(opener); if (c) c.name.focus(); });
  dThread.addEventListener('click', () => H.go('threads', openId));
  dAdd.addEventListener('click', async () => {
    dError.textContent = '';
    const id = openId;
    const r = await api('POST', `/api/applications/${encodeURIComponent(id)}/notes`, { body: dNote.value });
    if (r.status === 401) return;
    if (!r.ok) { dError.textContent = (r.data && r.data.error) || 'The note was not saved; it is still here.'; return; }
    dNote.value = ''; keep.set('note.' + id, '');
    await refresh();
    dNote.focus();
  });
  async function loadNotes(id) {
    const r = await api('GET', `/api/applications/${encodeURIComponent(id)}`);
    if (!r.ok || openId !== id) return;
    dNotes.replaceChildren(...r.data.notes.map((n) => el('li', {}, [el('p', { text: n.body }), el('span', { class: 'muted', text: `${n.author_name} · ${when(n.created_at)}` })])));
    if (!r.data.notes.length) dNotes.append(el('li', { class: 'muted', text: 'No notes yet.' }));
  }
  function openDetail(id) {
    openId = id; opener = id; notesFor = null;
    detail.hidden = false;
    dNote.value = keep.get('note.' + id) || '';
    syncDetail();
    dTitle.focus();
  }
  function syncDetail() {
    if (!openId) return;
    const a = boot.applications.find((x) => x.id === openId);
    if (!a) { detail.hidden = true; openId = null; return; }
    const job = boot.jobs.find((j) => j.id === a.job_id);
    dTitle.textContent = a.candidate_name;
    const lines = [['Job', job.title], ['Stage', STAGE_NAMES[a.stage]], ['Email', a.candidate_email], ['Source', a.source]];
    if (a.stage === 'REJECTED') lines.push(['Rejected from', STAGE_NAMES[a.rejected_from]], ['Reason', a.reject_reason]);
    const sig = JSON.stringify(lines);
    if (dFacts.dataset.sig !== sig) {
      dFacts.dataset.sig = sig;
      dFacts.replaceChildren(...lines.map(([k, v]) => el('div', { class: 'kv' }, [el('span', { class: 'k', text: k }), el('span', { class: 'v', text: v })])));
    }
    const mayNote = user.role === 'recruiter' || (user.role === 'hiring_manager' && job.manager_id === user.id);
    noteBox.hidden = !mayNote;
    dThread.hidden = !a.thread;
    if (notesFor !== a.id || notesCount !== a.note_count) { notesFor = a.id; notesCount = a.note_count; loadNotes(a.id); }
  }

  /* ---------------------------------------------------------------- what this person may do with a card */
  function targets(a, job) {
    if (!canWrite) return [];
    const origin = a.stage === 'REJECTED' ? a.rejected_from : a.stage;
    let list;
    if (a.stage === 'REJECTED') list = [a.rejected_from];
    else {
      const i = FLOW.indexOf(a.stage);
      list = [FLOW[i + 1], FLOW[i - 1], a.stage === 'HIRED' ? null : 'REJECTED'].filter(Boolean);
    }
    if (user.role === 'hiring_manager') {
      if (job.manager_id !== user.id || !MANAGER.includes(origin)) return [];
      list = list.filter((s) => (s === 'REJECTED' ? origin !== 'HIRED' : MANAGER.includes(s)));
    }
    return list;
  }
  function mayReorder(a, job) {
    if (user.role === 'recruiter') return true;
    return user.role === 'hiring_manager' && job.manager_id === user.id && MANAGER.includes(a.stage);
  }
  const column = (stage) => boot.applications.filter((a) => a.job_id === jobId && a.stage === stage).sort((x, y) => x.position - y.position);

  /* ---------------------------------------------------------------- moving */
  function fail(message, back) {
    alert.textContent = message;
    status.textContent = '';
    const c = back && cards.get(back);
    if (c && c.node.isConnected) (c.to.disabled ? c.name : c.to).focus(); else alert.focus();
  }
  function localMove(ids, toStage, beforeId) {
    const moving = boot.applications.filter((a) => ids.includes(a.id));
    const stages = new Set([toStage, ...moving.map((a) => a.stage)]);
    const cols = Object.fromEntries([...stages].map((s) => [s, column(s).filter((a) => !ids.includes(a.id))]));
    const at = beforeId ? cols[toStage].findIndex((a) => a.id === beforeId) : cols[toStage].length;
    for (const a of moving) { if (toStage === 'REJECTED' && a.stage !== 'REJECTED') a.rejected_from = a.stage; a.stage = toStage; }
    cols[toStage].splice(at < 0 ? cols[toStage].length : at, 0, ...ids.map((id) => moving.find((a) => a.id === id)));
    for (const list of Object.values(cols)) list.forEach((a, i) => { a.position = i + 1; });
  }
  async function send(ids, toStage, beforeId, reason, back) {
    alert.textContent = '';
    const snapshot = JSON.stringify(boot.applications);
    const items = ids.map((id) => ({ id, version: boot.applications.find((a) => a.id === id).version }));
    localMove(ids, toStage, beforeId);          // shown at once
    renderBoard();
    const r = items.length === 1
      ? await api('POST', `/api/applications/${encodeURIComponent(items[0].id)}/move`, { to_stage: toStage, before_id: beforeId || null, version: items[0].version, reason })
      : await api('POST', '/api/moves/bulk', { items, to_stage: toStage, reason });
    if (r.status === 401) return false;
    if (!r.ok) {
      boot.applications = JSON.parse(snapshot);   // put back
      renderBoard();
      fail((r.data && r.data.error) || 'The move was refused. Nothing was changed.', back);
      await refresh();
      const c = back && cards.get(back);
      if (c && c.node.isConnected && !c.node.contains(document.activeElement)) (c.to.disabled ? c.name : c.to).focus();
      return false;
    }
    status.textContent = items.length === 1 ? 'Moved.' : `${items.length} candidates moved together.`;
    await refresh();
    const c = back && cards.get(back);
    if (c && c.node.isConnected) (c.to.disabled ? c.name : c.to).focus();
    return true;
  }

  /* ---------------------------------------------------------------- cards */
  function makeCard(id) {
    const c = {};
    c.check = el('input', { type: 'checkbox' });
    c.name = el('button', { type: 'button', class: 'link-button card-name' });
    c.meta = el('span', { class: 'muted' });
    c.flags = el('span', { class: 'flags' });
    c.reasonLine = el('p', { class: 'muted reason-line' });
    c.to = el('select');
    c.reason = el('input', { type: 'text', placeholder: 'Reason for rejecting', hidden: true });
    c.go = el('button', { type: 'button', class: 'secondary', text: 'Move' });
    c.up = el('button', { type: 'button', class: 'secondary small', text: 'Up' });
    c.down = el('button', { type: 'button', class: 'secondary small', text: 'Down' });
    c.controls = el('div', { class: 'card-controls' }, [c.to, c.reason, c.go, c.up, c.down]);
    c.node = el('li', { class: 'card', 'data-application': id }, [el('div', { class: 'card-head' }, [c.check, c.name, c.flags]), c.meta, c.reasonLine, c.controls]);
    const self = () => boot.applications.find((a) => a.id === id);
    c.check.addEventListener('change', () => { if (c.check.checked) selected.add(id); else selected.delete(id); syncBulk(); });
    c.name.addEventListener('click', () => openDetail(id));
    c.to.addEventListener('change', () => { c.reason.hidden = c.to.value !== 'REJECTED'; if (!c.reason.hidden) c.reason.focus(); });
    c.go.addEventListener('click', async () => {
      const a = self();
      if (!c.to.value) return fail(`Choose a stage for ${a.candidate_name} first.`, id);
      if (c.to.value === 'REJECTED' && !c.reason.value.trim()) { alert.textContent = 'Give a reason for rejecting.'; c.reason.focus(); return; }
      const reason = c.reason.value;
      if (await send([id], c.to.value, null, reason, id)) { c.reason.value = ''; c.reason.hidden = true; }
    });
    const step = (dir) => async () => {
      const a = self(), col = column(a.stage), i = col.findIndex((x) => x.id === id);
      const before = dir < 0 ? col[i - 1] : col[i + 2];
      if ((dir < 0 && i === 0) || (dir > 0 && i === col.length - 1)) return;
      await send([id], a.stage, before ? before.id : null, undefined, id);
      (dir < 0 ? c.up : c.down).focus();
    };
    c.up.addEventListener('click', step(-1));
    c.down.addEventListener('click', step(1));
    c.node.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; });
    return c;
  }
  function syncCard(c, a, job, index, size) {
    const options = targets(a, job), order = mayReorder(a, job);
    const sig = JSON.stringify([a.candidate_name, a.source, a.candidate_email, a.stage, a.rejected_from, a.reject_reason, a.unread || 0, a.note_count, options, order]);
    if (c.sig !== sig) {
      c.sig = sig;
      c.name.textContent = a.candidate_name;
      c.meta.textContent = `${a.source} · ${a.candidate_email}`;
      c.flags.replaceChildren(...[
        a.unread ? el('span', { class: 'badge', text: String(a.unread), 'aria-label': `${a.unread} unread messages` }) : null,
        a.note_count ? el('span', { class: 'chip', text: `${a.note_count} ${a.note_count === 1 ? 'note' : 'notes'}` }) : null].filter(Boolean));
      c.reasonLine.textContent = a.stage === 'REJECTED' ? `Rejected from ${STAGE_NAMES[a.rejected_from]}: ${a.reject_reason}` : '';
      c.check.setAttribute('aria-label', `Select ${a.candidate_name}`);
      c.to.setAttribute('aria-label', `Move ${a.candidate_name} to`);
      c.reason.setAttribute('aria-label', `Reason for rejecting ${a.candidate_name}`);
      c.go.setAttribute('aria-label', `Move ${a.candidate_name}`);
      c.up.setAttribute('aria-label', `Move ${a.candidate_name} up`);
      c.down.setAttribute('aria-label', `Move ${a.candidate_name} down`);
      const held = c.to.value;
      c.to.replaceChildren(el('option', { value: '', text: 'Move to…' }), ...options.map((s) =>
        el('option', { value: s, text: a.stage === 'REJECTED' ? `Reopen to ${STAGE_NAMES[s]}` : STAGE_NAMES[s] })));
      c.to.value = options.includes(held) ? held : '';
      c.reason.hidden = c.to.value !== 'REJECTED';
      c.to.disabled = c.go.disabled = !options.length;
      c.check.hidden = !options.length && !order;
      c.controls.hidden = !options.length && !order;
      c.node.draggable = !!(options.length || order);
    }
    c.up.disabled = !order || index === 0;
    c.down.disabled = !order || index === size - 1;
    c.check.checked = selected.has(a.id);
  }

  function syncBulk() {
    const count = selected.size;
    bulk.hidden = count < 2;
    bulkCount.textContent = `${count} selected`;
    bulkReason.hidden = bulkStage.value !== 'REJECTED';
  }
  bulkStage.addEventListener('change', syncBulk);
  bulkClear.addEventListener('click', () => { selected.clear(); renderBoard(); });
  bulkGo.addEventListener('click', async () => {
    const ids = Object.keys(STAGE_NAMES).flatMap((s) => column(s)).filter((a) => selected.has(a.id)).map((a) => a.id);
    if (bulkStage.value === 'REJECTED' && !bulkReason.value.trim()) { alert.textContent = 'Give a reason for rejecting.'; bulkReason.focus(); return; }
    if (await send(ids, bulkStage.value, null, bulkReason.value, null)) { selected.clear(); bulkReason.value = ''; renderBoard(); undo.focus(); }
    else alert.focus();
  });
  undo.addEventListener('click', async () => {
    alert.textContent = '';
    const r = await api('POST', '/api/undo', { action_id: boot.undo.action_id });
    if (r.status === 401) return;
    if (!r.ok) { alert.textContent = (r.data && r.data.error) || 'That could not be undone.'; await refresh(); alert.focus(); return; }
    await refresh();
    status.textContent = 'Undone. Every card is back where it was.';
    jobSelect.focus();
  });
  columns.addEventListener('dragover', (e) => { if (e.target.closest('.column')) e.preventDefault(); });
  columns.addEventListener('drop', async (e) => {
    const col = e.target.closest('.column');
    const id = e.dataTransfer.getData('text/plain');
    if (!col || !cards.has(id)) return;
    e.preventDefault();
    const over = e.target.closest('.card');
    const before = over && over.dataset.application !== id ? over.dataset.application : null;
    const a = boot.applications.find((x) => x.id === id);
    let reason;
    if (col.dataset.stage === 'REJECTED' && a.stage !== 'REJECTED') {
      const c = cards.get(id); c.to.value = 'REJECTED'; c.reason.hidden = false; c.reason.focus();
      alert.textContent = 'Give a reason, then press Move.';
      return;
    }
    if (selected.has(id) && selected.size > 1) {
      const ids = Object.keys(STAGE_NAMES).flatMap((s) => column(s)).filter((x) => selected.has(x.id)).map((x) => x.id);
      if (await send(ids, col.dataset.stage, null, reason, id)) { selected.clear(); renderBoard(); }
    } else await send([id], col.dataset.stage, before, reason, id);
  });

  function renderBoard() {
    const job = boot.jobs.find((j) => j.id === jobId);
    const held = document.activeElement;      // re-ordering a card's node drops focus; hand it straight back
    const live = new Set();
    for (const stage of Object.keys(STAGE_NAMES)) {
      const col = job ? column(stage) : [];
      heads[stage].textContent = stage === 'INTERVIEW' && job ? `Interview (${col.length} of ${job.interview_limit} places)` : `${STAGE_NAMES[stage]} (${col.length})`;
      col.forEach((a, i) => {
        live.add(a.id);
        let c = cards.get(a.id);
        if (!c) { c = makeCard(a.id); cards.set(a.id, c); }
        syncCard(c, a, job, i, col.length);
        if (lists[stage].children[i] !== c.node) lists[stage].insertBefore(c.node, lists[stage].children[i] || null);
      });
    }
    for (const [id, c] of cards) if (!live.has(id)) { c.node.remove(); cards.delete(id); selected.delete(id); }
    if (held && held !== document.activeElement && held.isConnected && columns.contains(held)) {
      if (held.disabled) { const c = cards.get(held.closest('.card').dataset.application); (c.to.disabled ? c.name : c.to).focus(); } else held.focus();
    }
    syncBulk();
  }

  jobSelect.addEventListener('change', () => { jobId = jobSelect.value; keep.set('job', jobId); selected.clear(); alert.textContent = ''; update(boot); });
  const node = el('section', { class: 'page', 'data-view': 'board' }, [
    el('h1', { text: 'Pipeline board' }),
    el('div', { class: 'board-top' }, [el('label', { class: 'field inline' }, [el('span', { text: 'Job' }), jobSelect]), facts, undo]),
    status, alert, bulk,
    el('div', { class: 'board-wrap' }, [columns, detail]), forms]);

  function update(next) {
    boot = next;
    if (!boot.jobs.some((j) => j.id === jobId)) jobId = boot.jobs.length ? boot.jobs[0].id : '';
    const options = boot.jobs.map((j) => [j.id, `${j.title} · ${j.team}`]);
    const sig = JSON.stringify(options);
    if (jobSelect.dataset.sig !== sig) {
      jobSelect.dataset.sig = sig;
      jobSelect.replaceChildren(...options.map(([value, text]) => el('option', { value, text })));
    }
    jobSelect.value = jobId;
    if (managerSelect) {
      const managers = boot.users.filter((u) => u.role === 'hiring_manager');
      if (managerSelect.options.length !== managers.length) managerSelect.replaceChildren(...managers.map((u) => el('option', { value: u.id, text: u.name })));
    }
    const job = boot.jobs.find((j) => j.id === jobId);
    const name = (id) => (boot.users.find((u) => u.id === id) || {}).name || id;
    facts.textContent = job ? `Recruiter ${name(job.recruiter_id)} · Hiring manager ${name(job.manager_id)}` : 'No jobs are open yet.';
    undo.hidden = !boot.undo;
    if (boot.undo) undo.textContent = `Undo: ${boot.undo.summary}`;
    renderBoard();
    syncDetail();
  }
  return { label: 'Board', node, update };
};
