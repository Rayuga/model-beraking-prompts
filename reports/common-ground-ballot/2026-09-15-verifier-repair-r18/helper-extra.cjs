async function additional() {
  for (const family of (process.argv.includes('--boundary-only') ? [] : ['create', 'edit', 'open', 'close', 'publish', 'membership'])) {
    const saved = await run('family-' + family, `
      await reload(h.ruth);
      const family = ${JSON.stringify(family)};
      let act;
      if (family === 'create') {
        await createForm(h.ruth, 'Six family helper');
        act = () => h.ruth.getByRole('button', {name:'Save draft',exact:true}).click();
      } else if (family === 'edit') {
        await h.ruth.locator('[data-ballot-edit="'+h.familyId+'"]').click();
        await h.ruth.getByLabel('Ballot title',{exact:true}).fill('Six family edited');
        act = () => h.ruth.getByRole('button',{name:'Save draft',exact:true}).click();
      } else if (family === 'membership') {
        await h.ruth.locator('.nav-item[data-view="members"]').click();
        act = () => h.ruth.locator('[data-member-id="user-owen"]').click();
      } else act = () => h.ruth.locator('[data-ballot-action="'+family+'"][data-id="'+h.familyId+'"]').click();
      h.familyLost = await exchange(h.ruth,'family-lost-'+family,act,true);
      if (family === 'create') h.familyId = h.familyLost.response.ballot.id;
      const writes = h.writes.length;
      await reload(h.ruth);
      return {saved:h.familyLost,pending:await ids(h.ruth),automaticWrites:h.writes.length-writes};`);
    assert(saved.saved.status >= 200 && saved.saved.status < 300);
    assert.deepEqual(saved.pending, [JSON.parse(saved.saved.request.body).operation_id]);
    assert.equal(saved.automaticWrites, 0);
    const replay = await run('family-retry-' + family, `
      const before=await snapshot(h.ruth);
      const saved=await exchange(h.ruth,'family-retry-'+${JSON.stringify(family)},()=>h.ruth.locator('[data-pending-retry="'+op(h.familyLost)+'"]').click());
      return {saved,before,after:await snapshot(h.ruth),pending:await ids(h.ruth)};`);
    assert.deepEqual(replay.saved.request,saved.saved.request);
    assert.deepEqual(replay.saved.response,saved.saved.response);
    assert.equal(replay.saved.replay,'true');
    assert.deepEqual(replay.before,replay.after); assert.deepEqual(replay.pending,[]);
    pass('new helper captures lost '+family+' and exact visible retry after reload');
  }
  await run('omission-fixture', `
    await createForm(h.ruth,'Helper boundary');
    h.boundary=await exchange(h.ruth,'boundary-create',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click());
    await h.ruth.locator('[data-ballot-edit="'+h.boundary.response.ballot.id+'"]').click();
    await h.ruth.getByLabel('Ballot title',{exact:true}).fill('Helper valid edit');
    await exchange(h.ruth,'boundary-edit',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click());
    return e.peek('boundary-edit');`);
  await run('omission-auth-read', `
    return await e.capture(h.ruth,'own-protected-read',()=>reload(h.ruth),{match:r=>r.method()==='GET'&&pathOf(r)==='/api/ballots'});`);
  await run('omission-prepare', `
    const malformed=e.adaptJson('boundary-edit',{set:{operation_id:'r18-omitted-'+Date.now()},omit:['expected_revision']});
    h.omissionBefore=await snapshot(h.ruth);h.malformed=malformed;
    await e.arm(h.ruth,'omitted-revision',{match:r=>r.method()===malformed.method&&r.url()===malformed.url});
    return {malformed,before:h.omissionBefore};`);
  await run('omission-send', `return await h.ruth.evaluate(async request=>{
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),10000);
    try{const response=await fetch(request.url,{method:request.method,headers:{'content-type':'application/json'},body:request.body,signal:controller.signal});
      return {status:response.status,body:await response.json()};}finally{clearTimeout(timer);}
  },h.malformed);`);
  await run('omission-collect', `return await e.collect('omitted-revision');`);
  const boundary = await run('actual-omission', `
    const saved=e.peek('omitted-revision');
    let caught=false;try{e.adaptJson('boundary-edit',{omit:['invented_revision']});}catch(error){caught=true;}
    return {saved,before:h.omissionBefore,after:await snapshot(h.ruth),guardRefusesInventedField:caught};`);
  assert.equal(boundary.saved.state,'captured'); assert.equal(boundary.saved.response.status,400);
  assert(!Object.hasOwn(boundary.saved.request.body,'expected_revision'));
  assert.deepEqual(boundary.before,boundary.after); assert(boundary.guardRefusesInventedField);
  pass('actual omitted field refused 400; helper rejects an invented-field negative probe');

  for (const mode of ['unreadable','server-error']) {
    const value=await run('delivery-'+mode,`
      await createForm(h.ruth,'Helper '+${JSON.stringify(mode)});
      const saved=await e.capture(h.ruth,'delivery-'+${JSON.stringify(mode)},()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click(),{match:isStaff,mode:${JSON.stringify(mode)}});
      await h.ruth.waitForLoadState('networkidle');
      h.deliveryOp=saved.request.body.operation_id;
      await h.ruth.locator('[data-pending-retry="'+h.deliveryOp+'"]').waitFor({state:'visible'});
      await reload(h.ruth);
      const before=await snapshot(h.ruth);
      const retry=await e.capture(h.ruth,'delivery-retry-'+${JSON.stringify(mode)},()=>h.ruth.locator('[data-pending-retry="'+h.deliveryOp+'"]').click(),{match:isStaff});
      await h.ruth.waitForLoadState('networkidle');
      return {saved,retry,before,after:await snapshot(h.ruth),pending:await ids(h.ruth)};`);
    assert.equal(value.saved.response.status,201); assert.equal(value.retry.response.status,201);
    assert.deepEqual(value.saved.request,value.retry.request); assert.deepEqual(value.before,value.after);
    assert.deepEqual(value.pending,[]); pass('new helper '+mode+' delivery retains uncertainty and retries exactly');
  }
  await run('held-request-fixture',`
    await createForm(h.ruth,'Helper stale scheduling');
    const created=await exchange(h.ruth,'scheduled-create',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click());
    h.scheduledId=created.response.ballot.id;
    h.scheduledOther=await (await browser.newContext()).newPage();await signin(h.scheduledOther,'ruth');
    await h.ruth.locator('[data-ballot-edit="'+h.scheduledId+'"]').click();
    await h.ruth.getByLabel('Ballot title',{exact:true}).fill('Helper older attempted edit');
    await e.arm(h.ruth,'scheduled-stale',{match:isStaff,mode:'hold-request'});
    await h.ruth.getByRole('button',{name:'Save draft',exact:true}).click();
    for(let i=0;i<100&&e.peek('scheduled-stale').state!=='request-held';i++)await h.ruth.waitForTimeout(30);
    return e.peek('scheduled-stale');`);
  await run('held-request-intervening',`
    await h.scheduledOther.locator('[data-ballot-edit="'+h.scheduledId+'"]').click();
    await h.scheduledOther.getByLabel('Ballot title',{exact:true}).fill('Helper newest accepted edit');
    return await exchange(h.scheduledOther,'scheduled-newer',()=>h.scheduledOther.getByRole('button',{name:'Save draft',exact:true}).click());`);
  const stale=await run('held-request-refusal',`
    e.release('scheduled-stale','drop');
    const saved=await e.collect('scheduled-stale');
    await h.ruth.locator('[data-pending-retry="'+saved.request.body.operation_id+'"]').waitFor({state:'visible'});
    await reload(h.ruth);const before=await snapshot(h.ruth);
    const retry=await e.capture(h.ruth,'scheduled-retry',()=>h.ruth.locator('[data-pending-retry="'+saved.request.body.operation_id+'"]').click(),{match:isStaff});
    await h.ruth.waitForLoadState('networkidle');await reload(h.ruth);
    return {saved,retry,before,after:await snapshot(h.ruth),pending:await ids(h.ruth)};`);
  assert.equal(stale.saved.response.status,409);assert.equal(stale.retry.response.status,409);
  assert.deepEqual(stale.saved.request,stale.retry.request);assert.deepEqual(stale.saved.response.body,stale.retry.response.body);
  assert.deepEqual(stale.before,stale.after);assert.deepEqual(stale.pending,[]);
  pass('held genuine current request becomes a valid stale refusal and exact UI retry preserves it');

  await run('held-arm',`
    await createForm(h.ruth,'Helper held-before-reload');
    await e.arm(h.ruth,'held-original',{match:isStaff,mode:'hold'});
    await h.ruth.getByRole('button',{name:'Save draft',exact:true}).click();
    for(let i=0;i<100&&e.peek('held-original').state!=='response-held';i++)await h.ruth.waitForTimeout(30);
    return e.peek('held-original');`);
  const held=await run('held-reload',`
    const saved=e.peek('held-original');
    const disabled=await h.ruth.getByRole('button',{name:'Save draft',exact:true}).isDisabled();
    const count=h.writes.length; await reload(h.ruth);
    const pending=await ids(h.ruth),automaticWrites=h.writes.length-count;
    e.release('held-original','drop');await e.collect('held-original');
    const retry=await e.capture(h.ruth,'held-retry',()=>h.ruth.locator('[data-pending-retry="'+saved.request.body.operation_id+'"]').click(),{match:isStaff});
    await h.ruth.waitForLoadState('networkidle');
    return {saved,disabled,pending,automaticWrites,retry,final:await ids(h.ruth)};`);
  assert.equal(held.saved.state,'response-held'); assert(held.disabled);
  assert.equal(held.automaticWrites,0); assert.deepEqual(held.pending,[held.saved.request.body.operation_id]);
  assert.deepEqual(held.saved.request,held.retry.request); assert.deepEqual(held.final,[]);
  pass('held upstream reply survives separate calls and reload before delivery');

  const timed=await run('bounded-missing',`
    await e.arm(h.ruth,'no-action',{match:()=>false});
    return await e.collect('no-action',100);`);
  assert.equal(timed.state,'evidence-missing'); assert.match(timed.error,/exceeded/);
  let assertionSeen=false;
  try { await run('later-assertion',`
    await createForm(h.ruth,'Helper evidence survives');
    await e.capture(h.ruth,'before-assertion',()=>h.ruth.getByRole('button',{name:'Save draft',exact:true}).click(),{match:isStaff});
    throw new Error('Intentional later assertion failure');`);
  } catch { assertionSeen=true; }
  assert(assertionSeen);
  const retained=await run('evidence-survived',`return {saved:e.peek('before-assertion'),all:e.dump()};`);
  assert.equal(retained.saved.state,'captured');assert.equal(retained.saved.response.status,201);
  assert(!JSON.stringify(retained).includes('CommonGround!2026'));
  pass('bounded missing capture does not block later fixture and later assertion cannot erase saved exchange');
}
