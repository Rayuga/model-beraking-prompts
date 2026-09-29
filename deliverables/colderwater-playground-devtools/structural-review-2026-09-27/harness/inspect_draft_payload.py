"""Read-only size/schema audit using installed RewardKit, never a provider."""
import hashlib
import json
import subprocess
import sys
import tomllib
from pathlib import Path

from rewardkit.judges import build_prompt, _build_response_schema
from rewardkit.runner import _build_criteria_from_toml

root = Path('/workspace')
task = root / 'projects/colderwater-playground-devtools'
review = root / 'deliverables/colderwater-playground-devtools/structural-review-2026-09-27'
out = Path('/evidence')
results = []
for label, directory in [
    ('submitted_37', task / 'tests/scored/functional'),
    ('draft', review / 'semantics/draft'),
]:
    judge_path = directory / 'judge.toml'
    prompt_path = directory / 'prompt.md'
    context_path = directory / 'app_context.md' if (directory / 'app_context.md').exists() else task / 'tests/app_context.md'
    context = context_path.read_text().strip()
    config = tomllib.loads(judge_path.read_text())
    criteria = _build_criteria_from_toml(config['criterion'])
    template = prompt_path.read_text().replace('{app_context}', context)
    resolved = build_prompt(criteria, template=template)
    schema = json.dumps(_build_response_schema(criteria))
    minimum = json.dumps({c.name: {'score': 'yes', 'reasoning': ''} for c in criteria})
    concise = json.dumps({c.name: {'score': 'yes', 'reasoning': 'S01.key: observed the exact required value.'} for c in criteria})
    execution = {}
    for key, value in [('prompt', resolved), ('schema', schema)]:
        try:
            completed = subprocess.run(['/bin/true', value], capture_output=True, timeout=3)
            execution[key] = {'launched': True, 'exit_code': completed.returncode}
        except OSError as exc:
            execution[key] = {'launched': False, 'errno': exc.errno, 'message': str(exc)}
    item = {
        'label': label,
        'rows': len(criteria),
        'judge_sha256': hashlib.sha256(judge_path.read_bytes()).hexdigest(),
        'prompt_sha256': hashlib.sha256(prompt_path.read_bytes()).hexdigest(),
        'context_path': str(context_path.relative_to(root)),
        'context_sha256': hashlib.sha256(context_path.read_bytes()).hexdigest(),
        'resolved_prompt_sha256': hashlib.sha256(resolved.encode()).hexdigest(),
        'raw_template_bytes': len(prompt_path.read_bytes()),
        'resolved_prompt_utf8_bytes': len(resolved.encode()),
        'response_schema_utf8_bytes': len(schema.encode()),
        'minimum_output_utf8_bytes': len(minimum.encode()),
        'illustrative_41_char_reason_output_bytes': len(concise.encode()),
        'single_argument_local_launch': execution,
        'judge_config': config['judge'],
    }
    results.append(item)
target = out / (sys.argv[1] if len(sys.argv) > 1 else 'draft_payload_sizes.json')
target.write_text(json.dumps({'provider_calls': 0, 'network': 'none', 'method': 'installed rewardkit prompt/schema builders; local /bin/true argv launch only', 'results': results}, indent=2))
print(target.read_text())
