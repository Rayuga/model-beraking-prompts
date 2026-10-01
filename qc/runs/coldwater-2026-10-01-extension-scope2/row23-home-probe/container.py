from pathlib import Path
import hashlib
import json
import os
import shutil
import subprocess

TASK = Path('/task')
OUT = Path('/evidence')
sha = lambda p: hashlib.sha256(Path(p).read_bytes()).hexdigest()
script = (TASK / 'tests/test.sh').read_text()
assert sha(TASK / 'tests/test.sh') == 'bd68259276ca4b034654efc8a1723a4e702ed62dbe590af6201565f43eabe5aa'
prefix = script.split("python3 - <<'PY'\nfrom pathlib import Path\n", 1)[0]
assert prefix.endswith('export APP_RESTART_HELPER="$LOG_DIR/app-restart.sh"\n\n')
measure = r'''
python3 - <<'ROW23'
from pathlib import Path
import hashlib,json,os,urllib.request,urllib.error
p=Path(os.environ['VERIFIER_LOG_DIR'])
pid=(p/'app.pid').read_text().strip()
env=dict(x.split('=',1) for x in Path('/proc/'+pid+'/environ').read_text().split('\0') if '=' in x)
result={'pid':pid,'cmdline':Path('/proc/'+pid+'/cmdline').read_text().replace('\0',' '),'env':{k:env.get(k) for k in ['HOME','PORT','DB_PATH','PATH','NODE_PATH']},'http':{}}
for route in ['/api/health','/','/runner.html']:
 try:
  response=urllib.request.urlopen('http://127.0.0.1:3000'+route,timeout=3)
 except urllib.error.HTTPError as error:
  response=error
 body=response.read()
 result['http'][route]={'status':response.status,'body_sha256':hashlib.sha256(body).hexdigest(),'bytes':len(body),'first_100':body[:100].decode(errors='replace')}
result['liveness_passed']=True
(p/'observed.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result))
ROW23
'''

results = []
for case in ['home_matches_entry_control', 'canonical_home_alternative', 'weak_503_app']:
    for target in [Path('/app'), Path('/tmp/submission')]:
        assert str(target) in ['/app', '/tmp/submission']
        if target.exists():
            shutil.rmtree(target)
    shutil.copytree(TASK/'solution/app', '/app')
    Path('/assets').mkdir(exist_ok=True)
    shutil.copyfile(TASK/'environment/assets/seed_data.json','/assets/seed_data.json')
    app = Path('/app')
    if case == 'weak_503_app':
        (app/'server.js').write_text("require('node:http').createServer((q,s)=>{s.statusCode=503;s.end('Unavailable')}).listen(3000,'0.0.0.0');\n")
    else:
        (app/'public/index.html').rename(app/'public/index.html.in')
        server = (app/'server.js').read_text()
        server = server.replace('const root = __dirname;','const root = __dirname;\n// Generate the HTML entry in the documented running-app directory.\nfs.writeFileSync(path.join(process.env.HOME, \'public/index.html\'), fs.readFileSync(path.join(root, \'public/index.html.in\')));',1)
        (app/'server.js').write_text(server)
    case_out = OUT/case
    case_out.mkdir()
    shutil.copyfile(app/'server.js',case_out/'fixture-server.js')
    test = prefix
    if case == 'home_matches_entry_control':
        # Control changes only HOME to the documented entry directory.
        test = test.replace('HOME="$APP_COPY"', 'HOME="$(dirname "$APP_ENTRY")"', 1)
    (case_out/'launcher-prefix.sh').write_text(test+measure)
    env = dict(os.environ, REWARDKIT_JUDGE='launch-only-no-provider', REWARDKIT_MODEL='unused', VERIFIER_LOG_DIR=str(case_out))
    proc = subprocess.run(['bash',str(case_out/'launcher-prefix.sh')],cwd='/tests',env=env,capture_output=True,text=True,timeout=55)
    (case_out/'stdout.log').write_text(proc.stdout)
    (case_out/'stderr.log').write_text(proc.stderr)
    observed = json.loads((case_out/'observed.json').read_text()) if (case_out/'observed.json').exists() else None
    results.append({'case':case,'exit_code':proc.returncode,'observed':observed})

summary = {'input_sha256':'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8', 'scope':'Exact frozen launch prefix through restart-helper generation; no RewardKit or judge call, and no score measured. Control changes HOME only. Alternative changes only startup generation of the same public HTML bytes; weak app returns 503 for every route.', 'test_sh_sha256':sha(TASK/'tests/test.sh'), 'instruction_sha256':sha(TASK/'environment/instructions/integration.md'), 'golden_index_sha256':sha(TASK/'solution/app/public/index.html'), 'cases':results}
(OUT/'RESULTS.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps(summary,indent=2))
