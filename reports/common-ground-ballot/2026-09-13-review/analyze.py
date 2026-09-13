import csv
import hashlib
import json
from pathlib import Path
import tomllib
import zipfile

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
ARCHIVE = ROOT / 'deliverables/common-ground-ballot/2026-09-12-judge-r5/common-ground-ballot.zip'
sha = lambda b: hashlib.sha256(b).hexdigest()
load = lambda p: json.loads(p.read_text(encoding='utf-8'))
with zipfile.ZipFile(ARCHIVE) as z:
    source = {n.removeprefix('common-ground-ballot/'): z.read(n) for n in z.namelist()}
expected = {c['id']: (dim, c) for dim in ['render','constraints','functional','polish','visual']
            for c in tomllib.loads(source[f'tests/{dim}/judge.toml'].decode())['criterion']}
runs = []
for p in sorted((ROOT/'run-outputs/common-ground-ballot').glob('run-*/*/result.json')):
    r = load(p)
    a = r['agent_info']
    model = (a.get('model_info') or {}).get('name') or a['name']
    scores = r['verifier_result']['rewards']
    assert r['finished_at'] and r.get('exception_info') is None
    assert scores == load(p.parent/'verifier/reward.json')
    calculated = 0 if min(scores['render'],scores['constraints']) <= 0 else round(.6*scores['functional']+.2*scores['polish']+.2*scores['visual'],4)
    assert calculated == scores['reward'] == float((p.parent/'verifier/reward.txt').read_text())
    provenance = load(p.parent/'verifier/prompt-provenance.json')
    hashes = {dim+'/'+file: entry[key] == sha(source[f'tests/{dim}/{file}'])
              for dim,entry in provenance['judges'].items()
              for key,file in [('prompt_sha256','prompt.md'),('judge_sha256','judge.toml')]}
    hashes.update({name:provenance[key] == sha(source['tests/'+name]) for key,name in [('runner_sha256','test.sh'),('reward_sha256','reward.toml')]})
    assert all(hashes.values())
    details = p.parent/'verifier/reward-details.json'
    criteria = []
    if details.exists():
        for dim,section in load(details).items():
            for c in section.get('criteria',[]):
                assert (dim,c['description'],c['weight']) == (expected[c['id']][0],expected[c['id']][1]['description'],expected[c['id']][1]['weight'])
                criteria.append({'dimension':dim,**c})
        assert {c['id'] for c in criteria} == set(expected)
    if model == 'oracle':
        matches = {name:(p.parent/'artifacts/app'/name.removeprefix('solution/')).read_bytes()==body
                   for name,body in source.items() if name.startswith('solution/') and name!='solution/solve.sh'}
        assert all(matches.values())
    runs.append(dict(model=model,run=p.parent.parent.name,trial=p.parent.name,
                     task_checksum=r['task_checksum'],scores=scores,provenance_checks=hashes,
                     functional_passed=sum(c['dimension']=='functional' and c['value']==1 for c in criteria),
                     criteria=criteria))
report = dict(evaluated_zip=str(ARCHIVE.relative_to(ROOT)),zip_sha256=sha(ARCHIVE.read_bytes()),
              prompt_revision='functional-v1.0.0-r7',oracle_source_matches=matches,runs=runs,
              limitations=['Export contains per-criterion reasons, not full judge action transcripts.',
                           'Missing-evidence verdicts are not independently demonstrated app failures.',
                           'Scores are historical for r7; they are not scores for the corrective package.'])
(OUT/'run-analysis.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
with (OUT/'criterion-matrix.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f);w.writerow(['model','dimension','criterion','weight','value','reasoning'])
    for r in runs:
        for c in r['criteria']:w.writerow([r['model'],c['dimension'],c['id'],c['weight'],c['value'],c['reasoning']])
print(json.dumps([{k:r[k] for k in ['model','run','scores','functional_passed']} for r in runs],indent=2))
