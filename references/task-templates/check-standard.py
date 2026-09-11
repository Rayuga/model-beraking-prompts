"""Read-only preflight for Bazaarbridge configuration with Docketlight judge weights."""
from pathlib import Path
import argparse, json, re, tomllib

ROOT = Path(__file__).resolve().parents[2]
REF = ROOT / 'projects/bazaarbridge-marketplace-commerce'
WEIGHT_REF = ROOT / 'projects/docketlight-claims-insurance'
DIMS = ('render', 'constraints', 'functional', 'polish', 'visual')

def parsed(p):
    return tomllib.loads(p.read_text(encoding='utf-8'))

def keys(value, prefix=''):
    result=set()
    for k,v in value.items():
        path=prefix+k; result.add(path)
        if isinstance(v,dict): result.update(keys(v,path+'.'))
    return result

def validate(task):
    checks=[]
    def check(label, condition):
        if not condition: raise AssertionError(label)
        checks.append(label)
    cfg, ref = parsed(task/'task.toml'), parsed(REF/'task.toml')
    check('Exact task.toml key paths', keys(cfg)==keys(ref))
    for k in ('schema_version','artifacts','agent','environment','verifier'):
        check('Exact operational config: '+k,cfg[k]==ref[k])
    check('Version 1.0.0',cfg['task']['version']==ref['task']['version']=='1.0.0')
    dirs={p.parent.name for p in (task/'tests').glob('*/judge.toml')}
    check('Exactly five verifier folders',dirs==set(DIMS))
    budgets={}; counts={}
    for dim in DIMS:
        here, standard=parsed(task/f'tests/{dim}/judge.toml'),parsed(REF/f'tests/{dim}/judge.toml')
        standard['judge']['weight']=parsed(WEIGHT_REF/f'tests/{dim}/judge.toml')['judge']['weight']
        check(dim+' exact judge configuration',here['judge']==standard['judge'])
        check(dim+' no extra TOML table keys',set(here)==set(standard))
        check(dim+' no extra scoring keys',set(here['scoring'])==set(standard['scoring']))
        check(dim+' nonempty criteria',bool(here['criterion']))
        prompt=(task/f'tests/{dim}/prompt.md').read_text(encoding='utf-8')
        check(dim+' local prompt contains criteria placeholder','{criteria}' in prompt)
        task_markers=re.findall(r'^Task version: (.+)$',prompt,re.M)
        prompt_markers=re.findall(r'^Prompt version: (.+)$',prompt,re.M)
        check(dim+' explicit matching task version',task_markers==[cfg['task']['version']])
        check(dim+' unique dimension prompt version',len(prompt_markers)==1 and bool(re.fullmatch(re.escape(task.name+'-'+dim+'-v'+cfg['task']['version'])+r'-r[1-9]\d*',prompt_markers[0])))
        # Catch omission of the explicit shared prerequisite in a new dimension.
        # This checks wording/structure only, not full platform rubric semantics.
        check(dim+' explicit global browser gate',bool(re.search(r'global browser gate\s*:',prompt,re.I)))
        check(dim+' fatal browser error prerequisite','fatal' in prompt.lower() and 'error' in prompt.lower())
        check(dim+' same-origin prerequisite','same-origin' in prompt.lower())
        check(dim+' failed gate zeros criteria',bool(re.search(r'assign\s+(?:0|no|the lowest score)\s+to\s+(?:every|all)',prompt,re.I)))
        check(dim+' no judge/model overrides',not({'judge','model','reasoning_effort'}&here['judge'].keys()))
        allowed=set().union(*(c.keys() for c in standard['criterion']))
        for c in here['criterion']:
            # Binary and Likert criteria share reference schema; points is used by Visual.
            check(dim+' criterion keys: '+c['id'],set(c)<=allowed|{'points'})
        budgets[dim]=here['judge']['timeout'];counts[dim]=len(here['criterion'])
    runner=(task/'tests/test.sh').read_text(encoding='utf-8')
    check('Serial reference timeout wrapper','timeout 12600 rewardkit --max-concurrent-agent 1 /tests' in runner)
    check('Sequential budget headroom',sum(budgets.values())==12000<12600<cfg['verifier']['timeout_sec'])
    check('Lifetime budget',cfg['environment']['build_timeout_sec']+cfg['agent']['timeout_sec']+cfg['verifier']['timeout_sec']<=21600)
    check('Exact reference reward config',parsed(task/'tests/reward.toml')==parsed(REF/'tests/reward.toml'))
    for p in [task/'environment/Dockerfile',task/'tests/Dockerfile',task/'tests/test.sh']:
        s=p.read_text(encoding='utf-8')
        check(str(p.relative_to(task))+' no API key mentions',not re.search(r'(?:OPENAI|OPENROUTER)[ _-]*API[ _-]*KEY',s,re.I))
    check('Verifier max effort','model_reasoning_effort = "max"' in (task/'tests/Dockerfile').read_text(encoding='utf-8'))
    expected='''if data["render"] <= 0.0 or data["constraints"] <= 0.0:
    reward = 0.0
else:
    reward = 0.6 * data["functional"] + 0.2 * data["polish"] + 0.2 * data["visual"]'''
    check('Exact reward formula',expected in runner)
    check('Visual zero fallback','"polish":0.0,"visual":0.0' in runner)
    check('CTRF output','"total": 5' in runner and 'ctrf.json' in runner)
    return dict(task=str(task),checks=checks,counts=counts,timeouts=budgets,passed=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('task',type=Path);parser.add_argument('--output',type=Path)
    args=parser.parse_args();result=validate(args.task.resolve())
    if args.output: args.output.write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(f"PASS {len(result['checks'])} standard checks; criteria {result['counts']}")
