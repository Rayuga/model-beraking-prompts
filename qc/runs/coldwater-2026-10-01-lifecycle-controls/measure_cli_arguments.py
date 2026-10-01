"""Offline installed-RewardKit construction only; never launch a judge or provider."""
from pathlib import Path
import hashlib
import importlib.metadata
import json
import os
import subprocess
import tomllib

os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'

import rewardkit.agents as agents
import rewardkit.judges as judges
import rewardkit.runner as runner

task = Path('/task')
out = Path('/evidence/cli-arguments')
out.mkdir(exist_ok=False)
config = tomllib.loads((task / 'task.toml').read_text())
for key in ('REWARDKIT_JUDGE', 'REWARDKIT_MODEL'):
    if key in config['verifier']['env']:
        os.environ[key] = config['verifier']['env'][key]
context = (task / 'tests/app_context.md').read_text()
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
result = {
    'provider_invoked': False,
    'judge_launched': False,
    'network': 'Docker network none; LiteLLM local cost map forced',
    'harbor_rewardkit': importlib.metadata.version('harbor-rewardkit'),
    'package_sources': {str(Path(m.__file__)): sha(Path(m.__file__)) for m in (agents, judges, runner)},
    'task_inputs': {'task.toml': sha(task / 'task.toml'), 'tests/app_context.md': sha(task / 'tests/app_context.md')},
    'system_arg_max': os.sysconf('SC_ARG_MAX'),
    'linux_single_argument_limit': os.sysconf('SC_PAGE_SIZE') * 32,
    'dimensions': []
}
for path in sorted((task / 'tests').glob('*/*/judge.toml')):
    data = tomllib.loads(path.read_text())
    prompt_path = path.parent / data['judge']['prompt_template']
    template = prompt_path.read_text().replace('{app_context}', context)
    criteria = runner._build_criteria_from_toml(data['criterion'])
    judge = runner._build_judge_from_toml(data['judge'])
    prompt = judges.build_prompt(criteria, template=template)
    schema = judges._build_response_schema(criteria)
    backend = agents.get_agent(judge.agent)
    allowed = tuple(name for server in judge.mcp_servers for name in server.allowed_tool_names())
    command = backend.build_command(prompt, schema, allowed_tools=allowed)
    if judge.model:
        command.extend(backend.model_args(judge.model))
    assert command[0] == 'claude'
    # Execute an inert system utility with the real constructed arguments. This
    # exercises Linux argv admission without starting any CLI, MCP or provider.
    observed = subprocess.run(['/usr/bin/true', *command[1:]], capture_output=True, timeout=5)
    lengths = [len(value.encode()) + 1 for value in command]
    label = path.parent.name
    (out / f'{label}.resolved-prompt.txt').write_text(prompt)
    (out / f'{label}.response-schema.json').write_text(json.dumps(schema, indent=2) + '\n')
    result['dimensions'].append({
        'dimension': label, 'criteria': len(criteria),
        'judge_toml_sha256': sha(path), 'prompt_template_sha256': sha(prompt_path),
        'resolved_prompt_utf8_bytes': len(prompt.encode()),
        'schema_utf8_bytes': len(json.dumps(schema).encode()),
        'max_argument_bytes_including_nul': max(lengths),
        'argv_bytes_including_nuls': sum(lengths),
        'linux_inert_exec_exit': observed.returncode,
        'below_single_argument_limit': max(lengths) < result['linux_single_argument_limit']
    })
result['passed'] = all(d['linux_inert_exec_exit'] == 0 and d['below_single_argument_limit'] for d in result['dimensions'])
result['limits'] = 'Pure builder and Linux argument-admission evidence only. Does not launch Claude, register MCP, authenticate a provider, measure LLM context/workload, or produce a grade.'
(out / 'RESULTS.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({k: result[k] for k in ('passed', 'dimensions', 'judge_launched', 'provider_invoked')}))
