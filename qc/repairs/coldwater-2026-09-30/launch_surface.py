from pathlib import Path
import hashlib,json,os,shutil,signal,subprocess,time,urllib.request
task=Path('/task');out=Path('/evidence');app=Path('/tmp/cw-surface-app')
shutil.copytree(task/'solution/app',app)
for p in [app,*app.rglob('*')]:os.chown(p,65534,65534);p.chmod(0o755 if p.is_dir() else 0o644)
run=out/('surface-capture-'+time.strftime('%Y%m%d-%H%M%S',time.gmtime()));run.mkdir()
shutil.copytree('/proof/drivers',run/'drivers')
env=dict(os.environ,NODE_PATH='/usr/local/lib/node_modules',DB_PATH=str(app/'app.db'),PORT='3000',CW_LOG_DIR=str(run))
log=(run/'server.log').open('w')
server=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(app/'server.js')],env=env,cwd='/tmp',start_new_session=True,stdout=log,stderr=subprocess.STDOUT)
try:
 for _ in range(100):
  try:
   with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1):break
  except Exception:time.sleep(.05)
 else:raise RuntimeError('not ready')
 result=subprocess.run(['node',str(run/'drivers/surface_flow.cjs')],env=env,text=True,capture_output=True,timeout=120)
 (run/'output.log').write_text(result.stdout+result.stderr)
 report=json.loads((run/'surface-results.json').read_text())
 report['app_files_sha256']={p.relative_to(app).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in app.rglob('*') if p.is_file() and not p.name.startswith('app.db')}
 (run/'surface-results.json').write_text(json.dumps(report,indent=2)+'\n')
 print(json.dumps({'run':run.name,'passed':report['passed'],'runtime_edges_passed':report.get('runtime_edges',{}).get('passed'),'preview_after_theme':report.get('preview_after_theme'),'preview_after_resize':report.get('preview_after_resize'),'error':report.get('error')}))
finally:
 os.killpg(server.pid,signal.SIGTERM);server.wait(timeout=5);log.close()
