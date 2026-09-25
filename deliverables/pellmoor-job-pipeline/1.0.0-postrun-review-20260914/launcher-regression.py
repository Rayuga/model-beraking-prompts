from pathlib import Path
import json, os, signal, subprocess, time, urllib.request, urllib.error

evidence = Path('/evidence')
root = Path('/app')
(root/'backend').mkdir(parents=True, exist_ok=True)
(root/'public').mkdir(exist_ok=True)
(root/'public/index.html').write_text('<!doctype html><title>Relative static witness</title><main>relative-static-ok</main>')
(root/'backend/server.js').write_text("const express=require('express');const app=express();app.get('/health',(_,res)=>res.json({cwd:process.cwd()}));app.use(express.static('public'));app.get('/',(_,res)=>res.sendFile(__dirname+'/../public/index.html'));app.listen(process.env.PORT);")
os.chmod('/tests', 0o700)
for p in [root, *root.rglob('*')]:
    os.chmod(p, 0o755 if p.is_dir() else 0o644)
    os.chown(p, 65534, 65534)

def get(path):
    try:
        with urllib.request.urlopen('http://localhost:3000'+path, timeout=2) as r:
            return r.status, r.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

results=[]
for label, source in [('original',evidence/'source-before-review/tests/test.sh'),('corrected',Path('/source/tests/test.sh'))]:
    text=source.read_text()
    command=text.split('setsid env -i \\\n',1)[1].split('\nAPP_PID=',1)[0]
    command='setsid env -i \\\n'+command
    command=command.replace('>"$LOG_DIR/app.log" 2>&1 &','2>&1')
    assert command.endswith('2>&1')
    env=dict(os.environ, APP_COPY='/app', APP_ENTRY='/app/backend/server.js',APP_DB='/app/pellmoor.db')
    with (evidence/f'launcher-{label}.log').open('w') as log:
        process=subprocess.Popen(['bash','-c','exec '+command],cwd='/tests',env=env,stdout=log,stderr=subprocess.STDOUT)
        try:
            for _ in range(50):
                try:
                    status,body=get('/health')
                    if status==200: break
                except OSError: pass
                time.sleep(.1)
            assert status==200
            cwd=json.loads(body)['cwd']
            status,body=get('/')
            if label=='original':
                assert cwd=='/tests' and status==500 and 'EACCES' in body and '/tests/public/index.html' in body
            else:
                assert cwd=='/app' and status==200 and 'relative-static-ok' in body
            results.append(dict(launcher=label,cwd=cwd,root_status=status,expected=True))
        finally:
            os.killpg(process.pid,signal.SIGTERM)
            process.wait(timeout=10)
(evidence/'launcher-regression.json').write_text(json.dumps({'scope':'Minimal reproduction using the exported Haiku static-path pattern and the exact old/new launch commands; not a rerun or score of Haiku', 'results':results},indent=2)+'\n')
print(json.dumps(results))
