"""Run the real pinned MCP against a disposable golden or insecure copy."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import time
import urllib.request

app = Path('/app')
app.mkdir(exist_ok=True)
shutil.copytree('/golden', app, dirs_exist_ok=True)
shutil.copyfile('/seed/common_ground_seed.json', app / 'common_ground_seed.json')
insecure = os.environ.get('EXPECT_INSECURE_SESSION') == '1'
if insecure:
    path = app / 'server.js'
    original = path.read_text(encoding='utf-8')
    marker = '  if (!token) return null;'
    assert original.count(marker) == 1
    replacement = marker + '\n  const publicIdentity = db.prepare("SELECT id, name, email, role FROM users WHERE id = ?").get(token);\n  if (publicIdentity) return publicIdentity;'
    path.write_text(original.replace(marker, replacement, 1), encoding='utf-8')
    Path('/results/mutation.json').write_text(json.dumps({'name':'accept_public_user_id_as_session',
        'scope':'disposable container copy only','legitimate_random_session_creation_unchanged':True}), encoding='utf-8')
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
subprocess.run(['python3','/opt/common-ground-verifier/app-lifecycle.py','start','--entry','/app/server.js','--database','/app/commonground.db','--seed','/app/common_ground_seed.json'],check=True)
try:
    for attempt in range(60):
        try:
            if urllib.request.urlopen('http://localhost:3000/api/health',timeout=1).status == 200: break
        except OSError: time.sleep(.25)
    else: raise RuntimeError('Session fixture did not start')
    subprocess.run(['node','/validation/session-mcp.cjs'],check=True,timeout=180)
finally:
    subprocess.run(['python3','/opt/common-ground-verifier/app-lifecycle.py','stop'],check=True)
