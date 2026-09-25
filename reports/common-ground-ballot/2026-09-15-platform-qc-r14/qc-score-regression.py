import importlib.util
import json
import os
from pathlib import Path
import shutil
import tempfile

os.environ['LITELLM_LOCAL_MODEL_COST_MAP']='True'
from rewardkit.models import Score
from rewardkit.runner import discover, _group_scores, _apply_specs, _load_reward_specs
from rewardkit import runner
from unittest.mock import patch

ROOT=Path('/task/tests')
spec=importlib.util.spec_from_file_location('ballot_score',ROOT/'score.py')
scorer=importlib.util.module_from_spec(spec);spec.loader.exec_module(scorer)
rewards=discover(ROOT)
results=[]


def record(name,**evidence):
    results.append({'name':name,'passed':True,**evidence})


def reset():
    for reward in rewards:
        reward.scores=[Score(name=c.id,value=1,raw='yes',weight=reward.weights[i]) for i,c in enumerate(reward.criteria)]


def value():
    grouped,flat=_group_scores(rewards)
    assert _apply_specs(flat,grouped,_load_reward_specs(ROOT))==flat
    return flat,scorer.compose(dict(flat),ROOT)


reset();assert value()[1]==1
record('Pinned RewardKit emits five dimensions without a competing aggregate')
async def verdict_fixture(items,**kwargs):
    for reward in items:
        reward.scores=[Score(name=c.id,value=1,raw='yes',weight=reward.weights[i]) for i,c in enumerate(reward.criteria)]
with tempfile.TemporaryDirectory() as temporary:
    output=Path(temporary)/'reward.json'
    with patch.object(runner,'_run_all',verdict_fixture):
        actual=runner.run(ROOT,output=output,max_concurrent_agent=1)
    assert set(actual)=={'render','constraints','functional','polish','visual'}
    scorer.write_outputs(output,Path(temporary)/'reward.txt',Path(temporary)/'ctrf.json',ROOT)
    assert json.loads(output.read_text())['reward']==1
    assert len(json.loads(output.with_name('reward-details.json').read_text()))==5
record('Full pinned RewardKit writer integrates with final scorer using explicit verdict fixtures')
for reward in rewards:
    for index,criterion in enumerate(reward.criteria):
        reset();reward.scores[index].value=0
        flat,total=value()
        assert total<1,(reward.name,criterion.id)
        if reward.name in ['render','constraints']:
            assert flat[reward.name]==0 and total==0
            assert all(s.value==1 for i,s in enumerate(reward.scores) if i!=index)
        else:
            assert 0<total<1
        record('Individual criterion affects final reward: '+criterion.id,dimension=reward.name,dimension_score=flat[reward.name],final_reward=total)
polish=next(r for r in rewards if r.name=='polish')
split={'theme_switch_preserves_workspace','comfortable_touch_targets','reduced_motion_preference'}
reset()
for score in polish.scores:
    if score.name in split:score.value=0
assert value()[0]['polish']==.75 and value()[1]==.95
record('Three independent Polish checks retain former combined weight',polish=.75,final_reward=.95)
with tempfile.TemporaryDirectory() as temporary:
    root=Path(temporary)
    shutil.copytree(ROOT,root,dirs_exist_ok=True)
    path=root/'functional/judge.toml'
    original=path.read_text()
    assert 'weight = 0.6' in original
    path.write_text(original.replace('weight = 0.6','weight = 0.8',1))
    assert scorer.compose(dict(render=1,constraints=1,functional=0,polish=1,visual=1),root)==.3333
    record('Changing the authoritative judge weight changes composition without runner edits')
    for replacement in ['0.0','-1.0','true','nan']:
        path.write_text(original.replace('weight = 0.6','weight = '+replacement,1))
        try:scorer.compose(dict(render=1,constraints=1,functional=1,polish=1,visual=1),root)
        except ValueError:record('Invalid authoritative weight rejected: '+replacement)
        else:raise AssertionError(replacement)
    path.write_text(original)
    gate=root/'constraints/judge.toml';gate.write_text(gate.read_text().replace('aggregation = "all_pass"','aggregation = "weighted_mean"'))
    try:scorer.compose(dict(render=1,constraints=1,functional=1,polish=1,visual=1),root)
    except ValueError:record('Mandatory dimension cannot silently regress to weighted_mean')
    else:raise AssertionError('Gate regression accepted')
for label,bad in [('boolean',True),('string','1'),('missing',None),('nan',float('nan')),('infinity',float('inf')),('negative',-.1),('above-one',1.1)]:
    data=dict(render=1,constraints=1,functional=1,polish=1,visual=1);data['visual']=bad
    try:scorer.compose(data,ROOT)
    except ValueError:record('Invalid dimension rejected: '+label)
    else:raise AssertionError(label)
Path('/results/qc-results.json').write_text(json.dumps({'scope':'Actual pinned RewardKit aggregation and final scorer, no model calls','results':results},indent=2)+'\n')
print('PASS',len(results),'QC scoring regressions; every individual criterion affects the final reward')
