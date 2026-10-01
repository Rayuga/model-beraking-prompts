import hashlib,json,os,shutil,subprocess,time,urllib.request
from pathlib import Path
task=Path('/task'); out=Path('/evidence'); app=Path('/tmp/row18-app')
shutil.copytree(task/'solution/app',app)
binding={p.relative_to(app).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in app.rglob('*') if p.is_file()}
(out/'source-binding.json').write_text(json.dumps({'input_sha256':'ce4b8f85ae12d3b7c3fe222c948c79364600e082541c3b04f1a16039a553cea8','files':binding},indent=2))
for p in [app,*app.rglob('*')]:
 os.chown(p,65534,65534);p.chmod(0o755 if p.is_dir() else 0o644)
env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules','HOME':str(app),'DB_PATH':str(app/'app.db'),'PORT':'3000'}
with (out/'app.log').open('w') as log:
 server=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node',str(app/'server.js')],env=env,stdout=log,stderr=subprocess.STDOUT)
 try:
  for _ in range(100):
   try:
    urllib.request.urlopen('http://localhost:3000/api/health',timeout=1);break
   except Exception:time.sleep(.1)
  proc=subprocess.run(['node','/evidence/probe.cjs'],capture_output=True,text=True,timeout=60)
  (out/'browser-stdout.log').write_text(proc.stdout);(out/'browser-stderr.log').write_text(proc.stderr)
  print(json.dumps({'returncode':proc.returncode,'provider':False,'network':'none'}));raise SystemExit(proc.returncode)
 finally:server.terminate();server.wait(timeout=5)
