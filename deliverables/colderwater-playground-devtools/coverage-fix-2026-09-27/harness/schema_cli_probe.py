"""Unpaid actual-RewardKit schema/serialization fixture, never app evidence.

Run in a disposable existing verifier image with --network none, /workspace
read-only and only /evidence writable on the host. /tests changes are ephemeral.
"""
from pathlib import Path
import argparse
import hashlib
import importlib.metadata
import json
import os
import shutil
import subprocess
import tomllib
from decimal import Decimal

parser = argparse.ArgumentParser()
parser.add_argument('--task', type=Path, required=True)
parser.add_argument('--output', type=Path, default=Path('/evidence'))
args = parser.parse_args()
task = args.task
out = args.output
tag = os.environ.get('CW_FIXTURE_TAG', '')
output_suffix = '-' + tag if tag else ''
tests = Path('/tests')
shutil.copytree(task / 'tests', tests, dirs_exist_ok=True)
binding = {
    'judge_sha256': hashlib.sha256((task / 'tests/scored/functional/judge.toml').read_bytes()).hexdigest(),
    'prompt_sha256': hashlib.sha256((task / 'tests/scored/functional/prompt.md').read_bytes()).hexdigest(),
    'context_sha256': hashlib.sha256((task / 'tests/app_context.md').read_bytes()).hexdigest(),
    'test_sh_sha256': hashlib.sha256((task / 'tests/test.sh').read_bytes()).hexdigest(),
    'score_py_sha256': hashlib.sha256((task / 'tests/tools/score.py').read_bytes()).hexdigest(),
}
context = (tests / 'app_context.md').read_text().strip()
for prompt in tests.glob('*/*/prompt.md'):
    prompt.write_text(prompt.read_text().replace('{app_context}', context))
specs = {p.parent.name: tomllib.loads(p.read_text()) for p in (tests / 'scored').glob('*/judge.toml')}
functional = specs['functional']['criterion']

base = Path('/tmp/cw-coverage-schema-fixture')
base.mkdir()
bin_dir = base / 'bin'
bin_dir.mkdir()
shim = bin_dir / 'claude'
shim.write_text(r'''#!/usr/local/bin/python3
import hashlib, json, os, sys
from pathlib import Path
args = sys.argv[1:]
if args[:2] == ['mcp', 'add']:
    sys.exit(0)
schema_text = args[args.index('--json-schema') + 1]
schema = json.loads(schema_text)
prompt = args[args.index('-p') + 1]
single = 'score' in schema['properties']
entries = {'single': schema} if single else schema['properties']
result = {}
for index, (name, entry) in enumerate(entries.items()):
    binary = entry['properties']['score']['type'] == 'string'
    value = 'yes' if binary else 5
    if os.environ['CW_CASE'].startswith('one_') and name == os.environ['CW_NEGATIVE_NAME']:
        value = 'no'
    result[name] = {'score': value, 'reasoning': '' if index == 0 else 'Schema transport fixture only; no app behavior observed.'}
result = dict(reversed(list(result.items())))
with open(os.environ['CW_TRACE'], 'a') as stream:
    stream.write(json.dumps({'rows': len(entries), 'prompt_bytes': len(prompt.encode()), 'prompt_sha256': hashlib.sha256(prompt.encode()).hexdigest(), 'schema_bytes': len(schema_text.encode()), 'reversed_return_order': True}) + '\n')
payload = next(iter(result.values())) if single else result
print(json.dumps({'is_error': False, 'structured_output': payload}))
''')
shim.chmod(0o755)

shell = (tests / 'test.sh').read_text()
zero_fn = shell.split('write_zero_reward() {', 1)[1].split('\nensure_reward() {', 1)[0]
guard_fn = shell.split('validate_suite() {', 1)[1].split('\nrun_suite() {', 1)[0]
zero_line = next(line for line in shell.splitlines() if line.startswith('ZERO_REWARD_JSON='))
guard = base / 'guard.sh'
guard.write_text('#!/bin/bash\nset -euo pipefail\nLOG_DIR="$1"\n' + zero_line + '\nwrite_zero_reward() {' + zero_fn + '\nvalidate_suite() {' + guard_fn + '\nvalidate_suite scored "$2"\n')

results = []
for case in ['all_yes', 'one_no', 'one_small_no']:
    negative_name = (min if case == 'one_small_no' else max)(functional, key=lambda row: row['weight'])['name']
    case_out = out / ('schema-cli' + output_suffix) / case
    scored = case_out / 'scored'
    scored.mkdir(parents=True, exist_ok=True)
    env = {
        'PATH': str(bin_dir) + ':/usr/local/bin:/usr/bin:/bin',
        'HOME': '/tmp',
        'LITELLM_LOCAL_MODEL_COST_MAP': 'True',
        'REWARDKIT_JUDGE': 'claude-code',
        'REWARDKIT_MODEL': 'local-unpaid-schema-transport-fixture',
        'APP_RESTART_HELPER': '/tmp/local-unpaid-restart-fixture',
        'CW_CASE': case,
        'CW_NEGATIVE_NAME': negative_name,
        'CW_TRACE': str(case_out / 'transport.jsonl'),
    }
    cli = subprocess.run(['rewardkit', '--max-concurrent-agent', '1', '--output', str(scored / 'reward.json'), str(tests / 'scored')], env=env, text=True, capture_output=True, timeout=40)
    (case_out / 'cli.log').write_text(cli.stdout + cli.stderr)
    validation = subprocess.run(['bash', str(guard), str(case_out), str(cli.returncode)], text=True, capture_output=True, timeout=10)
    (case_out / 'guard.log').write_text(validation.stdout + validation.stderr)
    scores = json.loads((scored / 'reward.json').read_text()) if (scored / 'reward.json').exists() else {}
    details = json.loads((scored / 'reward-details.json').read_text()) if (scored / 'reward-details.json').exists() else {}
    checks = []
    for dimension, spec in specs.items():
        rows = details.get(dimension, {}).get('criteria', [])
        expected_rows = spec['criterion']
        by_name = {row['name']: row for row in rows}
        expected_mean = float(round(sum((Decimal(str(c['weight'])) * (0 if case.startswith('one_') and c['name'] == negative_name else 1) for c in expected_rows), Decimal(0)) / sum((Decimal(str(c['weight'])) for c in expected_rows), Decimal(0)), 4))
        checks.append(len(rows) == len(expected_rows) and set(by_name) == {c['name'] for c in expected_rows})
        checks.append(scores.get(dimension) == expected_mean == details.get(dimension, {}).get('score'))
        for c in expected_rows:
            row = by_name.get(c['name'], {})
            raw = ('no' if case.startswith('one_') and c['name'] == negative_name else 'yes') if c['type'] == 'binary' else 5
            checks.append(row.get('id') == c['id'] and row.get('weight') == c['weight'] and row.get('raw') == raw and row.get('value') == (0 if raw == 'no' else 1) and row.get('error') is None)
    result = {'case': case, 'passed': cli.returncode == 0 and validation.returncode == 0 and all(checks), 'cli_exit': cli.returncode, 'submitted_guard_exit': validation.returncode, 'scores': scores, 'functional_rows': len(details.get('functional', {}).get('criteria', [])), 'negative_name': negative_name if case.startswith('one_') else None, 'negative_weight': next(c['weight'] for c in functional if c['name'] == negative_name) if case.startswith('one_') else None, 'assertion_count': len(checks)}
    results.append(result)
    print(json.dumps(result), flush=True)

report = {
    'scope': 'Harness schema/serialization fixture only, never Oracle or product evidence. Real installed RewardKit discovery, CLI invocation, parser, metadata, row normalization, weighted mean and exact submitted validate_suite function; only the Claude process is a local transport shim.',
    'version': importlib.metadata.version('harbor-rewardkit'),
    'network': 'Docker --network none', 'provider_calls': 0, 'host_task_edited': False,
    'binding': binding, 'functional_count': len(functional), 'functional_weight': str(sum((Decimal(str(c['weight'])) for c in functional), Decimal(0))),
    'results': results, 'passed': all(row['passed'] for row in results),
}
(out / ('schema_cli_results' + ('.' + tag if tag else '') + '.json')).write_text(json.dumps(report, indent=2) + '\n')
assert report['passed'], report
