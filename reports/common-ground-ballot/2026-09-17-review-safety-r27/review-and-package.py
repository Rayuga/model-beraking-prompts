"""Require passing evidence and package an immutable r27 release."""
from pathlib import Path
import hashlib
import json
import re
import stat
import subprocess
import sys
import tomllib
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
TASK = ROOT / 'projects/common-ground-ballot'
PREVIOUS = HERE.parent / '2026-09-17-atomic-rounds-r26'
BASELINE = ROOT / 'deliverables/common-ground-ballot/2026-09-17-atomic-rounds-r26/common-ground-ballot.zip'
DEST = ROOT / 'deliverables/common-ground-ballot/2026-09-17-review-safety-r27'
ZIP = DEST / 'common-ground-ballot.zip'
EXPECTED_BASE = '232fe14216cfad2b1f5168866573654b2707992ae44aefb7581b684bdf7a299a'

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

assert not ZIP.exists(), 'Published archives are immutable.'
assert hashlib.sha256(BASELINE.read_bytes()).hexdigest() == EXPECTED_BASE
checks = {}
for mode, filename, count in [
    ('review', 'review-results.json', 7), ('review-race', 'review-race-results.json', 4),
    ('identity', 'identity-results.json', 7), ('helper-integration', 'helper-results.json', 19),
    ('integrated', 'browser-results.json', 45), ('integrated', 'rounds-results.json', 19),
]:
    result = read(HERE / mode / filename)
    assert len(result['results']) == count and all(r['passed'] for r in result['results']), (mode, filename)
    assert read(HERE / mode / 'run-result.json')['passed'], mode
    checks[f'{mode}/{filename}'] = count
assert sum(checks.values()) == 101
assert read(HERE / 'runtime-smoke/runtime-smoke-results.json')['passed'] == 30
mutants = read(HERE / 'round-mutation-results.json')
assert len(mutants) == 8 and all(r['detected'] for r in mutants)
race_before = read(HERE.parent / '2026-09-17-r26-independent-recheck/review-race/review-race-results.json')
assert race_before['failed'] == 3 and race_before['passed'] == 1

files = {p.relative_to(TASK).as_posix(): p.read_bytes() for p in TASK.rglob('*') if p.is_file()}
assert len(files) == 29
with zipfile.ZipFile(BASELINE) as archive:
    old = {name.split('/', 1)[1]: archive.read(name) for name in archive.namelist()}
assert files.keys() == old.keys()
changed = sorted(n for n in files if files[n] != old[n])
assert changed == ['README.md', 'solution/public/app.js', 'tests/functional/judge.toml', 'tests/functional/prompt.md'], changed
previous_judge = tomllib.loads(old['tests/functional/judge.toml'].decode())
current_judge = tomllib.loads(files['tests/functional/judge.toml'].decode())
assert {c['id']:c['weight'] for c in previous_judge['criterion']} == {c['id']:c['weight'] for c in current_judge['criterion']}
assert sum(c['weight'] for c in current_judge['criterion']) == 103.5
changed_criteria = [a['id'] for a,b in zip(current_judge['criterion'],previous_judge['criterion']) if a != b]
assert changed_criteria == ['round_roster_conflict', 'round_success_receipt', 'round_refusal_receipts']
provenance = read(HERE / 'runtime-smoke/runner-1/prompt-provenance.json')
for dim, info in provenance['judges'].items():
    assert hashlib.sha256(files[f'tests/{dim}/prompt.md']).hexdigest() == info['prompt_sha256']
    assert hashlib.sha256(files[f'tests/{dim}/judge.toml']).hexdigest() == info['judge_sha256']

change = {'baseline_sha256': EXPECTED_BASE, 'changed': changed,
          'unchanged': sorted(files.keys()-set(changed)), 'changed_criteria': changed_criteria,
          'criterion_ids_and_weights_unchanged': True, 'instruction_unchanged': True,
          'functional_weight_total': 103.5, 'nonfunctional_verifiers_unchanged': True}
(HERE / 'change-review.json').write_text(json.dumps(change, indent=2)+'\n', encoding='utf-8')
(HERE / 'previous-gpt-projection.json').write_bytes((PREVIOUS / 'previous-gpt-projection.json').read_bytes())

# The public instruction and criterion IDs did not change, so line ownership is stable.
coverage = (PREVIOUS / 'coverage-matrix.md').read_text(encoding='utf-8')
coverage += '''
r27 closes two false-pass witnesses inside existing owners. round_roster_conflict
now changes an initially paused Member to active and back to paused; checking
only active Members' revisions cannot pass. round_success_receipt separately
changes one roster revision under the original ID; omitting the roster from the
receipt fingerprint cannot pass. round_refusal_receipts reuses all four captured
draft/roster refusals. No hidden requirement or new score weight was introduced.
'''
(HERE / 'coverage-matrix.md').write_text(coverage, encoding='utf-8', newline='\n')

rubric = (ROOT / 'task-implementation.txt').read_text(encoding='utf-8')
names = [re.search(r'name\s*=\s*"([^"]+)"', b).group(1) for b in rubric.split('[[criteria]]')[2:]]
assert len(names) == 53
prior_review = (PREVIOUS / 'rubric-review.md').read_text(encoding='utf-8')
notes = {}
for row in prior_review.splitlines():
    match = re.match(r'\| (\d+) \| `([^`]+)` \| No issue identified \| (.*) \|$', row)
    if match:
        number, name, note = match.groups()
        assert names[int(number)-1] == name
        notes[int(number)] = note
assert len(notes) == 53
notes.update({
    4: 'Public brief unchanged. All 66 Functional IDs retain their public requirement and line mapping; two missing concrete roster/receipt cases are now exercised.',
    6: 'New cases reuse the existing pair, existing accounts and ordinary membership controls. Full core workflow followed by rounds passed on the same already-mutated database.',
    17: '101 golden browser checks pass. The prior ZIP reproduced three in-flight draft-review failures; the revised golden fixes them and passes the dedicated four-check regression.',
    18: 'Golden passes the new paused-member change-and-return and membership-only receipt-collision probes as well as the existing workflows. Other four verifiers are byte-identical.',
    26: 'Fixed two concrete false-pass witnesses: validating only active roster revisions, and omitting roster revisions from round receipt identity. Both disposable mutants are detected.',
    27: 'Whole roster explicitly includes paused Members in instruction.md; round identity explicitly includes reviewed roster/revisions. No public requirement or criterion added.',
    28: 'Existing ownership split retained. Three roster conflict outcomes belong to one whole-roster correctness criterion; replay of their saved refusals belongs to the separate receipt owner.',
    30: 'Both new negative probes use real accepted round and membership UI controls, one changed input per collision packet, and before/after records. Eight deliberate round defects are detected.',
    31: 'Both active and paused Member change-and-return now have explicit observations. Target-only, ballot-revision-only and membership-revision-only receipt collisions are tested independently.',
    34: '101 browser checks include held review save, Escape and a newer independent form; frozen-r26 reproduction proves the old late reply could close that form. The replacement preserves it.',
    37: '45 core checks then 19 round checks pass in one app process/database with no reset between suites. Leila revision-1 remains available for the boolean revision controls.',
    44: 'Exactly the same criterion IDs, weights, dimension weights and gate formula as r26. Functional remains 103.5 total; 0.6 Functional + 0.2 Polish + 0.2 Visual after gates.',
    47: 'Same pinned model/runtime, temperature 0 and helpers; Functional prompt r27. Scripted execution and cached dependency builds cannot establish a fresh autonomous score.',
    48: 'One round success and four original round refusals (draft plus three roster races) are named consistently in criteria and Phase D. Other three ordinary domain refusals remain separate.',
    50: '29 allowed files; exactly four differ from frozen r26. All validation scripts/evidence remain outside the upload. The previous ZIP hash is preserved.',
})
review = ['# Local review against task-implementation.txt', '',
          'Archetype: authenticated server-backed application with SQLite, anonymous ballots and browser recovery.', '',
          f'Rubric source SHA-256: `{hashlib.sha256((ROOT/"task-implementation.txt").read_bytes()).hexdigest()}`.', '',
          '**This is a local author review, not a platform 53/53 result or scored Oracle run.** The unchanged files were reconciled with the frozen r26 archive; the changed golden and criteria were exercised with real browsers and disposable negative controls. The referenced external review_guidelines.md was not supplied in this workspace; the rubric itself contains its review methodology.', '',
          '| # | QC criterion | Local finding | Basis |', '| --- | --- | --- | --- |']
for index, name in enumerate(names, 1):
    review.append(f'| {index} | `{name}` | No issue identified | {notes[index]} |')
review += ['', 'Remaining external validation: platform static/rubric review, an autonomous Oracle run and a fresh target-model run. No local provider credential is available. The final autonomous duration, including all 66 Functional verdicts, has not been measured. The old Functional run took 1929 seconds; the configured budget remains 7200 seconds with a 20-minute final-phase reserve.', '']
(HERE / 'rubric-review.md').write_text('\n'.join(review), encoding='utf-8', newline='\n')

subprocess.run([sys.executable, str(HERE / 'validate-package.py')], check=True)
DEST.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(ZIP, 'w', zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
    for name, data in sorted(files.items()):
        item = zipfile.ZipInfo('common-ground-ballot/'+name, date_time=(2026,9,17,0,0,0))
        item.create_system = 3
        item.external_attr = (stat.S_IFREG | (0o755 if name.endswith('.sh') else 0o644)) << 16
        item.compress_type = zipfile.ZIP_DEFLATED
        archive.writestr(item, data)
subprocess.run([sys.executable, str(HERE / 'validate-package.py'), str(ZIP)], check=True)
manifest = {'archive': str(ZIP.relative_to(ROOT)), 'sha256': hashlib.sha256(ZIP.read_bytes()).hexdigest(),
            'bytes': ZIP.stat().st_size, 'files': 29, 'changed_files': changed, 'verifiers': 5, 'criteria': 86,
            'functional_criteria': 66, 'functional_total_weight': 103.5, 'golden_browser_checks': checks,
            'golden_browser_passes': 101, 'round_mutants_detected': 8, 'runner_checks_passed': 30,
            'zip_checks_passed': read(HERE / 'zip-validation.json')['passed'],
            'fresh_scored_oracle': False, 'fresh_scored_model': False, 'platform_qc': False,
            'files_sha256': {n:hashlib.sha256(d).hexdigest() for n,d in sorted(files.items())}}
(HERE / 'package-manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
print(json.dumps({k:v for k,v in manifest.items() if k != 'files_sha256'}, indent=2))
