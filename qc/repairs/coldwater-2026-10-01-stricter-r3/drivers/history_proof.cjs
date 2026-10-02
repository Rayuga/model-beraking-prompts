const assert=require('node:assert/strict'),fs=require('node:fs');
const {GoldenBrowser}=require('./workflow_core.cjs');
const fields=r=>({title:r.title,filename:r.filename,code:r.code});
async function runHistory(d,l,emit,phase,dir){
 const p=d.page,request=p.request;
 const get=async(id,suffix='')=>(await request.get(d.origin+'/api/snippets/'+id+suffix)).json();
 const snapshots=id=>get(id,'/history');
 const send=async(op)=>{const response=await request.fetch(op.url,{method:op.method,data:op.body});return{status:response.status(),data:await response.json()};};
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 const check=async(key,fn)=>l.observe({id:key},async()=>{const data=await fn();emit(key,true,data);return data;});
 if(phase==='post'){
  const state=JSON.parse(fs.readFileSync(dir+'/history-state.json'));
  await check('S22.process_restart_durability',async()=>{assert.deepEqual(await (await request.get(d.origin+'/api/snippets')).json(),state.library);return{records:state.library.length};});
  await check('S22.history_restart',async()=>{for(const[id,h]of Object.entries(state.histories))assert.deepEqual(await snapshots(id),h);return{fixtures:Object.keys(state.histories)};});
  await check('S22.restore_retry_restart',async()=>{const r=await send(state.restoreOperation);assert.equal(r.status,200);assert.deepEqual(r.data,state.restoreResult);assert.deepEqual(await get(state.id),state.head);assert.deepEqual(await snapshots(state.id),state.histories[state.id]);return r;});
  await check('S22.process_restart_write',async()=>{const r=await get(state.id);const response=await request.put(d.origin+'/api/snippets/'+r.id,{data:{...r,code:'console.log("post-restart-update");'}});assert.equal(response.status(),200);const n=await response.json();assert.equal(n.revision,r.revision+1);assert.equal((await get(r.id)).code,n.code);return n;});return;
 }
 const A={title:'Proof History A',filename:'version-a.js',code:"console.log('history-A');"};
 const B={title:'Proof History B',filename:'version-b.html',code:"<html><body><p>history-B</p><script>console.log('history-B');</script></body></html>"};
 const C={title:'Proof History C',filename:'version-c.js',code:"console.log('history-C');"};
 const saved=[];saved.push((await d.create(A)).record);const id=saved[0].id;
 for(const value of [B,C]){await d.title().fill(value.title);await d.enter(value.code,value.filename);saved.push((await d.save()).record);}
 await check('S37.history_snapshots',async()=>{const h=await snapshots(id);assert.equal(h.length,3);for(const r of saved){assert.deepEqual(fields(h.find(x=>x.revision===r.revision)),fields(r));await p.getByRole('button',{name:'Revision '+r.revision,exact:true}).click();assert.equal(await p.getByLabel('Historical source').innerText(),r.code);}return h;});
 const dirty={title:'Proof History Unsaved',filename:'history-unsaved.js',code:"console.log('unsaved-history-draft');"};
 await d.title().fill(dirty.title);await d.enter(dirty.code,dirty.filename);
 await check('S37.history_inspection_draft',async()=>{await p.getByRole('button',{name:'Revision 1',exact:true}).click();assert.deepEqual(await d.fields(),dirty);return{draft:await d.fields()};});
 await check('S37.history_inspection_saved_head',async()=>{await p.getByRole('button',{name:'Revision 1',exact:true}).click();assert.deepEqual(await get(id),saved[2]);return{head:await get(id)};});
 await check('S37.history_inspection_no_execution',async()=>{await d.run("console.log('history-inspection-control');",'control.js');assert((await d.logs()).includes('history-inspection-control'));await d.enter(dirty.code,dirty.filename);const before=await d.logs();for(const r of saved)await p.getByRole('button',{name:'Revision '+r.revision,exact:true}).click();assert.equal(await d.logs(),before);return{working_control:true,unchanged_logs:true};});
 let restoreOperation,restoreResult;
 await check('S37.history_restore',async()=>{await p.getByRole('button',{name:'Revision 1',exact:true}).click();const r=await d.captureMutation('restore',()=>p.getByRole('button',{name:'Restore selected revision',exact:true}).click());assert(r.ok);restoreOperation=r.operation;restoreResult=r.data;assert.equal(r.data.id,id);assert.equal(r.data.revision,4);assert.deepEqual(fields(r.data),A);const h=await snapshots(id);assert.equal(h.length,4);for(const old of saved)assert.deepEqual(fields(h.find(x=>x.revision===old.revision)),fields(old));return r;});
 await check('S37.restore_retry',async()=>{const before=await snapshots(id);const immediate=await send(restoreOperation);assert.deepEqual(immediate.data,restoreResult);assert.deepEqual(await snapshots(id),before);await d.title().fill('Proof Newer');await d.enter("console.log('history-newer-write');",'history-after-restore.js');const newer=(await d.save()).record;const h=await snapshots(id);const late=await send(restoreOperation);assert.deepEqual(late.data,restoreResult);assert.deepEqual(await get(id),newer);assert.deepEqual(await snapshots(id),h);return{immediate,late,newer};});
 await check('S37.history_reload',async()=>{const h=await snapshots(id);await d.reload();assert.deepEqual(await snapshots(id),h);await d.load(await get(id));return h;});
 // Exercise the actual retry control after the server commits but its reply is lost.
 await check('UI.restore_lost_reply_retry',async()=>{
  const url=restoreOperation.url;let committed=null,attempt=null;
  await p.route(url,async route=>{if(route.request().method()!=='POST')return route.continue();attempt=route.request().postDataJSON();const response=await route.fetch();committed=await response.json();await route.abort('failed');await p.unroute(url);});
  const previous=await get(id),previousHistory=await snapshots(id);
  await p.getByRole('button',{name:'Revision 1',exact:true}).click();await p.getByRole('button',{name:'Restore selected revision',exact:true}).click();
  await p.getByRole('status').filter({hasText:'Restore was not confirmed'}).waitFor();assert(committed);const h=await snapshots(id);
  assert.equal(committed.revision,previous.revision+1);assert.deepEqual(fields(committed),A);
  assert.equal(h.length,previousHistory.length+1);assert.deepEqual(await get(id),committed);
  for(const row of previousHistory)assert.deepEqual(h.find(x=>x.revision===row.revision),row);
  const retry=await d.captureMutation('retry',()=>p.getByRole('button',{name:'Retry same restore',exact:true}).click());assert(retry.ok);assert.deepEqual(retry.operation.body,attempt);assert.deepEqual(retry.data,committed);assert.deepEqual(await snapshots(id),h);return{attempt,committed,retry:retry.data};
 });
 const ctx=await p.context().browser().newContext(),other=await ctx.newPage(),b=new GoldenBrowser(other,l,d.origin);await b.open();
 try{
  const current=await get(id);await d.load(current);await b.load(current);await other.getByRole('button',{name:'Revision 1',exact:true}).click();
  const staleDirty={title:'Stale restore draft',filename:'stale-restore.js',code:"console.log('stale-restore-draft');"};await b.title().fill(staleDirty.title);await b.enter(staleDirty.code,staleDirty.filename);
  await d.enter("console.log('newer-from-A');",'newer-a.js');const winner=(await d.save()).record,h=await snapshots(id);
  const rejected=await b.captureMutation('stale_restore',()=>other.getByRole('button',{name:'Restore selected revision',exact:true}).click());
  await check('S37.history_stale_restore',async()=>{assert.equal(rejected.status,409);assert.deepEqual(await get(id),winner);assert.deepEqual(await snapshots(id),h);return rejected;});
  await check('S37.history_stale_restore_draft',async()=>{await other.getByRole('alert').waitFor();assert.deepEqual(await b.fields(),staleDirty);return{draft:await b.fields(),feedback:await other.getByRole('alert').innerText()};});
 }finally{await ctx.close();}
 for(const restore of [false,true])await check(restore?'S38.racing_save_restore':'S38.racing_saves',async()=>{
  const initial=(await d.create({title:'Race '+restore,filename:'race.js',code:"console.log('race-old');"})).record;
  await d.enter("console.log('race-current');",'race.js');const head=(await d.save()).record;
  const save={url:d.origin+'/api/snippets/'+head.id,method:'PUT',body:{...head,title:'Save Winner',code:"console.log('save-winner');"}};
  const second=restore?{url:d.origin+'/api/snippets/'+head.id+'/restore',method:'POST',body:{revision:head.revision,sourceRevision:initial.revision,operationId:'race-'+Date.now()}}:{...save,body:{...head,title:'Other Winner',code:"console.log('other-winner');"}};
  const results=await Promise.all([send(save),send(second)]);assert.deepEqual(results.map(x=>x.status).sort(),[200,409]);const final=await get(head.id),h=await snapshots(head.id);assert.deepEqual(final,results.find(x=>x.status===200).data);assert.equal(h.length,3);assert.equal(final.revision,head.revision+1);return{results,head:final,history:h};
 });
 const library=await (await request.get(d.origin+'/api/snippets')).json(),histories={};for(const r of library)histories[r.id]=await snapshots(r.id);
 fs.writeFileSync(dir+'/history-state.json',JSON.stringify({id,library,histories,head:await get(id),restoreOperation,restoreResult},null,2));
}
module.exports={runHistory};
