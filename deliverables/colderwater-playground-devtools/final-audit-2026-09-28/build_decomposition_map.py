"""Bind final rows to the original37 scenario budgets; writes review artifacts only."""
import argparse
from copy import deepcopy
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import tomllib

parser=argparse.ArgumentParser()
parser.add_argument('--task',type=Path,required=True)
args=parser.parse_args()
review=Path(__file__).resolve().parent
baseline=review.parent/'structural-review-2026-09-27/semantics/decomposition-map.json'
old=json.loads(baseline.read_text(encoding='utf-8'))
judge=args.task/'tests/scored/functional/judge.toml'
criteria=tomllib.loads(judge.read_text(encoding='utf-8'))['criterion']
mapping=deepcopy(old['mapping'])
by_scenario={p['scenario']:p for p in mapping}
for parent in mapping:
    parent['atomic_outcomes']=[]
    # Do not carry older planning estimates forward as current workload facts.
    parent['prior_nominal_ui_actions']=parent.pop('nominal_ui_actions',None)
for row in criteria:
    match=re.match(r'^(S\d{2})\.([a-zA-Z0-9_]+):\s*(.*)',row['description'],re.S)
    assert match,(row['id'],'missing supported scenario/evidence key')
    scenario,key,description=match.groups()
    assert scenario in by_scenario,(row['id'],scenario,'new scenario requires explicit budget map review')
    assert row['type']=='binary' and Decimal(str(row['weight']))>0
    by_scenario[scenario]['atomic_outcomes'].append({'id':row['id'],'weight':str(row['weight']),'evidence_key':scenario+'.'+key,'outcome':description})
for parent in mapping:
    actual=sum((Decimal(r['weight']) for r in parent['atomic_outcomes']),Decimal(0))
    assert actual==Decimal(parent['original_weight']),(parent['original_id'],parent['original_weight'],str(actual))
total=sum((Decimal(str(r['weight'])) for r in criteria),Decimal(0))
assert total==Decimal('49.5') and len({r['id'] for r in criteria})==len(criteria)
report={
    'original_count':len(mapping),'atomic_count':len(criteria),'scenario_count':len(mapping),'total_weight':str(total),'mapping':mapping,
    'scope':'Current row identities/descriptions and exact unchanged original scenario budgets. Mapping is not evidence that every public behavior is observed or that all outcomes are independent.',
    'baseline_map':str(baseline),'baseline_map_sha256':hashlib.sha256(baseline.read_bytes()).hexdigest(),
    'judge_sha256':hashlib.sha256(judge.read_bytes()).hexdigest(),
    'previous_atomic_count':old['atomic_count'],
    'changed_ids':{'added':sorted({r['id'] for r in criteria}-{r['id'] for p in old['mapping'] for r in p['atomic_outcomes']}),'removed':sorted({r['id'] for p in old['mapping'] for r in p['atomic_outcomes']}-{r['id'] for r in criteria})},
}
target=review/'semantics/decomposition-map.json'
target.parent.mkdir(parents=True,exist_ok=True)
target.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'rows':len(criteria),'parents':len(mapping),'weight':str(total),'new_ids':report['changed_ids']['added'],'judge_sha256':report['judge_sha256']}))
