const fs=require('node:fs');
const assert=require('node:assert/strict');
const {spawn,spawnSync}=require('node:child_process');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const results=[];
let server,browser;
async function test(name,fn){await fn();results.push({name,passed:true});console.log('PASS '+name);}
async function main(){
 assert.equal(spawnSync('bash',['/solution/solve.sh'],{stdio:'inherit'}).status,0);
 assert.equal(spawnSync('node',['--check','/app/public/js/app.js'],{stdio:'inherit'}).status,0);
 server=spawn('node',['--experimental-sqlite','src/index.js'],{cwd:'/app',stdio:'inherit'});
 for(let i=0;;i++){try{if((await fetch('http://localhost:3000')).ok)break;}catch{}assert(i<100);await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:1280,height:800},permissions:['clipboard-read','clipboard-write']});
 const page=await context.newPage();
 const fresh=async()=>{await page.goto('http://localhost:3000');await page.waitForFunction(()=>document.querySelector('#doc-title')?.textContent==='Northwind API Incident Report');};
 const lines=()=>page.locator('#editor .text').evaluateAll(es=>es.map(e=>e.dataset.lineText));
 const saved=async()=>{const r=await fetch('http://localhost:3000/api/documents/incident-alpha',{headers:{Connection:'close'}});assert.equal(r.status,200);return r.json();};
 const append=async text=>{await page.locator('#editor').focus();await page.keyboard.press('Control+End');await page.evaluate(t=>navigator.clipboard.writeText('\n'+t),text);await page.keyboard.press('Control+v');};
 const find=async q=>{await page.locator('#find-box').fill(q);await page.locator('#find-next-btn').click();assert.equal(await page.evaluate(()=>document.activeElement.id),'editor');};
 const baseline=await saved();
 await test('forward block indentation/outdent, excluded endpoint, atomic undo/redo',async()=>{
  await fresh();const before=await lines();await append('BLOCK-ONE\n  BLOCK-TWO\nBLOCK-THREE\nBLOCK-OUTSIDE');await find('BLOCK-ONE');await page.keyboard.press('Home');for(let i=0;i<3;i++)await page.keyboard.press('Shift+ArrowDown');
  await page.keyboard.press('Tab');const once=[...before,'  BLOCK-ONE','    BLOCK-TWO','  BLOCK-THREE','BLOCK-OUTSIDE'];assert.deepEqual(await lines(),once);
  await page.keyboard.press('Tab');const twice=[...before,'    BLOCK-ONE','      BLOCK-TWO','    BLOCK-THREE','BLOCK-OUTSIDE'];assert.deepEqual(await lines(),twice);
  await page.keyboard.press('Shift+Tab');assert.deepEqual(await lines(),once);await page.keyboard.press('Control+z');assert.deepEqual(await lines(),twice);await page.keyboard.press('Control+y');assert.deepEqual(await lines(),once);assert.deepEqual(await saved(),baseline);
  await fresh();assert.deepEqual(await lines(),before);
 });
 await test('reverse block selection includes blank line and excludes untouched endpoint',async()=>{
  const before=await lines();await append('REVERSE-ONE\n\nREVERSE-THREE\nREVERSE-OUTSIDE');await find('REVERSE-OUTSIDE');await page.keyboard.press('Home');for(let i=0;i<3;i++)await page.keyboard.press('Shift+ArrowUp');await page.keyboard.press('Tab');
  assert.deepEqual(await lines(),[...before,'  REVERSE-ONE','  ','  REVERSE-THREE','REVERSE-OUTSIDE']);await page.keyboard.press('Shift+Tab');assert.deepEqual(await lines(),[...before,'REVERSE-ONE','','REVERSE-THREE','REVERSE-OUTSIDE']);await fresh();assert.deepEqual(await lines(),before);
 });
 await test('Replace All whole-document undo/redo and branch invalidation',async()=>{
  const before=await lines();await append('ATOMIC-OLD alpha ATOMIC-OLD\nguard-line\nATOMIC-OLD omega');const initial=await lines();await page.locator('#find-box').fill('ATOMIC-OLD');await page.locator('#replace-box').fill('ATOMIC-NEW');await page.locator('#replace-all-btn').click();const replaced=initial.map(t=>t.replaceAll('ATOMIC-OLD','ATOMIC-NEW'));assert.deepEqual(await lines(),replaced);
  await page.keyboard.press('Control+z');assert.deepEqual(await lines(),initial);await page.keyboard.press('Control+y');assert.deepEqual(await lines(),replaced);await page.keyboard.press('Control+z');await page.keyboard.press('Control+End');await page.keyboard.type('BRANCH-NEW');const branch=await lines();assert(branch.at(-1).endsWith('BRANCH-NEW'));await page.keyboard.press('Control+y');assert.deepEqual(await lines(),branch);assert.deepEqual(await saved(),baseline);await fresh();assert.deepEqual(await lines(),before);
 });
 await test('no-op Save invariants and original single-line indentation',async()=>{
  await page.locator('#editor').focus();for(let i=0;i<3;i++)await page.keyboard.press('Control+s');assert.deepEqual(await saved(),baseline);await find('Timeline');await page.keyboard.press('Home');const before=await lines();await page.keyboard.press('Tab');let after=await lines();assert.equal(after[4],'  Timeline');await page.keyboard.press('Shift+Tab');assert.deepEqual(await lines(),before);await fresh();assert.deepEqual(await saved(),baseline);
 });
 await page.screenshot({path:'/results/v3-desktop.png',fullPage:true});
}
main().catch(e=>{console.error(e);results.push({passed:false,error:String(e),stack:e.stack});process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();if(server)server.kill();fs.writeFileSync('/results/new-requirements-results.json',JSON.stringify({paidJudge:false,results},null,2)+'\n');});
