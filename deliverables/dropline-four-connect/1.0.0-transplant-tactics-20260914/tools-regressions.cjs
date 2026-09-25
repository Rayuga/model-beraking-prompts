const assert=require('node:assert/strict'),fs=require('node:fs');
const {randomUUID}=require('node:crypto');
module.exports=async function({check,api,state,create,action,read,a,j,browser,uiLogin}){
 const previewPath='/api/analysis-tools/transplant/preview',commitPath='/api/analysis-tools/transplant/commit';
 const selected=s=>s.nodes.find(n=>n.id===s.selectedId);
 const preview=async(s,d,branch,target=d.rootId,t=a)=>{const r=await api(previewPath,t,{sourceStudyId:s.id,sourceNodeId:branch,destinationStudyId:d.id,destinationNodeId:target});assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 const commit=async(p,t=a)=>{const body={previewId:p.previewId,operationId:randomUUID()},r=await api(commitPath,t,body);assert.equal(r.status,200,JSON.stringify(r));return {body,response:r};};
 let source,dest,branch,receipt,pending,proofReceipt,second=0,rejected;
 await check('transplant preview replay colors/gravity, nested paths and zero saved mutation',async()=>{
  source=(await create(0)).study;source=await action(source,'move',{column:1});branch=source.selectedId;source=await action(source,'move',{column:2});source=await action(source,'undo');source=await action(source,'move',{column:3});source=await action(source,'move',{column:4});
  dest=(await create(1)).study;dest=await action(dest,'move',{column:1});dest=await action(dest,'move',{column:2});const before=await state(a);
  const p=await preview(source,dest,branch);assert(p.valid);assert.equal(p.added,2);assert.equal(p.reused,2);assert.deepEqual(p.mappings.map(m=>m.path),[[1],[1,2],[1,3],[1,3,4]]);assert.equal(p.mappings[0].position.board[28],'Yellow');assert.equal(p.mappings[1].position.board[36],'Red');
  assert.deepEqual(await read(source.id),source);assert.deepEqual(await read(dest.id),dest);assert.deepEqual(await state(a),before);
  pending=p;
 });
 await check('transplant atomic commit mapping, stable reuse and cursor/source isolation',async()=>{
  const old=dest;receipt=await commit(pending);dest=receipt.response.data.study;assert.equal(dest.revision,old.revision+1);assert.equal(dest.selectedId,old.selectedId);assert.equal(dest.nodes.length,old.nodes.length+2);assert.equal(receipt.response.data.mapping.length,4);assert.deepEqual(await read(source.id),source);
  for(const n of old.nodes)assert.deepEqual(dest.nodes.find(x=>x.id===n.id),n);
  const plan=await preview(source,dest,branch);assert.equal(plan.added,0);assert.equal(plan.reused,4);const retry=await commit(plan);assert.equal(retry.response.data.study.revision,dest.revision+1);assert.equal(retry.response.data.study.nodes.length,dest.nodes.length);dest=retry.response.data.study;
  assert.deepEqual(await api(commitPath,a,receipt.body),receipt.response);assert.deepEqual(await read(dest.id),dest);
  assert.equal((await api(commitPath,a,{...receipt.body,operationId:randomUUID()})).status,409);
  assert.equal((await api(commitPath,a,{...receipt.body,previewId:randomUUID()})).status,409);
 });
 await check('same-study descendant transplant uses frozen source and increments once',async()=>{
  const s=(await create(0)).study;let tree=await action(s,'move',{column:1});const from=tree.selectedId;tree=await action(tree,'move',{column:2});const target=tree.selectedId;const before=tree;
  const p=await preview(tree,tree,from,target);assert.equal(p.added,2);const r=await commit(p);tree=r.response.data.study;assert.equal(tree.nodes.length,5);assert.equal(tree.revision,before.revision+1);assert.equal(tree.selectedId,target);assert.deepEqual(selected(tree).history,before.nodes.find(n=>n.id===target).history);
 });
 await check('transplant first illegal descendant, full column and terminal rollback',async()=>{
  let s=(await create(0)).study;s=await action(s,'move',{column:1});const b=s.selectedId;s=await action(s,'move',{column:3});s=await action(s,'select',{nodeId:b});s=await action(s,'move',{column:2});s=await action(s,'move',{column:2});
  let d=(await create(0)).study;for(let i=0;i<5;i++)d=await action(d,'move',{column:2});const p=await preview(s,d,b,d.selectedId);assert(!p.valid);assert.deepEqual(p.invalid.path,[1,2,2]);assert.match(p.invalid.reason,/full/);assert.equal(p.previewId,null);assert.deepEqual(await read(d.id),d);
  let terminal=(await create(0)).study;terminal=await action(terminal,'move',{column:4});const four=terminal.selectedId;terminal=await action(terminal,'move',{column:1});const six=(await create(6)).study;const bad=await preview(terminal,six,four);assert(!bad.valid);assert.deepEqual(bad.invalid.path,[4,1]);assert.deepEqual(await read(six.id),six);
 });
 await check('dual revision conflict, rejected receipts and private preview validation',async()=>{
  let p=await preview(source,dest,branch);source=await action(source,'rename',{name:'Updated source'});const body={previewId:p.previewId,operationId:randomUUID()};const r=await api(commitPath,a,body);assert.equal(r.status,409);rejected={body,response:r};assert.deepEqual(await read(dest.id),dest);
  p=await preview(source,dest,branch);dest=await action(dest,'rename',{name:'Updated destination'});assert.equal((await api(commitPath,a,{previewId:p.previewId,operationId:randomUUID()})).status,409);assert.deepEqual(await api(commitPath,a,body),r);
  p=await preview(source,dest,branch);assert.equal((await api(commitPath,j,{previewId:p.previewId,operationId:randomUUID()})).status,404);
  for(const extra of [{sourceNodeId:source.rootId},{board:[]},{destinationNodeId:source.rootId}]){const v=await api(previewPath,a,{sourceStudyId:source.id,sourceNodeId:branch,destinationStudyId:dest.id,destinationNodeId:dest.rootId,...extra});assert(v.status>=400&&v.status<500);}
  assert.equal((await api(previewPath,j,{sourceStudyId:source.id,sourceNodeId:branch,destinationStudyId:dest.id,destinationNodeId:dest.rootId})).status,404);
  assert.equal((await api(commitPath,a,{previewId:p.previewId,operationId:randomUUID(),mapping:[]})).status,400);assert.deepEqual(await read(dest.id),dest);
 });
 await check('distinct intended same-name studies remain independent',async()=>{const name='Same name '+randomUUID();const first=(await create(0,a,undefined,name)).study,other=(await create(0,a,undefined,name)).study;assert.notEqual(first.id,other.id);await action(first,'move',{column:1});assert.deepEqual(await read(other.id),other);});
 const fixtureList=JSON.parse(fs.readFileSync('/evidence/tactical-fixtures.json','utf8'));
 for(const fixture of fixtureList)await check('independent tactical reference: '+fixture.name,async()=>{
  let s=(await create(0)).study;for(const column of fixture.moves)s=await action(s,'move',{column});const before=await state(a);
  const body={nodeId:s.selectedId,depth:fixture.depth};const r=await api(`/api/analysis/${s.id}/tactics`,a,body);assert.equal(r.status,200,JSON.stringify(r));assert.equal(r.data.terminal,fixture.terminal);assert.equal(r.data.proof.outcome,fixture.outcome);assert.equal(r.data.proof.distance,fixture.distance);assert.deepEqual(r.data.proof.children.map(({column,outcome,distance})=>({column,outcome,distance})),fixture.columns);
  let nodes=0;function verify(n){nodes++;assert.equal(n.board.length,42);if(n.reason==='searched'){const legal=n.board.slice(0,7).flatMap((v,i)=>v?[]:[i+1]);assert.deepEqual(n.children.map(c=>c.column),legal);for(const c of n.children){assert.deepEqual(c.proof.path,[...n.path,c.column]);assert.equal(c.proof.remainingDepth,n.remainingDepth-1);assert.notEqual(c.proof.player,n.player);verify(c.proof);}}else assert.equal(n.children.length,0);}
  verify(r.data.proof);if(fixture.name==='empty')assert.equal(nodes,2801);
  assert.deepEqual(await api(`/api/analysis/${s.id}/tactics`,a,body),r);assert.deepEqual(await read(s.id),s);assert.deepEqual(await state(a),before);
  if(fixture.name==='fork-deep')proofReceipt={path:`/api/analysis/${s.id}/tactics`,body,response:r,study:s};
 });
 await check('tactics rejects invalid inputs and foreign positions without writes',async()=>{
  const s=proofReceipt.study;
  for(const depth of [undefined,'3',0,5,1.5,null,true]){const r=await api(proofReceipt.path,a,{nodeId:s.selectedId,depth});assert.equal(r.status,400);}
  assert.equal((await api(proofReceipt.path,j,proofReceipt.body)).status,404);assert.equal((await api(proofReceipt.path,a,{...proofReceipt.body,nodeId:source.rootId})).status,404);assert.equal((await api(proofReceipt.path,a,{...proofReceipt.body,board:[]})).status,400);assert.deepEqual(await read(s.id),s);
 });
 await check('real browser transplant preview/commit and tactical reply inspection',async()=>{
  const p=await browser.newPage({viewport:{width:1280,height:800}});await uiLogin(p);await p.locator(`[data-study="${source.id}"]`).click();await p.locator('#transplant-source').selectOption(branch);await p.locator('#transplant-study').selectOption(dest.id);await p.waitForFunction(id=>document.querySelector('#transplant-target').value===id,dest.rootId);
  await p.locator('#transplant-preview').click();await p.waitForFunction(()=>!document.querySelector('#transplant-commit').disabled);assert.match(await p.locator('#transplant-message').innerText(),/0 new, 4 reused/);assert.equal(await p.locator('#transplant-board [role=gridcell]').count(),42);
  await p.locator('#transplant-commit').click();await p.waitForFunction(()=>document.querySelector('#transplant-message').textContent.includes('committed'));assert.equal(await p.locator('#transplant-result li').count(),4);assert(await p.evaluate(()=>document.activeElement!==document.body));dest=await read(dest.id);
  await p.locator(`[data-study="${proofReceipt.study.id}"]`).click();await p.waitForFunction(id=>document.querySelector('#analysis-tree [aria-current]')?.dataset.node===id,proofReceipt.study.selectedId);await p.locator('#tactics-depth').selectOption('3');await p.locator('#tactics-run').focus();await p.keyboard.press('Enter');await p.waitForFunction(()=>document.querySelectorAll('#tactics-results tbody tr').length===7);assert.match(await p.locator('#tactics-results').innerText(),/Forced win in 3/);assert.equal(await p.locator('#tactics-board [role=gridcell]').count(),42);
  const root=p.locator('#tactics-tree > details');await root.locator(':scope > details').nth(3).locator(':scope > summary').click();const opponent=root.locator(':scope > details').nth(3);await opponent.locator(':scope > button').click();assert.match(await p.locator('#tactics-position').innerText(),/Yellow perspective/);assert.equal(await opponent.locator(':scope > details').count(),7);
  for(const width of [1280,375]){await p.setViewportSize({width,height:width===1280?800:760});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('#study-tools').screenshot({path:`/evidence/study-tools-${width}.png`});}
  await p.emulateMedia({reducedMotion:'reduce'});assert(await p.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches));
  const wait=p.waitForResponse(r=>r.url().endsWith('/actions'));await p.locator('#analysis-undo').click();await wait;await p.waitForFunction(()=>document.querySelectorAll('#tactics-results tbody tr').length===0);
  const redo=p.waitForResponse(r=>r.url().endsWith('/actions'));await p.locator('#analysis-redo').click();await redo;await p.waitForFunction(()=>!document.querySelector('#analysis-close').disabled);proofReceipt.study=await read(proofReceipt.study.id);proofReceipt.response=await api(proofReceipt.path,a,proofReceipt.body);await p.close();
 });
 await check('real browser pending guards, stale preview recovery and populated layouts',async()=>{
  const p=await browser.newPage({viewport:{width:1280,height:800}});await uiLogin(p);await p.locator(`[data-study="${source.id}"]`).click();await p.locator('#transplant-source').selectOption(branch);await p.locator('#transplant-study').selectOption(dest.id);await p.waitForFunction(id=>document.querySelector('#transplant-target').value===id,dest.rootId);
  async function heldClick(selector,url){let release,seen;const gate=new Promise(r=>release=r),arrived=new Promise(r=>seen=r);let count=0;const handler=async route=>{count++;const response=await route.fetch();seen();await gate;await route.fulfill({response});};await p.route(url,handler);const button=p.locator(selector);await button.click();await arrived;assert(await button.isDisabled());const bounds=await button.boundingBox();await p.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2);assert.equal(count,1);release();await p.waitForFunction(()=>!document.querySelector('#transplant-refresh').disabled);await p.unroute(url,handler);assert.equal(count,1);}
  await heldClick('#transplant-preview','**/api/analysis-tools/transplant/preview');assert.match(await p.locator('#transplant-message').innerText(),/Unsaved preview/);
  await p.locator('#tactics-depth').selectOption('2');await heldClick('#tactics-run','**/tactics');assert.equal(await p.locator('#tactics-results tbody tr').count(),7);
  for(const width of [1280,375]){await p.setViewportSize({width,height:width===1280?800:760});assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await p.locator('#study-tools').screenshot({path:`/evidence/study-tools-populated-${width}.png`});}
  const before=dest;await heldClick('#transplant-commit','**/api/analysis-tools/transplant/commit');dest=await read(dest.id);assert.equal(dest.revision,before.revision+1);assert.deepEqual(dest.nodes,before.nodes);
  await p.locator(`[data-study="${source.id}"]`).click();await p.locator('#transplant-source').selectOption(branch);await p.locator('#transplant-study').selectOption(dest.id);await p.waitForFunction(id=>document.querySelector('#transplant-target').value===id,dest.rootId);await p.locator('#transplant-preview').click();await p.waitForFunction(()=>!document.querySelector('#transplant-commit').disabled);
  source=await action(source,'rename',{name:'Revised while preview open'});await p.locator('#transplant-commit').click();await p.waitForFunction(()=>document.querySelector('#transplant-message').textContent.includes('changed'));assert.match(await p.locator('#transplant-message').innerText(),/refresh.*preview/);assert.deepEqual(await read(dest.id),dest);await p.locator('#transplant-refresh').click();await p.waitForFunction(()=>!document.querySelector('#transplant-preview').disabled);await p.locator('#transplant-study').selectOption(dest.id);await p.waitForFunction(id=>document.querySelector('#transplant-target').value===id,dest.rootId);await p.locator('#transplant-preview').click();await p.waitForFunction(()=>!document.querySelector('#transplant-commit').disabled);await p.locator('#transplant-commit').click();await p.waitForFunction(()=>document.querySelector('#transplant-message').textContent.includes('committed'));dest=await read(dest.id);await p.close();
 });
 await check('real browser depth-four proof inspection at exact path preserves root cursor',async()=>{
  const fixture=fixtureList.find(f=>f.name==='empty'),list=await api('/api/analysis',a);let s;
  for(const item of list.data.studies){const candidate=await read(item.id);if(candidate.nodes.length===1&&selected(candidate).history.length===0){s=candidate;break;}}
  assert(s);const p=await browser.newPage({viewport:{width:1280,height:800}});await uiLogin(p);await p.locator(`[data-study="${s.id}"]`).click();await p.waitForFunction(id=>document.querySelector('#analysis-tree [aria-current]')?.dataset.node===id,s.selectedId);await p.locator('#tactics-depth').selectOption(String(fixture.depth));await p.locator('#tactics-run').click();await p.waitForFunction(()=>document.querySelectorAll('#tactics-results tbody tr').length===7);
  let node=p.locator('#tactics-tree > details');for(const col of [4,4,2,3]){await node.locator(':scope > details').nth(col-1).locator(':scope > summary').click();node=node.locator(':scope > details').nth(col-1);}
  await node.locator(':scope > button').click();assert.match(await p.locator('#tactics-position').innerText(),/4 > 4 > 2 > 3.*Red perspective.*horizon/);const cells=await p.locator('#tactics-board [role=gridcell]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('aria-label')));assert.equal(cells.length,42);for(const [index,color] of [[38,'Red'],[36,'Red'],[31,'Yellow'],[37,'Yellow']])assert(cells[index].endsWith(color));assert.deepEqual(await read(s.id),s);await p.close();
 });
 pending=await preview(source,dest,branch);
 return {verify:async()=>{
   assert.deepEqual(await api(commitPath,a,receipt.body),receipt.response);assert.deepEqual(await api(commitPath,a,rejected.body),rejected.response);assert.deepEqual(await api(proofReceipt.path,a,proofReceipt.body),proofReceipt.response);
   second++;if(second===2){const r=await commit(pending);assert.equal(r.response.data.study.revision,dest.revision+1);assert.deepEqual(r.response.data.study.nodes,dest.nodes);assert.deepEqual(await api(commitPath,a,r.body),r.response);}
 }};
};
