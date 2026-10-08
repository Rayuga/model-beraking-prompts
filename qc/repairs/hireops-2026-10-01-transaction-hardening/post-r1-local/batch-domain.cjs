'use strict';
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const {spawn}=require('child_process');
const out='/evidence/batch-domain';fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:3060',cookies={},results=[];let serial=0,child,logs='';
const users={r:'rafael.costa',c:'mei.lin',a1:'ingrid.sorensen',a2:'bill.okafor',a3:'yuki.tanaka',f:'farah.nasser',u:'aud.halvorsen'};
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function api(actor,url,body) {
 const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(cookies[actor]?{cookie:cookies[actor]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};
}
async function start() {
 child=spawn('node',['/solution/app/server.js'],{env:{...process.env,PORT:'3060',DB_PATH:'/tmp/hireops-batch-domain.db'},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);
 for(let i=0;i<100;i++){try{const r=await api('','/api/health');if(r.status===200)break;}catch{}await sleep(50);}
 for(const [who,email] of Object.entries(users)) {
  let r;for(let i=0;i<40;i++){r=await api('','/api/auth/login',{email:email+'@hireops.example',password:'Hireops!2026'});if(r.status===200)break;await sleep(50);}
  assert.equal(r.status,200,JSON.stringify(r));cookies[who]=r.cookie.split(';')[0];
 }
}
async function stop(){if(child.exitCode!==null)return;child.kill('SIGTERM');for(let i=0;i<50&&child.exitCode===null;i++)await sleep(40);if(child.exitCode===null)child.kill('SIGKILL');await sleep(100);}
async function test(name,fn){await fn();results.push({name,passed:true});}
async function req(budget=100000){const id='HB-R'+(++serial);const r=await api('r','/api/requisitions',{id,title:id,dept:'Engineering',budget_cents:budget});assert.equal(r.status,200,JSON.stringify(r));return id;}
const terms=(patch={})=>({base_salary_cents:1000,signing_bonus_cents:0,relocation_cents:0,equity_units:0,equity_fair_cents:0,equity_strike_cents:0,...patch});
async function hire(req_id,patch={}){const id='HB-O'+(++serial);let r=await api('r','/api/offers',{id,req_id,candidate:id,start_date:'2024-02-29T12:34:56.789Z',...terms(patch)});assert.equal(r.status,200,JSON.stringify(r));r=await api('a3',`/api/offers/${id}/approve`,{});assert.equal(r.status,200,JSON.stringify(r));return id;}
const member=(offer_id,destination_req_id,patch={})=>({offer_id,destination_req_id,...terms(patch)});
async function preview(members,key='HB-K'+(++serial),actor='f'){return api(actor,'/api/change-sets/preview',{operation_key:key,members});}
const commit=(id,actor='f')=>api(actor,'/api/change-sets/'+encodeURIComponent(id)+'/commit',{});
async function financial(){const r=await api('u','/api/bootstrap');assert.equal(r.status,200);return Object.fromEntries(['requisitions','offers','commitment_movements','equity_grants','equity_cancellations','remittances','referral_accruals','after_images','audit'].map(k=>[k,k==='audit'?r.data[k].filter(a=>!['LOGIN','LOGOUT'].includes(a.action)):r.data[k]]));}
async function pair(){const a=await req(),b=await req();return {a,b,x:await hire(a),y:await hire(b)};}
async function validPreview(p,patch={}){const r=await preview([member(p.x,p.a,patch),member(p.y,p.b)]);assert.equal(r.status,200,JSON.stringify(r));return r.data;}
let persisted,cycle,cycleMembers;
(async()=>{try{
 await start();
 await test('netted fully-funded two-requisition cycle; preview has no economic effects',async()=>{
  const a=await req(10000),b=await req(10000);
  const old=terms({base_salary_cents:9823,signing_bonus_cents:1001,relocation_cents:321,equity_units:7,equity_fair_cents:102,equity_strike_cents:1,referred_by:'EMP-R1',referred_hire_start:'2026-02-01T00:00:00Z'});
  const x=await hire(a,old),y=await hire(b,old);
  cycleMembers=[member(x,b,{base_salary_cents:9447,signing_bonus_cents:803,relocation_cents:999,equity_units:11,equity_fair_cents:203,equity_strike_cents:2}),member(y,a,{base_salary_cents:9022,signing_bonus_cents:1205,relocation_cents:777,equity_units:13,equity_fair_cents:304,equity_strike_cents:3})];
  const before=await financial();const p=await preview(cycleMembers,'HB-CYCLE');assert.equal(p.status,200,JSON.stringify(p));cycle=p.data;
  assert.deepEqual(await financial(),before);assert.deepEqual(cycle.preview.requisitions.map(r=>[r.before_headroom_cents,r.after_headroom_cents]),[[0,0],[0,0]]);
  assert.deepEqual(cycle.preview.changes.map(r=>r.signing_adjustment_cents),[-198,204]);
  const r=await commit(cycle.id);assert.equal(r.status,200,JSON.stringify(r));persisted=r.data;
  for(const c of r.data.receipt.changes){assert.equal(c.after.req_id,c.destination_req_id);assert.equal(c.after.headroom_cents,0);assert.equal(c.after.start_date,c.before.start_date);assert.equal(c.after.composition.committed_run_rate_cents,10000);}
 });
 await test('batch signing differences, replacement grant prices, original referral and immutable source lineage',async()=>{
  const data=await financial();assert.equal(data.referral_accruals.filter(r=>cycleMembers.some(m=>m.offer_id===r.offer_id)).length,2);
  for(const [i,c] of persisted.receipt.changes.entries()){
   const prior=data.offers.find(o=>o.id===c.old_offer_id),next=data.offers.find(o=>o.id===c.new_offer_id);
   assert.equal(prior.status,'SUPERSEDED');assert.equal(prior.req_id,c.source_req_id);assert.equal(next.req_id,c.destination_req_id);
   const g=data.equity_grants.find(g=>g.offer_id===next.id);assert.equal(g.units,i===0?11:13);assert.equal(g.fair_cents,i===0?203:304);assert.equal(g.strike_cents,i===0?2:3);assert.equal(g.grant_date,prior.start_date);
   const rms=data.remittances.filter(m=>m.offer_id===next.id);assert.equal(rms.length,1);assert.equal(rms[0].amount_cents,i===0?-198:204);
   assert.equal(next.referral_accrual.offer_id,prior.id);
  }
 });
 await test('same-actor key ignores member order and refuses a changed intent without effects',async()=>{
  let p=await preview([...cycleMembers].reverse(),'HB-CYCLE');assert.equal(p.status,200);assert.deepEqual(p.data,persisted);
  const before=await financial();p=await preview([{...cycleMembers[0],base_salary_cents:1},cycleMembers[1]],'HB-CYCLE');assert.equal(p.status,409);assert.deepEqual(await financial(),before);
 });
 await test('same saved commit concurrent retries return original receipt and post no duplicates',async()=>{
  const p=await pair(),draft=await validPreview(p,{base_salary_cents:1001});const before=await financial();
  const [a,b]=await Promise.all([commit(draft.id),commit(draft.id)]);assert.equal(a.status,200);assert.equal(b.status,200);assert.deepEqual(a.data,b.data);
  const after=await financial();assert.equal(after.offers.length-before.offers.length,2);assert.equal(after.commitment_movements.length-before.commitment_movements.length,4);
  assert.equal(after.after_images.length-before.after_images.length,2);assert.equal(after.audit.filter(a=>a.action==='CHANGE_SET_COMMITTED'&&a.subject===draft.id).length,1);
 });
 await test('same-requisition offsetting changes use final net budget, not member order',async()=>{
  const a=await req(10000),x=await hire(a,{base_salary_cents:6000}),y=await hire(a,{base_salary_cents:4000});
  const p=await preview([member(x,a,{base_salary_cents:8000}),member(y,a,{base_salary_cents:2000})]);assert.equal(p.status,200);assert.equal(p.data.preview.requisitions[0].after_headroom_cents,0);assert.equal((await commit(p.data.id)).status,200);
 });
 await test('over-budget or malformed set saves no preview and has no partial financial effects',async()=>{
  const p=await pair(),ok=[member(p.x,p.a),member(p.y,p.b)],before=await financial();
  const originals=(await api('f','/api/change-sets')).data.length;
  for(const ms of [[ok[0]],[...ok,ok[0]],[...ok,...ok,ok[0]],[{...ok[0],base_salary_cents:100001},ok[1]],[{...ok[0],destination_req_id:'missing'},ok[1]],[{...ok[0],equity_units:1.1},ok[1]]]){
   const r=await preview(ms);assert.ok(r.status>=400&&r.status<500,JSON.stringify(r));
  }
  assert.equal((await api('f','/api/change-sets')).data.length,originals);assert.deepEqual(await financial(),before);
 });
 await test('four-member valid set and exact safe-integer overflow guard',async()=>{
  const a=await req(),ids=[];for(let i=0;i<4;i++)ids.push(await hire(a));
  const ms=ids.map(id=>member(id,a,{base_salary_cents:1001}));const p=await preview(ms);assert.equal(p.status,200);assert.equal((await commit(p.data.id)).status,200);
  const q=await pair(),before=await financial();const bad=await preview([member(q.x,q.a,{equity_units:Number.MAX_SAFE_INTEGER,equity_fair_cents:2,equity_strike_cents:0}),member(q.y,q.b)]);assert.equal(bad.status,400);assert.deepEqual(await financial(),before);
 });
 await test('touched-budget ABA invalidates preview even though headroom returns; repeating key cannot refresh it',async()=>{
  const p=await pair(),ms=[member(p.x,p.a),member(p.y,p.b)],draft=await preview(ms,'HB-ABA');assert.equal(draft.status,200);
  const extra=await hire(p.a,{base_salary_cents:777});assert.equal((await api('f',`/api/offers/${extra}/rescind`,{effective_at:'2025-02-28T12:34:56.789Z'})).status,200);
  const before=await financial();assert.equal((await commit(draft.data.id)).status,409);assert.deepEqual(await financial(),before);
  const retry=await preview(ms,'HB-ABA');assert.deepEqual(retry.data,draft.data);assert.equal((await commit(retry.data.id)).status,409);
  const fresh=await preview(ms,'HB-ABA-CORRECTED');assert.equal(fresh.status,200);assert.equal((await commit(fresh.data.id)).status,200);
 });
 await test('stale second member refuses without posting the valid first member',async()=>{
  const p=await pair(),draft=await validPreview(p);assert.equal((await api('r',`/api/offers/${p.y}/revise`,{base_salary_cents:1001})).status,200);
  const before=await financial();assert.equal((await commit(draft.id)).status,409);assert.deepEqual(await financial(),before);
 });
 await test('pending creation, another preview, and unrelated settlement do not invalidate the captured read set',async()=>{
  const p=await pair(),draft=await validPreview(p),other=await req();await hire(other);
  const id='HB-PENDING'+(++serial);assert.equal((await api('r','/api/offers',{id,req_id:p.a,candidate:id,start_date:'2026-01-01',...terms()})).status,200);
  assert.equal((await preview([member(p.x,p.a),member(p.y,p.b)])).status,200);assert.equal((await commit(draft.id)).status,200);
 });
 await test('different overlapping previews serialize: one complete winner, one unchanged loser',async()=>{
  const p=await pair(),a=await validPreview(p,{base_salary_cents:1001}),b=await validPreview(p,{base_salary_cents:1002});const before=await financial();
  const rs=await Promise.all([commit(a.id),commit(b.id)]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);assert.equal((await financial()).offers.length-before.offers.length,2);
 });
 await test('disjoint previews both commit independently',async()=>{
  const a=await validPreview(await pair()),b=await validPreview(await pair());assert.deepEqual((await Promise.all([commit(a.id),commit(b.id)])).map(r=>r.status),[200,200]);
 });
 await test('Finance-only prepare/commit and anonymous read boundaries, including cached commit',async()=>{
  const p=await pair(),ms=[member(p.x,p.a),member(p.y,p.b)],before=await financial();
  for(const actor of ['r','c','a1','a2','a3','u']) {assert.equal((await preview(ms,'HB-AUTH-'+actor,actor)).status,403);assert.equal((await commit(persisted.id,actor)).status,403);}
  assert.equal((await commit(persisted.id,'')).status,401);assert.equal((await preview(ms,'HB-ANON','')).status,401);
  assert.equal((await api('','/api/change-sets')).status,401);assert.equal((await api('','/api/change-sets/'+persisted.id)).status,401);assert.deepEqual(await financial(),before);
 });
 await test('later revision/rescission uses destination budget while repeated batch returns original receipt',async()=>{
  const c=persisted.receipt.changes[0],r=await api('r',`/api/offers/${c.new_offer_id}/revise`,{base_salary_cents:9000});assert.equal(r.status,200);
  assert.equal(r.data.revised_offer.req_id,c.destination_req_id);assert.equal((await api('f',`/api/offers/${r.data.revised_offer_id}/rescind`,{effective_at:'2025-02-28T12:34:56.789Z'})).status,200);
  const before=await financial();assert.deepEqual((await commit(persisted.id)).data,persisted);assert.deepEqual(await financial(),before);
 });
 await test('process restart preserves saved previews and original retry receipts',async()=>{
  const before=await financial();const drafts=(await api('u','/api/change-sets')).data;await stop();await start();
  assert.deepEqual(await financial(),before);assert.deepEqual((await api('u','/api/change-sets')).data,drafts);assert.deepEqual((await commit(persisted.id)).data,persisted);assert.deepEqual(await financial(),before);
 });
 }catch(e){results.push({name:'FAILURE',passed:false,error:e.stack});process.exitCode=1;}finally{await stop();fs.writeFileSync(out+'/server.log',logs);fs.writeFileSync(out+'/results.json',JSON.stringify({kind:'Local HTTP product observations; not a configured judge grade',source_sha256:Object.fromEntries(['index.js','rules.js','change-sets.js','db.js'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('/solution/app/src/'+n)).digest('hex')])),results},null,2));console.log(JSON.stringify(results,null,2));}})();

