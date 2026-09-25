from pathlib import Path
import os
import re
import shutil
import signal
import subprocess
import time
import urllib.request

app=Path('/app');app.mkdir(exist_ok=True)
shutil.copytree('/golden',app,dirs_exist_ok=True)
shutil.copyfile('/seed/common_ground_seed.json',app/'common_ground_seed.json')
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
runner=Path('/tests/test.sh').read_text()
helper=re.search(r"cat > /opt/common-ground-verifier/browser-evidence.js <<'COMMON_GROUND_HELPER_1'\n([\s\S]*?)\nCOMMON_GROUND_HELPER_1",runner)[1]
private=Path('/opt/common-ground-verifier');private.mkdir(exist_ok=True,mode=0o700)
(private/'browser-evidence.js').write_text(helper+'\n');(private/'browser-evidence.js').chmod(0o600)
log=Path('/results/app.log').open('w')
env=dict(os.environ,PORT='3000',DB_PATH='/app/commonground.db',SEED_PATH='/app/common_ground_seed.json',NODE_PATH='/usr/local/lib/node_modules')
process=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node','server.js'],cwd=app,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
try:
 for attempt in range(80):
  if process.poll() is not None:raise RuntimeError('App failed')
  try:
   if urllib.request.urlopen('http://localhost:3000/api/health',timeout=1).status==200:break
  except OSError:time.sleep(.15)
 else:raise RuntimeError('App did not start')
 subprocess.run(['node','/validation/reproduce.cjs'],check=True,timeout=120)
finally:
 if process.poll() is None:
  os.killpg(process.pid,signal.SIGTERM)
  try:process.wait(timeout=3)
  except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=2)
 log.close()
