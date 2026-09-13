const assert=require('node:assert/strict');
const fs=require('node:fs');
const {spawn}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const original=fs.readFileSync('/source/solution/backend/server.js','utf8');
const root=fs.mkdtempSync('/tmp/pellmoor-mutations-');
fs.copyFileSync('/source/solution/backend/rules.js',root+'/rules.js');
let child,tokens={};const results=[];
async function req(method,path,body,who='r'){
 const response=await fetch('http://127.0.0.1:3100'+path,{method,headers:{'Content-Type':'application/json',Connection:'close',...(tokens[who]?{Authorization:'Bearer '+tokens[who]}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 return {status:response.status,data:await response.json()};
}
async function stop(){if(child&&child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended;}}
async function start(code,db){
 fs.writeFileSync(root+'/server.js',code);tokens={};
 child=spawn('node',[root+'/server.js'],{env:{...process.env,PORT:'3100',DB_PATH:db,SEED_PATH:'/source/tests/pellmoor_seed_data.json'},stdio:['ignore','ignore','pipe']});
 let errors='';child.stderr.on('data',d=>errors+=d);
 for(let i=0;i<100;i++){try{if((await req('GET','/api/health')).status===200)break;}catch{}if(child.exitCode!==null)throw Error(errors);await new Promise(r=>setTimeout(r,50));}
 for(const [who,email] of [['r','hiring'],['c','coord'],['o','panel1'],['w','panel2']])tokens[who]=(await req('POST','/api/login',{email:email+'@pellmoor.test',password:'password123'})).data.token;
}
async function cand(id){return (await req('GET','/api/candidates/'+id)).data;}
async function mutation(who,id,kind,body){const c=await cand(id);const payload={...body,expected_revision:c.revision,operation_id:randomUUID()};const result=await req('POST',`/api/candidates/${id}/${kind}`,payload,who);return {...result,body:payload};}
function replace(code,a,b){assert(code.includes(a),a);return code.replace(a,b);}
const probes=[
 {name:'Panel edits must invalidate retained-member scores',mutate:c=>replace(c,'SET assessment_version=assessment_version+1 WHERE id=?','SET assessment_version=assessment_version WHERE id=?'),probe:async()=>{
  assert.equal((await mutation('c','CAND-101','panel',{member:'hiring@pellmoor.test'})).status,201);
  const c=await cand('CAND-101');return c.scores.length===0&&c.historical_scores.some(x=>x.panel_member==='panel1@pellmoor.test'&&x.score===4);
 }},
 {name:'Reopening must invalidate the complete prior assessment',mutate:c=>replace(c,"(to === 'interview' ? 1 : 0)",'0'),probe:async()=>{
  assert.equal((await mutation('r','CAND-106','stage',{stage:'interview'})).status,200);const c=await cand('CAND-106');return c.scores.length===0&&c.candidate.assessment_version===2;
 }},
 {name:'Full vacancy rejects a fresh fully assessed offer',mutate:c=>replace(c,"if (to === 'offer' && fresh.stage === 'interview' && capacityOf(fresh.role).available < 1)",'if (false)'),probe:async()=>{
  for(const stage of ['screening','interview'])assert.equal((await mutation('r','CAND-105','stage',{stage})).status,200);
  for(const member of ['panel1@pellmoor.test','panel2@pellmoor.test'])assert.equal((await mutation('c','CAND-105','panel',{member})).status,201);
  for(const who of ['o','w'])assert.equal((await mutation(who,'CAND-105','score',{score:4})).status,201);
  return (await mutation('r','CAND-105','stage',{stage:'offer'})).status===409;
 }},
 {name:'Reordered JSON keys preserve receipt identity',mutate:c=>replace(c,'body: canonical(request.body)','body: request.body'),probe:async()=>{
  const saved=await mutation('w','CAND-106','notes',{body:'Reordered'});assert.equal(saved.status,201);
  const replay=await req('POST','/api/candidates/CAND-106/notes',Object.fromEntries(Object.entries(saved.body).reverse()),'w');return replay.status===201&&JSON.stringify(replay.data)===JSON.stringify(saved.data);
 }},
 {name:'Different actors can independently reuse an operation id',mutate:c=>replace(c,'FROM mutation_receipts WHERE actor=? AND operation_id=?)','unused'),probe:async()=>{}},
 {name:'Receipts survive a process restart',mutate:c=>replace(c,'bootstrap();',"bootstrap();\ndb.prepare('DELETE FROM mutation_receipts').run();"),probe:async(code,db)=>{
  const saved=await mutation('w','CAND-106','notes',{body:'Persisted'});assert.equal(saved.status,201);await stop();await start(code,db);
  const replay=await req('POST','/api/candidates/CAND-106/notes',saved.body,'w');return replay.status===201&&JSON.stringify(replay.data)===JSON.stringify(saved.data);
 }}
];
probes[4].mutate=c=>replace(c,'FROM mutation_receipts WHERE actor=? AND operation_id=?`)\n    .get(request.person.email, metadata.operationId);','FROM mutation_receipts WHERE operation_id=?`)\n    .get(metadata.operationId);');
probes[4].probe=async()=>{
 const saved=await mutation('w','CAND-106','notes',{body:'Wren'});assert.equal(saved.status,201);const c=await cand('CAND-106');
 const other=await req('POST','/api/candidates/CAND-106/notes',{...saved.body,body:'Otis',expected_revision:c.revision},'o');return other.status===201&&other.data.note.author==='panel1@pellmoor.test';
};
(async()=>{
 for(let i=0;i<probes.length;i++){
  const p=probes[i];const baselineDb=root+`/baseline-${i}.db`;await start(original,baselineDb);assert.equal(await p.probe(original,baselineDb),true,p.name+' baseline');await stop();
  const mutant=p.mutate(original),db=root+`/mutant-${i}.db`;await start(mutant,db);const accepted=await p.probe(mutant,db);await stop();assert.equal(accepted,false,p.name+' mutant escaped');
  results.push({name:p.name,baseline_passed:true,mutant_detected:true});console.log('PASS baseline and detected mutant: '+p.name);
 }
 fs.writeFileSync('/evidence/mutation-probes.json',JSON.stringify({kind:'Local HTTP fault probes, not platform judge or target-model scores',results},null,2));
})().catch(async e=>{console.error(e);await stop();process.exitCode=1;});
