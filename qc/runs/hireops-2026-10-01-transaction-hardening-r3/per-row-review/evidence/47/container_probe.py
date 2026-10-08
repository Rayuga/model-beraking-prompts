
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
