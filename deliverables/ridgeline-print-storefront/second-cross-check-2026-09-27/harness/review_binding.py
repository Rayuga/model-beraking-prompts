from pathlib import Path
from fractions import Fraction
import ast
import difflib
import hashlib
import json
import tomllib
import zipfile

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[3]
TASK = ROOT/'projects/ridgeline-print-storefront'
OLD = ROOT/'deliverables/ridgeline-print-storefront/cross-check-2026-09-27'
TEMPLATE = ROOT/'projects/webdev-task-template'
sha = lambda data: hashlib.sha256(data).hexdigest()
read = lambda path: json.loads(path.read_text(encoding='utf-8'))
manifest = read(OLD/'candidate_manifest.json')
checks = []
def check(name, value, evidence=None):
    checks.append({'name':name,'passed':bool(value),'evidence':evidence})

archive = OLD/manifest['archive']
check('baseline_archive_identity', sha(archive.read_bytes()) == manifest['sha256'] == '9944734b651333bfd5cdb9df99b05835bab74d3bf0b8a71dd4ff894c1314445c')
with zipfile.ZipFile(archive) as zipped:
    check('baseline_crc', zipped.testzip() is None)
    baseline = {name.split('/',1)[1]:zipped.read(name) for name in zipped.namelist() if not name.endswith('/')}
check('baseline_all_51_file_hashes', len(baseline) == 51 and {p:sha(data) for p,data in baseline.items()} == manifest['source_sha256'])
script = (TASK/'tests/test.sh').read_text(encoding='utf-8')
oldscript = baseline['tests/test.sh'].decode()
helper = lambda text: text.split('cat > "$LOG_DIR/app-restart.sh" <<\'SH\'\n',1)[1].split('\nSH\n',1)[0]
check('generated_restart_helper_byte_identical', helper(script) == helper(oldscript), sha(helper(script).encode()))
without_cleanup = lambda text: text[:text.index('\napp_group_has_live_processes()' if '\napp_group_has_live_processes()' in text else '\ncleanup()')] + text[text.index('\nprobe_ready()'):]
check('only_outer_cleanup_changed', without_cleanup(script) == without_cleanup(oldscript))
(HERE/'test-sh-cleanup.diff').write_text(''.join(difflib.unified_diff(oldscript.splitlines(True),script.splitlines(True),fromfile='9944734/tests/test.sh',tofile='current/tests/test.sh')),encoding='utf-8')
for path in ['tests/tools/score.py','tests/tools/restart_mcp.py','tests/scoring.toml','environment/Dockerfile','tests/Dockerfile','tests/.dockerignore']:
    data = (TASK/path).read_bytes()
    check(path+'_baseline_template_identical', data == baseline[path] == (TEMPLATE/path).read_bytes(), sha(data))
    if path.endswith('.py'):
        check(path+'_canonical_ast',ast.dump(ast.parse(data)) == ast.dump(ast.parse((TEMPLATE/path).read_bytes())))
current_task = tomllib.loads((TASK/'task.toml').read_text(encoding='utf-8'))
template_task = tomllib.loads((TEMPLATE/'task.toml').read_text(encoding='utf-8'))
for section in ['agent','environment','verifier']:
    check(section+'_runtime_section_frozen', current_task[section] == template_task[section])
check('task_identity',current_task['task']['name'] == 'turing/'+TASK.name)
judges = {}
for path in sorted(TASK.glob('tests/**/judge.toml')):
    rel = path.relative_to(TASK).as_posix()
    value = tomllib.loads(path.read_text(encoding='utf-8'))
    oldvalue = tomllib.loads(baseline[rel].decode())
    judges[path.parent.name] = value
    check(path.parent.name+'_judge_configuration_frozen',value['judge'] == oldvalue['judge'])
    check(path.parent.name+'_aggregation_frozen',value['scoring'] == oldvalue['scoring'])
    prompt = (path.parent/'prompt.md').read_text(encoding='utf-8')
    check(path.parent.name+'_context_criteria_and_local_url', all(s in prompt for s in ['{app_context}','{criteria}','http://localhost:3000']))
check('timeouts_nested', sum(judges[d]['judge']['timeout'] for d in ['render','constraints']) < 1500 and sum(judges[d]['judge']['timeout'] for d in ['functional','polish','visual']) < 11100 and 1500+11100 < current_task['verifier']['timeout_sec'])
weights = [Fraction(str(c['weight'])) for c in judges['functional']['criterion']]
total = sum(weights)
check('functional_count_weight',len(weights)==25 and total==35)
reachable={Fraction(0)}
for weight in weights:
    reachable |= {value+weight for value in reachable}
smallest = min(value for value in reachable if value/total > Fraction('0.05'))
math = {'functional_weight':str(total),'criterion_weights':{c['id']:c['weight'] for c in judges['functional']['criterion']},
        'strict_floor_functional_mass':str(total*Fraction('.05')),'smallest_attainable_mass_above_floor':str(smallest),
        'max_presentation_share':.4, 'conditional_reward_at_smallest_passing_functional_and_full_presentation':round(float(Fraction('.6')*smallest/total+Fraction('.4')),4),
        'monotonicity_scope':'Positive weights, threshold gate/floor and monotone rounding are monotone in measured dimension scores. They do not define a total quality ordering for incomparable real apps.'}
check('all_positive_weights',all(w>0 for w in weights))
scorer = read(OLD/'scoring-results.json')
check('prior_20_scorer_cases_reusable',scorer['source_sha256']==sha((TASK/'tests/tools/score.py').read_bytes()) and scorer['passed']==20 and scorer['failed']==0)
restart = read(OLD/'restart_fixed_probe_results.json')
check('prior_five_restart_cases_reusable',restart['passed'] and len(restart['results'])==5 and restart['test_sh_sha256']==sha(baseline['tests/test.sh']) and helper(script)==helper(oldscript))
fixed = read(HERE/'cleanup_fixed_probe_results.json')
check('fresh_seven_cleanup_cases',fixed['passed'] and len(fixed['results'])==7 and fixed['test_sh_sha256']==sha((TASK/'tests/test.sh').read_bytes()))
orchestration = read(HERE/'orchestration_regression_results.json')
check('fresh_four_orchestration_cases',orchestration['passed'] and len(orchestration['results'])==4 and orchestration['test_sh_sha256']==sha((TASK/'tests/test.sh').read_bytes()))
changes = {path:{'baseline':sha(data),'current':sha((TASK/path).read_bytes())} for path,data in baseline.items() if data != (TASK/path).read_bytes()}
report={'passed':all(c['passed'] for c in checks),'baseline_archive_sha256':manifest['sha256'],'current_test_sh_sha256':sha((TASK/'tests/test.sh').read_bytes()),
        'checks':checks,'arithmetic':math,'source_changes_since_baseline':changes,
        'fresh_vs_reused':{'fresh':['two-case cleanup defect reproduction','seven-case repaired cleanup regression','four orchestration cases'],
                           'reused_with_source_hashes':['five generated restart-helper cases','twenty canonical scoring fixtures'],
                           'full_browser_restart':'Prior eight grouped storefront UI/MCP observations reused only for unchanged solution and generated helper; no fresh full browser restart claimed.'},
        'evidence_sha256':{str(p.relative_to(ROOT)):sha(p.read_bytes()) for p in [OLD/'scoring-results.json',OLD/'restart_fixed_probe_results.json',OLD/'browser_restart_results.json',HERE/'cleanup_probe_results.json',HERE/'cleanup_fixed_probe_results.json',HERE/'orchestration_regression_results.json']}}
(HERE/'review_binding.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':report['passed'],'checks':len(checks),'failed':[c['name'] for c in checks if not c['passed']],'math':math,'source_changes':list(changes)},indent=2))
assert report['passed']
