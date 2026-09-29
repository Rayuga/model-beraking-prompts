"""Synthetic canonical-scorer witnesses; never a paid or observed model score."""
from pathlib import Path
import importlib.util
import json
import sys

sys.dont_write_bytecode = True
out = Path(__file__).resolve().parent
root = out.parents[2]
spec = importlib.util.spec_from_file_location('colderwater_score', root / 'projects/colderwater-playground-devtools/tests/tools/score.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
cases = [
    ('old_editor_only_arithmetic', 1, 1, 3/49.5, .75, .75, .3364),
    ('new_inert_run_gate_failure', 0, 1, 1, 1, 1, 0),
    ('new_browser_only_library_gate_failure', 1, 0, 1, 1, 1, 0),
    ('functional_exact_floor_is_zero', 1, 1, .05, 1, 1, 0),
]
results = []
for name, render, constraints, functional, polish, visual, expected in cases:
    case = out / 'synthetic-score-cases' / name
    (case / 'gates').mkdir(parents=True, exist_ok=True)
    (case / 'scored').mkdir(exist_ok=True)
    (case / 'gates/reward.json').write_text(json.dumps({'render':render,'constraints':constraints}), encoding='utf-8')
    (case / 'scored/reward.json').write_text(json.dumps({'functional':functional,'polish':polish,'visual':visual}), encoding='utf-8')
    status = module.main(case)
    result = json.loads((case / 'reward.json').read_text(encoding='utf-8'))
    assert result['reward'] == expected
    assert status == (0 if render and constraints else 1)
    results.append({'name':name,'passed':True,'inputs':{'render':render,'constraints':constraints,'functional':functional,'polish':polish,'visual':visual},'expected':expected,'result':result,'exit_code':status})
report = {'scope':'Executed unchanged canonical score.py with synthetic dimension records. Old-shell value is analytic; new gate inputs represent the observed missing prerequisites. No judge/model run or full fixture score is measured.','passed':4,'failed':0,'results':results}
(out / 'mock_score_policy_results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'passed':4,'failed':0,'rewards':[c['result']['reward'] for c in results]}))
