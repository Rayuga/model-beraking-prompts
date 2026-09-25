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
