import hashlib
import json
from pathlib import Path
import subprocess

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent
runs={
    'gpt':('run-2963ba24-c836-4365-8e01-63940a4ce48e','common-ground-ballot__tk6E7rd'),
    'gemini':('run-52d9075b-82c7-432c-b4fe-00221a5f5c8c','common-ground-ballot__WSHYPaA'),
    'haiku':('run-ead1a582-4acd-44ad-b63a-b5cfc1bbe247','common-ground-ballot__SNyMaDf'),
}
summary=[]
for model,(run,trial) in runs.items():
    source=ROOT/'run-outputs/common-ground-ballot'/run/trial/'artifacts/app'
    hashes={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    args=['docker','run','--rm','--network','none']
    for path,target,ro in [(source,'/model',True),(OUT,'/validation',True),(OUT,'/results',False)]:
        args+=['--mount',f'type=bind,source={path},target={target}'+(',readonly' if ro else '')]
    args+=['ballot-verifier:20260913-r9','node','/validation/model-scope.cjs',model]
    result=subprocess.run(args,capture_output=True,text=True,encoding='utf-8',errors='replace',timeout=200)
    (OUT/(model+'-scope.log')).write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    print(model,result.returncode,result.stdout[-1000:],flush=True)
    after={p.relative_to(source).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in source.rglob('*') if p.is_file()}
    assert hashes==after
    summary.append(dict(model=model,run=run,trial=trial,diagnostic_completed=result.returncode==0,source_unchanged=True,source_hashes=hashes))
(OUT/'model-source-audit.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
assert all(x['diagnostic_completed'] for x in summary)

