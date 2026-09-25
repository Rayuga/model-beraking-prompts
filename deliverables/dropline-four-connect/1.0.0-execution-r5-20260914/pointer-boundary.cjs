const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
let browser;
const results=[];
(async()=>{
 browser=await chromium.launch({headless:true,executablePath:'/opt/playwright-browsers/chromium-1237/chrome-linux64/chrome',args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1280,height:800}});
 await p.goto('http://localhost:3000');await p.locator('#email').fill('avery@dropline.test');await p.locator('#password').fill('password123');
 const logged=p.waitForResponse(r=>r.url().endsWith('/api/login'));await p.locator('#login-form button[type=submit]').click();const token=(await(await logged).json()).token;await p.locator('#app-view').waitFor({state:'visible'});
 const read=async id=>{const r=await fetch('http://localhost:3000/api/analysis/'+id,{headers:{Authorization:'Bearer '+token}});assert.equal(r.status,200);return(await r.json()).study;};
 const click=async(selector,end)=>{const r=p.waitForResponse(r=>r.url().endsWith(end)&&r.request().method()==='POST');await p.locator(selector).click();const response=await r;assert.equal(response.status(),200);const data=await response.json();await p.waitForFunction(()=>!document.querySelector('#new-game').disabled);return data;};
 await click('#new-game','/new');for(const col of [1,7,2,7,3,6,4])await click('[aria-label="Drop in column '+col+'"]','/move');
 for(const mode of ['pointer pressed pending and released after response']){
  await p.locator('#match-archive button').first().click();await p.locator('#replay-step').focus();await p.keyboard.press('Home');await p.locator('#analysis-new-name').fill('Pending '+mode);
  const s=(await click('#analysis-create','/api/analysis')).study;await p.waitForFunction(()=>!document.querySelector('#analysis-close').disabled);
  const before=await read(s.id),drop=p.locator('[aria-label="Analysis drop in column 3"]');
  let release,seen,count=0;const held=new Promise(r=>release=r),arrived=new Promise(r=>seen=r);
  const handler=async route=>{count++;const response=await route.fetch();seen();await held;await route.fulfill({response});};
  await p.route('**/api/analysis/*/actions',handler);
  await drop.focus();const firstBounds=await drop.boundingBox();await drop.click();await arrived;
  assert(await drop.isDisabled());
  if(mode.startsWith('pointer')){await p.mouse.move(firstBounds.x+firstBounds.width/2,firstBounds.y+firstBounds.height/2);await p.mouse.down();release();await p.waitForFunction(()=>!document.querySelector('#analysis-close').disabled);await p.mouse.up();}
  else if(mode.includes('mouse')){const b=mode.startsWith('different')?await p.locator('[aria-label="Analysis drop in column 4"]').boundingBox():firstBounds;await p.mouse.click(b.x+b.width/2,b.y+b.height/2);}
  else await p.keyboard.press(mode.endsWith('Enter')?'Enter':'Space');
  const beforeDelivery=await read(s.id);assert.equal(count,1);assert.equal(beforeDelivery.revision,before.revision+1);
  release();await p.waitForFunction(()=>!document.querySelector('#analysis-close').disabled);await p.unroute('**/api/analysis/*/actions',handler);
  const after=await read(s.id);assert.equal(count,1);assert.equal(after.revision,before.revision+1);assert.equal(after.nodes.length,before.nodes.length+1);
  results.push({mode,passed:true,second_pointer_down_before_delivery:true,second_pointer_up_after_delivery:true,requests:count,revision_delta:after.revision-before.revision,new_nodes:after.nodes.length-before.nodes.length});
 }
 await browser.close();
})().catch(async e=>{results.push({passed:false,error:String(e),stack:e.stack});if(browser)await browser.close();process.exitCode=1;}).finally(()=>{fs.writeFileSync('/tmp/pointer-boundary.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));});
