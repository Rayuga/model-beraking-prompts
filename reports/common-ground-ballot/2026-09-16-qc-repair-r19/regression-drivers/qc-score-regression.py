import importlib.util
import json
import os
import shutil
import tempfile
from pathlib import Path
from unittest.mock import patch

os.environ['LITELLM_LOCAL_MODEL_COST_MAP']='True'
from rewardkit.models import Score
from rewardkit.runner import discover, _group_scores, _apply_specs, _load_reward_specs
from rewardkit import runner

ROOT=Path('/task/tests')
spec=importlib.util.spec_from_file_location('ballot_score',ROOT/'score.py')
scorer=importlib.util.module_from_spec(spec);spec.loader.exec_module(scorer)
rewards=discover(ROOT)
results=[]
def record(name,**evidence):results.append(dict(name=name,passed=True,**evidence))
def reset():
 for reward in rewards:
  reward.scores=[Score(name=c.id,value=1,raw='yes',weight=reward.weights[i]) for i,c in enumerate(reward.criteria)]
def value():
 grouped,flat=_group_scores(rewards)
 output=_apply_specs(flat,grouped,_load_reward_specs(ROOT))
 assert set(output)=={'render','constraints','functional','polish','visual','reward'}
 assert all(output[k]==v for k,v in flat.items())
 return output,scorer.compose(dict(output),ROOT)

reset();assert value()[1]==1
record('Pinned RewardKit emits five dimensions and a named intermediate aggregate')
async def verdict_fixture(items,**kwargs):
 for reward in items:
  reward.scores=[Score(name=c.id,value=1,raw='yes',weight=reward.weights[i]) for i,c in enumerate(reward.criteria)]
with tempfile.TemporaryDirectory() as temporary:
 path=Path(temporary)/'reward.json'
 with patch.object(runner,'_run_all',verdict_fixture): actual=runner.run(ROOT,output=path,max_concurrent_agent=1)
 assert set(actual)=={'render','constraints','functional','polish','visual','reward'}
 scorer.write_outputs(path,path.with_suffix('.txt'),path.with_name('ctrf.json'),ROOT)
 assert json.loads(path.read_text())['reward']==1
 assert json.loads(path.read_text())['graded']==1
 assert len(json.loads(path.with_name('reward-details.json').read_text()))==5
record('Actual RewardKit writer and final scorer integrate using explicitly synthetic verdicts')

for reward in rewards:
 for i,criterion in enumerate(reward.criteria):
  reset();reward.scores[i].value=0
  data,total=value();assert total<1
  if reward.name in ('render','constraints'):
   assert data[reward.name]==0 and total==0
   assert all(s.value==1 for j,s in enumerate(reward.scores) if j!=i)
  else:assert 0<total<1
  record('Individual criterion changes final score: '+criterion.id,dimension=reward.name,dimension_score=data[reward.name],final_reward=total)

for dim in ['render','constraints','functional','polish','visual']:
 for label,bad in [('boolean',True),('string','1'),('missing',None),('nan',float('nan')),('infinity',float('inf')),('negative',-.1),('above-one',1.1)]:
  data=dict(render=1,constraints=1,functional=1,polish=1,visual=1);data[dim]=bad
  try:scorer.compose(data,ROOT)
  except ValueError:record('Invalid '+dim+' rejected: '+label)
  else:raise AssertionError((dim,label))

with tempfile.TemporaryDirectory() as temporary:
 root=Path(temporary);shutil.copytree(ROOT,root,dirs_exist_ok=True)
 path=root/'functional/judge.toml';original=path.read_text()
 path.write_text(original.replace('weight = 0.6','weight = 0.8',1))
 assert scorer.compose(dict(render=1,constraints=1,functional=0,polish=1,visual=1),root)==.3333
 record('Authoritative judge weight controls composition without runner edits')
 for replacement in ['0.0','-1.0','true','nan']:
  path.write_text(original.replace('weight = 0.6','weight = '+replacement,1))
  try:scorer.compose(dict(render=1,constraints=1,functional=1,polish=1,visual=1),root)
  except ValueError:record('Invalid dimension weight rejected: '+replacement)
  else:raise AssertionError(replacement)
 path.write_text(original)
 gate=root/'constraints/judge.toml';old=gate.read_text();gate.write_text(old.replace('all_pass','weighted_mean'))
 try:scorer.compose(dict(render=1,constraints=1,functional=1,polish=1,visual=1),root)
 except ValueError:record('Mandatory constraint aggregation cannot silently become partial credit')
 else:raise AssertionError('Gate regression accepted')
 gate.write_text(old)
 cfg=root/'reward.toml';original_cfg=cfg.read_text()
 for bad in ['reward = []','[[reward]]\nname="reward"\naggregation="sum"','[composition]\ngates=["render","constraints"]\nweighted_dimensions=["functional","polish","visual"]\nreward=[]']:
  cfg.write_text(bad)
  try:scorer.policy(root)
  except (ValueError,KeyError):record('Missing or invalid aggregate fails closed: '+bad.splitlines()[0])
  else:raise AssertionError(bad)
 cfg.write_text(original_cfg)

for v in [0,.1,.4,.7,1]:
 data=dict(render=1,constraints=1,functional=v,polish=.5,visual=.5)
 assert scorer.compose(data,ROOT)==round(.6*v+.2,4)
record('Final ranking is monotone over Functional progress')
Path('/results/qc-results.json').write_text(json.dumps({'scope':'Pinned RewardKit aggregation/writer and final scoring; synthetic verdict fixtures, no model calls','results':results},indent=2)+'\n')
print('PASS',len(results),'scoring checks')
