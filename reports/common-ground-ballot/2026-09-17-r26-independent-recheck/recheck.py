from concurrent.futures import ThreadPoolExecutor
from pathlib import Path, PurePosixPath
import hashlib
import json
import shutil
import subprocess
import sys
import time
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
PREVIOUS=HERE.parent/'2026-09-17-atomic-rounds-r26'
ZIP=ROOT/'deliverables/common-ground-ballot/2026-09-17-atomic-rounds-r26/common-ground-ballot.zip'
EXPECTED='232fe14216cfad2b1f5168866573654b2707992ae44aefb7581b684bdf7a299a'
TASK=HERE/'frozen-task/common-ground-ballot'

def prepare():
    assert hashlib.sha256(ZIP.read_bytes()).hexdigest()==EXPECTED
    with zipfile.ZipFile(ZIP) as archive:
        assert len(archive.infolist())==29 and archive.testzip() is None
        for item in archive.infolist():
            path=PurePosixPath(item.filename)
            assert path.parts[0]=='common-ground-ballot' and '..' not in path.parts and not path.is_absolute() and '\\' not in item.filename
        archive.extractall(HERE/'frozen-task')
    for name in ['check-helper-container.py','review.cjs','identity.cjs','helper-integration.cjs','browser-regression.cjs','strict-regression.cjs','staff-regression.cjs','auth-gate.cjs','rounds.cjs','runtime-smoke.py']:
        shutil.copyfile(PREVIOUS/name,HERE/name)
    # A second mode runs the old full product checks, then rounds against the
    # same mutated database/process, as the autonomous verifier would.
    source=(HERE/'check-helper-container.py').read_text(encoding='utf-8')
    source=source.replace("subprocess.run(['node','/validation/'+sys.argv[1]+'.cjs'],check=True,timeout=580)","\n for mode in (['browser-regression','rounds'] if sys.argv[1]=='integrated' else [sys.argv[1]]):\n  subprocess.run(['node','/validation/'+mode+'.cjs'],check=True,timeout=580)")
    (HERE/'check-helper-container.py').write_text(source,encoding='utf-8',newline='\n')
    manifest={p.relative_to(TASK).as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for p in TASK.rglob('*') if p.is_file()}
    old=json.loads((PREVIOUS/'package-manifest.json').read_text())
    assert manifest==old['files_sha256']
    (HERE/'input-provenance.json').write_text(json.dumps({'zip':str(ZIP.relative_to(ROOT)),'sha256':EXPECTED,'files':manifest},indent=2)+'\n',encoding='utf-8')

def run(mode):
    destination=HERE/mode
    destination.mkdir(exist_ok=True)
    cmd=['docker','run','--rm','--network','none','--env','NO_PROXY=localhost,127.0.0.1,::1','--env','no_proxy=localhost,127.0.0.1,::1','--env','LITELLM_LOCAL_MODEL_COST_MAP=True']
    mounts=[(HERE,'/validation',True),(destination,'/results',False)]
    if mode=='runtime-smoke':
        mounts.append((TASK,'/task',True))
        entry=['python3','/validation/runtime-smoke.py']
    else:
        mounts += [(TASK/'solution','/golden',True),(TASK/'tests','/tests',True),(TASK/'environment/assets/artifacts','/seed',True)]
        entry=['python3','/validation/check-helper-container.py',mode]
    for source,target,readonly in mounts:
        cmd+=['--mount',f'type=bind,source={source},target={target}'+(',readonly' if readonly else '')]
    cmd+=['ballot-verifier:20260917-r26-runtime-validation']+entry
    start=time.monotonic()
    result=subprocess.run(cmd,capture_output=True,text=True,encoding='utf-8',timeout=1250)
    (destination/'runner.log').write_text(result.stdout+'\n'+result.stderr,encoding='utf-8')
    row={'mode':mode,'passed':result.returncode==0,'elapsed_sec':round(time.monotonic()-start,3)}
    (destination/'run-result.json').write_text(json.dumps(row,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(row),result.stdout[-1300:],result.stderr[-2500:] if result.returncode else '',flush=True)
    return row

if __name__=='__main__':
    prepare()
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(run,sys.argv[1:] or ['review','identity','helper-integration','integrated','runtime-smoke']))
    (HERE/'run-results.json').write_text(json.dumps(results,indent=2)+'\n',encoding='utf-8')
    assert all(r['passed'] for r in results),results
