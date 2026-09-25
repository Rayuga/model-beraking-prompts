from pathlib import Path
import hashlib
import json
import stat
import subprocess
import sys
import zipfile

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[2]
TASK=ROOT/'projects/common-ground-ballot'
DEST=ROOT/'deliverables/common-ground-ballot/2026-09-17-atomic-rounds-r26'
ZIP=DEST/'common-ground-ballot.zip'
assert not ZIP.exists(), 'Published ZIPs are immutable; choose a new release for changes.'
checks={}
for mode,name,count in [('rounds','rounds-results.json',18),('review','review-results.json',7),('identity','identity-results.json',7),('helper-integration','helper-results.json',19),('browser-regression','browser-results.json',45)]:
    result=json.loads((HERE/mode/name).read_text(encoding='utf-8'))
    assert len(result['results'])==count and all(r['passed'] for r in result['results']), mode
    checks[mode]=count
assert sum(checks.values())==96
assert json.loads((HERE/'runtime-smoke/runtime-smoke-results.json').read_text())['passed']==30
mutations=json.loads((HERE/'round-mutation-results.json').read_text(encoding='utf-8'))
assert len(mutations)==6 and all(r['detected'] for r in mutations)
gpt=json.loads((HERE/'gpt-replay/gpt-replay-results.json').read_text(encoding='utf-8'))
assert gpt['passed']==7 and gpt['failed']==0 and len(gpt['observations'])==7
subprocess.run([sys.executable,str(HERE/'write-release-review.py')],check=True)
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files)==29
changes=json.loads((HERE/'change-review.json').read_text())
assert len(changes['changed'])==9 and len(changes['unchanged'])==20
provenance=json.loads((HERE/'runtime-smoke/runner-1/prompt-provenance.json').read_text())
for dim,info in provenance['judges'].items():
    assert hashlib.sha256(files[f'tests/{dim}/prompt.md']).hexdigest()==info['prompt_sha256']
    assert hashlib.sha256(files[f'tests/{dim}/judge.toml']).hexdigest()==info['judge_sha256']
subprocess.run([sys.executable,str(HERE/'validate-package.py')],check=True)
DEST.mkdir(parents=True,exist_ok=True)
with zipfile.ZipFile(ZIP,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
    for name,data in sorted(files.items()):
        item=zipfile.ZipInfo('common-ground-ballot/'+name,date_time=(2026,9,17,0,0,0))
        item.create_system=3
        item.external_attr=(stat.S_IFREG|(0o755 if name.endswith('.sh') else 0o644))<<16
        item.compress_type=zipfile.ZIP_DEFLATED
        z.writestr(item,data)
subprocess.run([sys.executable,str(HERE/'validate-package.py'),str(ZIP)],check=True)
manifest={'archive':str(ZIP.relative_to(ROOT)),'sha256':hashlib.sha256(ZIP.read_bytes()).hexdigest(),'bytes':ZIP.stat().st_size,'files':29,'changed_files':changes['changed'],'verifiers':5,'criteria':86,'functional_criteria':66,'functional_total_weight':103.5,'golden_browser_checks':checks,'golden_browser_passes':96,'round_mutants_detected':6,'runner_checks_passed':30,'prior_gpt_replay_checks':7,'fresh_scored_oracle':False,'fresh_scored_model':False,'files_sha256':{n:hashlib.sha256(d).hexdigest() for n,d in sorted(files.items())}}
(HERE/'package-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
print(json.dumps({k:v for k,v in manifest.items() if k!='files_sha256'},indent=2))
