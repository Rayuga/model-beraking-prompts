const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const root = path.resolve(__dirname, '../../../..');
const base = 'deliverables/colderwater-playground-devtools/';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const load = relative => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const ref = relative => ({path:relative, sha256:sha(fs.readFileSync(path.join(root,relative)))});
function zipEntries(relative) {
  const bytes=fs.readFileSync(path.join(root,relative));let end=bytes.length-22;
  while(end>=0 && bytes.readUInt32LE(end)!==0x06054b50)end--;
  if(end<0)throw Error('ZIP central directory not found');
  let at=bytes.readUInt32LE(end+16);const files={};
  for(let i=0,n=bytes.readUInt16LE(end+10);i<n;i++){
    if(bytes.readUInt32LE(at)!==0x02014b50)throw Error('bad ZIP directory');
    const method=bytes.readUInt16LE(at+10),size=bytes.readUInt32LE(at+20),nl=bytes.readUInt16LE(at+28),el=bytes.readUInt16LE(at+30),cl=bytes.readUInt16LE(at+32),off=bytes.readUInt32LE(at+42);
    const name=bytes.subarray(at+46,at+46+nl).toString('utf8');
    const dataAt=off+30+bytes.readUInt16LE(off+26)+bytes.readUInt16LE(off+28),packed=bytes.subarray(dataAt,dataAt+size);
    if(!name.endsWith('/'))files[name]=method===0?packed:method===8?zlib.inflateRawSync(packed):(()=>{throw Error('unsupported ZIP compression')})();
    at+=46+nl+el+cl;
  }
  return files;
}
const frozenArchive=base+'two-findings-fix-2026-09-27/colderwater-playground-devtools.zip';
const frozen=zipEntries(frozenArchive);
const find=(ending)=>{const key=Object.keys(frozen).find(x=>x.endsWith(ending));if(!key)throw Error(ending);return frozen[key];};
const toml=find('/tests/scored/functional/judge.toml').toString('utf8');
const criteria=toml.split('[[criterion]]').slice(1).map(part=>({id:part.match(/^id\s*=\s*"([^"]+)"/m)?.[1],weight:Number(part.match(/^weight\s*=\s*([\d.]+)/m)?.[1]),description:part.match(/description\s*=\s*'''([\s\S]*?)'''/)?.[1] ?? part.match(/description\s*=\s*"""([\s\S]*?)"""/)?.[1]}));
if(criteria.length!==37||criteria.some(x=>!x.id||!x.description))throw Error('Frozen criterion parse failed');
fs.writeFileSync(path.join(__dirname,'BASELINE_FUNCTIONAL_READONLY.json'),JSON.stringify({archive:ref(frozenArchive),functional_sha256:sha(Buffer.from(toml)),criteria},null,2)+'\n');
const rels=[
 'full-qc-2026-09-27/runtime/golden/golden-browser-results.json',
 'full-qc-2026-09-27/runtime/budget/title-and-shared-budget-results.json',
 'full-qc-2026-09-27/runtime/errors/independent-runtime-results.json',
 'full-qc-2026-09-27/runtime/library/browser-evidence/library-results.json',
 'full-qc-2026-09-27/runtime/network/network-boundary-results.json',
 'full-qc-2026-09-27/runtime/supplement/supplement-results.json',
 'full-qc-2026-09-27/runtime/validation/validation-boundaries-results.json',
 'full-qc-2026-09-27/presentation-final/presentation-results.json',
 'cross-check-2026-09-27/golden-flow-results.json',
 'eight-issue-fix-2026-09-27/functional/browser_probe_results.json',
 'eight-issue-fix-2026-09-27/functional/opaque_frame_probe_results.json',
 'eight-issue-fix-2026-09-27/golden/functional-mcp-results.json',
 'eight-issue-fix-2026-09-27/golden/stale-draft-mcp-results.json',
 'eight-issue-fix-2026-09-27/golden/keyboard-proof-results.json',
 'eight-issue-fix-2026-09-27/golden/undocumented-keyboard-proof-results.json',
 'final-cross-check-2026-09-27/golden/revised_branches_results.json',
 'final-cross-check-2026-09-27/golden/example_only_results.json',
 'final-cross-check-2026-09-27/golden/restart_sequence_results.json',
 'two-findings-fix-2026-09-27/golden/independence-normal-results.json',
 'two-findings-fix-2026-09-27/golden/independence-no-duplicate-delete-results.json',
 'two-findings-fix-2026-09-27/golden/independence-deletion-results.json',
 'two-findings-fix-2026-09-27/privacy/privacy_results.json',
 'interaction-keyboard-fix-2026-09-27/language-mcp-results.json'
];
function walk(value,jsonPath='$',out=[]){
  if(!value || typeof value!=='object')return out;
  if(!Array.isArray(value)){
    const metrics=Object.fromEntries(Object.entries(value).filter(([key,val])=>typeof val==='number' && /(duration|elapsed|wait_.*_ms|timeout.*_ms|.*_at_ms|observed_until.*_ms|run_action_to_timeout_ms)/.test(key)));
    if(Object.keys(metrics).length)out.push({json_path:jsonPath,name:value.name??value.case??null,passed:value.passed??null,...metrics});
  }
  for(const [key,val]of Object.entries(value))if(typeof val==='object')walk(val,jsonPath+(Array.isArray(value)?`[${key}]`:'.'+key),out);
  return out;
}
const records=rels.map(rel=>{
 const relative=base+rel,data=load(relative),start=data.started_at??data.startedAt,end=data.finished_at??data.finishedAt;
 const complete=start&&end?(Date.parse(end)-Date.parse(start))/1000:typeof data.duration_seconds==='number'?data.duration_seconds:null;
 const groupNames=[];const collect=v=>{if(!v||typeof v!=='object')return;if(Array.isArray(v)){for(const a of v)collect(a);return;}if((v.name||v.id)&&'passed'in v)groupNames.push({name:v.name??v.id,passed:v.passed});for(const[k,a]of Object.entries(v))if(k!=='tools'&&k!=='tool'&&typeof a==='object')collect(a);};collect(data);
 return {...ref(relative),top_level_keys:Object.keys(data),started_at:start??null,finished_at:end??null,wall_seconds:complete,passed:data.passed??data.result?.passed??null,measurements:walk(data),observation_groups:groupNames,scope:data.scope??null,source_hash_fields:Object.keys(data).filter(k=>/sha256|source/.test(k)),raw_write_counts:Object.fromEntries(['prepare','verify','deletion'].filter(k=>data[k]?.writes).map(k=>[k,data[k].writes.length])),failure:data.error??data.failure??null};
});
const bindingRel=base+'two-findings-fix-2026-09-27/golden/golden_evidence_binding.json',binding=load(bindingRel);
const currentSourceBinding=Object.entries(binding.solution_files).map(([rel,digest])=>({path:'projects/colderwater-playground-devtools/solution/'+rel,frozen_sha256:digest,current_sha256:sha(fs.readFileSync(path.join(root,'projects/colderwater-playground-devtools/solution',rel))),matches:sha(fs.readFileSync(path.join(root,'projects/colderwater-playground-devtools/solution',rel)))===digest}));
const report={purpose:'Read-only timing/reuse inventory, not a new execution or score. Frozen 5d0f Functional baseline; later structure needs a new mapping and proof.',frozen_archive:ref(frozenArchive),frozen_functional_sha256:sha(Buffer.from(toml)),frozen_functional_rows:criteria.length,frozen_functional_weight:criteria.reduce((s,c)=>s+c.weight,0),prior_binding:ref(bindingRel),current_solution_matches_frozen:currentSourceBinding.every(x=>x.matches),current_solution_files:currentSourceBinding,proofs:records,interpretation:['Outer wall times include local script/browser startup where recorded. Nested duration_ms is a measured subgroup; never add overlapping nested duration and enclosing wall time.','started_at/finished_at in whole seconds provide rounded wall measurements. Exact millisecond timestamps preserve their stated precision.','No proof here ran an LLM judge. None measures LLM deliberation, multimodal context, model/provider latency or the total platform grading path.','Selected proofs overlap scenarios, use different historic fixture versions, and contain deliberate alternative cases. Their times cannot be summed into a claimed full current run.','Failed or partial reports retain their failures. Composite summaries are not clean single-run evidence.']};
fs.writeFileSync(path.join(__dirname,'EXISTING_TIMING_INVENTORY.json'),JSON.stringify(report,null,2)+'\n');
const priorMapRel=base+'two-findings-fix-2026-09-27/GOLDEN_CRITERION_EVIDENCE.json',priorMap=load(priorMapRel);
const baselineRows=priorMap.all_current_criteria.filter(row=>row.dimension==='scored/functional');
if(baselineRows.length!==37)throw Error('Expected37 Functional prior rows');
let references=0;
const rows=baselineRows.map(row=>({id:row.id,baseline_criterion_sha256:row.criterion_sha256,baseline_weight:row.weight,prior_scope:row.status,prior_evidence:row.evidence.map(e=>{const observed=ref(e.path);references++;if(observed.sha256!==e.sha256)throw Error('Prior evidence changed: '+e.path);return{...observed,hash_verified:true};}),current_reuse_status:'Historical baseline observation only. Remap observations after new fixture freeze; rerun changed branches and all shared workflow branches for the fresh full-preflight claim.'}));
const reuse={purpose:'Read-only provenance ledger. No new application execution, no new criterion score, and no assertion that old grouped verdicts apply to a rewritten rubric.',frozen_archive:ref(frozenArchive),baseline_map:ref(priorMapRel),source_binding:ref(bindingRel),all_23_current_solution_files_match_frozen:report.current_solution_matches_frozen,rows:rows,verified_evidence_references:references,partial_variant_status:{restart_missing_duplicate_delete:'Already observed passing partial capability witness in independence-no-duplicate-delete-results.json; real canonical MCP restart. Temporary DOM control removal/disable only.',pending_static_snapshot:'Already observed passing partial visibility/input-policy witness in revised_branches_results.json individual group; enclosing report has an unrelated failed example probe and is not a whole-report pass.',import_correct_server_filename_bad:'Planned after freeze; not executed or scored.',trim_correct_case_sensitive_titles_bad:'Planned after freeze; not executed or scored.',dispatch_correct_css_handlers_bad:'Planned after freeze; not executed or scored.'},required_next_run:'One fresh database, continuing shared workflow, every new Functional row linked to independent branch observations; failures do not skip unrelated branches. No provider/platform execution.'};
fs.writeFileSync(path.join(__dirname,'READ_ONLY_REUSE_LEDGER.json'),JSON.stringify(reuse,null,2)+'\n');
const scenarioDoc=fs.readFileSync(path.join(__dirname,'WAIT_AND_SCENARIO_INVENTORY.md'),'utf8');
const operationRows=[...scenarioDoc.matchAll(/^\| \d+ \| `([^`]+)` \| (\d+) \| (\d+) \|$/gm)];
const primarySection=scenarioDoc.split('| Scenario | Primary frozen IDs |')[1]?.split('| Order |')[0]??'';
const primaryIds=[...primarySection.matchAll(/`([^`]+)`/g)].map(m=>m[1]);
const baselineIds=criteria.map(c=>c.id).sort();
if(JSON.stringify(primaryIds.slice().sort())!==JSON.stringify(baselineIds)||operationRows.length!==37)throw Error('Scenario/operation37-row coverage mismatch');
const manualRuns=operationRows.reduce((s,m)=>s+Number(m[2]),0),writeAttempts=operationRows.reduce((s,m)=>s+Number(m[3]),0);
if(manualRuns!==60||writeAttempts!==54)throw Error('Operation count mismatch');
const assessmentFiles=['inventory_existing_evidence.cjs','BASELINE_FUNCTIONAL_READONLY.json','EXISTING_TIMING_INVENTORY.json','READ_ONLY_REUSE_LEDGER.json','WAIT_AND_SCENARIO_INVENTORY.md','RUNTIME_WORKLOAD_ASSESSMENT.md'];
fs.writeFileSync(path.join(__dirname,'ASSESSMENT_BINDING.json'),JSON.stringify({scope:'Frozen read-only assessment only; evolving drivers/ and future runtime proofs are excluded.',frozen_archive:ref(frozenArchive),files:Object.fromEntries(assessmentFiles.map(name=>[name,ref(base+'structural-review-2026-09-27/golden/'+name)])),checks:{baseline_rows:37,primary_scenario_rows:primaryIds.length,primary_scenario_unique:new Set(primaryIds).size,manual_runs:manualRuns,mutation_attempts:writeAttempts,privacy_navigations:9,canonical_restart:1,all_23_current_solution_match_frozen:report.current_solution_matches_frozen,prior_evidence_hashes_verified:references,historical_proof_files_inventoried:records.length},runtime_executed:false,provider_or_platform_invoked:false,new_criterion_passes_claimed:false},null,2)+'\n');
console.log(JSON.stringify({frozen_rows:report.frozen_functional_rows,source23match:report.current_solution_matches_frozen,proofs:records.map(x=>({path:x.path,wall_seconds:x.wall_seconds,passed:x.passed,measurements:x.measurements}))},null,2));
