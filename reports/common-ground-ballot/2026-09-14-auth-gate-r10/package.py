import difflib
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import shutil
import subprocess
import tomllib
import zipfile

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).parent
TASK=ROOT/'projects/common-ground-ballot'
BASE=ROOT/'deliverables/common-ground-ballot/2026-09-13-stateful-r9'
DELIVERY=ROOT/'deliverables/common-ground-ballot/2026-09-14-auth-gate-r10'
DIMS=['render','constraints','functional','polish','visual']
load=lambda p:json.loads(p.read_text(encoding='utf-8'))
sha=lambda b:hashlib.sha256(b).hexdigest()
def emit(name,value): (OUT/name).write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')

for name,path in [('standard',ROOT/'references/task-templates/check-standard.py'),('gate',OUT/'check-auth-gate.py')]:
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
    if name=='standard':
        standard=module.validate(TASK);emit('standard-checks.json',standard)
    else:module.run()
files={p.relative_to(TASK).as_posix():p.read_bytes() for p in sorted(TASK.rglob('*')) if p.is_file()}
with zipfile.ZipFile(BASE/'common-ground-ballot.zip') as z:
    before={n.removeprefix('common-ground-ballot/'):z.read(n) for n in z.namelist()}
assert set(files)==set(before) and len(files)==36
changed=[n for n,b in files.items() if b!=before[n]]
assert set(changed)=={f'tests/{dim}/prompt.md' for dim in DIMS},changed
for n,b in files.items():
    assert len(b)<2_000_000 and not (TASK/n).is_symlink(),n
    assert n.split('/')[0] in {'instruction.md','task.toml','README.md','tests','environment','solution','rubrics'},n
    assert not {'node_modules','__pycache__','.git','reports','deliverables'}&set(Path(n).parts),n
    text=b.decode('utf-8')
    assert not re.search(r'sk-(?:or-v1-|proj-)[A-Za-z0-9_-]{16,}',text),n
    if n.endswith(('.js','.py','.toml','.sh')) or n.endswith('Dockerfile'):
        assert not re.search(r'^\s*(?://|/\*|#(?![!]))',text,re.M),n
    if n.endswith(('.css','.html')):assert '/*' not in text and '<!--' not in text,n
    if n.endswith('.sh'):assert b'\r' not in b,n
    if n.endswith('.toml'):tomllib.loads(text)
    if n.endswith('.json'):json.loads(text)
for dim in DIMS:
    assert files[f'tests/{dim}/judge.toml']==before[f'tests/{dim}/judge.toml']
    assert '{criteria}' in files[f'tests/{dim}/prompt.md'].decode()
    assert 'Independent criterion scoring:' in files[f'tests/{dim}/prompt.md'].decode()
    assert not re.search(r'GridForge|PatchPad|Bazaarbridge|Docketlight|Boardloom|Coursemark',files[f'tests/{dim}/prompt.md'].decode(),re.I)
assert files['task.toml']==before['task.toml']
for prefix,count in [('browser',32),('runtime',5),('harness',15)]:
    result=load(OUT/(prefix+'-results.json'))
    assert len(result['results'])==count and all(x['passed'] for x in result['results']),(prefix,result)
assert not load(OUT/'browser-results.json')['errors']
gates=load(OUT/'auth-gate-results.json')['results']
assert len(gates)==5 and all(x['passed'] for x in gates)
assert all(x['observations'][1]['records']>4 for x in gates),'Gates must also pass after earlier domain mutations'
validation=load(OUT/'local-validation-summary.json')
assert len(validation)==12 and all(x.get('passed',x.get('expected_failure_detected')) for x in validation)
assert sum(x.get('dimensions_rejected',0) for x in validation)==15
assert all(x['ratio']>=4.5 for x in load(OUT/'contrast-results.json'))
provenance=load(OUT/'prompt-provenance.json')
versions={'render':3,'constraints':3,'functional':10,'polish':5,'visual':3}
for dim,entry in provenance['judges'].items():
    assert entry['prompt_version'].endswith('-r'+str(versions[dim]))
    for key,file in [('judge_sha256','judge.toml'),('prompt_sha256','prompt.md')]:
        assert entry[key]==sha(files[f'tests/{dim}/{file}'])
for key,name in [('runner_sha256','test.sh'),('reward_sha256','reward.toml')]:
    assert provenance[key]==sha(files['tests/'+name])

emit('agent-expected-hashes.json',{n.removeprefix('environment/'):sha(b) for n,b in files.items() if n.startswith(('environment/instructions/','environment/assets/'))})
r=subprocess.run(['docker','run','--rm','--network','none','--mount',f'type=bind,source={OUT},target=/validation,readonly','ballot-agent:20260913-r9','node','/validation/agent-smoke.cjs'],capture_output=True,text=True,check=True)
emit('agent-smoke-results.json',json.loads(r.stdout))
emit('image-hashes.json',{name:json.loads(subprocess.check_output(['docker','image','inspect',tag],text=True))[0]['Id'] for name,tag in [('unchanged_agent','ballot-agent:20260913-r9'),('updated_verifier','ballot-verifier:20260914-r10')]})

coverage=load(BASE/'coverage.json')
coverage['global_gate_requirements']=[
    dict(source='environment/instructions/overview.md: documented account passwords, roles and signed-in identity',observations=['exact wrong-password visible refusal','correct password authenticates Ruth and shows her role'],dimensions=DIMS),
    dict(source='environment/instructions/privacy.md: private records and server-issued session authority',observations=['fresh signed-out protected read denied with no records','wrong login does not grant a usable session or private read','same protected read succeeds after legitimate sign-in and refresh'],dimensions=DIMS),
]
coverage['review_update']='Shared authentication floor corrected in all five prompts; all criterion IDs, weights, product requirements and golden source remain unchanged.'
emit('coverage.json',coverage)
review=load(BASE/'rubric-qc-review.json')
review['scope']='Focused local follow-up after user-reported platform static45/45 and rubric52/53; unchanged-source review retained, shared authentication gate reassessed. Not a fresh platform verdict.'
review['fresh_platform_qc_run']=False
review['fresh_oracle_run']=False
updates={
17:'Golden source is unchanged. All 32 local browser groups pass, including the original 27 workflows and five complete authentication gates after two restarts.',
18:'Updated gates pass in every dimension on the golden app. Original behavior, screenshots and contrast checks still pass locally; a new Oracle/Visual score is unmeasured.',
24:'All 115 reference-configuration checks pass. Another 55 focused wording checks validate the gate itself, not unrelated criterion text elsewhere in the prompt.',
26:'Unchanged criterion coverage map retained; explicit global-gate mappings added for documented passwords, signed-in identity and protected session-bound data.',
27:'No new product behavior, API name or mandatory extra status convention was introduced. Wrong password uses the existing seeded account; access refusal must not leak private records. Legitimate public demo hints remain allowed.',
28:'Criterion IDs, descriptions and weights are unchanged. Authentication is an explicit shared prerequisite with no extra reward mass; other failures remain independently scored.',
29:'All five gates now require public sign-in, wrong-password refusal, positive login/identity/backend/refresh and fresh-context denial of protected reads before and after a wrong login. A permissive password or public private-data endpoint zeros the entire dimension.',
30:'Nine deliberately broken variants detected. New permissive-password, public-collection and leaking-denial variants each fail the corresponding gate assertion in all five dimensions.',
35:'Original staff receipts, refusal receipts, roster snapshots, sessions and results pass both actual restarts. Added gate checks preserve all current domain records.',
37:'Gate uses current records after earlier mutations and new browser contexts, not reseeding, global session revocation or a requirement for original seed counts.',
39:'Three concrete authentication-bypass variants are rejected in all five dimensions by local browser assertions. These are not remote LLM shell calibrations; no fresh provider NOP run was made.',
43:'Authentication is part of each shared zero-credit prerequisite, so a detected access-boundary failure zeros Render/Constraints and the existing total reward formula. The formula itself is unchanged.',
45:'All five prompts continue treating submission text as untrusted; they forbid guessed endpoints and copied authenticated credentials in anonymous probes.',
47:'All five changed prompts have incremented plain-Markdown revisions and hashes from the actual verifier image. This removes the specific omission, not remote LLM variance or timing uncertainty.',
48:'The entire shared gate block is byte-identical across five dimensions. Exact good/bad passwords match the existing Functional check; credential-free protected reads are explicitly allowed in every dimension.',
}
for row in review['items']:
    if row['number'] in updates:row['assessment']=updates[row['number']]
review['user_reported_previous_platform']={'static':{'passed':45,'total':45},'rubric':{'passed':52,'total':53},'failed':'global_browser_gate_is_present_and_correct_in_every_dimension','source':'User screenshot, not independently fetched platform data'}
review['local_followup']={'standard_checks':115,'focused_gate_checks':55,'golden_browser_groups':32,'runtime_groups':5,'runner_cases':15,'detected_variants':9}
emit('rubric-qc-review.json',review)
lines=['# Authentication Gate QC Follow-up','','The user reported static45/45 and rubric52/53 for the previous upload.','This local review is not a new platform pass.','']
for row in review['items']:lines.extend([f"## {row['number']}. {row['criterion']}",'',row['assessment'],''])
(OUT/'QC-REVIEW.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
emit('before-after.json',dict(baseline_zip=str((BASE/'common-ground-ballot.zip').relative_to(ROOT)),baseline_sha256=sha((BASE/'common-ground-ballot.zip').read_bytes()),
    changed_files=changed,criteria_unchanged=True,weights_unchanged=True,instructions_unchanged=True,golden_source_unchanged=True,
    configuration_unchanged=True,network_public=True,versions=versions,platform_qc_run=False,oracle_run=False,paid_runs=0))
emit('source-hashes.json',{n:sha(b) for n,b in files.items()})
(OUT/'changes.diff').write_text(''.join(''.join(difflib.unified_diff(before[n].decode().splitlines(True),files[n].decode().splitlines(True),fromfile='r9/'+n,tofile='r10/'+n)) for n in changed),encoding='utf-8')

DELIVERY.mkdir(parents=True,exist_ok=True)
archive=DELIVERY/'common-ground-ballot.zip'
if archive.exists():raise RuntimeError('Do not overwrite a frozen ZIP')
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
    for n,b in files.items():
        e=zipfile.ZipInfo('common-ground-ballot/'+n,(2026,9,14,0,0,0));e.compress_type=zipfile.ZIP_DEFLATED
        e.external_attr=(0o100755 if n.endswith('.sh') else 0o100644)<<16
        z.writestr(e,b)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist())==36
    assert all(z.read('common-ground-ballot/'+n)==b for n,b in files.items())
emit('package-audit.json',dict(passed=True,archive=str(archive.relative_to(ROOT)),files=36,criteria=36,zip_bytes=archive.stat().st_size,
    zip_sha256=sha(archive.read_bytes()),standard_checks=115,gate_wording_checks=55,platform_pass_claimed=False,oracle_pass_claimed=False))
for name in ['README.md','HANDOFF.md','QC-REVIEW.md','rubric-qc-review.json','before-after.json','standard-checks.json','auth-gate-audit.json','auth-gate-results.json','coverage.json','source-hashes.json','package-audit.json','prompt-provenance.json','image-hashes.json','browser-results.json','runtime-results.json','harness-results.json','contrast-results.json','agent-smoke-results.json','local-validation-summary.json','changes.diff']:
    shutil.copyfile(OUT/name,DELIVERY/name)
(DELIVERY/'SHA256SUMS.txt').write_text(sha(archive.read_bytes())+'  '+archive.name+'\n',encoding='utf-8')
print(json.dumps(load(OUT/'package-audit.json'),indent=2))

