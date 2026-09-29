"""Disposable no-network golden run, installed browser MCP, no model."""
from pathlib import Path
import os
import subprocess
import time
import urllib.request

subprocess.run(['bash','/solution/solve.sh'],check=True)
if os.environ.get('RG_VARIANT') == 'duplicate-reject':
    server=Path('/app/src/index.js')
    body=server.read_text()
    needle="app.post('/api/orders',(req,res) => {"
    assert body.count(needle)==1
    body=body.replace(needle,needle+"\n  const keys=(req.body?.lines||[]).map(x=>x.sku+':'+x.size); if(new Set(keys).size!==keys.length) return res.status(409).json({error:'Mutant rejects repeated variants.'});")
    server.write_text(body)
env=dict(os.environ,DB_PATH='/app/app.db',PORT='3000')
with Path('/work/app.log').open('w') as log:
    app=subprocess.Popen(['node','/app/server.js'],cwd='/app',env=env,stdout=log,stderr=log)
    try:
        for i in range(80):
            if app.poll() is not None:raise RuntimeError('golden exited')
            try:
                with urllib.request.urlopen('http://localhost:3000/api/health',timeout=1):break
            except Exception:time.sleep(.1)
        else:raise RuntimeError('golden did not become ready')
        subprocess.run(['python3','/work/run_mcp.py'],check=True,timeout=240)
    finally:
        app.terminate()
        try:app.wait(timeout=5)
        except subprocess.TimeoutExpired:app.kill();app.wait()
