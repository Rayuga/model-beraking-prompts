import hashlib
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import tomllib
import urllib.request

OUT=Path('/evidence')
TASK=Path('/task')
CASE=os.environ.get('CW_CASE','golden')
MANIFEST=OUT/os.environ.get('CW_MANIFEST','frozen_final_inputs.json')
inputs=json.loads(MANIFEST.read_text())
assert inputs['freeze_confirmed'] is True
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert sha(TASK/'tests/scored/functional/judge.toml')==inputs['functional_sha256']
assert sha(TASK/'tests/scored/functional/prompt.md')==inputs['prompt_sha256']
assert sha(TASK/'tests/tools/restart_mcp.py')==inputs['restart_mcp_sha256']
for relative,digest in inputs['solution_files'].items():assert sha(TASK/'solution'/relative)==digest
LOG=OUT/('run-'+CASE+'-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime()))
LOG.mkdir()
shutil.copytree(OUT/'drivers',LOG/'drivers')
ROOT=Path('/tmp/cw-structural-workflow')
ROOT.mkdir()
APP=ROOT/'app'
source=Path('/variant/app') if CASE in ['server-extension','title-nocase','css-handlers'] else TASK/'solution/app'
shutil.copytree(source,APP)
for p in [APP,*APP.rglob('*')]:
    os.chown(p,65534,65534)
    p.chmod(0o755 if p.is_dir() else 0o644)
report={'case':CASE,'paid_provider':False,'network':'none','browser_driver':'direct pinned Playwright','restart_driver':'canonical verifier MCP restart_app','manifest_sha256':sha(MANIFEST),'functional_sha256':inputs['functional_sha256'],'prompt_sha256':inputs['prompt_sha256'],'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'log_directory':LOG.name,'actual_app_files':{p.relative_to(APP).as_posix():sha(p) for p in APP.rglob('*') if p.is_file()},'driver_sha256':{p.name:sha(p) for p in (OUT/'drivers').glob('*') if p.is_file()},'chromium':subprocess.check_output(['/usr/local/bin/chromium','--version'],text=True).strip(),'mcp':subprocess.check_output(['playwright-mcp','--version'],text=True).strip(),'criteria_count':len(inputs['criteria']),'criterion_hashes':{row['id']:hashlib.sha256(json.dumps(row,sort_keys=True).encode()).hexdigest() for row in tomllib.loads((TASK/'tests/scored/functional/judge.toml').read_text())['criterion']}}
clock=time.monotonic()
server_log=(LOG/'app.log').open('w')
env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(APP),'DB_PATH':str(APP/'app.db'),'PORT':'3000'}
server=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(APP/'server.js')],cwd=Path('/tmp'),env=env,start_new_session=True,stdout=server_log,stderr=subprocess.STDOUT)
(LOG/'app.pid').write_text(str(server.pid))
probe_env=dict(os.environ,CW_CASE=CASE,CW_LOG_DIR=str(LOG),CW_INPUTS=str(MANIFEST))
def phase(name):
    started=time.monotonic()
    proc=subprocess.run(['node',str(LOG/'drivers/run_workflow.cjs'),name],env=probe_env,text=True,capture_output=True,timeout=600)
    (LOG/(name+'-output.log')).write_text(proc.stdout+proc.stderr)
    file=LOG/(name+'-results.json')
    result=json.loads(file.read_text()) if file.exists() else {'fatal_error':'No browser result','output':proc.stdout+proc.stderr}
    result['outer_process_wall_seconds']=time.monotonic()-started
    result['node_returncode']=proc.returncode
    print(json.dumps({'phase':name,'returncode':proc.returncode,'wall_seconds':result['outer_process_wall_seconds'],'observations':[{k:r.get(k) for k in ['id','status','error']} for r in result.get('observations',[])],'fatal_error':result.get('fatal_error')}),flush=True)
    return result
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1) as response:assert response.status==200
            break
        except Exception:time.sleep(.1)
    else:raise AssertionError('Server did not become healthy')
    if CASE in ['golden','golden-feedback','restart-no-duplicate-delete']:
        text=(TASK/'tests/test.sh').read_text()
        template=text.split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
        report['restart_helper_template_sha256']=hashlib.sha256(template.encode()).hexdigest()
        helper=template
        for key,value in {'__LOG_DIR__':str(LOG),'__APP_ENTRY__':str(APP/'server.js'),'__APP_COPY__':str(APP),'__APP_DB__':str(APP/'app.db')}.items():helper=helper.replace(key,value)
        helper_path=LOG/'app-restart.sh';helper_path.write_text(helper+'\n');helper_path.chmod(0o755)
        report['pre']=phase('pre')
        state=json.loads((LOG/'workflow-state.json').read_text());assert state.get('restart'),'Restart setup absent; do not fabricate completion'
        requests=[{'jsonrpc':'2.0','id':1,'method':'initialize','params':{}},{'jsonrpc':'2.0','id':2,'method':'tools/list','params':{}},{'jsonrpc':'2.0','id':3,'method':'tools/call','params':{'name':'restart_app','arguments':{}}}]
        before=int((LOG/'app.pid').read_text());started=time.monotonic()
        reply=subprocess.run(['python3',str(TASK/'tests/tools/restart_mcp.py'),str(helper_path)],input=''.join(json.dumps(r)+'\n' for r in requests),text=True,capture_output=True,timeout=60,check=True)
        responses=[json.loads(line) for line in reply.stdout.splitlines()];assert not responses[-1]['result']['isError'],responses[-1]
        after=int((LOG/'app.pid').read_text());assert after!=before;server.wait(timeout=5)
        restart={'succeeded':True,'actual_calls':1,'pid_before':before,'pid_after':after,'wall_seconds':time.monotonic()-started,'responses':responses,'helper_template_sha256':report['restart_helper_template_sha256'],'mcp_sha256':inputs['restart_mcp_sha256']}
        (LOG/'actual-restart.json').write_text(json.dumps(restart,indent=2)+'\n');report['restart']=restart
        report['post']=phase('post')
        facts={**report['pre'].get('facts',{}),**report['post'].get('facts',{})};expected={key for criterion in inputs['criteria'] for key in criterion['evidence_keys']} if CASE=='golden' else ({key for criterion in inputs['criteria'] for key in criterion['evidence_keys'] if key.split('.')[0] in ['S21','S22','S23','S33']} if CASE=='golden-feedback' else {'S22.process_restart_durability'})
        report['facts']=facts;report['missing_fact_keys']=sorted(expected-set(facts));report['failed_fact_keys']=sorted(key for key in expected&set(facts) if not facts[key]['product_pass'])
        report['fresh_fact_keys']=sorted(expected&set(facts));report['reused_fact_keys']=[]
        report['passed']=not report['missing_fact_keys'] and not report['failed_fact_keys'] and not any(report[part].get('fatal_error') for part in ['pre','post'])
    else:
        report['variant']=phase('variant');summary=report['variant'].get('variant_results',{})
        report['passed']=summary.get('all_expectations_matched',False) and summary.get('expected_defect_observed',False)
    if CASE=='golden':
        surface=subprocess.run(['node',str(LOG/'drivers/surface_flow.cjs')],env=probe_env,text=True,capture_output=True,timeout=180)
        (LOG/'surface-output.log').write_text(surface.stdout+surface.stderr)
        report['surface']=json.loads((LOG/'surface-results.json').read_text()) if (LOG/'surface-results.json').exists() else {'passed':False,'error':'surface report absent'}
        report['surface_returncode']=surface.returncode
        report['functional_passed']=report['passed']
        report['passed']=report['passed'] and report['surface'].get('passed',False) and report['surface'].get('runtime_edges',{}).get('passed',False)
    report['runtime_completed']=True
except Exception as error:
    report['passed']=False;report['error']=str(error)
finally:
    for pid in {server.pid,int((LOG/'app.pid').read_text())}:
        try:os.killpg(pid,signal.SIGTERM)
        except ProcessLookupError:pass
    server_log.close();report['finished_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime());report['wall_seconds']=time.monotonic()-clock
    report['oracle_score_claimed']=False
    (LOG/'RESULTS.json').write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:report[k] for k in ['case','passed','log_directory','wall_seconds','fresh_fact_keys','missing_fact_keys','failed_fact_keys','error'] if k in report},indent=2),flush=True)
    if not report['passed']:raise SystemExit(1)
