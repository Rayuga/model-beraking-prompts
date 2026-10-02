import json
import os
import subprocess
from pathlib import Path
from rewardkit.runner import discover
from rewardkit.judges import build_prompt, _build_response_schema
from rewardkit.agents import get_agent

os.environ['REWARDKIT_JUDGE'] = 'claude-code'
os.environ['REWARDKIT_MODEL'] = 'z-ai/glm-5.3-flashx'
context = Path('/tests/app_context.md').read_text().strip()
for suite in ('gates', 'scored'):
    for reward in discover('/tests/' + suite):
        prompt = build_prompt(reward.criteria, template=reward.system_prompt.replace('{app_context}', context))
        schema = _build_response_schema(reward.criteria)
        backend = get_agent(reward.judge.agent)
        allowed = tuple(name for server in reward.judge.mcp_servers for name in server.allowed_tool_names())
        command = backend.build_command(prompt, schema, allowed_tools=allowed)
        command += backend.model_args(reward.judge.model)
        # Test only the OS argv boundary with the installed builder's arguments.
        # /bin/true is deliberate: no model request or grade occurs here.
        probe = subprocess.run(['/bin/true', *command[1:]], capture_output=True, text=True)
        print(json.dumps({'suite':suite,'dimension':reward.name,'criteria':len(reward.criteria),'prompt_utf8_bytes':len(prompt.encode()),'schema_utf8_bytes':len(json.dumps(schema).encode()),'max_argument_utf8_bytes':max(len(x.encode()) for x in command),'kernel_argv_probe_exit_code':probe.returncode,'configured_judge_executed':False}))
