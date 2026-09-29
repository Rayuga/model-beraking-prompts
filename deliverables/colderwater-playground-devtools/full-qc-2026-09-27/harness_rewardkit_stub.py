#!/usr/local/bin/python3
import json
import os
from pathlib import Path
import subprocess
import sys
import urllib.request

case = os.environ['HARNESS_CASE']
out = Path(sys.argv[sys.argv.index('--output') + 1])
suite = Path(sys.argv[-1]).name

def request(path, body=None):
    raw = None if body is None else json.dumps(body).encode()
    req = urllib.request.Request('http://127.0.0.1:3000' + path, data=raw,
                                 headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as r:
        data = r.read()
        return json.loads(data) if r.headers.get('Content-Type','').startswith('application/json') else data.decode()

assert request('/api/health')['ok']
assert '{app_context}' not in Path('/tests/scored/functional/prompt.md').read_text()
events = []
if case == 'golden':
    assert isinstance(request('/api/snippets'), list)
else:
    assert 'relative-path-proof' in request('/')
    before = request('/fixture')
    assert before['cwd'] == '/app' and before['uid'] == 65534 and not before['secretPresent']
    events.append({'fixture': before})

if suite == 'gates':
    data = {'render': 0 if case == 'gate_failure' else 1, 'constraints': 1}
else:
    if case == 'golden':
        body = {'title':'Harness durable snippet','filename':'durable.js','code':'console.log(42);\n'}
        before = request('/api/snippets', body)
        assert before['revision'] == 1
    else:
        request('/write',{})
    requests = [
        {'jsonrpc':'2.0','id':1,'method':'initialize','params':{}},
        {'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},
        {'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'restart_app','arguments':{}}},
        {'jsonrpc':'2.0','id':4,'method':'tools/call','params':{'name':'restart_app','arguments':{}}},
    ]
    proc = subprocess.run([sys.executable,'/tests/tools/restart_mcp.py',os.environ['APP_RESTART_HELPER']],
          input=''.join(json.dumps(x)+'\n' for x in requests),text=True,capture_output=True,timeout=60,check=True)
    replies = [json.loads(x) for x in proc.stdout.splitlines()]
    assert replies[2]['result']['isError'] is False, replies
    assert replies[3]['result']['isError'] is True, replies
    events.append({'restart_mcp':replies})
    if case == 'golden':
        after = request('/api/snippets/' + str(before['id']))
        assert after == before
        assert len(request('/api/snippets')) == 1
        events.append({'durable_snippet': after})
    else:
        after = request('/fixture')
        assert after['cwd']=='/app' and after['value']=='durable' and after['uid']==65534 and not after['secretPresent']
        assert 'relative-path-proof' in request('/')
        events.append({'fixture_after_restart':after})
    data = {'functional':1,'polish':1,'visual':1}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(data))
(out.parent/'local-stub-evidence.json').write_text(json.dumps({'case':case,'suite':suite,'events':events,'synthetic_scores_only':True},indent=2))
print('Local harness plumbing checked; synthetic scores are not a judge evaluation.')
