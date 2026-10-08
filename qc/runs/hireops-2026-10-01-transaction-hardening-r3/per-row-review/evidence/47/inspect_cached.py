import hashlib
import json
from pathlib import Path
import subprocess
import time

HERE = Path(__file__).resolve().parent
IMAGE = 'hireops-verifier:20261001-hard-r3'
EXPECTED = 'sha256:958902dedd30475f2f1e94c046b1b718b0c76d18cc733486bb81dfdbf61f3bc6'
INSPECT = ['docker', 'image', 'inspect', '--format', '{{.Id}}', IMAGE]
identified = subprocess.run(INSPECT, capture_output=True, text=True, check=True).stdout.strip()
assert identified == EXPECTED, (identified, EXPECTED)
probe = r'''
import hashlib,json,subprocess
from pathlib import Path
from importlib.metadata import version
for package in ['@anthropic-ai/claude-code','@openai/codex','@playwright/mcp']:
 p=Path('/usr/local/lib/node_modules')/package/'package.json'
 d=json.loads(p.read_text())
 print(json.dumps({'package':d['name'],'version':d['version'],'dependencies':d.get('dependencies',{}),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}),flush=True)
for package in ['playwright','playwright-core']:
 p=Path('/usr/local/lib/node_modules/@playwright/mcp/node_modules')/package/'package.json'
 d=json.loads(p.read_text())
 print(json.dumps({'package':d['name'],'version':d['version'],'dependencies':d.get('dependencies',{}),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}),flush=True)
p=Path('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright-core/browsers.json')
print(json.dumps({'browser_manifest':json.loads(p.read_text()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}),flush=True)
print(json.dumps({'harbor-rewardkit':version('harbor-rewardkit')}),flush=True)
for cmd in [['claude','--version'],['codex','--version'],['/usr/local/bin/chromium','--version']]:
 r=subprocess.run(cmd,capture_output=True,text=True,timeout=20)
 print(json.dumps({'command':cmd,'exit_code':r.returncode,'stdout':r.stdout,'stderr':r.stderr}),flush=True)
code="const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright'); (async()=>{const browser=await chromium.launch({executablePath:'/usr/local/bin/chromium',headless:true,args:['--no-sandbox']}); console.log(JSON.stringify({actual_launched_browser_version:browser.version()})); await browser.close();})().catch(e=>{console.error(e);process.exit(1)});"
r=subprocess.run(['node','-e',code],capture_output=True,text=True,timeout=30)
print(json.dumps({'browser_launch_exit_code':r.returncode,'stdout':r.stdout,'stderr':r.stderr}),flush=True)
raise SystemExit(r.returncode)
'''
(HERE/'container_probe.py').write_text(probe, encoding='utf-8')
command = ['docker','run','--rm','--network','none','--name','hireops-r3-row47-pins-20261002','-i',identified,'python3','-B','-']
start=time.monotonic()
result=subprocess.run(command,input=probe,capture_output=True,text=True,timeout=100)
(HERE/'cached-inspection.stdout.log').write_text(result.stdout,encoding='utf-8')
(HERE/'cached-inspection.stderr.log').write_text(result.stderr,encoding='utf-8')
manifest={'input_sha256':'cf784fd80eb2bbde1fc76bc223bc4dd9b75279121566847079f982e09473ca01','inspect_command':INSPECT,'image_id':identified,'command':command,'exit_code':result.returncode,'duration_seconds':time.monotonic()-start,'scope':'Network-disabled inspection of the existing cached canonical verifier image, including browser launch; no app grading or provider request. Does not prove uncached provisioning succeeds.','artifacts':{str(p.name):hashlib.sha256(p.read_bytes()).hexdigest() for p in [HERE/'inspect_cached.py',HERE/'container_probe.py',HERE/'cached-inspection.stdout.log',HERE/'cached-inspection.stderr.log']}}
(HERE/'cached-inspection.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps(manifest,indent=2))
print(result.stdout)
print(result.stderr)
