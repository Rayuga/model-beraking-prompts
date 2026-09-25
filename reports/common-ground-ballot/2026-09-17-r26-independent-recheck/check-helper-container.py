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
shutil.copytree('/golden',app,dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.db','*.db-wal','*.db-shm','AGENTS.md','.gitkeep'))
shutil.copyfile('/seed/common_ground_seed.json',app/'common_ground_seed.json')
mutation=os.environ.get('BALLOT_MUTATION')
if os.environ.get('ROUND_MUTATION'):
    subprocess.run([sys.executable, '/validation/round-mutations.py', os.environ['ROUND_MUTATION']], check=True)
if mutation:
    source=app/'public/app.js'
    text=source.read_text()
    changes={
        'lose-remote':('if (sameDraftField(mine, base[key])) merged[key] = theirs;', 'if (sameDraftField(mine, base[key])) merged[key] = mine;'),
        'preselect-conflicts':('review.picks = {};', 'review.picks = {title:"yours",description:"yours",voting:"yours"};'),
        'ignore-preview-revision':('const result = await staffMutation(`/api/ballots/${review.current.id}`', 'payload.expected_revision = (await api("/api/ballots")).ballots.find(b => b.id === review.current.id).revision;\n    const result = await staffMutation(`/api/ballots/${review.current.id}`'),
        'discard-noop':('byId("discard-draft-review").addEventListener("click", async () => {', 'byId("discard-draft-review").addEventListener("click", async () => { return;'),
        'locked-save-enabled':('byId("save-draft-review").hidden = locked;\n  byId("save-draft-review").classList.toggle("hidden", locked);\n  byId("save-draft-review").disabled = locked || unresolved;', 'byId("save-draft-review").hidden = false;\n  byId("save-draft-review").classList.remove("hidden");\n  byId("save-draft-review").disabled = unresolved;'),
        'late-feedback':('const result = await sendPending(entry);\n      if (!currentStaffSession(user)) return;', 'const result = await sendPending(entry);\n      if (!currentStaffSession(user)) { notify(`Original action confirmed: ${entry.title}`); return; }'),
    }
    old,new=changes[mutation]
    assert text.count(old)==1,(mutation,text.count(old))
    source.write_text(text.replace(old,new))
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
 
 for mode in (['browser-regression','rounds'] if sys.argv[1]=='integrated' else [sys.argv[1]]):
  subprocess.run(['node','/validation/'+mode+'.cjs'],check=True,timeout=580)
finally:subprocess.run([str(private/'app-lifecycle'),'stop'],check=True)
