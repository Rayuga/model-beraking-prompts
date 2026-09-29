import argparse
import hashlib
import itertools
import json
import sys
import tomllib
import zipfile
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--task', type=Path, default=Path('projects/colderwater-playground-devtools'))
parser.add_argument('--output', type=Path)
args = parser.parse_args()
task = args.task
out = args.output or Path(__file__).with_name('revision_preflight.json')
checks = []

def check(name, condition):
    checks.append({'name': name, 'passed': bool(condition)})

def read(relative):
    return (task / relative).read_text(encoding='utf-8')

criteria = tomllib.loads(read('tests/scored/functional/judge.toml'))['criterion']
check('32 functional criteria and total49.5', len(criteria) == 32 and abs(sum(c['weight'] for c in criteria) - 49.5) < 1e-8)
for source in sorted((task / 'tests').glob('*/*/prompt.md')):
    text = source.read_text(encoding='utf-8')
    check(source.parent.name + ': explicit implementation evidence prohibition', 'Do not inspect submitted application implementation files' in text)
    check(source.parent.name + ': distinguishes user snippets as product data', 'product data' in text)
render = read('tests/gates/render/judge.toml')
constraint = read('tests/gates/constraints/judge.toml')
check('render proves authored code executes, not editor text alone', all(t in render for t in ['document.body.textContent', 'console.log', 'Run control that does nothing fails', 'Do not save']))
check('constraints proves new shared write and independent fresh read', all(t in constraint for t in ['CW gate ', 'independent clean browser context', 'without copying cookies', 'server-supplied record', 'Reload this fresh context', 'exact editor source']))
check('constraints has scoped one-record side effect', 'Leave this one gate record saved' in constraint and 'Do not require an exact total library count' in constraint)
check('gate prompts have different purposes', read('tests/gates/render/prompt.md') != read('tests/gates/constraints/prompt.md'))
for dim in ['functional', 'polish', 'visual']:
    text = read('tests/scored/' + dim + '/prompt.md')
    check(dim + ': inherits both meaningful gates without repeating them', 'Render proves' in text and 'Constraints proves' in text and 'Do not repeat' in text)
check('global context budgets gate record and stale rename', 'CW gate ' in read('tests/app_context.md') and 'stale renames' in read('tests/app_context.md'))
check('obsolete eval-only exclusion removed', 'one stated eval probe' not in read('tests/scored/functional/prompt.md'))
installer = read('solution/solve.sh')
check('installer reset has exact file scope and active-use guard', 'database_files=(/app/app.db /app/app.db-wal /app/app.db-shm)' in installer and '"$descriptor" -ef "$database_file"' in installer)
check('normal verifier startup never invokes installer', 'solve.sh' not in read('tests/test.sh'))
sys.path.insert(0, str(Path.cwd() / 'scripts'))
from check_public_grader_terms import scan_task
check('public prose has no grading vocabulary', scan_task(task)['passed'])

old_zip = Path('deliverables/colderwater-playground-devtools/instruction-hygiene-fix-2026-09-26/colderwater-playground-devtools.zip')
with zipfile.ZipFile(old_zip) as bundle:
    old = tomllib.loads(bundle.read('colderwater-playground-devtools/tests/scored/functional/judge.toml').decode())['criterion']
    for relative in ['tests/scoring.toml', 'tests/tools/score.py', 'tests/tools/restart_mcp.py', 'tests/test.sh', 'tests/scored/polish/judge.toml', 'tests/scored/visual/judge.toml']:
        check(relative + ': unchanged', bundle.read('colderwater-playground-devtools/' + relative) == (task / relative).read_bytes())

old_groups = {'sandbox_isolation', 'error_lines_preview', 'dirty_navigation', 'import_export', 'cw_title_change_uniqueness'}
check('baseline has exact five changed scoring groups', len([c for c in old if c['id'] in old_groups]) == 5)
crosswalk = json.loads(Path(__file__).with_name('criterion-crosswalk.json').read_text(encoding='utf-8'))
old_by_id = {c['id']: c for c in old}
new_by_id = {c['id']: c for c in criteria}
check('crosswalk matches five old groups', {g['old_id'] for g in crosswalk['groups']} == old_groups)
for group in crosswalk['groups']:
    check(group['old_id'] + ': exact old/new weights bound to source',
          old_by_id[group['old_id']]['weight'] == group['old_weight']
          and all(c['id'] in new_by_id and new_by_id[c['id']]['weight'] == c['weight'] for c in group['new'])
          and sum(c['weight'] for c in group['new']) == group['old_weight'])
check('remaining nineteen criterion weights unchanged', len(crosswalk['unchanged_weight_ids']) == 19
      and all(new_by_id[c]['weight'] == old_by_id[c]['weight'] for c in crosswalk['unchanged_weight_ids']))
remaining = [c['weight'] for c in old if c['id'] not in old_groups]
unchanged_totals = {0.0}
for weight in remaining:
    unchanged_totals |= {x + weight for x in unchanged_totals}

def reward(raw):
    normalized = raw / 49.5
    return 0 if normalized <= .05 else .4 + .6 * normalized

clear_max = any_max = published_clear = published_any = 0
witness = None
for bits in itertools.product([0, 1], repeat=13):
    isolation, unsupported, network, js, html, timer, promise, inside, leave, export, imported, rename, stale_rename = bits
    old_raw = 3.5*isolation*unsupported + 4*js*html*timer*promise + 2*inside*leave + 2.5*export*imported + 3*rename
    new_raw = 1.25*isolation + 1.75*unsupported + .5*network + js+html+timer+promise + 1.25*inside + .75*leave + .5*export + 2*imported + 1.5*(rename+stale_rename)
    for unchanged in unchanged_totals:
        before, after = old_raw + unchanged, new_raw + unchanged
        delta = reward(after) - reward(before)
        published_delta = round(reward(after), 4) - round(reward(before), 4)
        published_any = max(published_any, published_delta)
        if before / 49.5 > .05 and after / 49.5 > .05:
            clear_max = max(clear_max, delta)
            published_clear = max(published_clear, published_delta)
        if delta > any_max:
            any_max = delta
            witness = {'old_raw': before, 'new_raw': after, 'old_reward': reward(before), 'new_reward': reward(after), 'bits': list(bits)}

result = {'scope': 'Local regression assertions and conservative abstract redistribution bounds. These are not model predictions or paid judging. Gates and presentation assumed equal and passed; presentation1. New stricter legs can lower scores. Some Boolean combinations may not represent feasible apps.',
          'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks), 'checks': checks,
          'score_analysis': {'unrounded_increase_when_both_clear_floor': clear_max, 'unrounded_increase_with_floor_crossing': any_max,
                             'published_increase_when_both_clear_floor': round(published_clear, 4), 'published_increase_with_floor_crossing': round(published_any, 4), 'floor_crossing_witness': witness,
                             'old_inert_shell_weight': 3, 'old_inert_shell_functional': 3/49.5, 'old_inert_shell_reward_at_presentation_075': round(.6*(3/49.5) + .2*.75 + .2*.75, 4)},
          'source_hashes': {p.relative_to(task).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(task.rglob('*')) if p.is_file()}}
out.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: result[k] for k in ['passed', 'failed', 'score_analysis']}, indent=2))
if result['failed']:
    raise SystemExit(1)
