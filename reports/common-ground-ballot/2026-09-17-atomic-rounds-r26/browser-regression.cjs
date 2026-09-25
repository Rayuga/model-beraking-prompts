const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = [];
const errors = [];
let browser;
const evidenceDirectory = fs.mkdtempSync('/tmp/ballot-checkpoints-');
fs.chmodSync(evidenceDirectory, 0o700);
const checkpoints = [];
function retain(name, value) {
  fs.writeFileSync(`${evidenceDirectory}/${name}.json`, JSON.stringify(value), {mode: 0o600});
  checkpoints.push(name);
  return JSON.parse(fs.readFileSync(`${evidenceDirectory}/${name}.json`, 'utf8'));
}
function recall(name) {
  return JSON.parse(fs.readFileSync(`${evidenceDirectory}/${name}.json`, 'utf8'));
}
const pass = name => { results.push({name, passed: true}); console.log('PASS', name); };
const accounts = {ruth: 'ruth.adebayo', arun: 'arun.das', leila: 'leila.ward', owen: 'owen.park'};
const op = () => crypto.randomUUID();
async function settle(page) {
  await page.evaluate(async()=>{
    await new Promise(resolve=>requestAnimationFrame(resolve));
    await Promise.all(document.getAnimations().filter(a=>Number.isFinite(a.effect.getComputedTiming().endTime)).map(a=>a.finished.catch(()=>{})));
  });
}
async function api(page, route, method = 'GET', body) {
  return page.evaluate(async ({route, method, body}) => {
    const response = await fetch(route, {method, headers: {'Content-Type': 'application/json'},
      ...(body === undefined ? {} : {body: JSON.stringify(body)})});
    return {status: response.status, body: await response.json()};
  }, {route, method, body});
}
async function signIn(page, who) {
  await page.goto('http://localhost:3000');
  if (await page.locator('#login-view').isVisible()) {
    await page.getByLabel('Email', {exact: true}).fill(accounts[who] + '@commonground.example');
    await page.getByLabel('Password', {exact: true}).fill('CommonGround!2026');
    await page.getByRole('button', {name: 'Sign in', exact: true}).click();
  }
  await page.locator('#app-view').waitFor({state: 'visible'});
  assert.match(await page.locator('#user-name').innerText(), new RegExp(who, 'i'));
}
async function person(who) {
  const context = await browser.newContext({viewport: {width: 1280, height: 800}});
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await signIn(page, who);
  return page;
}
const ballots = async page => (await api(page, '/api/ballots')).body.ballots;
const find = async (page, title) => (await ballots(page)).find(b => b.title === title);
async function snapshot(page) {
  return {ballots: await ballots(page), members: (await api(page, '/api/members')).body,
    audit: (await api(page, '/api/audit')).body};
}
async function rejected(page, staff, route, method, body, status) {
  const before = await snapshot(staff);
  const result = await api(page, route, method, body);
  assert(result.status >= 400, JSON.stringify(result));
  if (status) assert.equal(result.status, status);
  assert.deepEqual(await snapshot(staff), before);
  return result;
}
async function view(page, name) {
  await page.locator(`.nav-item[data-view="${name}"]`).click();
  await page.locator(`#view-${name}`).waitFor({state: 'visible'});
  assert.equal(await page.locator('.nav-item.active').getAttribute('data-view'), name);
  await page.evaluate(() => Promise.all([...document.querySelectorAll('.nav-item')]
    .flatMap(item => item.getAnimations()).map(animation => animation.finished.catch(() => {}))));
}
async function draft(page, title, choices = ['Morning', 'Afternoon', 'Evening']) {
  await view(page, 'ballots');
  await page.getByRole('button', {name: 'New ballot', exact: true}).click();
  await page.getByLabel('Ballot title', {exact: true}).fill(title);
  await page.locator('#ballot-description').fill('Reserve the shared room');
  await page.getByLabel('Voting method').selectOption(choices.length === 3 ? 'approval' : 'single');
  if (choices.length === 3) {
    await page.getByLabel('Maximum approvals').fill('2');
    await page.getByRole('button', {name: 'Add another choice'}).click();
  }
  for (let i = 0; i < choices.length; i++) await page.locator('input[name=choice]').nth(i).fill(choices[i]);
  const response = page.waitForResponse(r => r.request().method() === 'POST' && r.url().endsWith('/api/ballots'));
  await page.getByRole('button', {name: 'Save draft'}).click();
  const result = await response;
  return {status: result.status(), body: await result.json(), request: result.request().postDataJSON(), route: new URL(result.url()).pathname};
}
async function lifecycle(page, title, action) {
  await page.reload();
  await page.locator('#app-view').waitFor({state: 'visible'});
  const before = await find(page, title);
  const card = page.locator(`[data-ballot-card="${before.id}"]`);
  const response = page.waitForResponse(r => r.url().endsWith(`/${before.id}/${action}`));
  await card.locator(`[data-ballot-action="${action}"]`).click();
  const result = await response;
  const exchange = {route: new URL(result.url()).pathname, method: 'POST', body: result.request().postDataJSON(), status: result.status(), response: await result.json()};
  assert.equal(result.status(), 200);
  assert.equal((await find(page, title)).revision, before.revision + 1);
  return exchange;
}
async function vote(page, title, choices) {
  await page.reload();
  await view(page, 'vote');
  const ballot = await find(page, title);
  await page.locator(`[data-vote-id="${ballot.id}"]`).click();
  for (const choice of choices) await page.getByLabel(choice, {exact: true}).check();
  await page.getByLabel('I understand this is my one final submission.').check();
  const response = page.waitForResponse(r => r.url().endsWith(`/${ballot.id}/vote`));
  await page.getByRole('button', {name: 'Submit final ballot'}).click();
  const r = await response;
  assert.equal(r.status(), 201);
  const receipt = await r.json();
  assert.equal(receipt.participated, true);
  assert(!JSON.stringify(receipt).includes('choice'));
  return {route: `/api/ballots/${ballot.id}/vote`, body: r.request().postDataJSON(), receipt};
}
async function main() {
  browser = await chromium.launch({executablePath: '/usr/local/bin/chromium', args: ['--no-sandbox']});
  const publicPage = await (await browser.newContext()).newPage();
  await publicPage.goto('http://localhost:3000');
  assert.equal((await api(publicPage, '/api/health')).status, 200);
  assert.equal((await api(publicPage, '/api/ballots')).status, 401);
  await publicPage.getByLabel('Email', {exact: true}).fill(accounts.ruth + '@commonground.example');
  await publicPage.getByLabel('Password', {exact: true}).fill('CommonGround!wrong');
  await publicPage.getByRole('button', {name: 'Sign in', exact: true}).click();
  await publicPage.locator('#login-error').getByText('Email or password is incorrect.').waitFor();
  assert.equal((await api(publicPage, '/api/ballots')).status, 401);
  pass('public health, protected data and wrong-password negative control');
  const ruth = await person('ruth'), arun = await person('arun');
  const leila = await person('leila'), owen = await person('owen');
  const strict = require('./strict-regression.cjs')({ruth,leila,owen,api,find,snapshot,view,draft,lifecycle,retain,recall,pass,op});
  const initial = await ballots(ruth);
  assert.deepEqual(initial.map(b => [b.status,b.revision]).sort(), [['closed',8],['draft',1],['open',4],['published',11]]);
  assert.equal((await api(ruth, '/api/members')).body.members.find(m => m.id === 'user-owen').active, false);
  pass('four seeded roles, ballot states and paused roster');
  const second = await person('ruth');
  const credential = async page => (await page.context().cookies()).filter(c=>c.name==='cg_session').map(c=>c.name+'='+c.value).join('; ');
  const oldSecond = await credential(second);
  const revokedRead = async (page, cookie) => {
    const response = await page.context().request.get('http://localhost:3000/api/ballots', {headers:{Cookie:cookie}});
    assert.equal(response.status(),401);
  };
  await second.getByRole('button', {name: 'Sign out', exact: true}).click();
  assert.equal((await api(second, '/api/ballots')).status, 401);
  assert.equal((await api(ruth, '/api/ballots')).status, 200);
  await revokedRead(second, oldSecond);
  await signIn(second, 'ruth');
  const allSecond = await credential(second), allRuth = await credential(ruth);
  await second.getByRole('button', {name: 'End all sessions'}).click();
  assert.equal((await api(second, '/api/ballots')).status, 401);
  assert.equal((await api(ruth, '/api/ballots')).status, 401);
  await revokedRead(second, allSecond);
  await revokedRead(ruth, allRuth);
  await signIn(ruth, 'ruth');
  pass('ordinary sign-out isolation and global session revocation');
  const beforeBadDraft = await snapshot(ruth);
  await ruth.getByRole('button', {name: 'New ballot', exact: true}).click();
  await ruth.getByRole('button', {name: 'Save draft'}).click();
  assert.equal(await ruth.locator('#ballot-title').evaluate(e => e.validity.valueMissing), true);
  await ruth.getByLabel('Ballot title', {exact: true}).fill('Invalid draft probe');
  await ruth.getByRole('button', {name: 'Save draft'}).click();
  assert.equal(await ruth.locator('input[name=choice]').first().evaluate(e => e.validity.valueMissing), true);
  await ruth.locator('input[name=choice]').nth(0).fill('Morning');
  await ruth.locator('input[name=choice]').nth(1).fill('Evening');
  await ruth.getByRole('button', {name: 'Remove choice', exact: true}).first().click();
  assert.equal(await ruth.locator('input[name=choice]').count(), 2);
  await ruth.getByLabel('Voting method').selectOption('approval');
  for (const limit of ['0', '3']) {
    await ruth.getByLabel('Maximum approvals').fill(limit);
    await ruth.getByRole('button', {name: 'Save draft'}).click();
    assert(await ruth.locator('#ballot-dialog').isVisible());
    assert.deepEqual(await snapshot(ruth), beforeBadDraft);
  }
  await ruth.getByRole('button', {name: 'Close ballot form'}).click();
  assert.equal((await draft(ruth, 'Invalid repeated draft', ['Same', 'Same'])).status, 400);
  assert.deepEqual(await snapshot(ruth), beforeBadDraft);
  await ruth.getByRole('button', {name: 'Close ballot form'}).click();
  assert.equal((await draft(ruth, 'Verifier room use')).status, 201);
  await ruth.locator('#ballot-dialog').waitFor({state: 'hidden'});
  let room = await find(ruth, 'Verifier room use');
  assert.equal(room.revision, 1);
  assert.equal(room.description, 'Reserve the shared room');
  await ruth.locator(`[data-ballot-edit="${room.id}"]`).click();
  await ruth.getByLabel('Ballot title', {exact: true}).fill('Verifier room schedule');
  const editResponse = ruth.waitForResponse(r => r.request().method() === 'PATCH' && r.url().endsWith(room.id));
  await ruth.getByRole('button', {name: 'Save draft'}).click();
  const edit = await editResponse;
  const editBody = retain('draft-edit', {body: edit.request().postDataJSON(), status: edit.status(), response: await edit.json()}).body;
  assert.equal(edit.status(), 200);
  const staleEdit = await rejected(ruth, ruth, `/api/ballots/${room.id}`, 'PATCH', {...editBody, title: 'Old revision probe', operation_id: op()}, 409);
  assert.match(staleEdit.body.error, /changed|refresh|stale/i);
  retain('stale-draft-refusal', {beforeRevision: 1, afterRevision: 2, result: staleEdit});
  await lifecycle(ruth, 'Verifier room schedule', 'open');
  room = await find(ruth, 'Verifier room schedule');
  assert.equal(room.revision, 3);
  const roomEvents = (await api(ruth, '/api/audit')).body.events.filter(e => e.entity_id === room.id);
  assert.deepEqual(roomEvents.map(e => e.action).sort(), ['created', 'edited', 'opened']);
  retain('open-edit-refusal', await rejected(ruth, ruth, `/api/ballots/${room.id}`, 'PATCH', {...editBody, expected_revision: room.revision, operation_id: op()}, 409));
  pass('invalid draft atomicity, create/edit/open revisions and opened-definition lock');
  const courtyard = await find(ruth, 'Courtyard closing time');
  assert.equal(courtyard.turnout.eligible, 2);
  assert.equal(room.turnout.eligible, 1);
  assert(!(await find(owen, room.title)));
  await view(ruth, 'members');
  await ruth.locator('[data-member-id="user-owen"]').click();
  await ruth.getByText('Owen Park is now active for future ballots.', {exact: true}).waitFor();
  assert.equal((await draft(ruth, 'Future roster probe', ['Yes','No'])).status, 201);
  await lifecycle(ruth, 'Future roster probe', 'open');
  assert.equal((await find(ruth, 'Future roster probe')).turnout.eligible, 2);
  assert.equal((await find(ruth, room.title)).turnout.eligible, 1);
  assert.equal((await draft(ruth, 'Partial turnout approval')).status, 201);
  await lifecycle(ruth, 'Partial turnout approval', 'open');
  assert.equal((await find(ruth, 'Partial turnout approval')).turnout.eligible, 2);
  await view(ruth, 'members');
  await ruth.locator('[data-member-id="user-owen"]').click();
  await ruth.getByText('Owen Park is now paused for future ballots.', {exact: true}).waitFor();
  assert.equal((await find(ruth, 'Future roster probe')).turnout.eligible, 2);
  pass('roster changes affect future snapshots without changing existing eligibility');
  await strict.malformedMembership();
  const payload = {title: 'Denied draft', description:'',method:'single',max_selections:1,choices:['Yes','No'],operation_id:op()};
  for (const user of [arun, leila]) await rejected(user, ruth, '/api/ballots', 'POST', payload, 403);
  await rejected(leila, ruth, '/api/members/user-owen', 'PATCH', {active:true,expected_revision:3,operation_id:op()}, 403);
  await rejected(leila, ruth, `/api/ballots/${room.id}/close`, 'POST', {expected_revision:3,operation_id:op()}, 403);
  await rejected(ruth, ruth, '/api/ballots', 'POST', {...payload,actor_id:'user-ruth'}, 400);
  await rejected(leila, ruth, '/api/ballots', 'POST', {...payload,actor_id:'user-ruth',operation_id:op()}, 403);
  await rejected(ruth, ruth, '/api/ballots/unknown-local-probe/close', 'POST', {expected_revision:1,operation_id:op()}, 404);
  const picnic=await find(ruth,'Annual picnic date');
  assert.equal(picnic.status,'draft'); assert.equal(picnic.revision,1);
  await rejected(ruth, ruth, `/api/ballots/${picnic.id}/open`, 'POST', {expected_revision:1.5,operation_id:op()}, 400);
  await lifecycle(ruth,picnic.title,'open');
  pass('server role, forged identity, unknown-id and malformed-revision rejection matrix');
  const captured = retain('owen-vote', await vote(owen, courtyard.title, ['Keep 8 pm']));
  await strict.privacy('one-participant');
  const voteBase = {expected_revision:room.revision,operation_id:op(),choice_ids:[]};
  retain('ineligible-open-refusal', await rejected(owen, ruth, `/api/ballots/${room.id}/vote`, 'POST', {...voteBase, choice_ids:[room.choices[0].id], operation_id:op()}, 403));
  for (const ids of [[courtyard.choices[0].id],[],[room.choices[0].id,room.choices[0].id],room.choices.map(c=>c.id)]) {
    await rejected(leila, ruth, `/api/ballots/${room.id}/vote`, 'POST', {...voteBase,choice_ids:ids,operation_id:op()}, 400);
  }
  retain('leila-approval-vote', await vote(leila, room.title, ['Morning','Evening']));
  retain('partial-turnout-vote', await vote(leila, 'Partial turnout approval', ['Morning','Evening']));
  await strict.approval('open');
  const partialOpen = await find(ruth, 'Partial turnout approval');
  assert.equal(partialOpen.turnout.eligible, 2);
  assert.equal(partialOpen.turnout.participated, 1);
  assert.equal(partialOpen.turnout.members.find(m=>m.id==='user-owen').participated, false);
  for (const ids of [[], courtyard.choices.map(c => c.id)]) {
    await rejected(leila, ruth, captured.route, 'POST', {...captured.body, choice_ids: ids, operation_id: op()}, 400);
  }
  pass('empty/multiple single-choice and ineligible-member refusals leave full state unchanged');
  retain('leila-single-vote', await vote(leila, courtyard.title, ['Extend to 9 pm']));
  await strict.privacy('two-participants');
  const afterVotes = await snapshot(ruth);
  const savedVote = recall('owen-vote');
  const retry = await api(owen, savedVote.route, 'POST', savedVote.body);
  assert.equal(retry.status, 201);
  assert.deepEqual(retry.body, captured.receipt);
  assert.deepEqual(await snapshot(ruth), afterVotes);
  await rejected(owen, ruth, captured.route, 'POST', {...captured.body,choice_ids:[courtyard.choices[1].id]}, 409);
  await rejected(owen, ruth, captured.route, 'POST', {...captured.body,operation_id:op()}, 409);
  pass('private single/approval votes, invalid inputs, exact replay, mismatched operation and duplicate participation');
  for (const staff of [ruth,arun]) {
    const b = await find(staff, courtyard.title);
    assert.equal(b.turnout.participated, 2);
    assert.deepEqual(b.turnout.members.map(m=>m.name).sort(), ['Leila Ward','Owen Park']);
    assert(!('results' in b));
    assert(!b.turnout.members.some(m=>Object.keys(m).some(k=>/choice|selection/.test(k))));
  }
  await lifecycle(ruth, courtyard.title, 'close');
  for (const [who, user] of Object.entries({ruth, arun, leila, owen})) {
    const hidden = await find(user, courtyard.title);
    assert.equal(hidden.status, 'closed');
    assert(!('results' in hidden));
    retain(`closed-privacy-${who}`, hidden);
  }
  const closed = await find(ruth, courtyard.title);
  retain('closed-vote-refusal', await rejected(owen, ruth, captured.route, 'POST', {...captured.body, expected_revision:closed.revision,operation_id:op()}, 409));
  pass('identified turnout privacy, all-role hidden results, close boundary and stale lifecycle conflict');
  const future=await find(ruth,'Future roster probe');
  assert.equal(future.status,'open'); assert.equal(future.turnout.eligible,2); assert.equal(future.turnout.participated,0);
  await owen.reload(); await view(owen,'vote');
  await owen.locator(`[data-vote-id="${future.id}"]`).click();
  await owen.getByLabel('Yes',{exact:true}).check();
  await lifecycle(ruth,future.title,'close');
  const futureClosed=await find(ruth,future.title);
  const freshClosedBody={...captured.body,expected_revision:futureClosed.revision,operation_id:op(),choice_ids:[future.choices.find(c=>c.label==='Yes').id]};
  retain('closed-unparticipated-refusal',await rejected(owen,ruth,`/api/ballots/${future.id}/vote`,'POST',freshClosedBody,409));
  await owen.getByRole('button',{name:'Close voting form'}).click();
  pass('Closed boundary refuses eligible unparticipated Member with fresh operation and current revision');
  const garden = await find(ruth, 'Garden location');
  assert.equal(garden.total_ballots,2);
  assert.deepEqual(garden.results.map(r=>[r.label,r.votes,r.percentage]), [['North lawn',1,50],['East beds',1,50]]);
  assert.match(garden.outcome,/Tie.*North lawn.*East beds/);
  await lifecycle(ruth, 'Shared-space improvements', 'publish');
  const improvements = await find(ruth, 'Shared-space improvements');
  assert.equal(improvements.total_ballots,2);
  assert.deepEqual(improvements.results.map(r=>[r.votes,r.percentage]), [[2,100],[1,50],[1,50]]);
  await lifecycle(ruth, courtyard.title, 'publish');
  await lifecycle(ruth, room.title, 'close');
  await lifecycle(ruth, room.title, 'publish');
  assert.deepEqual((await find(ruth, courtyard.title)).results.map(r=>r.votes),[1,1]);
  assert.deepEqual((await find(ruth, room.title)).results.map(r=>r.votes),[1,0,1]);
  await lifecycle(ruth, 'Partial turnout approval', 'close');
  await lifecycle(ruth, 'Partial turnout approval', 'publish');
  const partial = await find(ruth, 'Partial turnout approval');
  assert.equal(partial.total_ballots, 1);
  assert.deepEqual(partial.results.map(r=>[r.votes,r.percentage]), [[1,100],[0,0],[1,100]]);
  await view(ruth,'results');
  const partialPanel = ruth.locator('.result-panel').filter({has:ruth.getByRole('heading',{name:'Partial turnout approval',exact:true})});
  assert.equal(await partialPanel.locator('.ballot-total strong').innerText(),'1');
  assert.deepEqual(await partialPanel.locator('.result-row > span:last-child').allTextContents(),['100%','0%','100%']);
  pass('partial turnout approval uses one participating Member, not two eligible Members');
  await strict.approval('published');
  await strict.privacy('published');
  await rejected(ruth, ruth, `/api/ballots/${room.id}/close`, 'POST', {expected_revision:5,operation_id:op()}, 409);
  pass('published single-choice tie, approval percentages, terminal safety and delayed exact vote totals');
  const audit = (await api(ruth,'/api/audit')).body.events;
  for (const [id, expected] of [[room.id,['created','edited','opened','closed','published']],
      [courtyard.id,['opened','closed','published']]]) {
    assert.deepEqual(audit.filter(e=>e.entity_id===id).map(e=>e.action).sort(), expected.sort());
  }
  for (const action of ['created','edited','opened','closed','published','membership_activated','membership_paused']) {
    assert(audit.some(e=>e.action===action), 'Missing audit action '+action);
  }
  assert(!JSON.stringify(audit).includes('choice-courtyard'));
  for (const event of audit) assert(Number.isFinite(Date.parse(event.created_at)));
  const sql = execFileSync('python3', ['-c', `import sqlite3,json; db=sqlite3.connect('file:/app/commonground.db?mode=ro',uri=True); print(json.dumps({'ballots':db.execute('SELECT id,status,revision FROM ballots ORDER BY id').fetchall(),'tables':[r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")]}))`], {encoding:'utf8'});
  const stored = JSON.parse(sql);
  assert.deepEqual(stored.ballots, (await ballots(ruth)).map(b=>[b.id,b.status,b.revision]).sort((a,b)=>a[0].localeCompare(b[0])));
  for (const table of ['sessions','memberships','anonymous_votes','participation','operation_receipts','audit']) assert(stored.tables.includes(table));
  pass('real SQLite schema and accepted ballots match protected responses; audit times are readable');
  const staff = await require('./staff-regression.cjs')({ruth, leila, owen, api, find, snapshot, view, draft, lifecycle, signIn, retain, pass, op});
  const durable = await snapshot(ruth);
  for (let i=0;i<2;i++) {
    execFileSync('/opt/common-ground-verifier/app-lifecycle',['restart'],{stdio:'inherit',timeout:70000});
    await ruth.reload(); await owen.reload();
    await ruth.locator('#app-view').waitFor({state:'visible'});
    await owen.locator('#app-view').waitFor({state:'visible'});
    assert.deepEqual(await snapshot(ruth),durable);
    const persistedVote = recall('owen-vote');
    assert.deepEqual((await api(owen,persistedVote.route,'POST',persistedVote.body)).body,persistedVote.receipt);
    assert.deepEqual(await snapshot(ruth),durable);
    await view(ruth,'results');
    for (const [title, participants, counts, percentages] of [
      ['Garden location',2,[1,1],['50%','50%']],
      ['Shared-space improvements',2,[2,1,1],['100%','50%','50%']],
      ['Partial turnout approval',1,[1,0,1],['100%','0%','100%']],
    ]) {
      const panel=ruth.locator('.result-panel').filter({has:ruth.getByRole('heading',{name:title,exact:true})});
      assert.equal(await panel.locator('.ballot-total strong').innerText(),String(participants));
      assert.deepEqual(await panel.locator('.result-row > div:first-child strong').allTextContents(),counts.map(n=>n+' '+(n===1?'vote':'votes')));
      assert.deepEqual(await panel.locator('.result-row > span:last-child').allTextContents(),percentages);
      if(title==='Garden location') {
        const outcome=await panel.locator('.outcome').innerText();
        assert.match(outcome,/tie/i); assert.match(outcome,/North lawn/); assert.match(outcome,/East beds/);
      }
    }
    pass('visible published exact totals after restart '+(i+1));
    await staff.afterRestart(i+1);
    await strict.approval('restart-'+(i+1));
    await strict.privacy('restart-'+(i+1));
    await strict.snapshotCheck('restart-'+(i+1));
  }
  await ruth.getByRole('button',{name:'Sign out',exact:true}).click();
  await signIn(ruth,'ruth');
  assert.deepEqual(await snapshot(ruth),durable);
  pass('audit scope, two real process restarts, durable sessions and persisted operation receipts');
  await view(ruth,'results');
  await ruth.screenshot({path:'/results/desktop.png',fullPage:true});
  await ruth.getByRole('button',{name:'Switch to dark theme'}).click();
  await settle(ruth);
  await ruth.screenshot({path:'/results/desktop-dark.png',fullPage:true});
  await view(ruth,'turnout');
  const contrast = await ruth.evaluate(() => {
    const lum = value => {
      const rgb=value.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    };
    return ['.participation-state.pending','.participation-state.done','.nav-label','.brand-mark','#logout-button'].map(selector=>{
      const element=document.querySelector(selector);
      if(!element) throw new Error('Missing contrast target '+selector);
      const foreground=getComputedStyle(element).color;
      let node=element,background;
      while(node) {
        background=getComputedStyle(node).backgroundColor;
        if(!['rgba(0, 0, 0, 0)','transparent'].includes(background)) break;
        node=node.parentElement;
      }
      if(background.startsWith('color(')) {
        const rgb=background.match(/[\d.]+/g).slice(0,3).map(v=>Number(v)*255);
        background='rgb('+rgb.join(',')+')';
      }
      const a=lum(foreground),b=lum(background);
      return {selector,foreground,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
    });
  });
  fs.writeFileSync('/results/contrast-results.json',JSON.stringify(contrast,null,2)+'\n');
  assert(contrast.every(c=>c.ratio>=4.5),JSON.stringify(contrast));
  await ruth.screenshot({path:'/results/desktop-dark-turnout.png',fullPage:true});
  await ruth.screenshot({path:'/results/desktop-dark-viewport.png'});
  pass('dark-theme pending, completed, secondary and brand labels meet local contrast checks');
  await ruth.getByRole('button',{name:'Switch to light theme'}).click();
  await ruth.setViewportSize({width:390,height:844});
  await ruth.mouse.move(0, 0);
  await ruth.screenshot({path:'/results/mobile-before-controls.png',fullPage:true});
  assert(await ruth.locator('#user-name').isVisible());
  assert(await ruth.locator('#user-role').isVisible());
  for (const id of ['logout-button','logout-all-button','theme-button']) {
    const box = await ruth.locator('#'+id).evaluate(async element => {
      await Promise.all(element.getAnimations().map(animation => animation.finished));
      const bounds = element.getBoundingClientRect();
      return {x:bounds.x, width:element.offsetWidth, height:element.offsetHeight, right:bounds.right};
    });
    console.log('Mobile control geometry:', id, JSON.stringify(box));
    assert(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.right<=390,id+' '+JSON.stringify(box));
  }
  for (const v of ['ballots','vote','turnout','results','members','audit']) {
    await view(ruth,v);
    assert(await ruth.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),v+' overflow');
    assert((await ruth.locator(`#view-${v}`).innerText()).length>30);
    if(v==='turnout') {
      const widths=await ruth.locator('.turnout-members li').evaluateAll(rows=>rows.map(row=>{
        const email=row.querySelector('small').getBoundingClientRect();
        const badge=row.querySelector('.participation-state').getBoundingClientRect();
        return {emailWidth:email.width,emailBottom:email.bottom,badgeTop:badge.top};
      }));
      assert(widths.every(r=>r.emailWidth>200 && r.badgeTop>=r.emailBottom),'mobile emails squeezed by participation badge');
      await ruth.screenshot({path:'/results/mobile-turnout.png',fullPage:true});
      await ruth.getByRole('button',{name:'Switch to dark theme'}).click();
      await settle(ruth);
      await ruth.screenshot({path:'/results/mobile-dark-turnout.png',fullPage:true});
      await ruth.screenshot({path:'/results/mobile-dark-viewport.png'});
      await ruth.getByRole('button',{name:'Switch to light theme'}).click();
    }
  }
  await ruth.getByRole('button',{name:'Switch to dark theme'}).click();
  await ruth.waitForTimeout(250);
  assert.equal(await ruth.locator('html').getAttribute('data-theme'),'dark');
  assert(await ruth.locator('#view-audit').isVisible());
  await ruth.screenshot({path:'/results/mobile.png',fullPage:true});
  await ruth.emulateMedia({reducedMotion:'reduce'});
  await view(ruth,'ballots');
  await ruth.getByRole('button',{name:'New ballot',exact:true}).click();
  assert.equal(await ruth.evaluate(()=>document.activeElement.id),'ballot-title');
  await settle(ruth);
  await ruth.screenshot({path:'/results/mobile-dark-form.png'});
  await ruth.keyboard.press('Shift+Tab');
  assert(await ruth.evaluate(()=>document.querySelector('#ballot-dialog').contains(document.activeElement)));
  await ruth.keyboard.press('Escape');
  assert.equal(await ruth.evaluate(()=>document.activeElement.id),'new-ballot-button');
  assert.deepEqual(errors,[]);
  pass('desktop/mobile six-view layout, theme state, reduced motion and modal keyboard focus');
  for(const result of await require('./auth-gate.cjs')()) {
    assert(result.passed,JSON.stringify(result));
    pass('shared authentication gate after existing mutations: '+result.dimension);
  }
}
main().catch(e=>{results.push({name:'regression failure',passed:false,error:e.stack});process.exitCode=1;console.error(e);})
  .finally(async()=>{await browser?.close();fs.writeFileSync('/results/browser-results.json',JSON.stringify({results,errors,checkpoints},null,2)+'\n');});
