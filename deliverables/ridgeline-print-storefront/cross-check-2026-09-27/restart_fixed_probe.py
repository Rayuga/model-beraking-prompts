"""Normal, resistant-group and failure tests of the actual repaired helper."""
import hashlib
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

task = Path('/candidate')
source = (task / 'tests/test.sh').read_text()
helper_source = source.split("cat > \"$LOG_DIR/app-restart.sh\" <<'SH'\n", 1)[1].split('\nSH\n', 1)[0]
root = Path('/tmp/independent-fixed-restart')
root.mkdir()
os.chmod(root, 0o755)
server_js = "const http=require('http');let requests=0;http.createServer((req,res)=>{res.setHeader('content-type','application/json');res.end(JSON.stringify({pid:process.pid,requests:++requests}));}).listen(3000,'0.0.0.0');"

def fetch():
    with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=2) as response:
        return json.load(response)

def call(helper):
    request = {'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'restart_app','arguments':{}}}
    called = subprocess.run(['python3',str(task/'tests/tools/restart_mcp.py'),str(helper)],
                            input=json.dumps(request)+'\n', capture_output=True,text=True,timeout=65)
    assert called.returncode == 0, called.stderr
    return json.loads(called.stdout)

results = []
for case in ['normal_termination','sigterm_resistant_parent','sigterm_resistant_child',
             'replacement_exits','conflicting_listener']:
    case_dir = root/case
    app = case_dir/'app'
    logs = case_dir/'logs'
    app.mkdir(parents=True)
    logs.mkdir()
    os.chmod(case_dir,0o755)
    os.chmod(app,0o777)
    server = app/'server.js'
    fixture = server_js
    if case == 'sigterm_resistant_parent':
        fixture = "process.on('SIGTERM',()=>{});" + server_js
    elif case == 'sigterm_resistant_child':
        child = "process.on('SIGTERM',()=>{});" + server_js
        fixture = "require('child_process').spawn(process.execPath,['-e',"+json.dumps(child)+"],{stdio:'ignore'});setInterval(()=>{},1000);"
    elif case == 'conflicting_listener':
        fixture = 'setInterval(()=>{},1000);'
    server.write_text(fixture)
    os.chmod(server,0o644)
    proc = subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(server)],
                            cwd=app,start_new_session=True,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,
                            env={'PATH':'/usr/local/bin:/usr/bin:/bin'})
    extra = None
    new_pid = None
    try:
        if case == 'conflicting_listener':
            extra = subprocess.Popen(['node','-e',server_js],start_new_session=True,
                                     stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        for _ in range(80):
            try:
                before = fetch()
                break
            except Exception:
                time.sleep(.05)
        else:
            raise RuntimeError('fixture never started')
        (logs/'app.pid').write_text(str(proc.pid))
        if case == 'replacement_exits':
            server.write_text('process.exit(17);')
        elif case == 'sigterm_resistant_child':
            server.write_text(server_js)
        script = helper_source
        for key,value in {'LOG_DIR':logs,'APP_COPY':app,'APP_ENTRY':server,'APP_DB':app/'app.db'}.items():
            script = script.replace('__'+key+'__',str(value))
        helper = logs/'app-restart.sh'
        helper.write_text(script)
        os.chmod(helper,0o755)
        started = time.monotonic()
        response = call(helper)
        duration = time.monotonic()-started
        time.sleep(.15)
        try:
            after = fetch()
        except Exception:
            after = None
        new_pid = int((logs/'app.pid').read_text())
        expected_success = case not in ['replacement_exits','conflicting_listener']
        assert response['result']['isError'] == (not expected_success), response
        assert duration < 45, duration
        if expected_success:
            assert after and before['pid'] != after['pid'], (before,after)
            assert proc.poll() is not None, 'Old parent must have stopped'
        again = call(helper)
        assert again['result']['isError'] is True and 'already used' in again['result']['content'][0]['text']
        results.append({'case':case,'passed':True,'before':before,'after':after,'old_pid':proc.pid,
                        'helper_recorded_pid':new_pid,'old_parent_still_alive':proc.poll() is None,
                        'duration_seconds':round(duration,3),'response':response,'second_call':again,
                        'restart_log':(logs/'app-restart.log').read_text() if (logs/'app-restart.log').exists() else None})
    finally:
        for pid in [proc.pid,new_pid,extra.pid if extra else None]:
            if pid:
                try:
                    os.killpg(pid,signal.SIGKILL)
                except ProcessLookupError:
                    pass
        for item in [proc,extra]:
            if item:
                try:
                    item.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    pass
        time.sleep(.25)

report = {'passed':True,'test_sh_sha256':hashlib.sha256((task/'tests/test.sh').read_bytes()).hexdigest(),
          'scope':'Actual generated helper and canonical MCP; five lifecycle cases and single-use checks, no paid judging.',
          'results':results}
Path('/evidence/restart_fixed_probe_results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
