import hashlib
import importlib.util
import json
from pathlib import Path

root = Path.cwd()
out = Path(__file__).resolve().parent
guard = root / 'scripts/check_colderwater_regressions.py'
spec = importlib.util.spec_from_file_location('guard', guard)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
task = root / 'projects/colderwater-playground-devtools'
files = {p.relative_to(task).as_posix(): p.read_text(encoding='utf-8') for p in task.rglob('*') if p.is_file() and p.suffix in {'.md', '.toml', '.sh', '.tsx'}}

class File:
    def __init__(self, text): self.text = text
    def read_text(self, **kwargs): return self.text

class Snapshot:
    def __init__(self, content): self.content = content
    def __truediv__(self, name): return File(self.content[name])
    def __str__(self): return 'in-memory mutation fixture'

results = []
def run(name, changes, expected):
    content = dict(files)
    for path, old, new in changes:
        assert old in content[path], (name, path, old)
        content[path] = content[path].replace(old, new)
    result = module.check_task(Snapshot(content))
    assert result['passed'] == expected, (name, result)
    results.append({'fixture': name, 'accepted': result['passed'], 'expected': expected,
                    'failed_guards': [c['name'] for c in result['checks'] if not c['passed']]})

j = 'tests/scored/functional/judge.toml'
p = 'tests/scored/functional/prompt.md'
ctx = 'tests/app_context.md'
run('current source', [], True)
run('restore during-loop host demand', [(j, 'Check the editor\'s usability after the run has stopped;', 'While the run is active, the surrounding page remains responsive;')], False)
run('restore prompt during-loop demand', [(p, '## Evidence discipline', 'test that the host workspace stays responsive\n## Evidence discipline')], False)
run('restore documented-only escape', [('tests/scored/polish/judge.toml', 'description = """', 'description = """\nUse only an escape sequence documented by the application.')], False)
run('fixed negative debounce window', [(j, 'longest successful auto-run delay', 'fixed two-second delay')], False)
run('request-only stale proof', [(j, "B's actual dirty UI", "a captured old HTTP request")], False)
run('context loses UI/replay distinction', [(ctx, 'A request replay alone cannot prove the dirty-editor behavior.', 'A request replay is sufficient.')], False)
run('proactive UI conflict handling rejected', [(ctx, 'proactive prevention', 'forced stale submission')], False)
run('pending candidate visibility becomes mandatory', [(j, 'Showing failed-loop-candidate while it works is optional', 'Showing failed-loop-candidate while it works is mandatory')], False)
run('blocked further input rejected', [(j, 'ignoring/blocking further pending input are both valid', 'further input must always be handled')], False)
run('latest committed state is not observed', [(j, 'interaction-committed retained or restored', 'interaction-good restored')], False)
run('successful padded title creation not checked', [(j, '"  QC Rename Source  "', '"QC Rename Source"')], False)
run('successful padded rename not checked', [(j, '"  QC Rename Source Renamed  "', '"QC Rename Source Renamed"')], False)
run('completed-preview Stop not checked', [(j, 'use Stop on this completed preview', 'start a new Run')], False)
run('immutable examples not observed', [(j, 'original filename and source remain unchanged', 'original filename is visible')], False)
run('real CLI omitted empty reasoning rejected', [('tests/test.sh', "reasoning = row.get('reasoning', '')", "reasoning = row.get('reasoning')")], False)
run('private classifier exception reintroduced', [(p, '## Evidence discipline', 'The sole narrow exception permits source classification.\n## Evidence discipline')], False)
run('privacy probe filenames leak into public note', [('environment/instructions/security.md', 'Keep those working files private', 'Reserve /app.db, /server.js and /package.json. Keep those working files private')], False)
run('sidecar probe removed', [(j, '/app.db-wal', '/other.db-wal')], False)
run('public asset exception removed', [(j, 'path actually used by the working playground', 'path with a suspicious filename')], False)
run('restart regains Duplicate prerequisite', [(j, 'using only New and ordinary Save', 'by making an independent duplicate')], False)
run('restart regains Delete prerequisite', [(j, 'QC Restart Second', 'QC Restart Deleted')], False)
run('deletion confirmation demanded by server-only check', [(j, 'do not require or grade confirmation here', 'require confirmation here')], False)
run('Auto-run absent control poisons gate', [(ctx, 'must not by itself fail Render, Constraints or unrelated checks', 'must fail every gate')], False)
run('tool error loses structured marker', [(ctx, 'EVALUATION_INCOMPLETE:', 'TOOL_ERROR:')], False)
run('medium difficulty regression', [('task.toml', 'difficulty = "hard"', 'difficulty = "medium"')], False)
run('stale offline badge', [('solution/app/src/app.tsx', 'Local library', 'Local & offline')], False)
run('loss of bounded final cleanup', [('tests/test.sh', 'for _ in $(seq 1 50)', 'for _ in $(seq 1 50000)')], False)
run('independent credit lost', [(j, 'weight = 1.5', 'weight = 1.6')], False)
run('native shortcut remains valid without golden hint', [('solution/app/src/app.tsx', 'Leave editor', '')], True)
report = {'passed': True, 'cases': results, 'guard_sha256': hashlib.sha256(guard.read_bytes()).hexdigest(),
          'scope': 'Mutated in-memory source contracts. These checks detect known regressions; they do not prove all future rubric semantics.'}
(out / 'regression_mutation_results.json').write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({'passed': True, 'cases': len(results), 'bad_contracts_rejected': sum(not c['expected'] for c in results)}))
