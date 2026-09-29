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

out=Path('/evidence');log=out/('logs-deletion-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime()));log.mkdir()
archive=Path('/baseline/colderwater-playground-devtools.zip')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
expected='63a05a5e4ebf9501fd520067df33db2510f7198300be566049ee28058a18da64';assert sha(archive)==expected
root=Path('/tmp/cw-deletion-golden');root.mkdir()
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():assert (root/name).resolve().is_relative_to(root)
    z.extractall(root)
app=root/'colderwater-playground-devtools/solution/app'
criteria_file=Path('/current-tests/scored/functional/judge.toml')
criteria=tomllib.loads(criteria_file.read_text())['criterion'];assert len(criteria)==37
inputs={'functional_sha256':sha(criteria_file),'criteria':criteria};(log/'fixture-inputs.json').write_text(json.dumps(inputs,indent=2)+'\n')
report={'case':'deletion-only','baseline_archive_sha256':expected,'functional_sha256':sha(criteria_file),'paid_provider':False,'network':'none','actual_restart_calls':0,
        'source_sha256':{str(p.relative_to(app)):sha(p) for p in app.rglob('*') if p.is_file()},'log_directory':log.name,
        'probe_correction':'Retained earlier attempt used Playwright response.status() syntax on browser fetch Response. Corrected only to response.status; reran the three deletion groups independently, with no application change.',
        'browser_driver':'direct Playwright from installed MCP dependency',
        'chromium':subprocess.check_output(['/usr/local/bin/chromium','--version'],text=True).strip(),
        'installed_mcp':subprocess.check_output(['playwright-mcp','--version'],text=True).strip()}
server_log=(log/'app.log').open('w');env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(app),'PORT':'3000','DB_PATH':str(app/'app.db')}
server=subprocess.Popen(['node',str(app/'server.js')],cwd=app,env=env,start_new_session=True,stdout=server_log,stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://localhost:3000/api/snippets',timeout=1) as response:assert response.status==200
            break
        except Exception:time.sleep(.1)
    else:raise AssertionError('Server unavailable')
    result=subprocess.run(['node','/evidence/independence_proof.cjs','deletion'],env=dict(os.environ,CW_CASE='normal',CW_LOG_DIR=str(log)),text=True,capture_output=True,timeout=100)
    (log/'deletion-output.log').write_text(result.stdout+result.stderr);assert result.returncode==0,result.stdout+result.stderr
    report['deletion']=json.loads(result.stdout);assert report['deletion']['passed'];assert len(report['deletion']['checks'])==3;report['passed']=True
except Exception as error:report['passed']=False;report['error']=str(error)
finally:
    os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=5);server_log.close()
    (out/'independence-deletion-results.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({key:value for key,value in report.items() if key!='source_sha256'},indent=2))
    if not report['passed']:raise SystemExit(1)
