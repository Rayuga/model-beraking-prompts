from pathlib import Path
import json,subprocess,hashlib,importlib.metadata
base=Path('/usr/local/lib/node_modules')
result={'provider_invoked':False,'configured_judge_invoked':False,'rewardkit_version':importlib.metadata.version('harbor-rewardkit'),'packages':{},'browser_builds':None,'commands':[],'baked_tool_sha256':{}}
for name in ['@anthropic-ai/claude-code','@openai/codex','@playwright/mcp','@playwright/mcp/node_modules/playwright','@playwright/mcp/node_modules/playwright-core']:
 p=base/name/'package.json'
 if p.exists():
  d=json.loads(p.read_text()); result['packages'][name]={'version':d.get('version'),'dependencies':d.get('dependencies'),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
p=base/'@playwright/mcp/node_modules/playwright-core/browsers.json'
if p.exists(): result['browser_builds']={'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'data':json.loads(p.read_text())}
for cmd in [['claude','--version'],['codex','--version'],['playwright-mcp','--version'],['/usr/local/bin/chromium','--version']]:
 r=subprocess.run(cmd,capture_output=True,text=True,timeout=30); result['commands'].append({'argv':cmd,'returncode':r.returncode,'stdout':r.stdout,'stderr':r.stderr})
for name in ['score.py','restart_mcp.py']:
 p=Path('/tests/tools')/name
 if p.exists(): result['baked_tool_sha256'][name]=hashlib.sha256(p.read_bytes()).hexdigest()
print(json.dumps(result,indent=2))
