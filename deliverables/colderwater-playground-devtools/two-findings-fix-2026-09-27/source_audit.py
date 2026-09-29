import argparse
import hashlib
import json
import re
import subprocess
import sys
import tomllib
from datetime import datetime, timezone
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('slug')
parser.add_argument('out')
parser.add_argument('--task-path')
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
check('functional inventory and unchanged aggregate weight', len(functional) == 37 and sum(c['weight'] for c in functional) == 49.5 and len(ids) == 49, {'functional': len(functional), 'weight': sum(c['weight'] for c in functional), 'all': len(ids)})
check('metadata is short product prose and accurate hard category', config['metadata']['difficulty'] == 'hard' and config['metadata']['category'] == 'programming' and not re.search(r'QC|criteria|Jordan|judge', config['task']['description'] + config['metadata']['provenance'], re.I), config['metadata'])
check('restart follows save/load and remains single-use', [c['id'] for c in functional].index('cw_process_restart_durability') == [c['id'] for c in functional].index('save_load') + 1 and sum('Call the verifier MCP tool restart_app exactly once' in c['description'] for c in functional) == 1, [c['id'] for c in functional])
check('new confidentiality weight is funded without changing total', functional_by_id.get('cw_runtime_files_not_publicly_exposed', {}).get('weight') == 0.5 and functional_by_id['fresh_cancel']['weight'] == 2.5, {'confidentiality': functional_by_id.get('cw_runtime_files_not_publicly_exposed', {}).get('weight'), 'cancellation': functional_by_id['fresh_cancel']['weight']})
functional_prompt = read(task / 'tests/scored/functional/prompt.md')
privacy = functional_by_id.get('cw_runtime_files_not_publicly_exposed', {}).get('description', '')
check('private representative probes stay outside public privacy goal', 'sole narrow exception' not in functional_prompt and '64 KiB' not in privacy and all(p in privacy and p not in read(task / 'environment/instructions/security.md') for p in ['/app.db', '/server.js', '/package.json', '/.git/config', '/package-lock.json']) and 'Do not read or classify implementation source' in privacy, 'Category-level public goal; representative browser-only exposure observations')
check('visual mobile scope excludes duplicate usability deductions', all(s in read(task / 'tests/scored/visual/prompt.md') for s in ['first five visual criteria at desktop', 'Polish owns mobile control reachability']) and all(s in judges['visual']['criterion'][-1]['description'] for s in ['operability, clipping and overflow belong to Polish', 'do not deduct']), 'Desktop aesthetic topics and cross-viewport composition are separated from mobile usability')
check('functional theme does not regrade aesthetic readability', 'visual criteria own contrast, palette and aesthetic readability' in functional_by_id['cw_theme_switch_legibility']['description'], 'Functional owns actual switching and preservation of working state')
check('timeout nesting', sum(judges[n]['judge']['timeout'] for n in ['render', 'constraints']) < 1500 and sum(judges[n]['judge']['timeout'] for n in ['functional', 'polish', 'visual']) < 11100 and 1500 + 11100 < config['verifier']['timeout_sec'], {n: d['judge']['timeout'] for n, d in judges.items()})

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
report = {'scope': 'Executed local source assertions only; not official client scripts, platform QC, paid Oracle or model measurement.', 'generated_utc': datetime.now(timezone.utc).isoformat(), 'task': args.slug, 'counts': {n: {'criteria': len(d['criterion']), 'weight': sum(c['weight'] for c in d['criterion'])} for n, d in judges.items()}, 'passed': sum(c['passed'] for c in checks), 'failed': sum(not c['passed'] for c in checks), 'checks': checks, 'source_hashes': {str(p.relative_to(task)).replace('\\', '/'): digest(p) for p in all_files}}
out = Path(args.out)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: report[k] for k in ['task', 'counts', 'passed', 'failed']}))
for c in checks:
    if not c['passed']:
        print('FAIL:', c['name'], c['evidence'])

if report['failed']:
    sys.exit(1)
