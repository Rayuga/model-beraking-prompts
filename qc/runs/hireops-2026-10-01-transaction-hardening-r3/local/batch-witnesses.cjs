'use strict';
// Finite local counterexamples, not model judging or empirical reward scores.
const fs=require('fs'),assert=require('assert/strict'),{spawnSync}=require('child_process'),crypto=require('crypto');
const out='/evidence/batch-witnesses';fs.mkdirSync(out,{recursive:true});const results=[];
const cases=['golden','balance_only_version','no_cached_receipt','sequential_budget','empty_operational_seed'];
for(const name of cases){
 const dir='/tmp/witness-'+name;fs.cpSync('/solution',dir,{recursive:true});
 const p=dir+'/app/src/change-sets.js';let s=fs.readFileSync(p,'utf8');
 if(name==='balance_only_version')s=s.replace("return String(one('SELECT COALESCE(MAX(id),0) AS version FROM commitment_movements WHERE req_id=?', reqId).version);","return String(R.headroom(db,reqId).headroom_cents);");
 if(name==='no_cached_receipt')s=s.replace("if (row.state === 'COMMITTED') return publicRow(row);",'/* deliberately revalidates a settled operation */');
 if(name==='sequential_budget')s=s.replace('touch(o.req_id).deltas.push(before.composition.committed_run_rate_cents);',"if (touch(m.destination_req_id).before_headroom_cents + (o.req_id===m.destination_req_id ? before.composition.committed_run_rate_cents : 0) < comp.committed_run_rate_cents) reject('Sequential budget check refuses netted cycle',409);\n      touch(o.req_id).deltas.push(before.composition.committed_run_rate_cents);");
 fs.writeFileSync(p,s);
 if(name==='empty_operational_seed'){
  const path=dir+'/app/src/seed_data.json',seed=JSON.parse(fs.readFileSync(path));
  for(const key of ['requisitions','offers','seed_commitments','seed_equity_grants','seed_remittances','seed_referral_accruals'])seed[key]=[];
  fs.writeFileSync(path,JSON.stringify(seed));
 }
 const driver='/tmp/driver-'+name+'.cjs';let code=fs.readFileSync('/evidence/batch-domain.cjs','utf8').replaceAll('/solution',dir).replaceAll('/evidence/batch-domain',out+'/'+name).replaceAll('/tmp/hireops-batch-domain.db','/tmp/batch-'+name+'.db');
 fs.writeFileSync(driver,code);const r=spawnSync('node',[driver],{env:process.env,encoding:'utf8',timeout:60000});fs.writeFileSync(out+'/'+name+'.log',(r.stdout||'')+(r.stderr||''));
 const observed=JSON.parse(fs.readFileSync(out+'/'+name+'/results.json'));const failure=observed.results.find(x=>x.passed===false);
 results.push({variant:name,exit:r.status,passing_groups:observed.results.filter(x=>x.passed===true).length,failure:failure||null,mutant_module_sha256:crypto.createHash('sha256').update(s).digest('hex')});
 if(name==='golden'||name==='empty_operational_seed')assert.equal(r.status,0,name);else assert.notEqual(r.status,0,name+' failed to distinguish mutant');
}
fs.writeFileSync(out+'/results.json',JSON.stringify({scope:'Scripted outcome discrimination and conforming optional-seed counterexample; not configured scores or full reward ordering',results},null,2));console.log(JSON.stringify(results,null,2));
