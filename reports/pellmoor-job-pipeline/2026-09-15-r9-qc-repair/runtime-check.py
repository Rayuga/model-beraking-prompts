import asyncio
import importlib
import json
import os
from pathlib import Path
import re
import runpy
import sys
from types import SimpleNamespace

os.environ['REWARDKIT_JUDGE'] = 'codex'
os.environ['REWARDKIT_MODEL'] = 'gpt-5.6-luna'
os.environ['REWARDKIT_REASONING_EFFORT'] = 'max'
import rewardkit.runner as runner
reward_module = importlib.import_module('rewardkit.reward')
from rewardkit.models import Score

out = Path('/evidence') / (sys.argv[1] if len(sys.argv) > 1 else 'runtime')
out.mkdir(parents=True, exist_ok=True)
before = runner._group_scores([SimpleNamespace(name='render', reward_weight=0.0, score=1.0)])[1]
assert before == {'render': 0.0}
runpy.run_path('/source/tests/rewardkit-compat.py', run_name='__main__')
runpy.run_path('/source/tests/rewardkit-compat.py', run_name='__main__')
runner = importlib.reload(runner)
rewards = runner.discover('/source/tests', workspace='/app')
assert {r.name: r.reward_weight for r in rewards} == {'render': 0.0, 'constraints': 0.0, 'functional': .6, 'polish': .2, 'visual': .2}
assert len(rewards) == 5
specs = runner._load_reward_specs('/source/tests')
postprocessor = re.findall(r"<<'PY'\n(.*?)\nPY", Path('/source/tests/test.sh').read_text(), re.S)[-1]
current_case = {}
calls = []

async def fake_agent(judge, criteria, weights, **kwargs):
    dimension = next(r.name for r in rewards if r.criteria is criteria)
    calls.append(dimension)
    values = current_case.get(dimension, [1.0] * len(criteria))
    return [Score(name=c.name, value=value, raw=value, weight=weight) for c, value, weight in zip(criteria, values, weights)], 'Synthetic boundary inputs; no hosted judge called', []

reward_module.arun_agent = fake_agent
results = []
cases = [
    ('all_pass', {}),
    ('render_fail', {'render': [0, 0]}),
    ('constraints_fail', {'constraints': [0, 0]}),
    ('partial_positive_gate', {'render': [1, 0], 'constraints': [0, 1]}),
    ('mixed_product_scores', {'functional': [float(i % 2) for i in range(40)], 'polish': [float(i % 2) for i in range(10)], 'visual': [.75] * 6}),
    ('zero_product_scores', {'functional': [0] * 40, 'polish': [0] * 10, 'visual': [0] * 6}),
]
for name, current_case in cases:
    calls.clear()
    asyncio.run(runner._run_all(rewards, max_concurrent_agent=1))
    assert sorted(calls) == ['constraints', 'functional', 'polish', 'render', 'visual']
    by_name, flat = runner._group_scores(rewards)
    for r in rewards:
        assert flat[r.name] == round(r.score, 4)
    main = runner._apply_specs(flat, by_name, specs)
    before_post = dict(main)
    path = out / name
    path.mkdir(exist_ok=True)
    runner._write_outputs(path / 'reward.json', main, by_name, flat)
    sys.argv = ['postprocessor', str(path / 'reward.json'), str(path / 'reward.txt'), str(path / 'ctrf.json')]
    exec(compile(postprocessor, 'shipped-postprocessor', 'exec'), {})
    actual = json.loads((path / 'reward.json').read_text())
    expected = 0 if flat['render'] <= 0 or flat['constraints'] <= 0 else round(.6 * flat['functional'] + .2 * flat['polish'] + .2 * flat['visual'], 4)
    assert actual['reward'] == expected
    assert json.loads((path / 'ctrf.json').read_text())['summary']['total'] == 5
    results.append({'case': name, 'passed': True, 'all_five_judges_executed': True, 'dimensions': flat, 'rewardkit_reward_before_gate': before_post['reward'], 'final_reward': expected})

for name, bad in [('missing', {}), ('boolean', {'render': True}), ('nan', {'render': float('nan')}), ('outside_range', {'render': 2}), ('text', {'render': '1'})]:
    path = out / ('malformed-' + name)
    path.mkdir(exist_ok=True)
    data = {'render': 1, 'constraints': 1, 'functional': 1, 'polish': 1, 'visual': 1}
    if name == 'missing':
        del data['render']
    else:
        data.update(bad)
    (path / 'reward.json').write_text(json.dumps(data))
    sys.argv = ['postprocessor', str(path / 'reward.json'), str(path / 'reward.txt'), str(path / 'ctrf.json')]
    try:
        exec(compile(postprocessor, 'shipped-postprocessor', 'exec'), {})
    except ValueError:
        results.append({'case': 'malformed-' + name, 'passed': True, 'rejected': True})
    else:
        raise AssertionError(name)

report = {'kind': 'Actual pinned RewardKit scheduling/aggregation with synthetic judge boundary inputs; not Oracle scores', 'original_zero_weight_bug_reproduced': before, 'compatibility_patch_idempotent': True, 'results': results}
(out / 'results.json').write_text(json.dumps(report, indent=2) + '\n')
print(f'PASS {len(results)} runtime/score cases; all five zero/nonzero-weight judges execute; actual final formula preserved')
