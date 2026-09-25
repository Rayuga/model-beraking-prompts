const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
module.exports = async function({check,api,state,login,mutate,play,browser,uiLogin,uiAction,uiMove,a,j}) {
 const red=[1,7,2,7,3,6,4]; let source,study,receipt,rejectedReceipt;
 const read=async(id,t=a)=>{const r=await api('/api/analysis/'+id,t);assert.equal(r.status,200,JSON.stringify(r));return r.data.study;};
 const list=async(t=a)=>(await api('/api/analysis',t)).data.studies;
 const create=async(step=6,t=a,match=source,name='Study '+randomUUID())=>{
  const body={name,matchId:match,step,operationId:randomUUID()};
  const r=await api('/api/analysis',t,body);assert.equal(r.status,200,JSON.stringify(r));return {study:r.data.study,body,response:r};
 };
 const action=async(s,kind,extra={},t=a)=>{
  const body={action:kind,expectedRevision:s.revision,operationId:randomUUID(),...extra};
  const r=await api('/api/analysis/'+s.id+'/actions',t,body);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.study.revision,s.revision+1);return r.data.study;
 };
 const selected=s=>s.nodes.find(n=>n.id===s.selectedId);
 const reject=async(s,body,t=a)=>{
  const before=await read(s.id);const r=await api('/api/analysis/'+s.id+'/actions',t,{action:'move',column:2,expectedRevision:before.revision,operationId:randomUUID(),...body});
  assert(r.status>=400&&r.status<500,JSON.stringify(r));assert.deepEqual(await read(s.id),before);return r;
 };
 await check('analysis fork exact frozen prefix, trimmed name, empty and terminal roots',async()=>{
  const game=await play(a,red);source=game.archive[0].matchId;const before=await state(a),count=(await list()).length;
  const c=await create(6,a,source,'  Exact practice  ');study=c.study;receipt={url:'/api/analysis',body:c.body,response:c.response};
  assert.equal(study.name,'Exact practice');assert.equal((await list()).length,count+1);assert.equal(study.revision,0);assert.equal(study.sourceStep,6);assert.equal(study.nodes.length,1);assert.equal(study.selectedId,study.rootId);
  assert.deepEqual(selected(study).history.map(m=>m.column),red.slice(0,6));assert.equal(selected(study).currentPlayer,'Red');assert.equal(selected(study).status,'active');assert.equal(selected(study).board[41],'Yellow');assert.equal(selected(study).board[34],'Yellow');
  assert.deepEqual(await read(study.id),study);assert.deepEqual(await state(a),before);
  assert.equal(selected((await create(0)).study).board.filter(Boolean).length,0);
  const terminal=(await create(7)).study;assert.equal(selected(terminal).status,'red_win');await reject(terminal,{column:1});await reject(terminal,{action:'undo',column:undefined});
 });
 await check('analysis sibling and nested paths, stable edge identities and exact positions',async()=>{
  study=await action(study,'move',{column:4});const A=study.selectedId;assert.equal(selected(study).status,'red_win');
  study=await action(study,'undo');study=await action(study,'move',{column:5});const B=study.selectedId;assert.equal(study.nodes.length,3);
  study=await action(study,'move',{column:1});const C=study.selectedId;assert.equal(selected(study).board[28],'Yellow');
  study=await action(study,'undo');study=await action(study,'move',{column:2});const D=study.selectedId;assert.equal(selected(study).board[29],'Yellow');assert.equal(selected(study).board[28],'');assert.equal(study.nodes.length,5);
  assert.deepEqual(study.nodes.filter(n=>n.parentId===B).map(n=>n.id),[C,D]);
  for(const id of [A,B,C,D]){study=await action(study,'select',{nodeId:id});assert.equal(study.selectedId,id);}
  study=await action(study,'select',{nodeId:study.rootId});await reject(study,{action:'redo',column:undefined});
  study=await action(study,'redo',{childId:A});assert.equal(selected(study).status,'red_win');
  study=await action(study,'select',{nodeId:study.rootId});study=await action(study,'move',{column:5});assert.equal(study.selectedId,B);assert.equal(study.nodes.length,5);
  study=await action(study,'rename',{name:'Renamed durable study'});assert.equal((await read(study.id)).name,'Renamed durable study');
 });
 await check('analysis compare exact boards/prefix/differences, symmetry and no mutation',async()=>{
  const left=study.nodes.find(n=>n.parentId===study.rootId&&n.column===4),right=study.nodes.find(n=>n.history.length===8&&n.column===1);
  const before=await read(study.id),game=await state(a);
  const compare=async(l,r)=>(await api(`/api/analysis/${study.id}/compare?left=${l}&right=${r}`,a)).data;
  const result=await compare(left.id,right.id);assert.equal(result.commonPrefix,6);assert.deepEqual(result.differentCells,[28,38,39]);assert.deepEqual(result.left,left);assert.deepEqual(result.right,right);
  const swapped=await compare(right.id,left.id);assert.deepEqual(swapped.differentCells,result.differentCells);assert.deepEqual(swapped.left,right);
  const same=await compare(right.id,right.id);assert.equal(same.commonPrefix,8);assert.deepEqual(same.differentCells,[]);assert.deepEqual(await read(study.id),before);assert.deepEqual(await state(a),game);
 });
 await check('analysis practice win/draw terminal locking, root boundary and competitive isolation',async()=>{
  const before=await state(a);let s=(await create()).study;s=await action(s,'move',{column:4});assert.equal(selected(s).winningCells.length,4);await reject(s,{column:2});s=await action(s,'undo');assert.equal(selected(s).winningCells.length,0);await reject(s,{action:'undo',column:undefined});s=await action(s,'redo');assert.equal(selected(s).status,'red_win');assert.deepEqual(await state(a),before);
  const game=await state(j),draw=game.archive.find(m=>m.moveCount===42);assert(draw);let d=(await create(41,j,draw.matchId)).study;assert.equal(selected(d).board.filter(Boolean).length,41);assert.equal(selected(d).board[6],'');d=await action(d,'move',{column:7},j);const id=d.selectedId;assert.equal(selected(d).status,'draw');d=await action(d,'undo',{},j);assert.equal(selected(d).history.length,41);d=await action(d,'redo',{},j);assert.equal(d.selectedId,id);assert.deepEqual(await state(j),game);
  assert.equal(selected((await create(42,j,draw.matchId)).study).status,'draw');
 });
 await check('analysis server rejects malformed fields atomically, full column and invalid redo',async()=>{
  const s=(await create(0)).study;
  for(const body of [{operationId:undefined},{operationId:'bad'},{expectedRevision:undefined},{expectedRevision:'0'},{expectedRevision:.5},{column:0},{column:8},{column:1.5},{column:'2'},{action:'unknown'},{action:[]},{board:[]},{userId:1},{action:'rename',column:undefined,name:''},{action:'rename',column:undefined,name:'x'.repeat(61)},{action:'select',column:undefined,nodeId:[]},{action:'select',column:undefined}])await reject(s,body);
  const count=(await list()).length;
  for(const extra of [{name:''},{name:'x'.repeat(61)},{step:-1},{step:.5},{step:8},{board:[]},{userId:1},{step:'6'},{step:true}]){
   const r=await api('/api/analysis',a,{name:'invalid',matchId:source,step:6,operationId:randomUUID(),...extra});assert(r.status>=400&&r.status<500,JSON.stringify(r));assert.equal((await list()).length,count);
  }
  await reject(s,{action:'undo',column:undefined});await reject(s,{action:'redo',column:undefined});let f=s;for(let i=0;i<6;i++)f=await action(f,'move',{column:1});await reject(f,{column:1});
  const child=f.selectedId;f=await action(f,'select',{nodeId:f.rootId});await reject(f,{action:'redo',column:undefined,childId:child});
 });
 await check('analysis foreign account/source/node isolation and revoked sessions',async()=>{
  const other=(await create()).study, before=await read(study.id);
  assert(!(await list(j)).some(s=>s.id===study.id));assert.equal((await api('/api/analysis/'+study.id,j)).status,404);
  const r=await reject(study,{},j);assert(!r.data.study);assert.equal((await api('/api/analysis',j,{name:'foreign',matchId:source,step:0,operationId:randomUUID()})).status,404);
  for(const actionName of ['select','redo'])await reject(study,{action:actionName,column:undefined,...(actionName==='select'?{nodeId:other.rootId}:{childId:other.rootId})});
  assert.equal((await api(`/api/analysis/${study.id}/compare?left=${study.rootId}&right=${other.rootId}`,a)).status,404);
  assert.equal((await api(`/api/analysis/${study.id}/compare?left=${study.rootId}&right=${study.rootId}`,j)).status,404);assert.deepEqual(await read(study.id),before);
  const t1=await login('jordan'),t2=await login('jordan');assert.notEqual(t1,t2);await api('/api/logout',t1,{});assert.equal((await api('/api/analysis',t2)).status,401);j=await login('jordan');
 });
 await check('analysis exact success/reject replay, payload conflict and durable cursor',async()=>{
  const c=await create();let s=c.study;const url='/api/analysis/'+s.id+'/actions';
  const body={action:'move',column:5,expectedRevision:0,operationId:randomUUID()};const accepted=await api(url,a,body);s=accepted.data.study;s=await action(s,'undo');
  assert.deepEqual(await api(url,a,body),accepted);assert.deepEqual(await read(s.id),s);assert.deepEqual(await api('/api/analysis',a,c.body),c.response);assert.deepEqual(await read(s.id),s);
  const wrong={...body,column:4};assert.equal((await api(url,a,wrong)).status,409);assert.deepEqual(await read(s.id),s);
  const stale={...body,operationId:randomUUID()};const denied=await api(url,a,stale);assert.equal(denied.status,409);s=await action(s,'move',{column:4});assert.deepEqual(await api(url,a,stale),denied);assert.deepEqual(await read(s.id),s);
  rejectedReceipt={url,body:stale,response:denied};receipt={url,body,response:accepted};
 });
 await check('analysis remains usable after its source is unarchived and competitive round replaced',async()=>{
  const g=await play(a,red),src=g.archive[0].matchId;let s=(await create(6,a,src)).study;s=await action(s,'move',{column:5});await mutate(a,'undo');assert(!(await state(a)).archive.some(m=>m.matchId===src));assert.deepEqual(await read(s.id),s);await mutate(a,'new');assert.deepEqual(await read(s.id),s);s=await action(s,'move',{column:1});assert.equal(selected(s).board[28],'Yellow');assert.equal((await state(a)).game.moveHistory.length,0);
 });
 const waitReady=p=>p.waitForFunction(()=>document.querySelector('#analysis-detail')&&!document.querySelector('#analysis-refresh').disabled);
 const click=async(p,selector)=>{const wait=p.waitForResponse(r=>r.url().includes('/api/analysis/')&&r.request().method()==='POST');await p.locator(selector).click();const response=await wait;await response.finished();await waitReady(p);return response;};
 const open=async(p,id)=>{await p.locator(`[data-study="${id}"]`).click();await p.waitForFunction(id=>document.querySelector(`#analysis-tree [data-node="${id}"]`), (await read(id)).rootId);};
 let browserStudy;
 await check('real browser: UI fork, branches, nested selection, rename/reload and comparison',async()=>{
  await play(a,red);const p=await browser.newPage({viewport:{width:1280,height:800}});const errors=[];p.on('pageerror',e=>errors.push(String(e)));await uiLogin(p);
  await p.locator('#match-archive button').first().click();await p.locator('#replay-step').focus();await p.keyboard.press('End');await p.keyboard.press('ArrowLeft');assert.equal(await p.locator('#replay-step').inputValue(),'6');await p.locator('#analysis-new-name').fill('Browser variations');
  const creating=p.waitForResponse(r=>r.url().endsWith('/api/analysis')&&r.request().method()==='POST');await p.locator('#analysis-create').click();browserStudy=(await (await creating).json()).study;await p.locator('#analysis-detail').waitFor({state:'visible'});await waitReady(p);
  assert.equal(await p.locator('#analysis-board [role=gridcell]').count(),42);const before=await state(a);
  await click(p,'[aria-label="Analysis drop in column 4"]');const A=(await read(browserStudy.id)).selectedId;await click(p,'#analysis-undo');await click(p,'[aria-label="Analysis drop in column 5"]');const B=(await read(browserStudy.id)).selectedId;await click(p,'[aria-label="Analysis drop in column 1"]');const C=(await read(browserStudy.id)).selectedId;
  await click(p,'#analysis-undo');await click(p,'[aria-label="Analysis drop in column 2"]');const D=(await read(browserStudy.id)).selectedId;assert.equal(await p.locator('#analysis-tree button').count(),5);
  await p.locator('#analysis-left').selectOption(A);await p.locator('#analysis-right').selectOption(C);await p.locator('#analysis-compare').click();await p.locator('#analysis-comparison').waitFor({state:'visible'});assert.match(await p.locator('#analysis-common').innerText(),/6 moves/);assert.equal(await p.locator('#analysis-left-board [aria-label*=different]').count(),3);assert.equal(await p.locator('#analysis-right-board [role=gridcell]').count(),42);
  await p.screenshot({path:'/evidence/analysis-desktop.png',fullPage:true});await p.setViewportSize({width:375,height:760});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.emulateMedia({reducedMotion:'reduce'});await p.screenshot({path:'/evidence/analysis-mobile.png',fullPage:true});
  await p.locator('#analysis-rename-name').fill('Browser durable name');await click(p,'#analysis-rename button');assert.match(await p.locator('#analysis-title').innerText(),/Browser durable name/);await p.reload();await p.locator(`[data-study="${browserStudy.id}"]`).waitFor();await open(p,browserStudy.id);assert.equal(await p.locator('#analysis-tree button').count(),5);assert.match(await p.locator(`[data-node="${D}"]`).getAttribute('aria-current'),/true/);
  await click(p,`[data-node="${B}"]`);await p.locator('#analysis-child').selectOption(C);await click(p,'#analysis-redo');assert.equal((await read(browserStudy.id)).selectedId,C);assert.deepEqual(await state(a),before);assert.deepEqual(errors,[]);await p.close();
 });
 await check('real browser: analysis keyboard focus, two-tab stale recovery and pending-repeat guard',async()=>{
  const s=(await create(0)).study;const p=await browser.newPage(),q=await browser.newPage();await uiLogin(p);await uiLogin(q);await open(p,s.id);await open(q,s.id);
  const first=p.locator('[aria-label="Analysis drop in column 1"]');await first.focus();await p.keyboard.press('ArrowLeft');assert(await first.evaluate(e=>document.activeElement===e));await p.keyboard.press('End');assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Analysis drop in column 7');await p.keyboard.press('Home');await p.keyboard.press('ArrowRight');
  for(const key of ['Enter','Space']){const w=p.waitForResponse(r=>r.url().endsWith('/actions'));await p.keyboard.press(key);await w;await waitReady(p);assert.equal(await p.evaluate(()=>document.activeElement.getAttribute('aria-label')),'Analysis drop in column 2');}
  assert.equal((await click(q,'[aria-label="Analysis drop in column 4"]')).status(),409);assert.match(await q.locator('#analysis-message').innerText(),/another tab/);assert.equal((await read(s.id)).nodes.length,3);await click(q,'[aria-label="Analysis drop in column 4"]');assert.equal((await read(s.id)).nodes.length,4);
  await p.reload();await p.locator(`[data-study="${s.id}"]`).waitFor();await open(p,s.id);
  let release,seen;const held=new Promise(r=>{release=r;}),arrived=new Promise(r=>{seen=r;});await p.route('**/api/analysis/*/actions',async route=>{const response=await route.fetch();seen();await held;await route.fulfill({response});});
  const before=await read(s.id),drop=p.locator('[aria-label="Analysis drop in column 3"]');await drop.click();await arrived;await drop.click({force:true});release();await waitReady(p);await p.unroute('**/api/analysis/*/actions');const after=await read(s.id);assert.equal(after.nodes.length,before.nodes.length+1);assert.equal(after.revision,before.revision+1);
  await p.locator('#analysis-undo').focus();let w=p.waitForResponse(r=>r.url().endsWith('/actions'));await p.keyboard.press('Enter');await w;await waitReady(p);assert(await p.locator('#analysis-undo').evaluate(e=>e===document.activeElement));await p.locator('#analysis-redo').focus();w=p.waitForResponse(r=>r.url().endsWith('/actions'));await p.keyboard.press('Enter');await w;await waitReady(p);assert(await p.evaluate(()=>document.activeElement!==document.body&&!document.activeElement.disabled));
  await p.close();await q.close();
 });
 const snapshots=async()=>{const result={};for(const [who,t] of [['avery',a],['jordan',j]]){const items=await list(t);result[who]=await Promise.all(items.map(x=>read(x.id,t)));}return result;};
 const tools=await require('./tools-regressions.cjs')({check,api,state,create,action,read,a,j,browser,uiLogin});
 const beforeRestart=await snapshots();
 return {j, verify:async()=>{
  assert.deepEqual(await snapshots(),beforeRestart);assert.deepEqual(await api(receipt.url,a,receipt.body),receipt.response);assert.deepEqual(await api(rejectedReceipt.url,a,rejectedReceipt.body),rejectedReceipt.response);assert.deepEqual(await snapshots(),beforeRestart);await tools.verify();
 }};
};
