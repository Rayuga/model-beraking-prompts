import json
from pathlib import Path
import subprocess
import time

E=Path(__file__).resolve().parent
ROOT=E.parents[5]
NAME='cw-h2-r19-controls'
report={'scope':'Row 19 browser smoke and installed-copy controls; no configured judge grading','commands':[]}
def run(args):
    start=time.monotonic()
    p=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=120)
    report['commands'].append({'command':args,'exit_code':p.returncode,'duration_sec':round(time.monotonic()-start,3),'stdout':p.stdout,'stderr':p.stderr})
    (E/'controls.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout
def launch():
    run(['docker','exec','-d','--user','65534:65534','--workdir','/tmp',NAME,'env','-i','PATH=/usr/local/bin:/usr/bin:/bin','NODE_PATH=/usr/local/lib/node_modules','HOME=/tmp/row19-home','PORT=3000','DB_PATH=/tmp/row19-control.db','node','/app/server.js'])
def browser():
    return run(['docker','run','--rm','--network',f'container:{NAME}','--mount',f'type=bind,src={E},dst=/evidence,readonly','--entrypoint','node','colderwater-verifier:postrepair-audit-20260930','/evidence/browser.cjs'])
try:
    run(['docker','run','-d','--name',NAME,'--mount',f'type=bind,src={ROOT / ".qc-cache/coldwater-2026-10-01-history-hardening-r2/task/solution"},dst=/solution,readonly','--entrypoint','sleep','qc-coldwater-history:r2','infinity'])
    run(['docker','exec',NAME,'bash','/solution/solve.sh'])
    run(['docker','exec',NAME,'bash','-c','mkdir -p /tmp/row19-home && chown -R 65534:65534 /app /tmp/row19-home'])
    launch()
    report['exact_browser']=json.loads(browser())
    run(['docker','restart',NAME])
    run(['docker','exec',NAME,'node','-e',"const f=require('fs');let s=f.readFileSync('/app/server.js','utf8');if(!s.includes('const root = __dirname;'))process.exit(1);f.writeFileSync('/app/server.js',s.replace('const root = __dirname;','const root = process.cwd();'));"])
    launch()
    broken=json.loads(run(['docker','exec',NAME,'node','-e',"(async()=>{let h;for(let i=0;i<50;i++){try{h=await fetch('http://localhost:3000/api/health');break}catch{await new Promise(r=>setTimeout(r,100))}}const root=await fetch('http://localhost:3000/');console.log(JSON.stringify({health:h.status,root:root.status}));if(h.status!==200||root.status!==404)process.exit(1)})()"] ))
    report['broken_cwd_dependent_control']=broken
    run(['docker','restart',NAME])
    run(['docker','exec',NAME,'node','-e',"const f=require('fs');f.mkdirSync('/app/nested');f.copyFileSync('/solution/app/server.js','/app/nested/server.js');f.cpSync('/solution/app/public','/app/nested/public',{recursive:true});f.writeFileSync('/app/server.js',\"require('./nested/server.js');\\n\");"])
    run(['docker','exec',NAME,'chown','-R','65534:65534','/app'])
    launch()
    report['conforming_nested_layout_browser']=json.loads(browser())
    report['passed']=True
finally:
    run(['docker','rm','-f',NAME])
    (E/'controls.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({'passed':report.get('passed',False),'evidence':str(E/'controls.json')}))
