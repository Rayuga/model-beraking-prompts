const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const zlib = require('zlib');
const root = path.resolve(__dirname, '../../..');
const out = __dirname;
const task = path.join(root, 'projects/patchpad-editor-v3');
const runs = path.join(root, 'run-outputs/patchpad-editor-v3');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const rel = p => path.relative(root, p).replaceAll('\\', '/');
const walk = p => fs.readdirSync(p, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(p,e.name)) : [path.join(p,e.name)]);
const zipPath = path.join(root, 'deliverables/patchpad-editor-v3/1.0.0-editing-depth-20260913/patchpad-editor-v3.zip');
const zip = fs.readFileSync(zipPath);
const entries = [];
let eocd = zip.length - 22;
while (eocd >= 0 && zip.readUInt32LE(eocd) !== 0x06054b50) eocd--;
if (eocd < 0) throw Error('Missing ZIP directory');
let pos = zip.readUInt32LE(eocd + 16);
for (let n = 0; n < zip.readUInt16LE(eocd + 10); n++) {
  if (zip.readUInt32LE(pos) !== 0x02014b50) throw Error('Invalid ZIP directory');
  const method = zip.readUInt16LE(pos+10), size = zip.readUInt32LE(pos+20), len = zip.readUInt16LE(pos+28);
  const name = zip.subarray(pos+46,pos+46+len).toString();
  const off = zip.readUInt32LE(pos+42);
  const start = off+30+zip.readUInt16LE(off+26)+zip.readUInt16LE(off+28);
  const compressed = zip.subarray(start,start+size);
  const bytes = method === 8 ? zlib.inflateRawSync(compressed) : method === 0 ? compressed : null;
  if (!bytes) throw Error('Unsupported ZIP method');
  if (!name.startsWith('patchpad-editor-v3/') || name.includes('..')) throw Error('Unexpected wrapper/path');
  const source = path.join(root, 'projects', name);
  if (!name.endsWith('/')) entries.push({name,sha256:sha(bytes),source_match:fs.existsSync(source) && sha(fs.readFileSync(source))===sha(bytes)});
  pos += 46+len+zip.readUInt16LE(pos+30)+zip.readUInt16LE(pos+32);
}
const report = {review_date:'2026-09-13',status:'HOLD_NOT_FINAL',package:{path:rel(zipPath),sha256:sha(zip),files:entries,all_source_files_match:entries.every(e=>e.source_match),source_file_count:walk(task).length},trials:[],scan:{files:0,secret_candidates:[],suspicious_source:[],suspicious_agent_actions:[]}};
const observations = [];
for (const run of fs.readdirSync(runs)) for (const name of fs.readdirSync(path.join(runs,run)).filter(n=>n.startsWith('patchpad-editor-v3__'))) {
  const dir = path.join(runs,run,name), result = read(path.join(dir,'result.json')), lock=read(path.join(dir,'lock.json'));
  const reward=read(path.join(dir,'verifier/reward.json')), provenance=read(path.join(dir,'verifier/prompt-provenance.json'));
  const detailsPath=path.join(dir,'verifier/reward-details.json');
  const details=fs.existsSync(detailsPath)?read(detailsPath):{};
  const hashes=[];
  for(const [dim,d] of Object.entries(provenance.judges)) for(const [kind,file] of [['prompt','prompt.md'],['judge','judge.toml']]) hashes.push({file:`tests/${dim}/${file}`,match:sha(fs.readFileSync(path.join(task,'tests',dim,file)))===d[kind+'_sha256']});
  hashes.push({file:'tests/test.sh',match:sha(fs.readFileSync(path.join(task,'tests/test.sh')))===provenance.runner_sha256});
  hashes.push({file:'tests/reward.toml',match:sha(fs.readFileSync(path.join(task,'tests/reward.toml')))===provenance.reward_config_sha256});
  const calculated=reward.render<=0||reward.constraints<=0?0:Math.round((.6*reward.functional+.2*reward.polish+.2*reward.visual)*10000)/10000;
  const trial={run,trial:name,agent:result.agent_info,reasoning_effort:lock.agent.kwargs?.reasoning_effort,task_digest:lock.task.digest,reward,calculated_reward:calculated,reward_matches:calculated===reward.reward,exception:result.exception_info,verifier_hashes:hashes,dimensions:[],native_judge_traces_exported:false};
  for(const [dim,d] of Object.entries(details)) {
    const sum=d.criteria.reduce((a,c)=>a+c.weight,0), weighted=d.criteria.reduce((a,c)=>a+c.value*c.weight,0)/sum;
    trial.dimensions.push({dimension:dim,criteria:d.criteria.length,passed:d.criteria.filter(c=>c.value===1).length,weight_sum:sum,calculated_score:Math.round(weighted*10000)/10000,recorded_score:d.score,matches:Math.abs(weighted-d.score)<0.000051});
    for(const c of d.criteria) observations.push({trial:name,model:result.agent_info.model_info?.name||result.agent_info.name,dimension:dim,id:c.id,value:c.value,weight:c.weight,reasoning:c.reasoning});
    if(d.judge?.atif_trajectory) trial.native_judge_traces_exported=true;
  }
  if(result.agent_info.name==='oracle') trial.golden_source_matches=walk(path.join(task,'solution/app')).map(f=>{const local=path.relative(path.join(task,'solution/app'),f), exported=path.join(dir,'artifacts/app',local);return {file:local.replaceAll('\\','/'),match:fs.existsSync(exported)&&sha(fs.readFileSync(f))===sha(fs.readFileSync(exported))};});
  const trajectory=path.join(dir,'agent/trajectory.json');
  if(fs.existsSync(trajectory)) {
    const tr=read(trajectory); trial.agent_step_count=tr.steps.length;
    for(const s of tr.steps) for(const call of s.tool_calls||[]) {
      const text=JSON.stringify(call.arguments);
      if(/(?:\/tests(?:\/|\b)|\/solution(?:\/|\b)|\/logs\/verifier|reward\.json|reward-details|navigator\.webdriver|ignore (?:all |previous )?instructions|give (?:me |this )?(?:full|maximum) (?:credit|score))/i.test(text)) report.scan.suspicious_agent_actions.push({trial:name,step:s.step_id,tool:call.function_name,argument_sha256:sha(text)});
    }
  }
  report.trials.push(trial);
}
const secretRules=[['api_key_token',/\bsk-(?:proj-|or-v1-|ant-)?[A-Za-z0-9_-]{24,}\b/],['github_token',/\bgh[pousr]_[A-Za-z0-9]{30,}\b/],['private_key',/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],['bearer_token',/Bearer\s+[A-Za-z0-9_.-]{30,}/]];
for(const f of [...walk(runs),...walk(task)]) {
  if(!/\.(?:json|js|css|html|py|sh|toml|md|txt|log)$/.test(f)&&!f.endsWith('Dockerfile')) continue;
  const text=fs.readFileSync(f,'utf8'); report.scan.files++;
  for(const [rule,re] of secretRules) if(re.test(text)) report.scan.secret_candidates.push({file:rel(f),rule});
  if(f.includes(path.sep+'artifacts'+path.sep)&&/\.(js|css|html|md)$/.test(f)) {
    const lines=text.split(/\r?\n/);
    lines.forEach((line,i)=>{if(/\/logs\/verifier|\/tests(?:\/|\b)|reward\.json|navigator\.webdriver|ignore (?:all |previous )?instructions|give (?:me |this )?(?:full|maximum) (?:credit|score)/i.test(line)) report.scan.suspicious_source.push({file:rel(f),line:i+1});});
  }
}
report.common_task_digest=[...new Set(report.trials.map(t=>t.task_digest))];
report.exported_databases=walk(runs).filter(f=>/\.(?:db|sqlite)(?:-wal|-shm|-journal)?$/.test(f)).map(rel);
report.platform_qc_report_found=walk(runs).some(f=>/qc[-_].*\.(?:json|html)$/.test(f));
fs.writeFileSync(path.join(out,'audit-results.json'),JSON.stringify(report,null,2)+'\n');
fs.writeFileSync(path.join(out,'criterion-review.json'),JSON.stringify(observations,null,2)+'\n');
console.log(JSON.stringify({package_sha256:report.package.sha256,zip_files:entries.length,source_files:report.package.source_file_count,source_matches:report.package.all_source_files_match,common_task_digest:report.common_task_digest,trials:report.trials.map(t=>({name:t.trial,model:t.agent.model_info?.name||t.agent.name,reward:t.reward.reward,formula_ok:t.reward_matches,dimensions_ok:t.dimensions.every(d=>d.matches),provenance_ok:t.verifier_hashes.every(h=>h.match),golden_source_ok:t.golden_source_matches?.every(f=>f.match)})),scan:report.scan},null,2));
