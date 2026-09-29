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
CASE=os.environ.get('CW_CASE','normal')
assert CASE in ['normal','no-duplicate-delete']
LOG=OUT/('logs-'+CASE+'-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime()))
LOG.mkdir()
ARCHIVE=Path('/baseline/colderwater-playground-devtools.zip')
ARCHIVE_HASH='63a05a5e4ebf9501fd520067df33db2510f7198300be566049ee28058a18da64'
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(ARCHIVE)==ARCHIVE_HASH
current=Path('/current-tests')
criteria=tomllib.loads((current/'scored/functional/judge.toml').read_text())['criterion']
assert len(criteria)==37 and sum(row['weight'] for row in criteria)==49.5
fixture_inputs={'functional_sha256':sha(current/'scored/functional/judge.toml'),'criteria':criteria}
(LOG/'fixture-inputs.json').write_text(json.dumps(fixture_inputs,indent=2)+'\n')
ROOT=Path('/tmp/cw-independence-golden');ROOT.mkdir()
with zipfile.ZipFile(ARCHIVE) as z:
    for name in z.namelist():assert (ROOT/name).resolve().is_relative_to(ROOT)
    z.extractall(ROOT)
APP=ROOT/'colderwater-playground-devtools/solution/app'
for path in [APP,*APP.rglob('*')]:
    os.chown(path,65534,65534);path.chmod(0o755 if path.is_dir() else 0o644)
report={'case':CASE,'baseline_archive_sha256':ARCHIVE_HASH,'paid_provider':False,'network':'none',
        'browser_driver':'direct Playwright from installed MCP dependency',
        'restart_driver':'actual current verifier MCP restart_app',
        'functional_sha256':fixture_inputs['functional_sha256'],'log_directory':LOG.name,
        'source_sha256':{str(p.relative_to(APP)):sha(p) for p in APP.rglob('*') if p.is_file()},
        'chromium':subprocess.check_output(['/usr/local/bin/chromium','--version'],text=True).strip(),
        'installed_mcp':subprocess.check_output(['playwright-mcp','--version'],text=True).strip(),
        'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
server_log=(LOG/'app.log').open('w')
server_env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(APP),'DB_PATH':str(APP/'app.db'),'PORT':'3000'}
server=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(APP/'server.js')],cwd=APP,env=server_env,start_new_session=True,stdout=server_log,stderr=subprocess.STDOUT)
(LOG/'app.pid').write_text(str(server.pid))
probe_env=dict(os.environ,CW_CASE=CASE,CW_LOG_DIR=str(LOG))
def phase(name):
    proc=subprocess.run(['node','/evidence/independence_proof.cjs',name],env=probe_env,text=True,capture_output=True,timeout=100)
    (LOG/(name+'-output.log')).write_text(proc.stdout+proc.stderr)
    assert proc.returncode==0,proc.stdout+proc.stderr
    result=json.loads(proc.stdout)
    assert result['passed'],result
    return result
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://localhost:3000/api/snippets',timeout=1) as r:assert r.status==200
            break
        except Exception:time.sleep(.1)
    else:raise AssertionError('Server unavailable')
    text=(current/'test.sh').read_text()
    template=text.split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
    report['restart_helper_template_sha256']=hashlib.sha256(template.encode()).hexdigest()
    helper=template
    for key,value in {'__LOG_DIR__':str(LOG),'__APP_ENTRY__':str(APP/'server.js'),'__APP_COPY__':str(APP),'__APP_DB__':str(APP/'app.db')}.items():helper=helper.replace(key,value)
    helper_path=LOG/'app-restart.sh';helper_path.write_text(helper+'\n');helper_path.chmod(0o755)
    report['restart_mcp_sha256']=sha(current/'tools/restart_mcp.py')
    report['prepare']=phase('prepare')
    requests=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{}},
              {'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},
              {'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'restart_app','arguments':{}}}]
    report['pid_before']=int((LOG/'app.pid').read_text())
    reply=subprocess.run(['python3',str(current/'tools/restart_mcp.py'),str(helper_path)],input=''.join(json.dumps(r)+'\n' for r in requests),text=True,capture_output=True,timeout=60,check=True)
    report['restart_mcp_responses']=[json.loads(line) for line in reply.stdout.splitlines()]
    assert not report['restart_mcp_responses'][-1]['result']['isError'],report['restart_mcp_responses'][-1]
    report['actual_restart_calls']=1
    report['pid_after']=int((LOG/'app.pid').read_text());assert report['pid_after']!=report['pid_before'];server.wait(timeout=5)
    report['verify']=phase('verify')
    if CASE=='normal':report['deletion']=phase('deletion')
    report['passed']=True
except Exception as error:
    report['passed']=False;report['error']=str(error)
finally:
    for pid in {server.pid,int((LOG/'app.pid').read_text())}:
        try:os.killpg(pid,signal.SIGTERM)
        except ProcessLookupError:pass
    server_log.close();report['finished_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    (OUT/('independence-'+CASE+'-results.json')).write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({key:value for key,value in report.items() if key not in ['source_sha256','restart_mcp_responses']},indent=2))
    if not report['passed']:raise SystemExit(1)
