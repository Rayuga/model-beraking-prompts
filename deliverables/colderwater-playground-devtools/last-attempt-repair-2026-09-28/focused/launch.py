from pathlib import Path
import subprocess,time,urllib.request,os
subprocess.run(['bash','/root/task/solution/solve.sh'],check=True)
log=Path('/work/app.log').open('w')
app=subprocess.Popen(['node','/app/server.js'],cwd='/tmp',env=dict(os.environ,PORT='3000',DB_PATH='/app/app.db'),stdout=log,stderr=log)
try:
 for i in range(100):
  try:
   urllib.request.urlopen('http://localhost:3000/api/health',timeout=1);break
  except Exception:time.sleep(.1)
 else:raise RuntimeError('App failed startup')
 subprocess.run(['node','/work/'+os.environ.get('CW_PROBE','focused.cjs')],check=True,timeout=150)
finally:
 app.terminate();app.wait(timeout=10);log.close()
