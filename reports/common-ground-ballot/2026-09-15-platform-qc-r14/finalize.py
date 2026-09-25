import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import zipfile

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
DELIVERY=ROOT/'deliverables/common-ground-ballot/2026-09-15-platform-qc-r14'
manifest=json.loads((OUT/'freeze-manifest.json').read_text(encoding='utf-8'))
archive=DELIVERY/'common-ground-ballot.zip'
assert hashlib.sha256(archive.read_bytes()).hexdigest()==manifest['sha256']
with zipfile.ZipFile(archive) as z:
    for name in z.namelist():
        data=z.read(name)
        assert data==(OUT/'frozen'/name).read_bytes()
        assert data==(ROOT/'projects'/name).read_bytes()
groups={'browser':45,'runtime':5,'harness':15,'session':7,'mcp':13,'qc':54,'polish':3}
for mode,count in groups.items():
    result=json.loads((OUT/('validation-'+mode)/(mode+'-results.json')).read_text(encoding='utf-8'))
    assert len(result['results'])==count and all(r['passed'] for r in result['results']),mode
    if mode=='browser':assert result['errors']==[]
negative=json.loads((OUT/'polish-negative-results.json').read_text(encoding='utf-8'))
assert negative['passed'] and negative['failed_criteria']==['reduced_motion_preference']
preflight=json.loads((OUT/'preflight-regressions.json').read_text(encoding='utf-8'))
assert len(preflight['results'])==7 and all(r['passed'] for r in preflight['results'])
provenance=json.loads((OUT/'validation-harness/prompt-provenance.json').read_text(encoding='utf-8'))
for dim in ['render','constraints','functional','polish','visual']:
    for key,file in [('prompt_sha256','prompt.md'),('judge_sha256','judge.toml')]:
        assert provenance['judges'][dim][key]==hashlib.sha256((OUT/'frozen/common-ground-ballot/tests'/dim/file).read_bytes()).hexdigest()
assert provenance['score_sha256']==hashlib.sha256((OUT/'frozen/common-ground-ballot/tests/score.py').read_bytes()).hexdigest()
hashes={p.relative_to(OUT/'frozen/common-ground-ballot/environment').as_posix():hashlib.sha256(p.read_bytes()).hexdigest() for folder in ['instructions','assets'] for p in (OUT/'frozen/common-ground-ballot/environment'/folder).rglob('*') if p.is_file()}
(OUT/'agent-expected-hashes.json').write_text(json.dumps(hashes),encoding='utf-8')
agent=subprocess.run(['docker','run','--rm','--network','none','--mount',f'type=bind,source={OUT},target=/validation,readonly','ballot-agent:20260915-r14-local','node','/validation/agent-smoke.cjs'],capture_output=True,text=True,check=True)
(OUT/'agent-smoke-results.json').write_text(agent.stdout,encoding='utf-8')
images={tag:json.loads(subprocess.check_output(['docker','image','inspect',tag],text=True))[0]['Id'] for tag in ['ballot-agent:20260915-r14-local','ballot-verifier:20260915-r14-local']}
(OUT/'image-hashes.json').write_text(json.dumps(images,indent=2)+'\n',encoding='utf-8')
audit={**manifest,'local_groups':groups,'motion_variant_detected':True,'preflight_negative_cases':7,'standard_checks':129,'archive_checks':341,'tested_frozen_archive_bytes':True,'cached_dependency_assembly_passed':True,'clean_build_passed':False,'fresh_scored_oracle':False,'fresh_gpt':False,'platform_qc':False}
(OUT/'package-audit.json').write_text(json.dumps(audit,indent=2)+'\n',encoding='utf-8')
for name in ['README.md','package-audit.json','freeze-manifest.json','source-hashes.json','changes.diff','check-standard.json','check-upload.json','polish-negative-results.json','preflight-regressions.json','image-hashes.json','agent-smoke-results.json']:
    shutil.copyfile(OUT/name,DELIVERY/name)
shutil.copyfile(OUT/'validation-harness/prompt-provenance.json',DELIVERY/'prompt-provenance.json')
shutil.copyfile(OUT/'validation-mcp/mcp-results.json',DELIVERY/'mcp-results.json')
shutil.copyfile(OUT/'coverage.json',DELIVERY/'coverage.json')
shutil.copyfile(OUT/'validation-qc/qc-results.json',DELIVERY/'qc-score-results.json')
print(json.dumps(audit,indent=2))
