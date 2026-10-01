"""Real installed RewardKit parser/prompt/schema/CLI construction; never executes a judge."""
import json,os,traceback
from pathlib import Path
os.environ['REWARDKIT_JUDGE']='claude-code'
os.environ['REWARDKIT_MODEL']='z-ai/glm-5.3-flashx'
os.environ['APP_RESTART_HELPER']='/logs/verifier/app-restart.sh'
from rewardkit.runner import discover
from rewardkit.judges import build_prompt,_build_response_schema
from rewardkit.agents import get_agent
out=Path('/evidence/discovery');out.mkdir(parents=True,exist_ok=True)
context=Path('/tests/app_context.md').read_text().strip()
for p in Path('/tests').glob('*/*/prompt.md'):p.write_text(p.read_text().replace('{app_context}',context))
results=[]
for suite in ['gates','scored']:
    try:
        rewards=discover('/tests/'+suite)
        for reward in rewards:
            prompt=build_prompt(reward.criteria,template=reward.system_prompt)
            schema=_build_response_schema(reward.criteria)
            prefix=suite+'-'+reward.name
            (out/(prefix+'-resolved.md')).write_text(prompt)
            (out/(prefix+'-schema.json')).write_text(json.dumps(schema,indent=2))
            backend=get_agent(reward.judge.agent)
            allowed=tuple(n for s in reward.judge.mcp_servers for n in s.allowed_tool_names())
            command=backend.build_command(prompt,schema,allowed_tools=allowed)+backend.model_args(reward.judge.model)
            # The actual CLI command is constructed, not executed; no model/provider call occurs.
            (out/(prefix+'-constructed-command.json')).write_text(json.dumps(command,indent=2))
            results.append({'suite':suite,'name':reward.name,'criteria_count':len(reward.criteria),'weight_sum':sum(reward.weights),'prompt_chars':len(prompt),'unresolved_context':'{app_context}' in prompt,'unresolved_criteria':'{criteria}' in prompt,'judge':reward.judge.model_dump(),'schema_properties':len(schema['properties'])})
    except Exception as exc:
        results.append({'suite':suite,'error':str(exc),'traceback':traceback.format_exc()})
(out/'results.json').write_text(json.dumps(results,indent=2))
print(json.dumps(results,indent=2))
if any('error' in x for x in results):raise SystemExit(1)
