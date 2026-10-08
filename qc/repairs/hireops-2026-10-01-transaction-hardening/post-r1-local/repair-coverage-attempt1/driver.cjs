'use strict';
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const {spawn}=require('child_process');
const out='/evidence/repair-coverage';fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:3063',cookies={},results=[];let serial=0,child,logs='';
const users={r:'rafael.costa',c:'mei.lin',a1:'ingrid.sorensen',a2:'bill.okafor',a3:'yuki.tanaka',f:'farah.nasser',u:'aud.halvorsen'};
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function api(actor,url,body) {
 const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(cookies[actor]?{cookie:cookies[actor]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};
}
async function start() {
 child=spawn('node',['/solution/app/server.js'],{env:{...process.env,PORT:'3063',DB_PATH:'/tmp/hireops-repair-coverage.db'},stdio:['ignore','pipe','pipe']});
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
(async()=>{try{await start();
 await test('all supplied referrers remain assignable; imported DRAFT refuses approval without effects',async()=>{
  const boot=(await api('u','/api/bootstrap')).data;
  const employees=boot.employees;for(const name of ['Dara Whitfield','Sofia Marchetti','Omar Haddad']){
   const emp=employees.find(e=>e.name===name);assert.ok(emp,name);
   const req_id=await req(),id='REF-'+(++serial);const r=await api('r','/api/offers',{id,req_id,candidate:name,start_date:'2024-01-01',...terms(),referred_by:emp.id,referred_hire_start:'2026-02-01'});
   assert.equal(r.status,200,JSON.stringify(r));const saved=(await api('u','/api/bootstrap')).data.offers.find(o=>o.id===id);assert.equal(saved.referred_by,emp.id);
  }
  const r=await req(),control=await hire(r);assert.ok(control);
  const draft=(await api('u','/api/bootstrap')).data.offers.find(o=>o.status==='DRAFT');assert.ok(draft);
  const before=await financial();assert.equal(before.commitment_movements.filter(m=>m.offer_id===draft.id).length,0);
  assert.equal((await api('a3','/api/offers/'+draft.id+'/approve',{})).status,409);assert.deepEqual(await financial(),before);
 });
 await test('blank/missing keys and declared coordinated numeric classes refuse without saved previews',async()=>{
  const p=await pair(),ms=[member(p.x,p.a),member(p.y,p.b)];assert.equal((await preview(ms,'GOOD')).status,200);
  const before=await financial(),saved=(await api('u','/api/change-sets')).data;
  for(const body of [{members:ms},{operation_key:'',members:ms},{operation_key:'   ',members:ms}])assert.equal((await api('f','/api/change-sets/preview',body)).status,400);
  for(const key of ['base_salary_cents','signing_bonus_cents','relocation_cents','equity_fair_cents','equity_strike_cents'])for(const value of ['not-money',.1,9007199254740992]){
   const r=await preview([{...ms[0],[key]:value},ms[1]]);assert.equal(r.status,400,key+' '+value+' '+JSON.stringify(r));
  }
  for(const value of ['not-units',.5,9007199254740992])assert.equal((await preview([{...ms[0],equity_units:value},ms[1]])).status,400);
  assert.deepEqual(await financial(),before);assert.deepEqual((await api('u','/api/change-sets')).data,saved);
  const corrected=await preview(ms,'CORRECTED');assert.equal(corrected.status,200);assert.equal((await commit(corrected.data.id)).status,200);
 });
 await test('coordinated relocation never settles; later revision/release and both original-date anchors survive transfer',async()=>{
  const a=await req(),b=await req(),old={signing_bonus_cents:10000,relocation_cents:123,equity_units:10,equity_fair_cents:100,equity_strike_cents:0};
  const x=await hire(a,old),y=await hire(b,old),before=await financial();
  const draft=await preview([member(x,b,{...old,base_salary_cents:1100,signing_bonus_cents:10001,relocation_cents:999}),member(y,a,{...old,base_salary_cents:1200,signing_bonus_cents:11000,relocation_cents:777})]);assert.equal(draft.status,200);
  const done=await commit(draft.data.id);assert.equal(done.status,200);const after=await financial(),oldPay=new Set(before.remittances.map(r=>r.id));
  const added=after.remittances.filter(r=>!oldPay.has(r.id));assert.equal(added.length,2);assert.deepEqual(added.map(r=>r.amount_cents).sort((a,b)=>a-b),[1,1000]);assert.ok(added.every(r=>r.kind==='SIGNING_ADJUSTMENT'));
  const successor=done.data.receipt.changes.find(c=>c.old_offer_id===x).new_offer_id;assert.equal(after.offers.find(o=>o.id===successor).relocation_cents,999);
  const sourceBudget=after.requisitions.find(r=>r.id===a).headroom_cents;
  const revision=await api('r','/api/offers/'+successor+'/revise',{base_salary_cents:1300});assert.equal(revision.status,200);
  const revised=await financial();assert.equal(revised.requisitions.find(r=>r.id===a).headroom_cents,sourceBudget);assert.equal(revised.requisitions.find(r=>r.id===b).headroom_cents,98450);
  const result=await api('f','/api/offers/'+revision.data.revised_offer_id+'/rescind',{effective_at:'2025-02-28T12:34:56.789Z'});assert.equal(result.status,200);
  assert.equal(result.data.signing_vested_cents,4000);assert.equal(result.data.clawback_cents,6001);assert.equal(result.data.equity_vested_units,2);assert.equal(result.data.equity_cancelled_units,8);
  const final=await financial();assert.equal(final.requisitions.find(r=>r.id===a).headroom_cents,sourceBudget);assert.equal(final.requisitions.find(r=>r.id===b).headroom_cents,100000);
 });
 }catch(e){results.push({passed:false,error:e.stack});process.exitCode=1;}finally{await stop();fs.writeFileSync(out+'/server.log',logs);fs.writeFileSync(out+'/results.json',JSON.stringify({scope:'Finite golden coverage for repaired rubric observations; not configured grading',results},null,2));console.log(JSON.stringify(results,null,2));}})();
