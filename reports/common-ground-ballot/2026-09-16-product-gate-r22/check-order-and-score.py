"""Exercise installed RewardKit scheduling/aggregation with offline judge doubles."""
import asyncio
import importlib
import json
import os
from pathlib import Path
import re

os.environ['REWARDKIT_JUDGE'] = 'codex'
os.environ['LITELLM_LOCAL_MODEL_COST_MAP'] = 'True'
from rewardkit.runner import discover, _run_all
from rewardkit.models import Score, AgentJudge

module = importlib.import_module('rewardkit.reward')
runner = Path('/tests/test.sh').read_text()
score_source = re.search(r"cat > /opt/common-ground-verifier/score <<'COMMON_GROUND_HELPER_3'\n([\s\S]*?)\nCOMMON_GROUND_HELPER_3",runner)[1]
# Functions require a shared globals namespace after exec.
scope = {'__name__':'scorer'}
exec(compile(score_source,'generated-private-score','exec'),scope)

results = []
async def run_case(case, gate_pass):
    rewards = discover('/tests')
    names = [reward.name for reward in rewards]
    assert names == ['constraints','functional','polish','render','visual'],names
    assert all(isinstance(reward.judge,AgentJudge) for reward in rewards)
    owner = {id(reward.judge):reward.name for reward in rewards}
    events = []
    active = 0
    peak = 0
    async def fake_agent(judge, criteria, weights, **kwargs):
        nonlocal active,peak
        name = owner[id(judge)]
        events.append({'dimension':name,'event':'start'})
        active += 1
        peak = max(peak,active)
        await asyncio.sleep(.01)
        scores = [Score(name=criterion.name,value=0.0 if criterion.name=='working_ballot_journey' and not gate_pass else 1.0,
                        raw='offline-judge-fixture',weight=weights[index] if weights else 1.0)
                  for index,criterion in enumerate(criteria)]
        active -= 1
        events.append({'dimension':name,'event':'end'})
        return scores,'Offline control; no model invoked',[]
    module.arun_agent = fake_agent
    await _run_all(rewards,max_concurrent_agent=1)
    starts = [event['dimension'] for event in events if event['event']=='start']
    assert starts == names and peak == 1,(events,peak)
    assert events == [dict(dimension=name,event=event) for name in names for event in ('start','end')]
    data = {reward.name:reward.score for reward in rewards}
    assert data['render'] == (1.0 if gate_pass else 0.0)
    final = scope['compose'](data,Path('/tests'))
    assert final == (1.0 if gate_pass else 0.0),(case,data,final)
    results.append({'case':case,'passed':True,'discovery_order':names,'execution_events':events,
                    'peak_agent_concurrency':peak,'dimension_scores':data,'final_reward':final,
                    'scope':'actual installed scheduler, all_pass aggregation and unchanged final scorer; offline judge inputs'})

async def main():
    await run_case('working_journey_and_all_other_criteria_pass',True)
    await run_case('working_journey_fails_even_if_every_other_criterion_passes',False)

asyncio.run(main())
out = Path('/results')
out.mkdir(exist_ok=True)
(out/'order-and-score-results.json').write_text(json.dumps({'passed':len(results),'failed':0,'scored_oracle':False,'results':results},indent=2)+'\n')
print(json.dumps({'passed':len(results),'failed':0,'order':results[0]['discovery_order'],'failed_workflow_max_other_score':results[1]['final_reward']},indent=2))
