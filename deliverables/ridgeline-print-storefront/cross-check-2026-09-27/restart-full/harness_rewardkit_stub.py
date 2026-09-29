#!/usr/local/bin/python3
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

out = Path(sys.argv[sys.argv.index('--output') + 1])
suite = Path(sys.argv[-1]).name
with urllib.request.urlopen('http://127.0.0.1:3000/api/health') as response:
    assert json.load(response)['ok']
assert '{app_context}' not in Path('/tests/scored/functional/prompt.md').read_text()
events = []
if suite == 'gates':
    data = {'render':1,'constraints':1}
else:
    subprocess.run(['node','/local-evidence/browser-restart-check.cjs','prepare'],check=True,timeout=100)
    old_pid = int(Path('/logs/verifier/app.pid').read_text())
    requests = [
        {'jsonrpc':'2.0','id':1,'method':'initialize','params':{}},
        {'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},
        {'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'restart_app','arguments':{}}},
    ]
    proc = subprocess.run([sys.executable,'/tests/tools/restart_mcp.py',os.environ['APP_RESTART_HELPER']],
                          input=''.join(json.dumps(x)+'\n' for x in requests),text=True,capture_output=True,timeout=60,check=True)
    replies = [json.loads(line) for line in proc.stdout.splitlines()]
    assert replies[2]['result']['isError'] is False,replies
    new_pid = int(Path('/logs/verifier/app.pid').read_text())
    assert new_pid != old_pid
    old_stat = Path(f'/proc/{old_pid}/stat')
    old_state = old_stat.read_text().rsplit(')',1)[1].strip().split()[0] if old_stat.exists() else None
    assert old_state in (None,'Z','X'),old_state
    new_state = Path(f'/proc/{new_pid}/stat').read_text().rsplit(')',1)[1].strip().split()[0]
    assert new_state not in ('Z','X'),new_state
    events.append({'actual_process_restart':{'old_pid':old_pid,'new_pid':new_pid,'old_state':old_state,'new_state':new_state}})
    events.append({'restart_mcp':replies})
    subprocess.run(['node','/local-evidence/browser-restart-check.cjs','verify'],check=True,timeout=100)
    events.append({'browser_restart_criterion':'passed'})
    data = {'functional':1,'polish':1,'visual':1}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(data))
(out.parent/'local-stub-evidence.json').write_text(json.dumps({'case':'golden','suite':suite,'events':events,'synthetic_scores_only':True},indent=2))
print('Local harness and actual browser restart checked; synthetic scores are not a judge verdict.')
