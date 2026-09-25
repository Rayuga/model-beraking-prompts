"""Read-only cross-check of the supplied r27 rerun and immutable release."""
from pathlib import Path
import hashlib
import json
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
data = json.loads((HERE / 'analysis.json').read_text())
old = json.loads((HERE.parent / '2026-09-17-r27-fresh-runs/analysis.json').read_text())
manifest = json.loads((HERE.parent / '2026-09-17-review-safety-r27/package-manifest.json').read_text())
archive = ROOT / manifest['archive']
assert hashlib.sha256(archive.read_bytes()).hexdigest() == manifest['sha256']
with zipfile.ZipFile(archive) as package:
    assert package.testzip() is None
    for name, expected in manifest['files_sha256'].items():
        assert hashlib.sha256(package.read('common-ground-ballot/' + name)).hexdigest() == expected, name

checks = []
for row in data['runs']:
    assert row['all_r27_verifier_hashes_match'], row['trial']
    assert row['exception_type'] is None, row['trial']
    reward = row['rewards']
    expected = 0 if reward['render'] <= 0 or reward['constraints'] <= 0 else round(
        .6 * reward['functional'] + .2 * reward['polish'] + .2 * reward['visual'], 4)
    assert abs(expected - reward['reward']) < 0.00001, row['trial']
    verdicts = 0
    for attempts in row['dimensions'].values():
        assert len(attempts) == 1
        attempt = attempts[0]
        assert attempt['status'] == 'succeeded' and attempt['returncode'] == 0
        assert attempt['verdict_count'] == attempt['criteria_count']
        verdicts += attempt['verdict_count']
    if reward['graded'] == 1:
        assert verdicts == 86
    else:
        assert row['agent'] == 'nop' and reward['no_op'] == 1 and verdicts == 0
    reused = any(all(row[key] == previous[key] for key in ('run', 'trial', 'started_at', 'finished_at'))
                 for previous in old['runs'])
    if row['agent'] == 'oracle':
        assert all(row['oracle_files_match_r27'].values())
        assert reward['reward'] == 1 and reused
    checks.append({'trial': row['trial'], 'model': row['model'] or row['agent'],
                   'reward': reward['reward'], 'complete_verdicts': verdicts,
                   'reused_from_previous_export': reused})
assert len({row['task_checksum'] for row in data['runs']}) == 1
gpt = next(row for row in data['runs'] if row['model'] == 'gpt-5.4-mini')
assert 0 < gpt['rewards']['reward'] <= .6
assert gpt['rewards']['render'] == gpt['rewards']['constraints'] == 1
result = {'archive_sha256': manifest['sha256'], 'all_checks_passed': True,
          'gpt_margin_below_0_6': round(.6 - gpt['rewards']['reward'], 4),
          'runs': checks}
(HERE / 'verification.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps(result, indent=2))
