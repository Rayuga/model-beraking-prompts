import hashlib
import json
from pathlib import Path
import zipfile

out = Path(__file__).resolve().parent
root = out.parents[2]
source = root/'projects/dropline-four-connect'
rows=[]
sha=lambda data:hashlib.sha256(data).hexdigest()
for reward_path in sorted((root/'run-outputs/dropline-four-connect').glob('run-*/*/verifier/reward.json')):
    trial=reward_path.parent.parent
    result=json.loads((trial/'result.json').read_text())
    agent=result['config']['agent']
    reward=json.loads(reward_path.read_text())
    provenance=json.loads((reward_path.parent/'prompt-provenance.json').read_text())
    mismatches=[]
    for dim,data in provenance['judges'].items():
        for filename,key in [('judge.toml','judge_sha256'),('prompt.md','prompt_sha256')]:
            if sha((source/'tests'/dim/filename).read_bytes())!=data[key]:mismatches.append(dim+'/'+filename)
    for filename,key in [('test.sh','runner_sha256'),('reward.toml','reward_config_sha256')]:
        if sha((source/'tests'/filename).read_bytes())!=provenance[key]:mismatches.append(filename)
    detailpath=reward_path.parent/'reward-details.json'
    details=json.loads(detailpath.read_text()) if detailpath.exists() else {}
    calculated=0 if reward['render']<=0 or reward['constraints']<=0 else round(.6*reward['functional']+.2*reward['polish']+.2*reward['visual'],4)
    assert calculated==reward['reward']
    for dim,d in details.items():
        if not isinstance(d,dict) or 'criteria' not in d:continue
        cs=d['criteria']
        aggregation=(min(c['value'] for c in cs) if dim in ['render','constraints'] else sum(c['value']*c['weight'] for c in cs)/sum(c['weight'] for c in cs))
        assert abs(aggregation-reward[dim])<.00011,(dim,aggregation,reward[dim])
    counts={dim:dict(passed=sum(c['value']==1 for c in d['criteria']),total=len(d['criteria'])) for dim,d in details.items() if isinstance(d,dict) and 'criteria' in d}
    failures={dim:[dict(id=c['id'],score=c['value'],weight=c['weight'],reason=c['reasoning']) for c in d['criteria'] if c['value']<1] for dim,d in details.items() if isinstance(d,dict) and 'criteria' in d}
    unresolved=[c for c in failures.get('functional',[]) if any(text in c['reason'].lower() for text in ['not completed','not evidenced','not exercised'])]
    rows.append(dict(run=trial.parent.name,trial=trial.name,agent=agent['name'],model=agent.get('model_name'),task_checksum=result['task_checksum'],reward=reward,counts=counts,failures=failures,exception=result.get('exception_info'),started=result['started_at'],finished=result['finished_at'],provenance_mismatches=mismatches,missing_execution_evidence=unresolved,source_reward_sha256=sha(reward_path.read_bytes())))
checksums={r['task_checksum'] for r in rows}
assert len(checksums)==1,checksums
assert all(not r['provenance_mismatches'] for r in rows)
archive=root/'deliverables/dropline-four-connect/1.0.0-shared-journeys-r4-20260914/dropline-four-connect.zip'
with zipfile.ZipFile(archive) as z:
    assert all(z.read(n)==(source/n.removeprefix('dropline-four-connect/')).read_bytes() for n in z.namelist())
oracle=next(r for r in rows if r['agent']=='oracle')
oracleapp=root/'run-outputs/dropline-four-connect'/oracle['run']/oracle['trial']/'artifacts/app'
golden=source/'solution/app'
assert all((oracleapp/p.relative_to(golden)).read_bytes()==p.read_bytes() for p in golden.rglob('*') if p.is_file())
report=dict(runs=rows,all_runs_same_platform_task_checksum=True,current_judge_prompt_runner_reward_hashes_match=True,current_zip_sha256=sha(archive.read_bytes()),zip_matches_current_source=True,oracle_export_matches_all_golden_app_files=True,paid_runs_launched=False,new_local_oracle_pending_cases=json.loads((out/'oracle-pending.json').read_text()))
(out/'audit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps({k:v for k,v in report.items() if k not in ['runs','new_local_oracle_pending_cases']},indent=2))
for r in rows:print(r['agent'],r['model'],r['reward']['reward'],r['counts'].get('functional'))
