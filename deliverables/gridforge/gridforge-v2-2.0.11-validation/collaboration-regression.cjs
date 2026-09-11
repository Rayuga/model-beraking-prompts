const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async()=>{
  const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1280,height:800}});
  const results=[], errors=[];
  const open=async user=>{
    const p=await context.newPage(); p.on('pageerror',e=>errors.push(e.message));
    await p.goto('http://localhost:3000');
    await p.waitForFunction(()=>document.querySelector('#workbook-title').textContent==='Northwind Operations Plan');
    await p.locator('#user-select').selectOption(user); return p;
  };
  const jump=async(p,a)=>{await p.bringToFront(); await p.locator('#name-box').fill(a); await p.locator('#name-box').press('Enter');};
  const edit=async(p,a,v,commit=true)=>{await jump(p,a); await p.keyboard.type(v); if(commit) await p.keyboard.press('Enter');};
  const save=async p=>{
    if(await p.locator('#save-btn').isEnabled()) await p.locator('#save-btn').click();
    await p.waitForFunction(()=>document.querySelector('#save-state').textContent==='Saved');
  };
  const value=async(p,a,v)=>p.waitForFunction(({a,v})=>document.querySelector(`[data-addr="${a}"]`)?.textContent===v,{a,v},{timeout:5000});
  const get=(p,url)=>p.evaluate(async url=>(await fetch(url)).json(),url);
  const check=async(name,fn)=>{await fn(); results.push({name,passed:true}); console.log('PASS '+name);};
  try {
    const a=await open('riley'), b=await open('morgan');
    await check('live clean update, dirty non-overlap merge and same-cell conflict',async()=>{
      await edit(a,'R20','CLEAN-LIVE-RILEY'); await save(a); await value(b,'R20','CLEAN-LIVE-RILEY');
      await jump(b,'R20'); assert.match(await b.locator('#cell-editor-label').textContent(),/Riley Stone/);
      await edit(b,'T20','B-NONOVERLAP',false); await edit(a,'S20','A-NONOVERLAP'); await save(a);
      await value(b,'S20','A-NONOVERLAP'); assert.equal(await b.locator('#formula-bar').inputValue(),'B-NONOVERLAP');
      await b.bringToFront(); await b.keyboard.press('Enter'); await save(b); await value(a,'T20','B-NONOVERLAP');
      await a.reload(); await b.reload(); await value(b,'T20','B-NONOVERLAP');
      await edit(b,'S21','TAB-B-LOCAL-DRAFT',false); await edit(a,'S21','TAB-A-WINS'); await save(a);
      await b.waitForFunction(()=>/conflict.*S21/i.test(document.querySelector('#message').textContent),null,{timeout:5000});
      assert.equal(await b.locator('#formula-bar').inputValue(),'TAB-B-LOCAL-DRAFT');
      await b.bringToFront(); await b.keyboard.press('Enter');
      const rejected=b.waitForResponse(r=>r.url().endsWith('/save')&&r.status()===409);
      await b.locator('#save-btn').click(); await rejected;
      assert.equal((await get(a,'/api/workbooks/ops-plan')).workbook.sheets[0].cells.S21,'TAB-A-WINS');
      await b.reload(); await value(b,'S21','TAB-A-WINS');
      for(const [addr,text] of [['R20','CLEAN-LIVE-RILEY'],['S20','A-NONOVERLAP'],['T20','B-NONOVERLAP']]) await value(b,addr,text);
    });
    await check('three-view presence colors, overlapping selection and cleanup',async()=>{
      await a.locator('#user-select').selectOption('riley'); await b.locator('#user-select').selectOption('morgan');
      const a2=await open('riley');
      await jump(a,'B2'); await jump(a2,'D4'); await jump(b,'C3:E4');
      await a.waitForFunction(()=>{
        const t=document.querySelector('#presence').textContent;
        return /Riley Stone\s*\(2/.test(t)&&/Morgan Lee\s*\(1/.test(t);
      },null,{timeout:5000});
      await a.waitForFunction(()=>{
        const t=document.querySelector('#presence-legend').textContent;
        return /Morgan Lee.*C3:E4/.test(t)&&/Riley Stone.*B2/.test(t)&&/Riley Stone.*D4/.test(t);
      },null,{timeout:5000});
      const legend=await a.locator('.presence-legend-entry').allTextContents();
      assert.equal(legend.length,3); assert.ok(legend.some(t=>/Morgan Lee.*C3:E4/.test(t)));
      const colors=await a.locator('.presence-legend-entry .presence-dot').evaluateAll(els=>els.map(e=>getComputedStyle(e).backgroundColor));
      assert.equal(new Set(colors).size,3);
      for(const address of ['C3','D3','E3','C4','D4','E4']) assert.match(await a.locator(`[data-addr="${address}"]`).getAttribute('class'),/remote-presence/);
      await jump(b,'F6');
      await a.waitForFunction(()=>!document.querySelector('[data-addr="C3"]').classList.contains('remote-presence')&&document.querySelector('[data-addr="F6"]').classList.contains('remote-presence'),null,{timeout:5000});
      await jump(a2,'G7'); await jump(b,'G7');
      await a.waitForFunction(()=>document.querySelector('[data-addr="G7"]').style.getPropertyValue('--remote-rings').split('inset').length===3,null,{timeout:5000});
      await a2.close();
      await a.waitForFunction(()=>document.querySelectorAll('.presence-legend-entry').length===2,null,{timeout:5000});
      await b.locator('#user-select').selectOption('priya');
      await a.waitForFunction(()=>{
        const t=document.querySelector('#presence-legend').textContent; return t.includes('Priya Shah')&&!t.includes('Morgan Lee');
      },null,{timeout:5000});
      for(const address of ['H8','I9','J10']) await jump(b,address);
      await a.waitForFunction(()=>/Priya Shah.*J10/.test(document.querySelector('#presence-legend').textContent),null,{timeout:5000});
      for(const address of ['G7','H8','I9']) assert.doesNotMatch(await a.locator(`[data-addr="${address}"]`).getAttribute('class'),/remote-presence/);
      await b.close();
    });
    await check('stale overlapping save and three workbook identity forgeries',async()=>{
      let request;
      a.on('request',r=>{if(r.url().endsWith('/save')) request={url:r.url(),method:r.method(),body:r.postDataJSON()};});
      await edit(a,'T2','BASE-T2'); await save(a);
      const baseline=await get(a,'/api/workbooks/ops-plan');
      const template=structuredClone(request);
      await edit(a,'T2','CURRENT-T2'); await save(a);
      const protectedWorkbook=await get(a,'/api/workbooks/ops-plan'), history=await get(a,'/api/workbooks/ops-plan/revisions');
      const protectedRequest=structuredClone(request);
      for(let i=0;i<4;i++) {
        const probe=structuredClone(protectedRequest);
        probe.body.baseRevision=protectedWorkbook.revision; probe.body.workbook=structuredClone(protectedWorkbook.workbook);
        if(i===0) {probe.body={...template.body,baseRevision:baseline.revision,workbook:structuredClone(baseline.workbook)}; probe.body.workbook.sheets[0].cells.T2='FORGED-STALE-OVERWRITE';}
        if(i===1) probe.url=probe.url.replace('ops-plan','unknown-workbook');
        if(i===2) probe.body.workbookId='unknown-workbook';
        if(i===3) probe.body.workbook.id='unknown-workbook';
        const r=await a.evaluate(async({url,method,body})=>{const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return {status:res.status,body:await res.json()};},probe);
        assert.ok(r.status>=400&&r.status<500,JSON.stringify(r));
        if(i===0) {assert.equal(r.status,409); assert.ok(r.body.conflictingCells.includes('T2'));}
        assert.deepEqual(await get(a,'/api/workbooks/ops-plan'),protectedWorkbook);
        assert.deepEqual(await get(a,'/api/workbooks/ops-plan/revisions'),history);
      }
    });
    assert.deepEqual(errors,[]);
  } finally {
    fs.writeFileSync('/results/collaboration-regression.json',JSON.stringify({scope:'local golden checks, not Oracle grading',results,errors},null,2));
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exitCode=1;});
