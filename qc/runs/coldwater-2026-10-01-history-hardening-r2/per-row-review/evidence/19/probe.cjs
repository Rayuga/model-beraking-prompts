const fs = require('node:fs');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const phase = process.argv[2];
const base = 'http://127.0.0.1:3000';
const request = async (path, options) => {
  const response = await fetch(base + path, options);
  assert.equal(response.ok, true, `${path}: ${response.status}`);
  return response.json();
};
const write = (path, body, method = 'POST') => request(path, {method, headers:{'content-type':'application/json'}, body:JSON.stringify(body)});
(async () => {
  let health;
  const start = performance.now();
  for (let attempt = 0; attempt < 60; attempt++) {
    try { health = await request('/api/health'); break; }
    catch (error) { if (attempt === 59) throw error; await new Promise(resolve => setTimeout(resolve,100)); }
  }
  assert.equal(health.ok,true);
  const healthReadyMs = performance.now() - start;
  const response = await fetch(base + '/');
  assert.equal(response.status,200);
  const html = await response.text();
  assert.match(html,/Colderwater Playground/);
  const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match=>match[1]);
  assert.equal(assets.length,2);
  const served = [];
  for (const path of [...assets, '/runner.html']) {
    const response = await fetch(base+path);
    assert.equal(response.status,200);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert(bytes.length>100);
    served.push({path, bytes:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex')});
  }
  if (phase === 'create') {
    assert.deepEqual(await request('/api/snippets'), []);
    const created = await write('/api/snippets',{title:'Row 19 durable state',filename:'runtime.js',code:'console.log(19)'});
    const edited = await write(`/api/snippets/${created.id}`,{...created,code:'console.log(20)'},'PUT');
    const restoreBody = {revision:edited.revision, sourceRevision:1, operationId:'row19-persistent-operation'};
    const restored = await write(`/api/snippets/${created.id}/restore`,restoreBody);
    assert.equal(restored.revision,3);
    const history = await request(`/api/snippets/${created.id}/history`);
    assert.equal(history.length,3);
    fs.writeFileSync('/evidence/expected.json',JSON.stringify({created,edited,restored,restoreBody,history},null,2));
    console.log(JSON.stringify({phase,healthReadyMs,served,created,edited,restored,history}));
  } else if (phase === 'restart') {
    const expected = JSON.parse(fs.readFileSync('/evidence/expected.json','utf8'));
    assert.deepEqual(await request('/api/snippets'),[expected.restored]);
    assert.deepEqual(await request(`/api/snippets/${expected.created.id}/history`),expected.history);
    assert.deepEqual(await write(`/api/snippets/${expected.created.id}/restore`,expected.restoreBody),expected.restored);
    assert.deepEqual(await request(`/api/snippets/${expected.created.id}/history`),expected.history);
    console.log(JSON.stringify({phase,healthReadyMs,served,retained:true,historyCount:expected.history.length,restoreReplayIdempotent:true}));
  } else {
    assert.deepEqual(await request('/api/snippets'),[]);
    console.log(JSON.stringify({phase,healthReadyMs,served,emptySeed:true}));
  }
})().catch(error=>{console.error(error);process.exit(1)});
