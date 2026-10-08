"""Inspect the installed configured judge path without executing a provider call."""
import hashlib, json, os, subprocess, time
from pathlib import Path
from rewardkit.runner import discover
from rewardkit.judges import build_prompt, _build_response_schema
from rewardkit.agents import get_agent

os.environ.update(REWARDKIT_JUDGE='claude-code', REWARDKIT_MODEL='z-ai/glm-5.3-flashx', APP_RESTART_HELPER='/logs/verifier/app-restart.sh')
out = Path('/evidence/configured-inspection'); out.mkdir(exist_ok=True)
ctx = Path('/tests/app_context.md').read_text().strip()
hashes = {p.relative_to('/tests').as_posix(): hashlib.sha256(p.read_bytes()).hexdigest() for p in Path('/tests').rglob('*') if p.is_file()}
for p in Path('/tests').glob('*/*/prompt.md'):
    p.write_text(p.read_text().replace('{app_context}', ctx))
results = []
for suite in ['gates', 'scored']:
    for reward in discover('/tests/' + suite):
        prompt = build_prompt(reward.criteria, template=reward.system_prompt)
        schema = _build_response_schema(reward.criteria)
        agent = get_agent(reward.judge.agent)
        allowed = tuple(n for s in reward.judge.mcp_servers for n in s.allowed_tool_names())
        command = agent.build_command(prompt, schema, allowed_tools=allowed) + agent.model_args(reward.judge.model)
        # /usr/bin/true accepts the same argument bytes without contacting any provider.
        probe = subprocess.run(['/usr/bin/true', *command[1:]], capture_output=True, timeout=10)
        result = dict(suite=suite, dimension=reward.name, criteria=len(reward.criteria), weight_sum=sum(reward.weights),
                      prompt_bytes=len(prompt.encode()), max_argument_bytes=max(len(x.encode()) for x in command),
                      command_bytes=sum(len(x.encode())+1 for x in command), argument_launch_exit=probe.returncode,
                      judge=reward.judge.model_dump(), unresolved_context='{app_context}' in prompt, unresolved_criteria='{criteria}' in prompt)
        results.append(result)
        (out/(suite+'-'+reward.name+'-resolved.md')).write_text(prompt)
        (out/(suite+'-'+reward.name+'-schema.json')).write_text(json.dumps(schema, indent=2))
for command in [['claude', '--version'], ['playwright-mcp', '--version'], ['node', '--version']]:
    p = subprocess.run(command, capture_output=True, text=True, timeout=30)
    results.append(dict(command=command, exit_code=p.returncode, stdout=p.stdout, stderr=p.stderr))
record=dict(kind='Installed RewardKit parser, prompt, response schema, configured CLI construction and OS argument launch only; NO provider grade', tests_sha256=hashes, results=results)
(out/'results.json').write_text(json.dumps(record, indent=2))
print(json.dumps(record, indent=2))
