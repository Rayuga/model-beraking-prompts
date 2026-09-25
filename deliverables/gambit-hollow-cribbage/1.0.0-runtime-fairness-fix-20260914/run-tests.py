from pathlib import Path
import concurrent.futures,json,subprocess

OUT=Path(__file__).resolve().parent;TASK=OUT/'extracted/gambit-hollow-cribbage'
def run(case):
    name='gambit-cwd-'+case+'-20260914'
    command=['docker','run','--name',name,'-d','-e','CWD_CASE='+case]
    source=TASK/'solution' if case=='golden' else OUT/'relative-solution'
    mounts=[(OUT,'/evidence',False),(TASK/'environment/assets/club','/assets/club',True),((OUT/'previous/gambit-hollow-cribbage/tests') if case=='legacy' else TASK/'tests','/packed-tests',True),(source,'/app' if case=='readonly' else '/solution',True)]
    for p,target,ro in mounts:command+=['--mount',f'type=bind,source={p},target={target}'+(',readonly' if ro else '')]
    if case!='readonly':command+=['--tmpfs','/app:rw,exec,size=256m']
    command+=['--tmpfs','/tests:rw,exec,size=64m','--tmpfs','/logs:rw,size=64m','brickfall-preflight-verifier:2.0.4','sleep','infinity']
    subprocess.run(command,check=True,capture_output=True,text=True)
    with (OUT/('test-'+case+'.log')).open('w') as log:
        if case=='golden':
            subprocess.run(['docker','exec',name,'cp','-a','/packed-tests/.','/tests/'],check=True)
            result=subprocess.run(['docker','exec',name,'bash','/evidence/run-local.sh'],stdout=log,stderr=subprocess.STDOUT)
        else:result=subprocess.run(['docker','exec',name,'bash','/evidence/run-cwd.sh'],stdout=log,stderr=subprocess.STDOUT)
    status={'case':case,'exit_code':result.returncode,'passed':result.returncode==0};print(json.dumps(status),flush=True);return status
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(run,('legacy','normal','readonly','golden')))
(OUT/'test-results.json').write_text(json.dumps(results,indent=2)+'\n')
assert all(r['passed'] for r in results)
