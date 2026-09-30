'use strict';
// Independent local product regressions. These are not configured LLM grades.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const task = path.join(root, 'projects/hireops-recruiting-operations/hireops-recruiting-operations');
const out = path.resolve(process.argv[2] || 'qc/runs/hireops-2026-10-01-repairs/domain');
fs.mkdirSync(out, {recursive:true});
const port = 3043, origin = `http://127.0.0.1:${port}`;
const results=[], trace=[], cookies={};
let server, serial=0;
const accounts={ recruiter:'rafael.costa', comp:'mei.lin', tier1:'ingrid.sorensen', tier2:'bill.okafor', tier3:'yuki.tanaka', finance:'farah.nasser', auditor:'aud.halvorsen' };
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const source={};
function walk(dir) { for(const e of fs.readdirSync(dir,{withFileTypes:true})) {const p=path.join(dir,e.name); if(e.isDirectory())walk(p);else source[path.relative(task,p).replaceAll('\\','/')]=sha(p);} }
walk(task);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function boot(){
  server=spawn(process.execPath,[path.join(task,'solution/app/server.js')],{cwd:out,windowsHide:true,env:{...process.env,PORT:String(port),DB_PATH:path.join(out,'domain.sqlite'),NODE_PATH:path.join(root,'.tools/hireops/node_modules')},stdio:['ignore','pipe','pipe']});
  server.stdout.on('data',b=>fs.appendFileSync(path.join(out,'server.log'),b));
  server.stderr.on('data',b=>fs.appendFileSync(path.join(out,'server.log'),b));
  for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error('Server startup failed');try{if((await fetch(origin+'/api/health')).ok)return;}catch{}await sleep(100);}throw Error('Readiness timeout');
}
async function stop(){if(server&&server.exitCode===null){const exited=new Promise(r=>server.once('exit',r));server.kill();await exited;}}
async function call(role,method,url,body){
 const r=await fetch(origin+url,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...(cookies[role]?{cookie:cookies[role]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const value=await r.json(); trace.push({role,method,url,body,status:r.status,value});return {status:r.status,value,headers:r.headers};
}
async function login(role){const r=await call(role,'POST','/api/auth/login',{email:accounts[role]+'@hireops.example',password:'Hireops!2026'});assert.equal(r.status,200);cookies[role]=r.headers.get('set-cookie').split(';')[0];return r.value;}
const get=async id=>(await call('auditor','GET','/api/offers/'+encodeURIComponent(id))).value;
const state=async()=>(await call('auditor','GET','/api/bootstrap')).value;
function economic(s){return {req:s.requisitions,offers:s.offers,movements:s.commitment_movements,grants:s.equity_grants,cancellations:s.equity_cancellations,remittances:s.remittances,referrals:s.referral_accruals,receipts:s.after_images,audit:s.audit.filter(a=>/^OFFER_(APPROVED|REVISED|RESCINDED)$/.test(a.action))};}
const defaults={candidate:'Independent domain control',base_salary_cents:10000,signing_bonus_cents:0,relocation_cents:0,equity_units:0,equity_fair_cents:0,equity_strike_cents:0,start_date:'2024-01-01T00:00:00Z'};
async function req(budget=200000000,id='domain-req-'+(++serial),role='recruiter'){const r=await call(role,'POST','/api/requisitions',{id,title:'Domain control',dept:'Operations',budget_cents:budget});assert.equal(r.status,200,JSON.stringify(r.value));return id;}
async function offer(reqId,extra={},role='recruiter'){const id='domain-offer-'+(++serial);const r=await call(role,'POST','/api/offers',{id,req_id:reqId,...defaults,...extra});assert.equal(r.status,200,JSON.stringify(r.value));return r.value.id;}
async function action(id,verb,body={},role=verb==='approve'?'tier3':verb==='rescind'?'finance':'recruiter'){return call(role,'POST','/api/offers/'+encodeURIComponent(id)+'/'+verb,body);}
async function success(id,verb,body={},role){const r=await action(id,verb,body,role);assert.equal(r.status,200,JSON.stringify(r.value));return r.value;}
async function refuse(label,run,status){const before=economic(await state()),r=await run();assert.ok(status?r.status===status:r.status>=400,label+': '+r.status);assert.deepEqual(economic(await state()),before,label+' changed business state');record(label);}
function record(name,detail={}){results.push({name,passed:true,...detail});}
async function test(name,fn){try{await fn();record(name);}catch(e){results.push({name,passed:false,error:e.stack});}}
async function main(){
 await boot();
 for(const role of Object.keys(accounts)){const u=await login(role);assert.ok(u.name&&u.role);}
 record('all seven demo accounts');
 const shared=await req();
 await test('all roles create requisitions and permitted roles raise offers',async()=>{
   for(const role of Object.keys(accounts)){await req(1000000,undefined,role);if(role!=='auditor')await offer(shared,{},role);}
   await refuse('auditor cannot raise',()=>call('auditor','POST','/api/offers',{id:'auditor-denied',req_id:shared,...defaults}),403);
 });
 await test('composition uses independent exact half-up arithmetic and band boundaries',async()=>{
  for(const base of [19999997,19999998,34999997,34999998]){const id=await offer(shared,{base_salary_cents:base,signing_bonus_cents:1,relocation_cents:99999,equity_units:2,equity_fair_cents:3,equity_strike_cents:2});const c=(await get(id)).composition;
   assert.equal(c.equity_intrinsic_cents,2);assert.equal(c.equity_annualized_cents,1);assert.equal(c.committed_run_rate_cents,base+1);assert.equal(c.band_basis_cents,base+2);assert.equal(c.required_tier,base+2<20000000?1:base+2<35000000?2:3);}
  for(const [fair,strike,units,annual] of [[3,2,1,0],[2,2,2,0],[1,2,2,0]]){const id=await offer(shared,{equity_fair_cents:fair,equity_strike_cents:strike,equity_units:units});assert.equal((await get(id)).composition.equity_annualized_cents,annual);}
 });
 await test('distinct approval role, tier and self-approval boundaries',async()=>{
  const id=await offer(shared);await success(id,'approve');
  for(const role of ['recruiter','comp','finance','auditor']){const target=await offer(shared);await refuse('approval refuses '+role,()=>action(target,'approve',{},role),403);}
  const ii=await offer(shared,{base_salary_cents:20000000});await refuse('tier1 below bandII',()=>action(ii,'approve',{},'tier1'),403);await success(ii,'approve',{},'tier2');
  const iii=await offer(shared,{base_salary_cents:35000000});await refuse('tier2 below bandIII',()=>action(iii,'approve',{},'tier2'),403);await success(iii,'approve');
  const own=await offer(shared,{},'tier2');await refuse('self approval',()=>action(own,'approve',{},'tier2'));await success(own,'approve');
 });
 await test('complete held-tier by required-band authority matrix',async()=>{
  const r=await req();
  for(const tier of [1,2,3])for(const [band,base] of [[1,10000],[2,20000000],[3,35000000]]){
   const id=await offer(r,{base_salary_cents:base});
   const label='tier'+tier+' / band'+band;
   if(tier>=band){await success(id,'approve',{},'tier'+tier);record(label+' allowed');}
   else await refuse(label+' refused with unchanged economic state',()=>action(id,'approve',{},'tier'+tier),403);
  }
 });
 await test('approval and replacement budget equality and no partial writes',async()=>{
  const r=await req(10000000),a=await offer(r,{base_salary_cents:9999999,signing_bonus_cents:10000000});await success(a,'approve');const b=await offer(r,{base_salary_cents:1});await success(b,'approve');const c=await offer(r,{base_salary_cents:1});await refuse('one-cent overrun',()=>action(c,'approve'));
  const rr=await req(10000000),x=await offer(rr,{base_salary_cents:8000000});await success(x,'approve');const y=await success(x,'revise',{base_salary_cents:10000000});await refuse('revision overrun leaves whole ledger',()=>action(y.revised_offer_id,'revise',{base_salary_cents:10000001}));await success(y.revised_offer_id,'revise',{base_salary_cents:9000000});
 });
 await test('two revisions, signed adjustments, superseded grants, final latest-leaf settlement',async()=>{
  const r=await req(),a=await offer(r,{base_salary_cents:10000000,signing_bonus_cents:1000001,relocation_cents:12345,equity_units:7,equity_fair_cents:102,equity_strike_cents:1,start_date:'2024-02-29T12:34:56.789Z',referred_by:'EMP-R1',referred_hire_start:'2026-02-01T00:00:00Z'});
  await success(a,'approve');const before=(await state()).after_images;
  const b=(await success(a,'revise',{base_salary_cents:11000000,signing_bonus_cents:800003,relocation_cents:22222,equity_units:11,equity_fair_cents:203,equity_strike_cents:2})).revised_offer_id;
  const c=(await success(b,'revise',{base_salary_cents:9000000,signing_bonus_cents:1200005,relocation_cents:33300,equity_units:13,equity_fair_cents:304,equity_strike_cents:3},'finance')).revised_offer_id;
  const current=await get(c);assert.equal(current.net_signing_outflow_cents,1200005);assert.deepEqual(current.remittances.map(x=>x.amount_cents),[1000001,-199998,400002]);assert.equal(current.composition.committed_run_rate_cents,9000978);
  const final=await success(c,'rescind',{effective_at:'2025-02-28T12:34:56.789Z'});assert.equal(final.signing_vested_cents,480002);assert.equal(final.clawback_cents,720003);assert.equal(final.equity_vested_units,3);assert.equal(final.equity_cancelled_units,10);assert.equal(final.net_signing_outflow_cents,480002);
  assert.equal((await get(a)).equity_grant.state,'SUPERSEDED');assert.equal((await get(b)).equity_grant.units,11);assert.equal(final.referral_accrual.vested_cents,1000000);
  const after=(await state()).after_images;assert.deepEqual(after.filter(x=>before.some(y=>y.id===x.id)),before);
  for(const [id,verb] of [[a,'approve'],[a,'revise'],[a,'rescind'],[c,'revise'],[c,'rescind']])await refuse('stale '+id+' '+verb,()=>action(id,verb,verb==='rescind'?{effective_at:'2025-02-28T12:34:56.789Z'}:{}));
 });
 await test('each permitted reviser and every forbidden rescinder',async()=>{
  for(const role of ['recruiter','tier1','tier2','tier3','finance']){const id=await offer(shared);await success(id,'approve');await success(id,'revise',{base_salary_cents:10001},role);}
  for(const role of ['comp','auditor']){const id=await offer(shared);await success(id,'approve');await refuse('revision refuses '+role,()=>action(id,'revise',{base_salary_cents:10001},role),403);}
  for(const role of ['recruiter','comp','tier1','tier2','tier3','auditor']){const id=await offer(shared);await success(id,'approve');await refuse('rescission refuses '+role,()=>action(id,'rescind',{effective_at:'2025-01-01'},role),403);}
 });
 await test('calendar anniversaries, milliseconds and separate caps',async()=>{
  const cases=[['2024-02-29T12:34:56.789Z','2025-02-28T12:34:56.788Z',11,0,0],['2024-02-29T12:34:56.789Z','2025-02-28T12:34:56.789Z',12,4000,2000],['2024-01-31T12:00:00Z','2025-03-30T12:00:00Z',13,4500,2400],['2024-01-01','2026-01-01',24,10000,6800],['2024-01-01','2026-09-01',32,10000,10000],['2024-01-01','2023-12-31',0,0,0]];
  for(const [start,end,months,sbp,ebp] of cases){const id=await offer(shared,{start_date:start,signing_bonus_cents:10001,equity_units:7,equity_fair_cents:100});await success(id,'approve');const x=await success(id,'rescind',{effective_at:end});assert.equal(x.clawback.completed_months,months);assert.equal(x.clawback.vested_bp,sbp);assert.equal(x.equity_grant.cancelled.vested_bp,ebp);assert.equal(x.signing_vested_cents,Number((10001n*BigInt(sbp)+5000n)/10000n));assert.equal(x.equity_vested_units,Number((7n*BigInt(ebp)+5000n)/10000n));}
 });
 await test('referrals use separate dates including future scheduled hire',async()=>{
  for(const [start,expected] of [['2026-02-01T00:00:00Z',1000000],['2026-02-01T00:00:00.001Z',500000],['2026-01-31T12:00:00Z',1000000],['2027-01-01',500000]]){const id=await offer(shared,{start_date:'2026-07-01',referred_by:'EMP-R1',referred_hire_start:start});await success(id,'approve');assert.equal((await get(id)).referral_accrual.vested_cents,expected);}
 });
 await test('competing different hires and each same-target settlement are atomic',async()=>{
  const r=await req(10000),extra={base_salary_cents:6000,signing_bonus_cents:1000,equity_units:1,equity_fair_cents:100,referred_by:'EMP-R1',referred_hire_start:'2026-02-01'};
  const a=await offer(r,extra),b=await offer(r,extra);const responses=await Promise.all([action(a,'approve'),action(b,'approve')]);assert.equal(responses.filter(x=>x.status===200).length,1);const rq=(await call('auditor','GET','/api/requisitions/'+r)).value;assert.equal(rq.headroom_cents,3975);
  let id=await offer(shared,{signing_bonus_cents:101,equity_units:7,equity_fair_cents:100});
  for(const verb of ['approve','revise','rescind']){const body=verb==='revise'?{signing_bonus_cents:103}:verb==='rescind'?{effective_at:'2025-01-01'}:{};const pair=await Promise.all([action(id,verb,body),action(id,verb,body)]);assert.equal(pair.filter(x=>x.status===200).length,1);assert.equal(pair.filter(x=>x.status===409).length,1);if(verb==='revise')id=pair.find(x=>x.status===200).value.revised_offer_id;}
  assert.equal((await get(id)).net_signing_outflow_cents,41);
 });
 await test('all actual operational endpoint families deny anonymous access',async()=>{
  const id=await offer(shared);await success(id,'approve');
  for(const url of ['/api/bootstrap','/api/offers/'+id,'/api/requisitions/'+shared])await refuse('anonymous '+url,()=>call('anonymous','GET',url),401);
  const writes=[['/api/requisitions',{id:'anonymous-req',budget_cents:100}],['/api/offers',{id:'anonymous-offer',req_id:shared,...defaults}],...['approve','revise','rescind'].map(v=>['/api/offers/'+id+'/'+v,v==='rescind'?{effective_at:'2025-01-01'}:{}])];
  for(const [url,body] of writes)await refuse('anonymous '+url,()=>call('anonymous','POST',url,body),401);
 });
 await test('invalid values and derived overflow leave all business records intact',async()=>{
  const id=await offer(shared);await success(id,'approve');
  for(const [key,value] of [['base_salary_cents',-1],['base_salary_cents',.1],['base_salary_cents','1'],['equity_units',1.5],['relocation_cents',9007199254740992]])await refuse('invalid revision '+key+' '+value,()=>action(id,'revise',{[key]:value}),400);
  await refuse('derived multiplication overflow',()=>call('recruiter','POST','/api/offers',{id:'overflow',req_id:shared,...defaults,equity_units:Number.MAX_SAFE_INTEGER,equity_fair_cents:2}),400);
  const valid=await offer(shared,{equity_units:Number.MAX_SAFE_INTEGER,equity_fair_cents:2,equity_strike_cents:2});assert.equal((await get(valid)).composition.equity_units,Number.MAX_SAFE_INTEGER);
  for(const date of ['2025-02-30','nonsense',''])await refuse('invalid rescission date '+date,()=>action(id,'rescind',{effective_at:date}),400);
 });
 await test('body claims cannot replace stored authority or economics',async()=>{
  const id=await offer(shared,{signing_bonus_cents:101,equity_units:7,equity_fair_cents:100});await refuse('forged recruiter authority',()=>action(id,'approve',{role:'approver',authority_tier:3,actor_id:'U-AP3'},'recruiter'),403);
  const x=await success(id,'approve',{actor_id:'forged',role:'auditor',authority_tier:0,committed_run_rate_cents:1,band:'III'});assert.equal(x.composition.committed_run_rate_cents,10175);assert.notEqual(x.approved_by,'forged');const y=await success(id,'rescind',{effective_at:'2025-01-01',clawback_cents:0,cancelled_units:0});assert.equal(y.clawback_cents,61);assert.equal(y.equity_cancelled_units,6);
 });
 await test('process restart preserves exact business state and does not reseed',async()=>{
  await offer(shared,{candidate:'Fresh pending restart control'});const before=economic(await state()),oldPid=server.pid;await stop();await boot();await login('auditor');assert.notEqual(server.pid,oldPid);assert.deepEqual(economic(await state()),before);record('actual local process replacement',{old_pid:oldPid,new_pid:server.pid});
 });
}
main().catch(e=>results.push({name:'suite setup',passed:false,error:e.stack})).finally(async()=>{
 await stop();fs.writeFileSync(path.join(out,'requests.json'),JSON.stringify(trace,null,2));fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({kind:'local HTTP product regressions, not browser or configured judge scores',source,results},null,2));
 console.log(JSON.stringify({out,passed:results.filter(x=>x.passed).length,failed:results.filter(x=>!x.passed)},null,2));if(results.some(x=>!x.passed))process.exitCode=1;
});
