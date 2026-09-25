from pathlib import Path
import importlib.util
import json

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
path = HERE / 'runtime-sources/score.py'
spec = importlib.util.spec_from_file_location('ballot_score', path)
score = importlib.util.module_from_spec(spec)
spec.loader.exec_module(score)
task = ROOT / 'projects/common-ground-ballot/tests'
base = dict(render=1.0, constraints=1.0, functional=1.0, polish=1.0, visual=1.0)
checks = []
for title, changed, expected in [
    ('all pass', {}, 1.0),
    ('render gate', {'render':0.0}, 0.0),
    ('constraints gate', {'constraints':0.0}, 0.0),
    ('standard formula', {'functional':.25,'polish':.75,'visual':.5}, .4),
    ('functional coefficient', {'functional':0.0}, .4),
    ('polish coefficient', {'polish':0.0}, .8),
    ('visual coefficient', {'visual':0.0}, .8),
]:
    assert score.compose(base | changed, task) == expected, title
    checks.append(title)
for value in (None, True, '1', -1, 1.01, float('nan'), float('inf')):
    try: score.compose(base | {'functional':value}, task)
    except ValueError: checks.append('reject malformed/out-of-range ' + repr(value))
    else: raise AssertionError(value)
for dimension in base:
    data = dict(base)
    del data[dimension]
    try: score.compose(data, task)
    except ValueError: checks.append('reject missing ' + dimension)
    else: raise AssertionError(dimension)
report = {'passed':len(checks),'failed':0,'scored_oracle':False,'checks':checks}
(HERE/'score-results.json').write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8')
print(json.dumps(report,indent=2))
