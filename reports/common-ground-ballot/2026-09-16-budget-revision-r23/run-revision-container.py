"""Run a disposable golden or vote-revision mutant with pinned MCP."""
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import urllib.request

variant = os.environ['REVISION_MUTANT']
assert variant in ('golden','vote_increment','single_increment','approval_increment')
app=Path('/app');app.mkdir(exist_ok=True)
shutil.copytree('/golden',app,dirs_exist_ok=True)
shutil.copyfile('/seed/common_ground_seed.json',app/'common_ground_seed.json')
if variant != 'golden':
    path=app/'server.js';text=path.read_text()
    marker='        ).run(ballot.id, request.user.id, timestamp, receiptId);'
    assert text.count(marker)==1
    condition={'vote_increment':'true','single_increment':"ballot.method === 'single'",'approval_increment':"ballot.method === 'approval'"}[variant]
    extra='\n        if ('+condition+') db.prepare("UPDATE ballots SET revision = revision + 1 WHERE id = ?").run(ballot.id);'
    path.write_text(text.replace(marker,marker+extra),encoding='utf-8')
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
log=Path('/results/app.log').open('w')
env=dict(os.environ,PORT='3000',DB_PATH='/app/commonground.db',SEED_PATH='/app/common_ground_seed.json',NODE_PATH='/usr/local/lib/node_modules')
process=subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node','server.js'],cwd=app,env=env,stdin=subprocess.DEVNULL,stdout=log,stderr=log,start_new_session=True)
try:
    for attempt in range(80):
        if process.poll() is not None: raise RuntimeError('App failed; inspect app.log')
        try:
            if urllib.request.urlopen('http://localhost:3000/api/health',timeout=1).status==200:break
        except OSError:time.sleep(.15)
    else:raise RuntimeError('App not healthy')
    subprocess.run(['node','/validation/revision-mcp.cjs'],check=True,timeout=180)
finally:
    if process.poll() is None:
        os.killpg(process.pid,signal.SIGTERM)
        try:process.wait(timeout=4)
        except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=2)
    log.close()
