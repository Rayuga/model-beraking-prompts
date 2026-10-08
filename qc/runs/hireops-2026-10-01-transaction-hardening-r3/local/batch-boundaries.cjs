'use strict';
const fs=require('fs'),assert=require('assert/strict'),crypto=require('crypto');
const {spawn}=require('child_process');
const out='/evidence/batch-boundaries';fs.mkdirSync(out,{recursive:true});
const base='http://127.0.0.1:3060',cookies={},results=[];let serial=0,child,logs='';
const users={r:'rafael.costa',c:'mei.lin',a1:'ingrid.sorensen',a2:'bill.okafor',a3:'yuki.tanaka',f:'farah.nasser',u:'aud.halvorsen'};
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function api(actor,url,body) {
 const r=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json',...(cookies[actor]?{cookie:cookies[actor]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')};
}
async function start() {
 child=spawn('node',['/solution/app/server.js'],{env:{...process.env,PORT:'3060',DB_PATH:'/tmp/hireops-batch-boundaries.db'},stdio:['ignore','pipe','pipe']});
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
 await test('different leaf pairs sharing one requisition: one atomic concurrent winner',async()=>{
  const a=await req(),ids=[];for(let i=0;i<4;i++)ids.push(await hire(a));
  const one=await preview(ids.slice(0,2).map(x=>member(x,a,{base_salary_cents:1111}))),two=await preview(ids.slice(2).map(x=>member(x,a,{base_salary_cents:1222})));
  assert.equal(one.status,200);assert.equal(two.status,200);const before=await financial();
  const rs=await Promise.all([commit(one.data.id),commit(two.data.id)]);assert.deepEqual(rs.map(r=>r.status).sort(),[200,409]);const after=await financial();
  assert.equal(after.offers.length-before.offers.length,2);assert.equal(after.commitment_movements.length-before.commitment_movements.length,4);assert.equal(after.after_images.length-before.after_images.length,2);
  const winner=rs.find(r=>r.status===200).data.receipt;for(const c of winner.changes){assert.equal(c.before.headroom_cents,96000);assert.equal(c.after.headroom_cents,winner.requisitions[0].after_headroom_cents);}
 });
 await test('eligible Finance draft protects both write operations for every other role; all authenticated roles can read it',async()=>{
  const p=await pair(),ms=[member(p.x,p.a),member(p.y,p.b)],draft=await preview(ms);assert.equal(draft.status,200);const before=await financial();
  for(const who of ['r','c','a1','a2','a3','u']){assert.equal((await preview(ms,'DENIED-'+who,who)).status,403);assert.equal((await commit(draft.data.id,who)).status,403);assert.deepEqual((await api(who,'/api/change-sets/'+draft.data.id)).data,draft.data);}
  assert.deepEqual(await financial(),before);const done=await commit(draft.data.id);assert.equal(done.status,200);for(const who of ['r','c','a1','a2','a3','u'])assert.deepEqual((await api(who,'/api/change-sets/'+draft.data.id)).data,done.data);
 });
 await test('canonical key binds changed term, destination, and source independently while new keys are accepted',async()=>{
  const p=await pair(),third=await req(),z=await hire(third),ms=[member(p.x,p.a),member(p.y,p.b)],key='BOUND';const old=await preview(ms,key);assert.equal(old.status,200);const before=await financial();
  for(const changed of [[{...ms[0],base_salary_cents:2000},ms[1]],[{...ms[0],destination_req_id:third},ms[1]],[{...ms[0],offer_id:z},ms[1]]]){assert.equal((await preview(changed,key)).status,409);assert.equal((await preview(changed)).status,200);}
  assert.deepEqual(await financial(),before);assert.deepEqual((await preview([...ms].reverse(),key)).data,old.data);
 });
 await test('zero-unit successors supersede original grants without creating replacements or bonus payments',async()=>{
  const a=await req(),x=await hire(a,{equity_units:7,equity_fair_cents:102,equity_strike_cents:1}),y=await hire(a,{equity_units:3,equity_fair_cents:102,equity_strike_cents:1});const before=await financial();const p=await preview([member(x,a),member(y,a)]);assert.equal(p.status,200);const done=await commit(p.data.id);assert.equal(done.status,200);const after=await financial();
  assert.equal(after.equity_grants.length,before.equity_grants.length);assert.equal(after.remittances.length,before.remittances.length);for(const id of [x,y])assert.equal(after.equity_grants.find(g=>g.offer_id===id).state,'SUPERSEDED');
 });
 await test('large safe units with zero spread remain accepted in coordinated preview and commit',async()=>{
  const p=await pair(),draft=await validPreview(p,{equity_units:Number.MAX_SAFE_INTEGER,equity_fair_cents:2,equity_strike_cents:2});assert.equal((await commit(draft.id)).status,200);
 });
 }catch(e){results.push({passed:false,error:e.stack});process.exitCode=1;}finally{await stop();fs.writeFileSync(out+'/server.log',logs);fs.writeFileSync(out+'/results.json',JSON.stringify({kind:'Additional exact frozen golden boundaries; no configured grade',results},null,2));console.log(JSON.stringify(results,null,2));}})();
