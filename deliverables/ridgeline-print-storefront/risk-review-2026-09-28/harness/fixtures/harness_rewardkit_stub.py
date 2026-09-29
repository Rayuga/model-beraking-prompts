#!/usr/local/bin/python3
import json
import os
from pathlib import Path
import subprocess
import sys
import tomllib
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
    assert len(request('/api/prints')['prints']) == 8
else:
    assert 'relative-path-proof' in request('/')
    before = request('/fixture')
    assert before['cwd'] == '/app' and before['uid'] == 65534 and not before['secretPresent']
    events.append({'fixture': before})

if suite == 'gates':
    data = {'render': 0 if case == 'gate_failure' else 1, 'constraints': 1}
else:
    if case == 'golden':
        body = {'checkout_id':'harness-durable-check','lines':[{'sku':'RP-105','size':'A3','qty':1}],
                'address':{'name':'Local Check','line1':'12 Paper Street','line2':'','city':'Bristol','postcode':'BS1 1AA','country':'United Kingdom'}}
        before = request('/api/orders',body)
        assert before['total_pence'] == 3970
        def all_stock():
            return {p['sku']+':'+v['size']:v['in_stock'] for p in request('/api/prints')['prints'] for v in p['sizes']}
        snapshot=all_stock()
        historical=request('/api/orders/RP-100001')
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
        after = request('/api/orders/'+before['reference'])
        assert after == before
        assert all_stock()==snapshot and len(snapshot)==13
        assert request('/api/orders/RP-100001')==historical
        assert request('/api/orders',body) == before
        stock = next(p for p in request('/api/prints')['prints'] if p['sku']=='RP-105')['sizes'][0]['in_stock']
        assert stock == 6
        events.append({'durable_reference':before['reference'],'stock_after_restart_retry':stock})
    else:
        after = request('/fixture')
        assert after['cwd']=='/app' and after['value']=='durable' and after['uid']==65534 and not after['secretPresent']
        assert 'relative-path-proof' in request('/')
        events.append({'fixture_after_restart':after})
    data = {'functional':1,'polish':1,'visual':1}
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(data))
details={}
for path in (Path('/tests')/suite).glob('*/judge.toml'):
    spec=tomllib.loads(path.read_text()); value=data[path.parent.name]
    rows=[{'id':c['id'],'name':c['name'],'weight':c.get('weight',1),'value':value,'raw':('yes' if value else 'no') if c['type']=='binary' else 5,'reasoning':'Synthetic transport only; app evidence is recorded separately.'} for c in spec['criterion']]
    details[path.parent.name]={'score':value,'criteria':rows}
(out.parent/'reward-details.json').write_text(json.dumps(details))
(out.parent/'local-stub-evidence.json').write_text(json.dumps({'case':case,'suite':suite,'events':events,'synthetic_scores_only':True},indent=2))
print('Local harness plumbing checked; synthetic scores are not a judge evaluation.')
