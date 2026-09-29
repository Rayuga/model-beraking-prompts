import json, os, shutil, signal, subprocess, time, urllib.request
from pathlib import Path

case=os.environ['CW_CASE']; task=Path('/task'); evidence=Path('/evidence'); variant=Path('/variant')
app=task/'solution/app' if case=='golden' else variant/'app'; work=Path('/tmp/cw-final-focused-app')
shutil.copytree(app,work)
for item in [work,*work.rglob('*')]:
    os.chown(item,65534,65534); item.chmod(0o755 if item.is_dir() else 0o644)
result_file=evidence/f'{case}.json'; log_file=evidence/f'{case}-app.log'; started=time.monotonic()
with log_file.open('w') as log:
    server=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(work/'server.js')],cwd=work,env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(work),'DB_PATH':str(work/'app.db'),'PORT':'3000'},start_new_session=True,stdout=log,stderr=subprocess.STDOUT)
    try:
        for _ in range(100):
            try:
                with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1) as response:
                    if response.status==200: break
            except Exception: time.sleep(.1)
        else: raise RuntimeError('app health unavailable')
        run=subprocess.run(['node','/drivers/focused_proof.cjs'],env=dict(os.environ,CW_RESULT=str(result_file)),text=True,capture_output=True,timeout=150)
        (evidence/f'{case}-browser.log').write_text(run.stdout+run.stderr)
        if run.returncode: raise RuntimeError(f'browser proof exit {run.returncode}')
    finally:
        try: os.killpg(server.pid,signal.SIGTERM)
        except ProcessLookupError: pass
summary=json.loads(result_file.read_text());summary['wall_seconds']=time.monotonic()-started;result_file.write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({'case':case,'expected_behavior_observed':summary['expected_behavior_observed'],'wall_seconds':summary['wall_seconds']},indent=2))
