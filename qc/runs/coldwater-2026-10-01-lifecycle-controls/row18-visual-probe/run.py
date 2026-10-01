import hashlib,json,os,shutil,subprocess,time,urllib.request
from pathlib import Path

out=Path('/evidence')
source=Path('/task/solution/app')
app=Path('/tmp/row18-visual-app')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
report={'scope':'Focused visual discrepancy diagnostic; offline disposable app; no provider', 'round_input_sha256':'6a1e1645d3f5518ba2b935fdb339053a96ae6cbfbaeb48546616d752f3133ca2','source_files':{p.relative_to(source).as_posix():sha(p) for p in source.rglob('*') if p.is_file()},'probe_sha256':sha(out/'probe.cjs'),'launcher_sha256':sha(out/'run.py')}
shutil.copytree(source,app)
for p in [app,*app.rglob('*')]:
 os.chown(p,65534,65534)
 p.chmod(0o755 if p.is_dir() else 0o644)
env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(app),'DB_PATH':str(app/'app.db'),'PORT':'3000'}
started=time.monotonic()
log=(out/'app.log').open('w')
server=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(app/'server.js')],env=env,cwd='/tmp',stdout=log,stderr=subprocess.STDOUT)
try:
 for _ in range(100):
  try:
   with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1) as response:
    if response.status==200:break
  except Exception:time.sleep(.1)
 else:raise RuntimeError('Health response unavailable')
 proc=subprocess.run(['node','/evidence/probe.cjs'],env=env,capture_output=True,text=True,timeout=90)
 (out/'stdout.log').write_text(proc.stdout)
 (out/'stderr.log').write_text(proc.stderr)
 report['returncode']=proc.returncode
finally:
 server.terminate()
 try:server.wait(timeout=5)
 except subprocess.TimeoutExpired:server.kill();server.wait(timeout=5)
 log.close()
 report['wall_seconds']=time.monotonic()-started
 (out/'source-binding.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'returncode':report.get('returncode'),'wall_seconds':report['wall_seconds']}))
