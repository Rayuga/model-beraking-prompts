"""Exercise installed RewardKit CLI serialization, replacing only the agent transport.

Run only in the existing verifier image with --network none. No model calls occur.
The submitted tests and the installed RewardKit sources are not patched.
"""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import os
import subprocess
import sys
import tomllib

OUT = Path('/evidence')
phase = os.environ.get('CW_AUDIT_PHASE', 'before')
shell = Path('/tests/test.sh').read_text()
shim_dir = Path('/tmp/cw-audit-shims')
shim_dir.mkdir()
shim = shim_dir / 'claude'
shim.write_text(r'''#!/usr/local/bin/python3
import json, os, sys
from pathlib import Path
args = sys.argv[1:]
case = os.environ['CW_AUDIT_CASE']
if args[:2] == ['mcp', 'add']:
    with open(os.environ['CW_AUDIT_EVENTS'], 'a') as f:
        f.write(json.dumps({'mcp_add': args}) + '\n')
    sys.exit(0)
if case == 'cli_nonzero':
    print('LOCAL FIXTURE: CLI failed before a result', file=sys.stderr)
    sys.exit(17)
if case == 'error_envelope':
    print(json.dumps({'is_error': True, 'result': 'LOCAL FIXTURE: provider error'}))
    sys.exit(0)
schema = json.loads(args[args.index('--json-schema') + 1])
single = 'score' in schema['properties']
entries = {'single': schema} if single else schema['properties']
result = {}
for index, (name, entry) in enumerate(entries.items()):
    binary = entry['properties']['score']['type'] == 'string'
    raw = ('yes' if index % 3 else 'no') if binary else (index % 5) + 1
    if case == 'all_pass' or single:
        raw = 'yes' if binary else 5
    if case == 'gate_failure':
        raw = 'no'
    reasoning = 'Local transport fixture; no product behavior was evaluated.'
    if index == 0 and case == 'empty_reasoning':
        reasoning = ''
    if index == 0 and case == 'incomplete_marker':
        raw = 'no' if binary else 1
        reasoning = 'EVALUATION_INCOMPLETE: local transport fixture has no browser observations.'
    result[name] = {'score': raw, 'reasoning': reasoning}
    if index == 0 and case == 'absent_reasoning':
        del result[name]['reasoning']
    if index == 0 and case == 'numeric_representations':
        result[name]['score'] = True if binary else '3.0'
if case == 'missing_criterion':
    del result[next(iter(result))]
result = dict(reversed(list(result.items())))
payload = next(iter(result.values())) if single and result else result
print(json.dumps({'is_error': False, 'structured_output': payload}))
''')
shim.chmod(0o755)
zero_fn = shell.split('write_zero_reward() {', 1)[1].split('\nensure_reward() {', 1)[0]
guard_fn = shell.split('validate_suite() {', 1)[1].split('\nrun_suite() {', 1)[0]
zero_line = next(line for line in shell.splitlines() if line.startswith('ZERO_REWARD_JSON='))
guard = Path('/tmp/cw-audit-guard.sh')
guard.write_text('#!/bin/bash\nset -euo pipefail\nLOG_DIR="$1"\n' + zero_line + '\nwrite_zero_reward() {' + zero_fn + '\nvalidate_suite() {' + guard_fn + '\nvalidate_suite "$2" "$3"\n')

cases = [('all_pass', 'gates'), ('gate_failure', 'gates'), ('mixed_order', 'scored'), ('empty_reasoning', 'gates'),
         ('absent_reasoning', 'gates'), ('numeric_representations', 'scored'),
         ('incomplete_marker', 'scored'), ('missing_criterion', 'scored'),
         ('cli_nonzero', 'scored'), ('error_envelope', 'scored')]
results = []
for case, suite in cases:
    log_dir = OUT/(phase+'-actual-cli-cases')/case
    target = log_dir/suite
    target.mkdir(parents=True, exist_ok=True)
    env = dict(os.environ, PATH=str(shim_dir)+':'+os.environ['PATH'],
               CW_AUDIT_CASE=case, CW_AUDIT_EVENTS=str(log_dir/'transport-events.jsonl'),
               REWARDKIT_JUDGE='claude-code', REWARDKIT_MODEL='local-unpaid-transport-fixture',
               APP_RESTART_HELPER='/tmp/local-audit-restart-helper',
               LITELLM_LOCAL_MODEL_COST_MAP='True')
    for name in list(env):
        if any(token in name for token in ['TOKEN', 'API_KEY', 'SECRET']):
            del env[name]
    command = ['rewardkit', '--max-concurrent-agent', '1', '--output', str(target/'reward.json'), '/tests/'+suite]
    cli = subprocess.run(command, env=env, text=True, capture_output=True, timeout=40)
    (target/'cli.log').write_text(cli.stdout + cli.stderr)
    validation = subprocess.run(['bash', str(guard), str(log_dir), suite, str(cli.returncode)], text=True, capture_output=True, timeout=10)
    (log_dir/'guard.log').write_text(validation.stdout+validation.stderr)
    report = json.loads((target/'reward.json').read_text()) if (target/'reward.json').exists() else None
    details = json.loads((target/'reward-details.json').read_text()) if (target/'reward-details.json').exists() else None
    diagnostic = json.loads((log_dir/'evaluation-incomplete.json').read_text()) if (log_dir/'evaluation-incomplete.json').exists() else None
    first = next(iter(details.values()))['criteria'][0] if details else None
    results.append({'case': case, 'suite': suite, 'cli_exit': cli.returncode, 'guard_exit': validation.returncode,
                    'scores': report, 'first_row_keys': list(first) if first else None, 'diagnostic': diagnostic,
                    'schema_valid_output': case not in ['absent_reasoning','missing_criterion','numeric_representations','cli_nonzero','error_envelope']})
    print(case, cli.returncode, validation.returncode, flush=True)

result = {'rewardkit_distribution': 'harbor-rewardkit', 'rewardkit_version': importlib.metadata.version('harbor-rewardkit'),
          'test_sh_sha256': hashlib.sha256(Path('/tests/test.sh').read_bytes()).hexdigest(),
          'scope': 'Actual RewardKit discovery, CLI, Claude envelope parser, verdict normalization, aggregation, metadata serialization and exact submitted guard; only Claude process transport is a local fixture. No browser observation or model quality is claimed.',
          'network': 'Docker --network none', 'results': results}
(OUT/('actual_rewardkit_results.'+phase+'.json')).write_text(json.dumps(result, indent=2)+'\n')
