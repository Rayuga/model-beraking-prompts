"""Offline pinned-MCP gate test using a disposable golden or incomplete copy."""
import json
import os
from pathlib import Path
import shutil
import signal
import subprocess
import time
import urllib.request

variant = os.environ.get('PRODUCT_GATE_MUTANT', 'golden')
assert variant in ('golden', 'readonly', 'create_only', 'publish_stub')
out = Path('/results')
out.mkdir(exist_ok=True)
app = Path('/app')
app.mkdir(exist_ok=True)
shutil.copytree('/golden', app, dirs_exist_ok=True)
shutil.copyfile('/seed/common_ground_seed.json', app / 'common_ground_seed.json')
if variant != 'golden':
    path = app / 'server.js'
    original = path.read_text(encoding='utf-8')
    marker = 'app.patch("/api/members/:id",'
    assert original.count(marker) == 1
    middleware = r'''
// Local diagnostic mutant only; authentication and all existing reads work.
app.use((request, response, next) => {
  const mutation = !['GET', 'HEAD', 'OPTIONS'].includes(request.method) && /^\/api\/(ballots|members)(\/|$)/.test(request.path);
  if (!mutation) return next();
  if (process.env.PRODUCT_GATE_MUTANT === 'readonly') return response.status(405).json({error:'Read-only fixture'});
  if (process.env.PRODUCT_GATE_MUTANT === 'create_only' && !(request.method === 'POST' && request.path === '/api/ballots')) return response.status(405).json({error:'Only creation is implemented in this fixture'});
  if (process.env.PRODUCT_GATE_MUTANT === 'publish_stub' && request.method === 'POST' && /^\/api\/ballots\/[^/]+\/publish$/.test(request.path)) {
    const user = currentUser(request);
    if (!user) return response.status(401).json({error:'Sign in required'});
    const record = ballotOrThrow(decodeURIComponent(request.path.split('/')[3]));
    // Claim success without changing the database; only a subsequent real read
    // can distinguish this cosmetic acknowledgment from completed publication.
    return response.json({ballot:ballotView({...record,status:'published',published_at:new Date().toISOString()},user)});
  }
  return next();
});
'''
    path.write_text(original.replace(marker, middleware + '\n' + marker, 1), encoding='utf-8')
    out.joinpath('mutation.json').write_text(json.dumps({'variant':variant,'scope':'disposable container copy',
        'authentication_and_populated_reads_unchanged':True,'golden_source_changed':False}, indent=2), encoding='utf-8')
subprocess.run(['chown','-R','65534:65534','/app'],check=True)
log = out.joinpath('app.log').open('ab')
environment = dict(os.environ, PORT='3000', DB_PATH='/app/commonground.db', SEED_PATH='/app/common_ground_seed.json', NODE_PATH='/usr/local/lib/node_modules')
process = subprocess.Popen(['setpriv','--reuid=65534','--regid=65534','--clear-groups','node','server.js'], cwd=app,
    env=environment, stdin=subprocess.DEVNULL, stdout=log, stderr=log, start_new_session=True)
try:
    for attempt in range(80):
        if process.poll() is not None: raise RuntimeError('Disposable app failed; inspect app.log')
        try:
            if urllib.request.urlopen('http://localhost:3000/api/health',timeout=1).status == 200: break
        except OSError: time.sleep(.15)
    else: raise RuntimeError('App did not become healthy')
    subprocess.run(['node','/validation/product-gate-mcp.cjs'],check=True,timeout=180)
    if variant == 'golden':
        first = out/'first-run'
        first.mkdir(exist_ok=True)
        for artifact in out.glob('mcp-recovery-*.json'):
            shutil.copyfile(artifact,first/artifact.name)
        # A second independent UI journey uses this same database, now containing
        # a prior custom voted/published ballot and existing sessions.
        subprocess.run(['node','/validation/product-gate-mcp.cjs'],check=True,timeout=180)
finally:
    if process.poll() is None:
        os.killpg(process.pid,signal.SIGTERM)
        try: process.wait(timeout=4)
        except subprocess.TimeoutExpired:
            os.killpg(process.pid,signal.SIGKILL)
            process.wait(timeout=2)
    log.close()
