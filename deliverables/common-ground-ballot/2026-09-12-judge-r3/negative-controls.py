import hashlib
import json
from pathlib import Path
import subprocess

out = Path(__file__).resolve().parent
task = out.parents[2] / 'projects/common-ground-ballot'
golden = task / 'solution/server.js'
before = hashlib.sha256(golden.read_bytes()).hexdigest()
expected = {
    'stale_edit_accepted': 'ordinary sign-out isolation and global session revocation',
    'open_edit_accepted': 'ordinary sign-out isolation and global session revocation',
    'vote_replay_rejected': 'empty/multiple single-choice and ineligible-member refusals leave full state unchanged',
    'closed_vote_accepted': 'private single/approval votes, invalid inputs, exact replay, mismatched operation and duplicate participation',
}
results = []
for name, checkpoint in expected.items():
    target = out / 'negative-controls' / name
    target.mkdir(parents=True, exist_ok=True)
    args = ['docker', 'run', '--rm', '--network', 'none',
            '-e', 'LOCAL_MUTATION=' + name,
            '-v', str(task) + ':/task:ro', '-v', str(task / 'solution') + ':/golden:ro',
            '-v', str(out) + ':/validation:ro', '-v', str(target) + ':/results',
            'ballot-verifier:20260912-judge-r3', 'python3', '/validation/run-local.py', 'browser']
    with (target / 'browser.log').open('w') as stream:
        completed = subprocess.run(args, stdout=stream, stderr=subprocess.STDOUT, timeout=360)
    data = json.loads((target / 'browser-results.json').read_text())
    passed = [r['name'] for r in data['results'] if r['passed']]
    failed = [r for r in data['results'] if not r['passed']]
    caught = completed.returncode != 0 and passed[-1] == checkpoint and len(failed) == 1 and 'AssertionError' in failed[0]['error']
    results.append({'name': name, 'passed': caught, 'expected_failure_observed': caught,
                    'last_successful_group': passed[-1], 'exit_code': completed.returncode,
                    'failure': failed, 'browser_errors': data['errors']})
    assert caught, results[-1]
    print('PASS negative control ' + name, flush=True)
after = hashlib.sha256(golden.read_bytes()).hexdigest()
assert before == after
(out / 'negative-control-results.json').write_text(json.dumps({
    'passed': all(r['passed'] for r in results),
    'scope': 'Deliberate defects in disposable /app copies, not changes to the golden solution or platform task.',
    'golden_sha256_before': before, 'golden_sha256_after': after, 'results': results,
}, indent=2) + '\n')
