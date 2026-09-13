const fs = require('node:fs');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {spawn, spawnSync} = require('node:child_process');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results = [];
const hash = x => crypto.createHash('sha256').update(x).digest('hex');
const output = () => fs.writeFileSync('/results/results.json', JSON.stringify({paidJudge:false,sourceChanged:false,results}, null, 2));
async function main() {
  assert.equal(spawnSync('bash',['/solution/solve.sh'],{stdio:'inherit'}).status,0);
  for(const file of ['public/js/app.js','src/index.js','src/db.js']) {
    assert.equal(hash(fs.readFileSync('/app/'+file)),hash(fs.readFileSync('/solution/app/'+file)));
    assert.equal(spawnSync('node',['--check','/app/'+file],{stdio:'inherit'}).status,0);
  }
  for(const file of ['/solution/solve.sh','/tests/test.sh','/tests/app-lifecycle.sh']) assert.equal(spawnSync('bash',['-n',file],{stdio:'inherit'}).status,0);
  const server = spawn('node',['--experimental-sqlite','src/index.js'],{cwd:'/app',stdio:'inherit'});
  let browser;
  try {
    for(let attempt=0;;attempt++) {
      try {if((await fetch('http://localhost:3000')).ok)break;} catch {}
      assert(attempt<100,'Startup readiness'); await new Promise(r=>setTimeout(r,100));
    }
    browser = await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
    const ctx = await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
    const page = await ctx.newPage();
    const fresh = async()=>{await page.goto('http://localhost:3000');await page.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');};
    const lines = ()=>page.locator('#editor .text').evaluateAll(es=>es.map(e=>e.dataset.lineText));
    const find = async q=>{await page.locator('#find-box').fill(q);await page.locator('#find-next-btn').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'editor');};
    const caretPositions = ()=>page.locator('#editor .caret').evaluateAll(es=>es.map(e=>{
      const row=e.closest('.line'),text=e.closest('.text'),range=document.createRange();range.setStart(text,0);range.setEndBefore(e);
      return {line:Number(row.dataset.line),col:range.toString().length};
    }));
    const glyph = (line,col)=>page.locator(`.line[data-line="${line}"] .text`).evaluate((e,col)=>{
      const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n,remaining=col;
      while(n=walker.nextNode()) {if(remaining<=n.length){const range=document.createRange();range.setStart(n,remaining);range.collapse(true);const r=range.getBoundingClientRect();return {x:r.x+0.1,y:r.y+r.height/2};}remaining-=n.length;}
      throw Error('No glyph boundary');
    },col);
    const copy = async expected=>{
      await page.evaluate(()=>navigator.clipboard.writeText('PENDING-LOCAL-COPY'));
      await page.keyboard.press('Control+c');
      await page.waitForFunction(async()=>await navigator.clipboard.readText()!=='PENDING-LOCAL-COPY');
      const actual=await page.evaluate(()=>navigator.clipboard.readText());if(expected!==undefined)assert.equal(actual,expected);return actual;
    };
    const selectCarets = async(targets,ends,offsets)=>{
      await page.mouse.move(500,400);await page.mouse.wheel(0,-10000);
      await page.waitForFunction(()=>document.querySelector('#editor').scrollTop===0);
      for(let i=0;i<targets.length;i++) {
        const col=offsets?offsets[i]:(ends?(await lines())[targets[i]].length:0),p=await glyph(targets[i],col);
        if(i)await page.keyboard.down('Alt');await page.mouse.click(p.x,p.y);if(i)await page.keyboard.up('Alt');
      }
      const got=await caretPositions();assert.deepEqual(got,targets.map((line,i)=>({line,col:offsets?offsets[i]:(ends?fsBaseline[line].length:0)})));
      return got;
    };
    let fsBaseline;
    const test = async(name,fn)=>{
      try {await fresh();fsBaseline=await lines();const evidence=await fn(fsBaseline);results.push({name,passed:true,evidence});console.log('PASS '+name);}
      catch(error){results.push({name,passed:false,error:error.stack});console.log('FAIL '+name+' '+error.message);}
      output();
    };
    for(let iteration=1;iteration<=3;iteration++) {
      await test('Original 3-caret Backspace Delete Undo, attempt '+iteration,async baseline=>{
        const targets=['Timeline','Customer impact','Action items'].map(x=>baseline.indexOf(x));assert(targets.every(x=>x>=0));
        const checkpoints=[];
        for(const key of ['Backspace','Delete']) {
          const positions=await selectCarets(targets,key==='Backspace');await page.keyboard.press(key);
          const expected=baseline.map((x,i)=>targets.includes(i)?(key==='Backspace'?x.slice(0,-1):x.slice(1)):x);
          assert.deepEqual(await lines(),expected);checkpoints.push({key,positions,text:targets.map(i=>expected[i])});
          await page.keyboard.press('Control+z');assert.deepEqual(await lines(),baseline);
        }
        await fresh();assert.deepEqual(await lines(),baseline);return checkpoints;
      });
      await test('Original 51-line real mouse and keyboard offscreen selection, attempt '+iteration,async baseline=>{
        await find('ALPHA-0010');await page.keyboard.press('Home');
        const start=baseline.findIndex(x=>x.includes('ALPHA-0010')),end=baseline.findIndex(x=>x.includes('ALPHA-0060'));
        const r=await page.locator('#editor').boundingBox(),origin=await glyph(start,0),target=await page.locator(`.line[data-line="${end}"]`).boundingBox();
        const before=await page.locator('#editor').evaluate(e=>e.scrollTop);assert(target.y>=Math.min(r.y+r.height,800));
        assert.deepEqual(await caretPositions(),[{line:start,col:0}]);
        await page.mouse.move(origin.x,origin.y);await page.mouse.down();
        try {await page.mouse.move(r.x+r.width-20,Math.min(r.y+r.height+12,798),{steps:15});await page.waitForFunction(end=>document.querySelector(`.line[data-line="${end}"] .selection`),end,{timeout:20000});}
        finally {await page.mouse.up();}
        const copied=await copy();assert(copied.startsWith(baseline[start]));assert(copied.includes(baseline[end]));assert(baseline.join('\n').startsWith(copied)===false);
        const after=await page.locator('#editor').evaluate(e=>e.scrollTop);assert(after>before);
        await find('ALPHA-0010');await page.keyboard.press('Home');const keyboardBefore=await page.locator('#editor').evaluate(e=>e.scrollTop);
        const target2=await page.locator(`.line[data-line="${end}"]`).boundingBox();assert(target2.y>=Math.min(r.y+r.height,800));
        for(let n=0;n<50;n++)await page.keyboard.press('Shift+ArrowDown');await page.keyboard.press('Shift+End');
        await copy(baseline.slice(start,end+1).join('\n'));const caret=await page.locator('.caret').boundingBox();
        assert(caret.y>=r.y&&caret.y+caret.height<=Math.min(r.y+r.height,800)+2);assert(await page.locator('#editor').evaluate(e=>e.scrollTop)>keyboardBefore);
        assert.deepEqual(await lines(),baseline);return {mouseFirst:copied.split('\n')[0],mouseLast:copied.split('\n').at(-1),mouseLines:copied.split('\n').length,scrollPixels:after-before,keyboardExactLines:51,finalCaretVisible:true};
      });
    }
    await test('Deliberately misplaced carets reproduce exported Delete failure',async baseline=>{
      const targets=['Timeline','Customer impact','Action items'].map(x=>baseline.indexOf(x));
      const positions=await selectCarets(targets,false,[0,8,7]);await page.keyboard.press('Delete');
      const actual=targets.map(i=>null);const current=await lines();targets.forEach((line,i)=>actual[i]=current[line]);
      assert.deepEqual(actual,['imeline','Customerimpact','Action tems']);await page.keyboard.press('Control+z');assert.deepEqual(await lines(),baseline);
      return {positions,actual,classification:'Diagnostic mis-targeting reproduction, NOT an app failure or grader pass'};
    });
    await test('Proposed adjacent two-caret Backspace Delete and separate Undo',async baseline=>{
      const first=baseline.indexOf('Customer impact'),targets=[first,first+1],checkpoints=[];
      assert.equal(baseline[first+1],'Checkout requests were delayed but not lost.');
      for(const key of ['Backspace','Delete']) {
        const positions=await selectCarets(targets,key==='Backspace');await page.keyboard.press(key);
        const expected=baseline.map((x,i)=>targets.includes(i)?(key==='Backspace'?x.slice(0,-1):x.slice(1)):x);
        assert.deepEqual(await lines(),expected);checkpoints.push({key,positions,text:targets.map(i=>expected[i])});
        await page.keyboard.press('Control+z');assert.deepEqual(await lines(),baseline);
      }
      return {proposedOnly:true,checkpoints};
    });
    await test('Proposed four-line offscreen sample, both paths, allowed mouse overshoot',async baseline=>{
      const start=baseline.findIndex(x=>x.includes('ALPHA-0010')),end=start+3;
      assert(baseline[end].includes('ALPHA-0013'));
      const setup=async()=>{
        await find('ALPHA-0010');await page.keyboard.press('Home');
        const r=await page.locator('#editor').boundingBox(),visibleBottom=Math.min(r.y+r.height,800);
        const row=await page.locator(`.line[data-line="${start}"]`).boundingBox(),desired=visibleBottom-33;
        await page.mouse.move(r.x+r.width/2,r.y+r.height/2);await page.mouse.wheel(0,row.y-desired);
        await page.waitForFunction(({start,desired})=>Math.abs(document.querySelector(`.line[data-line="${start}"]`).getBoundingClientRect().top-desired)<3,{start,desired});
        const origin=await glyph(start,0),target=await page.locator(`.line[data-line="${end}"]`).boundingBox();
        assert(origin.y<visibleBottom&&origin.y>r.y);assert(target.y>visibleBottom);
        assert.deepEqual(await caretPositions(),[{line:start,col:0}]);
        return {r,visibleBottom,origin,targetTop:target.y,before:await page.locator('#editor').evaluate(e=>e.scrollTop)};
      };
      const mouse=await setup();await page.mouse.move(mouse.origin.x,mouse.origin.y);await page.mouse.down();
      try {
        await page.mouse.move(mouse.r.x+mouse.r.width-20,Math.min(mouse.visibleBottom+12,798),{steps:5});
        await page.waitForFunction(end=>document.querySelector(`.line[data-line="${end+4}"] .selection`),end,{timeout:20000});
      } finally {await page.mouse.up();}
      const copied=await copy(),selectedLines=copied.split('\n').length;
      assert(selectedLines>4);assert.equal(copied,baseline.slice(start,start+selectedLines).join('\n'));
      assert(copied.includes(baseline[end]));assert(await page.locator('#editor').evaluate(e=>e.scrollTop)>mouse.before);
      const keyboard=await setup();for(let i=0;i<3;i++)await page.keyboard.press('Shift+ArrowDown');await page.keyboard.press('Shift+End');
      await copy(baseline.slice(start,end+1).join('\n'));
      const caret=await page.locator('.caret').boundingBox();assert(caret.y>=keyboard.r.y&&caret.y+caret.height<=keyboard.visibleBottom+2);
      assert(await page.locator('#editor').evaluate(e=>e.scrollTop)>keyboard.before);assert.deepEqual(await lines(),baseline);
      return {proposedOnly:true,mouseTargetInitiallyBelow:mouse.targetTop>mouse.visibleBottom,keyboardTargetInitiallyBelow:keyboard.targetTop>keyboard.visibleBottom,mouseLines:selectedLines,mouseExtraTrailingLinesPermitted:true,keyboardExactLines:4,fullDocumentUnchanged:true};
    });
  } finally {if(browser)await browser.close();server.kill();output();}
  if(results.some(x=>!x.passed))process.exitCode=1;
}
main().catch(e=>{console.error(e);output();process.exitCode=1;});
