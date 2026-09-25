const assert = require('node:assert/strict');

module.exports = async function(h) {
  const {ruth, leila, owen, api, find, snapshot, view, draft, lifecycle, signIn, retain, pass, op} = h;
  const success = [], refusals = [];
  const ids = {};
  const membership = async page => (await api(page, '/api/members')).body.members.find(m => m.id === 'user-owen');
  const audit = async () => (await api(ruth, '/api/audit')).body.events;
  const ready = async page => {
    await page.reload();
    await page.locator('#app-view').waitFor({state:'visible'});
  };
  const exchange = async (page, route, method, act, label) => {
    const pending = page.waitForResponse(r => new URL(r.url()).pathname === route && r.request().method() === method);
    await act();
    const r = await pending;
    return retain(label, {route, method, body:r.request().postDataJSON(), status:r.status(), response:await r.json()});
  };
  const replay = async (saved, label) => {
    const before = await snapshot(ruth);
    const got = await api(ruth, saved.route, saved.method, saved.body);
    retain(label, got);
    assert.deepEqual(got, {status:saved.status, body:saved.response}, label);
    assert.deepEqual(await snapshot(ruth), before, label+' changed current state');
  };
  const create = async title => {
    await ready(ruth);
    const before = (await audit()).length;
    const r = await draft(ruth, title, ['Yes','No']);
    const e = retain(title+'-create', {route:r.route, method:'POST', body:r.request, status:r.status, response:r.body});
    assert.equal(r.status, 201);
    await ruth.locator('#ballot-dialog').waitFor({state:'hidden'});
    assert.equal((await audit()).length, before+1);
    ids[title] = r.body.ballot.id;
    return e;
  };
  const edit = async (title, changes, label) => {
    await ready(ruth);
    const b = await find(ruth,title), before = (await audit()).length;
    await ruth.locator('[data-ballot-edit="'+b.id+'"]').click();
    if(changes.title) await ruth.locator('#ballot-title').fill(changes.title);
    if(changes.description) await ruth.locator('#ballot-description').fill(changes.description);
    const e = await exchange(ruth, '/api/ballots/'+b.id, 'PATCH',
      () => ruth.getByRole('button',{name:'Save draft',exact:true}).click(), label);
    assert.equal(e.status,200);
    await ruth.locator('#ballot-dialog').waitFor({state:'hidden'});
    const after = await find(ruth, changes.title || title);
    assert.equal(after.revision,b.revision+1);
    assert.equal((await audit()).length,before+1);
    return e;
  };
  const memberClick = async (page,label,expected=200,refresh=true) => {
    if(refresh) { await ready(page); await view(page,'members'); }
    const before = await membership(page), count = (await audit()).length;
    const e = await exchange(page,'/api/members/user-owen','PATCH',
      () => page.locator('[data-member-id="user-owen"]').click(),label);
    assert.equal(e.status,expected,label);
    if(expected===200) {
      const after = await membership(page);
      assert.equal(after.active,!before.active);
      assert.equal(after.revision,before.revision+1);
      assert.equal((await audit()).length,count+1);
    }
    return e;
  };
  const transition = async (title, action, label) => {
    const count = (await audit()).length;
    const e = retain(label,await lifecycle(ruth,title,action));
    assert.equal((await audit()).length,count+1);
    return e;
  };
  const membersOf = b => b.turnout.members.map(m=>m.id).sort();

  assert.equal((await membership(ruth)).active,false);
  const c = await create('Receipt rehearsal');
  success.push(c);
  await replay(c,'create-immediate-replay');
  assert.equal((await api(ruth,'/api/ballots')).body.ballots.filter(b=>b.id===c.response.ballot.id).length,1);
  success.push(await edit('Receipt rehearsal',{title:'Receipt rehearsal approved'},'receipt-edit'));
  success.push(await transition('Receipt rehearsal approved','open','receipt-open'));
  assert.deepEqual(membersOf(await find(ruth,'Receipt rehearsal approved')),['user-leila']);
  success.push(await memberClick(ruth,'receipt-activate'));
  success.push(await transition('Receipt rehearsal approved','close','receipt-close'));
  success.push(await memberClick(ruth,'receipt-pause'));
  success.push(await transition('Receipt rehearsal approved','publish','receipt-publish'));
  assert.equal(success.length,7);
  for(let i=0;i<success.length;i++) await replay(success[i],'success-later-'+i);
  const beforeCollision=await snapshot(ruth);
  const collision=await api(ruth,c.route,c.method,{...c.body,title:'Receipt collision'});
  retain('create-id-collision',collision);
  assert.equal(collision.status,409);
  assert.match(collision.body.error,/different|already|operation/i);
  assert.deepEqual(await snapshot(ruth),beforeCollision);
  await replay(c,'create-after-id-collision');
  assert.equal((await find(ruth,'Receipt rehearsal approved')).status,'published');
  assert.equal((await membership(ruth)).active,false);
  pass('staff success receipts replay seven earlier outcomes without reversing newer state');

  await memberClick(ruth,'race-establish-active');
  await ready(ruth); await view(ruth,'members');
  const tabB=await ruth.context().newPage();
  await signIn(tabB,'ruth'); await view(tabB,'members');
  const original=await membership(tabB);
  assert.equal(original.active,true);
  await memberClick(ruth,'race-pause');
  await memberClick(ruth,'race-reactivate');
  const afterABA=await membership(ruth);
  assert.equal(afterABA.revision,original.revision+2);
  assert.equal(afterABA.active,true);
  const beforeStale=await snapshot(ruth);
  const stale=await memberClick(tabB,'race-stale-pause',409,false);
  assert.equal(stale.body.expected_revision,original.revision);
  assert.equal(stale.body.active,false);
  assert.match(stale.response.error,/refresh|changed|stale/i);
  assert.deepEqual(await snapshot(ruth),beforeStale);
  await create('Roster includes Owen');
  await transition('Roster includes Owen','open','race-includes-open');
  assert.deepEqual(membersOf(await find(ruth,'Roster includes Owen')),['user-leila','user-owen']);
  await ready(owen); await view(owen,'vote');
  assert(await owen.locator('[data-vote-id="'+ids['Roster includes Owen']+'"]').isVisible());
  await memberClick(tabB,'race-fresh-pause');
  await create('Roster excludes Owen');
  await transition('Roster excludes Owen','open','race-excludes-open');
  await tabB.close();

  const checkRoster = async label => {
    assert.equal((await membership(ruth)).active,false);
    const included=await find(ruth,'Roster includes Owen'), excluded=await find(ruth,'Roster excludes Owen');
    assert.equal(included.status,'open'); assert.equal(excluded.status,'open');
    assert.deepEqual(membersOf(included),['user-leila','user-owen']);
    assert.deepEqual(membersOf(excluded),['user-leila']);
    await ready(owen); await view(owen,'vote');
    assert(await owen.locator('[data-vote-id="'+included.id+'"]').isVisible());
    assert.equal(await owen.locator('[data-vote-id="'+excluded.id+'"]').count(),0);
    assert.equal(await find(owen,'Roster excludes Owen'),undefined);
    await ready(leila); await view(leila,'vote');
    assert(await leila.locator('[data-vote-id="'+excluded.id+'"]').isVisible());
    retain(label,{included,excluded,membership:await membership(ruth)});
  };
  await checkRoster('race-snapshot-checkpoint');
  pass('stale ABA roster write is refused and accepted roster reaches two fixed eligibility snapshots');

  await create('Refusal rehearsal');
  const editA=await edit('Refusal rehearsal',{description:'Board review A'},'refusal-edit-A');
  const staleBody={...editA.body,description:'Board review B',expected_revision:1,operation_id:op()};
  const beforeRefusal=await snapshot(ruth);
  const denied=await api(ruth,editA.route,'PATCH',staleBody);
  const staleReceipt=retain('original-refused-edit',{route:editA.route,method:'PATCH',body:staleBody,status:denied.status,response:denied.body});
  assert.equal(denied.status,409);
  assert.match(denied.body.error,/changed|stale|refresh/i);
  assert.deepEqual(await snapshot(ruth),beforeRefusal);
  refusals.push(staleReceipt);
  await edit('Refusal rehearsal',{description:'Board review C'},'refusal-edit-C');
  await replay(staleReceipt,'stale-after-fresh-edit');
  await transition('Refusal rehearsal','open','refusal-open');
  const open=await find(ruth,'Refusal rehearsal');
  const publishRoute='/api/ballots/'+open.id+'/publish';
  const publishBody={...success[6].body,expected_revision:open.revision,operation_id:op()};
  const beforePremature=await snapshot(ruth);
  const premature=await api(ruth,publishRoute,'POST',publishBody);
  const refusedPublish=retain('original-refused-publish',{route:publishRoute,method:'POST',body:publishBody,status:premature.status,response:premature.body});
  assert.equal(premature.status,409);
  assert.match(premature.body.error,/closed|publish/i);
  assert.deepEqual(await snapshot(ruth),beforePremature);
  refusals.push(refusedPublish);
  await transition('Refusal rehearsal','close','refusal-close');
  await replay(refusedPublish,'refused-publish-after-close');
  await transition('Refusal rehearsal','publish','refusal-fresh-publish');
  for(let i=0;i<refusals.length;i++) await replay(refusals[i],'refusal-after-published-'+i);
  const final=await find(ruth,'Refusal rehearsal');
  assert.equal(final.description,'Board review C');
  assert.equal(final.status,'published');
  pass('durable domain refusals retain original details after changed preconditions and fresh positive controls');

  return {async afterRestart(n) {
    for(let i=0;i<success.length;i++) await replay(success[i],'restart-'+n+'-staff-'+i);
    pass('all seven staff success receipts survive restart '+n);
    await checkRoster('restart-'+n+'-roster');
    pass('competing roster snapshots and visibility survive restart '+n);
    for(let i=0;i<refusals.length;i++) await replay(refusals[i],'restart-'+n+'-refusal-'+i);
    pass('both original refused outcomes survive restart '+n);
  }};
};

