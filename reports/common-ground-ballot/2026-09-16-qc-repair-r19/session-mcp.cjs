const {spawn} = require('node:child_process');
const fs = require('node:fs');
const assert = require('node:assert/strict');

const version = require('/usr/local/lib/node_modules/@playwright/mcp/package.json').version;
assert.equal(version, '0.0.79');
fs.mkdirSync('/results', {recursive: true});
const child = spawn('playwright-mcp', ['--headless', '--isolated', '--executable-path=/usr/local/bin/chromium', '--no-sandbox'], {stdio: ['pipe', 'pipe', 'pipe']});
let buffer = '', sequence = 0, stderr = '';
const waiting = new Map(), results = [];
child.stderr.on('data', data => { stderr += data; });
child.stdout.on('data', data => {
  buffer += data;
  while (buffer.includes('\n')) {
    const index = buffer.indexOf('\n'), line = buffer.slice(0, index);
    buffer = buffer.slice(index + 1);
    let value;
    try { value = JSON.parse(line); } catch { continue; }
    if (waiting.has(value.id)) { waiting.get(value.id)(value); waiting.delete(value.id); }
  }
});
function redact(value) { return JSON.stringify(value, null, 2).replaceAll('CommonGround!2026', '[fixture password redacted]'); }
function retain(name, value) { fs.writeFileSync(`/results/mcp-recovery-${name}.json`, redact(value), {mode: 0o600}); }
async function call(method, params) {
  const id = ++sequence;
  let timer;
  try {
    return await Promise.race([
      new Promise(resolve => { waiting.set(id, resolve); child.stdin.write(JSON.stringify({jsonrpc: '2.0', id, method, params}) + '\n'); }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('MCP timeout: ' + method)), 55000); }),
    ]);
  } finally { clearTimeout(timer); waiting.delete(id); }
}

// Persistent references live in the trusted MCP browser process, never in app
// storage or DOM. A later tool call uses the same Page/Context/request fixtures.
const support = String.raw`
const browser = page.context().browser();
const h = browser.__recoverySmoke;
const accounts = {ruth: 'ruth.adebayo', arun: 'arun.das', leila: 'leila.ward', owen: 'owen.park'};
const pathOf = request => request.url().replace(/^https?:\/\/[^/]+/, '').split('?')[0];
const isStaff = request => ['POST', 'PATCH'].includes(request.method()) && /^\/api\/(?:ballots(?:\/[^/]+(?:\/(?:open|close|publish))?)?|members\/[^/]+)$/.test(pathOf(request));
const shape = request => ({path: pathOf(request), method: request.method(), body: request.postData()});
const op = saved => JSON.parse(saved.request.body).operation_id;
const ids = async p => (await p.locator('[data-pending-id]').evaluateAll(items => items.map(item => item.dataset.pendingId))).sort();
async function expectIds(p, expected) {
  await p.waitForFunction(expected => JSON.stringify([...document.querySelectorAll('[data-pending-id]')].map(item => item.dataset.pendingId).sort()) === JSON.stringify([...expected].sort()), expected);
  return ids(p);
}
async function read(p, path) { return p.evaluate(async path => { const response = await fetch(path); return {status: response.status, body: await response.json()}; }, path); }
async function snapshot(p) { return {ballots: (await read(p, '/api/ballots')).body.ballots, members: (await read(p, '/api/members')).body, audit: (await read(p, '/api/audit')).body}; }
async function signin(p, who) {
  await p.goto('http://localhost:3000');
  if (await p.locator('#login-view').isVisible()) {
    await p.getByLabel('Email', {exact: true}).fill(accounts[who] + '@commonground.example');
    await p.getByLabel('Password', {exact: true}).fill('CommonGround!2026');
    await p.getByRole('button', {name: 'Sign in', exact: true}).click();
  }
  await p.locator('#app-view').waitFor({state: 'visible'});
  await p.waitForLoadState('networkidle');
  return p.locator('#user-name').innerText();
}
async function signout(p) {
  await p.getByRole('button', {name: 'Sign out', exact: true}).click();
  await p.locator('#login-view').waitFor({state: 'visible'});
}
async function reload(p) {
  await p.reload();
  await p.locator('#app-view').waitFor({state: 'visible'});
  await p.waitForLoadState('networkidle');
}
async function createForm(p, title) {
  await p.locator('.nav-item[data-view="ballots"]').click();
  await p.getByRole('button', {name: 'New ballot', exact: true}).click();
  await p.getByLabel('Ballot title', {exact: true}).fill(title);
  await p.locator('#ballot-description').fill('Pinned MCP recovery rehearsal');
  await p.getByLabel('Voting method').selectOption('single');
  await p.locator('input[name=choice]').nth(0).fill('Morning');
  await p.locator('input[name=choice]').nth(1).fill('Evening');
}
async function exchange(p, label, act, lose = false) {
  let used = false, yes, no;
  const completion = new Promise((resolve, reject) => { yes = resolve; no = reject; });
  const handler = async route => {
    if (used || !isStaff(route.request())) return route.fallback();
    used = true;
    const request = shape(route.request());
    h.exchanges[label] = {request};
    try {
      const upstream = await route.fetch({maxRetries: 0});
      const saved = {request, status: upstream.status(), response: await upstream.json(), replay: upstream.headers()['x-idempotent-replay'] || null, lost: lose};
      // Save the actual receipt before delivery or any assertions.
      h.exchanges[label] = saved;
      if (lose) await route.abort('failed'); else await route.fulfill({response: upstream});
      yes(saved);
    } catch (error) { await route.abort('failed').catch(() => {}); no(error); }
  };
  await p.route('**/api/**', handler);
  try {
    await act();
    const saved = await completion;
    if (lose) {
      await p.locator('[data-pending-retry="' + op(saved) + '"]').waitFor({state: 'visible'});
      await p.waitForFunction(id => !document.querySelector('[data-pending-retry="' + id + '"]')?.disabled, op(saved));
    } else await p.locator('[data-pending-id="' + op(saved) + '"]').waitFor({state: 'detached'});
    await p.waitForLoadState('networkidle');
    return saved;
  } finally { await p.unroute('**/api/**', handler); }
}
function watch(p) {
  p.setDefaultTimeout(15000);
  p.on('request', request => { if (isStaff(request)) h.writes.push(shape(request)); });
  p.on('pageerror', error => h.pageErrors.push(error.message));
}
`;
async function run(name, body) {
  const response = await call('tools/call', {name: 'browser_run_code_unsafe', arguments: {code: `async(page)=>{${support}\n${body}\n}`}});
  retain(name, response);
  assert(!response.error && !response.result?.isError, redact(response).slice(-1800));
  const text = response.result.content.filter(item => item.type === 'text').map(item => item.text).join('\n');
  assert(text.includes('### Result\n'), text.slice(-1500));
  return JSON.parse(text.split('### Result\n')[1].split('\n###')[0]);
}
const pass = name => { results.push({name, passed: true}); console.log('PASS MCP RECOVERY', name); };
const expectedInsecure = process.env.EXPECT_INSECURE_SESSION === '1';
async function main() {
  await call('initialize', {protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'session-credential-probes',version:'1'}});
  child.stdin.write(JSON.stringify({jsonrpc:'2.0',method:'notifications/initialized'})+'\n');
  await call('tools/call',{name:'browser_navigate',arguments:{url:'http://localhost:3000'}});
  const setup = await run('sessions-setup', `
    const state = browser.__sessionSecurity = {a:page, rows:[], originals:[]};
    const login = async p => {
      const captured = [], pending = [];
      const listener = response => {
        if(response.request().method() !== 'GET')return;
        const job = response.json().then(body => {
          if(body && Array.isArray(body.ballots) && body.ballots.length) captured.push({response, body, request:response.request()});
        }).catch(()=>{}); pending.push(job);
      };
      p.on('response',listener);
      await p.goto('http://localhost:3000');
      await p.getByLabel('Email',{exact:true}).fill('ruth.adebayo@commonground.example');
      await p.getByLabel('Password',{exact:true}).fill('CommonGround!2026');
      const responsePromise=p.waitForResponse(response=>response.request().method()==='POST');
      await p.getByRole('button',{name:'Sign in',exact:true}).click();
      const loginResponse=await responsePromise;
      await p.getByRole('button',{name:'Sign out',exact:true}).waitFor({state:'visible'});
      await p.waitForLoadState('networkidle'); await Promise.all(pending); p.removeListener('response',listener);
      if(!captured.length)throw new Error('No actual populated protected read was captured');
      const actual=captured[captured.length-1], headers=await actual.request.allHeaders();
      const issued=await loginResponse.headerValues('set-cookie');
      const pair=issued.map(value=>value.split(';')[0]).find(value=>(headers.cookie||'').split(';').some(part=>part.trim()===value));
      if(!pair)throw new Error('This local fixture did not reveal its issued cookie in the observed protected request');
      const separator=pair.indexOf('='), cookieName=pair.slice(0,separator), credential=decodeURIComponent(pair.slice(separator+1));
      const user=(await loginResponse.json()).user;
      return {page:p,url:actual.request.url(),method:actual.request.method(),cookieName,credential,user,
        count:actual.body.ballots.length,status:actual.response.status()};
    };
    state.originals.push(await login(state.a));
    state.b=await (await browser.newContext()).newPage();
    state.originals.push(await login(state.b));
    return {reads:state.originals.map(item=>({status:item.status,records:item.count,method:item.method,url:item.url})),
      independentContexts:state.a.context()!==state.b.context(),distinctCredentials:state.originals[0].credential!==state.originals[1].credential};`);
  assert(setup.independentContexts); assert(setup.distinctCredentials);
  for(const row of setup.reads){assert.equal(row.status,200);assert(row.records>0);}
  pass('two legitimate independently issued sessions are distinct and read real protected records');
  const prepared=await run('sessions-prepare-private-probes', `
    const state=browser.__sessionSecurity, original=state.originals[0];
    const token=original.credential, offset=Math.floor(token.length/2);
    const tampered=token.slice(0,offset)+(token[offset]==='A'?'B':'A')+token.slice(offset+1);
    const claims={sub:original.user.id,email:original.user.email,name:original.user.name,role:original.user.role};
    const encode=async value=>state.a.evaluate(value=>btoa(unescape(encodeURIComponent(JSON.stringify(value)))).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_'),value);
    const payload=await encode(claims), header=await encode({alg:'none',typ:'JWT'});
    state.candidates=[['public-id',original.user.id],['public-email',original.user.email],['public-name',original.user.name],['public-role',original.user.role],
      ['one-character-tamper',tampered],['unsigned-json-claims',JSON.stringify(claims)],['unsigned-encoded-claims',payload],['unsigned-jwt-claims',header+'.'+payload+'.']];
    return {categories:state.candidates.map(item=>item[0]),oneCharacterChanged:[...token].filter((character,index)=>character!==tampered[index]).length};`);
  assert.equal(prepared.oneCharacterChanged,1);
  const outcomes=await run('sessions-probe-outcomes', `
    const state=browser.__sessionSecurity, original=state.originals[0];
    const summarize=async response=>{
      let body;try{body=await response.json();}catch{body={};}
      return {status:response.status(),protectedRecords:!!(body&&Array.isArray(body.ballots)&&body.ballots.length),
        denial:[401,403].includes(response.status())||[301,302,303,307,308].includes(response.status())};
    };
    for(const [category,candidate] of state.candidates){
      const context=await browser.newContext();
      try{
        const before=await summarize(await context.request.fetch(original.url,{method:original.method,maxRedirects:0}));
        const probe=await summarize(await context.request.fetch(original.url,{method:original.method,headers:{Cookie:original.cookieName+'='+encodeURIComponent(candidate)},maxRedirects:0}));
        const after=await summarize(await context.request.fetch(original.url,{method:original.method,maxRedirects:0}));
        state.rows.push({category,before,probe,after,passed:before.denial&&!before.protectedRecords&&probe.denial&&!probe.protectedRecords&&after.denial&&!after.protectedRecords});
      }finally{await context.close();}
    }
    return state.rows;`);
  const failures=outcomes.filter(row=>!row.passed);
  if(expectedInsecure){
    assert(failures.some(row=>row.category==='public-id'&&row.probe.status===200&&row.probe.protectedRecords), 'Predictable-session mutant escaped the public identity probe');
    pass('predictable public-ID session mutant is rejected by the credential criterion');
  }else{
    assert.deepEqual(failures,[]);
    pass('public identity, one-character tamper and unsigned claims all fail without granting a session');
  }
  const final=await run('sessions-final-positive-controls', `
    const state=browser.__sessionSecurity, rows=[];
    for(const original of state.originals){
      const response=await original.page.context().request.fetch(original.url,{method:original.method});
      const body=await response.json(); rows.push({status:response.status(),protectedRecords:!!(body&&Array.isArray(body.ballots)&&body.ballots.length)});
    }
    return rows;`);
  for(const row of final){assert.equal(row.status,200);assert(row.protectedRecords);}
  pass('both legitimate sessions remain usable after all credential probes');
  retain('session-criterion-verdict',{criterion:'unforgeable_session_credentials',passed:failures.length===0,expectedInsecure,
    transport:'Cookie name discovered from login and actual protected request; no credential values retained',cases:outcomes,positiveControls:final});
}
main().catch(error=>{results.push({name:'Session security reproduction failure',passed:false,error:String(error)});console.error(error);process.exitCode=1;}).finally(()=>{
  retain('session-results',{mcpVersion:version,scoredOracle:false,expectedInsecure,passed:results.filter(item=>item.passed).length,failed:results.filter(item=>!item.passed).length,results,stderr});
  child.kill();
});
