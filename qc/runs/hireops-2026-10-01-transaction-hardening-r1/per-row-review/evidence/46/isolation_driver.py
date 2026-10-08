"""Bounded, offline row 46 probe; immutable task/image code is never edited on host."""
from pathlib import Path
import hashlib
import json
import subprocess
import time

ROOT = Path(__file__).resolve().parents[6]
OUT = Path(__file__).resolve().parent
TASK = ROOT / '.qc-cache/hireops-2026-10-01-transaction-hardening-r1/task'
IMAGE = 'hireops-verifier:20261001-hard-r1'
AGENT = 'hireops-agent:20261001-hard-r1'

APP = r'''
const fs=require('fs'), http=require('http'), crypto=require('crypto');
const result={uid:process.getuid(),gid:process.getgid(),env_keys:Object.keys(process.env).sort(),read_probes:{},write_probes:{}};
for(const path of ['/tests/scoring.toml','/tests/scored/functional/judge.toml','/tests/gates/render/judge.toml','/root/.codex/config.toml','/proc/1/environ','/logs/verifier/reward.json']){
  try {const bytes=fs.readFileSync(path);result.read_probes[path]={readable:true,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};}
  catch(e){result.read_probes[path]={readable:false,code:e.code};}
}
for(const path of ['/tests/scoring.toml','/logs/verifier/reward.txt','/usr/local/bin/rewardkit']){
  try{const fd=fs.openSync(path,'r+');fs.closeSync(fd);result.write_probes[path]={writable:true};}
  catch(e){result.write_probes[path]={writable:false,code:e.code};}
}
const Database=require('better-sqlite3');const db=new Database(process.env.DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS isolation_control(value TEXT)');db.prepare('INSERT INTO isolation_control VALUES(?)').run('ordinary-app-write');
result.sqlite_positive_control=db.prepare('SELECT COUNT(*) AS n FROM isolation_control').get().n===1;
result.synthetic_secret_env_present=Boolean(process.env.ROW46_SYNTHETIC_PRIVATE_MARKER||process.env.ANTHROPIC_AUTH_TOKEN);
http.createServer((req,res)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));}).listen(Number(process.env.PORT),'0.0.0.0');
'''

STUB = r'''#!/usr/local/bin/python3
import json,urllib.request
from pathlib import Path
with urllib.request.urlopen('http://127.0.0.1:3000/',timeout=4) as response:
    observation=json.load(response)
Path('/probe-observation.json').write_text(json.dumps(observation))
raise SystemExit(19)
'''

BOOT = r'''
import hashlib,json,os,subprocess,sys
from pathlib import Path
case=sys.argv[1]
before={str(p):hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()}
Path('/app').mkdir();Path('/app/server.js').write_text(Path('/evidence/probe-app.cjs').read_text())
if case=='assets_symlink': os.symlink('/tests','/assets')
else: Path('/assets').mkdir()
Path('/usr/local/bin/rewardkit').write_text(Path('/evidence/rewardkit-stub.py').read_text());Path('/usr/local/bin/rewardkit').chmod(0o755)
env=dict(os.environ,REWARDKIT_JUDGE='local-fixture',REWARDKIT_MODEL='local-fixture',ROW46_SYNTHETIC_PRIVATE_MARKER='synthetic-value-only',ANTHROPIC_AUTH_TOKEN='synthetic-value-only')
proc=subprocess.run(['/bin/bash','/tests/test.sh'],env=env,capture_output=True,text=True,timeout=20)
report={'case':case,'test_sh_returncode':proc.returncode,'harness_stderr':proc.stderr,'before_file_sha256':before,'tests_mode_after':oct(Path('/tests').stat().st_mode & 511),'observation':json.loads(Path('/probe-observation.json').read_text()),'final_reward':json.loads(Path('/logs/verifier/reward.json').read_text()),'fixture': 'Actual test.sh; local non-grading RewardKit transport stub exits 19; no provider and no configured grade.'}
print(json.dumps(report))
'''

AGENT_PROBE = r'''
const fs=require('fs'),cp=require('child_process');
const r={private_paths_present:{},judge_commands_present:{}};
for(const p of ['/tests','/solution','/usr/local/lib/python3.12/site-packages/rewardkit'])r.private_paths_present[p]=fs.existsSync(p);
for(const n of ['rewardkit','claude','codex','playwright-mcp'])r.judge_commands_present[n]=cp.spawnSync('sh',['-c','command -v '+n]).status===0;
console.log(JSON.stringify(r));
'''

def run(args):
    start=time.monotonic()
    p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',timeout=50)
    return {'command':args,'returncode':p.returncode,'elapsed_seconds':round(time.monotonic()-start,3),'stdout':p.stdout,'stderr':p.stderr}

OUT.mkdir(parents=True,exist_ok=True)
(OUT/'probe-app.cjs').write_text(APP,encoding='utf-8')
(OUT/'rewardkit-stub.py').write_text(STUB,encoding='utf-8')
(OUT/'container_driver.py').write_text(BOOT,encoding='utf-8')
report={'input_sha256':'6e0b8d2fb655781b3dbd8f4bde8d064dd48f8f7671ecd87f6a2db22b5c0aa8a1','scope':'Local isolation only. Synthetic marker values only; no real keys; no provider; no full configured grade.','source_sha256':{str(p.relative_to(TASK)):hashlib.sha256(p.read_bytes()).hexdigest() for p in TASK.rglob('*') if p.is_file()}}
report['image_ids']={name:run(['docker','image','inspect','--format','{{.Id}}',name]) for name in [IMAGE,AGENT]}
report['agent_image']=run(['docker','run','--rm','--network','none','--name','hireops-row46-agent-inspection','--entrypoint','node',AGENT,'-e',AGENT_PROBE])
report['cases']=[]
for case in ['ordinary_assets','assets_symlink']:
    r=run(['docker','run','--rm','--network','none','--name','hireops-row46-'+case.replace('_','-'),'-v',str(OUT)+':/evidence:ro','--entrypoint','python3',IMAGE,'/evidence/container_driver.py',case])
    if r['returncode']==0:
        observed=json.loads(r['stdout'])
        expected={'/tests/'+str(p.relative_to(TASK/'tests')).replace('\\','/'):hashlib.sha256(p.read_bytes()).hexdigest() for p in (TASK/'tests').rglob('*') if p.is_file() and p.name not in ['Dockerfile','.dockerignore']}
        r['source_binding_matches']=observed['before_file_sha256']==expected
        r['result']=observed
    report['cases'].append(r)
(OUT/'isolation-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'output':str(OUT/'isolation-results.json'),'cases':[{'case':r.get('result',{}).get('case'),'returncode':r['returncode'],'source_binding_matches':r.get('source_binding_matches'),'observation':r.get('result',{}).get('observation'),'stderr':r['stderr']} for r in report['cases']],'agent_image':report['agent_image']['stdout']},indent=2))
