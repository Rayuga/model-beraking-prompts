import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tomllib
import zipfile

ROOT=Path(__file__).resolve().parents[3]
OUT=Path(__file__).resolve().parent
OLD=ROOT/'reports/common-ground-ballot/2026-09-15-oracle-ready-r15'
DELIVERY=ROOT/'deliverables/common-ground-ballot/2026-09-15-coverage-r16'
TASK=OUT/'frozen/common-ground-ballot'


def read(path):return json.loads(path.read_text(encoding='utf-8'))
def write(path,value):path.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()


manifest=read(OUT/'freeze-manifest.json')
archive=DELIVERY/'common-ground-ballot.zip'
assert sha(archive)==manifest['sha256']
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None and len(z.namelist())==37
    for name in z.namelist():
        assert z.read(name)==(OUT/'frozen'/name).read_bytes()==(ROOT/'projects'/name).read_bytes()

groups={'browser':45,'runtime':5,'harness':19,'qc':109,'coverage':6,'polish':3,'mcp':19}
for mode,count in groups.items():
    result=read(OUT/('validation-'+mode)/(mode+'-results.json'))
    assert len(result['results'])==count,(mode,len(result['results']))
    assert all(r['passed'] for r in result['results']),mode
    if mode=='browser':assert result['errors']==[]
for name in ['negative-control-results.json','preflight-regressions.json']:
    rows=read(OUT/name)['results'];assert len(rows)==6 and all(r['passed'] for r in rows)
for name,count in [('check-standard.json',154),('check-upload.json',419)]:
    result=read(OUT/name);assert result['passed'] and len(result['checks'])==count

provenance=read(OUT/'validation-harness/prompt-provenance.json')
for dim in ['render','constraints','functional','polish','visual']:
    for key,name in [('prompt_sha256','prompt.md'),('judge_sha256','judge.toml')]:
        assert provenance['judges'][dim][key]==sha(TASK/'tests'/dim/name)
for key,name in [('runner_sha256','test.sh'),('reward_sha256','reward.toml'),('score_sha256','score.py')]:
    assert provenance[key]==sha(TASK/'tests'/name)

coverage=read(OLD/'coverage.json')
coverage['review_update']='r16 adds six missing positive-weight requirements. Existing criterion weights and 60/20/20 dimension allocation retained; Functional total 36 and Polish total 14.'
coverage['archive_sha256']=manifest['sha256']
additional={
    'observer_ballot_setup_access':('overview.md: Observer can review ballot setup','environment/instructions/overview.md'),
    'observer_published_results_access':('overview.md: Observer can review published results','environment/instructions/overview.md'),
    'observer_members_access':('overview.md: Observer can review Members','environment/instructions/overview.md'),
    'observer_audit_access':('overview.md: Observer can review Audit activity','environment/instructions/overview.md'),
    'status_text_without_color':('interface.md: status text does not rely on color alone','environment/instructions/interface.md'),
    'unavailable_action_guidance':('interface.md: disable or explain actions that do not apply','environment/instructions/interface.md')}
for cid,(source,file) in additional.items():
    coverage['requirements'].append({'id':'REQ-R16-'+cid,'source':source,'source_files':[file],'criteria':[cid]})
catalog=[]
for dimension in ['render','constraints','functional','polish','visual']:
    data=tomllib.loads((TASK/'tests'/dimension/'judge.toml').read_text(encoding='utf-8'))
    old=tomllib.loads((OLD/'frozen/common-ground-ballot/tests'/dimension/'judge.toml').read_text(encoding='utf-8'))
    new_by_id={c['id']:c for c in data['criterion']}
    assert data['judge']==old['judge']
    for criterion in old['criterion']:
        assert new_by_id[criterion['id']]==criterion,'Existing criterion unexpectedly changed'
    for criterion in data['criterion']:
        owners=[r['id'] for r in coverage['requirements'] if criterion['id'] in r['criteria']]
        assert owners,criterion['id']
        catalog.append({'dimension':dimension,'id':criterion['id'],'weight':criterion['weight'],'type':criterion['type'],'requirement_refs':owners})
assert len(catalog)==len({c['id'] for c in catalog})==62
assert {cid for r in coverage['requirements'] for cid in r['criteria']}=={c['id'] for c in catalog}
coverage['criteria']=catalog
write(OUT/'coverage.json',coverage)
score_rows=read(OUT/'validation-qc/qc-results.json')['results']
effects={cid:next(r for r in score_rows if r['name']=='Individual criterion changes final score: '+cid) for cid in additional}
assert all(0<r['final_reward']<1 for r in effects.values())
repair={'reported_platform_version':'v9','reported_static_passed':45,'reported_rubric_passed':52,'reported_rubric_total':53,
    'failed_platform_criterion':'dimensions_cover_every_graded_requirement','archive_sha256':manifest['sha256'],
    'fixes':[
        {'witness':'color-only status earns full marks','criteria':['status_text_without_color'],'golden_change':'Existing status labels retained; explicit verification added.'},
        {'witness':'Observer denied Members/Audit earns full marks','criteria':list(additional)[:4],'golden_change':'Existing read permissions verified, including refresh; no server change.'},
        {'witness':'unavailable lifecycle actions lack guidance but earn full marks','criteria':['unavailable_action_guidance'],'golden_change':'Contextual explanation for Draft, Open, Closed and Published.'}],
    'new_criterion_score_effects':effects,'new_criteria_independent_mutants_passed':6,
    'new_platform_qc':False,'new_oracle':False,'new_model_scores':False}
write(OUT/'qc-repair.json',repair)

expected={p.relative_to(TASK/'environment').as_posix():sha(p) for folder in ['instructions','assets'] for p in (TASK/'environment'/folder).rglob('*') if p.is_file()}
write(OUT/'agent-expected-hashes.json',expected)
agent=subprocess.run(['docker','run','--rm','--network','none','--mount',f'type=bind,source={OUT},target=/validation,readonly','ballot-agent:20260915-r15-local','node','/validation/agent-smoke.cjs'],capture_output=True,text=True,encoding='utf-8',errors='replace',check=True)
write(OUT/'agent-smoke-results.json',json.loads(agent.stdout))
images={tag:json.loads(subprocess.check_output(['docker','image','inspect',tag],text=True,encoding='utf-8'))[0]['Id'] for tag in ['ballot-agent:20260915-r15-local','ballot-verifier:20260915-r16-local']}
write(OUT/'image-hashes.json',images)
audit={**manifest,'standard_checks':154,'archive_checks':419,'local_groups':groups,'local_group_total':sum(groups.values()),
    'new_criterion_mutants_detected':6,'missing_coverage_archives_rejected':6,'all_old_criterion_weights_and_descriptions_unchanged':True,
    'frozen_source_and_provenance_match':True,'agent_inputs_match_existing_image':True,'cached_verifier_assembly_passed':True,
    'clean_build_passed':False,'platform_qc':False,'fresh_scored_oracle':False,'fresh_gpt':False,
    'test_driver_note':'Initial archive mutant helper reused mutable ZipInfo objects, altering in-memory CRC metadata. Fixed by copying each ZipInfo; original ZIP bytes unchanged. All six malformed archives then rejected as expected. The MCP status test initially compared lowercase strings with CSS-capitalized innerText; corrected the driver to ignore case. Actual evidence showed every required text status, and no task change was made for that driver correction.'}
write(OUT/'package-audit.json',audit)
for name in ['README.md','package-audit.json','qc-repair.json','coverage.json','freeze-manifest.json','source-hashes.json','changes.diff',
             'check-standard.json','check-upload.json','negative-control-results.json','preflight-regressions.json',
             'agent-smoke-results.json','image-hashes.json']:
    shutil.copyfile(OUT/name,DELIVERY/name)
for mode in groups:
    shutil.copyfile(OUT/('validation-'+mode)/(mode+'-results.json'),DELIVERY/(mode+'-results.json'))
shutil.copyfile(OUT/'validation-harness/prompt-provenance.json',DELIVERY/'prompt-provenance.json')
print(json.dumps(audit,indent=2))
