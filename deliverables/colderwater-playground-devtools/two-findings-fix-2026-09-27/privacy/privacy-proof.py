import hashlib
import json
import os
from pathlib import Path
import selectors
import shutil
import signal
import subprocess
import time
import tomllib
import urllib.request

OUT=Path('/evidence')
SOURCE=Path('/source-task')
APP=Path('/tmp/cw-privacy-golden')
shutil.copytree(SOURCE/'solution/app',APP)
judge=SOURCE/'tests/scored/functional/judge.toml'
criterion=next(c for c in tomllib.loads(judge.read_text())['criterion'] if c['id']=='cw_runtime_files_not_publicly_exposed')
paths=['/app.db','/app.db-wal','/app.db-shm','/server.js','/package.json','/package-lock.json','/npm-shrinkwrap.json','/.git/config','/.git/HEAD']
assert all(p in criterion['description'] for p in paths)
sha=lambda b:hashlib.sha256(b).hexdigest()
report={'paid_provider':False,'platform_run':False,'network':'Docker --network none; only local container loopback',
        'protocol_criterion':criterion,'criterion_sha256':sha(criterion['description'].encode()),
        'judge_sha256_at_start':sha(judge.read_bytes()),'cases':[],
        'source_sha256':{str(p.relative_to(SOURCE/'solution/app')):sha(p.read_bytes()) for p in (SOURCE/'solution/app').rglob('*') if p.is_file()},
        'mcp_version':subprocess.check_output(['playwright-mcp','--version'],text=True).strip(),
        'chromium_version':subprocess.check_output(['/usr/local/bin/chromium','--version'],text=True).strip(),
        'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())}
(OUT/'frozen_privacy_criterion.json').write_text(json.dumps(criterion,indent=2)+'\n')
app_log=(OUT/'golden-server.log').open('w')
fixture_log=(OUT/'fixture-server.log').open('w')
mcp_log=(OUT/'mcp-stderr.log').open('w')
appenv={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(APP),'PORT':'3000','DB_PATH':str(APP/'app.db')}
server=subprocess.Popen(['node',str(APP/'server.js')],cwd=APP,env=appenv,start_new_session=True,stdout=app_log,stderr=subprocess.STDOUT)
fixture=subprocess.Popen(['node',str(OUT/'privacy-fixtures.cjs')],start_new_session=True,stdout=fixture_log,stderr=subprocess.STDOUT)
for url in ['http://localhost:3000/api/health','http://localhost:3202']:
    for _ in range(100):
        try:
            with urllib.request.urlopen(url,timeout=1) as response: assert response.status==200
            break
        except Exception:time.sleep(.1)
    else:raise RuntimeError('Local fixture did not start: '+url)
command=['playwright-mcp','--headless','--isolated','--executable-path=/usr/local/bin/chromium','--no-sandbox']
report['mcp_command']=command
mcp=subprocess.Popen(command,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=mcp_log,text=True,bufsize=1,start_new_session=True)
selector=selectors.DefaultSelector();selector.register(mcp.stdout,selectors.EVENT_READ)
identifier=0
def call(method,params):
    global identifier
    identifier+=1
    mcp.stdin.write(json.dumps({'jsonrpc':'2.0','id':identifier,'method':method,'params':params})+'\n');mcp.stdin.flush()
    deadline=time.monotonic()+150
    while time.monotonic()<deadline:
        assert selector.select(max(0,deadline-time.monotonic())),'MCP response timeout'
        line=mcp.stdout.readline();assert line,'MCP ended'
        reply=json.loads(line)
        if reply.get('id')==identifier:
            assert 'error' not in reply,reply
            assert not reply.get('result',{}).get('isError'),reply
            return reply['result']
    raise AssertionError('MCP response timeout')
def run_code(code):
    result=call('tools/call',{'name':'browser_run_code_unsafe','arguments':{'code':code}})
    text='\n'.join(x.get('text','') for x in result['content'])
    assert '### Result\n' in text,text
    return json.loads(text.split('### Result\n',1)[1].split('\n### ',1)[0]),result

try:
    report['initialize']=call('initialize',{'protocolVersion':'2025-06-18','capabilities':{},'clientInfo':{'name':'colderwater-independent-privacy-proof','version':'1'}})
    mcp.stdin.write(json.dumps({'jsonrpc':'2.0','method':'notifications/initialized'})+'\n');mcp.stdin.flush()
    report['tool']=next(t for t in call('tools/list',{})['tools'] if t['name']=='browser_run_code_unsafe')
    call('tools/call',{'name':'browser_navigate','arguments':{'url':'http://localhost:3202'}})
    for name,port in [('deny_only_old_three',3201),('ordinary_denial',3202),('working_spa',3203),('public_asset_name_overlap',3204),('redirect_to_workspace',3205),('denial_with_attachment',3206),('no_content',3207),('golden',3000)]:
        config={'name':name,'base':'http://localhost:'+str(port),'paths':paths}
        start=time.monotonic()
        try:
            observations,raw=run_code((OUT/'privacy-probe.js').read_text().replace('CONFIG',json.dumps(config),1))
            (OUT/(name+'-mcp.json')).write_text(json.dumps(raw,indent=2)+'\n')
            rows=observations['observations']
            assert len(rows)==len(paths) and [r['candidate'] for r in rows]==paths
            if name=='deny_only_old_three':
                exposures=[r['candidate'] for r in rows if r['outcome']=='file_download']
                assert set(exposures)=={'/.git/config','/app.db-wal','/package-lock.json'},exposures
                assert all(r['outcome']=='denied_or_missing' for r in rows if r['candidate'] in ['/app.db','/server.js','/package.json'])
                observations['criterion_verdict']='fail: three exposed generated working files despite old-three denials'
            else:
                assert all(r['outcome'] in ['denied_or_missing','no_content','working_playground_fallback','observed_public_browser_asset'] for r in rows),rows
                if name=='public_asset_name_overlap':
                    row=next(r for r in rows if r['candidate']=='/server.js')
                    assert row['outcome']=='observed_public_browser_asset' and row['status']==200
                observations['criterion_verdict']='pass in this bounded local fixture'
            observations['passed']=True
        except Exception as error:
            observations={'name':name,'passed':False,'error':str(error)}
        observations['elapsed_seconds']=round(time.monotonic()-start,3)
        report['cases'].append(observations)
        print(name,observations['passed'],flush=True)
    call('tools/call',{'name':'browser_close','arguments':{}})
    final_criterion=next(c for c in tomllib.loads(judge.read_text())['criterion'] if c['id']==criterion['id'])
    report['protocol_unchanged_during_probe']=final_criterion==criterion
    report['passed']=all(row['passed'] for row in report['cases']) and report['protocol_unchanged_during_probe']
except Exception as error:
    report['passed']=False;report['error']=str(error)
finally:
    for proc in [mcp,fixture,server]:
        if proc.poll() is None:
            os.killpg(proc.pid,signal.SIGTERM)
            try:proc.wait(timeout=5)
            except subprocess.TimeoutExpired:os.killpg(proc.pid,signal.SIGKILL);proc.wait(timeout=5)
    for log in [app_log,fixture_log,mcp_log]:log.close()
    report['finished_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    report['limitations']=['Authored local controls, not paid model verdicts.','No private response/source/database/download bodies were read or classified.','The nine paths are a bounded sample, not an exhaustive privacy guarantee.','Public asset role is demonstrated by a successful script request during an actually working Run; the fixture is benign and its implementation is known only to the fixture setup, not classified by the browser probe.']
    (OUT/'privacy_results.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'passed':report.get('passed'),'cases':len(report['cases']),'error':report.get('error')},indent=2))
    if not report.get('passed'):raise SystemExit(1)
