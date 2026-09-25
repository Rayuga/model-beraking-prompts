const fs=require('node:fs');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const model=process.env.MODEL,gpt=model==='gpt',results=[],tokens={};
const config={login:gpt?'/api/signin':'/api/auth/signin',read:gpt?'/api/state':'/api/auth/me',operation:gpt?'opId':'operation_id',revision:gpt?'expectedRevision':'expected_revision'};
async function req(path,who,body){const r=await fetch('http://127.0.0.1:3000'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Connection:'close',...(tokens[who]?{Authorization:'Bearer '+tokens[who]}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const t=await r.text();let data;try{data=JSON.parse(t)}catch{data=t}return {status:r.status,data};}
function values(node,pattern){if(!node||typeof node!=='object')return [];return Object.entries(node).flatMap(([k,v])=>[...(pattern.test(k)?[v]:[]),...values(v,pattern)]);}
async function revision(){const r=await req(config.read,'ada');assert.equal(r.status,200);return values(r.data,/^(revision|current_revision)$/).find(Number.isInteger);}
async function write(path,who,body={}){const before=await revision();const r=await req(path,who,{...body,[config.operation]:randomUUID(),[config.revision]:before});return {...r,revision_before:before,revision_after:await revision()};}
async function record(name,fn){try{results.push({name,...await fn()});}catch(e){results.push({name,error:String(e),passed:null});}fs.writeFileSync('/evidence/'+model+'-reproduction.json',JSON.stringify({model,kind:'Supplementary API reproduction in cached runtime; does not replace platform grades',results},null,2));console.log(model+' '+name+' '+JSON.stringify(results.at(-1)));}
(async()=>{
 for(let i=0;i<100;i++){try{await req('/api/health');break}catch{await new Promise(r=>setTimeout(r,100))}}
 for(const [who,email] of Object.entries({ada:'ada.mensah',luis:'luis.ortega',nora:'nora.kim',ben:'ben.okafor'})){const r=await req(config.login,null,{email:email+'@coursemark.example',password:'Coursemark!2026'});assert.equal(r.status,200);tokens[who]=r.data.token;assert(tokens[who]);}
 if(gpt)await record('fresh_start_with_existing_active_attempt',async()=>{const r=await write('/api/attempts/start','nora',{assessmentId:'A-01'});return {passed:r.status>=400,status:r.status,revision_delta:r.revision_after-r.revision_before,attempt_id:r.data.attempt_id};});
 const submitted=await write('/api/attempts/AT-100/submit','nora');assert.equal(submitted.status,200);
 const path='/api/attempts/AT-100/'+(gpt?'grades':'grade');const grade=value=>gpt?{criterionId:'RC-1',score:value,feedback:'Numeric validation baseline'}:{criterion_id:'RC-1',score:value,feedback:'Numeric validation baseline'};
 await record('numeric_validation_positive_baseline',async()=>{const r=await write(path,'luis',grade(1));return {passed:r.status===200,status:r.status,revision_delta:r.revision_after-r.revision_before};});
 for(const [label,value] of [['missing',undefined],['null',null],['boolean',true],['empty_string',''],['nonnumeric','abc'],['negative',-1],['above_max',4]])await record('reject_score_'+label,async()=>{const r=await write(path,'luis',grade(value));return {passed:r.status>=400&&r.status<500&&r.revision_after===r.revision_before,status:r.status,revision_delta:r.revision_after-r.revision_before};});
 await record('numeric_validation_replacement_control',async()=>{const r=await write(path,'luis',grade(2));return {passed:r.status===200&&r.revision_after===r.revision_before+1,status:r.status,revision_delta:r.revision_after-r.revision_before};});
 if(gpt){
  const draft={title:'Claimed metadata review',opensAt:'2026-09-02T11:00:00Z',dueAt:'2026-09-02T13:00:00Z',durationMinutes:45,maxAttempts:1};
  await record('server_owned_claims_rejected',async()=>{const r=await write('/api/assessments','ada',{...draft,actor_id:'user_4',status:'published',total_score:999,created_at:'2000-01-01T00:00:00Z'});return {passed:r.status>=400,status:r.status,revision_delta:r.revision_after-r.revision_before};});
  await record('objective_only_submission_becomes_releasable',async()=>{const r=await write('/api/assessments','ada',{...draft,title:'Objective review'});assert.equal(r.status,201);const id=r.data.assessment_id;assert.equal((await write('/api/assessments/'+id+'/items','ada',{kind:'multiple_choice',prompt:'Choose a tree',points:3,options:['Oak','Pine'],answer:'Oak'})).status,201);assert((await write('/api/assessments/'+id+'/publish','ada')).status<300);const start=await write('/api/attempts/start','ben',{assessmentId:id});const at=start.data.attempt_id;assert(at);assert.equal((await write('/api/attempts/'+at+'/submit','ben')).status,200);const release=await write('/api/attempts/'+at+'/release','ada');return {passed:release.status<300,status:release.status,error:release.data.error,message:release.data.message};});
 }
})().catch(e=>{console.error(e);process.exitCode=1});
