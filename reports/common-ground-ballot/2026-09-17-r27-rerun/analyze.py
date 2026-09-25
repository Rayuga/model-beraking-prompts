from datetime import datetime
from pathlib import Path
import hashlib
import json
import tomllib

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
SOURCE = ROOT / 'run-outputs/common-ground-ballot'
PACKAGE = ROOT / 'reports/common-ground-ballot/2026-09-17-review-safety-r27/package-manifest.json'
manifest = json.loads(PACKAGE.read_text(encoding='utf-8'))
hashes = manifest['files_sha256']

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def elapsed(data):
    if not data or not data.get('started_at') or not data.get('finished_at'): return None
    return round((datetime.fromisoformat(data['finished_at'].replace('Z','+00:00'))-datetime.fromisoformat(data['started_at'].replace('Z','+00:00'))).total_seconds(), 3)

rows = []
for file in sorted(SOURCE.glob('run-*/*/result.json')):
    trial = file.parent
    data = read(file)
    if not data.get('trial_name'): continue
    agent = data['config']['agent']
    row = {'run':trial.parent.name, 'trial':trial.name, 'agent':agent.get('name'), 'model':agent.get('model_name'),
           'task_checksum':data.get('task_checksum'), 'rewards':(data.get('verifier_result') or {}).get('rewards'),
           'exception_type':(data.get('exception_info') or {}).get('exception_type'),
           'total_sec':elapsed(data), 'agent_sec':elapsed(data.get('agent_execution')), 'verifier_sec':elapsed(data.get('verifier')),
           'started_at':data.get('started_at'), 'finished_at':data.get('finished_at'), 'dimensions':{}}
    p = trial/'verifier/prompt-provenance.json'
    if p.exists():
        provenance = read(p)
        checks = {f'{dim}/{kind}':info[f'{kind}_sha256']==hashes[f'tests/{dim}/{"prompt.md" if kind=="prompt" else "judge.toml"}']
                  for dim,info in provenance['judges'].items() for kind in ('prompt','judge')}
        checks.update({'runner':provenance['runner_sha256']==hashes['tests/test.sh'], 'reward':provenance['reward_sha256']==hashes['tests/reward.toml']})
        row['r27_verifier_provenance'] = checks
        row['all_r27_verifier_hashes_match'] = all(checks.values())
    if agent.get('name') == 'oracle':
        row['oracle_files_match_r27'] = {name:hashlib.sha256((trial/'artifacts/app'/name.removeprefix('solution/')).read_bytes()).hexdigest()==expected
                                       for name,expected in hashes.items() if name.startswith('solution/') and name != 'solution/solve.sh'}
    details = read(trial/'verifier/reward-details.json') if (trial/'verifier/reward-details.json').exists() else {}
    for folder in sorted((trial/'verifier/judges').glob('*')):
        attempts = []
        for attempt in sorted(folder.glob('attempt-*')):
            timing = read(attempt/'timing.json') if (attempt/'timing.json').exists() else {}
            verdicts = read(attempt/'final.json') if (attempt/'final.json').exists() else {}
            judge = tomllib.loads((ROOT/'projects/common-ground-ballot/tests'/folder.name/'judge.toml').read_text(encoding='utf-8'))
            criteria = {c['id']:c for c in judge['criterion']}
            actual_values = {c['id']:c['value'] for c in details.get(folder.name,{}).get('criteria',[])}
            failed = []
            total = 0
            earned = 0
            for name,c in criteria.items():
                v = verdicts.get(name, {})
                score = v.get('score')
                normalized = actual_values.get(name)
                if normalized is None:
                    normalized = (1 if score in ('yes', True) else 0) if c['type']=='binary' else max(0,(float(score or 0)-1)/(c.get('points',5)-1))
                total += c['weight']
                earned += normalized*c['weight']
                if normalized < 1:
                    failed.append({'id':name, 'weight':c['weight'], 'score':score, 'lost_weight':(1-normalized)*c['weight'], 'reason':v.get('reasoning')})
            attempts.append({'attempt':attempt.name,'status':timing.get('status'),'elapsed_sec':timing.get('elapsed_sec'),
                             'returncode':timing.get('returncode'), 'verdict_count':len(verdicts), 'criteria_count':len(criteria),
                             'earned_weight':earned,'total_weight':total,'normalized_mean':round(earned/total,4),'incomplete_or_not_full':failed})
        row['dimensions'][folder.name] = attempts
    rows.append(row)
(HERE/'analysis.json').write_text(json.dumps({'package_sha256':manifest['sha256'],'runs':rows},indent=2)+'\n',encoding='utf-8')
for row in rows:
    summary = {k:v for k,v in row.items() if k not in ('dimensions','r27_verifier_provenance','oracle_files_match_r27')}
    summary['dimension_times_sec']={k:[a['elapsed_sec'] for a in v] for k,v in row['dimensions'].items()}
    summary['non_full_criteria']={k:[x['id'] for a in v for x in a['incomplete_or_not_full']] for k,v in row['dimensions'].items()}
    print(json.dumps(summary,indent=2))
