'use strict';
// Scripted golden observations for the HireOps recruiting workspace. API calls set up
// fixtures and check server rules; every browser behaviour is driven through the page.
// Not a configured judge run.
const fs = require('fs'), assert = require('assert/strict'), { spawn } = require('child_process');
const { chromium } = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const out = '/evidence/results'; fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:3000', db = '/tmp/hireops-workspace.db';
const results = [], errors = [], cookies = {};
const emails = { r: 'rafael.costa@hireops.example', r2: 'mei.lin@hireops.example', m: 'ingrid.sorensen@hireops.example', m2: 'bill.okafor@hireops.example',
  o: 'aud.halvorsen@hireops.example', c: 'noor.haddad@candidates.example', c2: 'tomas.varga@candidates.example', c3: 'lena.fischer@candidates.example' };
const sleep = (n) => new Promise((r) => setTimeout(r, n));
let child, browser, logs = '', serial = 0;

function launch() {
  child = spawn('node', ['/app/server.js'], { cwd: '/tmp', env: { PATH: process.env.PATH, HOME: '/tmp', NODE_PATH: '/usr/local/lib/node_modules', PORT: '3000', DB_PATH: db }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (b) => logs += b); child.stderr.on('data', (b) => logs += b);
}
async function healthy() { for (let i = 0; i < 200; i++) { try { if ((await fetch(base + '/api/health')).ok) return; } catch {} await sleep(50); } throw new Error('server did not start'); }
async function api(who, url, body) {
  const r = await fetch(base + url, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json', ...(who && cookies[who] ? { cookie: cookies[who] } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: r.status, data: await r.json().catch(() => null) };
}
async function ok(who, url, body) { const r = await api(who, url, body); assert.equal(r.status, 200, `${url} -> ${r.status} ${JSON.stringify(r.data)}`); return r.data; }
const record = (name, extra = {}) => { results.push({ name, passed: true, ...extra }); console.log('PASS', name); };
const boot = (who) => ok(who, '/api/bootstrap');
const card = async (who, id) => (await boot(who)).applications.find((a) => a.id === id);
const col = async (job, stage) => (await boot('o')).applications.filter((a) => a.job_id === job && a.stage === stage).sort((x, y) => x.position - y.position).map((a) => a.id);
async function job(limit = 3, manager = 'USR-MGR1') { return (await ok('r', '/api/jobs', { title: 'Role ' + (++serial), team: 'QA', manager_id: manager, interview_limit: limit })).id; }
async function add(jobId, name) { const n = name || 'Cand ' + (++serial); return (await ok('r', '/api/applications', { job_id: jobId, candidate_name: n, candidate_email: n.toLowerCase().replace(/\W+/g, '.') + '@mail.example', source: 'Careers page' })).id; }
async function move(who, id, to, extra = {}) { const a = await card('o', id); return api(who, `/api/applications/${id}/move`, { to_stage: to, version: a.version, ...extra }); }
async function advance(id, to) { const flow = ['APPLIED', 'SCREEN', 'INTERVIEW', 'OFFER', 'HIRED']; for (let i = 1; i <= flow.indexOf(to); i++) assert.equal((await move('r', id, flow[i])).status, 200); }

async function login(page, who) {
  if (!page.url().startsWith(base)) await page.goto(base);
  await page.getByLabel('Email', { exact: true }).fill(emails[who]);
  await page.getByLabel('Password').fill('Hireops!2026');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out' }).waitFor();
}
const colNames = (page, stage) => page.locator(`ol.cards[data-stage="${stage}"] .card-name`).allInnerTexts();

(async () => {
  try {
    launch(); await healthy();
    for (const [who, email] of Object.entries(emails)) {
      const r = await fetch(base + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password: 'Hireops!2026' }) });
      assert.equal(r.status, 200, who); cookies[who] = r.headers.get('set-cookie').split(';')[0];
    }

    // ---- seeded order and notes are loaded ------------------------------------------
    const names = async (job, stage) => (await boot('o')).applications.filter((a) => a.job_id === job && a.stage === stage).sort((x, y) => x.position - y.position).map((a) => a.candidate_name);
    assert.deepEqual(await names('JOB-PLAT', 'APPLIED'), ['Greta Lindqvist', 'Ade Bello', 'Marco Rossi']);
    assert.deepEqual(await names('JOB-PLAT', 'SCREEN'), ['Priya Nair', 'Samuel Ortiz']);
    assert.ok(JSON.stringify(await ok('r', '/api/applications/APP-101')).includes('Strong systems answers; weaker on incident follow-up.'));
    record('seeded card order and internal notes are loaded');

    // ---- server rules -------------------------------------------------------------
    const J = await job(2);
    const a1 = await add(J), a2 = await add(J), a3 = await add(J), a4 = await add(J);
    assert.deepEqual(await col(J, 'APPLIED'), [a1, a2, a3, a4]);
    assert.equal((await api('r', '/api/applications', { job_id: J, candidate_name: 'Dup', candidate_email: (await card('o', a1)).candidate_email.toUpperCase(), source: 'x' })).status, 409);
    assert.equal((await api('r', '/api/applications', { job_id: J, candidate_name: 'Bad', candidate_email: 'not-an-email', source: 'x' })).status, 400);
    assert.equal((await move('r', a1, 'INTERVIEW')).status, 409);                       // skips a stage
    { const BS = await job(2), bs = await add(BS); await advance(bs, 'INTERVIEW');
      assert.equal((await move('r', bs, 'APPLIED')).status, 409); assert.equal((await card('o', bs)).stage, 'INTERVIEW'); }   // backward skip
    assert.equal((await move('r', a1, 'SCREEN')).status, 200);
    assert.equal((await move('r', a1, 'APPLIED')).status, 200);                         // back one; lands at the end
    assert.deepEqual(await col(J, 'APPLIED'), [a2, a3, a4, a1]);
    assert.equal((await move('r', a1, 'APPLIED', { before_id: a2 })).status, 200);      // reorder to the top
    assert.deepEqual(await col(J, 'APPLIED'), [a1, a2, a3, a4]);
    assert.equal((await move('r', a1, 'REJECTED')).status, 400);                        // reason required
    assert.equal((await move('r', a1, 'REJECTED', { reason: '  ' })).status, 400);
    await advance(a1, 'INTERVIEW');
    assert.equal((await move('r', a1, 'REJECTED', { reason: 'Withdrew' })).status, 200);
    await ok('r', '/api/undo', { action_id: (await boot('r')).undo.action_id });         // undo the rejection
    { const back = await card('o', a1); assert.equal(back.stage, 'INTERVIEW'); assert.equal(back.reject_reason, null); assert.equal(back.rejected_from, null); }
    assert.equal((await move('r', a1, 'REJECTED', { reason: 'Withdrew' })).status, 200);
    assert.equal((await card('o', a1)).rejected_from, 'INTERVIEW');
    assert.equal((await move('r', a1, 'SCREEN')).status, 409);                          // reopen only to where they were
    assert.equal((await move('r', a1, 'INTERVIEW')).status, 200);
    assert.equal((await card('o', a1)).reject_reason, null);
    record('transitions: one stage at a time, back one, reject needs a reason, reopen returns to the rejected stage, ordering kept');

    await advance(a2, 'INTERVIEW');                                                      // interview now 2 of 2
    await advance(a3, 'SCREEN');
    const full = await move('r', a3, 'INTERVIEW'); assert.equal(full.status, 409); assert.equal(full.data.conflict, 'limit');
    assert.equal((await card('o', a3)).stage, 'SCREEN');
    assert.equal((await move('r', a2, 'INTERVIEW', { before_id: a1 })).status, 200);    // reorder inside a full Interview is allowed
    assert.deepEqual(await col(J, 'INTERVIEW'), [a2, a1]);
    assert.equal((await move('r', a1, 'OFFER')).status, 200);
    assert.equal((await move('r', a3, 'INTERVIEW')).status, 200);                       // a freed place can be taken
    record('interview places: refused when full, reorder inside allowed, freed place usable');

    const stale = await card('o', a4);
    assert.equal((await move('r2', a4, 'SCREEN')).status, 200);
    const late = await api('r', `/api/applications/${a4}/move`, { to_stage: 'SCREEN', version: stale.version });
    assert.equal(late.status, 409); assert.equal(late.data.conflict, 'stale'); assert.match(late.data.error, /Mei Lin/);
    assert.equal((await card('o', a4)).stage, 'SCREEN');
    record('a move made against an older version is refused and names who changed the card');

    // roles: manager of this job (m) works only between Interview, Offer, Hired; other manager, observer, candidate, anonymous refused
    assert.equal((await move('m', a4, 'APPLIED')).status, 403);
    assert.equal((await move('m', a1, 'HIRED')).status, 200);
    assert.equal((await move('m', a1, 'OFFER')).status, 200);
    assert.equal((await move('m', a1, 'INTERVIEW')).status, 409);                       // full (a2, a3)
    assert.equal((await move('m', a2, 'SCREEN')).status, 403);
    assert.equal((await move('m', a2, 'REJECTED', { reason: 'Panel declined' })).status, 200);
    assert.equal((await move('m', a2, 'INTERVIEW')).status, 200);
    assert.equal((await move('m2', a1, 'HIRED')).status, 403);
    assert.equal((await move('o', a1, 'HIRED')).status, 403);
    assert.equal((await move('c', a1, 'HIRED')).status, 404);                           // not hers: not even its existence
    assert.equal((await api('c', '/api/applications/APP-999/move', { to_stage: 'HIRED', version: 1 })).status, 404);
    assert.equal((await api('c', '/api/applications/APP-101/move', { to_stage: 'OFFER', version: 1 })).status, 403);   // her own: refused
    assert.equal((await api('c', '/api/moves/bulk', { items: [{ id: a1, version: 1 }, { id: a2, version: 1 }], to_stage: 'SCREEN' })).status, 404);
    assert.equal((await api(null, `/api/applications/${a1}/move`, { to_stage: 'HIRED', version: 1 })).status, 401);
    for (const u of ['/api/bootstrap', `/api/applications/${a1}`, `/api/applications/${a1}/messages`]) assert.equal((await api(null, u)).status, 401);
    assert.equal((await api('m', '/api/jobs', { title: 'x', team: 'y', manager_id: 'USR-MGR1', interview_limit: 2 })).status, 403);
    assert.equal((await api('o', '/api/applications', { job_id: J, candidate_name: 'x', candidate_email: 'x@y.example', source: 's' })).status, 403);
    for (const who of ['o', 'c']) {                                                         // multi-card move and undo refused too
      const r1 = await api(who, '/api/moves/bulk', { items: [{ id: a3, version: (await card('o', a3)).version }, { id: a4, version: (await card('o', a4)).version }], to_stage: 'SCREEN' });
      assert.ok(r1.status === 403 || r1.status === 404, `${who} bulk ${r1.status}`);
      assert.equal((await api(who, '/api/undo', { action_id: 1 })).status, 403);
      const rj = await move(who, a4, 'REJECTED', { reason: 'Replay' });                     // reject: Observer 403, candidate 404 (not hers)
      assert.equal(rj.status, who === 'o' ? 403 : 404);
    }
    assert.equal((await api(null, '/api/moves/bulk', { items: [], to_stage: 'SCREEN' })).status, 401);
    assert.equal((await api(null, '/api/undo', { action_id: 1 })).status, 401);
    assert.equal((await card('o', a1)).stage, 'OFFER');
    record('roles: hiring manager limited to own job and Interview/Offer/Hired; observer (403), candidate (403, or 404 for others) and anonymous (401) refused, including reject');

    // undo of a reopening restores the reason; undo into a full Interview is refused; manager re-orders late stages
    const Q = await job(1), q1 = await add(Q), q2 = await add(Q), q3 = await add(Q);
    assert.equal((await move('r', q1, 'REJECTED', { reason: 'No visa' })).status, 200);
    assert.equal((await move('r', q1, 'APPLIED')).status, 200);
    await ok('r', '/api/undo', { action_id: (await boot('r')).undo.action_id });
    assert.equal((await card('o', q1)).stage, 'REJECTED'); assert.equal((await card('o', q1)).reject_reason, 'No visa');
    await advance(q2, 'SCREEN'); await advance(q3, 'INTERVIEW');                         // Interview 1 of 1
    assert.equal((await move('r', q3, 'SCREEN')).status, 200);                            // Rafael's latest move frees the place
    assert.equal((await move('r2', q2, 'INTERVIEW')).status, 200);                        // Mei takes it with another card
    const full2 = await api('r', '/api/undo', { action_id: (await boot('r')).undo.action_id });
    assert.equal(full2.status, 409); assert.equal(full2.data.conflict, 'limit');
    assert.deepEqual(await col(Q, 'INTERVIEW'), [q2]); assert.equal((await card('o', q3)).stage, 'SCREEN');
    record('undo of a reopening restores the reason; undo that would overfill Interview is refused');

    // bulk: all or none; undo restores stage and place; undo refused after someone else changes a card
    const K = await job(2);
    const b = []; for (let i = 0; i < 5; i++) b.push(await add(K));
    const items = async (ids) => Promise.all(ids.map(async (id) => ({ id, version: (await card('o', id)).version })));
    assert.equal((await api('r', '/api/moves/bulk', { items: await items([b[1], b[3]]), to_stage: 'SCREEN' })).status, 200);
    assert.deepEqual(await col(K, 'SCREEN'), [b[1], b[3]]); assert.deepEqual(await col(K, 'APPLIED'), [b[0], b[2], b[4]]);
    assert.equal((await ok('r', '/api/undo', { action_id: (await boot('r')).undo.action_id })).restored.length, 2);
    assert.deepEqual(await col(K, 'APPLIED'), b); assert.deepEqual(await col(K, 'SCREEN'), []);
    assert.equal((await boot('r')).undo, null);
    assert.equal((await api('r', '/api/moves/bulk', { items: await items([b[0], b[1], b[2]]), to_stage: 'SCREEN' })).status, 200);
    const mixed = await api('r', '/api/moves/bulk', { items: await items([b[0], b[3]]), to_stage: 'INTERVIEW' });   // b[3] would skip a stage
    assert.equal(mixed.status, 409); assert.deepEqual(await col(K, 'INTERVIEW'), []); assert.deepEqual(await col(K, 'SCREEN'), [b[0], b[1], b[2]]);
    const over = await api('r', '/api/moves/bulk', { items: await items([b[0], b[1], b[2]]), to_stage: 'INTERVIEW' });  // three into two places
    assert.equal(over.status, 409); assert.equal(over.data.conflict, 'limit'); assert.deepEqual(await col(K, 'INTERVIEW'), []);
    assert.equal((await api('r', '/api/moves/bulk', { items: await items([b[2], b[0]]), to_stage: 'INTERVIEW' })).status, 200);
    assert.deepEqual(await col(K, 'INTERVIEW'), [b[0], b[2]]);                         // board order, not request order
    const lastBad = await api('r', '/api/moves/bulk', { items: await items([b[0], b[1]]), to_stage: 'APPLIED' });   // b[0] (Interview, later in board order) would skip
    assert.equal(lastBad.status, 409); assert.deepEqual(await col(K, 'INTERVIEW'), [b[0], b[2]]); assert.deepEqual(await col(K, 'SCREEN'), [b[1]]);
    const undoId = (await boot('r')).undo.action_id;
    assert.equal((await api('r2', '/api/undo', { action_id: undoId })).status, 409);    // not theirs
    assert.equal((await move('r2', b[0], 'OFFER')).status, 200);                        // someone else changes one of the cards
    const refused = await api('r', '/api/undo', { action_id: undoId }); assert.equal(refused.status, 409);
    assert.deepEqual(await col(K, 'INTERVIEW'), [b[2]]); assert.deepEqual(await col(K, 'OFFER'), [b[0]]);
    const act = (await boot('o')).activity.filter((x) => x.job_id === K).map((x) => x.kind);
    assert.ok(act.includes('UNDONE') && act.includes('MOVED') && act.includes('ADDED'));
    record('bulk move is all-or-nothing and counts interview places for the whole set; undo restores stage and place, is single-use, own-only and refused after a later change');

    // board order after a hand re-order, mixed-stage sets, and only the latest move is undoable
    const G = await job(2), g = []; for (let i = 0; i < 6; i++) g.push(await add(G));       // v w x y z a2
    assert.equal((await move('r', g[0], 'SCREEN')).status, 200);
    assert.equal((await move('r', g[3], 'APPLIED', { before_id: g[1] })).status, 200);       // y up two places
    assert.deepEqual(await col(G, 'APPLIED'), [g[3], g[1], g[2], g[4], g[5]]);
    assert.equal((await api('r', '/api/moves/bulk', { items: await items([g[1], g[2], g[3]]), to_stage: 'SCREEN' })).status, 200);
    assert.deepEqual(await col(G, 'SCREEN'), [g[0], g[3], g[1], g[2]]);                      // board order y, w, x
    const bulkUndo = (await boot('r')).undo.action_id;
    await ok('r', '/api/undo', { action_id: bulkUndo });
    assert.deepEqual(await col(G, 'APPLIED'), [g[3], g[1], g[2], g[4], g[5]]);
    assert.equal((await api('r', '/api/undo', { action_id: bulkUndo })).status, 409);
    assert.equal((await move('r', g[4], 'SCREEN')).status, 200);
    const zUndo = (await boot('r')).undo.action_id;
    assert.equal((await move('r', g[5], 'SCREEN')).status, 200);
    await ok('r', `/api/applications/${g[5]}/notes`, { body: 'Note before undo' });         // a note is not a change
    assert.equal((await api('r', '/api/undo', { action_id: zUndo })).status, 409);           // an earlier move is no longer undoable
    await ok('r', '/api/undo', { action_id: (await boot('r')).undo.action_id });
    assert.equal((await boot('r')).undo, null);
    assert.equal((await card('o', g[4])).stage, 'SCREEN'); assert.equal((await card('o', g[5])).stage, 'APPLIED');
    await advance(g[0], 'INTERVIEW');
    assert.equal((await api('r', '/api/moves/bulk', { items: await items([g[0], g[5]]), to_stage: 'SCREEN' })).status, 200);
    assert.deepEqual((await col(G, 'SCREEN')).slice(-2), [g[5], g[0]]);                      // Applied card first, then Interview card
    assert.equal((await api('r', '/api/moves/bulk', { items: await items([g[3], g[1]]), to_stage: 'APPLIED' })).status, 200);
    const reorderUndo = (await boot('r')).undo.action_id;
    const appliedNow = await col(G, 'APPLIED'), wPos = appliedNow.indexOf(g[1]);
    assert.equal((await move('r2', g[1], 'APPLIED', { before_id: appliedNow[wPos - 1] })).status, 200);   // Mei only re-orders W
    const afterReorder = await col(G, 'APPLIED');
    assert.equal((await api('r', '/api/undo', { action_id: reorderUndo })).status, 409);    // a re-order also blocks undo
    assert.deepEqual(await col(G, 'APPLIED'), afterReorder);
    record('several together arrive in board order after a hand re-order and from mixed stages; only the latest move can be undone');

    // a hiring manager cannot move back to Screen, reject from Screen or re-order Rejected
    const H = await job(2), h = []; for (let i = 0; i < 3; i++) h.push(await add(H));
    await advance(h[0], 'INTERVIEW'); await advance(h[1], 'SCREEN');
    assert.equal((await move('m', h[0], 'SCREEN')).status, 403);
    assert.equal((await move('m', h[1], 'REJECTED', { reason: 'No' })).status, 403);
    await advance(h[2], 'INTERVIEW');
    assert.equal((await move('m', h[0], 'REJECTED', { reason: 'Panel' })).status, 200);
    assert.equal((await move('m', h[2], 'REJECTED', { reason: 'Panel' })).status, 200);
    assert.equal((await move('m', h[2], 'REJECTED', { before_id: h[0] })).status, 403);
    assert.equal((await move('r', h[2], 'REJECTED', { before_id: h[0] })).status, 200);
    record('hiring manager: Interview to Screen, rejecting from Screen and re-ordering Rejected are refused; a recruiter may re-order Rejected');

    // more manager limits; undo controls: unrelated change allows undo, a reject blocks it, freed room allows it
    const M2 = await job(2), m = []; for (let i = 0; i < 4; i++) m.push(await add(M2));
    await advance(m[0], 'OFFER'); await advance(m[1], 'SCREEN');
    assert.equal((await move('m', m[0], 'REJECTED', { reason: 'Declined offer' })).status, 200);   // manager rejects from Offer
    assert.equal((await move('m', m[0], 'OFFER')).status, 200);
    assert.equal((await move('m', m[3], 'APPLIED', { before_id: m[2] })).status, 403);          // no re-order in Applied
    assert.equal((await move('r', m[1], 'REJECTED', { reason: 'Not now' })).status, 200);
    assert.equal((await move('m', m[1], 'SCREEN')).status, 403);                                // no reopen of a Screen rejection
    for (const elsewhere of ['APPLIED', 'INTERVIEW']) {                                          // reopen only to Screen, both directions
      assert.notEqual((await move('r', m[1], elsewhere)).status, 200);
      { const c = await card('o', m[1]); assert.equal(c.stage, 'REJECTED'); assert.equal(c.rejected_from, 'SCREEN'); assert.equal(c.reject_reason, 'Not now'); }
    }
    assert.equal((await move('r', m[1], 'SCREEN')).status, 200);
    assert.equal((await move('r', m[2], 'SCREEN')).status, 200);
    const u1 = (await boot('r')).undo.action_id;
    assert.equal((await move('r2', m[3], 'SCREEN')).status, 200);                               // a different card changes
    assert.equal((await api('r', '/api/undo', { action_id: u1 })).status, 200);                  // undo still goes ahead
    assert.equal((await move('r', m[2], 'SCREEN')).status, 200);
    const u2 = (await boot('r')).undo.action_id;
    assert.equal((await move('r2', m[2], 'REJECTED', { reason: 'Withdrew' })).status, 200);     // someone rejects that card
    assert.equal((await api('r', '/api/undo', { action_id: u2 })).status, 409);
    assert.equal((await move('r', m[3], 'REJECTED', { reason: 'Hold' })).status, 200);       // Rafael rejects a card
    const u3 = (await boot('r')).undo.action_id;
    assert.equal((await move('r2', m[3], 'SCREEN')).status, 200);                               // a colleague reopens it
    assert.equal((await api('r', '/api/undo', { action_id: u3 })).status, 409);                  // the rejection can't be undone
    { const c = await card('o', m[3]); assert.equal(c.stage, 'SCREEN'); assert.equal(c.reject_reason, null); }
    record('manager may reject from Offer but not re-order Applied or reopen a Screen rejection; undo ignores other cards, is blocked by a reject or by a colleague reopening the card');

    // undo into a full Interview is refused, then goes ahead once a place is free
    const F4 = await job(1), q4 = [await add(F4), await add(F4)];
    await advance(q4[1], 'SCREEN'); await advance(q4[0], 'INTERVIEW');
    assert.equal((await move('r', q4[0], 'SCREEN')).status, 200);
    const uq = (await boot('r')).undo.action_id;
    assert.equal((await move('r2', q4[1], 'INTERVIEW')).status, 200);                           // Mei takes the place
    assert.equal((await api('r', '/api/undo', { action_id: uq })).status, 409);                 // full
    assert.equal((await move('r2', q4[1], 'OFFER')).status, 200);                               // Mei frees it
    assert.equal((await api('r', '/api/undo', { action_id: uq })).status, 200);                 // now it goes ahead
    assert.equal((await card('o', q4[0])).stage, 'INTERVIEW');
    // reopening counts against Interview places too
    const F5 = await job(1), q5 = [await add(F5), await add(F5)];
    await advance(q5[0], 'INTERVIEW');
    assert.equal((await move('r', q5[0], 'REJECTED', { reason: 'Paused' })).status, 200);
    await advance(q5[1], 'INTERVIEW');                                                          // 1 of 1 again
    assert.equal((await move('r', q5[0], 'INTERVIEW')).status, 409);                           // reopening would overfill
    assert.equal((await card('o', q5[0])).stage, 'REJECTED');
    assert.equal((await move('r', q5[1], 'OFFER')).status, 200);
    assert.equal((await move('r', q5[0], 'INTERVIEW')).status, 200);                           // a place is free
    record('undo into a full Interview is refused and goes ahead once a place is free; a reopening into a full Interview is refused');

    // conversations: access, unread, seen, candidate privacy
    const noor = await boot('c');
    assert.deepEqual(Object.keys(noor).sort(), ['applications', 'page_size', 'user']);
    assert.deepEqual(noor.applications.map((x) => [x.id, x.status]), [['APP-101', 'Interviewing'], ['APP-302', 'Application received']]);
    assert.ok(!JSON.stringify(noor).match(/reject|note|position|version|Ivo|Tomas|candidate_email/i));
    assert.equal((await boot('c2')).applications[0].status, 'In review');
    assert.equal((await api('c', '/api/applications/APP-201/messages')).status, 404);
    assert.equal((await api('c', '/api/applications/APP-101')).status, 403);
    assert.equal((await api('c', '/api/applications/APP-101/notes', { body: 'x' })).status, 403);
    assert.equal((await api('c', '/api/applications/APP-201')).status, 404);                 // not hers: told it does not exist
    assert.equal((await api('c', '/api/applications/APP-201/notes', { body: 'x' })).status, 404);
    assert.equal((await api('o', '/api/applications/APP-201/notes', { body: 'x' })).status, 403);
    assert.equal((await api('m2', '/api/applications/APP-101/messages')).status, 403);  // another manager's job
    assert.equal((await api('m', '/api/applications/APP-101/messages')).status, 200);
    assert.equal((await api('o', '/api/applications/APP-101/messages', { body: 'hello' })).status, 403);
    assert.equal((await api('m2', '/api/applications/APP-101/messages', { body: 'hello' })).status, 403);   // another job's manager
    assert.equal((await api('c', '/api/applications/APP-201/messages', { body: 'hello' })).status, 404);    // not her conversation
    assert.equal((await api('r', '/api/applications/APP-101/messages', { body: '   ' })).status, 400);
    const first = await ok('r', '/api/applications/APP-101/messages');
    assert.equal(first.messages.length, 30); assert.equal(first.earlier_count, 90);
    const older = await ok('r', `/api/applications/APP-101/messages?before=${first.messages[0].id}`);
    assert.equal(older.messages.length, 30); assert.equal(older.earlier_count, 60); assert.ok(older.messages[29].id < first.messages[0].id);
    assert.equal((await card('r2', 'APP-201')).unread, 2);                               // Mei read 1 of 3, two from Tomas
    record('candidate read model is private; thread access by role; thread paging 30 at a time');
    assert.equal((await card('r', 'APP-201')).unread, 3);
    const sent = await ok('r', '/api/applications/APP-201/messages', { body: 'Hello from Rafael\nsecond line' });
    assert.equal((await card('r', 'APP-201')).unread, 0);                                // sending reads the thread for the sender
    assert.equal((await card('r2', 'APP-201')).unread, 3);                               // Mei: two from Tomas plus Rafael's
    assert.equal((await boot('c2')).applications[0].unread, 1);
    let mine = (await ok('r', '/api/applications/APP-201/messages')).messages.find((m) => m.id === sent.id);
    assert.equal(mine.seen, false); assert.equal(mine.body, 'Hello from Rafael\nsecond line');
    await ok('o', '/api/applications/APP-201/read', {});                                 // the observer opening it is not the other side
    assert.equal((await ok('r', '/api/applications/APP-201/messages')).messages.find((m) => m.id === sent.id).seen, false);
    await ok('c2', '/api/applications/APP-201/read', {});
    assert.equal((await ok('r', '/api/applications/APP-201/messages')).messages.find((m) => m.id === sent.id).seen, true);
    assert.equal((await boot('c2')).applications[0].unread, 0);
    record('unread counts per person, own messages never unread, seen only when the other side opens');
    await ok('c2', '/api/applications/APP-201/messages', { body: 'Question for the panel' });
    await ok('m2', '/api/applications/APP-201/read', {});                                    // the job's hiring manager opens it
    assert.equal((await ok('c2', '/api/applications/APP-201/messages')).messages.pop().seen, true);
    record('the hiring manager of the job opening the conversation marks the candidate message seen');

    // ---- browser ------------------------------------------------------------------
    browser = await chromium.launch({ headless: true, executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } }), page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(base);
    await page.getByLabel('Email', { exact: true }).fill(emails.r); await page.getByLabel('Password').fill('wrong');
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await page.getByText(/do not match/).waitFor();
    await login(page, 'r');
    await page.getByRole('heading', { name: 'Pipeline board' }).waitFor();

    // gate: add a candidate to a seeded job, reload, read it back as the Observer
    await page.locator('#board-job').selectOption('JOB-DATA');
    await page.getByLabel('Candidate name').fill('Gate Probe'); await page.getByLabel('Candidate email').fill('gate.probe@mail.example');
    await page.getByRole('button', { name: 'Add candidate', exact: true }).click();
    await page.getByText('Gate Probe was added to Applied.').waitFor();
    await page.reload(); await page.getByRole('heading', { name: 'Pipeline board' }).waitFor();
    assert.ok((await colNames(page, 'APPLIED')).includes('Gate Probe'));                   // still signed in, card kept
    {
      const gctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }), gate = await gctx.newPage();
      await login(gate, 'o'); await gate.getByRole('heading', { name: 'Pipeline board' }).waitFor();
      await gate.locator('#board-job').selectOption('JOB-DATA');
      assert.equal((await colNames(gate, 'APPLIED')).filter((n) => n === 'Gate Probe').length, 1);
      await gctx.close();
    }
    record('gate: a candidate added to a seeded job survives a reload and is read back by the Observer in another context');

    // open a job, add candidates, move with the control, order, optimistic refusal put back
    await page.getByLabel('Job title').fill('Browser Role'); await page.getByLabel('Team').fill('Web');
    await page.getByLabel('Hiring manager').selectOption({ label: 'Ingrid Sorensen' }); await page.getByLabel('Interview places').fill('1');
    await page.getByRole('button', { name: 'Open job', exact: true }).click();
    await page.getByText('Browser Role is open.').waitFor();
    const B = (await boot('r')).jobs.find((j) => j.title === 'Browser Role').id;
    for (const n of ['Ana One', 'Ben Two', 'Cy Three', 'Di Four']) {
      await page.getByLabel('Candidate name').fill(n); await page.getByLabel('Candidate email').fill(n.replace(' ', '.').toLowerCase() + '@mail.example');
      await page.getByRole('button', { name: 'Add candidate', exact: true }).click();
      await page.getByText(`${n} was added to Applied.`).waitFor();
    }
    assert.deepEqual(await colNames(page, 'APPLIED'), ['Ana One', 'Ben Two', 'Cy Three', 'Di Four']);
    await page.getByLabel('Candidate name').fill('Ana Again'); await page.getByLabel('Candidate email').fill('ana.one@mail.example');
    await page.getByLabel('Source').fill('Referral desk');
    await page.getByRole('button', { name: 'Add candidate', exact: true }).click();
    await page.getByText('This person has already applied to this job.').waitFor();
    assert.equal(await page.getByLabel('Candidate email').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.getByLabel('Candidate name').inputValue(), 'Ana Again');
    assert.equal(await page.getByLabel('Candidate email').inputValue(), 'ana.one@mail.example');   // what was typed stays
    assert.equal(await page.getByLabel('Source').inputValue(), 'Referral desk');
    await page.getByLabel('Candidate name').fill(''); await page.getByLabel('Candidate email').fill('');
    await page.getByRole('button', { name: 'Move Cy Three up' }).click();
    await page.waitForFunction(() => [...document.querySelectorAll('ol.cards[data-stage="APPLIED"] .card-name')].map((n) => n.textContent).join() === 'Ana One,Cy Three,Ben Two,Di Four');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Move Cy Three up');
    const ids = Object.fromEntries((await boot('r')).applications.filter((a) => a.job_id === B).map((a) => [a.candidate_name, a.id]));
    async function uiMove(name, stage) { await page.getByLabel(`Move ${name} to`, { exact: true }).selectOption(stage); await page.getByRole('button', { name: `Move ${name}`, exact: true }).click(); }
    await uiMove('Ana One', 'SCREEN'); await page.locator('ol.cards[data-stage="SCREEN"]').getByText('Ana One').waitFor();
    await uiMove('Ana One', 'INTERVIEW'); await page.locator('ol.cards[data-stage="INTERVIEW"]').getByText('Ana One').waitFor();
    await page.getByRole('heading', { name: 'Interview (1 of 1 places)' }).waitFor();
    await uiMove('Ben Two', 'SCREEN'); await page.locator('ol.cards[data-stage="SCREEN"]').getByText('Ben Two').waitFor();
    await uiMove('Ben Two', 'INTERVIEW');
    await page.getByRole('alert').filter({ hasText: /Interview is full/ }).waitFor();
    assert.deepEqual(await colNames(page, 'SCREEN'), ['Ben Two']); assert.deepEqual(await colNames(page, 'INTERVIEW'), ['Ana One']);
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Move Ben Two to');
    record('board: open a job, add candidates, duplicate email marked at the field, reorder, move by control, full Interview put back with the reason and focus on the card');
    await page.screenshot({ path: out + '/board.png', fullPage: true });

    // stale move from this page after someone else moved the card
    await ctx.route('**/api/events', (r) => r.abort());          // hold live updates so the page really is out of date
    await page.reload(); await page.getByRole('heading', { name: 'Pipeline board' }).waitFor(); await page.getByLabel('Move Cy Three to', { exact: true }).waitFor();
    assert.equal((await move('r2', ids['Cy Three'], 'SCREEN')).status, 200);
    await page.getByLabel('Move Cy Three to', { exact: true }).selectOption('REJECTED');
    await page.getByLabel('Reason for rejecting Cy Three').fill('Not a fit');
    await page.getByRole('button', { name: 'Move Cy Three', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: /changed by someone else.*Mei Lin/ }).waitFor();
    await page.locator('ol.cards[data-stage="SCREEN"]').getByText('Cy Three').waitFor();
    assert.deepEqual(await colNames(page, 'REJECTED'), []);
    await ctx.unroute('**/api/events'); await page.reload(); await page.getByLabel('Move Cy Three to', { exact: true }).waitFor();
    record('stale move from an out-of-date board is refused, explained with who moved it, and the card shows where it really is');

    // bulk + undo through the page
    await page.getByLabel('Select Ben Two').check(); await page.getByLabel('Select Cy Three').check();
    await page.getByLabel('Move selected candidates to').selectOption('APPLIED');
    await page.getByRole('button', { name: 'Move selected', exact: true }).click();
    await page.getByText('2 candidates moved together.').waitFor();
    assert.deepEqual(await colNames(page, 'APPLIED'), ['Di Four', 'Ben Two', 'Cy Three']);
    await page.getByRole('button', { name: /^Undo: Rafael Costa moved 2 candidates to Applied/ }).click();
    await page.getByText(/Undone/).waitFor();
    assert.deepEqual(await colNames(page, 'SCREEN'), ['Ben Two', 'Cy Three']); assert.deepEqual(await colNames(page, 'APPLIED'), ['Di Four']);
    assert.equal(await page.getByRole('button', { name: /^Undo:/ }).count(), 0);
    record('bulk move and undo through the page');

    // live board: another person's move arrives; open detail and note draft stay
    await page.getByRole('button', { name: 'Di Four', exact: true }).click();
    const note = page.getByLabel('Add an internal note');
    await note.pressSequentially('Call back on Fri');
    const t0 = Date.now();
    assert.equal((await move('r2', ids['Di Four'], 'SCREEN')).status, 200);
    await page.locator('ol.cards[data-stage="SCREEN"]').getByText('Di Four').waitFor({ timeout: 10000 });
    const arrival = Date.now() - t0;
    assert.equal(await note.inputValue(), 'Call back on Fri');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Add an internal note');
    await page.getByRole('complementary', { name: 'Candidate details' }).getByText('Screen', { exact: true }).waitFor();
    await note.pressSequentially('day'); assert.equal(await note.inputValue(), 'Call back on Friday');
    await page.reload(); await page.getByRole('button', { name: 'Di Four', exact: true }).click();
    assert.equal(await page.getByLabel('Add an internal note').inputValue(), 'Call back on Friday');
    await page.getByRole('button', { name: 'Add note', exact: true }).click();
    await page.getByRole('list', { name: 'Internal notes' }).getByText('Call back on Friday').waitFor();
    assert.equal(await page.getByLabel('Add an internal note').inputValue(), '');
    record('live board: another person\'s move arrives without reload; open card, note draft and focus kept; draft survives reload', { arrival_ms: arrival });

    // conversations: long thread, load earlier keeps place, live arrival while reading and typing
    await page.getByRole('button', { name: /^Conversations/ }).click();
    await page.getByRole('button', { name: /Noor Haddad.*Platform Engineer/s }).click();
    const logBox = page.getByRole('list', { name: 'Messages' });
    await logBox.locator('li').nth(29).waitFor();
    assert.equal(await logBox.locator('li').count(), 30);
    await logBox.getByText('(#120)').waitFor();
    assert.ok(await logBox.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight < 5));
    await logBox.evaluate((n) => { n.scrollTop = 0; });
    const topBefore = await logBox.locator('li').first().evaluate((n) => n.getBoundingClientRect().top);
    await page.getByRole('button', { name: 'Show earlier messages (90 more)' }).click();
    await page.getByRole('button', { name: 'Show earlier messages (60 more)' }).waitFor();
    assert.equal(await logBox.locator('li').count(), 60);
    const topAfter = await logBox.locator('li').nth(30).evaluate((n) => n.getBoundingClientRect().top);
    assert.ok(Math.abs(topAfter - topBefore) < 2, `kept place ${topBefore} -> ${topAfter}`);
    const bodies = await logBox.locator('li .body').allInnerTexts();
    assert.match(bodies[0], /\((#061)\)/); assert.match(bodies[59], /\((#120)\)/);
    const composer = page.getByLabel('Write a message');
    await composer.click(); await composer.pressSequentially('Draft in prog');
    const scrollMid = await logBox.evaluate((n) => { n.scrollTop = 400; return n.scrollTop; });
    const m1 = await ok('c', '/api/applications/APP-101/messages', { body: 'Live from Noor' });
    await page.getByRole('button', { name: '1 new message', exact: true }).waitFor({ timeout: 10000 });
    assert.equal(await composer.inputValue(), 'Draft in prog');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Write a message');
    assert.equal(await logBox.evaluate((n) => n.scrollTop), scrollMid);
    assert.equal((await card('r', 'APP-101')).unread, 1);                               // not read while reading earlier messages
    await composer.pressSequentially('ress'); assert.equal(await composer.inputValue(), 'Draft in progress');
    await page.getByRole('button', { name: '1 new message', exact: true }).click();
    await logBox.getByText('Live from Noor').waitFor();
    assert.ok(await logBox.evaluate((n) => n.scrollHeight - n.scrollTop - n.clientHeight < 5));
    await page.waitForFunction(() => !document.querySelector('.new-pill') || document.querySelector('.new-pill').hidden);
    await sleep(300); assert.equal((await card('r', 'APP-101')).unread, 0);
    record('conversation: latest 30 shown, earlier messages load in order and keep place; arrival while reading keeps draft, focus and scroll and is not marked read until viewed', { message: m1.id });
    await page.screenshot({ path: out + '/conversation.png', fullPage: true });

    // drafts per conversation; Enter sends, Shift+Enter makes a line; seen receipt live; list order and unread badge
    await page.getByRole('button', { name: /Tomas Varga.*Data Analyst/s }).click();
    await page.getByRole('heading', { name: 'Tomas Varga' }).waitFor();
    assert.equal(await composer.inputValue(), '');
    await composer.fill('For Tomas only');
    await page.getByRole('button', { name: /Noor Haddad.*Platform Engineer/s }).click();
    await page.getByRole('heading', { name: 'Noor Haddad' }).waitFor();
    assert.equal(await composer.inputValue(), 'Draft in progress');
    await page.reload(); await page.getByRole('heading', { name: 'Noor Haddad' }).waitFor();
    assert.equal(await composer.inputValue(), 'Draft in progress');
    await composer.fill('<b>plain</b> Line one'); await composer.press('Shift+Enter'); await composer.pressSequentially('line two');
    assert.equal(await composer.inputValue(), '<b>plain</b> Line one\nline two');
    await composer.press('Enter');
    await logBox.getByText('Line one').waitFor();
    assert.equal(await composer.inputValue(), '');
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute('aria-label')), 'Write a message');
    assert.equal(await logBox.locator('li').last().locator('.receipt').innerText(), 'Sent');
    assert.match(await logBox.locator('li').last().locator('.body').innerText(), /<b>plain<\/b> Line one\nline two/);
    assert.equal(await logBox.locator('li').last().locator('.body b').count(), 0);           // plain text, not markup
    await page.reload(); await page.getByRole('heading', { name: 'Noor Haddad' }).waitFor();
    await logBox.getByText('Line one').waitFor();
    assert.equal(await composer.inputValue(), '');                                       // a sent reply does not come back
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } }), cand = await ctx2.newPage();
    cand.on('pageerror', (e) => errors.push(e.message));
    await login(cand, 'c');
    await cand.getByRole('heading', { name: 'My applications' }).waitFor();
    assert.equal(await cand.getByRole('button', { name: /Board|Activity/ }).count(), 0);
    await cand.getByRole('button', { name: /Platform Engineer/ }).click();
    await cand.getByRole('list', { name: 'Messages' }).getByText('Line one').waitFor();
    await cand.getByText('Status: Interviewing').waitFor();
    await page.waitForFunction(() => { const r = [...document.querySelectorAll('.messages li')].pop().querySelector('.receipt'); return r && r.textContent === 'Seen'; }, null, { timeout: 10000 });
    const navTotal = async () => Number((await page.locator('#nav button[data-view="threads"] .badge').textContent()) || 0);
    const navBefore = await navTotal();
    await cand.getByLabel('Write a message').fill('Reply from Noor'); await cand.getByLabel('Write a message').press('Enter');
    await logBox.getByText('Reply from Noor').waitFor({ timeout: 10000 });               // at the bottom: appended and read
    for (let i = 0; i < 25; i++) { assert.ok((await navTotal()) <= navBefore, 'nav total rose while the conversation was open at its newest'); await sleep(100); }
    await sleep(500); assert.equal((await card('r', 'APP-101')).unread, 0);
    await ok('c2', '/api/applications/APP-201/messages', { body: 'Tomas again' });
    await page.getByRole('button', { name: /Tomas Varga.*Data Analyst/s }).locator('.badge').filter({ hasText: '1' }).waitFor({ timeout: 10000 });
    assert.match(await page.locator('.thread-list li').first().innerText(), /Tomas Varga/);
    await page.getByRole('button', { name: /^Conversations/ }).locator('.badge').filter({ hasText: /^[1-9]/ }).waitFor();
    assert.equal(await composer.inputValue(), '');
    record('drafts kept per conversation across switch and reload; Enter sends, Shift+Enter adds a line; seen receipt and unread badges update live; candidate sees only own applications');
    await cand.screenshot({ path: out + '/candidate.png', fullPage: true });

    // a candidate with one application: signing in opens nothing, so her unread count stays
    assert.equal((await boot('c3')).applications[0].unread, 1);
    const ctx4 = await browser.newContext({ viewport: { width: 1280, height: 900 } }), lena = await ctx4.newPage();
    lena.on('pageerror', (e) => errors.push(e.message));
    await login(lena, 'c3'); await lena.getByRole('heading', { name: 'My applications' }).waitFor();
    await lena.getByRole('button', { name: /Product Designer/ }).locator('.badge').filter({ hasText: '1' }).waitFor();
    await sleep(1500); assert.equal((await boot('c3')).applications[0].unread, 1);
    await lena.getByRole('button', { name: /Product Designer/ }).click();                 // choosing it reads it
    await lena.getByRole('list', { name: 'Messages' }).locator('li').first().waitFor();
    await sleep(800); assert.equal((await boot('c3')).applications[0].unread, 0);
    await lena.getByRole('button', { name: 'Sign out' }).click(); await lena.getByLabel('Email', { exact: true }).waitFor();
    await ok('r', '/api/applications/APP-301/messages', { body: 'A note for Lena' });
    await login(lena, 'c3'); await lena.getByRole('heading', { name: 'My applications' }).waitFor();
    await sleep(1500); assert.equal((await boot('c3')).applications[0].unread, 1);       // signing in again opens nothing
    await ctx4.close();
    record('a candidate with a single application signs in without the conversation being opened or marked read');

    // session ends mid-draft; another person sees nothing; the same person resumes
    await page.getByRole('button', { name: /Tomas Varga.*Data Analyst/s }).click();
    await page.getByRole('heading', { name: 'Tomas Varga' }).waitFor();
    assert.equal(await composer.inputValue(), 'For Tomas only');
    const tab = await ctx.newPage(); await tab.goto(base);
    await tab.getByRole('button', { name: 'Sign out' }).click(); await tab.getByLabel('Email', { exact: true }).waitFor(); await tab.close();
    await composer.press('Enter');
    await page.getByText(/Your session has ended/).waitFor();
    assert.equal((await ok('o', '/api/applications/APP-201/messages')).messages.some((m) => m.body === 'For Tomas only'), false);
    await login(page, 'r');
    await page.getByRole('heading', { name: 'Tomas Varga' }).waitFor();
    assert.equal(await page.getByLabel('Write a message').inputValue(), 'For Tomas only');
    await page.getByLabel('Write a message').press('Enter');
    await page.getByRole('list', { name: 'Messages' }).getByText('For Tomas only').waitFor();
    await page.getByLabel('Write a message').fill('Second unsent for Tomas');
    await page.waitForFunction(() => Object.values(localStorage).includes('Second unsent for Tomas'));
    const rafaelId = (await boot('r')).user.id;
    const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => localStorage.getItem(k) === 'Second unsent for Tomas'));
    assert.ok(keys.length === 1 && keys[0].includes(rafaelId), `draft key ${keys}`);    // drafts are kept per person
    await page.getByRole('button', { name: 'Sign out' }).click();
    await login(page, 'r2');
    await page.getByRole('button', { name: /^Conversations/ }).click();
    await page.getByRole('button', { name: /Tomas Varga.*Data Analyst/s }).click();
    await page.getByRole('heading', { name: 'Tomas Varga' }).waitFor();
    assert.equal(await page.getByLabel('Write a message').inputValue(), '');           // Mei does not see Rafael's draft
    await page.getByRole('button', { name: /^Conversations/ }).click();
    await page.getByRole('button', { name: /Noor Haddad.*Platform Engineer/s }).click();
    await page.getByRole('heading', { name: 'Noor Haddad' }).waitFor();
    assert.equal(await page.getByLabel('Write a message').inputValue(), '');
    record('session ended mid-draft: sign-in prompt, nothing sent, same person resumes and sends; another person sees no draft');

    // observer: read-only everywhere; manager of another job has no access to this conversation
    const ctx3 = await browser.newContext({ viewport: { width: 1280, height: 900 } }), obs = await ctx3.newPage();
    await login(obs, 'o');
    await obs.getByRole('heading', { name: 'Pipeline board' }).waitFor();
    assert.equal(await obs.getByRole('button', { name: 'Add candidate' }).count(), 0);
    assert.equal(await obs.locator('.card select:not([disabled])').count(), 0);
    await obs.getByRole('button', { name: /^Conversations/ }).click();
    await obs.getByRole('button', { name: /Tomas Varga/ }).click();
    await obs.getByText('You can read this conversation but cannot write in it.').waitFor();
    assert.ok(await obs.getByLabel('Write a message').isHidden());
    await obs.getByRole('button', { name: /^Activity/ }).click();
    await obs.getByText(/Rafael Costa undid a move/).first().waitFor();
    record('observer reads the board, conversations and activity and is offered no write control');

    // restart: everything kept, live updates resume
    const before = await boot('o');
    const unread = async () => (await boot('r')).applications.map((a) => [a.id, a.unread]);
    const unreadBefore = await unread();
    child.kill('SIGTERM'); await new Promise((r) => child.once('exit', r)); launch(); await healthy();
    const after = await boot('o');
    assert.deepEqual(after.applications, before.applications); assert.deepEqual(after.activity, before.activity); assert.equal(after.jobs.length, before.jobs.length);
    assert.deepEqual(await unread(), unreadBefore);                                       // per-person unread counts kept
    assert.equal((await ok('r', '/api/applications/APP-101/messages')).messages.pop().body, 'Reply from Noor');
    await ok('c', '/api/applications/APP-101/messages', { body: 'After restart' });
    await page.getByRole('list', { name: 'Messages' }).getByText('After restart').waitFor({ timeout: 15000 });
    record('restart keeps jobs, cards, order, messages, unread counts and activity without reseeding; live updates resume');

    assert.deepEqual(errors, []); record('no JavaScript page errors');
  } catch (e) { results.push({ passed: false, error: e.stack }); console.log('FAIL', e.stack); process.exitCode = 1; }
  finally {
    if (browser) await browser.close(); if (child) child.kill();
    fs.writeFileSync(out + '/server.log', logs);
    fs.writeFileSync(out + '/workspace.json', JSON.stringify({ kind: 'Scripted golden observations; not a configured judge run', results, page_errors: errors }, null, 2));
  }
})();
