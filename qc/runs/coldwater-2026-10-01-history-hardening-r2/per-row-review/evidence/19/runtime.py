import hashlib
import json
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[6]
EVIDENCE = Path(__file__).resolve().parent
FROZEN = ROOT / '.qc-cache/coldwater-2026-10-01-history-hardening-r2'
NAME = 'cw-h2-r19-runtime'
REPORT = {'scope':'Row 19 isolated scripted runtime proof; not configured judge grading', 'input_sha256':'b10dbfae5ccc478c0bc422ac98a58494148a3c9c1df7b5b226d2b3a9a73f8863', 'commands':[]}

def run(args, check=True):
    start = time.monotonic()
    p = subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=120)
    item = {'command':args,'exit_code':p.returncode,'duration_sec':round(time.monotonic()-start,3),'stdout':p.stdout,'stderr':p.stderr}
    REPORT['commands'].append(item)
    (EVIDENCE/'runtime.json').write_text(json.dumps(REPORT,indent=2),encoding='utf-8')
    if check and p.returncode: raise RuntimeError(item)
    return p.stdout

def launch(custom=True):
    args=['docker','exec','-d','--user','65534:65534','--workdir','/tmp',NAME,'env','-i','PATH=/usr/local/bin:/usr/bin:/bin','NODE_PATH=/usr/local/lib/node_modules','HOME=/tmp/row19-home','PORT=3000']
    if custom: args += ['DB_PATH=/tmp/row19-state/nested/custom.db']
    args += ['node','/app/server.js']
    run(args)

def hash_file(path): return hashlib.sha256(path.read_bytes()).hexdigest()

try:
    binding=ROOT/'qc/repairs/coldwater-2026-10-01-stricter-r2/full-install-binding.json'
    index=json.loads((ROOT/'qc/runs/coldwater-2026-10-01-history-hardening-r2/raw-evidence-index.json').read_text(encoding='utf-8-sig'))
    REPORT['verified_existing_binding_sha256']=hash_file(binding)
    assert REPORT['verified_existing_binding_sha256']==index['artifacts'][binding.relative_to(ROOT).as_posix()]
    expected={p.relative_to(FROZEN/'task/solution/app').as_posix():hash_file(p) for p in (FROZEN/'task/solution/app').rglob('*') if p.is_file()}
    assert expected==json.loads(binding.read_text(encoding='utf-8-sig'))['expected_solution_hashes']
    REPORT['existing_binding_matches_frozen_solution']=True
    REPORT['solve_sha256']=hash_file(FROZEN/'task/solution/solve.sh')
    raw=(FROZEN/'task/solution/solve.sh').read_bytes()
    assert raw.startswith(b'#!/bin/bash\n') and b'\r' not in raw
    run(['docker','image','inspect','qc-coldwater-history:r2','--format','{{.Id}}'])
    run(['docker','run','-d','--name',NAME,'--mount',f'type=bind,src={FROZEN / "task/solution"},dst=/solution,readonly','--mount',f'type=bind,src={EVIDENCE},dst=/evidence','--entrypoint','sleep','qc-coldwater-history:r2','infinity'])
    run(['docker','exec','--workdir','/tmp',NAME,'bash','-n','/solution/solve.sh'])
    run(['docker','exec','--workdir','/tmp',NAME,'bash','/solution/solve.sh'])
    installed=json.loads(run(['docker','exec',NAME,'node','-e',"const fs=require('fs'),c=require('crypto'),out={};function walk(p,r=''){for(const e of fs.readdirSync(p,{withFileTypes:true})){if(e.name==='.git'||e.name==='.gitkeep')continue;const n=r+e.name;if(e.isDirectory())walk(p+'/'+e.name,n+'/');else out[n]=c.createHash('sha256').update(fs.readFileSync(p+'/'+e.name)).digest('hex')}}walk('/app');console.log(JSON.stringify(out))"]))
    assert installed==expected
    REPORT['installed_hashes_match']=installed
    run(['docker','exec',NAME,'bash','-c','test ! -e /tests && test ! -e /logs/verifier && test ! -e /app/node_modules && mkdir -p /tmp/row19-home && chown -R 65534:65534 /app /tmp/row19-home'])
    launch()
    run(['docker','exec',NAME,'node','/evidence/probe.cjs','create'])
    run(['docker','exec',NAME,'node','-e',"const f=require('fs');if(!f.existsSync('/tmp/row19-state/nested/custom.db')||f.existsSync('/app/app.db'))process.exit(1);console.log(JSON.stringify({customDB:true,defaultAbsent:true,node:process.version,express:require('express/package.json').version,sqlite:require('better-sqlite3/package.json').version,sqliteResolved:require.resolve('better-sqlite3')}))"])
    run(['docker','restart',NAME])
    launch()
    run(['docker','exec',NAME,'node','/evidence/probe.cjs','restart'])
    run(['docker','restart',NAME])
    launch(False)
    run(['docker','exec',NAME,'node','/evidence/probe.cjs','default'])
    run(['docker','exec',NAME,'node','-e',"const f=require('fs');if(!f.existsSync('/app/app.db')||f.existsSync('/tmp/app.db'))process.exit(1);console.log(JSON.stringify({defaultDB:true,cwdDBAbsent:true}))"])
    REPORT['passed']=True
finally:
    run(['docker','rm','-f',NAME],check=False)
    (EVIDENCE/'runtime.json').write_text(json.dumps(REPORT,indent=2),encoding='utf-8')
print(json.dumps({'passed':REPORT.get('passed',False),'artifact':str(EVIDENCE/'runtime.json'),'commands':len(REPORT['commands'])}))
