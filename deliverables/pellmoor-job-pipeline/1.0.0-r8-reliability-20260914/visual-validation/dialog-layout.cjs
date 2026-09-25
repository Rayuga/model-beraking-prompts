const assert = require('node:assert/strict');
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const phase = process.argv[2];
assert(['baseline','fixed'].includes(phase));
const directory = `/evidence/${phase}`;
fs.mkdirSync(directory, {recursive:true});
const base = 'http://127.0.0.1:3000';
const results = [];
const errors = [];
const server = spawn('node', ['/app/backend/server.js'], {cwd:'/app/backend', stdio:['ignore','pipe','pipe']});
const serverLog = fs.createWriteStream(`${directory}/server.log`);
server.stdout.pipe(serverLog); server.stderr.pipe(serverLog);
let browser;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function request(method, path, body, token) {
  const response = await fetch(base + path, {method, headers:{'content-type':'application/json', ...(token ? {authorization:`Bearer ${token}`} : {})}, body:body ? JSON.stringify(body) : undefined});
  const data = await response.json();
  assert(response.ok, JSON.stringify(data));
  return data;
}
async function record(page, name, check) {
  const measurement = await page.evaluate(() => {
    const rectangle = el => { const r = el.getBoundingClientRect(); return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height}; };
    const dialog = document.querySelector('#batch-dialog');
    const body = document.querySelector('.batch-body') || dialog;
    const footer = document.querySelector('.batch-actions');
    const buttons = [...footer.querySelectorAll('button')].map(el => ({id:el.id, ...rectangle(el)}));
    const d = rectangle(dialog);
    const visible = buttons.every(b => b.top >= Math.max(0,d.top) && b.bottom <= Math.min(innerHeight,d.bottom) && b.left >= Math.max(0,d.left) && b.right <= Math.min(innerWidth,d.right));
    const hitTest = [...footer.querySelectorAll('button')].every(el => {
      const b = el.getBoundingClientRect();
      const hit = document.elementFromPoint(b.left + b.width/2, b.bottom - 3);
      return hit === el || el.contains(hit);
    });
    return {viewport:{width:innerWidth,height:innerHeight},dialog:d,body:{...rectangle(body),scrollTop:body.scrollTop,scrollHeight:body.scrollHeight,clientHeight:body.clientHeight},footer:rectangle(footer),buttons,visible,hitTest,horizontalOverflow:document.documentElement.scrollWidth > innerWidth};
  });
  await page.screenshot({path:`${directory}/${name}.png`});
  results.push({name,...measurement});
  if(check) assert(measurement.visible && measurement.hitTest && !measurement.horizontalOverflow, `${name}: ${JSON.stringify(measurement)}`);
}
(async () => {
 try {
  for(let attempt=0;attempt<100;attempt++) {
    try {const response=await fetch(base); if(response.ok)break;} catch {}
    await sleep(100);
  }
  const cal=await request('POST','/api/login',{email:'coord@pellmoor.test',password:'password123'});
  for(let i=0;i<8;i++) {
    const role=await request('GET','/api/roles/ROLE-014',undefined,cal.token);
    await request('POST','/api/candidates',{role:'ROLE-014',name:`Layout applicant ${i+1}`,expected_revision:role.revision,operation_id:randomUUID()},cal.token);
  }
  browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
  const page=await browser.newPage();
  page.on('pageerror',error=>errors.push(String(error)));
  await page.goto(base);
  await page.locator('#email').fill('hiring@pellmoor.test');
  await page.locator('#password').fill('password123');
  await page.getByRole('button',{name:'Sign in',exact:true}).click();
  await page.locator('#app').waitFor({state:'visible'});
  await page.waitForFunction(()=>document.body.dataset.busy==='false');
  for(const viewport of [{width:1280,height:800},{width:390,height:844},{width:320,height:568}]) {
    await page.setViewportSize(viewport);
    for(const theme of ['light','dark']) {
      await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
      const label=`${viewport.width}x${viewport.height}-${theme}`;
      await page.locator('#batch-open').click();
      await record(page,`${label}-selection-top`,phase==='fixed');
      await page.evaluate(()=>{const body=document.querySelector('.batch-body') || document.querySelector('#batch-dialog');body.scrollTop=body.scrollHeight;});
      await record(page,`${label}-selection-bottom`,phase==='fixed');
      await page.locator('[data-batch-id]').last().check();
      await page.locator('#batch-review').click();
      await page.locator('#batch-edit').waitFor();
      await record(page,`${label}-blocked-review`,phase==='fixed');
      await page.locator('#batch-edit').click();
      await page.locator('#batch-close').click();
      assert.equal(await page.locator('#batch-open').evaluate(el=>el===document.activeElement),true);
    }
  }
  assert.deepEqual(errors,[]);
 } finally {
   fs.writeFileSync(`${directory}/measurements.json`,JSON.stringify({kind:'local golden browser layout regression, not a judge score',phase,results,pageErrors:errors},null,2));
   if(browser)await browser.close();
   server.kill('SIGTERM');
   serverLog.end();
 }
 console.log(`${phase}: ${results.length} views, ${results.filter(r=>!r.visible || !r.hitTest).length} clipped action areas`);
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
