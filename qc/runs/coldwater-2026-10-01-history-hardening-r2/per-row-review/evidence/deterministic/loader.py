"""Load the frozen candidate with real RewardKit 0.1.7; no provider invocation."""
import importlib.metadata
import json
import os
import shutil
import tomllib
from pathlib import Path
os.environ['REWARDKIT_JUDGE']='claude-code'
os.environ['REWARDKIT_MODEL']='z-ai/glm-5.3-flashx'
os.environ['APP_RESTART_HELPER']='/logs/verifier/app-restart.sh'
shutil.copytree('/frozen/tests','/tmp/loaded-tests')
root=Path('/tmp/loaded-tests')
context=(root/'app_context.md').read_text().strip()
for p in root.glob('*/*/prompt.md'):
    p.write_text(p.read_text().replace('{app_context}',context))
from rewardkit.runner import discover
from rewardkit.judges import build_prompt,parse_judge_response
from rewardkit.reward import aggregate_scores
print('harbor-rewardkit',importlib.metadata.version('harbor-rewardkit'))
print('private checker available:',shutil.which('check-required-files.py'))
for suite in ('gates','scored'):
    for reward in discover(root/suite,workspace='/app'):
        prompt=build_prompt(reward.criteria,template=reward.system_prompt)
        assert '{app_context}' not in prompt and '{criteria}' not in prompt
        assert reward.judge.agent=='claude-code'
        assert reward.judge.model=='z-ai/glm-5.3-flashx'
        print(json.dumps({'suite':suite,'name':reward.name,'criteria':len(reward.criteria),'aggregation':reward.aggregation,'prompt_chars':len(prompt),'judge':reward.judge.model_dump()},default=str))
        for endpoint in ('low','high'):
            values={c.name:{'score':(1 if endpoint=='low' else 5) if c.output_format.__class__.__name__=='Likert' else (0 if endpoint=='low' else 1),'reasoning':'synthetic parser-boundary test, not measured app evidence'} for c in reward.criteria}
            scores=parse_judge_response(json.dumps(values),reward.criteria,reward.weights)
            print('synthetic normalization',reward.name,endpoint,aggregate_scores(scores,reward.aggregation))
print('LOAD COMPLETE; no provider or judge process invoked')
