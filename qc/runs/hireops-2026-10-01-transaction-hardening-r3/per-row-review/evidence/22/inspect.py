"""Independent row 22 cached-image inspection. No model/provider invocation."""
import hashlib
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import time

def run(args, **kwargs):
    started = time.monotonic()
    p = subprocess.run(args, capture_output=True, text=True, timeout=45, **kwargs)
    return dict(command=args, exit_code=p.returncode, stdout=p.stdout,
                stderr=p.stderr, seconds=time.monotonic()-started)

result = {
    "scope": "Read-only cached-image inventory and private-loopback smoke; no configured judge/model or app grade",
    "rewardkit_version": importlib.metadata.version("harbor-rewardkit"),
    "test_hashes": {str(p): hashlib.sha256(p.read_bytes()).hexdigest()
                    for p in Path('/tests').rglob('*') if p.is_file()},
    "versions": [run(c) for c in [['python3', '--version'], ['node', '--version'],
        ['claude', '--version'], ['playwright-mcp', '--version'], ['chromium', '--version']]],
}
result['native_runtime'] = run(['node', '-e', "const D=require('better-sqlite3');const d=new D(':memory:');d.exec('CREATE TABLE t(n INTEGER)');d.prepare('INSERT INTO t VALUES(?)').run(22);console.log(JSON.stringify({express:require('express/package.json').version,sqlite:require('better-sqlite3/package.json').version,value:d.prepare('SELECT n FROM t').get()}));d.close();"])

browser = """
const {chromium}=require('/usr/local/lib/node_modules/@playwright/mcp/node_modules/playwright');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:'/usr/local/bin/chromium',args:['--no-sandbox']});
try {const page=await browser.newPage();await page.goto('http://127.0.0.1:3000');
const title=await page.title();await page.getByRole('button',{name:'Save'}).click();
await page.waitForTimeout(250);const first=await page.locator('#count').textContent();
const independent=await browser.newContext();const second=await independent.newPage();await second.goto('http://127.0.0.1:3000');
console.log(JSON.stringify({title,afterClick:first,freshContext:await second.locator('#count').textContent()}));
await independent.close();} finally {await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
"""
working = """
const express=require('express');const D=require('better-sqlite3');const db=new D(process.env.DB_PATH);
db.exec('CREATE TABLE IF NOT EXISTS counter(n INTEGER); INSERT INTO counter SELECT 0 WHERE NOT EXISTS(SELECT 1 FROM counter)');
const app=express();app.get('/api/health',(q,s)=>s.json({ok:true}));
app.post('/save',(q,s)=>{db.prepare('UPDATE counter SET n=n+1').run();s.sendStatus(200)});
app.get('/',(q,s)=>s.send('<title>Conforming runtime alternative</title><button onclick="fetch(\'/save\',{method:\'POST\'}).then(()=>location.reload())">Save</button><p id="count">'+db.prepare('SELECT n FROM counter').get().n+'</p>'));
app.listen(3000,'0.0.0.0');
"""
broken = """
const express=require('express');const app=express();app.get('/api/health',(q,s)=>s.json({ok:true}));
app.get('/',(q,s)=>s.send('<title>Broken static alternative</title><button>Save</button><p id="count">0</p>'));
app.listen(3000,'0.0.0.0');
"""
result['fixtures'] = []
for name, script in [('conforming_runtime',working),('broken_static_shell',broken)]:
    temp=Path('/tmp/row22-'+name);temp.mkdir();temp.chmod(0o777)
    command=['setpriv','--reuid=65534','--regid=65534','--clear-groups','node','-e',script]
    env={'PATH':'/usr/local/bin:/usr/bin:/bin','NODE_PATH':'/usr/local/lib/node_modules',
         'DB_PATH':str(temp/'app.db'),'HOME':str(temp)}
    process=subprocess.Popen(command,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
    try:
        time.sleep(1)
        observation=run(['node','-e',browser])
    finally:
        process.terminate()
        stdout,stderr=process.communicate(timeout=5)
    result['fixtures'].append(dict(name=name,app_command=command,app_env=env,
        browser=observation,app_stdout=stdout,app_stderr=stderr))
print(json.dumps(result,indent=2))
