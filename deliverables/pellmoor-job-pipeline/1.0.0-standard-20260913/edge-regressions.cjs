const assert=require('node:assert/strict');
const fs=require('node:fs');
const {randomUUID}=require('node:crypto');
const tokens={};const findings=[];
async function req(method,path,body,who='r'){
 const response=await fetch('http://127.0.0.1:3000'+path,{method,headers:{'Content-Type':'application/json','Connection':'close',...(tokens[who]?{Authorization:'Bearer '+tokens[who]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
async function snap(role){return (await req('GET','/api/roles/'+role)).data;}
async function move(id,role,stage){const s=await snap(role);const x=await req('POST',`/api/candidates/${id}/stage`,{stage,operation_id:randomUUID(),expected_revision:s.revision});assert.equal(x.status,200,JSON.stringify(x));}
(async()=>{
 for(const [key,email] of [['r','hiring'],['c','coord'],['o','panel1']])tokens[key]=(await req('POST','/api/login',{email:email+'@pellmoor.test',password:'password123'})).data.token;
 const before=await snap('ROLE-014');
 const invalid=await req('POST','/api/candidates/CAND-101/score',{score:true,operation_id:randomUUID(),expected_revision:before.revision},'o');
 assert.deepEqual(await snap('ROLE-014'),before);
 findings.push({name:'Boolean score rejected without a server error',actual_status:invalid.status,passed:invalid.status>=400&&invalid.status<500});
 const role='ROLE-017';const baseline=await snap(role);
 const created=await req('POST','/api/candidates',{role,name:'Backstep regression '+randomUUID(),operation_id:randomUUID(),expected_revision:baseline.revision},'c');assert.equal(created.status,201);
 const id=created.data.candidate.id;
 for(const stage of ['screening','interview','screening','withdrawn'])await move(id,role,stage);
 const current=await snap(role);
 const delta=current.funnel.map((r,i)=>r.left-baseline.funnel[i].left);
 findings.push({name:'Terminal loss after a legal backstep belongs to the exit stage',actual_loss_delta:delta,expected:[0,1,0,0,0],passed:JSON.stringify(delta)==='[0,1,0,0,0]'});
 fs.writeFileSync('/evidence/edge-regressions.json',JSON.stringify({findings},null,2));console.log(JSON.stringify(findings));
})().catch(e=>{console.error(e);process.exitCode=1});
