const fs=require('node:fs');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1280,height:800}}), observations=[];
 for(const method of ['mouse','locator']){
  await page.goto('http://localhost:3000');await page.waitForSelector('.line[data-line="4"] .text');
  await page.evaluate(()=>{window.observed=[];document.addEventListener('mousedown',e=>window.observed.push({detail:e.detail,target:e.target.outerHTML.slice(0,200),x:e.clientX,y:e.clientY}),true);});
  const row=page.locator('.line[data-line="4"] .text');await row.scrollIntoViewIfNeeded();
  const r=await row.boundingBox();
  if(method==='mouse')await page.mouse.click(r.x+35,r.y+11,{clickCount:2});else await row.dblclick({position:{x:35,y:11}});
  const before=await page.evaluate(()=>({events:window.observed,selection:[...document.querySelectorAll('.selection')].map(e=>e.textContent),caret:document.querySelector('#cursor-label').textContent,focus:document.activeElement.id}));
  await page.keyboard.press('Backspace');
  observations.push({method,before,after:await row.getAttribute('data-line-text')});
 }
 fs.writeFileSync('/results/mouse-diagnostic.json',JSON.stringify(observations,null,2));console.log(JSON.stringify(observations));await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
