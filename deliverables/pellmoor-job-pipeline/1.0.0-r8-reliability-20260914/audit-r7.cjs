const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const runs = path.join(root, 'run-outputs/pellmoor-job-pipeline');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function files(dir) {return fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => e.isDirectory() ? files(path.join(dir,e.name)) : [path.join(dir,e.name)]);}
const all = files(runs);
const hashes = Object.fromEntries(all.map(p => [path.relative(runs,p).replaceAll('\\','/'),sha(p)]));
const record = {reviewed_revision:'r7',trials:[],gpt_browser_failure:{}};
const rows = [['trial','model','dimension','criterion','value','weight','reasoning']];
for (const p of all.filter(p => path.basename(p)==='result.json' && path.basename(path.dirname(p)).startsWith('pellmoor-job-pipeline__'))) {
  const result=read(p), dir=path.dirname(p), verifier=path.join(dir,'verifier');
  const reward=read(path.join(verifier,'reward.json'));
  const provenance=read(path.join(verifier,'prompt-provenance.json'));
  const details=fs.existsSync(path.join(verifier,'reward-details.json')) ? read(path.join(verifier,'reward-details.json')) : {};
  const agent=result.config.agent;
  record.trials.push({trial:result.trial_name,agent:agent.name,model:agent.model_name,solver_effort:agent.kwargs?.reasoning_effort,task_checksum:result.task_checksum,exception_info:result.exception_info,reward,provenance,dimensions:Object.fromEntries(Object.entries(details).map(([key,value])=>[key,{score:value.score,criteria:value.criteria}]))});
  for(const [dim,data] of Object.entries(details)) for(const c of data.criteria) rows.push([result.trial_name,agent.model_name||agent.name,dim,c.id,c.value,c.weight,c.reasoning]);
  if(agent.model_name==='gpt-5.4-mini') {
    const trajectory=read(path.join(dir,'agent/trajectory.json'));
    const launch=trajectory.steps.find(s=>s.step_id===53);
    record.gpt_browser_failure={
      undefined_symbol:'renderActivityList',
      symbol_occurrences:fs.readFileSync(path.join(dir,'artifacts/app/src/app.ts'),'utf8').split('\n').map((line,i)=>({line:i+1,text:line})).filter(x=>x.text.includes('renderActivityList')),
      launch_step:launch.step_id,
      launch_error_lines:launch.observation.results.flatMap(r=>r.content.split('\n')).filter(line=>line.includes('libglib')||line.includes('error while loading shared libraries')),
      final_solver_message:trajectory.steps.at(-1).tool_calls[0].arguments.message
    };
  }
}
fs.writeFileSync(path.join(__dirname,'r7-run-review.json'),JSON.stringify(record,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'run-file-hashes.json'),JSON.stringify(hashes,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'criterion-results.csv'),rows.map(row=>row.map(v=>'"'+String(v??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n');
console.log(JSON.stringify({trials:record.trials.length,criteria:rows.length-1,run_files:all.length,scores:record.trials.map(t=>({trial:t.trial,model:t.model||t.agent,reward:t.reward.reward}))},null,2));
