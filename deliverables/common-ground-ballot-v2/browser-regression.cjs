const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = [];
const errors = [];
let browser;
const pass = name => { results.push({name, passed: true}); console.log('PASS', name); };
const accounts = {ruth: 'ruth.adebayo', arun: 'arun.das', leila: 'leila.ward', owen: 'owen.park'};
const op = () => crypto.randomUUID();
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
  return {status: result.status(), body: await result.json()};
}
async function lifecycle(page, title, action) {
  await page.reload();
  await page.locator('#app-view').waitFor({state: 'visible'});
  const before = await find(page, title);
  const card = page.locator(`[data-ballot-card="${before.id}"]`);
  const response = page.waitForResponse(r => r.url().endsWith(`/${before.id}/${action}`));
  await card.locator(`[data-ballot-action="${action}"]`).click();
  assert.equal((await response).status(), 200);
  assert.equal((await find(page, title)).revision, before.revision + 1);
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
  await publicPage.getByLabel('Password', {exact: true}).fill('WrongPassword!2026');
  await publicPage.getByRole('button', {name: 'Sign in', exact: true}).click();
  await publicPage.locator('#login-error').getByText('Email or password is incorrect.').waitFor();
  assert.equal((await api(publicPage, '/api/ballots')).status, 401);
  pass('public health, protected data and wrong-password negative control');
  const ruth = await person('ruth'), arun = await person('arun');
  const leila = await person('leila'), owen = await person('owen');
  const initial = await ballots(ruth);
  assert.deepEqual(initial.map(b => [b.status,b.revision]).sort(), [['closed',8],['draft',1],['open',4],['published',11]]);
  assert.equal((await api(ruth, '/api/members')).body.members.find(m => m.id === 'user-owen').active, false);
  pass('four seeded roles, ballot states and paused roster');
  const second = await person('ruth');
  await second.getByRole('button', {name: 'Sign out', exact: true}).click();
  assert.equal((await api(second, '/api/ballots')).status, 401);
  assert.equal((await api(ruth, '/api/ballots')).status, 200);
  await signIn(second, 'ruth');
  await second.getByRole('button', {name: 'End all sessions'}).click();
  assert.equal((await api(second, '/api/ballots')).status, 401);
  assert.equal((await api(ruth, '/api/ballots')).status, 401);
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
  const editBody = edit.request().postDataJSON();
  assert.equal(edit.status(), 200);
  await lifecycle(ruth, 'Verifier room schedule', 'open');
  room = await find(ruth, 'Verifier room schedule');
  assert.equal(room.revision, 3);
  const roomEvents = (await api(ruth, '/api/audit')).body.events.filter(e => e.entity_id === room.id);
  assert.deepEqual(roomEvents.map(e => e.action).sort(), ['created', 'edited', 'opened']);
  await rejected(ruth, ruth, `/api/ballots/${room.id}`, 'PATCH', {...editBody, expected_revision: 3, operation_id: op()}, 409);
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
  await view(ruth, 'members');
  await ruth.locator('[data-member-id="user-owen"]').click();
  await ruth.getByText('Owen Park is now paused for future ballots.', {exact: true}).waitFor();
  assert.equal((await find(ruth, 'Future roster probe')).turnout.eligible, 2);
  pass('roster changes affect future snapshots without changing existing eligibility');
  const payload = {title: 'Denied draft', description:'',method:'single',max_selections:1,choices:['Yes','No'],operation_id:op()};
  for (const user of [arun, leila]) await rejected(user, ruth, '/api/ballots', 'POST', payload, 403);
  await rejected(leila, ruth, '/api/members/user-owen', 'PATCH', {active:true,expected_revision:3,operation_id:op()}, 403);
  await rejected(leila, ruth, `/api/ballots/${room.id}/close`, 'POST', {expected_revision:3,operation_id:op()}, 403);
  await rejected(ruth, ruth, '/api/ballots', 'POST', {...payload,actor_id:'user-ruth'}, 400);
  await rejected(leila, ruth, '/api/ballots', 'POST', {...payload,actor_id:'user-ruth',operation_id:op()}, 403);
  await rejected(ruth, ruth, '/api/ballots/unknown-local-probe/close', 'POST', {expected_revision:1,operation_id:op()}, 404);
  await rejected(ruth, ruth, `/api/ballots/${room.id}/close`, 'POST', {expected_revision:1.5,operation_id:op()}, 400);
  pass('server role, forged identity, unknown-id and malformed-revision rejection matrix');
  const captured = await vote(owen, courtyard.title, ['Keep 8 pm']);
  const voteBase = {expected_revision:room.revision,operation_id:op(),choice_ids:[]};
  for (const ids of [[courtyard.choices[0].id],[],[room.choices[0].id,room.choices[0].id],room.choices.map(c=>c.id)]) {
    await rejected(leila, ruth, `/api/ballots/${room.id}/vote`, 'POST', {...voteBase,choice_ids:ids,operation_id:op()}, 400);
  }
  await vote(leila, room.title, ['Morning','Evening']);
  await vote(leila, courtyard.title, ['Extend to 9 pm']);
  const afterVotes = await snapshot(ruth);
  const retry = await api(owen, captured.route, 'POST', captured.body);
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
  for (const user of [ruth,arun,leila,owen]) assert(!('results' in await find(user, courtyard.title)));
  await rejected(owen, ruth, captured.route, 'POST', {...captured.body, expected_revision:5,operation_id:op()}, 409);
  await rejected(ruth, ruth, `/api/ballots/${courtyard.id}/publish`, 'POST', {expected_revision:4,operation_id:op()}, 409);
  pass('identified turnout privacy, all-role hidden results, close boundary and stale lifecycle conflict');
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
  const durable = await snapshot(ruth);
  for (let i=0;i<2;i++) {
    execFileSync('python3',['/tests/app-lifecycle.py','restart'],{stdio:'inherit',timeout:70000});
    await ruth.reload(); await owen.reload();
    await ruth.locator('#app-view').waitFor({state:'visible'});
    await owen.locator('#app-view').waitFor({state:'visible'});
    assert.deepEqual(await snapshot(ruth),durable);
    assert.deepEqual((await api(owen,captured.route,'POST',captured.body)).body,captured.receipt);
    assert.deepEqual(await snapshot(ruth),durable);
  }
  await ruth.getByRole('button',{name:'Sign out',exact:true}).click();
  await signIn(ruth,'ruth');
  assert.deepEqual(await snapshot(ruth),durable);
  pass('audit scope, two real process restarts, durable sessions and persisted operation receipts');
  await view(ruth,'results');
  await ruth.screenshot({path:'/results/desktop.png',fullPage:true});
  await ruth.setViewportSize({width:390,height:844});
  assert(await ruth.locator('#user-name').isVisible());
  assert(await ruth.locator('#user-role').isVisible());
  for (const id of ['logout-button','logout-all-button','theme-button']) {
    const box = await ruth.locator('#'+id).boundingBox();
    assert(box && box.width >= 44 && box.height >= 44 && box.x >= 0 && box.x+box.width<=390,id);
  }
  for (const v of ['ballots','vote','turnout','results','members','audit']) {
    await view(ruth,v);
    assert(await ruth.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),v+' overflow');
    assert((await ruth.locator(`#view-${v}`).innerText()).length>30);
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
  await ruth.keyboard.press('Shift+Tab');
  assert(await ruth.evaluate(()=>document.querySelector('#ballot-dialog').contains(document.activeElement)));
  await ruth.keyboard.press('Escape');
  assert.equal(await ruth.evaluate(()=>document.activeElement.id),'new-ballot-button');
  assert.deepEqual(errors,[]);
  pass('desktop/mobile six-view layout, theme state, reduced motion and modal keyboard focus');
}
main().catch(e=>{results.push({name:'regression failure',passed:false,error:e.stack});process.exitCode=1;console.error(e);})
  .finally(async()=>{await browser?.close();fs.writeFileSync('/results/browser-results.json',JSON.stringify({results,errors},null,2)+'\n');});
