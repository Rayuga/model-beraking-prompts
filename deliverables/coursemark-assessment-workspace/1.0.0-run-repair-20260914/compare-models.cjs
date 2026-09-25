const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const model=process.env.MODEL;
const golden=model==='oracle';
const gpt=model==='gpt';
const haiku=model==='haiku';
const config={login:golden?'/api/auth/login':gpt?'/api/signin':'/api/auth/signin',logout:golden?'/api/auth/logout':gpt?'/api/signout':'/api/auth/signout',course:golden?'/api/me':'/api/courses/BIO-214',revision:golden||model==='gemini'?'expected_revision':'expectedRevision',operation:golden||model==='gemini'?'operation_id':'operationId',create:gpt?'/api/courses/BIO-214/assessments/drafts':haiku?'/api/courses/BIO-214/assessments':'/api/assessments'};
const tokens={},results=[];
const email={ada:'ada.mensah',luis:'luis.ortega',nora:'nora.kim',ben:'ben.okafor'};
async function req(path,who='ada',body,method){
 const r=await fetch('http://127.0.0.1:3000'+path,{method:method||(body===undefined?'GET':'POST'),headers:{'Content-Type':'application/json',Connection:'close',...(tokens[who]?{Authorization:'Bearer '+tokens[who]}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});const text=await r.text();let data;try{data=JSON.parse(text)}catch{data=text}return {status:r.status,data};
}
function values(node,key){if(!node||typeof node!=='object')return [];return Object.entries(node).flatMap(([k,v])=>[...(key.test(k)?[v]:[]),...values(v,key)]);}
function byId(node,id){if(!node||typeof node!=='object')return null;if(node.id===id)return node;for(const v of Object.values(node)){const found=byId(v,id);if(found)return found;}return null;}
async function revision(){const x=await req(config.course);const found=values(x.data,/^(revision|currentRevision|current_revision)$/).find(v=>Number.isInteger(v));if(found===undefined)throw Error('No revision in '+JSON.stringify(x));return found;}
async function write(path,who,body={},method='POST',metadata={}){const payload={...body,[config.revision]:await revision(),[config.operation]:randomUUID(),...metadata};const r=await req(path,who,payload,method);return {...r,body:payload,path,method};}
async function attempt(id,who='ada'){return req(golden?'/api/attempts':'/api/attempts/'+id,who).then(x=>golden?{status:x.status,data:byId(x.data,id)}:x);}
function draft(title){return gpt?{title,opensAt:'2026-09-03T09:00:00Z',dueAt:'2026-09-03T11:00:00Z',durationMinutes:25,maxAttempts:2}:{course_id:'BIO-214',title,opens_at:'2026-09-03T09:00:00Z',due_at:'2026-09-03T11:00:00Z',duration_minutes:25,max_attempts:2};}
function grade(score,criterion='RC-3'){return gpt?{grades:[{criterionId:criterion,score,feedback:'Probe feedback'}]}:haiku?{item_id:'I-04',criterion_id:criterion,points:score,feedback:'Probe feedback'}:golden?{score,feedback:'Probe feedback'}:{criterion_id:criterion,score,feedback:'Probe feedback',course_id:'BIO-214'};}
function gradePath(criterion='RC-3'){return golden?'/api/attempts/AT-101/grades/'+criterion:'/api/attempts/AT-101/'+(model==='gemini'?'grades':'grade');}
async function record(name,fn){try{const result=await fn();results.push({name,...result});}catch(e){results.push({name,passed:null,error:String(e)});}fs.writeFileSync('/evidence/'+model+'-comparison.json',JSON.stringify({model,kind:'Local API reproduction against exported source, not platform criterion scores',results},null,2));console.log(model+' '+name+' '+JSON.stringify(results.at(-1)));}
(async()=>{
 for(let i=0;i<100;i++){try{await req('/api/health','none');break}catch{await new Promise(r=>setTimeout(r,100));}}
 await record('wrong_password_and_anonymous_reads',async()=>{
  const bad=await req(config.login,'none',{email:email.ada+'@coursemark.example',password:'wrong-pass-47'});const anon=await req(config.course,'none');return {passed:bad.status>=400&&anon.status>=400,bad_status:bad.status,anonymous_status:anon.status};
 });
 await record('four_accounts_issue_distinct_bearer_tokens',async()=>{
  for(const who of Object.keys(email)){const x=await req(config.login,'none',{email:email[who]+'@coursemark.example',password:'Coursemark!2026'});if(x.status!==200||!x.data.token)throw Error(who+' login '+JSON.stringify(x));tokens[who]=x.data.token;}
  return {passed:new Set(Object.values(tokens)).size===4&&Object.values(tokens).every(x=>x.length>=32)};
 });
 await record('students_do_not_receive_keys_in_active_attempt',async()=>{
  const x=await attempt('AT-100','nora');const leaked=values(x.data,/^(answer|answer_text|correct_answer|answerKey)$/).filter(x=>typeof x==='string'&&x.length);return {passed:x.status===200&&leaked.length===0,key_values:leaked};
 });
 await record('student_cannot_read_other_students_attempt',async()=>{const x=await attempt('AT-101','nora');return {passed:golden?x.data===null:x.status>=400,status:x.status};});
 await record('expired_attempt_settled_once_at_fixed_reference',async()=>{
  await attempt('AT-103','ben');const x=await attempt('AT-103');const obj=byId(x.data,'AT-103')||x.data.attempt||x.data;
  const at=values(obj,/^(submitted_at|submittedAt)$/)[0];const score=values(obj,/^(objective_score|objectiveScore)$/)[0];return {passed:obj.status!=='in_progress'&&Date.parse(at)===Date.parse('2026-09-02T12:00:00Z')&&score===5,status:obj.status,submitted_at:at,objective_score:score};
 });
 await record('boolean_revision_does_not_authorize_a_write',async()=>{
  const before=await revision();if(before!==1)return {passed:null,reason:'boolean probe requires revision 1',revision:before};
  const x=await write(config.create,'ada',draft('Boolean revision probe'),'POST',{[config.revision]:true});const after=await revision();return {passed:x.status>=400&&after===before,status:x.status,revision_before:before,revision_after:after};
 });
 let receipt;
 await record('create_draft_success_and_exact_replay',async()=>{
  const before=await revision();receipt=await write(config.create,'ada',draft('Receipt baseline'));const after=await revision();const replay=await req(receipt.path,'ada',receipt.body,receipt.method);return {passed:receipt.status>=200&&receipt.status<300&&after===before+1&&replay.status===receipt.status&&JSON.stringify(replay.data)===JSON.stringify(receipt.data)&&await revision()===after,status:receipt.status};
 });
 await record('receipt_cannot_cross_actor_authorization',async()=>{const before=await revision();const x=await req(receipt.path,'nora',receipt.body,receipt.method);return {passed:x.status>=400&&await revision()===before,status:x.status,leaked_draft:JSON.stringify(x.data).includes('Receipt baseline')};});
 await record('receipt_is_bound_to_route',async()=>{const before=await revision();const x=await req('/api/assessments/A-02/publish','ada',receipt.body,'POST');return {passed:x.status>=400&&x.status<500&&await revision()===before,status:x.status};});
 await record('invalid_calendar_dates_rejected',async()=>{const before=await revision();const body=draft('Invalid date');body[gpt?'opensAt':'opens_at']='not-a-date';const x=await write(config.create,'ada',body);return {passed:x.status>=400&&x.status<500&&await revision()===before,status:x.status};});
 await record('valid_rubric_save_positive_control',async()=>{const x=await write(gradePath(),'luis',grade(1),golden?'PUT':'POST');return {passed:x.status<300,status:x.status,body:x.status>=300?x.data:undefined};});
 for(const [label,value] of [['null',null],['boolean',true],['empty_string',''],['over_max',3]])await record('rubric_rejects_'+label,async()=>{
  const before=await revision();const x=await write(gradePath(),'luis',grade(value),golden?'PUT':'POST');return {passed:x.status>=400&&x.status<500&&await revision()===before,status:x.status,revision_delta:(await revision())-before};
 });
 await record('complete_rubric_derives_total_4_5',async()=>{
  const one=await write(gradePath(),'luis',grade(2),golden?'PUT':'POST');const two=await write(gradePath('RC-4'),'luis',grade(2.5,'RC-4'),golden?'PUT':'POST');const x=await attempt('AT-101');const totals=values(x.data,/^(total_score|totalScore|total_points|total)$/);const objective=values(x.data,/^(objective_score|objectiveScore)$/)[0];const rubric=values(x.data,/^(rubric_score|rubricScore)$/)[0];return {passed:one.status<300&&two.status<300&&(totals.includes(4.5)||(objective===0&&rubric===4.5)),statuses:[one.status,two.status],totals,objective,rubric};
 });
 await record('submitted_score_is_private_in_write_response',async()=>{
  const x=await write('/api/attempts/AT-100/submit','nora',{});const direct={...x.data};delete direct.workspace;delete direct.snapshot;
  const scores=values(direct,/^(objective_score|objectiveScore|rubric_score|rubricScore|total_score|totalScore)$/).filter(v=>typeof v==='number');return {passed:x.status<300&&scores.length===0,status:x.status,leaked_scores:scores};
 });
 await record('unreleased_scores_are_private_in_audit',async()=>{
  const path=gpt?'/api/courses/BIO-214':haiku?'/api/courses/BIO-214/audit':'/api/audit';const x=await req(path,'nora');let events=gpt?x.data.audit:x.data.events||x.data.audit||x.data;
  if(!Array.isArray(events))throw Error('Audit shape '+JSON.stringify(x.data));events=events.filter(e=>(e.attemptId||e.attempt_id||e.entity_id||e.target_id)==='AT-100');
  const scores=values(events,/^(objective_score|objectiveScore|rubric_score|rubricScore|total_score|totalScore)$/).filter(v=>typeof v==='number');return {passed:events.length?scores.length===0:null,leaked_scores:scores,event_count:events.length};
 });
 await record('course_actions_keep_fixed_reference_time',async()=>{
  const x=await attempt('AT-100');const obj=byId(x.data,'AT-100')||x.data.attempt||x.data;const submitted=values(obj,/^(submitted_at|submittedAt)$/)[0];return {passed:Date.parse(submitted)===Date.parse('2026-09-02T12:00:00Z'),submitted_at:submitted};
 });
 await record('logout_revokes_both_sessions',async()=>{
  const second=await req(config.login,'none',{email:email.nora+'@coursemark.example',password:'Coursemark!2026'});tokens.second=second.data.token;
  const out=await req(config.logout,'nora',{});const old=await req(config.course,'second');return {passed:out.status<300&&old.status===401,status:old.status};
 });
})().catch(e=>{console.error(e);process.exitCode=1;});
