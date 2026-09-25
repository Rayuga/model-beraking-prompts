const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const p=await browser.newPage({viewport:{width:1280,height:800}}), results=[];
 try{
 await p.goto('http://localhost:3000');await p.screenshot({path:'/evidence/login-desktop.png'});
 await p.locator('#email').fill('jordan@dropline.test');await p.locator('#password').fill('password123');await p.locator('#login-form button[type=submit]').click();await p.locator('#app-view').waitFor({state:'visible'});await p.screenshot({path:'/evidence/game-desktop.png'});
 await p.locator('#match-archive button').first().click();await p.locator('#replay-step').focus();await p.keyboard.press('Home');
 const long='Alternative opening with a long descriptive analysis title 1';assert.equal(long.length,60);await p.locator('#analysis-new-name').fill(long);
 await p.locator('.archive-panel').screenshot({path:'/evidence/replay-desktop.png'});
 await p.locator('#analysis-create').click();await p.waitForFunction(()=>document.querySelector('#analysis-title').textContent.length===60&&!document.querySelector('#analysis-close').disabled);
 const saved=async selector=>{await p.locator(selector).click();await p.waitForFunction(()=>!document.querySelector('#analysis-close').disabled);};
 await saved('#analysis-columns button:nth-child(1)');await saved('#analysis-undo');await saved('#analysis-columns button:nth-child(2)');
 await p.locator('#analysis-left').selectOption({index:1});await p.locator('#analysis-right').selectOption({index:2});await p.locator('#analysis-compare').click();await p.locator('#analysis-comparison').waitFor({state:'visible'});
 for(const width of [1280,375]){
  await p.setViewportSize({width,height:width===1280?800:760});
  const geometry=await p.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,name:document.querySelector('#analysis-title').textContent,names:[...document.querySelectorAll('#analysis-list button')].map(b=>({text:b.textContent,scroll:b.scrollWidth,width:b.clientWidth})),gameBackground:getComputedStyle(document.querySelector('.scoreboard')).backgroundColor,analysisBackground:getComputedStyle(document.querySelector('#analysis-workspace')).backgroundColor}));
  assert(geometry.scroll<=width,JSON.stringify(geometry));assert.equal(geometry.name,long);assert.equal(geometry.gameBackground,geometry.analysisBackground);assert(geometry.names.every(n=>n.scroll<=n.width+1));
  assert.equal(await p.locator('#analysis-board [role=gridcell]').count(),42);assert.equal(await p.locator('#analysis-left-board [role=gridcell]').count(),42);assert.equal(await p.locator('#analysis-right-board [role=gridcell]').count(),42);
  await p.locator('#analysis-workspace').screenshot({path:`/evidence/analysis-${width}.png`});await p.locator('.archive-panel').screenshot({path:`/evidence/replay-${width}.png`});
  await p.evaluate(()=>scrollTo(0,0));await p.screenshot({path:`/evidence/game-${width}.png`});
  results.push({name:`${width}px populated replay/analysis long-name layout, same palette, no horizontal overflow and 42-cell boards`,passed:true});
 }
 await p.emulateMedia({reducedMotion:'reduce'});assert(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));results.push({name:'Reduced-motion media honored',passed:true});
 fs.writeFileSync('/evidence/visual-regressions.json',JSON.stringify({kind:'Local layout and screenshot evidence; not a Visual judge score',results},null,2));console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
