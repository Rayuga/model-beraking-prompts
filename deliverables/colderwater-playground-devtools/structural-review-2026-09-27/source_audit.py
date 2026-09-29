import argparse
import hashlib
import json
import re
import subprocess
import sys
import tomllib
import zipfile
from decimal import Decimal
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('slug')
parser.add_argument('out')
parser.add_argument('--task-path')
parser.add_argument('--decomposition-map', default=str(Path(__file__).resolve().parent / 'semantics/decomposition-map.json'))
args = parser.parse_args()
root = Path.cwd()
task = Path(args.task_path) if args.task_path else root / 'projects' / args.slug
template = root / 'projects/webdev-task-template'
checks = []

def check(name, result, evidence):
    checks.append({'name': name, 'passed': bool(result), 'evidence': evidence})

def read(path):
    return path.read_text(encoding='utf-8')

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

config = tomllib.loads(read(task / 'task.toml'))
standard = tomllib.loads(read(template / 'task.toml'))
check('task root keys match current staged template', set(config) == set(standard), sorted(config))
for section in standard:
    if isinstance(standard[section], dict):
        check('task keys: ' + section, set(config.get(section, {})) == set(standard[section]), sorted(config.get(section, {})))
check('canonical verifier environment', config['verifier']['env'] == standard['verifier']['env'], config['verifier']['env'])
check('public separate verifier', config['verifier']['environment_mode'] == 'separate' and config['verifier']['environment']['network_mode'] == 'public', config['verifier']['environment'])
check('canonical agent/environment limits', config['agent'] == standard['agent'] and config['environment'] == standard['environment'], [config['agent'], config['environment']])
check('task identity', config['task']['name'] == 'turing/' + args.slug, config['task']['name'])
check('slug three tokens', len(args.slug.split('-')) <= 3, args.slug)
policy = tomllib.loads(read(task / 'tests/scoring.toml'))
check('canonical scoring policy', policy == tomllib.loads(read(template / 'tests/scoring.toml')), policy)
for filename in ['score.py', 'restart_mcp.py']:
    p = task / 'tests/tools' / filename
    check('canonical shared ' + filename, p.read_bytes() == (template / 'tests/tools' / filename).read_bytes(), digest(p))

judges = {}
ids = []
for suite, names in [('gates', ['render', 'constraints']), ('scored', ['functional', 'polish', 'visual'])]:
    for name in names:
        base = task / 'tests' / suite / name
        data = tomllib.loads(read(base / 'judge.toml'))
        judges[name] = data
        judge = data['judge']
        criteria = data['criterion']
        prompt = read(base / judge['prompt_template'])
        check(name + ': permitted judge keys', not set(judge).intersection({'model', 'temperature', 'reasoning_effort', 'weight'}), sorted(judge))
        check(name + ': canonical fallback/batching', judge.get('judge') == 'claude-code' and judge['mode'] == 'batched' and judge['isolated'] is False, {k: judge[k] for k in ['judge', 'mode', 'timeout', 'isolated']})
        check(name + ': nonempty typed positive criteria', bool(criteria) and all(c['type'] in ['binary', 'likert'] and c['weight'] > 0 and c['description'].strip() for c in criteria), [{'id': c['id'], 'type': c['type'], 'weight': c['weight']} for c in criteria])
        check(name + ': Playwright MCP', any(s['name'] == 'playwright' and s['command'] == 'playwright-mcp' for s in judge['mcp_servers']), judge['mcp_servers'])
        check(name + ': restart MCP only functional', any(s['name'] == 'verifier' for s in judge['mcp_servers']) == (name == 'functional'), [s['name'] for s in judge['mcp_servers']])
        check(name + ': prompt browser/context/criteria', all(s in prompt for s in ['http://localhost:3000', '{app_context}', '{criteria}']), 'Literal entrypoint and substitutions present')
        check(name + ': untrusted submission defense', 'untrusted' in prompt.lower(), 'Prompt text reviewed separately')
        if suite == 'gates':
            check(name + ': binary all-pass gate', data['scoring']['aggregation'] == 'all_pass' and all(c['type'] == 'binary' for c in criteria), data['scoring'])
        else:
            check(name + ': weighted mean and global gate', data['scoring']['aggregation'] == 'weighted_mean' and 'global browser gate' in prompt.lower(), data['scoring'])
        if name == 'visual':
            check('visual: six runtime-valid Likert anchors', len(criteria) == 6 and all(c['type'] == 'likert' and c['points'] == 5 and all(re.search(r'^' + str(n) + r':', c['description'], re.M) for n in range(1, 6)) and not re.search(r'^0:', c['description'], re.M) for c in criteria), 'Six raw integer1–5 scales; installed RewardKit0.1.7 normalization verified in earlier runtime artifact')
        ids.extend(c['id'] for c in criteria)
check('criterion IDs globally unique', len(ids) == len(set(ids)), len(ids))
functional = judges['functional']['criterion']
functional_by_id = {c['id']: c for c in functional}
map_path = Path(args.decomposition_map)
decomposition = json.loads(read(map_path))
mapping = decomposition['mapping']
mapped_rows = [row for parent in mapping for row in parent['atomic_outcomes']]
decimal_weight = lambda value: Decimal(str(value))
functional_weight = sum((decimal_weight(c['weight']) for c in functional), Decimal(0))
check('functional inventory matches decomposition map and preserves aggregate weight', len(functional) == decomposition['atomic_count'] == len(mapped_rows) and functional_weight == Decimal('49.5') and len(ids) == len(functional) + 12, {'functional': len(functional), 'weight_decimal': str(functional_weight), 'all': len(ids), 'map_sha256': digest(map_path)})
check('decomposition outcome identities, weights and evidence keys match source', len({r['id'] for r in mapped_rows}) == len(mapped_rows) and {r['id'] for r in mapped_rows} == set(functional_by_id) and all(decimal_weight(r['weight']) == decimal_weight(functional_by_id[r['id']]['weight']) and r['evidence_key'] in functional_by_id[r['id']]['description'] for r in mapped_rows), 'Every mapped outcome owns exactly one current row at its mapped positive binary weight')
baseline_path = root / 'deliverables/colderwater-playground-devtools/two-findings-fix-2026-09-27/colderwater-playground-devtools.zip'
with zipfile.ZipFile(baseline_path) as archive:
    baseline_name = next(n for n in archive.namelist() if n == 'tests/scored/functional/judge.toml' or n.endswith('/tests/scored/functional/judge.toml'))
    baseline_bytes = archive.read(baseline_name)
    baseline = tomllib.loads(baseline_bytes.decode())['criterion']
baseline_weights = {c['id']: decimal_weight(c['weight']) for c in baseline}
check('decomposition conserves each frozen original parent budget', digest(baseline_path) == '5d0f1d74ae48e36183c5110aee5b414fb5912aa30361401950e8a248e1e4e78b' and len(mapping) == len(baseline_weights) == 37 and {p['original_id'] for p in mapping} == set(baseline_weights) and all(decimal_weight(p['original_weight']) == baseline_weights[p['original_id']] == sum((decimal_weight(r['weight']) for r in p['atomic_outcomes']), Decimal(0)) for p in mapping), {'baseline_archive_sha256': digest(baseline_path), 'baseline_judge_sha256': hashlib.sha256(baseline_bytes).hexdigest(), 'parents': len(mapping)})
check('outcome keys and supported binary names are unique', len({r['evidence_key'] for r in mapped_rows}) == len(mapped_rows) and all(c['type'] == 'binary' and c['name'] == c['id'] and re.fullmatch(r'[a-zA-Z0-9_-]{1,64}', c['name']) for c in functional), len(mapped_rows))
draft_dir = map_path.parent / 'draft'
draft_bindings = [('judge.toml', 'tests/scored/functional/judge.toml'), ('prompt.md', 'tests/scored/functional/prompt.md'), ('app_context.md', 'tests/app_context.md')]
check('current task semantic files match reviewed draft inputs', all((draft_dir / name).read_bytes() == (task / rel).read_bytes() for name, rel in draft_bindings), {rel: {'task_sha256': digest(task / rel), 'draft_sha256': digest(draft_dir / name)} for name, rel in draft_bindings})
check('metadata is short product prose and accurate hard category', config['metadata']['difficulty'] == 'hard' and config['metadata']['category'] == 'programming' and not re.search(r'QC|criteria|Jordan|judge', config['task']['description'] + config['metadata']['provenance'], re.I), config['metadata'])
functional_prompt = read(task / 'tests/scored/functional/prompt.md')
restart_match = re.search(r'^### S22\b(.*?)(?=^### |\Z)', functional_prompt, re.M | re.S)
restart_protocol = restart_match.group(1) if restart_match else ''
check('source declares early adjacent save/load and single restart in phase plan', 'S21 then immediately S22' in functional_prompt and 'Call the verifier MCP tool restart_app exactly once' in restart_protocol and functional_by_id.get('cw_process_restart_durability', {}).get('weight') == 2.5, 'Mechanical phase-plan/protocol assertions; execution order is not inferred from criterion-array order')
parent_by_id = {p['original_id']: p for p in mapping}
check('privacy and cancellation parent budgets remain unchanged', decimal_weight(parent_by_id['cw_runtime_files_not_publicly_exposed']['original_weight']) == Decimal('0.5') and decimal_weight(parent_by_id['fresh_cancel']['original_weight']) == Decimal('2.5'), 'Both parent budgets verified against frozen archive above')
privacy_match = re.search(r'^### S06\b(.*?)(?=^### |\Z)', functional_prompt, re.M | re.S)
privacy = privacy_match.group(1) if privacy_match else ''
check('source privacy protocol has all nine bounded paths and source ban', 'sole narrow exception' not in functional_prompt and '64 KiB' not in privacy and all(p in privacy and p not in read(task / 'environment/instructions/security.md') for p in ['/app.db', '/app.db-wal', '/app.db-shm', '/server.js', '/package.json', '/package-lock.json', '/npm-shrinkwrap.json', '/.git/config', '/.git/HEAD']) and 'Do not read or classify implementation source' in privacy, 'Literal bounded-protocol checks only; privacy semantics and runtime require independent review')
check('visual mobile scope excludes duplicate usability deductions', all(s in read(task / 'tests/scored/visual/prompt.md') for s in ['first five visual criteria at desktop', 'Polish owns mobile control reachability']) and all(s in judges['visual']['criterion'][-1]['description'] for s in ['operability, clipping and overflow belong to Polish', 'do not deduct']), 'Desktop aesthetic topics and cross-viewport composition are separated from mobile usability')
check('source assigns theme aesthetics to visual', 'visual criteria own contrast, palette and aesthetic readability' in functional_prompt and {'cw_theme_actual_switch', 'cw_theme_work_preserved'} <= set(functional_by_id), 'Mechanical ownership wording check; separate semantic review required')
check('timeout nesting', sum(judges[n]['judge']['timeout'] for n in ['render', 'constraints']) < 1500 and sum(judges[n]['judge']['timeout'] for n in ['functional', 'polish', 'visual']) < 11100 and 1500 + 11100 < config['verifier']['timeout_sec'], {n: d['judge']['timeout'] for n, d in judges.items()})
check('existing task and judge timeout budgets unchanged', config['verifier']['timeout_sec'] == 13200 and {n: d['judge']['timeout'] for n, d in judges.items()} == {'render': 600, 'constraints': 600, 'functional': 9000, 'polish': 900, 'visual': 900}, 'Static budget binding only, not a completion-time guarantee')

for rel in ['solution/solve.sh', 'tests/test.sh']:
    p = task / rel
    raw = p.read_bytes()
    result = subprocess.run(['C:/msys64/usr/bin/bash.exe', '-n', str(p)], capture_output=True, text=True)
    check(rel + ': valid LF bash', raw.startswith(b'#!/bin/bash\n') and b'\r\n' not in raw and result.returncode == 0, result.stderr or 'bash -n exited0')
script = read(task / 'tests/test.sh')
check('both launch paths use app CWD', script.count('sh -c \'cd "$(dirname "$1")" && exec node "$1"\'') == 2, 'Initial and restart child shells chdir before exec; outer reward trap remains')
check('reward initialized and EXIT trap', 'write_zero_reward\ntrap cleanup EXIT' in script and 'ensure_reward' in script, 'Manual flow review required in addition to source literals')
check('ordered gate/scored suites', script.index('if ! run_suite gates 1500') < script.index('if ! run_suite scored 11100'), 'Both suites use canonical score.py')
check('no database reset', not re.search(r'rm[^\n]*\$(?:\{)?APP_DB', script), 'Persistence database retained')
for rel in ['environment/Dockerfile', 'tests/Dockerfile', 'tests/test.sh']:
    body = read(task / rel)
    check(rel + ': no API-key name leakage', 'OPENAI_API_KEY' not in body and 'OPENROUTER_API_KEY' not in body, 'Provider variables remain only in allowed task.toml verifier.env')
    check(rel + ': no CPU platform pin or bare nproc', 'FROM --platform' not in body and not re.search(r'\bnproc\b(?!\s+--all)', body), rel)
check('verifier reasoning max', 'model_reasoning_effort = "max"' in read(task / 'tests/Dockerfile'), 'Pinned shared verifier Dockerfile')
agent = read(task / 'environment/Dockerfile')
check('agent excludes grading/solution', not re.search(r'^(?:COPY|ADD)\s+.*(?:solution|tests)', agent, re.M), 'Actual image contents require separate Docker evidence')

all_files = sorted(p for p in task.rglob('*') if p.is_file())
toml_count = json_count = 0
parse_failures = []
for p in all_files:
    try:
        if p.suffix == '.toml':
            tomllib.loads(read(p)); toml_count += 1
        elif p.suffix == '.json':
            json.loads(read(p)); json_count += 1
    except Exception as e:
        parse_failures.append([str(p.relative_to(task)), str(e)])
check('all TOML/JSON parse', not parse_failures, {'toml': toml_count, 'json': json_count, 'failures': parse_failures})
check('closed top level', {p.name for p in task.iterdir()} == {'task.toml', 'instruction.md', 'environment', 'solution', 'tests'}, sorted(p.name for p in task.iterdir()))
expected_test_files = {'Dockerfile', '.dockerignore', 'test.sh', 'scoring.toml', 'app_context.md', 'tools/score.py', 'tools/restart_mcp.py'}
for suite, names in [('gates', ['render', 'constraints']), ('scored', ['functional', 'polish', 'visual'])]:
    expected_test_files.update(f'{suite}/{name}/{filename}' for name in names for filename in ['judge.toml', 'prompt.md'])
actual_test_files = {p.relative_to(task / 'tests').as_posix() for p in (task / 'tests').rglob('*') if p.is_file()}
check('exact closed verifier file inventory', actual_test_files == expected_test_files, {'missing': sorted(expected_test_files - actual_test_files), 'extra': sorted(actual_test_files - expected_test_files)})
stray = [str(p.relative_to(task)) for p in all_files if p.suffix in ['.db', '.sqlite', '.zip', '.pyc'] or any(part in ['node_modules', '__pycache__', '.git'] for part in p.relative_to(task).parts)]
check('no runtime/build scratch', not stray, stray)
brief = read(task / 'instruction.md') + '\n' + '\n'.join(read(p) for p in (task / 'environment/instructions').glob('*.md'))
missing = []
for prefix, suffix in re.findall(r'/(assets|instructions)/([A-Za-z0-9_.\-/]+)', brief):
    if not (task / 'environment' / prefix / suffix.rstrip('.')).exists():
        missing.append('/' + prefix + '/' + suffix)
check('brief asset/note paths exist', not missing, missing or 'All explicit /assets and /instructions paths resolve')
check('brief substantial and no placeholders', len(read(task / 'instruction.md').split()) >= 40 and not re.search(r'\b(?:TODO|FIXME|CHANGE_ME|CHANGE-ME)\b', brief), len(read(task / 'instruction.md').split()))
scan_hits = {'host_paths': [], 'literal_secrets': [], 'draft_markers': []}
patterns = {
    'host_paths': re.compile(r'/Users/[^/\s]+|[A-Z]:\\\\Users\\\\|Documents and Settings'),
    'literal_secrets': re.compile(r'\bsk-(?:proj-|ant-)[A-Za-z0-9_-]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----'),
    'draft_markers': re.compile(r'\b(?:TODO|FIXME|CHANGE_ME|CHANGE-ME)\b'),
}
for p in all_files:
    try:
        body = read(p)
    except UnicodeDecodeError:
        continue
    for kind, pattern in patterns.items():
        if pattern.search(body):
            scan_hits[kind].append(str(p.relative_to(task)))
for kind, hits in scan_hits.items():
    check('source scan: ' + kind, not hits, hits or 'No matching source files')
scanner_output = Path(args.out).with_name(Path(args.out).stem + '_criterion_ids.json')
scanner_result = subprocess.run([sys.executable, '-X', 'utf8', str(root / 'scripts/check_public_criterion_ids.py'), str(task), '--output', str(scanner_output)], capture_output=True, text=True)
scanner_evidence = json.loads(scanner_output.read_text(encoding='utf-8')) if scanner_output.exists() else {'error': scanner_result.stderr}
check('public Markdown contains no literal criterion IDs', scanner_result.returncode == 0 and scanner_evidence.get('passed') is True, scanner_evidence)
terms_output = Path(args.out).with_name(Path(args.out).stem + '_grader_terms.json')
terms_result = subprocess.run([sys.executable, '-X', 'utf8', str(root / 'scripts/check_public_grader_terms.py'), str(task), '--output', str(terms_output)], capture_output=True, text=True)
terms_evidence = json.loads(terms_output.read_text(encoding='utf-8')) if terms_output.exists() else {'error': terms_result.stderr}
check('public Markdown contains no internal grading vocabulary', terms_result.returncode == 0 and terms_evidence.get('passed') is True, terms_evidence)
network_output = Path(args.out).with_name(Path(args.out).stem + '_network_policy.json')
network_result = subprocess.run([sys.executable, '-X', 'utf8', str(root / 'scripts/check_public_network_policy.py'), str(task), '--output', str(network_output)], capture_output=True, text=True)
network_evidence = json.loads(network_output.read_text(encoding='utf-8')) if network_output.exists() else {'error': network_result.stderr}
check('public browser assets allowed without weakening snippet security', network_result.returncode == 0 and network_evidence.get('passed') is True, network_evidence)
report = {'scope': 'Executed mechanical local source/TOML/closed-tree/map assertions only; not complete semantic review, official client scripts, full QC, platform QC, paid Oracle or model measurement. This audit does not replace or disable the semantic guard.', 'generated_utc': datetime.now(timezone.utc).isoformat(), 'task': args.slug, 'decomposition_map': {'path': str(map_path), 'sha256': digest(map_path)}, 'counts': {n: {'criteria': len(d['criterion']), 'weight': float(sum((decimal_weight(c['weight']) for c in d['criterion']), Decimal(0)))} for n, d in judges.items()}, 'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks), 'checks': checks, 'source_hashes': {str(p.relative_to(task)).replace('\\', '/'): digest(p) for p in all_files}}
out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ['task', 'counts', 'passed', 'failed']}))
for c in checks:
    if not c['passed']:
        print('FAIL:', c['name'], c['evidence'])

if report['failed']:
    sys.exit(1)
