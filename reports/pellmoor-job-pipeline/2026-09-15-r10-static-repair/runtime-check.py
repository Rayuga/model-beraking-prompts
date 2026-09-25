import asyncio
import base64
import hashlib
import importlib
import importlib.metadata
import json
import math
import os
from pathlib import Path
import re
import subprocess
import sys
import tomllib

os.environ['REWARDKIT_JUDGE'] = 'codex'
os.environ['REWARDKIT_MODEL'] = 'gpt-5.6-luna'
os.environ['REWARDKIT_REASONING_EFFORT'] = 'max'

import rewardkit.runner as runner
reward_module = importlib.import_module('rewardkit.reward')
from rewardkit.models import Score

source = Path('/source/tests')
out = Path('/evidence') / (sys.argv[1] if len(sys.argv) > 1 else 'runtime')
out.mkdir(parents=True, exist_ok=True)
dimensions = ('render', 'constraints', 'functional', 'polish', 'visual')
expected_counts = {'render': 2, 'constraints': 2, 'functional': 40, 'polish': 10, 'visual': 6}
expected_weights = {'render': 1.0, 'constraints': 1.0, 'functional': 0.6, 'polish': 0.2, 'visual': 0.2}
assert not (source / 'rewardkit-compat.py').exists()
assert 'rewardkit-compat' not in (source / 'Dockerfile').read_text()
reward_config = tomllib.loads((source / 'reward.toml').read_text())
assert reward_config == {'reward': []}, reward_config
assert runner._load_reward_specs(source) == []

distribution = importlib.metadata.distribution('harbor-rewardkit')
assert distribution.version == '0.1.7', distribution.version
native_files = {}
for relative in ('rewardkit/runner.py', 'rewardkit/reward.py', 'rewardkit/models.py'):
    entry = next(item for item in distribution.files if str(item) == relative)
    assert entry.hash and entry.hash.mode == 'sha256', relative
    digest = hashlib.sha256(entry.locate().read_bytes()).digest()
    actual = base64.urlsafe_b64encode(digest).decode().rstrip('=')
    assert actual == entry.hash.value, ('Installed RewardKit file differs from its wheel RECORD', relative)
    native_files[relative] = digest.hex()

configs = {name: tomllib.loads((source / name / 'judge.toml').read_text()) for name in dimensions}
for name, config in configs.items():
    assert config['judge']['weight'] == expected_weights[name]
    assert config['scoring']['aggregation'] == 'weighted_mean'
    assert len(config['criterion']) == expected_counts[name]
    assert all(type(item['weight']) in (int, float) and item['weight'] > 0 for item in config['criterion'])

shipped_runner = (source / 'test.sh').read_text()
postprocessor = re.findall(r"<<'PY'\n(.*?)\nPY", shipped_runner, re.S)[-1]
assert 'if data["render"] <= 0.0 or data["constraints"] <= 0.0:' in postprocessor
assert 'reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]' in postprocessor
fallback = re.search(r'^write_zero_reward\(\) \{\n.*?^\}', shipped_runner, re.S | re.M).group(0)
final_start = shipped_runner.index('if ! python3 - "$LOG_DIR/reward.json"')
final_shell = 'set -euo pipefail\n' + fallback + '\n' + shipped_runner[final_start:]

rewards = runner.discover(source, workspace='/app')
assert {reward.name: reward.reward_weight for reward in rewards} == expected_weights
assert {reward.name: len(reward.criteria) for reward in rewards} == expected_counts
criteria_to_dimension = {tuple(c.name for c in reward.criteria): reward.name for reward in rewards}
current_case = {}
calls = []


async def synthetic_judge_boundary(judge, criteria, weights, **kwargs):
    name = criteria_to_dimension[tuple(criterion.name for criterion in criteria)]
    calls.append(name)
    values = current_case.get(name, [1.0] * len(criteria))
    assert len(values) == len(criteria)
    scores = [Score(name=criterion.name, value=value, raw=value, weight=weight)
              for criterion, value, weight in zip(criteria, values, weights)]
    return scores, 'Synthetic judge-boundary verdicts; no model or Oracle called.', []


def expected_dimensions(values):
    calculated = {}
    for name, config in configs.items():
        weights = [item['weight'] for item in config['criterion']]
        items = values.get(name, [1.0] * len(weights))
        calculated[name] = round(sum(value * weight for value, weight in zip(items, weights)) / sum(weights), 4)
    return calculated


def expected_total(scores):
    if scores['render'] <= 0.0 or scores['constraints'] <= 0.0:
        return 0.0
    return round(0.6 * scores['functional'] + 0.2 * scores['polish'] + 0.2 * scores['visual'], 4)


def run_shipped_final_stage(path):
    environment = os.environ.copy()
    environment['LOG_DIR'] = str(path)
    completed = subprocess.run(['bash'], input=final_shell, text=True, capture_output=True,
                               env=environment, timeout=20, check=False)
    (path / 'final-stage.log').write_text(completed.stdout + completed.stderr)
    assert completed.returncode == 0, completed.stderr
    return json.loads((path / 'reward.json').read_text())


original_agent_boundary = reward_module.arun_agent
reward_module.arun_agent = synthetic_judge_boundary
results = []
try:
    cases = [
        ('all_pass', {}),
        ('render_fail', {'render': [0, 0]}),
        ('constraints_fail', {'constraints': [0, 0]}),
        ('both_gates_fail', {'render': [0, 0], 'constraints': [0, 0]}),
        ('partial_positive_gates', {'render': [1, 0], 'constraints': [0, 1]}),
        ('mixed_product_scores', {'functional': [float(i % 2) for i in range(40)],
                                  'polish': [float(i % 2) for i in range(10)], 'visual': [.75] * 6}),
        ('zero_product_scores', {'functional': [0] * 40, 'polish': [0] * 10, 'visual': [0] * 6}),
    ]
    for name in dimensions:
        for index, criterion in enumerate(configs[name]['criterion']):
            values = [1.0] * expected_counts[name]
            values[index] = 0.0
            cases.append((f'one_zero-{name}-{criterion["id"]}', {name: values}))

    for case_name, current_case in cases:
        calls.clear()
        asyncio.run(runner._run_all(rewards, max_concurrent_agent=1))
        assert sorted(calls) == sorted(dimensions), (case_name, calls)
        grouped, flat = runner._group_scores(rewards)
        expected = expected_dimensions(current_case)
        assert set(flat) == set(dimensions)
        for name in dimensions:
            assert math.isclose(flat[name], expected[name], abs_tol=1e-10), (case_name, name, flat[name], expected[name])
        main = runner._apply_specs(flat, grouped, runner._load_reward_specs(source))
        assert main == flat and 'reward' not in main
        path = out / case_name
        path.mkdir(exist_ok=True)
        runner._write_outputs(path / 'reward.json', main, grouped, flat)
        pre_final = json.loads((path / 'reward.json').read_text())
        assert set(pre_final) == set(dimensions), pre_final
        (path / 'rewardkit-dimensions.json').write_text(json.dumps(pre_final, indent=2) + '\n')
        actual = run_shipped_final_stage(path)
        total = expected_total(expected)
        assert actual['reward'] == total and float((path / 'reward.txt').read_text()) == total
        assert actual['graded'] == 1 and actual['no_op'] == 0
        ctrf = json.loads((path / 'ctrf.json').read_text())
        assert ctrf['summary']['total'] == 5 and {item['name'] for item in ctrf['tests']} == set(dimensions)
        results.append({'case': case_name, 'passed': True, 'all_five_judges_executed': True,
                        'dimensions': expected, 'native_output_has_aggregate': False, 'final_reward': total})

    current_case = {}
    calls.clear()
    path = out / 'public-runner-integration'
    path.mkdir(exist_ok=True)
    returned = runner.run(source, output=path / 'reward.json', max_concurrent_agent=1)
    assert sorted(calls) == sorted(dimensions), calls
    assert returned == {name: 1.0 for name in dimensions} and 'reward' not in returned
    assert set(json.loads((path / 'reward.json').read_text())) == set(dimensions)
    assert run_shipped_final_stage(path)['reward'] == 1.0
    results.append({'case': 'public-runner-integration', 'passed': True, 'all_five_judges_executed': True,
                    'native_output_has_aggregate': False, 'final_reward': 1.0})
finally:
    reward_module.arun_agent = original_agent_boundary

invalid_values = [('boolean', True), ('nan', float('nan')), ('infinity', float('inf')),
                  ('negative', -.1), ('above_one', 1.1), ('text', '1'), ('null', None),
                  ('array', []), ('object', {})]
for dimension in dimensions:
    for label, invalid in [('missing', None)] + invalid_values:
        case_name = f'malformed-{dimension}-{label}'
        path = out / case_name
        path.mkdir(exist_ok=True)
        data = {name: 1.0 for name in dimensions}
        if label == 'missing':
            del data[dimension]
        else:
            data[dimension] = invalid
        (path / 'reward.json').write_text(json.dumps(data))
        actual = run_shipped_final_stage(path)
        assert actual == {'reward': 0.0, 'render': 0.0, 'constraints': 0.0, 'functional': 0.0,
                          'polish': 0.0, 'visual': 0.0, 'graded': 0, 'no_op': 1}, (case_name, actual)
        assert float((path / 'reward.txt').read_text()) == 0.0
        results.append({'case': case_name, 'passed': True, 'rejected_by_shipped_scorer': True,
                        'shipped_zero_fallback_executed': True, 'final_reward': 0.0})

path = out / 'malformed-invalid-json'
path.mkdir(exist_ok=True)
(path / 'reward.json').write_text('{not valid json')
actual = run_shipped_final_stage(path)
assert actual['reward'] == 0.0 and actual['graded'] == 0 and actual['no_op'] == 1
results.append({'case': 'malformed-invalid-json', 'passed': True, 'shipped_zero_fallback_executed': True})

report = {
    'scope': 'Native pinned RewardKit discovery/scheduling/aggregation/writer and exact shipped final scoring shell; synthetic model-boundary verdicts, not Oracle scores.',
    'rewardkit_version': distribution.version,
    'wheel_record_verified_native_files': native_files,
    'only_replaced_boundary': 'rewardkit.reward.arun_agent; replaced in memory with explicit synthetic criterion scores, restored afterward',
    'framework_source_patches_applied': False,
    'reward_specs': runner._load_reward_specs(source),
    'judge_weights': expected_weights,
    'all_five_aggregations': 'weighted_mean',
    'criterion_counts': expected_counts,
    'single_zero_criterion_cases': sum(expected_counts.values()),
    'single_zero_gate_behavior': 'Each one-zero gate remains positive under its configured weighted mean; final gate uses <=0, unchanged.',
    'source_sha256': {str(file.relative_to(source)): hashlib.sha256(file.read_bytes()).hexdigest()
                      for file in [source / 'test.sh', source / 'reward.toml', source / 'Dockerfile'] +
                      [source / name / 'judge.toml' for name in dimensions]},
    'results': results,
}
(out / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
print(f'PASS {len(results)} native RewardKit/final-score regression cases; no intermediate aggregate, no framework source patches; NOT an Oracle score.')
