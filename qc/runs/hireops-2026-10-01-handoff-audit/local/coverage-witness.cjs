'use strict';
// Real HTTP observations on disposable variants; not configured judge scores.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert/strict');
const {spawn}=require('child_process');
const source='/solution/app',out='/evidence/coverage-witness';fs.mkdirSync(out,{recursive:true});
const sourceHash=crypto.createHash('sha256').update(fs.readFileSync(source+'/src/index.js')).digest('hex');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const claims={claimedActorId:'U-AP3',claimedRole:'recruiter',claimedTier:3,claimedBand:'III',claimedCommittedCents:1,claimedClawbackCents:0,claimedCancelledUnits:0};
const report=[];
async function variant(name){
 const dir='/tmp/hireops-coverage-'+name;fs.cpSync(source,dir,{recursive:true});
 const file=dir+'/src/index.js';let code=fs.readFileSync(file,'utf8'),mutation=null;
 if(name==='stale_grant_prices')mutation=['o.equity_strike_cents, o.equity_fair_cents, o.start_date,','1, 102, o.start_date,'];
 if(name==='forged_revision_role')mutation=['const u = currentUser(req);\n    if (!u)',"const u = currentUser(req);\n    if (u && req.path.endsWith('/revise') && req.body.claimedRole) u.role = req.body.claimedRole;\n    if (!u)"];
 if(mutation){assert.equal(code.split(mutation[0]).length,2);code=code.replace(...mutation);fs.writeFileSync(file,code);}
 const proc=spawn('node',[dir+'/server.js'],{env:{...process.env,PORT:'3055',DB_PATH:dir+'/app.db'},stdio:['ignore','pipe','pipe']});let log='';proc.stdout.on('data',b=>log+=b);proc.stderr.on('data',b=>log+=b);
 const base='http://localhost:3055';const cookies={};const calls=[];
 async function call(role,url,body){const r=await fetch(base+url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(cookies[role]?{cookie:cookies[role]}:{})},body:body?JSON.stringify(body):undefined});const v=await r.json();calls.push({role,url,status:r.status,body,value:v});return {status:r.status,value:v,headers:r.headers};}
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/health')).ok)break;}catch{}await sleep(100);}
  for(const [role,email] of Object.entries({r:'rafael.costa',a:'yuki.tanaka',f:'farah.nasser',u:'aud.halvorsen'})){const x=await call(role,'/api/auth/login',{email:email+'@hireops.example',password:'Hireops!2026'});assert.equal(x.status,200);cookies[role]=x.headers.get('set-cookie').split(';')[0];}
  const req=await call('u','/api/requisitions',{id:'cover-req',title:'Coverage control',dept:'Engineering',budget_cents:10000000,...claims});assert.equal(req.status,200);
  const create=await call('r','/api/offers',{id:'cover-off',req_id:'cover-req',candidate:'Coverage control',base_salary_cents:10000,signing_bonus_cents:101,relocation_cents:0,equity_units:7,equity_fair_cents:102,equity_strike_cents:1,start_date:'2024-02-29T12:34:56.789Z',...claims});assert.equal(create.status,200);
  const approved=await call('a','/api/offers/cover-off/approve',{});assert.equal(approved.status,200);
  const revised=await call('r','/api/offers/cover-off/revise',{base_salary_cents:11000,signing_bonus_cents:103,equity_units:11,equity_fair_cents:203,equity_strike_cents:2,...claims});assert.equal(revised.status,200);
  const id=revised.value.revised_offer_id,after=(await call('u','/api/offers/'+encodeURIComponent(id))).value;
  const forged=await call('u','/api/offers/'+encodeURIComponent(id)+'/revise',{base_salary_cents:12000,...claims});
  const facts={claimed_requisition_create_accepted:req.status===200,claimed_offer_create_accepted:create.status===200,claimed_revision_accepted:revised.status===200,revised_offer_prices_correct:after.composition.equity_fair_cents===203&&after.composition.equity_strike_cents===2,replacement_grant_prices_correct:after.equity_grant.fair_cents===203&&after.equity_grant.strike_cents===2,replacement_units_correct:after.equity_grant.units===11,forged_auditor_revision_refused:forged.status===403};
  const current=forged.status===200?forged.value.revised_offer_id:id;
  const rescinded=await call('f','/api/offers/'+encodeURIComponent(current)+'/rescind',{effective_at:'2025-02-28T12:34:56.789Z',...claims});facts.claimed_rescission_accepted=rescinded.status===200;
  const final=(await call('u','/api/bootstrap')).value;const receipt=final.after_images.find(x=>x.offer_id===current&&x.action==='RESCIND');facts.rescission_actor_is_finance=receipt.figures.actor_name==='Farah Nasser';
  const record={variant:name,mutation,facts,requests:calls};fs.writeFileSync(out+'/'+name+'.json',JSON.stringify(record,null,2));report.push({variant:name,facts});
 }finally{proc.kill();await new Promise(r=>proc.once('exit',r));fs.writeFileSync(out+'/'+name+'.log',log);}
}
(async()=>{for(const v of ['golden','stale_grant_prices','forged_revision_role'])await variant(v);
 assert.ok(Object.values(report[0].facts).every(Boolean));assert.equal(report[1].facts.replacement_grant_prices_correct,false);assert.equal(report[1].facts.revised_offer_prices_correct,true);assert.equal(report[2].facts.forged_auditor_revision_refused,false);
 assert.equal(crypto.createHash('sha256').update(fs.readFileSync(source+'/src/index.js')).digest('hex'),sourceHash);
 const result={scope:'Finite real HTTP coverage counterexamples, no browser/LLM grade or reward prediction',source_index_sha256:sourceHash,source_unchanged:true,results:report};fs.writeFileSync(out+'/results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
