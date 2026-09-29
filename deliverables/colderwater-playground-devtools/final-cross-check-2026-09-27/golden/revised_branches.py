import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import tomllib
import urllib.request
import zipfile

OUT=Path('/evidence')
ARCHIVE=Path('/delivery/colderwater-playground-devtools.zip')
EXPECTED='a017932304e19209de817cdd13070c4e0ff5f8e5b8e2af72eac1078cf53357b1'
assert hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()==EXPECTED
ROOT=Path('/tmp/cw-revised-branches'); ROOT.mkdir()
with zipfile.ZipFile(ARCHIVE) as z:
    for name in z.namelist(): assert (ROOT/name).resolve().is_relative_to(ROOT)
    z.extractall(ROOT)
APP=ROOT/'colderwater-playground-devtools/solution/app'
criterion_path=Path('/current-tests/scored/functional/judge.toml')
criteria=tomllib.loads(criterion_path.read_text())['criterion']
selected_ids=['initial_examples','cw_completed_preview_interactions','cw_title_change_uniqueness','cw_shared_run_deadline_recovery','cw_pending_interaction_budget_nonextension']
selected={row['id']:row for row in criteria if row['id'] in selected_ids}
assert len(selected)==5
pending=selected['cw_pending_interaction_budget_nonextension']['description']
html=next(line for line in pending.splitlines() if line.startswith('<!doctype html>'))
completed=next(line for line in selected['cw_completed_preview_interactions']['description'].splitlines() if line.startswith('<!doctype html>'))
fixtures={'pending_html':html,'completed_html':completed,'criteria':selected}
(OUT/'revised_fixture_inputs.json').write_text(json.dumps(fixtures,indent=2)+'\n')
report={'archive_sha256':EXPECTED,'paid_provider':False,'network':'none',
        'scope':'Fresh changed golden branches and a temporary static last-successful-preview overlay valid-alternative witness; direct pinned Playwright browser actions.',
        'functional_sha256':hashlib.sha256(criterion_path.read_bytes()).hexdigest(),
        'selected_criteria':selected,
        'source_sha256':{str(p.relative_to(APP)):hashlib.sha256(p.read_bytes()).hexdigest() for p in APP.rglob('*') if p.is_file()},
        'chromium':subprocess.check_output(['/usr/local/bin/chromium','--version'],text=True).strip(),
        'mcp':subprocess.check_output(['playwright-mcp','--version'],text=True).strip(),
        'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
log=(OUT/'revised-server.log').open('w')
env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(APP),'DB_PATH':str(APP/'proof.db'),'PORT':'3000'}
server=subprocess.Popen(['node',str(APP/'server.js')],cwd=APP,env=env,start_new_session=True,stdout=log,stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://localhost:3000/api/snippets',timeout=1) as response: assert response.status==200
            break
        except Exception: time.sleep(.1)
    else: raise AssertionError('Server unavailable')
    result=subprocess.run(['node','/evidence/revised_branches.cjs'],text=True,capture_output=True,timeout=150)
    (OUT/('example-only-browser-output.log' if os.environ.get('CW_EXAMPLE_ONLY')=='1' else 'revised-browser-output.log')).write_text(result.stdout+result.stderr)
    assert result.returncode==0,result.stdout+result.stderr
    report['observations']=json.loads(result.stdout)
    assert report['observations']['passed']
    report['passed']=True
except Exception as error:
    report['passed']=False;report['error']=str(error)
finally:
    os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=5);log.close()
    report['finished_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    (OUT/('example_only_results.json' if os.environ.get('CW_EXAMPLE_ONLY')=='1' else 'revised_branches_results.json')).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:v for k,v in report.items() if k not in ['source_sha256','selected_criteria']},indent=2))
    if not report['passed']:raise SystemExit(1)
