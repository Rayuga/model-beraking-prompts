from pathlib import Path
import hashlib, json, os, subprocess, sys, tempfile
kind=sys.argv[1]
for p in ['/solution/solve.sh','/tests/test.sh','/tests/app-lifecycle.sh']:subprocess.run(['bash','-n',p],check=True)
noop=subprocess.run(['bash','/tests/test.sh'],check=True,capture_output=True,text=True)
assert json.loads(Path('/logs/verifier/reward.json').read_text())['no_op']==1
provenance=json.loads(Path('/logs/verifier/prompt-provenance.json').read_text())
for dim,entry in provenance['judges'].items():
    assert entry['prompt_version']==f'patchpad-editor-v2-{dim}-v1.0.0-r'+('4' if dim=='polish' else '3')
    assert entry['prompt_sha256']==hashlib.sha256(Path('/tests',dim,'prompt.md').read_bytes()).hexdigest()
    assert entry['judge_sha256']==hashlib.sha256(Path('/tests',dim,'judge.toml').read_bytes()).hexdigest()
Path('/results/prompt-provenance.json').write_text(json.dumps(provenance,indent=2)+'\n')
subprocess.run(['bash','/solution/solve.sh'],check=True)
if kind=='html':
    # Diagnostic-only variant in disposable /app. The real golden source stays read-only.
    server=Path('/app/src/index.js');s=server.read_text()
    s="import fs from 'node:fs';\n"+s
    hook='''app.get('/', (_req,res) => {
  const documents=db.prepare('SELECT * FROM documents ORDER BY title').all();
  const history=db.prepare('SELECT * FROM revisions ORDER BY revision DESC').all();
  const payload=JSON.stringify({documents,history}).replaceAll('<','\\u003c');
  const html=fs.readFileSync(path.resolve(__dirname,'../public/index.html'),'utf8');
  res.type('html').send(html.replace('</body>','<script id="server-state" type="application/json">'+payload+'</script></body>'));
});
app.get('/api/*path',(_req,res)=>res.status(404).json({error:'No read API in this variant'}));
'''
    anchor="app.use(express.static(path.resolve(__dirname, '../public')));";assert anchor in s;s=s.replace(anchor,hook+'\n'+anchor);server.write_text(s)
    client=Path('/app/public/js/app.js');s=client.read_text();anchor='async function api(url, options = {}) {'
    hook='''
  if (!options.method || options.method === 'GET') {
    const response=await fetch('/');
    const markup=await response.text();
    const payload=JSON.parse(new DOMParser().parseFromString(markup,'text/html').querySelector('#server-state').textContent);
    const parts=url.split('/').filter(Boolean);
    if(parts.length===2)return {documents:payload.documents};
    if(parts.length===3)return {document:payload.documents.find(d=>d.id===decodeURIComponent(parts[2]))};
    if(parts.length===4)return {revisions:payload.history.filter(r=>r.document_id===decodeURIComponent(parts[2]))};
    return {revision:payload.history.find(r=>r.document_id===decodeURIComponent(parts[2])&&r.revision===Number(parts[4]))};
  }
'''
    assert anchor in s;client.write_text(s.replace(anchor,anchor+hook))
subprocess.run(['node','--check','/app/src/index.js'],check=True)
subprocess.run(['node','--check','/app/public/js/app.js'],check=True)
stubdir=Path(tempfile.mkdtemp(prefix='patchpad-read-fairness-'));stub=stubdir/'rewardkit'
stub.write_text('''#!/usr/bin/env python3
import json,subprocess
from pathlib import Path
subprocess.run(['node','/results/server-reads.cjs'],check=True,timeout=240)
Path('/logs/verifier/reward.json').write_text(json.dumps(dict(render=1,constraints=1,functional=.5,polish=.8,visual=.6)))
''');stub.chmod(0o700)
result=subprocess.run(['bash','/tests/test.sh'],env=dict(os.environ,PATH=str(stubdir)+':'+os.environ['PATH']),capture_output=True,text=True,timeout=300)
Path('/results/runner-stdout.txt').write_text(result.stdout);Path('/results/runner-stderr.txt').write_text(result.stderr)
log=Path('/logs/verifier/rewardkit.log').read_text();Path('/results/browser-output.txt').write_text(log);print(log,flush=True)
reward=json.loads(Path('/logs/verifier/reward.json').read_text());assert result.returncode==0 and reward['reward']==.58 and reward['graded']==1,reward
assert json.loads(Path('/logs/verifier/ctrf.json').read_text())['summary']['total']==5
Path('/results/runtime-check.json').write_text(json.dumps(dict(passed=True,kind=kind,syntax=True,noop_zero=True,provenance_hashes=True,injected_reward=.58,five_dimension_ctrf=True,paid_oracle=False),indent=2)+'\n')
