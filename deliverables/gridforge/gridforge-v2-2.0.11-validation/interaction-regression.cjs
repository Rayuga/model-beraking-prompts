// Local golden checks use UI gestures; API mutations are limited to rejection probes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({executablePath:'/usr/local/bin/chromium', args:['--no-sandbox']});
  const context = await browser.newContext({viewport:{width:1280,height:800}, permissions:['clipboard-read','clipboard-write']});
  const page = await context.newPage();
  const results = [], errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cell = a => page.locator(`[data-addr="${a}"]`);
  const raw = async expected => assert.equal(await page.locator('#formula-bar').inputValue(), expected);
  const value = async (a, expected) => assert.equal(await cell(a).textContent(), String(expected), a);
  const jump = async a => { await page.locator('#name-box').fill(a); await page.locator('#name-box').press('Enter'); };
  const edit = async (a, text) => { await jump(a); await page.keyboard.type(text); await page.keyboard.press('Enter'); };
  const read = route => page.evaluate(async route => (await fetch(route)).json(), route);
  const current = () => read('/api/workbooks/ops-plan');
  const history = () => read('/api/workbooks/ops-plan/revisions');
  const save = async () => {
    if (await page.locator('#save-btn').isEnabled()) await page.locator('#save-btn').click();
    await page.waitForFunction(() => document.querySelector('#save-state').textContent === 'Saved');
  };
  const paste = async (a, text) => {
    await jump(a); await page.evaluate(text => navigator.clipboard.writeText(text), text);
    await page.keyboard.press('Control+V');
    await page.waitForFunction(({a,first})=>document.querySelector(`[data-addr="${a}"]`)?.textContent===first,
      {a,first:text.split(/[\t\n]/)[0]});
  };
  const drag = async (from, to) => {
    for(let attempt=0;attempt<8;attempt++) {
      const g=await page.locator('#grid').boundingBox();
      const boxes=await page.evaluate(addresses=>addresses.map(a=>{
        const r=document.querySelector(`[data-addr="${a}"]`).getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};
      }),[from,to]);
      const left=Math.min(...boxes.map(b=>b.x)),right=Math.max(...boxes.map(b=>b.x));
      const top=Math.min(...boxes.map(b=>b.y)),bottom=Math.max(...boxes.map(b=>b.y));
      const dx=left<g.x+65?left-g.x-90:right>g.x+g.width-30?right-g.x-g.width+60:0;
      const dy=top<g.y+60?top-g.y-90:bottom>g.y+g.height-30?bottom-g.y-g.height+60:0;
      if(!dx&&!dy)break;
      await page.mouse.move(g.x+g.width/2,g.y+g.height/2);await page.mouse.wheel(dx,dy);await page.waitForTimeout(150);
    }
    const snapshot=await page.waitForFunction(({from,to})=>{
      const boxes=[from,to].map(a=>document.querySelector(`[data-addr="${a}"]`)?.getBoundingClientRect());
      if(boxes.some(b=>!b||!b.width||!b.height)) return false;
      return boxes.map(({x,y,width,height})=>({x,y,width,height}));
    },{from,to});
    const [a,b]=await snapshot.jsonValue();
    const hits=await page.evaluate(boxes=>boxes.map(r=>document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[data-addr]')?.dataset.addr),[a,b]);
    assert.deepEqual(hits,[from,to],'Mouse endpoints must be visibly hit-testable');
    await page.mouse.move(a.x+a.width/2,a.y+a.height/2); await page.mouse.down();
    await page.mouse.move(b.x+b.width/2,b.y+b.height/2,{steps:12}); await page.mouse.up();
  };
  const check = async (name, fn) => {
    await fn(); results.push({name,passed:true}); console.log('PASS '+name);
  };
  try {
    await page.goto('http://localhost:3000');
    await page.waitForFunction(() => document.querySelector('#workbook-title').textContent === 'Northwind Operations Plan');
    await check('exact formula precedence and raw values', async () => {
      for (const [a,f,n] of [['D2','=B2*(C2+10)',390],['G2','=C2+3*4',132],['G3','=(2+3)*4',20],['G4','=20/2+3*4',22],['G5','=20/(2+3)*4',16],['G8','=20-3*4',8]]) {
        await edit(a,f); await value(a,n); await jump(a); await raw(f);
      }
    });
    await check('selected reference replacement followed by one operator', async () => {
      await jump('G6'); await page.keyboard.type('='); await cell('B3').click(); await raw('=B3');
      await page.locator('#formula-bar').click(); await page.keyboard.press('End');
      await page.keyboard.press('Shift+ArrowLeft'); await page.keyboard.press('Shift+ArrowLeft');
      await cell('C3').click(); await raw('=C3'); await page.keyboard.type('+'); await raw('=C3+');
      await page.keyboard.type('3*4'); await page.keyboard.press('Enter'); await value('G6',362);
    });
    await check('alternating mouse references preserve each operator', async () => {
      await jump('I10'); await page.keyboard.type('=');
      for (const [a,op,expected] of [['B2','*','=B2'],['C2','+','=B2*C2'],['B3','/','=B2*C2+B3'],['B3','','=B2*C2+B3/B3']]) {
        await cell(a).click(); await raw(expected);
        if(op) { await page.keyboard.type(op); await raw(expected+op); }
      }
      await page.keyboard.press('Enter'); await value('I10',361);
    });
    await check('mid-formula caret insertion preserves operators', async () => {
      await edit('G7','=B2+10'); await jump('G7'); await page.locator('#formula-bar').click();
      await page.keyboard.press('Home'); for(let i=0;i<3;i++) await page.keyboard.press('ArrowRight');
      await page.keyboard.type('*C2'); await raw('=B2*C2+10'); await page.keyboard.press('Enter'); await value('G7',370);
      await jump('G7'); await page.locator('#formula-bar').click(); await page.keyboard.press('Home');
      await page.keyboard.press('ArrowRight'); await page.keyboard.type('('); await page.keyboard.press('End');
      await page.keyboard.type(')'); await raw('=(B2*C2+10)'); await page.keyboard.press('Enter'); await value('G7',370);
    });
    await check('below-cell SUM dropdown and mouse range insertion', async () => {
      for (const [a,v] of [['F22','3'],['F23','2'],['F24','5']]) await edit(a,v);
      await jump('H22'); await page.keyboard.type('=SU');
      const box=page.locator('#formula-suggestions'); await box.waitFor({state:'visible'});
      const bounds=await box.boundingBox(), anchor=await cell('H22').boundingBox();
      assert.ok(bounds.y >= anchor.y+anchor.height-2 && bounds.y <= anchor.y+anchor.height+12);
      await box.locator('[data-function="SUM"]').click(); await raw('=SUM(');
      await drag('F22','F24'); await raw('=SUM(F22:F24');
      for(const a of ['F22','F23','F24']) assert.match(await cell(a).getAttribute('class'),/formula-ref/);
      await page.keyboard.type(')'); await raw('=SUM(F22:F24)'); await page.keyboard.press('Enter'); await value('H22',10);
      await edit('F24','8'); await value('H22',13);
    });
    await check('all five mixed range/scalar functions recalculate', async () => {
      for(const [a,v] of [['F25','3'],['F26','2'],['F27','5'],['G25','120']]) await edit(a,v);
      const cases=[['H25','SUM',130,160],['H26','AVG',32.5,40],['H27','MIN',2,2],['H28','MAX',120,150],['H29','COUNT',4,4]];
      for(const [a,f,n] of cases) { await edit(a,`=${f}(F25:F27,G25)`); await value(a,n); }
      await edit('G25','150'); for(const [a,f,,n] of cases) { await value(a,n); await jump(a); await raw(`=${f}(F25:F27,G25)`); }
    });
    await check('shift-click and reverse drag select/delete/undo nine cells', async () => {
      const addresses=['J35','K35','L35','J36','K36','L36','J37','K37','L37'];
      const entries=Array.from('ABCDEFGHI',v=>'RANGE-'+v);
      await paste('J35',[entries.slice(0,3).join('\t'),entries.slice(3,6).join('\t'),entries.slice(6).join('\t')].join('\n'));
      await cell('J35').click(); await cell('L37').click({modifiers:['Shift']});
      assert.equal(await page.locator('#selection-label').textContent(),'J35:L37');
      for(const a of addresses) assert.match(await cell(a).getAttribute('class'),/in-range|selected/);
      await cell('I35').click();
      const boundaries={}; for(const a of ['I35','M37','J38']) boundaries[a]=await cell(a).textContent();
      await drag('L37','J35');
      assert.equal(await page.locator('#selection-label').textContent(),'J35:L37');
      await page.keyboard.press('Delete'); for(const a of addresses) await value(a,'');
      await page.locator('#undo-btn').click(); for(let i=0;i<9;i++) await value(addresses[i],entries[i]);
      for(const [a,v] of Object.entries(boundaries)) await value(a,v);
    });
    await check('division, invalid syntax and scalar/range cycle recovery', async () => {
      for(const [a,f] of [['H2','=10/0'],['H3','=SUM(']]) { await edit(a,f); assert.match(await cell(a).textContent(),/#|error/i); }
      await edit('H2','=10/2'); await value('H2',5); await edit('H3','=SUM(2,3)'); await value('H3',5);
      await edit('J20','5'); await edit('J21','=J20+1'); await edit('J20','=J21+1');
      for(const a of ['J20','J21']) assert.match(await cell(a).textContent(),/CIRC|CYCLE|ERROR/i);
      await page.locator('#undo-btn').click(); await value('J20',5); await value('J21',6);
      for(const [a,v] of [['J23','1'],['J24','2'],['J25','3'],['J22','=SUM(J23:J25)']]) await edit(a,v);
      await edit('J25','=J22'); for(const a of ['J22','J25']) assert.match(await cell(a).textContent(),/CIRC|CYCLE|ERROR/i);
      await edit('J25','4'); await value('J22',7);
    });
    await check('sideways numeric and relative formula fill with undo/redo', async () => {
      await edit('J60','2'); await edit('K60','4'); await jump('J60:O60'); await page.locator('#fill-right-btn').click();
      for(const [a,n] of [['J60',2],['K60',4],['L60',6],['M60',8],['N60',10],['O60',12]]) await value(a,n);
      await page.locator('#undo-btn').click(); for(const a of ['L60','M60','N60','O60']) await value(a,'');
      await page.locator('#redo-btn').click(); await edit('J61','=J60*10'); await jump('J61:M61'); await page.locator('#fill-right-btn').click();
      for(const [a,f,n] of [['J61','=J60*10',20],['K61','=K60*10',40],['L61','=L60*10',60],['M61','=M60*10',80]]) { await value(a,n); await jump(a); await raw(f); }
      await page.locator('#undo-btn').click(); for(const a of ['K61','L61','M61']) await value(a,'');
      await page.locator('#redo-btn').click(); await value('M61',80);
    });
    await check('nineteen invalid saves and four session probes preserve storage', async () => {
      let captured;
      page.on('request',request=>{ if(request.url().endsWith('/save')) captured={url:request.url(),method:request.method(),body:request.postDataJSON()}; });
      await edit('R2','SESSION-OWNER-CHECK'); await save(); assert.ok(captured);
      const before=await current(), revisions=await history();
      const base={...captured.body,baseRevision:before.revision,workbook:before.workbook};
      const mutations=[b=>delete b.baseRevision,b=>b.baseRevision=null,b=>b.baseRevision=String(before.revision),b=>b.baseRevision+=.5,b=>b.baseRevision=-1,b=>b.baseRevision+=1000,
        b=>delete b.workbook,b=>b.workbook=null,b=>b.workbook=[],b=>delete b.workbook.sheets,b=>b.workbook.sheets=[],b=>delete b.workbook.sheets[0].cells,
        b=>b.workbook.sheets[0].cells=[],b=>b.workbook.sheets[0].cells.BADREF='x',b=>b.workbook.sheets[0].cells.A1=1,b=>b.workbook.sheets[0].cells.A1=null,
        b=>b.workbook.title='Forged',b=>b.workbook.sheets[0].id='forged',b=>b.workbook.sheets[0].name='Forged',
        b=>b.userId=base.userId==='riley'?'morgan':'riley',b=>b.userId='unknown-user',b=>delete b.sessionId,b=>b.sessionId='unknown-session'];
      for(let i=0;i<mutations.length;i++) {
        const body=structuredClone(base); mutations[i](body);
        const result=await page.evaluate(async ({url,method,body})=>{
          const r=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
          return {status:r.status,body:await r.json()};
        },{...captured,body});
        assert.ok(result.status>=400&&result.status<500,`probe ${i+1}: ${JSON.stringify(result)}`);
        assert.deepEqual(await current(),before); assert.deepEqual(await history(),revisions);
      }
    });
    assert.deepEqual(errors,[]);
  } finally {
    fs.writeFileSync('/results/interaction-regression.json',JSON.stringify({scope:'local golden regressions, not Oracle grading',results,errors},null,2));
    await browser.close();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
