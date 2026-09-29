"""Compare this narrowly scoped repair with the immutable prior upload."""
import difflib
import hashlib
import json
from pathlib import Path
import tomllib

out = Path(__file__).resolve().parent
root = out.parents[2]
task = root / 'projects/colderwater-playground-devtools'
baseline = out / 'baseline-d254c73e6ebe/colderwater-playground-devtools'

def hashes(folder):
    return {p.relative_to(folder).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in folder.rglob('*') if p.is_file()}

old, new = hashes(baseline), hashes(task)
changed = sorted(p for p in old.keys() & new.keys() if old[p] != new[p])
removed = sorted(old.keys() - new.keys())
added = sorted(new.keys() - old.keys())
expected = {
    'environment/instructions/behaviour.md', 'environment/instructions/security.md',
    'tests/scored/functional/judge.toml', 'tests/scored/functional/prompt.md',
    'tests/scored/polish/judge.toml', 'tests/scored/polish/prompt.md', 'tests/app_context.md',
    'solution/app/src/app.tsx', 'solution/app/public/index.html',
}
assert set(changed) == expected, changed
assert len(added) == len(removed) == 1, (added, removed)
assert all(p.startswith('solution/app/public/assets/index-') and p.endswith('.js') for p in added + removed)
assert len(old) == len(new) == 50

criteria_changes = {}
inventory = {}
for suite, names in [('gates', ['render', 'constraints']), ('scored', ['functional', 'polish', 'visual'])]:
    for name in names:
        rel = f'tests/{suite}/{name}/judge.toml'
        before = tomllib.loads((baseline / rel).read_text(encoding='utf-8'))
        after = tomllib.loads((task / rel).read_text(encoding='utf-8'))
        assert before['judge'] == after['judge'] and before['scoring'] == after['scoring'], name
        assert len(before['criterion']) == len(after['criterion']), name
        altered = []
        for a, b in zip(before['criterion'], after['criterion']):
            assert {k: v for k, v in a.items() if k != 'description'} == {k: v for k, v in b.items() if k != 'description'}, name
            if a != b:
                altered.append(b['id'])
        criteria_changes[name] = altered
        inventory[name] = {'count': len(after['criterion']), 'weight': sum(c['weight'] for c in after['criterion'])}
assert criteria_changes == {'render': [], 'constraints': [], 'functional': ['language_dispatch', 'recovery_persistence_chain'], 'polish': ['labelled_controls_and_focus'], 'visual': []}, criteria_changes

app_rel = 'solution/app/src/app.tsx'
app_diff = list(difflib.unified_diff((baseline / app_rel).read_text(encoding='utf-8').splitlines(), (task / app_rel).read_text(encoding='utf-8').splitlines(), fromfile='previous/app.tsx', tofile='current/app.tsx', lineterm=''))
assert old['solution/app/src/runtime.ts'] == new['solution/app/src/runtime.ts']
assert old['solution/app/server.js'] == new['solution/app/server.js']
assert old['solution/app/src/style.css'] == new['solution/app/src/style.css']
assert old['tests/test.sh'] == new['tests/test.sh']
assert old['task.toml'] == new['task.toml']
assert old['tests/scoring.toml'] == new['tests/scoring.toml']
report = {
    'passed': True, 'scope': 'Executed file/config/criterion delta assertions; semantic fairness and browser behavior are separate evidence.',
    'baseline_sha256': 'd254c73e6ebe94b2001ed782b136707c9cc3c5391c35c0bcd7fd66705d0c8a25',
    'changed_files': changed, 'removed_files': removed, 'added_files': added,
    'unchanged_files': len(old.keys() & new.keys()) - len(changed),
    'criterion_descriptions_changed': criteria_changes, 'inventory': inventory,
    'all_criterion_ids_types_weights_and_order_unchanged': True,
    'all_judge_timeouts_mcp_and_scoring_unchanged': True,
    'source_hashes': new, 'golden_app_source_diff': app_diff,
    'golden_runtime_server_styles_and_installer_unchanged': True,
}
(out / 'change_scope.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
(out / 'golden-help.diff').write_text('\n'.join(app_diff) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k not in ['source_hashes', 'golden_app_source_diff']}))
