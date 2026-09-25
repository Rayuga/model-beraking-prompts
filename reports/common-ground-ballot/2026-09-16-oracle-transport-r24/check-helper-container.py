from pathlib import Path
import json
import os
import re
import shutil
import subprocess
import sys
import time
import tomllib
import urllib.request

app=Path('/app');app.mkdir(exist_ok=True)
shutil.copytree('/golden',app,dirs_exist_ok=True)
shutil.copyfile('/seed/common_ground_seed.json',app/'common_ground_seed.json')
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
runner=Path('/tests/test.sh').read_text();private=Path('/opt/common-ground-verifier');private.mkdir(exist_ok=True,mode=0o700)
for name,marker,body in re.findall(r"cat > /opt/common-ground-verifier/([^ ]+) <<'(COMMON_GROUND_HELPER_\d+)'\n([\s\S]*?)\n\2\n",runner):
 path=private/name;path.write_text(body+'\n');path.chmod(0o600 if name.endswith('.js') else 0o700)
judge=tomllib.loads(Path('/tests/functional/judge.toml').read_text())['judge']
mcp=judge['mcp_servers'][0]
(private/'mcp-config.json').write_text(json.dumps({'cwd':judge['cwd'],'command':mcp['command'],'args':mcp['args']}))
subprocess.run([str(private/'app-lifecycle'),'start','--entry','/app/server.js','--database','/app/commonground.db','--seed','/app/common_ground_seed.json','--log','/results/app.log'],check=True)
try:
 for attempt in range(80):
  try:
   if urllib.request.urlopen('http://localhost:3000/api/health',timeout=1).status==200:break
  except OSError:time.sleep(.15)
 else:raise RuntimeError('App not ready')
 subprocess.run(['node','/validation/'+sys.argv[1]+'.cjs'],check=True,timeout=500)
finally:subprocess.run([str(private/'app-lifecycle'),'stop'],check=True)
