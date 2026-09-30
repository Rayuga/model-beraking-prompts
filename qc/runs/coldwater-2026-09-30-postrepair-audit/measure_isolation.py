"""Offline, disposable-container measurements; no app judging or real credentials."""
from pathlib import Path
import hashlib
import json
import subprocess
from datetime import datetime, timezone

out = Path(__file__).resolve().parent
root = out.parents[2]
manifest = json.loads((out / 'manifest.json').read_text())
cache = root / manifest['cache'] / 'task'

agent_probe = r'''
const fs=require('fs'),crypto=require('crypto');
const hashes={};
for(const dir of ['/instructions','/assets']) for(const file of fs.readdirSync(dir)) {
  const path=dir+'/'+file;
  if(fs.statSync(path).isFile()) hashes[path]=crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
}
const paths=['/tests','/solution','/usr/local/bin/rewardkit','/usr/local/bin/claude','/usr/local/bin/codex','/usr/local/bin/playwright-mcp','/usr/local/lib/python3.12/site-packages/rewardkit'];
console.log(JSON.stringify({uid:process.getuid(),hashes,app_entries:fs.readdirSync('/app'),
  prohibited_paths:Object.fromEntries(paths.map(p=>[p,fs.existsSync(p)])),
  global_packages:fs.readdirSync('/usr/local/lib/node_modules'),
  provider_environment_present:Object.keys(process.env).filter(k=>/ANTHROPIC|OPENROUTER|OPENAI_API|REWARDKIT/.test(k))}));
'''

verifier_probe = r'''
import hashlib,json,os,subprocess
from pathlib import Path
hashes={p.relative_to('/tests').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()}
Path('/logs/verifier').mkdir(parents=True,exist_ok=True)
os.chmod('/logs/verifier',0o700)
Path('/logs/verifier/reward.json').write_text('{"reward":0}')
os.chmod('/logs/verifier/reward.json',0o600)
for p in ['/app','/tmp/submission']:
 Path(p).mkdir(parents=True,exist_ok=True);os.chown(p,65534,65534);os.chmod(p,0o755)
os.environ['ANTHROPIC_AUTH_TOKEN']='qc-not-a-credential'
os.environ['REWARDKIT_MODEL']='qc-dummy-model'
probe=r"""
const fs=require('fs');
const attempt=(fn)=>{try{fn();return {denied:false};}catch(e){return {denied:true,error:e.code};}};
const checks={criteria_read:attempt(()=>fs.readFileSync('/tests/scored/functional/judge.toml')),
reward_read:attempt(()=>fs.readFileSync('/logs/verifier/reward.json')),
reward_write:attempt(()=>fs.writeFileSync('/logs/verifier/reward.json','unexpected')),
root_environment_read:attempt(()=>fs.readFileSync('/proc/1/environ'))};
fs.writeFileSync('/app/qc-public-write.txt','allowed');
console.log(JSON.stringify({uid:process.getuid(),gid:process.getgid(),groups:process.getgroups(),checks,
app_write_succeeded:fs.readFileSync('/app/qc-public-write.txt','utf8')==='allowed',
environment_names:Object.keys(process.env).sort(),
provider_environment_present:Object.keys(process.env).filter(k=>/ANTHROPIC|OPENROUTER|OPENAI_API|REWARDKIT/.test(k))}));
"""
command=['env','-i','PATH=/usr/local/bin:/usr/bin:/bin','NODE_PATH=/usr/local/lib/node_modules','HOME=/tmp/submission','PORT=3000','DB_PATH=/app/app.db','setpriv','--reuid=65534','--regid=65534','--clear-groups','node','-e',probe]
p=subprocess.run(command,capture_output=True,text=True,timeout=20)
print(json.dumps({'tests_hashes':hashes,'test_directory_mode':oct(Path('/tests').stat().st_mode & 0o777),
 'child_command':command[:-1]+['<embedded harmless permission probe>'],'child_exit':p.returncode,
 'child':json.loads(p.stdout) if p.returncode==0 else None,'stderr':p.stderr,
 'reward_intact':Path('/logs/verifier/reward.json').read_text()=='{"reward":0}'}))
'''

results = {'input_sha256': manifest['input_sha256'], 'started_utc': datetime.now(timezone.utc).isoformat(),
           'scope': 'Exact-image contents and sanitized unprivileged file permissions only; no configured judge, provider call or Oracle score.'}
for name, executable, script in [('agent', 'node', agent_probe), ('verifier', 'python3', verifier_probe)]:
    tag = f'colderwater-{name}:postrepair-audit-20260930'
    image_id = subprocess.check_output(['docker', 'image', 'inspect', '--format', '{{.Id}}', tag], text=True).strip()
    cmd = ['docker','run','--rm','--network=none','-i','--entrypoint',executable,image_id,'-']
    run = subprocess.run(cmd,input=script,capture_output=True,text=True,timeout=45)
    results[name] = {'image':image_id,'command':cmd,'exit_code':run.returncode,'stderr':run.stderr,
                     'observations':json.loads(run.stdout) if run.returncode==0 else None}
    if run.returncode:
        results[name]['stdout']=run.stdout
        break

if all(results.get(n,{}).get('exit_code')==0 for n in ['agent','verifier']):
    agent=results['agent']['observations']; verifier=results['verifier']['observations']; child=verifier['child']
    results['checks']={
      'agent_inputs_match':all(manifest['inputs']['task']['environment'+p]==h for p,h in agent['hashes'].items()),
      'agent_app_empty':set(agent['app_entries'])=={'.git','.gitkeep'},
      'agent_no_grading_paths':not any(agent['prohibited_paths'].values()),
      'agent_no_judge_packages':not any(any(s in x.lower() for s in ['rewardkit','claude','codex','playwright']) for x in agent['global_packages']),
      'agent_no_provider_environment':not agent['provider_environment_present'],
      'verifier_files_match':verifier['tests_hashes']=={p[6:]:h for p,h in manifest['inputs']['task'].items() if p.startswith('tests/') and p not in ['tests/Dockerfile','tests/.dockerignore']},
      'unprivileged_uid':child['uid']==65534 and child['gid']==65534,
      'criteria_and_reward_denied':all(v['denied'] and v['error'] in ['EACCES','EPERM'] for v in child['checks'].values()),
      'provider_environment_absent':not child['provider_environment_present'],
      'app_write_positive_control':child['app_write_succeeded'],
      'reward_unchanged':verifier['reward_intact']}
    results['passed']=all(results['checks'].values())
    results['inventory_note']='tests/.dockerignore excludes Dockerfile and .dockerignore from COPY. Their absence is expected; every other frozen tests file must match exactly. The first inventory attempt, which included these two excluded build inputs, is preserved separately.'
else:
    results['passed']=False
results['probe_script_sha256']=hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
results['finished_utc']=datetime.now(timezone.utc).isoformat()
(out/'isolation-measurement.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':results['passed'],'checks':results.get('checks'),
                  'exit_codes':{n:results.get(n,{}).get('exit_code') for n in ['agent','verifier']}}))
raise SystemExit(0 if results['passed'] else 1)
