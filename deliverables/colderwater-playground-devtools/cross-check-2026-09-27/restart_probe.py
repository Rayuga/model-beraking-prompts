"""Independent probe of the exact extracted restart helper; no judge calls."""
import json
import os
from pathlib import Path
import signal
import subprocess
import time
import urllib.request

SOURCE = Path('/candidate/tests/test.sh').read_text()
HELPER = SOURCE.split("cat > \"$LOG_DIR/app-restart.sh\" <<'SH'\n", 1)[1].split('\nSH\n', 1)[0]
OUT = Path('/evidence')
ROOT = Path('/tmp/independent-restart-probe')
ROOT.mkdir()
os.chmod(ROOT, 0o755)

def fetch():
    with urllib.request.urlopen('http://127.0.0.1:3000/api/health', timeout=2) as response:
        return json.load(response)

results = []
for case, ignore_term in [('normal_termination', False), ('listener_survives_sigterm', True)]:
    case_dir = ROOT / case
    app = case_dir / 'app'
    logs = case_dir / 'logs'
    app.mkdir(parents=True)
    logs.mkdir()
    os.chmod(case_dir, 0o755)
    os.chmod(app, 0o777)
    server = app / 'server.js'
    server.write_text("const http=require('http');let requests=0;"
        + ("process.on('SIGTERM',()=>{});" if ignore_term else '')
        + "http.createServer((req,res)=>{res.setHeader('content-type','application/json');"
          "res.end(JSON.stringify({pid:process.pid,requests:++requests}));}).listen(3000,'0.0.0.0');")
    os.chmod(server, 0o644)
    proc = subprocess.Popen(['setpriv', '--reuid=65534', '--regid=65534', '--clear-groups',
                             'node', str(server)], cwd=app, start_new_session=True,
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                            env={'PATH':'/usr/local/bin:/usr/bin:/bin'})
    new_pid = None
    try:
        for _ in range(80):
            try:
                before = fetch()
                break
            except Exception:
                time.sleep(.05)
        else:
            raise RuntimeError('fixture never started')
        (logs / 'app.pid').write_text(str(proc.pid))
        script = HELPER
        for key, value in {'LOG_DIR': logs, 'APP_COPY': app, 'APP_ENTRY': server,
                           'APP_DB': app / 'app.db'}.items():
            script = script.replace('__' + key + '__', str(value))
        helper = logs / 'app-restart.sh'
        helper.write_text(script)
        os.chmod(helper, 0o755)
        request = {'jsonrpc':'2.0','id':1,'method':'tools/call','params':{'name':'restart_app','arguments':{}}}
        called = subprocess.run(['python3','/candidate/tests/tools/restart_mcp.py',str(helper)],
                                 input=json.dumps(request)+'\n', capture_output=True, text=True, timeout=65)
        time.sleep(.25)
        after = fetch()
        new_pid = int((logs / 'app.pid').read_text())
        result = {'case':case,'before':before,'after':after,'old_pid':proc.pid,
                  'helper_recorded_new_pid':new_pid, 'old_process_still_alive':proc.poll() is None,
                  'restart_response':json.loads(called.stdout),
                  'restart_log':(logs / 'app-restart.log').read_text(),
                  'actual_serving_pid_changed':before['pid'] != after['pid']}
        results.append(result)
    finally:
        for pid in [proc.pid,new_pid]:
            if pid:
                try:
                    os.killpg(pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            pass
        time.sleep(.25)

evidence = {'scope':'Exact extracted helper and canonical restart_mcp.py; synthetic lifecycle only, no paid judge.',
            'results':results,
            'confirmed_false_success':results[1]['restart_response']['result']['isError'] is False
                and not results[1]['actual_serving_pid_changed']}
(OUT / 'restart_probe_results.json').write_text(json.dumps(evidence,indent=2)+'\n')
print(json.dumps(evidence,indent=2))
