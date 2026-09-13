const fs=require('node:fs'),assert=require('node:assert/strict');
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 const c=await browser.newContext({viewport:{width:1280,height:800},hasTouch:true}),p=await c.newPage(),passed=[],errors=[];
 p.on('pageerror',e=>errors.push(e.message));const pass=s=>{passed.push(s);console.log('PASS '+s);};
 const txt=()=>p.locator('#telemetry').innerText();const phase=x=>p.waitForFunction(x=>document.querySelector('#telemetry').textContent.includes('phase='+x),x);
 try{
 await p.goto('http://localhost:3000');assert(await p.getByLabel('Email',{exact:true}).isVisible());assert(await p.getByLabel('Password',{exact:true}).isVisible());
 await p.getByLabel('Email',{exact:true}).click();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.id),'password');await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement.textContent),'Enter arcade');
 assert(await p.evaluate(()=>parseFloat(getComputedStyle(document.activeElement).outlineWidth)>0));
 await p.screenshot({path:'/results/signin-desktop.png'});pass('Sign-in labels, keyboard traversal and visible focus');
 await p.locator('#email').fill('polly@brickfall.test');await p.locator('#password').fill('password123');await p.getByRole('button',{name:'Enter arcade',exact:true}).click();await p.locator('#app-view').waitFor({state:'visible'});
 for(const id of ['score','lives','level','combo','power-name','power-time'])assert(await p.locator('#'+id).isVisible());
 assert(await p.locator('#game-canvas').getAttribute('aria-label'));assert.equal(await p.locator('#game-canvas').getAttribute('tabindex'),'0');assert(await p.locator('#assist').getAttribute('aria-pressed'));assert(await p.locator('.help').innerText());pass('Six HUD fields, named focusable canvas, Assist semantics and visible shortcuts');
 await p.locator('#start-selected').click();await phase('ready');await p.locator('#game-canvas').scrollIntoViewIfNeeded();
 const bb=await p.locator('#game-canvas').boundingBox();await p.mouse.move(bb.x+bb.width*.2,bb.y+bb.height*.9);await p.waitForTimeout(220);const moved=await txt();
 await p.keyboard.down('ArrowRight');await p.waitForTimeout(220);await p.keyboard.up('ArrowRight');assert.notEqual(await txt(),moved);assert((await txt()).includes('held=1'));
 await p.keyboard.press('Space');await phase('playing');const savedPause=p.waitForResponse(r=>r.url().endsWith('/api/run/save')&&JSON.parse(r.request().postData()).state.phase==='paused');await p.keyboard.press('p');await phase('paused');const pauseRevision=(await (await savedPause).json()).revision;await p.waitForFunction(revision=>document.querySelector('#telemetry').textContent.includes('revision='+revision),pauseRevision);const frozen=await txt();await p.waitForTimeout(250);assert.equal(await txt(),frozen);await p.keyboard.press('Escape');await phase('playing');await p.keyboard.press('Escape');await phase('paused');pass('Pointer/keyboard waiting-ball movement, Space launch, P/Escape and pause freeze');
 await p.locator('#assist').click();assert.equal(await p.locator('#assist').getAttribute('aria-pressed'),'true');await p.keyboard.press('ArrowLeft');assert.equal(await p.locator('#assist').getAttribute('aria-pressed'),'false');pass('Assist toggle exposes On/Off and manual takeover');
 await p.waitForFunction(()=>document.querySelector('#sync-state').textContent.endsWith('saved'));await p.reload();await p.locator('#resume-action').click();await phase('paused');pass('Polish journey survives ordinary reload and saved-run return');
 await p.locator('#run-history button').first().click();await p.locator('#run-dialog').waitFor({state:'visible'});assert((await p.locator('#run-dialog-state').innerText()).includes('phase='));await p.screenshot({path:'/results/history-desktop.png'});await p.locator('#close-run-dialog').click();
 await p.locator('#drill-select').selectOption('brick-types');await p.locator('#load-drill').click();await p.waitForFunction(()=>!document.querySelector('#step-drill').disabled);await p.locator('#step-drill').click();assert((await txt()).includes('score=1400'));await p.locator('#game-canvas').scrollIntoViewIfNeeded();await p.screenshot({path:'/results/arcade-desktop.png'});pass('Visible history detail, semantic scene/event evidence and desktop screenshots');
 const normal=await p.locator('#power-fill').evaluate(e=>getComputedStyle(e).transitionDuration);await p.emulateMedia({reducedMotion:'reduce'});const reduced=await p.locator('#power-fill').evaluate(e=>getComputedStyle(e).transitionDuration);assert(parseFloat(reduced)<parseFloat(normal));pass('Reduced-motion preference materially shortens nonessential transitions');
 await p.setViewportSize({width:375,height:760});await p.locator('#start-selected').click();await phase('ready');await p.locator('#game-canvas').scrollIntoViewIfNeeded();
 const mobile=await p.locator('#game-canvas').boundingBox(),session=await c.newCDPSession(p);const before=await txt();
 const point={x:mobile.x+mobile.width*.02,y:mobile.y+mobile.height*.9};
 assert.equal(await p.evaluate(({x,y})=>document.elementFromPoint(x,y)?.id,point),'game-canvas','Touch setup must target uncovered canvas, not the ready overlay card');
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:mobile.x+mobile.width*.28}]});await p.waitForTimeout(220);await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.notEqual(await txt(),before);
 assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(Math.abs(mobile.width/mobile.height-1.5)<.02);
 for(const id of ['launch','pause','assist','start-selected']){const el=p.locator('#'+id);await el.scrollIntoViewIfNeeded();const b=await el.boundingBox();assert(b.width>=40&&b.height>=40&&b.x>=0&&b.x+b.width<=375);}
 await p.locator('#game-canvas').scrollIntoViewIfNeeded();await p.screenshot({path:'/results/arcade-mobile.png'});await p.locator('#leaderboard').scrollIntoViewIfNeeded();await p.screenshot({path:'/results/leaderboard-mobile.png'});pass('375px real touch input, reachable action targets, proportional canvas and no page overflow');
 assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync('/results/presentation.json',JSON.stringify({passed,errors,scope:'Browser observations, not subjective Visual scores or full platform QC'},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
