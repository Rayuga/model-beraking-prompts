import json
import os
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path

results=[]
def read(url):
    with urllib.request.urlopen('http://localhost:3000'+url,timeout=2) as r:return r.read().decode()
def ready():
    for _ in range(60):
        try:
            if read('/api/health')=='ok':return
        except OSError:pass
        time.sleep(.1)
    raise AssertionError('Not ready')
def stop():subprocess.run(['python3','/tests/app-lifecycle.py','stop'],check=True)
for folder in [Path('/app'),Path('/tmp/relocated-common-ground')]:
    folder.mkdir(parents=True,exist_ok=True)
    (folder/'public').mkdir(exist_ok=True)
    (folder/'public/index.html').write_text('relative-public-marker')
    (folder/'common_ground_seed.json').write_text('{"marker":"embedded-seed"}')
    (folder/'server.js').write_text('''const fs=require('fs'),express=require('express'),db=require('better-sqlite3')(process.env.DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS probe (value TEXT)');
if(!db.prepare('SELECT COUNT(*) n FROM probe').get().n) db.prepare('INSERT INTO probe VALUES (?)').run('seed');
const seed=JSON.parse(fs.readFileSync('common_ground_seed.json','utf8'));
const app=express();app.use(express.static('public'));
app.get('/api/health',(q,s)=>s.send('ok'));
app.get('/probe',(q,s)=>s.json({uid:process.getuid(),cwd:process.cwd(),seed:seed.marker,value:db.prepare('SELECT value FROM probe').get().value,hasCredentials:Object.keys(process.env).some(k=>/API_KEY/.test(k))}));
app.post('/probe',(q,s)=>{db.prepare('UPDATE probe SET value=?').run('accepted-mutation');s.send('saved');});
app.listen(3000,'0.0.0.0');''')
    subprocess.run(['chown','-R','65534:65534',str(folder)],check=True)
    subprocess.run(['python3','/tests/app-lifecycle.py','start','--entry',str(folder/'server.js'),'--database',str(folder/'fixture.db'),'--seed',str(folder/'common_ground_seed.json')],check=True,cwd='/tests')
    try:
        ready();assert read('/')=='relative-public-marker'
        before=json.loads(read('/probe'));assert before['cwd']==str(folder) and before['uid']==65534 and not before['hasCredentials'] and before['seed']=='embedded-seed'
        req=urllib.request.Request('http://localhost:3000/probe',method='POST')
        with urllib.request.urlopen(req) as response:assert response.read()==b'saved'
        for n in (1,2):
            original=json.loads(Path('/logs/verifier/app-lifecycle.json').read_text())
            subprocess.run(['python3','/tests/app-lifecycle.py','restart'],check=True,cwd='/tests')
            current=json.loads(Path('/logs/verifier/app-lifecycle.json').read_text())
            assert current['pid']!=original['pid'] and current['database']==original['database']
            after=json.loads(read('/probe'));assert after['value']=='accepted-mutation' and after['cwd']==str(folder)
        results.append({'name':'Unprivileged relative-path app, embedded seed and two post-write restarts at '+str(folder),'passed':True})
    finally:stop()
Path('/results/lifecycle-results.json').write_text(json.dumps({'results':results},indent=2)+'\n')
print('PASS',len(results),'relative runtime and relocation scenarios')
