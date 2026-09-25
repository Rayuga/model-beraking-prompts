import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
TESTS = ROOT / 'projects/common-ground-ballot/tests'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


trials = []
for run in sorted((ROOT / 'run-outputs/common-ground-ballot').iterdir()):
    for trial in sorted(run.glob('common-ground-ballot__*')):
        data = json.loads((trial / 'result.json').read_text())
        provenance = json.loads((trial / 'verifier/prompt-provenance.json').read_text())
        comparisons = {}
        for dimension, expected in provenance['judges'].items():
            for key, name in [('prompt_sha256', 'prompt.md'), ('judge_sha256', 'judge.toml')]:
                comparisons[f'{dimension}/{name}'] = sha(TESTS / dimension / name) == expected[key]
        for key, name in [('runner_sha256', 'test.sh'), ('reward_sha256', 'reward.toml')]:
            comparisons[name] = sha(TESTS / name) == provenance[key]
        info = data['agent_info']
        item = {
            'run_id': run.name,
            'trial': trial.name,
            'agent': (info.get('model_info') or {}).get('name') or info['name'],
            'started_at': data['started_at'],
            'finished_at': data['finished_at'],
            'task_checksum': data['task_checksum'],
            'rewards': data['verifier_result']['rewards'],
            'exception': data['exception_info'],
            'verifier_matches_current_source': comparisons,
        }
        details_path = trial / 'verifier/reward-details.json'
        if details_path.exists():
            details = json.loads(details_path.read_text())
            item['criteria'] = {
                dimension: [{key: criterion.get(key) for key in ['id', 'value', 'weight', 'reasoning']} for criterion in detail['criteria']]
                for dimension, detail in details.items()
            }
        if item['agent'] in ['gpt-5.4-mini', 'oracle']:
            item['exported_source_hashes'] = {
                str(file.relative_to(trial / 'artifacts/app')).replace('\\', '/'): sha(file)
                for name in ['server.js', 'package.json', 'public/index.html', 'public/app.js', 'public/styles.css', 'common_ground_seed.json']
                if (file := trial / 'artifacts/app' / name).exists()
            }
        trials.append(item)

result = {'scope': 'Audit of supplied latest Common Ground Ballot runs, without changing scores or submissions.', 'trials': trials}
(OUT / 'run-analysis.json').write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
for item in trials:
    functional = item.get('criteria', {}).get('functional', [])
    print(item['agent'], item['rewards']['reward'], 'functional criteria', sum(x['value'] == 1 for x in functional), '/', len(functional), 'matching verifier', all(item['verifier_matches_current_source'].values()))
