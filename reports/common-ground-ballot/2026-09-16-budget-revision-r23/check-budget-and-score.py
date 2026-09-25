"""Use actual RewardKit objects with offline judge inputs; no model calls."""
import asyncio
import importlib
import json
import os
from pathlib import Path
import re
import tomllib

os.environ['REWARDKIT_JUDGE']='codex'
os.environ['LITELLM_LOCAL_MODEL_COST_MAP']='True'
from rewardkit.runner import discover,_run_all
from rewardkit.models import Score

task=tomllib.loads(Path('/task/task.toml').read_text())
runner=Path('/tests/test.sh').read_text()
runner_cap=int(re.search(r'if ! timeout (\d+) rewardkit',runner)[1])
rewards=discover('/tests')
budgets={r.name:r.judge.timeout for r in rewards}
assert budgets=={'constraints':1200,'functional':7200,'polish':900,'render':1800,'visual':900},budgets
assert sum(budgets.values())+600==runner_cap==12600
assert runner_cap+600==task['verifier']['timeout_sec']==13200
assert task['agent']['timeout_sec']==7200
assert budgets['functional']>budgets['render']>budgets['constraints']>=budgets['polish']
score_source=re.search(r"cat > /opt/common-ground-verifier/score <<'COMMON_GROUND_HELPER_3'\n([\s\S]*?)\nCOMMON_GROUND_HELPER_3",runner)[1]
scope={'__name__':'scorer'};exec(compile(score_source,'private-score','exec'),scope)
module=importlib.import_module('rewardkit.reward')
cases=[]
async def run_case(name,fail_ids):
    rewards=discover('/tests')
    async def fake(judge,criteria,weights,**kwargs):
        return [Score(name=c.name,value=0.0 if c.name in fail_ids else 1.0,weight=weights[i],raw='Offline scoring fixture') for i,c in enumerate(criteria)],'Offline scoring fixture',[]
    module.arun_agent=fake
    await _run_all(rewards,max_concurrent_agent=1)
    values={r.name:r.score for r in rewards}
    final=scope['compose'](values,Path('/tests'))
    if name=='all_pass':assert final==1
    elif name=='only_vote_revision_fails':assert 0<values['functional']<1 and 0<final<1 and all(values[d]==1 for d in values if d!='functional')
    else:assert values['render']==0 and final==0
    cases.append({'name':name,'dimensions':values,'reward':final,'passed':True})
async def main():
    await run_case('all_pass',set())
    await run_case('only_vote_revision_fails',{'accepted_votes_preserve_ballot_revision'})
    await run_case('read_only_gate_still_forces_zero',{'working_ballot_journey'})
asyncio.run(main())
report={'passed':4,'failed':0,'judge_budgets':budgets,'sum_seconds':sum(budgets.values()),'runner_seconds':runner_cap,
        'outer_verifier_seconds':task['verifier']['timeout_sec'],'cases':cases,'scored_oracle':False,
        'scope':'Actual configured deadlines and aggregation; offline judge fixtures, not an autonomous timing measurement.'}
Path('/results/budget-and-score-results.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
