"""Extract only non-secret run facts; preserve all original exports."""
from pathlib import Path
import hashlib,json,zipfile
OUT=Path(__file__).resolve().parent;ROOT=OUT.parents[2];base=ROOT/'run-outputs/patchpad-editor-v2'
trials=[]
for p in base.rglob('result.json'):
    d=json.loads(p.read_text())
    if 'task_checksum' not in d:continue
    trial=dict(run=p.parent.parent.name,trial=p.parent.name,agent=d['agent_info'],task_checksum=d['task_checksum'],rewards=d.get('verifier_result'),exception=d.get('exception_info'),started_at=d['started_at'],finished_at=d['finished_at'])
    # Avoid exporting arbitrary config/agent message fields: they may contain keys.
    detail=p.parent/'verifier/reward-details.json'
    if detail.exists():
        dims=json.loads(detail.read_text());trial['criterion_counts']={k:len(v['criteria']) for k,v in dims.items()}
        trial['functional_failures']=[{k:c[k] for k in ('id','value','weight','reasoning')} for c in dims['functional']['criteria'] if c['value']==0]
        f=dims['functional']['criteria'];score=sum(c['value']*c['weight'] for c in f)/sum(c['weight'] for c in f)
        trial['recomputed_functional']=round(score,4);trial['recomputed_reward']=round(.9*round(score,4)+.1*dims['polish']['score'],4)
        assert trial['recomputed_reward']==d['verifier_result']['rewards']['reward']
        trial['functional_passed']=sum(c['value']==1 for c in f)
    trials.append(trial)
assert len({x['task_checksum'] for x in trials})==1
oracle=next(x for x in trials if x['agent']['name']=='oracle');art=base/oracle['run']/oracle['trial']/'artifacts/app'
with zipfile.ZipFile(OUT.parent/'2.0.13-reward-alignment/patchpad-editor-v2.zip') as z:
    prefix='patchpad-editor-v2/solution/app/'
    matches={n[len(prefix):]:hashlib.sha256(z.read(n)).hexdigest()==hashlib.sha256((art/n[len(prefix):]).read_bytes()).hexdigest() for n in z.namelist() if n.startswith(prefix) and (art/n[len(prefix):]).is_file()}
report=dict(trials=trials,initial_oracle_artifact_matches_source=matches,gemini_present=any('gemini' in json.dumps(x['agent']).lower() for x in trials),scope='Observed exported run facts, not rerun predictions')
(OUT/'run-analysis.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(dict(trials=len(trials),oracle_reward=oracle['recomputed_reward'],functional_passed=oracle['functional_passed'],failures=len(oracle['functional_failures']),gemini_present=report['gemini_present'],all_initial_golden_files_match=all(matches.values()))))
