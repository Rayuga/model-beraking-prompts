const assert = require('node:assert/strict');
const fs = require('node:fs');
const {execFileSync} = require('node:child_process');
const {randomUUID} = require('node:crypto');
const {chromium} = require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
const base='http://127.0.0.1:3000';
const results=[];
let browser;
async function check(name,fn){await fn();results.push({name,passed:true});console.log('PASS '+name);}
async function api(path,token,body){const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Connection:'close',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};}
async function login(user='avery'){const r=await api('/api/login',null,{email:user+'@dropline.test',password:'password123'});assert.equal(r.status,200);return r.data.token;}
async function state(t){const r=await api('/api/game',t);assert.equal(r.status,200);return r.data;}
async function mutate(t,action,extra={}){const before=await state(t);const r=await api('/api/game/'+action,t,{revision:before.game.revision,mutationId:randomUUID(),...extra});assert.equal(r.status,200,JSON.stringify(r.data));assert.equal(r.data.game.revision,before.game.revision+1);return r.data;}
async function play(t,seq){let s=await mutate(t,'new');for(const column of seq)s=await mutate(t,'move',{column});return s;}
async function uiLogin(page,user='avery'){await page.goto(base);await page.locator('#email').fill(user+'@dropline.test');await page.locator('#password').fill('password123');await page.locator('#login-form button[type=submit]').click();await page.locator('#app-view').waitFor({state:'visible'});}
async function uiAction(page,selector,endpoint){const response=page.waitForResponse(r=>r.url().endsWith('/api/game/'+endpoint)&&r.request().method()==='POST');await page.locator(selector).click();const r=await response;await r.finished();await page.waitForFunction(()=>!document.querySelector('#new-game').disabled);return r;}
async function uiMove(page,col){return uiAction(page,'button[aria-label="Drop in column '+col+'"]','move');}
function comparable(s){return {game:s.game,archive:s.archive,archiveTotal:s.archiveTotal};}
(async()=>{
 let a,j;
 await check('authentication and exact seeded states',async()=>{
  assert.equal((await api('/api/game')).status,401);
  assert.equal((await api('/api/login',null,{email:'avery@dropline.test',password:'wrong'})).status,401);
  a=await login();j=await login('jordan');assert.notEqual(a,j);
  const s=await state(a),t=await state(j);assert.equal(s.game.revision,7);assert.deepEqual(s.game.scores,{Red:2,Yellow:1,Draws:1});assert.equal(s.game.board[38],'Red');assert.equal(s.game.board[39],'Yellow');assert.equal(s.game.board.filter(Boolean).length,2);assert.equal(s.archiveTotal,0);
  assert.equal(t.game.revision,4);assert.deepEqual(t.game.scores,{Red:1,Yellow:2,Draws:0});assert.equal(t.game.board.filter(Boolean).length,3);assert.equal(t.archiveTotal,11);assert.equal(t.archive.length,10);assert.deepEqual(t.archive.map(x=>x.moveCount),[8,7,42,8,7,42,8,7,42,8]);
  let v=await mutate(a,'redo');assert.equal(v.game.board[31],'Red');assert.equal(v.game.revision,8);v=await mutate(a,'undo');assert.deepEqual(v.game.board,s.game.board);assert.equal(v.game.revision,9);assert.deepEqual(await state(j),t);
 });
 browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
 await check('read-only replay, keyboard slider, mobile and reduced motion preserve seed',async()=>{
  const before=await state(j);const p=await browser.newPage({viewport:{width:1280,height:800}});await uiLogin(p,'jordan');assert.equal(await p.locator('#match-archive li').count(),10);
  await p.locator('#match-archive button').first().click();assert.equal(await p.locator('#replay-board [role=gridcell]').count(),42);
  await p.locator('#replay-step').focus();await p.keyboard.press('Home');assert.equal(await p.locator('#replay-step').inputValue(),'0');await p.locator('#replay-next').click();assert.equal(await p.locator('#replay-step').inputValue(),'1');await p.locator('#replay-step').focus();await p.keyboard.press('End');assert.equal(await p.locator('#replay-step').inputValue(),'8');await p.locator('#replay-previous').click();assert.equal(await p.locator('#replay-step').inputValue(),'7');
  await p.screenshot({path:'/evidence/dropline-desktop.png',fullPage:true});await p.setViewportSize({width:375,height:760});await p.emulateMedia({reducedMotion:'reduce'});assert(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.screenshot({path:'/evidence/dropline-mobile.png',fullPage:true});await p.locator('#replay-close').click();assert(await p.locator('#replay-panel').isHidden());assert.deepEqual(await state(j),before);await p.close();
 });
 await check('gravity, full-column rejection, rejected receipt replay',async()=>{
  let s=await play(a,[4,4,4]);assert.deepEqual([s.game.board[38],s.game.board[31],s.game.board[24]],['Red','Yellow','Red']);
  s=await play(a,[1,1,1,1,1,1]);const body={revision:s.game.revision,mutationId:randomUUID(),column:1};const r=await api('/api/game/move',a,body);assert.equal(r.status,409);assert.equal(r.data.error,'Column 1 is full');assert.deepEqual(comparable(await state(a)),comparable(s));assert.deepEqual(await api('/api/game/move',a,body),r);
 });
 const wins=[['red horizontal',[1,7,2,7,3,6,4],'red_win'],['red vertical',[1,2,1,2,1,2,1],'red_win'],['yellow vertical',[7,1,7,1,6,1,6,1],'yellow_win'],['red diagonal',[1,2,2,3,4,3,3,4,5,4,4],'red_win'],['red mirror',[7,6,6,5,4,5,5,4,3,4,4],'red_win'],['yellow diagonal',[7,1,2,2,3,4,3,3,4,5,4,4],'yellow_win'],['yellow mirror',[1,7,6,6,5,4,5,5,4,3,4,4],'yellow_win'],['yellow horizontal',[7,1,7,2,6,3,6,4],'yellow_win']];
 for(const [name,seq,status] of wins)await check(name+', terminal score, archive, undo/redo',async()=>{
  const before=await state(a);const s=await play(a,seq);assert.equal(s.game.status,status);assert.equal(s.game.winningCells.length,4);assert.equal(s.game.moveHistory.length,seq.length);const color=status==='red_win'?'Red':'Yellow';assert.equal(s.game.scores[color],before.game.scores[color]+1);assert.equal(s.archiveTotal,before.archiveTotal+1);
  const bad=await api('/api/game/move',a,{revision:s.game.revision,mutationId:randomUUID(),column:7});assert.equal(bad.status,409);assert.deepEqual(comparable(await state(a)),comparable(s));
  const u=await mutate(a,'undo');assert.equal(u.game.status,'active');assert.equal(u.archiveTotal,before.archiveTotal);assert.deepEqual(u.game.scores,before.game.scores);
  const r=await mutate(a,'redo');assert.deepEqual(r.game.board,s.game.board);assert.deepEqual(r.game.winningCells,s.game.winningCells);assert.deepEqual(r.game.scores,s.game.scores);assert.equal(r.archiveTotal,s.archiveTotal);assert.equal(r.archive[0].matchId,s.archive[0].matchId);assert.equal(r.archive[0].completedAt,s.archive[0].completedAt);
 });
 await check('exact 42-move draw and terminal undo/redo',async()=>{
  const before=await state(a);const s=await play(a,[4,4,4,4,4,4,3,3,3,3,3,3,5,2,5,6,5,5,5,5,2,2,2,2,2,6,1,6,6,6,6,1,1,1,1,1,7,7,7,7,7,7]);assert.equal(s.game.status,'draw');assert.equal(s.game.board.filter(Boolean).length,42);assert.equal(s.game.scores.Draws,before.game.scores.Draws+1);assert.equal(s.game.winningCells.length,0);const u=await mutate(a,'undo');assert.equal(u.game.status,'active');assert.equal(u.game.scores.Draws,before.game.scores.Draws);const r=await mutate(a,'redo');assert.equal(r.game.status,'draw');assert.deepEqual(r.game.board,s.game.board);
 });
 await check('repeated undo/redo, branch, account isolation, new-game preservation',async()=>{
  const jordan=await state(j);let s=await play(a,[4,5,4]);await mutate(a,'undo');await mutate(a,'undo');await mutate(a,'redo');s=await mutate(a,'move',{column:6});assert.equal(s.game.canRedo,false);assert.equal(s.game.moveHistory.length,3);const n=await mutate(a,'new');assert.equal(n.game.board.filter(Boolean).length,0);assert.equal(n.game.canRedo,false);assert.equal(n.game.canUndo,false);assert.deepEqual(n.game.scores,s.game.scores);assert.deepEqual(n.archive,s.archive);assert.deepEqual(await state(j),jordan);
 });
 await check('success replay, stale conflict and stable rejected replay',async()=>{
  const n=await mutate(a,'new');const body={revision:n.game.revision,mutationId:randomUUID(),column:1};const accepted=await api('/api/game/move',a,body);assert.equal(accepted.status,200);assert.deepEqual(await api('/api/game/move',a,body),accepted);
  const stale={revision:n.game.revision,mutationId:randomUUID(),column:2};const denied=await api('/api/game/move',a,stale);assert.equal(denied.status,409);assert.equal(denied.data.error,'Game updated in another tab');const next=await mutate(a,'move',{column:2});assert.deepEqual(await api('/api/game/move',a,stale),denied);assert.deepEqual(comparable(await state(a)),comparable(next));
 });
 await check('real-browser winning cells and keyboard focus/actions',async()=>{
  const p=await browser.newPage();await uiLogin(p);await uiAction(p,'#new-game','new');assert.equal(await p.locator('#board [role=gridcell]').count(),42);
  for(const col of [1,7,2,7,3,6,4])await uiMove(p,col);assert.match(await p.locator('#status').innerText(),/Red wins/);assert.equal(await p.locator('#board [aria-label*=winning]').count(),4);
  await uiAction(p,'#new-game','new');const first=p.locator('button[aria-label="Drop in column 1"]');await first.focus();await p.keyboard.press('ArrowLeft');assert(await first.evaluate(e=>e===document.activeElement));await p.keyboard.press('End');assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Drop in column 7');await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');let response=p.waitForResponse(r=>r.url().endsWith('/api/game/move'));await p.keyboard.press('Enter');await response;await p.waitForFunction(()=>document.querySelectorAll('#move-history li').length===1);response=p.waitForResponse(r=>r.url().endsWith('/api/game/move'));await p.keyboard.press('Space');await response;await p.waitForFunction(()=>document.querySelectorAll('#move-history li').length===2);await uiAction(p,'#undo','undo');await uiAction(p,'#redo','redo');assert.equal(await p.locator('#move-history li').count(),2);await p.close();
 });
 await check('real-browser stale tab, pending repeat, all-session logout',async()=>{
  const p=await browser.newPage(),q=await browser.newPage();await uiLogin(p);await uiAction(p,'#new-game','new');await uiLogin(q);
  await uiMove(p,1);assert.equal((await uiMove(q,2)).status(),409);assert.match(await q.locator('#feedback').innerText(),/Game updated in another tab/);await uiMove(q,2);await p.reload();await p.locator('#app-view').waitFor({state:'visible'});
  let release;const held=new Promise(resolve=>{release=resolve;});let seen;const arrived=new Promise(resolve=>{seen=resolve;});await p.route('**/api/game/move',async route=>{const response=await route.fetch();seen();await held;await route.fulfill({response});});
  const drop=p.locator('button[aria-label="Drop in column 3"]');await drop.click();await arrived;await drop.click({force:true});release();await p.waitForFunction(()=>document.querySelectorAll('#move-history li').length===3);await p.unroute('**/api/game/move');assert.equal((await state(a)).game.moveHistory.length,3);
  const before=await state(a);await p.locator('#sign-out').click();await p.locator('#login-view').waitFor({state:'visible'});await uiMove(q,4);await q.locator('#login-view').waitFor({state:'visible'});assert.equal((await api('/api/game',a)).status,401);a=await login();assert.deepEqual(await state(a),before);await p.close();await q.close();
 });
 await check('real runner lifecycle: two restarts preserve board, redo, archives and sessions',async()=>{
  await play(a,[4,5,4]);await mutate(a,'undo');const s=await state(a);const t=await state(j);execFileSync('bash',['/tests/app-lifecycle.sh','restart']);assert.deepEqual(await state(a),s);assert.deepEqual(await state(j),t);const r=await mutate(a,'redo');execFileSync('bash',['/tests/app-lifecycle.sh','restart']);assert.deepEqual(comparable(await state(a)),comparable(r));assert.deepEqual(await state(j),t);
 });
 await browser.close();fs.writeFileSync('/evidence/regressions.json',JSON.stringify({kind:'unpaid local API and real-browser tests; not an Oracle score',results},null,2));
})().catch(async error=>{console.error(error);results.push({passed:false,error:String(error),stack:error.stack});fs.writeFileSync('/evidence/regressions.json',JSON.stringify({results},null,2));if(browser)await browser.close();process.exitCode=1;});
