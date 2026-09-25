from pathlib import Path
import json
import os
import shutil
import signal
import subprocess
import sys
import time
import urllib.request

shutil.copytree('/submission','/app',dirs_exist_ok=True,ignore=shutil.ignore_patterns('*.db','*.db-wal','*.db-shm','node_modules','AGENTS.md'))
subprocess.run([sys.executable,'/analysis/patch-copy.py'],check=True)
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
with Path('/results/server.log').open('w') as log:
    process = subprocess.Popen(['runuser','-u','nobody','--','node','/app/server.js'],cwd='/app',stdout=log,stderr=log,start_new_session=True)
    try:
        for attempt in range(100):
            try:
                if urllib.request.urlopen('http://localhost:3000/api/health',timeout=1).status == 200: break
            except OSError: time.sleep(.1)
        else: raise RuntimeError('Submission failed startup')
        subprocess.run(['node','/analysis/diagnose.cjs',sys.argv[1]],check=True,timeout=110)
    finally:
        os.killpg(process.pid,signal.SIGTERM)
        process.wait(timeout=10)
