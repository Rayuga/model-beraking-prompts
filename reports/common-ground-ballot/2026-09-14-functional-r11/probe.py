from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
GPT = ROOT / 'run-outputs/common-ground-ballot/run-3f3078d2-1170-472e-9eb3-69d32838490d/common-ground-ballot__4Dxb7hd/artifacts/app'


def run(kind):
    target = OUT / kind
    target.mkdir(exist_ok=True)
    submission = GPT if kind == 'gpt' else ROOT / 'projects/common-ground-ballot/solution'
    command = ['docker', 'run', '--rm', '--network', 'none']
    for source, destination, readonly in [(submission, '/submission', True), (OUT, '/validation', True), (target, '/results', False)]:
        command += ['--mount', f'type=bind,source={source},target={destination}' + (',readonly' if readonly else '')]
    if kind != 'gpt':
        command += ['--mount', f'type=bind,source={ROOT / "projects/common-ground-ballot/tests/assets/artifacts/common_ground_seed.json"},target=/seed.json,readonly']
    command += ['common-ground-ballot-tests:1.0.6', 'node', '/validation/probe.cjs', kind]
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', errors='replace', timeout=180)
    (target / 'runner.log').write_text(result.stdout + '\n' + result.stderr, encoding='utf-8')
    data = json.loads((target / 'probe-results.json').read_text())
    print(kind, result.returncode, [(g['name'], g['passed']) for g in data['groups']], data.get('error', ''), flush=True)
    assert result.returncode == 0 and data['completed']
    expected_failures = {
        'golden': set(),
        'gpt': {'malformed_membership_snapshot', 'member_participation_privacy', 'approval_order_retry'},
        'mutant-member-leak': {'member_participation_privacy'},
        'mutant-roster-coercion': {'malformed_membership_snapshot'},
        'mutant-ordered-receipt': {'approval_order_retry'},
    }[kind]
    assert {g['name'] for g in data['groups'] if not g['passed']} == expected_failures
    return {'kind': kind, 'expected_outcomes_verified': True}


with ThreadPoolExecutor(max_workers=2) as pool:
    results = list(pool.map(run, sys.argv[1:] or ['golden', 'gpt', 'mutant-member-leak', 'mutant-roster-coercion', 'mutant-ordered-receipt']))
(OUT / 'probe-summary.json').write_text(json.dumps(results, indent=2) + '\n')
