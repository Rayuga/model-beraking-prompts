'use strict';
// Local disposable source mutations and actual HTTP observations, NOT browser/LLM grades.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),net=require('net');
const {spawn}=require('child_process');
const root=path.resolve(__dirname,'..');
const task=path.join(root,'projects/hireops-recruiting-operations/hireops-recruiting-operations');
const source=path.join(task,'solution/app');
const node=path.join(root,'.tools/hireops/node.exe');
const stamp=new Date().toISOString().replace(/[:.]/g,'-');
const scratch=path.join(root,'.tools/hireops/witnesses',stamp);
const output=path.join(root,'qc/runs/hireops-2026-09-30-development/witnesses',stamp);
fs.mkdirSync(scratch,{recursive:true});fs.mkdirSync(output,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
function manifest(dir){const m={};function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){const f=path.join(p,e.name);if(e.isDirectory())walk(f);else m[path.relative(dir,f).replaceAll('\\','/')]=hash(fs.readFileSync(f));}}walk(dir);return m;}
const sourceBefore=manifest(source);const inputHash=hash(JSON.stringify(sourceBefore));
const save=(p,v)=>fs.writeFileSync(p,JSON.stringify(v,null,2)+'\n');
function mutate(dir,file,old,next){const p=path.join(dir,file),s=fs.readFileSync(p,'utf8');if(s.split(old).length!==2)throw new Error('Mutation anchor count must be exactly1: '+file+' '+old);fs.writeFileSync(p,s.replace(old,next));return {file,before_sha256:hash(s),after_sha256:hash(fs.readFileSync(p)),removed:old,inserted:next};}
const variants=[
{name:'golden',mutation:null},
{name:'budget_disabled',mutation:['src/index.js','if (rate > available) reject(','if (false && rate > available) reject(']},
{name:'runrate_includes_bonus',mutation:['src/rules.js','function committedRunRateCents(o) { return sumSafe(o.base_salary_cents, equityAnnualizedCents(o)); }','function committedRunRateCents(o) { return sumSafe(o.base_salary_cents, o.signing_bonus_cents, equityAnnualizedCents(o)); }']},
{name:'equity_gross',mutation:['src/rules.js','BigInt(Math.max(0, o.equity_fair_cents - o.equity_strike_cents))','BigInt(o.equity_fair_cents)']},
{name:'referral_offer_clock',mutation:['src/index.js','const rv = R.referralVested(ra, now());',"const original = one('SELECT * FROM offers WHERE id=?', ra.offer_id); const rv = R.referralVested({ ...ra, referred_hire_start: original.start_date }, now());"]},
{name:'dead_approval',mutation:['src/index.js',"app.post('/api/offers/:id/approve', auth('approver'), (req, res) => {","app.post('/api/offers/:id/approve', auth('approver'), (req, res) => { return res.status(409).json({error:'approval disabled'});"]},
];
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function port(){return await new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});}
async function test(v){
 const dir=path.join(scratch,v.name);fs.cpSync(source,dir,{recursive:true});
 const copied=manifest(dir);if(JSON.stringify(copied)!==JSON.stringify(sourceBefore))throw new Error('Source drift during copy');
 const modification=v.mutation?mutate(dir,...v.mutation):null;
 const p=await port(),origin='http://127.0.0.1:'+p,db=path.join(dir,'witness.db');
 const child=spawn(node,[path.join(dir,'server.js')],{cwd:dir,windowsHide:true,env:{...process.env,NODE_PATH:path.join(root,'.tools/hireops/node_modules'),DB_PATH:db,PORT:String(p)},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);let spawnError;child.on('error',e=>spawnError=e);
 const requests=[],cookies={};
 async function call(role,method,url,body,record=true){
  const r=await fetch(origin+url,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(cookies[role]?{Cookie:cookies[role]}:{})},body:body?JSON.stringify(body):undefined});
  const text=await r.text();let data;try{data=JSON.parse(text);}catch{data={non_json:true};}
  if(record)requests.push({role,method,path:url,request_body:body,response_status:r.status,response:data});
  return {status:r.status,data,headers:r.headers};
 }
 async function login(role,email){const r=await call(role,'POST','/api/auth/login',{email,password:'Hireops!2026'},false);if(r.status!==200)throw new Error('Demo login failed:'+role);cookies[role]=r.headers.get('set-cookie').split(';')[0];}
 async function req(id,budget){return await call('recruiter','POST','/api/requisitions',{id,title:id,dept:'Witness',budget_cents:budget});}
 const defaults={candidate:'Local witness candidate',base_salary_cents:10000,signing_bonus_cents:0,relocation_cents:0,equity_units:0,equity_fair_cents:0,equity_strike_cents:0,start_date:'2024-01-01T00:00:00Z'};
 async function offer(id,req_id,extra={}){return await call('recruiter','POST','/api/offers',{id,req_id,...defaults,...extra});}
 async function approve(id){return await call('approver','POST','/api/offers/'+encodeURIComponent(id)+'/approve',{});}
 async function read(id){return (await call('recruiter','GET','/api/offers/'+encodeURIComponent(id))).data;}
 try{
  let ready=false;for(let n=0;n<80;n++){if(spawnError)throw spawnError;try{if((await fetch(origin+'/api/health')).ok){ready=true;break;}}catch{}await sleep(100);}if(!ready)throw new Error('App failed to start');
  await login('recruiter','rafael.costa@hireops.example');await login('approver','yuki.tanaka@hireops.example');await login('finance','farah.nasser@hireops.example');
  await req('W-BUD',10000000);
  await offer('W-FIT','W-BUD',{base_salary_cents:8000000});const fit=await approve('W-FIT');
  const fitState=await read('W-FIT');const repeated=await approve('W-FIT');
  await offer('W-OVER','W-BUD',{base_salary_cents:3000000});const over=await approve('W-OVER');
  const budget=(await call('recruiter','GET','/api/requisitions/W-BUD')).data;
  await req('W-OTHER',100000000);
  await offer('W-MATH','W-OTHER',{signing_bonus_cents:2000,equity_units:10,equity_fair_cents:200,equity_strike_cents:100});
  const math=await read('W-MATH');const mathApproval=await approve('W-MATH');
  let chain=false;
  if(mathApproval.status===200){
   const prior=await read('W-MATH');
   const rev=await call('recruiter','POST','/api/offers/W-MATH/revise',{base_salary_cents:11000,equity_units:15});
   if(rev.status===200){const old=await read('W-MATH'),next=await read(rev.data.revised_offer_id);
    chain=old.status==='SUPERSEDED'&&next.status==='COMMITTED'&&old.superseded_by_id===next.id&&next.supersedes_id===old.id
      &&old.composition.base_salary_cents===prior.composition.base_salary_cents&&old.composition.equity_units===10
      &&next.composition.base_salary_cents===11000&&next.composition.equity_units===15
      &&old.equity_grant.units===10&&old.equity_grant.state==='SUPERSEDED'&&next.equity_grant.units===15;
   }
  }
  await offer('W-REF','W-OTHER',{signing_bonus_cents:2000,start_date:'2026-07-01T00:00:00Z',referred_by:'EMP-R1',referred_hire_start:'2026-02-01T00:00:00Z'});
  const refApproval=await approve('W-REF');let referral=false,payment=false;
  if(refApproval.status===200){
   const before=await read('W-REF');referral=before.referral_accrual.vested_cents===1000000;
   const r=await call('finance','POST','/api/offers/W-REF/rescind',{effective_at:'2027-07-01T00:00:00Z'});
   const settled=await read('W-REF');payment=r.status===200&&settled.clawback.clawback_cents===1200&&settled.net_signing_outflow_cents===800;
  }
  const vector={
   approval_positive_control:fit.status===200&&fitState.status==='COMMITTED',
   raw_overrun_refusal:over.status>=400,
   budget_with_positive_control:fit.status===200&&fitState.status==='COMMITTED'&&over.status>=400&&budget.headroom_cents===2000000,
   raw_repeated_refusal:repeated.status>=400,
   stale_with_positive_control:fit.status===200&&fitState.status==='COMMITTED'&&repeated.status>=400,
   intrinsic_correct:math.composition.equity_intrinsic_cents===1000,
   runrate_correct:math.composition.committed_run_rate_cents===10250,
   band_basis_independent_correct:math.composition.band_basis_cents===11250,
   revision_history_preserved:chain,
   referral_own_clock_correct:referral,
   signing_settlement_correct:payment
  };
  const result={variant:v.name,source_sha256:inputHash,mutation:modification,mutated_source_files:manifest(dir),vector,observations:{budget_headroom_cents:budget.headroom_cents,math_composition:math.composition},requests,scope:'Actual local HTTP product outcomes on fresh disposable app+DB; no browser judge, synthetic reward, score or LLM claim'};
  // Database created after startup is not part of mutated source manifest.
  for(const name of Object.keys(result.mutated_source_files))if(name.startsWith('witness.db'))delete result.mutated_source_files[name];
  save(path.join(output,v.name+'.json'),result);return result;
 }finally{
  child.kill();await Promise.race([new Promise(r=>child.once('exit',r)),sleep(3000)]);
  if(child.exitCode===null)child.kill('SIGKILL');
  fs.writeFileSync(path.join(output,v.name+'-process.log'),logs);
 }
}
(async()=>{
 const results=[];for(const v of variants)results.push(await test(v));
 const expected={
 golden:{approval_positive_control:true,budget_with_positive_control:true,intrinsic_correct:true,runrate_correct:true,band_basis_independent_correct:true,revision_history_preserved:true,referral_own_clock_correct:true,signing_settlement_correct:true,stale_with_positive_control:true},
 budget_disabled:{approval_positive_control:true,budget_with_positive_control:false,runrate_correct:true,revision_history_preserved:true},
 runrate_includes_bonus:{runrate_correct:false,band_basis_independent_correct:true,revision_history_preserved:true},
 equity_gross:{intrinsic_correct:false,revision_history_preserved:true,signing_settlement_correct:true},
 referral_offer_clock:{referral_own_clock_correct:false,signing_settlement_correct:true,revision_history_preserved:true},
 dead_approval:{approval_positive_control:false,raw_overrun_refusal:true,budget_with_positive_control:false,raw_repeated_refusal:true,stale_with_positive_control:false}
 };
 const comparisons=results.map(r=>({variant:r.variant,expected:expected[r.variant],observed:r.vector,matches:Object.entries(expected[r.variant]).every(([k,v])=>r.vector[k]===v)}));
 const unchanged=JSON.stringify(manifest(source))===JSON.stringify(sourceBefore);
 const summary={source_sha256:inputHash,source_files:sourceBefore,canonical_source_unchanged:unchanged,expected_observed:comparisons,all_expected_distinctions_observed:unchanged&&comparisons.every(x=>x.matches),scope:'Finite local actual-source mutation witnesses only. Not configured-judge reward discrimination/ranking evidence; no scores computed.',artifacts:fs.readdirSync(output).map(f=>({path:f,sha256:hash(fs.readFileSync(path.join(output,f)))}))};
 save(path.join(output,'SUMMARY.json'),summary);
 console.log(JSON.stringify({output:path.relative(root,output),...summary,source_files:undefined,artifacts:undefined},null,2));
 if(!summary.all_expected_distinctions_observed)process.exitCode=1;
})().catch(e=>{save(path.join(output,'ERROR.json'),{error:e.stack,source_sha256:inputHash});console.error(e.stack);process.exitCode=1;});

