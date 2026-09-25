async function main() {
  await call('initialize', {protocolVersion: '2024-11-05', capabilities: {}, clientInfo: {name: 'oracle-failure-reproduction', version: '1.0.0'}});
  child.stdin.write(JSON.stringify({jsonrpc: '2.0', method: 'notifications/initialized'}) + '\n');
  await call('tools/call', {name: 'browser_navigate', arguments: {url: 'http://localhost:3000'}});
  await run('repro-setup', `browser.__recoverySmoke = {ruth: page, exchanges: {}, writes: [], pageErrors: []}; return {identity: await signin(page, 'ruth')};`);
  const accepted = await run('repro-observed-edit', `
    watch(h.ruth);
    await createForm(h.ruth, 'Oracle omission control');
    h.created = await exchange(h.ruth, 'created', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click());
    await h.ruth.getByRole('article').filter({has: h.ruth.getByRole('heading', {name: 'Oracle omission control', exact: true})}).getByRole('button', {name: 'Edit draft', exact: true}).click();
    await h.ruth.getByLabel('Ballot title', {exact: true}).fill('Oracle observed edit');
    h.edited = await exchange(h.ruth, 'observed-edit', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click());
    return {created: h.created, edited: h.edited, after: await snapshot(h.ruth)};`);
  assert.equal(accepted.created.status, 201); assert.equal(accepted.edited.status, 200);
  const prepared = await run('repro-omitted-prepare', `
    const payload = JSON.parse(h.edited.request.body);
    const current = (await snapshot(h.ruth)).ballots.find(ballot => ballot.id === h.edited.response.ballot.id);
    h.omitted = {...payload, title: 'Oracle revision omitted', operation_id: 'omitted-revision-' + Date.now()};
    delete h.omitted.expected_revision;
    h.omissionRequest = {...h.edited.request, body: JSON.stringify(h.omitted)};
    return {observed: h.edited.request, adapted: h.omissionRequest, omittedKeyAbsent: !Object.prototype.hasOwnProperty.call(h.omitted, 'expected_revision'), current};`);
  assert.equal(prepared.omittedKeyAbsent, true);
  assert.equal(JSON.parse(prepared.observed.body).expected_revision, 1);
  assert.equal(prepared.current.status, 'draft'); assert.equal(prepared.current.revision, 2);
  const refused = await run('repro-omitted-send', `
    const before = await snapshot(h.ruth);
    const result = await h.ruth.evaluate(async request => {
      const response = await fetch(request.path, {method: request.method, headers: {'content-type': 'application/json'}, body: request.body});
      return {status: response.status, body: await response.json()};
    }, h.omissionRequest);
    h.omissionResult = {request: h.omissionRequest, result, before, after: await snapshot(h.ruth)};
    return h.omissionResult;`);
  assert.equal(refused.result.status, 400);
  assert.deepEqual(refused.before, refused.after);
  assert.match(refused.result.body.error, /Expected revision/i);
  pass('actual observed edit with genuinely omitted revision is refused 400 with unchanged state');
  const fresh = await run('repro-positive-ui-edit', `
    await reload(h.ruth);
    await h.ruth.getByRole('article').filter({has: h.ruth.getByRole('heading', {name: 'Oracle observed edit', exact: true})}).getByRole('button', {name: 'Edit draft', exact: true}).click();
    await h.ruth.getByLabel('Ballot title', {exact: true}).fill('Oracle fresh revision accepted');
    const saved = await exchange(h.ruth, 'fresh-ui-edit', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click());
    return saved;`);
  assert.equal(fresh.status, 200);
  assert.equal(JSON.parse(fresh.request.body).expected_revision, 2);
  assert.equal(fresh.response.ballot.revision, 3);
  pass('normal current-revision UI edit still succeeds after the malformed probe');

  const lost = await run('repro-lost-create', `
    await createForm(h.ruth, 'Oracle recovery demonstration');
    h.lost = await exchange(h.ruth, 'lost-create', () => h.ruth.getByRole('button', {name: 'Save draft', exact: true}).click(), true);
    return {saved: h.lost, pending: await ids(h.ruth), actual: (await snapshot(h.ruth)).ballots.find(ballot => ballot.id === h.lost.response.ballot.id)};`);
  assert.equal(lost.saved.status, 201);
  const lostId = JSON.parse(lost.saved.request.body).operation_id;
  assert.deepEqual(lost.pending, [lostId]); assert.equal(lost.actual.title, 'Oracle recovery demonstration');
  const restored = await run('repro-lost-reload', `
    const count = h.writes.length; await reload(h.ruth);
    return {pending: await expectIds(h.ruth, [op(h.lost)]), automaticWrites: h.writes.length - count};`);
  assert.deepEqual(restored.pending, [lostId]); assert.equal(restored.automaticWrites, 0);
  const recovered = await run('repro-lost-retry', `
    const before = await snapshot(h.ruth), count = h.writes.length;
    const saved = await exchange(h.ruth, 'lost-retry', () => h.ruth.getByRole('button', {name: 'Retry', exact: true}).click());
    return {saved, pending: await ids(h.ruth), before, after: await snapshot(h.ruth), writes: h.writes.length - count, pageErrors: h.pageErrors};`);
  assert.deepEqual(recovered.saved.request, lost.saved.request);
  assert.deepEqual(recovered.saved.response, lost.saved.response);
  assert.equal(recovered.saved.replay, 'true'); assert.equal(recovered.saved.status, 201);
  assert.deepEqual(recovered.before, recovered.after); assert.deepEqual(recovered.pending, []);
  assert.equal(recovered.writes, 1); assert.deepEqual(recovered.pageErrors, []);
  pass('pinned MCP committed response loss survives reload and explicit exact UI Retry resolves once');
}
main().catch(error => { results.push({name: 'Oracle reproduction failure', passed: false, error: String(error)}); console.error(error); process.exitCode = 1; }).finally(() => {
  retain('reproduction-results', {mcpVersion: version, scoredOracle: false, actualExportedOracleApp: true,
    passed: results.filter(item => item.passed).length, failed: results.filter(item => !item.passed).length, results, stderr});
  child.kill();
});
