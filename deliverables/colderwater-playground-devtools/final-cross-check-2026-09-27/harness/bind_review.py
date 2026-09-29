from pathlib import Path
import difflib
import hashlib
import json
import stat
import tomllib
import zipfile

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
TASK = ROOT/'projects/colderwater-playground-devtools'
PRIOR = ROOT/'deliverables/colderwater-playground-devtools/eight-issue-fix-2026-09-27'
sha = lambda b: hashlib.sha256(b).hexdigest()
old_zip = PRIOR/'colderwater-playground-devtools.zip'
shell = (TASK/'tests/test.sh').read_bytes()
checks = []
def check(name, passed, evidence=None):
    checks.append({'name': name, 'passed': bool(passed), 'evidence': evidence})

with zipfile.ZipFile(old_zip) as archive:
    before = archive.read('colderwater-playground-devtools/tests/test.sh')
    check('Exact original archive identity', sha(old_zip.read_bytes()) == 'a017932304e19209de817cdd13070c4e0ff5f8e5b8e2af72eac1078cf53357b1')
    check('Only one compatibility expression changes in test.sh', before.replace(b"reasoning = row.get('reasoning')", b"reasoning = row.get('reasoning', '')") == shell)
    forbidden = [n for n in archive.namelist() if any(p in Path(n).parts for p in ['node_modules', '.git', '__pycache__']) or Path(n).suffix in ['.db', '.zip', '.xlsx', '.pyc']]
    symlinks = [x.filename for x in archive.infolist() if stat.S_ISLNK(x.external_attr >> 16)]
    traversals = [n for n in archive.namelist() if '..' in Path(n).parts or Path(n).is_absolute()]
    check('Original ZIP hygiene', not forbidden and not symlinks and not traversals, {'members': len(archive.namelist()), 'forbidden': forbidden, 'symlinks': symlinks, 'traversals': traversals})
    archived_specs = {Path(n).parent.name: tomllib.loads(archive.read(n).decode()) for n in archive.namelist() if n.endswith('/judge.toml')}

(HERE/'test_sh_compatibility.diff').write_text(''.join(difflib.unified_diff(before.decode().splitlines(True), shell.decode().splitlines(True), fromfile='a017932304e1/tests/test.sh', tofile='patched-source/tests/test.sh')))
check('Shell has Unix line endings', b'\r' not in shell)
for rel in ['tests/tools/score.py', 'tests/tools/restart_mcp.py', 'tests/scoring.toml']:
    check('Current canonical bytes: '+rel, (TASK/rel).read_bytes() == (ROOT/'projects/webdev-task-template'/rel).read_bytes(), sha((TASK/rel).read_bytes()))

before_run = json.loads((HERE/'actual_rewardkit_results.json').read_text())
after_run = json.loads((HERE/'actual_rewardkit_results.after.json').read_text())
check('Baseline actual CLI ran the exact archived shell', before_run['test_sh_sha256'] == sha(before))
check('Installed RewardKit version', after_run['rewardkit_version'] == '0.1.7')
before_cases = {x['case']: x for x in before_run['results']}
check('Schema-valid empty reasoning false rejection reproduced', before_cases['empty_reasoning']['cli_exit'] == 0 and before_cases['empty_reasoning']['guard_exit'] == 1)
expected = {'all_pass': (0,0), 'gate_failure': (0,0), 'mixed_order': (0,0), 'empty_reasoning': (0,0), 'absent_reasoning': (0,0), 'numeric_representations': (0,0), 'incomplete_marker': (0,1), 'missing_criterion': (1,1), 'cli_nonzero': (1,1), 'error_envelope': (1,1)}
for row in after_run['results']:
    check('Actual CLI after fix: '+row['case'], (row['cli_exit'], row['guard_exit']) == expected[row['case']], {'cli_exit': row['cli_exit'], 'guard_exit': row['guard_exit'], 'scores': row['scores']})
check('All expected actual CLI cases ran', set(expected) == {x['case'] for x in after_run['results']})
for filename in ['actual_rewardkit_results.after.json', 'guard_probe_results.json', 'harness_regression_results.json']:
    record = json.loads((HERE/filename).read_text())
    check('Final shell binding: '+filename, record['test_sh_sha256'] == sha(shell))
    if 'passed' in record:
        check('Regression pass: '+filename, record['passed'])
guard = json.loads((HERE/'guard_probe_results.json').read_text())
check('43 guard cases: original 40 plus three reasoning cases', len(guard['cases']) == 43)
for name in ['missing_reasoning', 'empty_reasoning', 'null_reasoning', 'number_reasoning', 'marker', 'criterion_error']:
    row = next(x for x in guard['cases'] if x['case'] == name)
    expected_graded = int(name in ('missing_reasoning', 'empty_reasoning'))
    check('Reasoning/error policy: '+name, row['passed'] and row['reward']['graded'] == expected_graded)

inventory = {name: {'count': len(spec['criterion']), 'sum_criterion_weights': sum(c.get('weight',1) for c in spec['criterion']), 'timeout': spec['judge']['timeout']} for name,spec in archived_specs.items()}
order = [c['id'] for c in archived_specs['functional']['criterion']]
check('Archived criterion counts', inventory['functional']['count'] == 35 and sum(x['count'] for x in inventory.values()) == 47, inventory)
check('Restart is position 22 immediately after save_load', order[20:22] == ['save_load','cw_process_restart_durability'], {'following_criteria': order[22:]})
check('Archived criteria use explicit IDs/names/weights, no negation/optional metadata', all(c.get('id') and c.get('name') and c.get('weight',0)>0 and not any(c.get(k) for k in ['negate','optional','annotations']) for s in archived_specs.values() for c in s['criterion']))
check('Budget sums nest', sum(inventory[x]['timeout'] for x in ['constraints','render']) < 1500 and sum(inventory[x]['timeout'] for x in ['functional','polish','visual']) < 11100 and 1500+11100 < 13200)
old_binding = json.loads((PRIOR/'harness/review_binding.json').read_text())
check('Prior lifecycle evidence was bound to original released shell', old_binding['passed'] and old_binding['test_sh_sha256'] == sha(before))
check('All lifecycle/permissions code byte-identical', before.split(b'validate_suite() {',1)[0] == shell.split(b'validate_suite() {',1)[0])
summary = {'passed': all(x['passed'] for x in checks), 'original_zip_sha256': sha(old_zip.read_bytes()), 'original_shell_sha256': sha(before), 'patched_shell_sha256': sha(shell), 'checks': checks,
           'limits': ['No paid provider, model-quality, or end-to-end judge latency was measured.', 'Original 40-case fixture evidence is preserved unchanged; missing_reasoning expectation is superseded by actual installed RewardKit behavior and the new 43-case run.', 'Actual CLI transport fixtures produce authored JSON only; observations of the product are not claimed.', 'Current root release packaging is handled separately; this binding identifies the patched shell, not a new ZIP.']}
(HERE/'review_binding.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps({'passed': summary['passed'], 'checks': len(checks), 'patched_shell_sha256': sha(shell)}))
assert summary['passed']
