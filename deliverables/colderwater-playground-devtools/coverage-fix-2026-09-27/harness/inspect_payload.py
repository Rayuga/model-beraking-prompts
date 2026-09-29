"""Installed RewardKit payload/argv check; no provider, browser or network use."""
import argparse
import hashlib
import importlib.metadata
import json
import subprocess
import tomllib
from pathlib import Path
from rewardkit.judges import build_prompt, _build_response_schema
from rewardkit.runner import _build_criteria_from_toml

parser = argparse.ArgumentParser()
parser.add_argument('--task', required=True, type=Path)
parser.add_argument('--baseline', required=True, type=Path)
parser.add_argument('--output', required=True, type=Path)
args = parser.parse_args()
sha = lambda value: hashlib.sha256(value).hexdigest()
results = []
for label, task in [('reviewed_coverage_baseline', args.baseline), ('candidate', args.task)]:
    judge = task / 'tests/scored/functional/judge.toml'
    prompt = task / 'tests/scored/functional/prompt.md'
    context = task / 'tests/app_context.md'
    config = tomllib.loads(judge.read_text())
    criteria = _build_criteria_from_toml(config['criterion'])
    resolved = build_prompt(criteria, template=prompt.read_text().replace('{app_context}', context.read_text().strip()))
    schema = json.dumps(_build_response_schema(criteria))
    launches = {}
    for key, value in [('prompt', resolved), ('schema', schema)]:
        try:
            completed = subprocess.run(['/bin/true', value], capture_output=True, timeout=3)
            launches[key] = {'launched': True, 'exit_code': completed.returncode}
        except OSError as exc:
            launches[key] = {'launched': False, 'errno': exc.errno, 'message': str(exc)}
    results.append({
        'label': label, 'task': str(task), 'rows': len(criteria),
        'judge_sha256': sha(judge.read_bytes()), 'prompt_sha256': sha(prompt.read_bytes()), 'context_sha256': sha(context.read_bytes()),
        'resolved_prompt_sha256': sha(resolved.encode()), 'response_schema_sha256': sha(schema.encode()),
        'raw_template_bytes': len(prompt.read_bytes()), 'resolved_prompt_utf8_bytes': len(resolved.encode()), 'response_schema_utf8_bytes': len(schema.encode()),
        'single_argument_local_launch': launches,
        'criterion_scoring_contract': [{k: c[k] for k in ['id', 'name', 'type', 'weight']} for c in config['criterion']],
        'judge_config': config['judge'], 'scoring_config': config['scoring'],
    })
before, after = results
report = {
    'scope': 'Installed RewardKit builders plus local exec argument feasibility; no application, provider, model judgment or timing claim.',
    'provider_calls': 0, 'network': 'none', 'rewardkit_version': importlib.metadata.version('harbor-rewardkit'),
    'results': results,
    'unchanged_response_schema': before['response_schema_sha256'] == after['response_schema_sha256'],
    'unchanged_scoring_contract': before['criterion_scoring_contract'] == after['criterion_scoring_contract'] and before['judge_config'] == after['judge_config'] and before['scoring_config'] == after['scoring_config'],
    'candidate_launch_passed': all(v.get('launched') and v.get('exit_code') == 0 for v in after['single_argument_local_launch'].values()),
}
args.output.write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps({k: v for k, v in report.items() if k != 'results'}))
print(json.dumps({k: after[k] for k in ['rows', 'resolved_prompt_utf8_bytes', 'response_schema_utf8_bytes', 'judge_sha256', 'prompt_sha256', 'context_sha256']}))
assert report['candidate_launch_passed']
