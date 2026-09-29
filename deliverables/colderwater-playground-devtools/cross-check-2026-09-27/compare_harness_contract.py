"""Fresh extracted-candidate/template comparison, independent of prior PASS inventory."""
from pathlib import Path
import ast
import difflib
import hashlib
import json
import tomllib

root = Path.cwd()
out = Path(__file__).resolve().parent
candidate = root/'deliverables/colderwater-playground-devtools/full-qc-2026-09-27/archive-check-b34abc10a29b/colderwater-playground-devtools'
template = root/'projects/webdev-task-template'
current = root/'projects/colderwater-playground-devtools'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
shared = {}
for rel in ['tests/tools/score.py','tests/tools/restart_mcp.py','tests/scoring.toml','tests/Dockerfile','environment/Dockerfile','tests/.dockerignore']:
    a,b = candidate/rel,template/rel
    shared[rel] = {'candidate_sha256':sha(a),'template_sha256':sha(b),
                   'byte_equal':a.read_bytes()==b.read_bytes()}
    if rel.endswith('.py'):
        shared[rel]['ast_equal'] = ast.dump(ast.parse(a.read_text()))==ast.dump(ast.parse(b.read_text()))
    if a.read_bytes()!=b.read_bytes():
        shared[rel]['diff'] = ''.join(difflib.unified_diff(b.read_text().splitlines(True),a.read_text().splitlines(True),fromfile='template/'+rel,tofile='extracted/'+rel))

settings = tomllib.loads((candidate/'task.toml').read_text())
base = tomllib.loads((template/'task.toml').read_text())
def keypaths(value,prefix=''):
    result = set()
    for k,v in value.items():
        p = prefix+k
        result.add(p)
        if isinstance(v,dict):
            result |= keypaths(v,p+'.')
    return result
judges = {}
for rel in ['gates/render','gates/constraints','scored/functional','scored/polish','scored/visual']:
    parsed = tomllib.loads((candidate/'tests'/rel/'judge.toml').read_text())
    config = parsed['judge']
    prompt = (candidate/'tests'/rel/'prompt.md').read_text()
    judges[rel] = {'judge':config,'aggregation':parsed['scoring']['aggregation'],
                   'count':len(parsed['criterion']),
                   'weight_total':sum(c['weight'] for c in parsed['criterion']),
                   'type_counts':{t:sum(c['type']==t for c in parsed['criterion']) for t in ['binary','likert']},
                   'has_criteria_token':'{criteria}' in prompt,'has_context_token':'{app_context}' in prompt,
                   'has_local_url':'http://localhost:3000' in prompt,
                   'prompt_sha256':sha(candidate/'tests'/rel/'prompt.md')}

report = {'scope':'Independent configuration facts from extracted b34abc10 candidate; not a 53/48 or paid verdict.',
          'shared':shared,'task_keys_equal':keypaths(settings)==keypaths(base),
          'frozen_sections_equal':{k:settings[k]==base[k] for k in ['agent','environment','verifier']},
          'task_name_matches':'turing/'+candidate.name==settings['task']['name'],
          'judges':judges,
          'timeouts':{'gate_sum':sum(judges[k]['judge']['timeout'] for k in judges if k.startswith('gates/')),
                      'gate_budget':1500,'scored_sum':sum(judges[k]['judge']['timeout'] for k in judges if k.startswith('scored/')),
                      'scored_budget':11100,'suite_budget_total':12600,'verifier':settings['verifier']['timeout_sec']},
          'template_to_extracted_test_diff':''.join(difflib.unified_diff((template/'tests/test.sh').read_text().splitlines(True),(candidate/'tests/test.sh').read_text().splitlines(True),fromfile='template/test.sh',tofile='extracted/test.sh')),
          'extracted_to_repaired_test_diff':''.join(difflib.unified_diff((candidate/'tests/test.sh').read_text().splitlines(True),(current/'tests/test.sh').read_text().splitlines(True),fromfile='extracted/test.sh',tofile='repaired/test.sh')),
          'repaired_test_sh_sha256':sha(current/'tests/test.sh')}
(out/'harness_contract_comparison.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({'shared':{k:v['byte_equal'] for k,v in shared.items()},'task_keys_equal':report['task_keys_equal'],'frozen_sections_equal':report['frozen_sections_equal'],'timeouts':report['timeouts'],'repaired_test_sh_sha256':report['repaired_test_sh_sha256']},indent=2))
