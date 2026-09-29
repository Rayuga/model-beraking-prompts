import hashlib,json,os,shutil,signal,subprocess,time,urllib.request
from pathlib import Path

OUT=Path('/evidence');TASK=Path('/task');CASE=os.environ.get('CW_CASE','golden')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
manifest=OUT/'frozen_inputs.json';inputs=json.loads(manifest.read_text());assert inputs['freeze_confirmed']
for rel,key in [('tests/scored/functional/judge.toml','functional_sha256'),('tests/scored/functional/prompt.md','prompt_sha256'),('tests/app_context.md','context_sha256')]:assert sha(TASK/rel)==inputs[key]
for rel,digest in inputs['solution_files'].items():assert sha(TASK/'solution'/rel)==digest
LOG=OUT/('run-'+CASE+'-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime()));LOG.mkdir();shutil.copytree(OUT/'drivers',LOG/'drivers')
APP=Path('/tmp/cw-positive-proof-app');shutil.copytree(Path('/variant/app') if CASE!='golden' else TASK/'solution/app',APP)
for p in [APP,*APP.rglob('*')]:os.chown(p,65534,65534);p.chmod(0o755 if p.is_dir() else 0o644)
report={'case':CASE,'scope':'Focused unpaid local proof; direct pinned Playwright','network':'none','paid_provider':False,'oracle_score_claimed':False,'started_at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'manifest_sha256':sha(manifest),'functional_sha256':inputs['functional_sha256'],'prompt_sha256':inputs['prompt_sha256'],'context_sha256':inputs['context_sha256'],'log_directory':LOG.name,'app_files':{p.relative_to(APP).as_posix():sha(p) for p in APP.rglob('*') if p.is_file()},'driver_files':{p.relative_to(LOG/'drivers').as_posix():sha(p) for p in (LOG/'drivers').rglob('*') if p.is_file()},'chromium':subprocess.check_output(['/usr/local/bin/chromium','--version'],text=True).strip()}
serverlog=(LOG/'app.log').open('w');clock=time.monotonic()
server=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(APP/'server.js')],cwd=APP,env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(APP),'DB_PATH':str(APP/'app.db'),'PORT':'3000'},start_new_session=True,stdout=serverlog,stderr=subprocess.STDOUT)
try:
    for _ in range(100):
        try:
            with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1) as response:assert response.status==200
            break
        except Exception:time.sleep(.1)
    else:raise AssertionError('App health unavailable')
    result=subprocess.run(['node',str(LOG/'drivers/run_controls.cjs')],env=dict(os.environ,CW_CASE=CASE,CW_LOG_DIR=str(LOG)),text=True,capture_output=True,timeout=90)
    (LOG/'browser-output.log').write_text(result.stdout+result.stderr)
    report['browser']=json.loads((LOG/'browser-results.json').read_text());report['node_returncode']=result.returncode
    report['expected_behavior_observed']=report['browser'].get('expected_behavior_observed',False) and result.returncode==0
except Exception as error:report['expected_behavior_observed']=False;report['error']=str(error)
finally:
    try:os.killpg(server.pid,signal.SIGTERM)
    except ProcessLookupError:pass
    serverlog.close();report['wall_seconds']=time.monotonic()-clock;report['finished_at']=time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime())
    (LOG/'RESULTS.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:report[k] for k in ['case','expected_behavior_observed','log_directory','wall_seconds','error'] if k in report},indent=2),flush=True)
    if not report['expected_behavior_observed']:raise SystemExit(1)
